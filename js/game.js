/* ============================================================================
   game.js  —  Core engine: loop, input, states, Mario/Zelda-style platformer
   levels over AI-painted backgrounds, cutscenes, menu, and mini-game glue.
   "Rough Rider — The Theodore Roosevelt Adventure"
   ========================================================================== */

(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const loading = document.getElementById("loading");
  const trplLogo = document.getElementById("trpl-logo");   // clickable TRPL wordmark overlay
  const claimBtn = document.getElementById("claim-btn");   // completion-reward claim link

  /* ---------------- Input ---------------- */
  // Touch device? On phones we hide keyboard cues ("Press ENTER…") and let the
  // on-screen buttons / tap-to-continue speak for themselves.
  const IS_TOUCH = (("ontouchstart" in window) ||
                    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0)) &&
                   !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  // Pick the keyboard wording on desktop, the touch wording (or nothing) on mobile.
  function cue(kbText, touchText){ return IS_TOUCH ? (touchText || "") : kbText; }
  const keysDown = new Set();
  const keysPressed = new Set();
  const input = { down: c => keysDown.has(c), pressed: c => keysPressed.has(c) };
  const GAME_KEYS = new Set(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"]);
  window.addEventListener("keydown", e => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keysDown.has(e.code)) keysPressed.add(e.code);
    keysDown.add(e.code);
    Audio2.resume();
    if (e.code === "KeyM") { const m = Audio2.toggleMute(); flash(m ? "Muted" : "Sound on"); }
    if (e.code === "KeyF") toggleFull();
  });
  window.addEventListener("keyup", e => keysDown.delete(e.code));
  canvas.addEventListener("mousedown", () => Audio2.resume());

  // Map a screen point to canvas coords (accounts for CSS scaling/letterbox).
  function toCanvas(clientX, clientY){
    const r = canvas.getBoundingClientRect();
    return { x:(clientX-r.left)*(W/r.width), y:(clientY-r.top)*(H/r.height) };
  }
  // Direct tap-to-select on the Chapter Select screen (mouse + touch).
  function handleSelectPointer(clientX, clientY){
    if (state !== S.SELECT) return false;
    const p = toCanvas(clientX, clientY);
    const i = chapterAt(p.x, p.y);
    if (i >= 0){ chapterIdx = i; Audio2.sfx.select(); startCutscene(); return true; }
    return false;
  }
  canvas.addEventListener("click", e => { handleSelectPointer(e.clientX, e.clientY); });
  canvas.addEventListener("touchstart", e => {
    if (state===S.SELECT && e.touches && e.touches[0]){
      if (handleSelectPointer(e.touches[0].clientX, e.touches[0].clientY)) e.preventDefault();
    }
  }, {passive:false});

  /* ---- Touch bridge (used only by touch.js on touch devices) ----
     Mirrors the keyboard exactly: down() sets the held + edge-press sets;
     up() clears the held set. info() lets the touch UI relabel its buttons
     for the current screen / mini-game.                                     */
  const touchBridge = {
    // Always register the edge-press on a fresh touch, even if a previous
    // touchend was dropped (which would otherwise leave the key stuck "down"
    // and swallow the next press — e.g. the lantern not firing).
    down(code){ keysPressed.add(code); keysDown.add(code); Audio2.resume(); },
    up(code){ keysDown.delete(code); },
    tap(code){ keysPressed.add(code); keysDown.delete(code); Audio2.resume(); },
    toggleMute(){ const m=Audio2.toggleMute(); flash(m?"Muted":"Sound on"); return m; },
    toggleFull(){ toggleFull(); },
    info(){ return { state, mgType: mg ? mg.cfg.type : null,
                     letter: (mg && mg.cur) ? mg.cur.ch : null }; },
  };
  if (typeof window !== "undefined") window.TRTouch = touchBridge;

  /* ============================================================================
     COMPLETION REWARD
     Finish all chapters → reveal a promo code for 1 free youth admission with a
     paid adult ticket. Completion is tracked per-chapter in localStorage so it
     survives a refresh; only genuine wins count.

     The code is stored base64-encoded (not as plaintext) so a casual "view
     source" / Ctrl-F won't surface it, and it's only decoded at runtime once the
     reward is actually earned. This is light obfuscation, NOT security — a
     determined user can still recover it, so the real limits (adult-ticket
     requirement, redemption cap, expiry) must live in your ticketing system.

     To change the code: open any browser console and run  btoa("YOURNEWCODE")
       then paste the result as codeEnc below. (Decode/check with atob(codeEnc).)
     ========================================================================== */
  const REWARD = {
    codeEnc: "VFJORDE4ODM=",                   // base64 of the promo code
    get code(){ try { return atob(this.codeEnc); } catch(e){ return ""; } },
    headline: "YOU COMPLETED THE JOURNEY!",
    offer: "1 FREE youth admission with a paid adult ticket",
    url: "https://www.trlibrary.com/",        // where to claim
  };
  const CLEARED_KEY = "tr_cleared_v1";
  function loadCleared(){
    try { return new Set(JSON.parse(localStorage.getItem(CLEARED_KEY) || "[]")); }
    catch(e){ return new Set(); }
  }
  let clearedSet = loadCleared();
  function markCleared(id){
    clearedSet.add(id);
    try { localStorage.setItem(CLEARED_KEY, JSON.stringify([...clearedSet])); } catch(e){}
  }
  function allCleared(){ return CHAPTERS.every(ch => clearedSet.has(ch.id)); }

  /* ---- Score: persists across levels in localStorage ----
     1 pt / coin, 2 pts / foe defeated, 5 pts / treasure chest opened. */
  const SCORE_KEY = "tr_score_v1";
  const PTS = { coin:1, foe:2, chest:5 };
  function loadScore(){ const n=parseInt(localStorage.getItem(SCORE_KEY)||"0",10); return isNaN(n)?0:n; }
  let score = loadScore();
  function addScore(n){ score += n; try { localStorage.setItem(SCORE_KEY, String(score)); } catch(e){} }

  let flashMsg = "", flashT = 0;
  function flash(m){ flashMsg = m; flashT = 80; }
  function fsElement(){
    return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || null;
  }
  function fsSupported(){
    const f = document.getElementById("frame") || document.documentElement;
    return !!(f.requestFullscreen || f.webkitRequestFullscreen || f.mozRequestFullScreen ||
              document.documentElement.webkitRequestFullscreen);
  }
  function lockLandscape(){
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock("landscape").catch(()=>{});   // many browsers reject silently
      }
    } catch(e){}
  }
  function toggleFull(){
    const f = document.getElementById("frame") || document.documentElement;
    if (!fsElement()){
      // try the frame first, then the document element (some mobile browsers
      // only honor fullscreen on the root element), across vendor prefixes
      const req = f.requestFullscreen || f.webkitRequestFullscreen || f.mozRequestFullScreen;
      const reqDoc = document.documentElement.requestFullscreen ||
                     document.documentElement.webkitRequestFullscreen;
      const p = req ? req.call(f) : (reqDoc ? reqDoc.call(document.documentElement) : null);
      // once we're in fullscreen, pin to landscape so the phone fills the screen
      if (p && p.then) p.then(lockLandscape).catch(lockLandscape); else lockLandscape();
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
      if (exit) exit.call(document);
      try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch(e){}
    }
  }
  // expose for touch.js to query support / state
  if (typeof window !== "undefined"){ window.TRFull = { toggle:toggleFull, supported:fsSupported, active:fsElement }; }

  /* ---------------- Shared ---------------- */
  const particles = new Art.Particles();
  const env = { W, H, particles, rng: Math.random };

  const PLAYER_H = 84;   // on-screen character height in levels (tuned to platforms/foes)
  const FOE_H = 42;      // foe body height (~half the player, Mario-goomba feel)
  const S = { MENU:"menu", SELECT:"select", CUTSCENE:"cutscene", LEVEL:"level",
              MGINTRO:"mgintro", MG:"mg", RECAP:"recap", WIN:"win", LOSE:"lose", END:"end" };
  let state = S.MENU;
  let chapterIdx = 0;
  let t = 0, level = null, mg = null;
  let recap = { got:[], missed:[] };   // facts collected vs missed this chapter
  let loseFrom = "mg";                  // "level" (out of hearts) or "mg" (mini-game failed)

  function costumeFor(ch){ return ch.costume || "cowboy"; }
  function ageFor(ch){ return ch.age || "adult"; }
  function musicFor(ch){
    if (ch.id<=2) return "calm";
    if (ch.id===3) return "frontier";
    if (ch.id===4) return "tense";
    if (ch.id===6) return "march";
    if (ch.id===9) return "calm";
    if (ch.id>=8) return "frontier";
    return "heroic";
  }

  /* ============================================================
     LEVEL — Mario/Zelda hybrid platformer
     ============================================================ */
  const TILE_Y = () => H*0.82;       // main ground line
  const PW = 26;                     // player half-width-ish for collisions

  function buildLevel(ch){
    const tileY = TILE_Y();
    const segs=[], plats=[], foes=[], treasures=[], coins=[];
    let x=0; const end=5200;
    // ground segments with pits
    let first=true;
    while(x<end){
      const w = first ? 520 : (260+Math.random()*240);
      segs.push({x, y:tileY, w});
      const gap = (!first && x>600 && Math.random()<0.45) ? (60+Math.random()*64) : 0;
      x += w + gap;
      first=false;
    }
    segs.push({x:end, y:tileY, w:480, last:true});
    // floating platforms
    const nP = Math.max(6, ch.facts.length+3);
    for(let i=0;i<nP;i++){
      plats.push({ x: 560 + i*620 + Math.random()*120,
                   y: tileY - (90 + Math.random()*90), w: 120 });
    }
    // foes patrol the wider ground segments — era-correct types from the chapter
    const FLYERS = new Set(["mosquito","gull","piranha"]);
    let foeToggle=0;
    for(const s of segs){
      if(s.x>500 && !s.last && s.w>260 && Math.random()<0.7){
        const kind = (foeToggle++ % 3 === 2 && ch.enemy2) ? ch.enemy2 : ch.enemy;
        const flyer = FLYERS.has(kind);
        foes.push({ x:s.x+s.w*0.5, baseY:tileY, y:tileY, minx:s.x+24, maxx:s.x+s.w-24,
                    dir:Math.random()<0.5?-1:1, dead:false, kind, flyer,
                    fly: flyer ? (40+Math.random()*30) : 0, ph:Math.random()*6 });
      }
    }
    // treasures — one per fact, on platforms; reveal a TR fact when grabbed
    ch.facts.forEach((txt,i)=>{
      const p = plats[Math.min(i, plats.length-1)];
      treasures.push({ x:p.x+p.w/2, y:p.y-30, txt, got:false });
    });
    // scattered coins for arcade feel
    for(const p of plats){ for(let k=-1;k<=1;k++) coins.push({x:p.x+p.w/2+k*26, y:p.y-58, got:false}); }
    for(const s of segs){ if(!s.last) for(let k=0;k<3;k++) coins.push({x:s.x+40+k*44, y:tileY-40, got:false}); }
    return { ch, tileY, segs, plats, foes, treasures, coins,
             flagX:end+260, goal:end+260,
             px:60, py:tileY, vy:0, onGround:true, jumps:0, face:1, walkT:0,
             cam:0, hp:3, inv:0, coinCount:0, factPop:"", factT:0, safeX:60, safeY:tileY };
  }

  function startLevel(idx){
    level = buildLevel(CHAPTERS[idx]);
    Audio2.playMusic(musicFor(CHAPTERS[idx]));
    state = S.LEVEL;
  }

  function groundAt(L, x){ // top Y of ground under x, or null over a pit
    for(const s of L.segs){ if(x>=s.x && x<=s.x+s.w) return s.y; }
    return null;
  }
  function platUnder(L, x, feet, prevFeet, vy){
    if(vy<0) return null;
    for(const p of L.plats){
      if(x>=p.x && x<=p.x+p.w && prevFeet<=p.y+6 && feet>=p.y-2 && feet<=p.y+18) return p;
    }
    return null;
  }

  function updateLevel(){
    const L=level; const speed=3.6;
    const prevFeet=L.py;
    let moving=false;
    if(input.down("ArrowRight")){ L.px+=speed; L.face=1; moving=true; }
    if(input.down("ArrowLeft")){ L.px-=speed; L.face=-1; moving=true; }
    L.px=Math.max(20,L.px);
    if(moving && L.onGround) L.walkT+=16;
    // jump / double jump
    if(input.pressed("Space")||input.pressed("ArrowUp")||input.pressed("ArrowDown")===false&&false){}
    if(input.pressed("Space")||input.pressed("ArrowUp")){
      if(L.onGround){ L.vy=-12.5; L.onGround=false; L.jumps=1; Audio2.sfx.jump(); }
      else if(L.jumps<2){ L.vy=-10.5; L.jumps=2; Audio2.sfx.jump(); }
    }
    L.vy+=0.62; L.py+=L.vy;

    // landing on ground or platform
    const gy=groundAt(L,L.px);
    let landed=false;
    if(gy!=null && L.vy>=0 && prevFeet<=gy+2 && L.py>=gy){ L.py=gy; L.vy=0; landed=true; L.safeX=L.px; L.safeY=gy; }
    const pl=platUnder(L,L.px,L.py,prevFeet,L.vy);
    if(!landed && pl){ L.py=pl.y; L.vy=0; landed=true; }
    if(landed){ if(!L.onGround) Audio2.sfx.land(); L.onGround=true; L.jumps=0; }
    else L.onGround=false;

    // fall in a pit
    if(L.py>H+40){ hurt(L, true); }

    // camera
    L.cam=Math.max(0, Math.min(L.px - W*0.32, L.goal - W + 160));

    // coins
    for(const c of L.coins){ if(c.got) continue;
      if(Math.abs(c.x-L.px)<24 && Math.abs(c.y-(L.py-46))<46){ c.got=true; L.coinCount++; addScore(PTS.coin); Audio2.sfx.coin();
        particles.spawn(c.x-L.cam,c.y,{n:6,color:"#ffd966",spread:2,life:24}); } }

    // treasures -> fact popup
    for(const f of L.treasures){ if(f.got) continue;
      if(Math.abs(f.x-L.px)<34 && Math.abs(f.y-(L.py-46))<64){
        f.got=true; L.factPop=f.txt; L.factT=240; addScore(PTS.chest); Audio2.sfx.powerup();
        particles.spawn(f.x-L.cam,f.y,{n:18,color:"#ffe08a",spread:3,life:38}); } }
    if(L.factT>0) L.factT--;

    // foes
    if(L.inv>0) L.inv--;
    for(const fo of L.foes){ if(fo.dead) continue;
      fo.x += fo.dir*(fo.flyer?2.0:1.4);
      if(fo.x<fo.minx){ fo.x=fo.minx; fo.dir=1; }
      if(fo.x>fo.maxx){ fo.x=fo.maxx; fo.dir=-1; }
      fo.y = fo.flyer ? fo.baseY - fo.fly - Math.sin(t*0.006+fo.ph)*14 : fo.baseY;
      const dx=Math.abs(fo.x-L.px);
      if(dx<32 && Math.abs(L.py-fo.y)<44){
        // stomp if falling onto it
        if(L.vy>0 && prevFeet < fo.y-FOE_H*0.5){
          fo.dead=true; L.vy=-9; addScore(PTS.foe); Audio2.foeDefeat(fo.kind);
          particles.spawn(fo.x-L.cam,fo.y-FOE_H*0.5,{n:14,color:"#cde3ff",spread:3,life:30});
        } else { hurt(L,false); }
      }
    }

    // reach flag -> mini-game
    if(L.px>=L.flagX){ startMGIntro(); }
  }

  function hurt(L, pit){
    if(L.inv>0 && !pit) return;
    L.hp--; L.inv=70; Audio2.sfx.hit();
    if(pit){ L.px=L.safeX; L.py=L.safeY-4; L.vy=0; }
    else { L.px-=L.face*40; L.vy=-7; }
    if(L.hp<=0){ loseFrom="level"; state=S.LOSE; }
  }

  function drawLevel(){
    const L=level, ch=L.ch;
    Art.drawBackground(ctx, ch.id, ch.scenery, W, H, L.cam, ch.palette, t);

    // ground segments
    for(const s of L.segs){
      const sx=s.x-L.cam; if(sx>W||sx+s.w<0) continue;
      const grd=ctx.createLinearGradient(0,s.y,0,H);
      grd.addColorStop(0, shadeHex(ch.palette.ground,18));
      grd.addColorStop(1, "#0c0a08");
      ctx.fillStyle=grd; ctx.fillRect(sx,s.y,s.w,H-s.y);
      // grassy/earth cap
      ctx.fillStyle=ch.palette.accent; ctx.fillRect(sx,s.y,s.w,7);
      ctx.fillStyle="rgba(0,0,0,.25)";
      for(let bx=sx%32;bx<sx+s.w;bx+=32) ctx.fillRect(bx,s.y+10,2,H-s.y);
    }
    // floating platforms (wood plank with grain, grass cap, bolts)
    for(const p of L.plats){
      const sx=p.x-L.cam; if(sx>W||sx+p.w<0) continue;
      ctx.fillStyle="#5a3c22"; Art.rr(ctx,sx,p.y,p.w,18,6); ctx.fill();        // under-shadow
      ctx.fillStyle="#7a5230"; Art.rr(ctx,sx,p.y,p.w,14,6); ctx.fill();        // plank
      ctx.fillStyle=ch.palette.accent; Art.rr(ctx,sx,p.y,p.w,5,3); ctx.fill(); // grass cap
      ctx.strokeStyle="rgba(0,0,0,.18)"; ctx.lineWidth=1;                      // grain
      for(let gx=sx+10; gx<sx+p.w-6; gx+=22){ ctx.beginPath(); ctx.moveTo(gx,p.y+7); ctx.lineTo(gx+8,p.y+7); ctx.stroke(); }
      ctx.fillStyle="#3a2614";                                                 // bolts
      ctx.beginPath(); ctx.arc(sx+6,p.y+10,1.8,0,7); ctx.arc(sx+p.w-6,p.y+10,1.8,0,7); ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,.4)"; ctx.lineWidth=2; Art.rr(ctx,sx,p.y,p.w,14,6); ctx.stroke();
    }
    // coins (spinning, with shine + rim)
    for(const c of L.coins){ if(c.got) continue; const sx=c.x-L.cam; if(sx<-20||sx>W+20) continue;
      const yy=c.y+Math.sin(t*0.006+c.x)*3;
      const wsc=Math.abs(Math.cos(t*0.006+c.x));            // spin = width squash
      ctx.fillStyle="#b8881e"; ctx.beginPath(); ctx.ellipse(sx,yy,6*wsc+1.5,9,0,0,7); ctx.fill();
      ctx.fillStyle="#ffd34d"; ctx.beginPath(); ctx.ellipse(sx,yy,5*wsc+1,8,0,0,7); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.7)"; ctx.beginPath(); ctx.ellipse(sx-1.5*wsc,yy-3,1.4*wsc+0.4,2.4,0,0,7); ctx.fill();
    }
    // treasures (oak-and-brass chest, glowing)
    for(const f of L.treasures){ if(f.got) continue; const sx=f.x-L.cam; if(sx<-40||sx>W+40) continue;
      const yy=f.y+Math.sin(t*0.005+f.x)*4;
      const g=ctx.createRadialGradient(sx,yy,2,sx,yy,30);
      g.addColorStop(0,"rgba(255,225,140,.85)"); g.addColorStop(1,"rgba(255,225,140,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(sx,yy,30,0,7); ctx.fill();
      ctx.fillStyle="#7a5026"; Art.rr(ctx,sx-15,yy-4,30,16,3); ctx.fill();          // box
      ctx.fillStyle="#8a5e2e"; Art.rr(ctx,sx-15,yy-12,30,10,4); ctx.fill();         // lid
      ctx.strokeStyle="#3c2710"; ctx.lineWidth=2; Art.rr(ctx,sx-15,yy-12,30,24,4); ctx.stroke();
      ctx.fillStyle="#d9b24a"; ctx.fillRect(sx-15,yy-3,30,3);                        // brass band
      ctx.fillStyle="#ffe9a8"; ctx.beginPath(); ctx.arc(sx,yy-1,3,0,7); ctx.fill();  // lock
      ctx.fillStyle="#caa64a"; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("★",sx,yy-15);
    }
    // foes
    for(const fo of L.foes){ if(fo.dead) continue; const sx=fo.x-L.cam; if(sx<-40||sx>W+40) continue;
      drawFoe(ctx,sx,fo.y,fo.kind,t,fo.dir);
    }
    // flag
    const fx=L.flagX-L.cam;
    if(fx<W+80){
      ctx.fillStyle="#3a2c18"; ctx.fillRect(fx,L.tileY-150,6,150);
      ctx.fillStyle=ch.palette.accent; ctx.beginPath();
      ctx.moveTo(fx+6,L.tileY-150); ctx.lineTo(fx+74,L.tileY-138); ctx.lineTo(fx+6,L.tileY-126); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="bold 12px Trebuchet MS"; ctx.textAlign="left"; ctx.fillText("MINI-GAME",fx+12,L.tileY-134);
    }
    // player
    const blink = L.inv>0 && (Math.floor(t/60)%2===0);
    if(!blink){
      const st = !L.onGround ? "jump" : (input.down("ArrowRight")||input.down("ArrowLeft") ? "run":"idle");
      Art.drawTR(ctx, L.px-L.cam, L.py, PLAYER_H, {costume:costumeFor(ch), age:ageFor(ch), state:st, t:L.walkT, face:L.face});
    }

    // HUD
    hudTop(ch);
    for(let i=0;i<3;i++){ ctx.fillStyle=i<L.hp?"#ff5a5a":"#444"; heartHUD(ctx,W-40-i*26,28,9); }
    ctx.fillStyle="#ffd34d"; ctx.font="bold 14px Trebuchet MS"; ctx.textAlign="right";
    ctx.fillText("◉ "+L.coinCount, W-110, 32);
    // running total score (persists across levels) — on a dark pill so it stays
    // readable over busy AI backdrops
    ctx.font="bold 16px Trebuchet MS";
    const sTxt="SCORE  "+score, sW=ctx.measureText(sTxt).width, pillW=sW+28;
    ctx.fillStyle="rgba(0,0,0,.55)"; Art.rr(ctx, W/2-pillW/2, 12, pillW, 26, 13); ctx.fill();
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=1; Art.rr(ctx, W/2-pillW/2, 12, pillW, 26, 13); ctx.stroke();
    ctx.fillStyle="#9df09d"; ctx.textAlign="center"; ctx.fillText(sTxt, W/2, 30);

    // fact popup
    if(L.factT>0 && L.factPop){
      const a=Math.min(1,L.factT/40);
      ctx.save(); ctx.globalAlpha=a;
      ctx.fillStyle="rgba(20,16,10,.9)"; Art.rr(ctx,W/2-260,H*0.12,520,54,12); ctx.fill();
      ctx.strokeStyle="#caa64a"; ctx.lineWidth=2; Art.rr(ctx,W/2-260,H*0.12,520,54,12); ctx.stroke();
      ctx.fillStyle="#ffd966"; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillText("★ HISTORY UNLOCKED", W/2, H*0.12+20);
      ctx.fillStyle="#fff"; ctx.font="15px Trebuchet MS"; ctx.fillText(L.factPop, W/2, H*0.12+42);
      ctx.restore();
    }
    // controls hint (keyboard wording on desktop; touch users have buttons)
    if(!IS_TOUCH){
      ctx.fillStyle="rgba(0,0,0,.4)"; ctx.fillRect(0,H-26,W,26);
      ctx.fillStyle="#fff"; ctx.font="13px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillText("◄ ► RUN   ·   SPACE / ↑ JUMP (press twice = double-jump)   ·   STOMP foes from above   ·   grab ★ for TR facts", W/2, H-9);
    }
  }

  /* Era-correct, detailed enemy sprites. Each drawn with feet at origin,
     facing +x, then mirrored by `dir`. Stylized to match the character. */
  const OLF="#1c140d";
  function drawFoe(ctx,x,y,kind,t,dir){
    ctx.save(); ctx.translate(x,y); ctx.scale(dir,1);
    ctx.lineJoin="round"; ctx.lineCap="round";
    const step=Math.sin(t*0.012);          // walk wobble
    // ground shadow (flyers handle their own)
    if(!["mosquito","gull","piranha"].includes(kind)){
      ctx.fillStyle="rgba(0,0,0,.22)"; ctx.beginPath(); ctx.ellipse(0,0,18,5,0,0,7); ctx.fill();
    }
    const out=(c=OLF,w=2.4)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.stroke();};
    function eye(ex,ey,r=3){ ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(ex,ey,r,r*1.2,0,0,7); ctx.fill(); out("#1c140d",1.4);
      ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(ex+1,ey+1,r*0.5,0,7); ctx.fill(); }
    function shadeClip(pathFn,col){ ctx.save(); pathFn(); ctx.clip(); ctx.fillStyle=col; ctx.fillRect(-30,-60,18,80); ctx.restore(); }

    switch(kind){
      case "bully": { // bigger boy in a flat cap, fists up
        const legw=Math.sin(t*0.012)*3;
        ctx.fillStyle="#3a3026"; ctx.fillRect(-9,-16,7,16); ctx.fillRect(2,-16,7,16);      // legs
        ctx.fillStyle="#6b5a8a"; Art.rr(ctx,-12,-40,24,26,6); ctx.fill(); out();           // jacket
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-48,9,0,7); ctx.fill(); out(); // head
        eye(3,-49,2.4);
        ctx.strokeStyle=OLF; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-1,-44); ctx.lineTo(5,-44); ctx.stroke(); // smirk
        ctx.fillStyle="#43506a"; Art.rr(ctx,-10,-58,20,7,3); ctx.fill();                    // cap
        ctx.fillStyle="#43506a"; ctx.fillRect(6,-54,8,3);                                   // brim
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(12,-30,4,0,7); ctx.fill(); out("#1c140d",1.6); // fist
        break; }
      case "rival": { // rival athlete in dark turtleneck (Yale blue)
        ctx.fillStyle="#2a2a30"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#1f3a6b"; Art.rr(ctx,-12,-42,24,28,6); ctx.fill(); out();
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,9,0,7); ctx.fill(); out();
        eye(3,-51,2.4);
        ctx.fillStyle="#3a2a18"; Art.rr(ctx,-9,-60,18,6,3); ctx.fill();                     // dark hair
        break; }
      case "bulldog": { // squat bulldog mascot
        ctx.fillStyle="#c9b79a"; Art.rr(ctx,-15,-20,30,20,8); ctx.fill(); out();            // body
        ctx.fillStyle="#d7c6a8"; ctx.beginPath(); ctx.arc(11,-22,11,0,7); ctx.fill(); out(); // head
        ctx.fillStyle="#9a866a"; ctx.beginPath(); ctx.arc(6,-26,4,0,7); ctx.arc(16,-26,4,0,7); ctx.fill(); // ears
        eye(9,-24,2.2); eye(15,-24,2.2);
        ctx.fillStyle="#5a4a38"; Art.rr(ctx,10,-17,12,5,2); ctx.fill();                      // snout
        ctx.fillStyle="#2a2018"; ctx.fillRect(-13,-3,6,4); ctx.fillRect(7,-3,6,4);           // paws
        break; }
      case "rattler": { // coiled rattlesnake
        ctx.fillStyle="#9a7d3e"; ctx.beginPath();
        ctx.ellipse(0,-8,17,9,0,0,7); ctx.fill(); out();                                    // coil
        ctx.fillStyle="#7a5f28"; for(let i=-12;i<12;i+=6){ ctx.beginPath(); ctx.arc(i,-8,2.4,0,7); ctx.fill(); }
        ctx.fillStyle="#9a7d3e"; ctx.beginPath(); ctx.moveTo(8,-12);                          // raised head
        ctx.quadraticCurveTo(20,-26,12,-34); ctx.quadraticCurveTo(24,-30,22,-20);
        ctx.quadraticCurveTo(22,-12,8,-12); ctx.fill(); out();
        eye(16,-28,2);
        ctx.strokeStyle="#b03030"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(20,-22); ctx.lineTo(26,-21); ctx.stroke(); // tongue
        ctx.fillStyle="#caa64a"; ctx.beginPath(); ctx.arc(-16,-14,3,0,7); ctx.fill();         // rattle
        break; }
      case "tough": { // saloon tough in vest & hat
        ctx.fillStyle="#33291e"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#6e3b2c"; Art.rr(ctx,-12,-42,24,28,6); ctx.fill(); out();             // vest/coat
        ctx.fillStyle="#c9b79a"; Art.rr(ctx,-5,-40,10,24,3); ctx.fill();                      // shirt
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,9,0,7); ctx.fill(); out();
        eye(3,-51,2.3);
        ctx.fillStyle="#5a4a30"; ctx.beginPath(); ctx.ellipse(0,-58,13,4,0,0,7); ctx.fill();  // hat brim
        ctx.fillStyle="#5a4a30"; Art.rr(ctx,-8,-66,16,9,3); ctx.fill(); out();
        break; }
      case "grafter": { // corrupt cop / Tammany man in derby with sash
        ctx.fillStyle="#1c2333"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#26324c"; Art.rr(ctx,-12,-42,24,28,6); ctx.fill(); out();
        ctx.fillStyle="#b0402f"; ctx.beginPath(); ctx.moveTo(-12,-40); ctx.lineTo(12,-30); ctx.lineTo(12,-26); ctx.lineTo(-12,-36); ctx.fill(); // sash
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,9,0,7); ctx.fill(); out();
        eye(3,-51,2.3);
        ctx.fillStyle="#26324c"; ctx.beginPath(); ctx.ellipse(0,-57,11,3.5,0,0,7); ctx.fill();
        ctx.fillStyle="#26324c"; Art.rr(ctx,-7,-65,14,9,5); ctx.fill();                       // derby
        ctx.fillStyle="#d9a441"; ctx.beginPath(); ctx.arc(-6,-34,2.4,0,7); ctx.fill();         // bribe coin
        break; }
      case "wharfrat": { // wharf rat
        ctx.fillStyle="#5a5048"; ctx.beginPath(); ctx.ellipse(-2,-8,15,8,0,0,7); ctx.fill(); out();
        ctx.fillStyle="#5a5048"; ctx.beginPath(); ctx.arc(12,-12,7,0,7); ctx.fill(); out();    // head
        ctx.fillStyle="#766a5e"; ctx.beginPath(); ctx.arc(10,-18,3,0,7); ctx.fill();           // ear
        eye(14,-13,2);
        ctx.fillStyle="#caa";  ctx.beginPath(); ctx.arc(19,-11,1.6,0,7); ctx.fill();           // nose
        ctx.strokeStyle="#6a5e52"; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(-16,-7); ctx.quadraticCurveTo(-26,-10,-22,-18); ctx.stroke(); // tail
        break; }
      case "gull": { // seagull (flyer)
        const fl=Math.sin(t*0.03)*8;
        ctx.fillStyle="#eef2f6"; ctx.beginPath(); ctx.ellipse(0,-30,11,7,0,0,7); ctx.fill(); out();
        ctx.beginPath(); ctx.arc(9,-34,5,0,7); ctx.fill(); out();
        ctx.fillStyle="#d9a441"; ctx.beginPath(); ctx.moveTo(13,-34); ctx.lineTo(20,-32); ctx.lineTo(13,-30); ctx.fill();
        eye(10,-35,1.8);
        ctx.strokeStyle="#cfd6dd"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-4,-30); ctx.quadraticCurveTo(-14,-30-fl,-22,-26); ctx.stroke(); // wing
        break; }
      case "soldier": { // Spanish soldier in kepi with rifle
        ctx.fillStyle="#3a3326"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#9aa07e"; Art.rr(ctx,-11,-42,22,28,5); ctx.fill(); out();              // tunic
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,8.5,0,7); ctx.fill(); out();
        eye(3,-51,2.2);
        ctx.fillStyle="#b5b27e"; Art.rr(ctx,-9,-60,18,7,2); ctx.fill();                        // kepi
        ctx.fillStyle="#b5b27e"; ctx.fillRect(6,-56,9,3);                                       // visor
        ctx.strokeStyle="#3a2a18"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-12,-44); ctx.lineTo(14,-20); ctx.stroke(); // rifle
        ctx.fillStyle="#cfcccc"; ctx.beginPath(); ctx.moveTo(14,-20); ctx.lineTo(18,-15); ctx.lineTo(12,-17); ctx.fill();   // bayonet
        break; }
      case "mosquito": { // yellow-fever mosquito (flyer)
        const fl=Math.sin(t*0.05)*5;
        ctx.fillStyle="#4a4036"; ctx.beginPath(); ctx.ellipse(-2,-28,10,5,0,0,7); ctx.fill(); out("#1c140d",1.8);
        ctx.beginPath(); ctx.arc(9,-30,5,0,7); ctx.fill(); out("#1c140d",1.8);
        eye(11,-31,1.8);
        ctx.strokeStyle="#2a2018"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(13,-29); ctx.lineTo(22,-26); ctx.stroke(); // proboscis
        ctx.fillStyle="rgba(200,220,235,.5)"; ctx.beginPath(); ctx.ellipse(-4,-34-fl,9,4,-0.5,0,7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-8,-33+fl,8,3.5,-0.7,0,7); ctx.fill(); out("rgba(120,150,170,.6)",1);
        ctx.strokeStyle="#2a2018"; ctx.lineWidth=1.5;                                          // legs
        for(let i=-6;i<8;i+=5){ ctx.beginPath(); ctx.moveTo(i,-24); ctx.lineTo(i-3,-14); ctx.stroke(); }
        break; }
      case "boss": { // political machine boss — fat cat in top hat, cigar, $ sash
        ctx.fillStyle="#222"; ctx.fillRect(-9,-15,7,15); ctx.fillRect(3,-15,7,15);
        ctx.fillStyle="#2f2f33"; Art.rr(ctx,-15,-44,30,30,8); ctx.fill(); out();              // big belly suit
        ctx.fillStyle="#caa64a"; ctx.beginPath(); ctx.arc(0,-30,4,0,7); ctx.fill();            // watch fob
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-52,9,0,7); ctx.fill(); out();
        eye(3,-53,2.3);
        ctx.fillStyle="#2a2a2e"; ctx.beginPath(); ctx.ellipse(0,-60,12,3.5,0,0,7); ctx.fill(); // top hat brim
        ctx.fillStyle="#2a2a2e"; Art.rr(ctx,-8,-74,16,15,2); ctx.fill(); out();                // top hat
        ctx.strokeStyle="#7a5230"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(8,-49); ctx.lineTo(16,-48); ctx.stroke(); // cigar
        ctx.fillStyle="#e2533b"; ctx.beginPath(); ctx.arc(16,-48,1.6,0,7); ctx.fill();
        break; }
      case "redtape": { // bundle of red-tape paperwork
        ctx.fillStyle="#e7dec6"; Art.rr(ctx,-12,-26,24,26,3); ctx.fill(); out();
        ctx.strokeStyle="#b0402f"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-12,-14); ctx.lineTo(12,-18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12,-20); ctx.lineTo(12,-10); ctx.stroke();
        eye(-2,-30,2.2); eye(6,-30,2.2);
        break; }
      case "trust": { // monopoly money-bag with a top hat ($ )
        ctx.fillStyle="#5a4a2a"; ctx.beginPath(); ctx.moveTo(-14,0); ctx.quadraticCurveTo(-18,-26,0,-30);
        ctx.quadraticCurveTo(18,-26,14,0); ctx.closePath(); ctx.fill(); out();                 // sack
        ctx.fillStyle="#3a2f1a"; Art.rr(ctx,-9,-34,18,6,3); ctx.fill();                          // tie of sack
        ctx.fillStyle="#ffd34d"; ctx.font="bold 16px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("$",0,-8);
        ctx.fillStyle="#1a1a1e"; ctx.beginPath(); ctx.ellipse(0,-38,12,3.5,0,0,7); ctx.fill();   // top hat
        ctx.fillStyle="#1a1a1e"; Art.rr(ctx,-8,-52,16,15,2); ctx.fill(); out();
        eye(-4,-22,2.2); eye(4,-22,2.2);
        break; }
      case "poacher": { // rifle-toting poacher
        ctx.fillStyle="#4a3a26"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#6a5a3a"; Art.rr(ctx,-11,-42,22,28,5); ctx.fill(); out();
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,8.5,0,7); ctx.fill(); out();
        eye(3,-51,2.2);
        ctx.fillStyle="#3a2a18"; ctx.beginPath(); ctx.ellipse(0,-58,11,3,0,0,7); ctx.fill();      // slouch hat
        ctx.fillStyle="#3a2a18"; Art.rr(ctx,-7,-65,14,8,4); ctx.fill();
        ctx.strokeStyle="#2a2018"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-12,-46); ctx.lineTo(16,-30); ctx.stroke(); // rifle
        break; }
      case "logger": { // lumberjack with axe
        ctx.fillStyle="#2a3326"; ctx.fillRect(-8,-16,6,16); ctx.fillRect(3,-16,6,16);
        ctx.fillStyle="#9a3a30"; Art.rr(ctx,-12,-42,24,28,5); ctx.fill(); out();                 // plaid shirt
        ctx.strokeStyle="#5a201a"; ctx.lineWidth=2; for(let i=-10;i<12;i+=6){ctx.beginPath();ctx.moveTo(i,-42);ctx.lineTo(i,-14);ctx.stroke();}
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-50,8.5,0,7); ctx.fill(); out();
        eye(3,-51,2.2);
        ctx.fillStyle="#caa"; ctx.fillStyle="#7a5a3a"; ctx.fillRect(-8,-58,16,5);                  // beanie
        ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(10,-44); ctx.lineTo(20,-26); ctx.stroke(); // axe handle
        ctx.fillStyle="#cfcccc"; ctx.beginPath(); ctx.moveTo(20,-26); ctx.lineTo(28,-30); ctx.lineTo(26,-20); ctx.fill();  // axe head
        break; }
      case "piranha": { // leaping piranha (flyer)
        ctx.fillStyle="#5a6a4a"; ctx.beginPath(); ctx.ellipse(0,-28,14,8,0,0,7); ctx.fill(); out();
        ctx.fillStyle="#46553a"; ctx.beginPath(); ctx.moveTo(-12,-28); ctx.lineTo(-22,-34); ctx.lineTo(-22,-22); ctx.fill(); // tail
        eye(7,-30,2.4);
        ctx.fillStyle="#fff"; ctx.beginPath(); ctx.moveTo(8,-24); ctx.lineTo(15,-24); ctx.lineTo(8,-20); ctx.fill();        // teeth
        ctx.strokeStyle=OLF; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(8,-24); ctx.lineTo(15,-24); ctx.stroke();
        break; }
      case "jaguar": { // crouching jaguar
        ctx.fillStyle="#caa24a"; Art.rr(ctx,-16,-22,32,18,9); ctx.fill(); out();                 // body
        ctx.fillStyle="#caa24a"; ctx.beginPath(); ctx.arc(13,-24,9,0,7); ctx.fill(); out();        // head
        ctx.fillStyle="#8a6a26"; for(const p of [[-8,-16],[0,-12],[6,-18],[-12,-10]]){ ctx.beginPath(); ctx.arc(p[0],p[1],2.2,0,7); ctx.fill(); } // rosettes
        ctx.fillStyle="#8a6a26"; ctx.beginPath(); ctx.arc(9,-30,3,0,7); ctx.arc(17,-30,3,0,7); ctx.fill(); // ears
        eye(15,-25,2.2);
        ctx.fillStyle="#2a2018"; ctx.fillRect(-14,-4,6,4); ctx.fillRect(0,-4,6,4); ctx.fillRect(10,-4,6,4); // paws
        ctx.strokeStyle="#caa24a"; ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(-16,-16); ctx.quadraticCurveTo(-26,-18,-24,-26); ctx.stroke(); // tail
        break; }
      default: {
        ctx.fillStyle="#6b6157"; Art.rr(ctx,-16,-32,32,32,10); ctx.fill(); out(); eye(6,-20);
      }
    }
    ctx.restore();
  }

  function shadeHex(hex,amt){
    const n=parseInt(hex.slice(1),16); let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    r=Math.max(0,Math.min(255,r+amt));g=Math.max(0,Math.min(255,g+amt));b=Math.max(0,Math.min(255,b+amt));
    return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }
  function heartHUD(ctx,x,y,s){ ctx.beginPath(); ctx.moveTo(x,y+s*0.3);
    ctx.bezierCurveTo(x,y-s*0.3,x-s,y-s*0.3,x-s,y+s*0.2);
    ctx.bezierCurveTo(x-s,y+s*0.7,x,y+s,x,y+s*1.2);
    ctx.bezierCurveTo(x,y+s,x+s,y+s*0.7,x+s,y+s*0.2);
    ctx.bezierCurveTo(x+s,y-s*0.3,x,y-s*0.3,x,y+s*0.3); ctx.fill(); }

  /* ---------------- Mini-game flow ---------------- */
  function startMGIntro(){
    // capture which history facts the player collected vs missed in the level
    if(level){
      recap = { got: level.treasures.filter(f=>f.got).map(f=>f.txt),
                missed: level.treasures.filter(f=>!f.got).map(f=>f.txt) };
    }
    state=S.MGINTRO; Audio2.stopMusic();
  }
  function startMG(){
    const cfg=CHAPTERS[chapterIdx].minigame;
    mg=new MINIGAMES[cfg.type](env); mg.cfg=cfg; mg.chId=CHAPTERS[chapterIdx].id;
    state=S.MG; Audio2.playMusic(musicFor(CHAPTERS[chapterIdx]));
  }

  /* ---------------- HUD / text ---------------- */
  function hudTop(ch){
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,.45)"; Art.rr(ctx,12,12,300,40,8); ctx.fill();
    ctx.fillStyle="#ffd966"; ctx.font="bold 15px Trebuchet MS"; ctx.textAlign="left";
    ctx.fillText("Ch."+ch.id+"  "+ch.years, 24, 30);
    ctx.fillStyle="#fff"; ctx.font="13px Trebuchet MS"; ctx.fillText(ch.title, 24, 46);
    ctx.restore();
  }
  function wrapText(ctx,text,x,y,maxW,lh){
    const words=text.split(" "); let line="",yy=y;
    for(const w of words){ const test=line+w+" ";
      if(ctx.measureText(test).width>maxW && line){ ctx.fillText(line.trim(),x,yy); line=w+" "; yy+=lh; }
      else line=test; }
    ctx.fillText(line.trim(),x,yy); return yy;
  }
  function centerWrap(ctx,text,x,y,maxW,lh){
    const words=text.split(" "); let line="",lines=[];
    for(const w of words){ const test=line+w+" ";
      if(ctx.measureText(test).width>maxW && line){ lines.push(line.trim()); line=w+" "; } else line=test; }
    lines.push(line.trim()); ctx.textAlign="center"; let yy=y;
    for(const ln of lines){ ctx.fillText(ln,x,yy); yy+=lh; } return yy;
  }

  /* ---------------- Screens ---------------- */
  function drawMenu(){
    Art.drawBackground(ctx, 3, "badlands", W, H, t*0.2, CHAPTERS[2].palette, t);
    ctx.fillStyle="rgba(0,0,0,.32)"; ctx.fillRect(0,0,W,H);
    // TR stands on the left; text sits in the clear space to his right
    Art.drawTR(ctx, W*0.20, H*0.82, 200, {costume:"roughrider", age:"adult", state:"hat", t});
    // soft panel behind the text so it reads against the backdrop
    ctx.fillStyle="rgba(10,12,18,.42)"; Art.rr(ctx, W*0.36, H*0.16, W*0.60, H*0.50, 16); ctx.fill();
    const cx = W*0.66;                 // text column centered in the right-hand space
    ctx.textAlign="center"; ctx.shadowColor="#000"; ctx.shadowBlur=14;
    ctx.fillStyle="#fff"; ctx.font="bold 52px Trebuchet MS"; ctx.fillText("ROUGH RIDER", cx, H*0.28);
    ctx.fillStyle="#ffd966"; ctx.font="bold 21px Trebuchet MS"; ctx.fillText("The Theodore Roosevelt Adventure", cx, H*0.36);
    ctx.shadowBlur=0;
    ctx.fillStyle="#fff"; ctx.font="18px Trebuchet MS";
    ctx.fillText(cue("Press  ENTER  to begin his life's journey","Tap  ▶ Start  below"), cx, H*0.47);
    ctx.fillStyle="#e8dcc0"; ctx.font="14px Trebuchet MS";
    if(!IS_TOUCH){
      ctx.fillText("Press  C  for Chapter Select", cx, H*0.54);
      ctx.fillText("M = mute     F = fullscreen", cx, H*0.59);
    }
    ctx.fillStyle="#cdbf9c"; ctx.font="12px Trebuchet MS";
    ctx.fillText("10 chapters across his whole life —", cx, H*0.94);
    ctx.fillText("platforming, treasure, and a mini-game each.", cx, H*0.975);
  }

  // Chapter-grid geometry — shared by drawSelect() and the tap hit-test so a
  // tap lands on exactly the card that's drawn.
  const SEL_GRID = { cols:5, cw:188, chh:176, top:96, vgap:12 };
  function selRect(i){
    const {cols,cw,chh,top,vgap}=SEL_GRID, gx=(W-cols*cw)/2;
    const r=Math.floor(i/cols), c=i%cols;
    return { x:gx+c*cw+8, y:top+r*(chh+vgap), w:cw-16, h:chh };
  }
  // Returns the chapter index under a canvas-space point, or -1.
  function chapterAt(cx, cy){
    for(let i=0;i<CHAPTERS.length;i++){ const r=selRect(i);
      if(cx>=r.x && cx<=r.x+r.w && cy>=r.y && cy<=r.y+r.h) return i; }
    return -1;
  }

  function drawSelect(){
    ctx.fillStyle="#14110c"; ctx.fillRect(0,0,W,H);
    ctx.textAlign="center"; ctx.fillStyle="#ffd966"; ctx.font="bold 28px Trebuchet MS";
    ctx.fillText("CHAPTER SELECT", W/2, 46);
    // progress tally from saved completion
    const done = CHAPTERS.filter(c=>clearedSet.has(c.id)).length;
    ctx.font="13px Trebuchet MS"; ctx.fillStyle="#8be28b";
    ctx.fillText("✓ "+done+" of "+CHAPTERS.length+" chapters completed"+(done===CHAPTERS.length?"  —  reward unlocked!":"")+"     ★ Score: "+score, W/2, 66);
    ctx.fillStyle="#cfc3a6"; ctx.font="12px Trebuchet MS";
    ctx.fillText("Tap a chapter to play  ·  (or ← → ↑ ↓ then ENTER)  ·  ESC back", W/2, 84);
    for(let i=0;i<CHAPTERS.length;i++){
      const ch=CHAPTERS[i], rct=selRect(i), x=rct.x, y=rct.y, sel=i===chapterIdx;
      const cw=SEL_GRID.cw, chh=SEL_GRID.chh, w=cw-16;
      const cleared=clearedSet.has(ch.id);
      // card bg: completed cards get a green-tinted fill
      ctx.fillStyle = sel ? (cleared?"#2c3a22":"#3a2c18") : (cleared?"#1d2a18":"#241c12");
      Art.rr(ctx,x,y,w,chh,10); ctx.fill();
      // border: gold when selected, green when completed, faint otherwise
      ctx.lineWidth = sel?3:2;
      ctx.strokeStyle = sel ? "#ffd966" : (cleared?"#5aa85a":"rgba(255,255,255,.10)");
      Art.rr(ctx,x,y,w,chh,10); ctx.stroke();
      ctx.textAlign="left";
      ctx.fillStyle="#ffd966"; ctx.font="bold 13px Trebuchet MS"; ctx.fillText("Ch."+ch.id, x+12, y+24);
      ctx.fillStyle="#cdbf9c"; ctx.font="11px Trebuchet MS"; ctx.fillText(ch.years, x+12, y+40);
      ctx.fillStyle="#fff"; ctx.font="bold 14px Trebuchet MS"; wrapText(ctx,ch.title,x+12,y+62,cw-32,17);
      ctx.fillStyle="#bcae8e"; ctx.font="11px Trebuchet MS"; wrapText(ctx,"🎮 "+ch.minigame.name,x+12,y+chh-26,cw-32,14);
      // completion badge (top-right of the card)
      if(cleared){
        const bx=x+w-20, by=y+18;
        ctx.fillStyle="#5aa85a"; ctx.beginPath(); ctx.arc(bx,by,11,0,7); ctx.fill();
        ctx.strokeStyle="#2e6b2e"; ctx.lineWidth=2; ctx.stroke();
        ctx.fillStyle="#fff"; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("✓",bx,by+5);
        // "COMPLETED" ribbon along the bottom
        ctx.fillStyle="rgba(90,168,90,.85)"; Art.rr(ctx,x,y+chh-15,w,15,0); ctx.fill();
        ctx.fillStyle="#0d1a0d"; ctx.font="bold 10px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("COMPLETED",x+w/2,y+chh-4);
      }
    }
  }

  function drawCutscene(){
    const ch=CHAPTERS[chapterIdx];
    Art.drawBackground(ctx, ch.id, ch.scenery, W, H, t*0.15, ch.palette, t);
    ctx.fillStyle="rgba(0,0,0,.5)"; ctx.fillRect(0,0,W,H);
    Art.drawTR(ctx, W*0.16, H*0.78, 158, {costume:costumeFor(ch), age:ageFor(ch), state:"idle", t});
    ctx.fillStyle="rgba(20,16,10,.85)"; Art.rr(ctx,W*0.30,H*0.15,W*0.62,H*0.68,14); ctx.fill();
    ctx.strokeStyle="#caa64a"; ctx.lineWidth=2; Art.rr(ctx,W*0.30,H*0.15,W*0.62,H*0.68,14); ctx.stroke();
    const px=W*0.61; ctx.textAlign="center";
    ctx.fillStyle="#ffd966"; ctx.font="bold 16px Trebuchet MS"; ctx.fillText("CHAPTER "+ch.id+"  ·  "+ch.years, px, H*0.23);
    ctx.fillStyle="#fff"; ctx.font="bold 27px Trebuchet MS"; ctx.fillText(ch.title, px, H*0.295);
    ctx.fillStyle="#d9c69a"; ctx.font="italic 15px Trebuchet MS"; ctx.fillText(ch.subtitle+"  —  "+ch.place, px, H*0.35);
    ctx.fillStyle="#eee"; ctx.font="15px Trebuchet MS";
    let by=centerWrap(ctx, ch.blurb, px, H*0.40, W*0.54, 21);
    // objective + who the bad guys are
    by+=8;
    ctx.fillStyle="#7ad0e0"; ctx.font="bold 13px Trebuchet MS"; ctx.fillText("YOUR OBJECTIVE", px, by); by+=20;
    ctx.fillStyle="#fff"; ctx.font="14px Trebuchet MS"; by=centerWrap(ctx, ch.objective||"Reach the flag at the end of the stage.", px, by, W*0.54, 19)+6;
    ctx.fillStyle="#e88a6a"; ctx.font="bold 13px Trebuchet MS"; ctx.fillText("WATCH OUT FOR", px, by); by+=20;
    ctx.fillStyle="#fff"; ctx.font="14px Trebuchet MS"; centerWrap(ctx, ch.foes||"", px, by, W*0.54, 19);
    ctx.fillStyle="#ffd966"; ctx.font="bold 15px Trebuchet MS"; ctx.fillText(cue("Press  ENTER  to start the level ►","Tap to start the level ►"), px, H*0.80);
  }

  function drawMGIntro(){
    const ch=CHAPTERS[chapterIdx], cfg=ch.minigame;
    Art.drawBackground(ctx, ch.id, ch.scenery, W, H, t*0.1, ch.palette, t);
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,W,H);
    ctx.fillStyle="rgba(20,16,10,.9)"; Art.rr(ctx,W*0.15,H*0.18,W*0.7,H*0.64,16); ctx.fill();
    ctx.strokeStyle="#caa64a"; ctx.lineWidth=3; Art.rr(ctx,W*0.15,H*0.18,W*0.7,H*0.64,16); ctx.stroke();
    ctx.textAlign="center";
    ctx.fillStyle="#ffd966"; ctx.font="bold 16px Trebuchet MS"; ctx.fillText("MINI-GAME", W/2, H*0.27);
    ctx.fillStyle="#fff"; ctx.font="bold 32px Trebuchet MS"; ctx.fillText(cfg.name, W/2, H*0.35);
    ctx.fillStyle="#d9c69a"; ctx.font="16px Trebuchet MS"; centerWrap(ctx,"Goal: "+cfg.goal, W/2, H*0.43, W*0.6, 22);
    ctx.fillStyle="#1d2740"; Art.rr(ctx,W*0.22,H*0.49,W*0.56,H*0.17,10); ctx.fill();
    ctx.strokeStyle="#7ad0e0"; ctx.lineWidth=2; Art.rr(ctx,W*0.22,H*0.49,W*0.56,H*0.17,10); ctx.stroke();
    ctx.fillStyle="#7ad0e0"; ctx.font="bold 14px Trebuchet MS"; ctx.fillText("⌨  CONTROLS", W/2, H*0.535);
    ctx.fillStyle="#fff"; ctx.font="16px Trebuchet MS"; centerWrap(ctx, cfg.controls, W/2, H*0.575, W*0.5, 22);
    ctx.fillStyle="#ffd966"; ctx.font="bold 16px Trebuchet MS"; ctx.fillText(cue("Press  ENTER / SPACE  to play","Tap to play ►"), W/2, H*0.74);
  }

  function drawResult(won){
    const ch=CHAPTERS[chapterIdx];
    Art.drawBackground(ctx, ch.id, ch.scenery, W, H, t*0.1, ch.palette, t);
    ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,W,H); ctx.textAlign="center";
    if(won){
      ctx.fillStyle="#8be28b"; ctx.font="bold 40px Trebuchet MS"; ctx.fillText("CHAPTER CLEARED!", W/2, H*0.2);
      Art.drawTR(ctx,W*0.5,H*0.62,150,{costume:costumeFor(ch),state:"hat",t});
      ctx.fillStyle="rgba(20,16,10,.82)"; Art.rr(ctx,W*0.12,H*0.68,W*0.76,H*0.22,12); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font="16px Trebuchet MS"; centerWrap(ctx, ch.minigame.win, W/2, H*0.74, W*0.68, 22);
      ctx.fillStyle="#ffd966"; ctx.font="bold 15px Trebuchet MS";
      ctx.fillText(chapterIdx<CHAPTERS.length-1?cue("Press  ENTER  for the next chapter ►","Tap for the next chapter ►"):cue("Press  ENTER  to see his legacy ►","Tap to see his legacy ►"), W/2, H*0.87);
    } else {
      const fromLevel = loseFrom==="level";
      ctx.fillStyle="#e57373"; ctx.font="bold 40px Trebuchet MS";
      ctx.fillText(fromLevel?"OUT OF HEARTS!":"NOT QUITE…", W/2, H*0.3);
      ctx.fillStyle="#fff"; ctx.font="17px Trebuchet MS";
      centerWrap(ctx, fromLevel
        ? "You must complete the stage to reach the mini-game. \"It is hard to fail, but it is worse never to have tried to succeed.\""
        : "\"It is hard to fail, but it is worse never to have tried to succeed.\" — Try again!",
        W/2, H*0.42, W*0.62, 24);
      ctx.fillStyle="#ffd966"; ctx.font="bold 16px Trebuchet MS";
      ctx.fillText(fromLevel?cue("Press  ENTER  to restart the stage","Tap to restart the stage"):cue("Press  ENTER  to retry the mini-game","Tap to retry the mini-game"), W/2, H*0.56);
      if(!IS_TOUCH){ ctx.fillStyle="#cfc3a6"; ctx.font="14px Trebuchet MS"; ctx.fillText("(Press  S  to skip to the next chapter)", W/2, H*0.62); }
    }
  }

  function drawRecap(){
    const ch=CHAPTERS[chapterIdx];
    Art.drawBackground(ctx, ch.id, ch.scenery, W, H, t*0.08, ch.palette, t);
    ctx.fillStyle="rgba(10,8,6,.78)"; ctx.fillRect(0,0,W,H);
    ctx.textAlign="center";
    ctx.fillStyle="#8be28b"; ctx.font="bold 30px Trebuchet MS"; ctx.fillText("STAGE COMPLETE!", W/2, H*0.13);
    ctx.fillStyle="#ffd966"; ctx.font="bold 17px Trebuchet MS";
    ctx.fillText("Chapter "+ch.id+" — "+ch.title+"  ("+ch.years+")", W/2, H*0.185);
    ctx.fillStyle="#d9c69a"; ctx.font="13px Trebuchet MS";
    ctx.fillText("What Theodore did in this chapter — study each before moving on:", W/2, H*0.235);

    // panel listing every fact: collected (gold ✓) or missed (gray ✗)
    const facts = ch.facts;
    const gotSet = new Set(recap.got);
    const px=W*0.18, pw=W*0.64, top=H*0.27, rowH=(H*0.5)/facts.length;
    ctx.fillStyle="rgba(20,16,10,.85)"; Art.rr(ctx,px,top,pw,H*0.5,12); ctx.fill();
    ctx.strokeStyle="#caa64a"; ctx.lineWidth=2; Art.rr(ctx,px,top,pw,H*0.5,12); ctx.stroke();
    ctx.textAlign="left";
    facts.forEach((f,i)=>{
      const y=top+rowH*(i+0.5)+5; const got=gotSet.has(f);
      // marker
      ctx.fillStyle=got?"#8be28b":"#7a6f5e";
      ctx.beginPath(); ctx.arc(px+30,y-5,11,0,7); ctx.fill();
      ctx.fillStyle="#15110b"; ctx.font="bold 14px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillText(got?"✓":"✗", px+30, y);
      // text
      ctx.textAlign="left";
      ctx.fillStyle=got?"#fff":"#9b9080"; ctx.font=(got?"bold ":"")+"15px Trebuchet MS";
      ctx.fillText(f, px+52, y);
      if(!got){ ctx.fillStyle="#a8765a"; ctx.font="italic 12px Trebuchet MS"; ctx.textAlign="right";
        ctx.fillText("missed", px+pw-16, y); ctx.textAlign="left"; }
    });
    // tally + prompt
    ctx.textAlign="center";
    ctx.fillStyle="#d9c69a"; ctx.font="14px Trebuchet MS";
    ctx.fillText("Collected "+recap.got.length+" of "+facts.length+" history treasures", W/2, H*0.80);
    ctx.fillStyle="#8be28b"; ctx.font="bold 16px Trebuchet MS";
    ctx.fillText("TOTAL SCORE: "+score, W/2, H*0.84);
    ctx.fillStyle="#ffd966"; ctx.font="bold 15px Trebuchet MS";
    ctx.fillText(cue("Take your time — press  ENTER  when you're ready to continue ►","Take your time — tap to continue ►"), W/2, H*0.88);
  }

  function drawEnding(){
    Art.drawBackground(ctx, 9, "wilderness", W, H, t*0.15, CHAPTERS[8].palette, t);
    ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(0,0,W,H); ctx.textAlign="center";
    ctx.fillStyle="#ffd966"; ctx.font="bold 34px Trebuchet MS"; ctx.fillText("THE MAN IN THE ARENA", W/2, H*0.14);
    ctx.fillStyle="#fff"; ctx.font="italic 14px Trebuchet MS";
    centerWrap(ctx, "“"+TR_QUOTES.arena+"”", W/2, H*0.22, W*0.74, 21);

    if (allCleared()){
      // ---- completion reward: promo code panel ----
      const pw=W*0.62, px=W/2, py=H*0.46, ph=H*0.34;
      ctx.fillStyle="rgba(20,16,10,.9)"; Art.rr(ctx, px-pw/2, py, pw, ph, 14); ctx.fill();
      ctx.strokeStyle="#d9b24a"; ctx.lineWidth=3; Art.rr(ctx, px-pw/2, py, pw, ph, 14); ctx.stroke();
      ctx.fillStyle="#8be28b"; ctx.font="bold 20px Trebuchet MS"; ctx.fillText("★ "+REWARD.headline+" ★", px, py+34);
      ctx.fillStyle="#fff"; ctx.font="15px Trebuchet MS";
      centerWrap(ctx, "As a reward, enjoy "+REWARD.offer+" at the Theodore Roosevelt Presidential Library.", px, py+60, pw-50, 20);
      // the code, big and boxed
      ctx.fillStyle="#1d1610"; Art.rr(ctx, px-130, py+ph*0.52, 260, 46, 8); ctx.fill();
      ctx.strokeStyle="#ffd966"; ctx.lineWidth=2; Art.rr(ctx, px-130, py+ph*0.52, 260, 46, 8); ctx.stroke();
      ctx.fillStyle="#ffd966"; ctx.font="bold 30px Trebuchet MS"; ctx.fillText(REWARD.code, px, py+ph*0.52+33);
      ctx.fillStyle="#d9c69a"; ctx.font="12px Trebuchet MS";
      ctx.fillText("Use this code with a paid adult ticket. (One per visit.)", px, py+ph-12);
      // the claim button + return cue are HTML overlays (see updateRewardUI)
    } else {
      // not all cleared yet — the usual legacy text
      ctx.fillStyle="#d9c69a"; ctx.font="15px Trebuchet MS";
      centerWrap(ctx, "Theodore Roosevelt lived every chapter of this game — sickly boy, cowboy, "+
        "soldier, conservationist, and President. He died at Sagamore Hill on January 6, 1919, "+
        "age 60. “Death had to take him sleeping,” said Vice President Thomas R. Marshall, "+
        "“for if Roosevelt had been awake, there would have been a fight.”",
        W/2, H*0.52, W*0.74, 22);
      ctx.fillStyle="#cdbf9c"; ctx.font="13px Trebuchet MS";
      centerWrap(ctx, "Tip: clear all 10 chapters to unlock a special reward from the Library!", W/2, H*0.84, W*0.7, 18);
    }
    ctx.fillStyle="#ffd966"; ctx.font="bold 14px Trebuchet MS"; ctx.fillText(cue("Press  ENTER  to return to the title","Tap to return to the title"), W/2, H*0.95);
  }

  /* ---------------- Key handlers ---------------- */
  function startCutscene(){ state=S.CUTSCENE; Audio2.playMusic("calm"); }
  function handleMenuKeys(){
    if(input.pressed("Enter")){ chapterIdx=0; Audio2.sfx.select(); startCutscene(); }
    if(input.pressed("KeyC")){ state=S.SELECT; Audio2.sfx.select(); }
  }
  function handleSelectKeys(){
    if(input.pressed("ArrowRight")){ chapterIdx=(chapterIdx+1)%CHAPTERS.length; Audio2.sfx.select(); }
    if(input.pressed("ArrowLeft")){ chapterIdx=(chapterIdx-1+CHAPTERS.length)%CHAPTERS.length; Audio2.sfx.select(); }
    if(input.pressed("ArrowDown")){ chapterIdx=Math.min(CHAPTERS.length-1,chapterIdx+5); Audio2.sfx.select(); }
    if(input.pressed("ArrowUp")){ chapterIdx=Math.max(0,chapterIdx-5); Audio2.sfx.select(); }
    if(input.pressed("Enter")){ Audio2.sfx.select(); startCutscene(); }
    if(input.pressed("Escape")){ state=S.MENU; }
  }

  /* ---------------- Main loop ---------------- */
  let last=performance.now();
  function frame(now){
    const dt=Math.min(40, now-last); last=now; t+=dt;

    // GLOBAL CLEAR every frame — fixes any bleed-through between states
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle="#0b0d12"; ctx.fillRect(0,0,W,H);

    switch(state){
      case S.MENU: drawMenu(); handleMenuKeys(); break;
      case S.SELECT: drawSelect(); handleSelectKeys(); break;
      case S.CUTSCENE: drawCutscene();
        if(input.pressed("Enter")||input.pressed("Space")){ Audio2.sfx.select(); startLevel(chapterIdx); }
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.LEVEL: updateLevel(); drawLevel();
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.MGINTRO: drawMGIntro();
        if(input.pressed("Enter")||input.pressed("Space")){ Audio2.sfx.select(); startMG(); }
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.MG:
        mg.update(input); mg.draw(ctx,t);
        if(!IS_TOUCH){
          ctx.fillStyle="rgba(0,0,0,.4)"; ctx.fillRect(0,H-26,W,26);
          ctx.fillStyle="#fff"; ctx.font="12px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText(mg.cfg.controls, W/2, H-9);
        }
        if(mg.status==="won"){ Audio2.sfx.success(); markCleared(CHAPTERS[chapterIdx].id); state=S.RECAP; }
        else if(mg.status==="lost"){ Audio2.sfx.fail(); loseFrom="mg"; state=S.LOSE; }
        break;
      case S.RECAP: drawRecap();
        if(input.pressed("Enter")){ Audio2.sfx.select(); state=S.WIN; }
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.WIN: drawResult(true);
        if(input.pressed("Enter")){ if(chapterIdx<CHAPTERS.length-1){ chapterIdx++; Audio2.sfx.select(); startCutscene(); } else state=S.END; }
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.LOSE: drawResult(false);
        if(input.pressed("Enter")){ Audio2.sfx.select();
          if(loseFrom==="level") startLevel(chapterIdx);   // out of hearts → replay the whole stage
          else startMGIntro();                              // mini-game failed → retry the mini-game
        }
        if(input.pressed("KeyS")){ if(chapterIdx<CHAPTERS.length-1){ chapterIdx++; startCutscene(); } else state=S.END; }
        if(input.pressed("Escape")){ state=S.MENU; } break;
      case S.END: drawEnding();
        if(input.pressed("Enter")){ state=S.MENU; chapterIdx=0; } break;
    }

    particles.update(); particles.draw(ctx);

    // Show the TRPL wordmark (links to trlibrary.com) on the intro + summary
    // screens, where it's informative and not in the way of gameplay.
    if(trplLogo && trplLogo.classList){
      const showLogo = (state===S.MENU || state===S.SELECT ||
                        state===S.RECAP || state===S.WIN || state===S.END);
      trplLogo.classList.toggle("show", showLogo);
    }

    // Completion reward: the claim button appears on the ending only when every
    // chapter has been cleared.
    if(claimBtn && claimBtn.classList){
      if(claimBtn.setAttribute) claimBtn.setAttribute("href", REWARD.url);
      claimBtn.classList.toggle("show", state===S.END && allCleared());
    }

    if(flashT>0){ flashT--; ctx.save(); ctx.globalAlpha=Math.min(1,flashT/40);
      ctx.fillStyle="#000a"; Art.rr(ctx,W/2-70,16,140,30,8); ctx.fill();
      ctx.fillStyle="#ffd966"; ctx.font="bold 16px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText(flashMsg,W/2,36); ctx.restore(); }

    keysPressed.clear();
    requestAnimationFrame(frame);
  }

  // boot
  if (typeof Assets !== "undefined") Assets.load();
  loading.classList.add("hidden");
  requestAnimationFrame(frame);
})();
