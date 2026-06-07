/* ============================================================================
   minigames.js  —  Nine distinct mini-games, one per chapter of TR's life.
   Each class implements:
     constructor(env)   env = { W, H, particles, rng }
     update(input)      input = { down(code), pressed(code) } ; sets this.status
     draw(ctx, t)
   status: "play" | "won" | "lost".  progress: 0..1 for the HUD bar.
   ========================================================================== */

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function rand(a,b){ return a + Math.random()*(b-a); }

/* Shared mini-game backdrop: paints the chapter's AI background (or procedural
   fallback) plus a darkening scrim so foreground play reads clearly. */
function mgBackdrop(ctx, env, chId, t, scrim=0.45){
  const ch = (typeof CHAPTERS!=="undefined" && CHAPTERS[chId-1]) ? CHAPTERS[chId-1] : null;
  const key = ch ? ch.scenery : "badlands";
  const pal = ch ? ch.palette : {sky1:"#444",sky2:"#222",ground:"#333",accent:"#888"};
  Art.drawBackground(ctx, chId, key, env.W, env.H, t*0.15, pal, t);
  ctx.fillStyle="rgba(0,0,0,"+scrim+")"; ctx.fillRect(0,0,env.W,env.H);
}

/* -------- 1. Build Your Body : rhythm timing -------- */
class MGBody {
  constructor(env){ this.env=env; this.status="play"; this.strength=0; this.time=30;
    this.angle=0; this.speed=0.045; this.zone=0.0; this.feedback=""; this.fbT=0; this.reps=0; }
  update(input){
    this.time-=1/60; if(this.time<=0){ this.status = this.strength>=100?"won":"lost"; }
    this.angle+=this.speed;
    if(this.angle>Math.PI*2) this.angle-=Math.PI*2;
    if(input.pressed("Space")||input.pressed("ArrowUp")){
      // target zone is top of circle (angle near -PI/2 => 3PI/2)
      const target=Math.PI*1.5;
      let d=Math.abs(((this.angle-target+Math.PI)%(Math.PI*2))-Math.PI);
      if(d<0.35){ this.strength=clamp(this.strength+9,0,100); this.reps++; this.speed+=0.004;
        this.feedback="PERFECT LIFT!"; this.env.particles.spawn(this.env.W/2,this.env.H/2-40,{n:14,color:"#ffd966",spread:3,life:30});
        Audio2.sfx.powerup(); }
      else if(d<0.8){ this.strength=clamp(this.strength+4,0,100); this.feedback="good"; Audio2.sfx.coin(); }
      else { this.strength=clamp(this.strength-3,0,100); this.feedback="too early!"; Audio2.sfx.land(); }
      this.fbT=40;
    }
    if(this.strength>=100) this.status="won";
    if(this.fbT>0)this.fbT--;
    this.progress=this.strength/100;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    mgBackdrop(ctx,this.env,this.chId||1,t,0.55);
    // young TR lifting
    Art.drawTR(ctx, W/2, H*0.80, 96, {costume:"boy",state:this.reps%2?"idle":"swing",t});
    // timing ring (lowered so it never sits under the top HUD)
    const cx=W/2, cy=H*0.50, R=66;
    ctx.lineWidth=14; ctx.strokeStyle="rgba(255,255,255,.15)";
    ctx.beginPath(); ctx.arc(cx,cy,R,0,7); ctx.stroke();
    ctx.strokeStyle="#8be28b"; ctx.beginPath(); ctx.arc(cx,cy,R,Math.PI*1.5-0.35,Math.PI*1.5+0.35); ctx.stroke();
    const ix=cx+Math.cos(this.angle)*R, iy=cy+Math.sin(this.angle)*R;
    ctx.fillStyle="#ffd966"; ctx.beginPath(); ctx.arc(ix,iy,10,0,7); ctx.fill();
    // ---- top HUD: STRENGTH bar (left)  +  TIMER (right) — no overlap ----
    bar(ctx, 30, 40, 300, 18, this.progress, "#e0533b", "STRENGTH");
    // timer pinned to the right, its own column
    ctx.textAlign="right";
    ctx.fillStyle="#fff"; ctx.font="bold 15px Trebuchet MS";
    ctx.fillText("Time", W-30, 36);
    ctx.fillStyle=this.time<8?"#ff7a5a":"#ffd34d"; ctx.font="bold 24px Trebuchet MS";
    ctx.fillText(Math.ceil(this.time)+"s", W-30, 60);
    // feedback floats above the ring, well clear of the HUD
    if(this.fbT>0){ ctx.fillStyle="#ffd966"; ctx.font="bold 22px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText(this.feedback,cx,cy-R-18); }
  }
}

/* -------- 2. Boxing : a real Harvard bout with a crowd ----------
   Face-off match. ←/→ bob to dodge the rival's telegraphed swing.
   J = jab (fast, light), K = cross (slower, heavy). Your punches CONNECT
   whenever the rival isn't already reeling — with a clear spark + flinch. */
class MGBox {
  constructor(env){ this.env=env; this.status="play";
    this.foeHP=100; this.hp=100;
    this.bob=0;                 // -1 left, 0 center, +1 right (player slip)
    this.bobT=0;
    this.pCool=0;               // player punch cooldown
    this.pPunch=0; this.pType="";// punch anim
    this.foeState="idle"; this.foeTimer=rand(60,110); this.foeWin=0; this.foeDir=1;
    this.foeFlinch=0;           // rival reeling (also i-frames against spam)
    this.pFlinch=0;            // player reeling
    this.shake=0; this.sparks=[];
    // crowd
    this.crowd=[]; for(let i=0;i<26;i++) this.crowd.push({c:["#caa","#b98","#9ab","#cab","#bca"][i%5], ph:Math.random()*6});
  }
  update(input){
    if(this.shake>0)this.shake--;
    if(this.bobT>0){ this.bobT--; if(this.bobT===0) this.bob=0; }
    if(this.pPunch>0)this.pPunch--;
    if(this.pCool>0)this.pCool--;
    if(this.foeFlinch>0)this.foeFlinch--;
    if(this.pFlinch>0)this.pFlinch--;

    // player slip
    if(input.pressed("ArrowLeft")){ this.bob=-1; this.bobT=22; }
    if(input.pressed("ArrowRight")){ this.bob=1; this.bobT=22; }

    // player punches — connect immediately unless rival is mid-flinch
    if(this.pCool<=0 && this.pFlinch<=0){
      let thrown=null;
      if(input.pressed("KeyK")){ thrown="cross"; }
      else if(input.pressed("KeyJ")){ thrown="jab"; }
      if(thrown){
        this.pType=thrown; this.pPunch= thrown==="cross"?16:10; this.pCool= thrown==="cross"?28:16;
        if(this.foeFlinch<=0){
          const dmg = thrown==="cross" ? 16 : 9;
          this.foeHP=clamp(this.foeHP-dmg,0,100); this.foeFlinch= thrown==="cross"?26:16;
          Audio2.sfx.punch(); this.shake= thrown==="cross"?9:5;
          this.spark(this.env.W*0.54, this.env.H*0.46, thrown==="cross"?"#ffd34d":"#fff2b0", thrown==="cross"?16:10);
        } else { Audio2.sfx.land(); }
      }
    }

    // rival AI
    this.foeTimer--;
    if(this.foeState==="idle"){
      if(this.foeFlinch>0){ /* recovering */ }
      else if(this.foeTimer<=0){ this.foeState="wind"; this.foeWin=34; this.foeDir=Math.random()<0.5?-1:1; }
    } else if(this.foeState==="wind"){ this.foeWin--; if(this.foeWin<=0){ this.foeState="swing"; this.foeWin=12; } }
    else if(this.foeState==="swing"){ this.foeWin--;
      if(this.foeWin===7){ // resolve — slipping AWAY from the punch dodges it
        const dodged = (this.bobT>0 && this.bob===-this.foeDir);
        if(dodged){ Audio2.sfx.coin(); this.spark(this.env.W*0.46,this.env.H*0.4,"#8be28b",8); }
        else { this.hp=clamp(this.hp-14,0,100); this.pFlinch=18; this.shake=10; Audio2.sfx.hit();
          this.spark(this.env.W*0.42,this.env.H*0.46,"#ff5a5a",12); }
      }
      if(this.foeWin<=0){ this.foeState="idle"; this.foeTimer=rand(60,110); }
    }

    for(const s of this.sparks){ s.x+=s.vx; s.y+=s.vy; s.life--; }
    this.sparks=this.sparks.filter(s=>s.life>0);

    if(this.foeHP<=0) this.status="won";
    if(this.hp<=0) this.status="lost";
    this.progress=1-this.foeHP/100;
  }
  spark(x,y,c,n){ for(let i=0;i<n;i++) this.sparks.push({x,y,vx:rand(-4,4),vy:rand(-4,2),life:rand(12,24),c}); }
  draw(ctx,t){
    const {W,H}=this.env; const sh=this.shake?rand(-4,4):0;
    mgBackdrop(ctx,this.env,this.chId||2,t,0.55);
    // ---- crowd behind the ropes ----
    const cy=H*0.58;
    ctx.save();
    for(let i=0;i<this.crowd.length;i++){ const c=this.crowd[i];
      const x=30+i*((W-60)/(this.crowd.length-1));
      const yy=cy-6+Math.sin(t*0.004+c.ph)*3;
      ctx.fillStyle="#2c2620"; ctx.beginPath(); ctx.arc(x,yy+14,12,0,7); ctx.fill();   // shoulders
      ctx.fillStyle=c.c; ctx.beginPath(); ctx.arc(x,yy,8,0,7); ctx.fill();             // head
      ctx.fillStyle="#3a2f24"; ctx.beginPath(); ctx.arc(x,yy-3,8,Math.PI,0); ctx.fill(); // hat/hair
    }
    ctx.restore();
    // ---- ring: posts, ropes, canvas ----
    ctx.save(); ctx.translate(sh,0);
    ctx.fillStyle="#b9904f"; ctx.fillRect(0,H*0.66,W,H*0.34);                            // canvas
    ctx.fillStyle="#a07e44"; for(let x=0;x<W;x+=40) ctx.fillRect(x,H*0.66,2,H*0.34);
    // corner posts
    for(const px of [24,W-24]){ ctx.fillStyle="#7a2f2a"; ctx.fillRect(px-5,H*0.40,10,H*0.30);
      ctx.fillStyle="#caa64a"; ctx.fillRect(px-7,H*0.40,14,8); }
    // ropes (crimson)
    ctx.strokeStyle="#9a2f2a"; ctx.lineWidth=4;
    for(let r=0;r<3;r++){ const ry=H*0.44+r*0.07*H; ctx.beginPath(); ctx.moveTo(24,ry); ctx.lineTo(W-24,ry); ctx.stroke(); }

    // ---- fighters (close enough that punches clearly reach) ----
    const pBaseX=W*0.44, oX=W*0.56;
    const pX=pBaseX + (this.bobT>0?this.bob*20:0);
    // player TR (Harvard student, crimson trim already)
    Art.drawTR(ctx,pX,H*0.92,128,{costume:"student",state:this.pPunch>0?"punch":"idle",t,face:1});
    if(this.pPunch>0){ // glove streak reaching toward the rival
      ctx.fillStyle=this.pType==="cross"?"#b03030":"#7a2f2a";
      ctx.beginPath(); ctx.arc(pX+ (this.pType==="cross"?56:44), H*0.50, this.pType==="cross"?11:9,0,7); ctx.fill();
      ctx.strokeStyle="#2a1014"; ctx.lineWidth=2.5; ctx.stroke();
    }
    // rival (crimson Harvard sweater + headgear), flinches back when hit
    const flinchOff=this.foeFlinch>0?10:0;
    ctx.save(); ctx.translate(oX+flinchOff,H*0.92); ctx.scale(-1,1);
    if(this.foeFlinch>0){ ctx.globalAlpha=0.6+0.4*Math.sin(t*0.05); }
    // legs
    ctx.fillStyle="#2a2a30"; ctx.fillRect(-12,-30,9,30); ctx.fillRect(3,-30,9,30);
    // crimson torso
    ctx.fillStyle="#8a1f24"; Art.rr(ctx,-20,-96,40,68,12); ctx.fill();
    ctx.strokeStyle="#2a1014"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#6a1418"; ctx.fillRect(-20,-96,15,68);                                // shade
    // head + headgear
    ctx.fillStyle="#e0a578"; ctx.beginPath(); ctx.arc(0,-112,16,0,7); ctx.fill(); out2(ctx);
    ctx.fillStyle="#7a2f2a"; ctx.beginPath(); ctx.arc(0,-118,17,Math.PI,0); ctx.fill();   // headgear
    ctx.fillStyle="#7a2f2a"; Art.rr(ctx,-18,-118,36,8,3); ctx.fill();
    // eye + scowl
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.ellipse(7,-112,3,4,0,0,7); ctx.fill();
    ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(8,-111,1.6,0,7); ctx.fill();
    // glove (winds up, then jabs)
    let gx=10,gy=-78;
    if(this.foeState==="wind"){ gx=-6; gy=-92; }
    if(this.foeState==="swing"){ gx=34; gy=-70; }
    ctx.fillStyle="#7a2f2a"; ctx.beginPath(); ctx.arc(gx,gy,11,0,7); ctx.fill(); out2(ctx,2.5);
    ctx.restore();

    // sparks
    for(const s of this.sparks){ ctx.globalAlpha=Math.max(0,s.life/24); ctx.fillStyle=s.c;
      ctx.beginPath(); ctx.arc(s.x-sh,s.y,3,0,7); ctx.fill(); }
    ctx.globalAlpha=1;

    // telegraph / feedback banner (single line, centered, clear of HUD)
    if(this.foeState==="wind"){ ctx.fillStyle="#ffd34d"; ctx.font="bold 22px Trebuchet MS"; ctx.textAlign="center";
      ctx.fillText("DODGE  "+(this.foeDir===1?"◄ LEFT":"RIGHT ►"),W/2,H*0.30); }
    ctx.restore();

    // HP bars — left & right, no overlap with the centered banner
    bar(ctx,30,28,260,18,this.hp/100,"#5ad05a","ROOSEVELT");
    bar(ctx,W-290,28,260,18,this.foeHP/100,"#d05a5a","HARVARD RIVAL");
  }
}
function out2(ctx,w=2.5){ ctx.strokeStyle="#2a1d12"; ctx.lineWidth=w; ctx.stroke(); }
function bar(ctx,x,y,w,h,p,col,label){
  ctx.fillStyle="#000a"; Art.rr(ctx,x-2,y-2,w+4,h+4,5); ctx.fill();
  ctx.fillStyle="#333"; Art.rr(ctx,x,y,w,h,4); ctx.fill();
  ctx.fillStyle=col; Art.rr(ctx,x,y,w*clamp(p,0,1),h,4); ctx.fill();
  ctx.fillStyle="#fff"; ctx.font="11px Trebuchet MS"; ctx.textAlign="left"; ctx.fillText(label,x,y-6);
}

/* -------- 3. River CHASE — catch the fleeing boat thieves --------
   The thieves' boat runs ahead of you. Close the GAP by paddling (hold SPACE)
   while steering into their lane and dodging ice floes & boulders. Catch them
   (gap → 0) to win; if you lose all hearts you wreck and they escape. */
class MGRiver {
  constructor(env){ this.env=env; this.status="play";
    this.x=env.W/2;                 // player horizontal
    this.tx=env.W/2;                // thieves' boat horizontal
    this.tDir=1; this.tTurn=rand(40,90);
    this.gap=100;                   // distance to the thieves (100 far → 0 caught)
    this.hp=4; this.maxHp=4;
    this.obst=[]; this.spawnT=0; this.scroll=0; this.stun=0; this.costume="cowboy"; this.caughtFx=0; }
  update(input){
    const {W}=this.env;
    if(this.status!=="play"){ return; }
    // steering
    if(input.down("ArrowLeft")) this.x-=4.4;
    if(input.down("ArrowRight")) this.x+=4.4;
    this.x=clamp(this.x,W*0.20,W*0.80);
    // thieves weave to shake you
    this.tTurn--; if(this.tTurn<=0){ this.tDir=Math.random()<0.5?-1:1; this.tTurn=rand(40,90); }
    this.tx=clamp(this.tx+this.tDir*1.8, W*0.22, W*0.78);

    if(this.stun>0) this.stun--;
    const paddling = input.down("Space") && this.stun<=0;
    const aligned = Math.abs(this.tx-this.x) < 70;          // lined up behind them?
    // close or lose ground
    if(paddling){
      this.gap -= aligned ? 0.85 : 0.45;                    // gain more when in their wake
      if(Math.random()<0.4) Audio2.sfx.paddle();
    } else {
      this.gap += 0.30;                                     // they pull away if you coast
    }
    this.gap=clamp(this.gap,0,120);
    this.scroll += (paddling?6:3);

    // obstacles flow toward the player; faster when paddling
    const flow = paddling?6:3.4;
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(24,40);
      this.obst.push({x:rand(W*0.22,W*0.78),y:-40,r:rand(16,28),type:Math.random()<0.5?"ice":"rock"}); }
    for(const o of this.obst){ o.y+=flow*1.4;
      if(Math.abs(o.x-this.x)<o.r+16 && Math.abs(o.y-this.env.H*0.80)<o.r+18){
        o.hit=true; this.hp--; this.stun=24; this.gap=clamp(this.gap+10,0,120);   // wreck sets you back
        Audio2.sfx.hit(); this.env.particles.spawn(this.x,this.env.H*0.80,{n:14,color:"#bfe3ff",spread:3}); }
    }
    this.obst=this.obst.filter(o=>o.y<this.env.H+50 && !o.hit);

    if(this.caughtFx>0) this.caughtFx--;
    if(this.gap<=0){ this.status="won"; }
    if(this.hp<=0){ this.status="lost"; }
    this.progress=1-this.gap/100;        // HUD: how close to catching them
  }
  drawBoat(ctx,x,y,scale,thieves,t){
    ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
    // wake
    ctx.fillStyle="rgba(255,255,255,.25)"; ctx.beginPath(); ctx.ellipse(0,16,30,7,0,0,7); ctx.fill();
    // hull
    ctx.fillStyle="#3a2716"; Art.rr(ctx,-28,-6,56,26,11); ctx.fill();
    ctx.fillStyle="#5a3c20"; Art.rr(ctx,-24,-4,48,18,9); ctx.fill();
    ctx.strokeStyle="#241710"; ctx.lineWidth=2; Art.rr(ctx,-28,-6,56,26,11); ctx.stroke();
    ctx.fillStyle="#6e4a28"; for(let bx=-22;bx<24;bx+=10) ctx.fillRect(bx,-3,1,16);   // planks
    ctx.restore();
    if(thieves){ // two crooks rowing, glancing back over the shoulder
      for(const sx of [-9,9]){
        ctx.save(); ctx.translate(x+sx*scale, y-12*scale); ctx.scale(scale,scale);
        ctx.fillStyle="#5a4630"; Art.rr(ctx,-7,-4,14,18,5); ctx.fill();               // body
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-9,6,0,7); ctx.fill();     // head
        ctx.strokeStyle="#2a1d12"; ctx.lineWidth=1.4; ctx.stroke();
        ctx.fillStyle="#3a2a18"; ctx.beginPath(); ctx.ellipse(0,-13,8,2.4,0,0,7); ctx.fill(); // hat brim
        ctx.fillStyle="#3a2a18"; Art.rr(ctx,-5,-18,10,5,2); ctx.fill();
        ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(-2,-9,1.3,0,7); ctx.fill();  // worried eye
        ctx.strokeStyle="#5a4326"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(6,-2); ctx.lineTo(16,8); ctx.stroke(); // oar
        ctx.restore();
      }
    }
  }
  draw(ctx,t){
    const {W,H}=this.env;
    // river water
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"#4a7c91"); g.addColorStop(1,"#23414f");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // banks scrolling past
    ctx.fillStyle="#6e4a28"; ctx.fillRect(0,0,W*0.18,H); ctx.fillRect(W*0.82,0,W*0.18,H);
    ctx.fillStyle="#5a3c20";
    for(let y=(this.scroll*1.2)%40-40;y<H;y+=40){ ctx.fillRect(W*0.18-6,y,6,20); ctx.fillRect(W*0.82,y,6,20); }
    // current streaks
    ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=2;
    for(let y=(this.scroll*1.8)%30;y<H;y+=30){ ctx.beginPath(); ctx.moveTo(W*0.32,y); ctx.lineTo(W*0.32,y+12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W*0.68,y+10); ctx.lineTo(W*0.68,y+22); ctx.stroke(); }
    // obstacles
    for(const o of this.obst){ if(o.type==="ice") pIce(ctx,o.x,o.y,o.r); else pBoulder(ctx,o.x,o.y,o.r); }
    // ---- thieves' boat: nearer the top when far, descends toward you as the gap closes ----
    const ty = H*0.18 + (1-this.gap/100)*(H*0.42);   // gap 100 → high/small, gap 0 → close
    const tscale = 0.7 + (1-this.gap/100)*0.5;
    this.drawBoat(ctx,this.tx,ty,tscale,true,t);
    // catch flash
    if(this.status==="won"||this.caughtFx>0){ ctx.fillStyle="rgba(255,230,150,.5)";
      ctx.beginPath(); ctx.arc(this.tx,ty,40,0,7); ctx.fill(); }
    // ---- player's boat + TR paddling (stun flickers) ----
    const by=H*0.80;
    if(!(this.stun>0 && Math.floor(t/60)%2===0)){
      this.drawBoat(ctx,this.x,by,1.0,false,t);
      Art.drawTR(ctx,this.x,by-2,70,{costume:this.costume,age:"adult",state:"paddle",t});
    }
    // HUD
    bar(ctx,W/2-130,22,260,16,this.progress,"#7ad0e0","CLOSING IN");
    for(let i=0;i<this.maxHp;i++){ ctx.fillStyle=i<this.hp?"#ff5a5a":"#444"; heart(ctx,30+i*26,30,9); }
    // prompts
    ctx.textAlign="center"; ctx.font="bold 15px Trebuchet MS";
    if(this.gap>60){ ctx.fillStyle="#ffd34d"; ctx.fillText("After them! Hold SPACE to paddle — steer into their wake",W/2,H*0.12); }
    else if(this.gap>12){ ctx.fillStyle="#8be28b"; ctx.fillText("Gaining on them — stay in their lane!",W/2,H*0.12); }
    else { ctx.fillStyle="#ffd34d"; ctx.fillText("Almost got 'em!",W/2,H*0.12); }
  }
}
function heart(ctx,x,y,s){ ctx.beginPath(); ctx.moveTo(x,y+s*0.3);
  ctx.bezierCurveTo(x,y-s*0.3,x-s,y-s*0.3,x-s,y+s*0.2);
  ctx.bezierCurveTo(x-s,y+s*0.7,x,y+s,x,y+s*1.2);
  ctx.bezierCurveTo(x,y+s,x+s,y+s*0.7,x+s,y+s*0.2);
  ctx.bezierCurveTo(x+s,y-s*0.3,x,y-s*0.3,x,y+s*0.3); ctx.fill(); }

/* ----- shared detailed props (shaded + outlined to match stage sprites) ----- */
const PROP_OL="#1c140d";
function pBoulder(ctx,x,y,r){
  ctx.save();
  ctx.fillStyle="rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(x,y+r*0.85,r*0.9,r*0.32,0,0,7); ctx.fill();
  ctx.fillStyle="#6f655a"; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  ctx.fillStyle="#574e45"; ctx.beginPath(); ctx.arc(x+r*0.28,y+r*0.22,r*0.82,0.4,2.6); ctx.fill(); // shaded side
  ctx.fillStyle="#857a6c"; ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.34,r*0.42,0,7); ctx.fill();    // highlight
  ctx.strokeStyle="#3a332b"; ctx.lineWidth=1.4;                                                    // cracks
  ctx.beginPath(); ctx.moveTo(x-r*0.4,y-r*0.1); ctx.lineTo(x+r*0.05,y+r*0.2); ctx.lineTo(x+r*0.5,y-r*0.05); ctx.stroke();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2.4; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
  ctx.restore();
}
function pIce(ctx,x,y,r){
  ctx.save();
  ctx.fillStyle="rgba(180,220,240,.25)"; ctx.beginPath(); ctx.ellipse(x,y+r*0.8,r*0.9,r*0.3,0,0,7); ctx.fill();
  ctx.beginPath();
  for(let i=0;i<7;i++){ const a=i/7*Math.PI*2; const rr2=r*(i%2?0.78:1); const px=x+Math.cos(a)*rr2, py=y+Math.sin(a)*rr2; i?ctx.lineTo(px,py):ctx.moveTo(px,py); }
  ctx.closePath();
  ctx.fillStyle="#dff1ff"; ctx.fill();
  ctx.strokeStyle="#9ec7e0"; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle="rgba(255,255,255,.7)"; ctx.beginPath(); ctx.moveTo(x-r*0.3,y-r*0.3); ctx.lineTo(x,y); ctx.lineTo(x-r*0.5,y+r*0.1); ctx.fill();
  ctx.restore();
}
function pCannonball(ctx,x,y,r){
  ctx.save();
  const g=ctx.createRadialGradient(x-r*0.35,y-r*0.35,r*0.1,x,y,r);
  g.addColorStop(0,"#6b7078"); g.addColorStop(0.6,"#33373d"); g.addColorStop(1,"#1a1c20");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.55)"; ctx.beginPath(); ctx.arc(x-r*0.34,y-r*0.34,r*0.26,0,7); ctx.fill();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
  ctx.restore();
}
function pBullet(ctx,x,y,vx,vy){ // brass bullet with motion streak, oriented to travel
  ctx.save(); ctx.translate(x,y); ctx.rotate(Math.atan2(vy,vx));
  ctx.strokeStyle="rgba(255,230,150,.5)"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-16,0); ctx.lineTo(-4,0); ctx.stroke();
  ctx.fillStyle="#caa23a"; ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-2,-3.4); ctx.lineTo(-6,-3.4); ctx.lineTo(-6,3.4); ctx.lineTo(-2,3.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#e8d27a"; ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(0,-2); ctx.lineTo(0,2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=1.2; ctx.stroke();
  ctx.restore();
}
function pShell(ctx,x,y,r){ // arcing cannon shell with tiny fuse spark
  ctx.save();
  const g=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.1,x,y,r);
  g.addColorStop(0,"#5b6068"); g.addColorStop(1,"#23262b");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.stroke();
  ctx.fillStyle="#ffb347"; ctx.beginPath(); ctx.arc(x+r*0.5,y-r*0.6,2.2,0,7); ctx.fill();
  ctx.restore();
}
function pBarbwire(ctx,x,oy){ // wire barricade
  ctx.save(); ctx.strokeStyle="#9a9088"; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(x-18,oy); ctx.lineTo(x+18,oy-26); ctx.moveTo(x+18,oy); ctx.lineTo(x-18,oy-26); ctx.stroke();
  ctx.strokeStyle="#6a625a"; ctx.lineWidth=2;
  for(let i=-14;i<=14;i+=9){ ctx.beginPath(); ctx.moveTo(x+i-3,oy-13-(i)*0.7+3); ctx.lineTo(x+i+3,oy-13-(i)*0.7-3); ctx.stroke(); }
  // posts
  ctx.fillStyle="#5a4632"; ctx.fillRect(x-20,oy-4,4,10); ctx.fillRect(x+16,oy-4,4,10);
  ctx.restore();
}

/* ===== detailed mini-game sprites (match stage-sprite quality) ===== */

/* Steel pre-dreadnought battleship target — a detailed, multi-tone sprite.
   Drawn facing LEFT (its travel direction). cx = hull center, cy = waterline. */
function pBattleship(ctx,cx,cy,scale,t){
  ctx.save(); ctx.translate(cx,cy); ctx.scale(scale,scale); ctx.lineJoin="round"; ctx.lineCap="round";
  const STEEL="#48555f", STEEL_D="#33404a", STEEL_L="#65737d", DECK="#6b5436", HULL="#2b3741", HULL_D="#1c262e", TRIM="#11181d";

  // ---- smoke first (behind ship) ----
  for(let i=0;i<5;i++){ const fx=-8+i*2, drift=t*0.02;
    ctx.fillStyle="rgba(70,74,80,"+(0.30-i*0.05)+")";
    ctx.beginPath(); ctx.arc(-2 - i*8 - (drift%6), -52 - i*7 + Math.sin(t*0.01+i)*3, 7+i*2, 0,7); ctx.fill(); }

  // ---- hull: sheered bow line, darker boot-topping at waterline ----
  ctx.beginPath();
  ctx.moveTo(-58,-4);                       // bow tip (pointing left)
  ctx.quadraticCurveTo(-52,-8,-42,-8);      // raised bow sheer
  ctx.lineTo(44,-8);
  ctx.lineTo(50,-2);                         // stern
  ctx.lineTo(46,12); ctx.lineTo(-44,12);    // hull bottom
  ctx.quadraticCurveTo(-56,10,-58,-4); ctx.closePath();
  const hg=ctx.createLinearGradient(0,-8,0,12); hg.addColorStop(0,"#37454f"); hg.addColorStop(1,HULL_D);
  ctx.fillStyle=hg; ctx.fill();
  ctx.strokeStyle=TRIM; ctx.lineWidth=2; ctx.stroke();
  // boot-topping stripe + portholes
  ctx.fillStyle="#10161b"; ctx.fillRect(-50,7,96,5);
  ctx.fillStyle="#9fb0bb"; for(let px=-40;px<44;px+=12){ ctx.beginPath(); ctx.arc(px,1,1.6,0,7); ctx.fill(); }
  // bow wave
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.beginPath();
  ctx.moveTo(-58,-2); ctx.quadraticCurveTo(-66,4,-60,10); ctx.quadraticCurveTo(-54,6,-52,2); ctx.closePath(); ctx.fill();

  // ---- main deck ----
  ctx.fillStyle=DECK; ctx.fillRect(-42,-12,86,5);
  ctx.fillStyle="#7a6242"; for(let dx=-40;dx<44;dx+=8) ctx.fillRect(dx,-12,1,5); // planking

  // ---- fore & aft main gun turrets (barbette + twin barrels) ----
  function turret(gx,dir){
    ctx.fillStyle=STEEL_D; ctx.beginPath(); ctx.ellipse(gx,-12,11,5,0,Math.PI,0); ctx.fill();   // barbette
    ctx.fillStyle=STEEL; Art.rr(ctx,gx-9,-21,18,10,3); ctx.fill();                                // turret
    ctx.fillStyle=STEEL_L; Art.rr(ctx,gx-9,-21,18,3,2); ctx.fill();                               // top light
    ctx.strokeStyle=TRIM; ctx.lineWidth=1.4; Art.rr(ctx,gx-9,-21,18,10,3); ctx.stroke();
    ctx.strokeStyle="#1a1f24"; ctx.lineWidth=3;                                                    // twin barrels
    ctx.beginPath(); ctx.moveTo(gx,-18); ctx.lineTo(gx+dir*20,-20); ctx.moveTo(gx,-15); ctx.lineTo(gx+dir*20,-17); ctx.stroke();
  }
  turret(-30,-1); turret(34,1);

  // ---- central superstructure: deckhouse, bridge, conning tower ----
  ctx.fillStyle=STEEL_D; Art.rr(ctx,-20,-26,40,14,2); ctx.fill();           // deckhouse
  ctx.fillStyle=STEEL;   Art.rr(ctx,-20,-26,40,5,2); ctx.fill();            // sunlit top
  ctx.fillStyle="#1a2228"; for(let wx=-16;wx<18;wx+=6) ctx.fillRect(wx,-23,3,5); // windows
  ctx.fillStyle=STEEL;   Art.rr(ctx,-10,-36,20,12,2); ctx.fill();           // bridge
  ctx.fillStyle=STEEL_L; Art.rr(ctx,-10,-36,20,3,2); ctx.fill();
  ctx.strokeStyle=TRIM; ctx.lineWidth=1.4; ctx.strokeRect(-10,-36,20,12);
  ctx.fillStyle="#cfe0ea"; for(let wx=-7;wx<9;wx+=5) ctx.fillRect(wx,-33,3,4); // bridge glass
  ctx.fillStyle=STEEL_D; Art.rr(ctx,-4,-44,8,9,2); ctx.fill();              // conning tower

  // ---- two raked funnels with caps ----
  for(const fx of [-9,9]){
    ctx.fillStyle=STEEL_D; ctx.beginPath();
    ctx.moveTo(fx-5,-26); ctx.lineTo(fx-4,-46); ctx.lineTo(fx+6,-46); ctx.lineTo(fx+5,-26); ctx.closePath(); ctx.fill();
    ctx.fillStyle=STEEL_L; ctx.fillRect(fx-4,-46,3,20);            // lit edge
    ctx.fillStyle=TRIM; ctx.fillRect(fx-5,-47,11,3);               // cap
  }
  // ---- masts with yardarm, rigging, and ensign ----
  ctx.strokeStyle="#0e1418"; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(-16,-26); ctx.lineTo(-18,-52); ctx.stroke();   // foremast
  ctx.beginPath(); ctx.moveTo(18,-24); ctx.lineTo(20,-48); ctx.stroke();     // mainmast
  ctx.beginPath(); ctx.moveTo(-24,-46); ctx.lineTo(-12,-46); ctx.stroke();   // yardarm
  ctx.strokeStyle="rgba(20,24,28,.6)"; ctx.lineWidth=0.8;                     // rigging
  ctx.beginPath(); ctx.moveTo(-18,-52); ctx.lineTo(20,-48); ctx.moveTo(-18,-52); ctx.lineTo(-4,-44); ctx.stroke();
  // fighting top
  ctx.fillStyle=STEEL_D; ctx.beginPath(); ctx.arc(-18,-50,2.6,0,7); ctx.fill();
  // ensign on mainmast
  const fl=Math.sin(t*0.012)*2;
  ctx.fillStyle="#b23b30"; ctx.beginPath();
  ctx.moveTo(20,-48); ctx.lineTo(33,-46+fl); ctx.lineTo(20,-43); ctx.closePath(); ctx.fill();
  ctx.fillStyle="#1d3a6b"; ctx.fillRect(20,-48,5,3);

  ctx.restore();
}
/* Water splash plume */
function pSplash(ctx,x,y){
  ctx.save(); ctx.fillStyle="rgba(220,240,250,.85)";
  for(let i=-2;i<=2;i++){ const h=18-Math.abs(i)*4; ctx.beginPath();
    ctx.ellipse(x+i*7,y-h*0.5,3,h*0.5,0,0,7); ctx.fill(); }
  ctx.fillStyle="rgba(180,210,225,.6)"; ctx.beginPath(); ctx.ellipse(x,y,16,4,0,0,7); ctx.fill();
  ctx.restore();
}
/* Naval deck gun, pivots to `ang`. Drawn at (x,y) pivot. */
function pDeckGun(ctx,x,y,ang){
  ctx.save(); ctx.translate(x,y);
  // mount base
  ctx.fillStyle="#3a4048"; ctx.beginPath(); ctx.arc(0,0,22,Math.PI,0); ctx.fill();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2.5; ctx.stroke();
  ctx.fillStyle="#2a2f35"; ctx.fillRect(-24,0,48,12);
  // barrel
  ctx.save(); ctx.rotate(ang);
  const bg=ctx.createLinearGradient(0,-7,0,7); bg.addColorStop(0,"#6b7178"); bg.addColorStop(1,"#23282d");
  ctx.fillStyle=bg; Art.rr(ctx,-6,-7,62,14,5); ctx.fill();
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2.5; ctx.stroke();
  ctx.fillStyle="#11141a"; ctx.beginPath(); ctx.arc(56,0,4,0,7); ctx.fill();   // muzzle
  ctx.restore();
  // breech ball
  ctx.fillStyle="#1f242a"; ctx.beginPath(); ctx.arc(0,0,12,0,7); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.3)"; ctx.beginPath(); ctx.arc(-4,-4,4,0,7); ctx.fill();
  ctx.restore();
}
/* Shirking police officer (top-down-ish). state: 'sleep' or 'alert'. */
function pShirker(ctx,x,y,asleep,t){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(0,14,16,5,0,0,7); ctx.fill();
  // body (blue coat)
  ctx.fillStyle=asleep?"#2a3550":"#3a4a6a"; Art.rr(ctx,-12,-16,24,30,8); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.2)"; Art.rr(ctx,-12,-16,9,30,8); ctx.fill();           // shade
  ctx.strokeStyle="#11192a"; ctx.lineWidth=2; Art.rr(ctx,-12,-16,24,30,8); ctx.stroke();
  // brass buttons
  ctx.fillStyle="#d9b24a"; for(let by=-9;by<10;by+=8){ ctx.beginPath(); ctx.arc(0,by,1.6,0,7); ctx.fill(); }
  // head + custodian helmet
  ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-22,8,0,7); ctx.fill(); ctx.strokeStyle="#11192a"; ctx.lineWidth=1.6; ctx.stroke();
  ctx.fillStyle="#1c2740"; Art.rr(ctx,-8,-32,16,9,5); ctx.fill();                   // helmet dome
  ctx.fillStyle="#d9a441"; ctx.beginPath(); ctx.arc(0,-29,1.8,0,7); ctx.fill();     // badge
  if(asleep){ ctx.fillStyle="#cfe0ff"; ctx.font="bold 15px Trebuchet MS"; ctx.textAlign="center";
    ctx.fillText("z",10,-30-((t*0.05)%8)); }
  ctx.restore();
}
/* Monopoly "Trust" — money-bag with sash & top hat. */
function pTrust(ctx,x,y){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,22,26,7,0,0,7); ctx.fill();
  // sack body
  ctx.beginPath(); ctx.moveTo(-20,20); ctx.quadraticCurveTo(-26,-14,-8,-22);
  ctx.quadraticCurveTo(8,-26,8,-22); ctx.quadraticCurveTo(26,-14,20,20); ctx.closePath();
  const g=ctx.createLinearGradient(-20,-22,20,20); g.addColorStop(0,"#6a572f"); g.addColorStop(1,"#4a3c1e");
  ctx.fillStyle=g; ctx.fill(); ctx.strokeStyle=PROP_OL; ctx.lineWidth=2.4; ctx.stroke();
  // cinched neck
  ctx.fillStyle="#3a2f1a"; Art.rr(ctx,-10,-26,20,7,3); ctx.fill();
  // $ medallion
  ctx.fillStyle="#ffd34d"; ctx.font="bold 22px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("$",0,4);
  // top hat (greed)
  ctx.fillStyle="#15151a"; ctx.beginPath(); ctx.ellipse(0,-28,15,4,0,0,7); ctx.fill();
  ctx.fillStyle="#15151a"; Art.rr(ctx,-9,-46,18,18,2); ctx.fill();
  ctx.fillStyle="#7a1f1f"; ctx.fillRect(-9,-32,18,3);                               // hat band
  ctx.strokeStyle=PROP_OL; ctx.lineWidth=2; Art.rr(ctx,-9,-46,18,18,2); ctx.stroke();
  // beady eyes
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(-5,-14,2.4,0,7); ctx.arc(5,-14,2.4,0,7); ctx.fill();
  ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(-4.4,-14,1.2,0,7); ctx.arc(5.6,-14,1.2,0,7); ctx.fill();
  ctx.restore();
}
/* An ordinary citizen (spare them) in working clothes. */
function pCitizen(ctx,x,y){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,20,16,6,0,0,7); ctx.fill();
  ctx.fillStyle="#3a6b8a"; Art.rr(ctx,-12,-14,24,34,7); ctx.fill();
  ctx.fillStyle="rgba(0,0,0,.2)"; Art.rr(ctx,-12,-14,9,34,7); ctx.fill();
  ctx.strokeStyle="#1c2d3a"; ctx.lineWidth=2; Art.rr(ctx,-12,-14,24,34,7); ctx.stroke();
  ctx.fillStyle="#e8b98f"; ctx.beginPath(); ctx.arc(0,-22,9,0,7); ctx.fill(); ctx.strokeStyle="#3a2a1e"; ctx.lineWidth=1.6; ctx.stroke();
  ctx.fillStyle="#6a4a2c"; ctx.beginPath(); ctx.arc(0,-26,9,Math.PI,0); ctx.fill();   // hair
  // newsboy cap
  ctx.fillStyle="#5a6b4a"; Art.rr(ctx,-9,-32,18,6,3); ctx.fill(); ctx.fillRect(4,-30,8,3);
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(-3,-22,2,0,7); ctx.arc(4,-22,2,0,7); ctx.fill();
  ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(-3,-22,1,0,7); ctx.arc(4,-22,1,0,7); ctx.fill();
  ctx.restore();
}

/* -------- 4. Midnight ramble (top-down catch) -------- */
class MGPatrol {
  constructor(env){ this.env=env; this.status="play"; this.x=env.W/2; this.y=env.H*0.6;
    this.caught=0; this.goal=5; this.time=35; this.cops=[]; this.flash=0;
    for(let i=0;i<5;i++) this.spawn(); }
  spawn(){
    // keep the spawn clear of the touch controls (d-pad bottom-left, action
    // button bottom-right) so a shirker can't hide under a button on mobile
    const W=this.env.W, H=this.env.H, m=120, by=H*0.74;
    let x,y,tries=0;
    do { x=rand(80,W-80); y=rand(H*0.3,H*0.9); tries++; }
    while(tries<20 && y>by && (x<m || x>W-m));    // avoid lower-left / lower-right corners
    this.cops.push({x,y,z:Math.random()<0.5,caught:false});
  }
  update(input){
    this.time-=1/60; if(this.time<=0) this.status=this.caught>=this.goal?"won":"lost";
    const sp=3.4;
    if(input.down("ArrowLeft"))this.x-=sp; if(input.down("ArrowRight"))this.x+=sp;
    if(input.down("ArrowUp"))this.y-=sp; if(input.down("ArrowDown"))this.y+=sp;
    this.x=clamp(this.x,30,this.env.W-30); this.y=clamp(this.y,this.env.H*0.25,this.env.H-30);
    if(this.flash>0)this.flash--;
    if(input.pressed("Space")){ this.flash=14; Audio2.sfx.select();
      for(const c of this.cops){ if(!c.caught && Math.hypot(c.x-this.x,c.y-this.y)<70 && c.z){
        c.caught=true; this.caught++; Audio2.sfx.coin();
        this.env.particles.spawn(c.x,c.y,{n:14,color:"#ffd34d",spread:3}); } }
    }
    // shirkers occasionally wake & wander (still catchable but harder)
    for(const c of this.cops){ if(!c.caught && Math.random()<0.01) c.z=!c.z; }
    if(this.caught>=this.goal) this.status="won";
    this.progress=this.caught/this.goal;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    ctx.fillStyle="#10131f"; ctx.fillRect(0,0,W,H);
    // street grid
    ctx.strokeStyle="rgba(120,140,180,.12)"; ctx.lineWidth=2;
    for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let y=0;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    // gas lamps glowing along the avenue
    for(let lx=70; lx<W; lx+=190){
      const lg=ctx.createRadialGradient(lx,H*0.42,0,lx,H*0.42,46);
      lg.addColorStop(0,"rgba(255,220,140,.30)"); lg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(lx,H*0.42,46,0,7); ctx.fill();
      ctx.fillStyle="#14171f"; ctx.fillRect(lx-2,H*0.42,4,H*0.2);
      ctx.fillStyle="#ffe39a"; ctx.beginPath(); ctx.arc(lx,H*0.42,5,0,7); ctx.fill();
    }
    // shirking officers (detailed)
    for(const c of this.cops){ if(c.caught) continue; pShirker(ctx,c.x,c.y,c.z,t); }
    // darkness with lantern hole
    ctx.save();
    const rad=this.flash>0?150:95;
    const grd=ctx.createRadialGradient(this.x,this.y,10,this.x,this.y,rad);
    grd.addColorStop(0,"rgba(0,0,0,0)"); grd.addColorStop(1,"rgba(0,0,0,0.82)");
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    ctx.restore();
    // lantern glow
    const lg=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,rad);
    lg.addColorStop(0,"rgba(255,225,150,.35)"); lg.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=lg; ctx.beginPath(); ctx.arc(this.x,this.y,rad,0,7); ctx.fill();
    // TR commissioner
    Art.drawTR(ctx,this.x,this.y+24,64,{costume:"cop",state:"idle",t});
    bar(ctx,W/2-120,18,240,14,this.progress,"#ffd34d","SHIRKERS CAUGHT "+this.caught+"/"+this.goal);
    ctx.fillStyle="#fff"; ctx.font="14px Trebuchet MS"; ctx.textAlign="right"; ctx.fillText("Dawn in "+Math.ceil(this.time)+"s",W-20,30);
  }
}

/* -------- 5. Naval gunnery (angle + fire) -------- */
class MGGun {
  constructor(env){ this.env=env; this.status="play"; this.angle=-0.5; this.shots=[]; this.ships=[];
    this.hits=0; this.goal=6; this.time=35; this.spawnT=0; this.cool=0; this.flash=0; this.splashes=[]; }
  update(input){
    this.time-=1/60; if(this.time<=0) this.status=this.hits>=this.goal?"won":"lost";
    if(input.down("ArrowUp"))this.angle-=0.025; if(input.down("ArrowDown"))this.angle+=0.025;
    this.angle=clamp(this.angle,-1.2,-0.05);
    if(this.cool>0)this.cool--; if(this.flash>0)this.flash--;
    const seaY=this.env.H*0.62;
    if((input.pressed("Space"))&&this.cool<=0){ this.cool=18; this.flash=6; Audio2.sfx.shoot();
      this.shots.push({x:84,y:this.env.H*0.74,vx:Math.cos(this.angle)*11,vy:Math.sin(this.angle)*11}); }
    for(const s of this.shots){ s.x+=s.vx; s.y+=s.vy; s.vy+=0.14;
      if(s.y>=seaY && s.vy>0 && !s.splashed){ s.splashed=true; this.splashes.push({x:s.x,y:seaY,life:18}); } }
    this.shots=this.shots.filter(s=>s.y<this.env.H&&s.x<this.env.W+40);
    for(const sp of this.splashes) sp.life--;
    this.splashes=this.splashes.filter(sp=>sp.life>0);
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(50,90);
      // ships ride on/near the sea surface (just above the waterline) so they read as afloat
      this.ships.push({x:this.env.W+60,y:rand(this.env.H*0.30,this.env.H*0.62),v:rand(1.0,2.0)}); }
    for(const sh of this.ships){ sh.x-=sh.v;
      for(const s of this.shots){ if(Math.abs(s.x-sh.x)<62&&Math.abs(s.y-sh.y)<46){
        sh.dead=true; s.dead=true; this.hits++; Audio2.sfx.hit();
        this.env.particles.spawn(sh.x,sh.y,{n:18,color:"#ffb347",spread:4,life:36}); } }
    }
    this.ships=this.ships.filter(sh=>sh.x>-50&&!sh.dead);
    this.shots=this.shots.filter(s=>!s.dead);
    if(this.hits>=this.goal) this.status="won";
    this.progress=this.hits/this.goal;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    // ---- open ocean filling the whole screen (no photo backdrop) ----
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,"#5e93ac"); g.addColorStop(0.45,"#3f7388"); g.addColorStop(1,"#173040");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // rolling swell bands for depth, all the way up
    for(let i=0;i<7;i++){ const band=H*(0.10+i*0.13); const amp=2+i*0.6;
      ctx.fillStyle="rgba(255,255,255,"+(0.05+i*0.012)+")"; ctx.beginPath(); ctx.moveTo(0,band);
      for(let x=0;x<=W;x+=18) ctx.lineTo(x, band+Math.sin((x+t*0.5+i*40)*0.03)*amp);
      ctx.lineTo(W,band+8); for(let x=W;x>=0;x-=18) ctx.lineTo(x, band+8+Math.sin((x+t*0.5+i*40)*0.03)*amp);
      ctx.closePath(); ctx.fill(); }
    // foam wave streaks across the surface
    ctx.strokeStyle="rgba(255,255,255,.18)"; ctx.lineWidth=2;
    for(let y=20;y<H;y+=26){ ctx.beginPath(); for(let x=0;x<=W;x+=18) ctx.lineTo(x,y+Math.sin((x+t*0.6+y)*0.04)*3); ctx.stroke(); }
    // sun glints
    ctx.fillStyle="rgba(255,250,220,.10)";
    for(let i=0;i<24;i++){ const gx=((i*131 + t*0.4)%W); const gy=H*0.2+((i*53)%(H*0.7)); ctx.fillRect(gx,gy,7,2); }
    // ---- detailed battleships sailing on the open water ----
    for(const sh of this.ships){
      const bob=Math.sin(t*0.004+sh.x)*2;
      ctx.fillStyle="rgba(255,255,255,.20)"; ctx.beginPath(); ctx.ellipse(sh.x,sh.y+26,78,10,0,0,7); ctx.fill();
      pBattleship(ctx, sh.x, sh.y+bob, 2.0, t);
    }
    const seaY=H*0.62;
    // shells in flight + splashes
    for(const s of this.shots){ pShell(ctx,s.x,s.y,6); }
    for(const sp of this.splashes){ ctx.globalAlpha=Math.max(0,sp.life/18); pSplash(ctx,sp.x,seaY); ctx.globalAlpha=1; }
    // ---- foredeck + deck gun + TR ----
    ctx.fillStyle="#3a4650"; ctx.beginPath(); ctx.moveTo(0,H*0.84); ctx.lineTo(150,H*0.84); ctx.lineTo(130,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
    ctx.fillStyle="#2d373f"; ctx.fillRect(0,H*0.84,150,4);
    pDeckGun(ctx,84,H*0.74,this.angle);
    if(this.flash>0){ ctx.save(); ctx.translate(84,H*0.74); ctx.rotate(this.angle);
      ctx.fillStyle="rgba(255,210,120,"+(this.flash/6)+")"; ctx.beginPath(); ctx.arc(60,0,12,0,7); ctx.fill(); ctx.restore(); }
    Art.drawTR(ctx,34,H*0.93,72,{costume:"navy",age:"adult",state:"idle",t});
    // HUD
    bar(ctx,30,28,300,18,this.progress,"#ffd34d","SHIPS HIT "+this.hits+"/"+this.goal);
    ctx.textAlign="right"; ctx.fillStyle="#fff"; ctx.font="bold 15px Trebuchet MS"; ctx.fillText("Drill",W-30,26);
    ctx.fillStyle=this.time<8?"#ff7a5a":"#ffd34d"; ctx.font="bold 22px Trebuchet MS"; ctx.fillText(Math.ceil(this.time)+"s",W-30,50);
  }
}

/* -------- 6. Charge up Kettle Hill (auto-runner) -------- */
class MGCharge {
  constructor(env){ this.env=env; this.status="play"; this.dist=0; this.goal=3200;
    this.y=0; this.vy=0; this.onGround=true; this.jumps=0; this.hp=5; this.maxHp=5; this.obst=[]; this.spawnT=0;
    this.run=t=>0; this.bullets=[]; this.bspawn=0; }
  update(input){
    this.dist+=3.6; this.progress=this.dist/this.goal;
    if((input.pressed("Space")||input.pressed("ArrowUp"))){
      if(this.onGround){ this.vy=-12; this.onGround=false; this.jumps=1; Audio2.sfx.jump(); }
      else if(this.jumps<2){ this.vy=-10; this.jumps=2; Audio2.sfx.jump(); }
    }
    this.vy+=0.6; this.y+=this.vy; if(this.y>=0){ this.y=0; this.vy=0; if(!this.onGround)Audio2.sfx.land(); this.onGround=true; }
    // obstacles
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(40,75);
      this.obst.push({x:this.env.W+30,type:Math.random()<0.5?"rock":"wire"}); }
    for(const o of this.obst){ o.x-=4.2;
      const px=this.env.W*0.28, py=this.env.H*0.7+this.y;
      if(Math.abs(o.x-px)<26 && this.y> -34){ o.hit=true; this.hp--; this.dist=Math.max(0,this.dist-120);
        Audio2.sfx.hit(); this.env.particles.spawn(px,py,{n:10,color:"#c0392b",spread:3}); }
    }
    this.obst=this.obst.filter(o=>o.x>-40&&!o.hit);
    // enemy fire from top of hill (slower & telegraphed so the player can jump/duck)
    this.bspawn--; if(this.bspawn<=0&&this.progress>0.2){ this.bspawn=rand(80,130);
      this.bullets.push({x:this.env.W-40,y:this.env.H*0.34,vx:-rand(3.5,5),vy:rand(1.2,2.2),warn:18}); }
    for(const b of this.bullets){ if(b.warn>0){ b.warn--; continue; } b.x+=b.vx; b.y+=b.vy;
      const px=this.env.W*0.28, py=this.env.H*0.7+this.y-30;
      if(Math.hypot(b.x-px,b.y-py)<20){ b.dead=true; this.hp--; Audio2.sfx.hit(); } }
    this.bullets=this.bullets.filter(b=>b.x>-20&&b.y<this.env.H&&!b.dead);
    if(this.hp<=0) this.status="lost";
    if(this.dist>=this.goal) this.status="won";
  }
  draw(ctx,t){
    const {W,H}=this.env;
    Art.drawBackground(ctx,6,"cubahill",W,H,this.dist,CHAPTERS[5].palette,t);
    // slope overlay
    ctx.fillStyle="rgba(95,122,57,.5)"; ctx.beginPath();
    ctx.moveTo(0,H); ctx.lineTo(0,H*0.78); ctx.lineTo(W,H*0.62); ctx.lineTo(W,H); ctx.fill();
    // obstacles (boulders & barbed-wire)
    for(const o of this.obst){ const oy=H*0.7;
      if(o.type==="rock"){ pBoulder(ctx,o.x,oy-14,18); }
      else { pBarbwire(ctx,o.x,oy); }
    }
    // bullets (telegraph marker, then a real bullet with streak)
    for(const b of this.bullets){ if(b.warn>0){ ctx.fillStyle="rgba(255,80,80,"+(0.4+0.4*Math.sin(t*0.04))+")";
        ctx.beginPath(); ctx.arc(b.x,b.y,7,0,7); ctx.fill(); }
      else { pBullet(ctx,b.x,b.y,b.vx,b.vy); } }
    // TR rough rider
    Art.drawTR(ctx,W*0.28,H*0.7+this.y,96,{costume:"roughrider",state:this.onGround?"run":"jump",t});
    bar(ctx,W/2-120,18,240,14,this.progress,"#e0533b","TO THE SUMMIT");
    for(let i=0;i<this.maxHp;i++){ ctx.fillStyle=i<this.hp?"#ff5a5a":"#444"; heart(ctx,30+i*26,30,9); }
  }
}

/* -------- 7. Telegraph race (press shown letters) -------- */
class MGTele {
  constructor(env){ this.env=env; this.status="play"; this.sent=0; this.goal=12; this.miss=0; this.maxMiss=4;
    this.cur=null; this.letters="ABCDEFGHJKLMNPRSTUVWY".split(""); this.next(); }
  next(){ this.cur={ ch:this.letters[Math.floor(Math.random()*this.letters.length)],
      life:1, decay:0.006+this.sent*0.0006 }; }
  update(input){
    if(!this.cur) return;
    this.cur.life-=this.cur.decay;
    if(this.cur.life<=0){ this.miss++; Audio2.sfx.fail(); this.next(); }
    for(const L of this.letters){ if(input.pressed("Key"+L)){
      if(L===this.cur.ch){ this.sent++; Audio2.sfx.type();
        this.env.particles.spawn(this.env.W/2,this.env.H*0.5,{n:10,color:"#7ad0e0",spread:3}); this.next(); }
      else { this.miss++; Audio2.sfx.land(); }
      break;
    } }
    if(this.sent>=this.goal) this.status="won";
    if(this.miss>=this.maxMiss) this.status="lost";
    this.progress=this.sent/this.goal;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    Art.drawBackground(ctx,7,"capitol",W,H,t*0.4,CHAPTERS[6].palette,t);
    ctx.fillStyle="rgba(0,0,0,.4)"; ctx.fillRect(0,0,W,H);
    // ---- dispatch card with the letter to press ----
    const cardX=W/2-150, cardY=H*0.26, cardW=300, cardH=170;
    ctx.fillStyle="#f3ead0"; Art.rr(ctx,cardX,cardY,cardW,cardH,10); ctx.fill();
    ctx.strokeStyle="#caa64a"; ctx.lineWidth=4; Art.rr(ctx,cardX,cardY,cardW,cardH,10); ctx.stroke();
    ctx.fillStyle="#7a3b2e"; ctx.font="bold 14px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("⚡ URGENT DISPATCH — PRESS", W/2, cardY+28);
    // faint telegraph ruled lines
    ctx.strokeStyle="rgba(120,90,60,.25)"; ctx.lineWidth=1;
    for(let ly=cardY+44; ly<cardY+cardH-10; ly+=18){ ctx.beginPath(); ctx.moveTo(cardX+16,ly); ctx.lineTo(cardX+cardW-16,ly); ctx.stroke(); }
    if(this.cur){
      ctx.fillStyle="#1a1410"; ctx.font="bold 92px Georgia, serif"; ctx.fillText(this.cur.ch,W/2,cardY+128);
      ctx.strokeStyle="#7ad0e0"; ctx.lineWidth=8;
      ctx.beginPath(); ctx.arc(W/2,cardY+96,66,-Math.PI/2,-Math.PI/2+Math.PI*2*this.cur.life); ctx.stroke();
    }
    // ---- telegraph desk + brass key (animates a tap on send) ----
    const deskY=H*0.80;
    ctx.fillStyle="#5a3c22"; ctx.fillRect(W*0.30,deskY,W*0.40,H-deskY);                 // desk
    ctx.fillStyle="#6e4a28"; ctx.fillRect(W*0.30,deskY,W*0.40,6);
    // sounder box
    ctx.fillStyle="#3a2c1a"; Art.rr(ctx,W*0.40,deskY-26,70,26,4); ctx.fill();
    ctx.strokeStyle="#1c140d"; ctx.lineWidth=2; Art.rr(ctx,W*0.40,deskY-26,70,26,4); ctx.stroke();
    ctx.fillStyle="#caa23a"; ctx.beginPath(); ctx.arc(W*0.40+35,deskY-13,6,0,7); ctx.fill(); // brass coil
    // the key + lever (dips when a letter was just sent)
    const tap = (this.cur && this.cur.life>0.92) ? 4 : 0;
    const kx=W*0.55, ky=deskY-6;
    ctx.fillStyle="#2a2a2e"; ctx.fillRect(kx-2,ky-16,4,16);                              // post
    ctx.save(); ctx.translate(kx,ky-16); ctx.rotate(tap?0.12:-0.05);
    ctx.fillStyle="#caa23a"; Art.rr(ctx,-26,-3,40,6,3); ctx.fill();                       // brass lever
    ctx.strokeStyle="#7a5a1a"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#1a1a1e"; ctx.beginPath(); ctx.arc(-26,0,5,0,7); ctx.fill();           // knob
    ctx.restore();
    // wire running off
    ctx.strokeStyle="#3a3a3a"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(kx+14,ky-14); ctx.quadraticCurveTo(W*0.7,deskY-30,W*0.72,deskY); ctx.stroke();
    // President TR at the key
    Art.drawTR(ctx,W*0.22,H*0.95,72,{costume:"president",age:"mature",state:"idle",t});
    // HUD
    bar(ctx,30,28,300,18,this.progress,"#7ad0e0","DISPATCHES "+this.sent+"/"+this.goal);
    ctx.textAlign="right"; ctx.fillStyle="#fff"; ctx.font="bold 14px Trebuchet MS"; ctx.fillText("Errors: "+this.miss+"/"+this.maxMiss,W-30,34);
  }
}

/* -------- 8. Big Stick: bust the trusts (lane whack) -------- */
class MGStick {
  constructor(env){ this.env=env; this.status="play"; this.lane=1; this.lanes=[0.28,0.5,0.72];
    this.score=0; this.goal=12; this.time=35; this.pop=[]; this.spawnT=0; this.swing=0; this.bad=0; this.maxBad=4; }
  update(input){
    this.time-=1/60; if(this.time<=0) this.status=this.score>=this.goal?"won":"lost";
    if(input.pressed("ArrowLeft"))this.lane=clamp(this.lane-1,0,2);
    if(input.pressed("ArrowRight"))this.lane=clamp(this.lane+1,0,2);
    if(this.swing>0)this.swing--;
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(28,46);
      // Only spawn into an empty lane so a trust and a citizen can never stack on
      // the same spot (which let one swing bust the trust AND hurt the citizen).
      const taken={}; for(const q of this.pop){ if(q.life>0&&!q.hit) taken[q.lane]=true; }
      const free=[0,1,2].filter(l=>!taken[l]);
      if(free.length){
        this.pop.push({lane:free[Math.floor(rand(0,free.length))],life:rand(55,90),
          type:Math.random()<0.66?"trust":"citizen",hit:false});
      } }
    for(const p of this.pop) p.life--;
    if(input.pressed("Space")){ this.swing=10; Audio2.sfx.punch();
      for(const p of this.pop){ if(!p.hit&&p.lane===this.lane&&p.life>0){
        if(p.type==="trust"){ p.hit=true; this.score++; Audio2.sfx.coin();
          this.env.particles.spawn(this.env.W*this.lanes[this.lane],this.env.H*0.6,{n:14,color:"#ffd34d",spread:3}); }
        else { p.hit=true; this.bad++; Audio2.sfx.fail();
          this.env.particles.spawn(this.env.W*this.lanes[this.lane],this.env.H*0.6,{n:10,color:"#ff5a5a",spread:3}); }
        break;   // one swing affects at most one target
      } }
    }
    this.pop=this.pop.filter(p=>p.life>0&&!p.hit);
    if(this.score>=this.goal) this.status="won";
    if(this.bad>=this.maxBad) this.status="lost";
    this.progress=this.score/this.goal;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    Art.drawBackground(ctx,8,"capitol",W,H,t*0.2,CHAPTERS[7].palette,t);
    ctx.fillStyle="rgba(0,0,0,.22)"; ctx.fillRect(0,0,W,H);
    // speaker's-stand platforms per lane
    for(let i=0;i<3;i++){ const x=W*this.lanes[i];
      ctx.fillStyle="#5a4326"; Art.rr(ctx,x-44,H*0.66,88,14,4); ctx.fill();
      ctx.fillStyle="#7a5a32"; Art.rr(ctx,x-44,H*0.66,88,5,3); ctx.fill();
      ctx.strokeStyle="#3a2a16"; ctx.lineWidth=2; Art.rr(ctx,x-44,H*0.66,88,14,4); ctx.stroke(); }
    // pop-ups (detailed trust money-bags vs. citizens)
    for(const p of this.pop){ const x=W*this.lanes[p.lane]; const up=Math.min(1,(90-p.life)/12);
      const y=H*0.66-30*up;
      if(p.type==="trust") pTrust(ctx,x,y); else pCitizen(ctx,x,y);
    }
    // TR with the Big Stick over current lane
    const tx=W*this.lanes[this.lane];
    Art.drawTR(ctx,tx,H*0.93,98,{costume:"president",age:"mature",state:this.swing>0?"swing":"idle",t});
    // detailed big stick (knotty club), swings down on hit
    ctx.save(); ctx.translate(tx+28,H*0.93-72); ctx.rotate(this.swing>0?0.5:-0.85);
    const sg=ctx.createLinearGradient(0,-7,0,7); sg.addColorStop(0,"#8a5e34"); sg.addColorStop(1,"#5a3c1e");
    ctx.fillStyle=sg; Art.rr(ctx,0,-7,74,14,7); ctx.fill();
    ctx.strokeStyle="#2e1f10"; ctx.lineWidth=2.4; Art.rr(ctx,0,-7,74,14,7); ctx.stroke();
    ctx.fillStyle="#4a3018"; ctx.beginPath(); ctx.arc(20,0,2,0,7); ctx.arc(44,-2,2,0,7); ctx.arc(60,2,2,0,7); ctx.fill(); // knots
    ctx.restore();
    bar(ctx,30,28,300,18,this.progress,"#2e7d32","TRUSTS BUSTED "+this.score+"/"+this.goal);
    ctx.textAlign="right"; ctx.fillStyle="#fff"; ctx.font="bold 14px Trebuchet MS";
    ctx.fillText("Citizens hurt: "+this.bad+"/"+this.maxBad,W-30,26);
    ctx.fillStyle=this.time<8?"#ff7a5a":"#ffd34d"; ctx.fillText(Math.ceil(this.time)+"s",W-30,48);
  }
}

/* -------- 9. River of Doubt (hard rapids) -------- */
class MGRapids {
  constructor(env){ this.env=env; this.status="play"; this.x=env.W/2; this.dist=0; this.goal=3200;
    this.hp=4; this.maxHp=4; this.obst=[]; this.spawnT=0; this.speed=3.6; this.whirl=[]; }
  update(input){
    if(input.down("ArrowLeft")) this.x-=4.0;
    if(input.down("ArrowRight")) this.x+=4.0;
    const push=input.down("Space")?1.8:1;
    this.x=clamp(this.x,this.env.W*0.2,this.env.W*0.8);
    this.dist+=this.speed*push; this.progress=this.dist/this.goal;
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(16,30)/push;
      const r=Math.random();
      if(r<0.7) this.obst.push({x:rand(this.env.W*0.2,this.env.W*0.8),y:-40,r:rand(14,26)});
      else this.whirl.push({x:rand(this.env.W*0.25,this.env.W*0.75),y:-50,r:34,a:0}); }
    for(const o of this.obst){ o.y+=this.speed*push*1.5;
      if(Math.abs(o.x-this.x)<o.r+14&&Math.abs(o.y-this.env.H*0.78)<o.r+16){ o.hit=true; this.hp--; Audio2.sfx.hit();
        this.env.particles.spawn(this.x,this.env.H*0.78,{n:12,color:"#bfe3ff",spread:3}); } }
    for(const w of this.whirl){ w.y+=this.speed*push*1.5; w.a+=0.2;
      const d=Math.hypot(w.x-this.x,w.y-this.env.H*0.78);
      if(d<w.r){ this.x+= (w.x-this.x)*0.04; if(d<18){ w.hit=true; this.hp--; Audio2.sfx.hit(); } } }
    this.obst=this.obst.filter(o=>o.y<this.env.H+60&&!o.hit);
    this.whirl=this.whirl.filter(w=>w.y<this.env.H+60&&!w.hit);
    if(input.down("Space")&&Math.random()<0.4) Audio2.sfx.paddle();
    if(this.hp<=0) this.status="lost";
    if(this.dist>=this.goal) this.status="won";
  }
  draw(ctx,t){
    const {W,H}=this.env;
    Art.drawBackground(ctx,10,"amazon",W,H,this.dist,(typeof CHAPTERS!=="undefined"?CHAPTERS[9].palette:{}),t);
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,"rgba(58,97,82,.45)"); g.addColorStop(1,"rgba(22,35,29,.75)");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // jungle banks
    ctx.fillStyle="#1f3a30"; ctx.fillRect(0,0,W*0.2,H); ctx.fillRect(W*0.8,0,W*0.2,H);
    ctx.fillStyle="#244a29";
    for(let y=(this.dist*1.5)%50-50;y<H;y+=50){ for(let a=0;a<3;a++){ ctx.save();
      ctx.translate(W*0.2-8,y); ctx.rotate(-0.6+a*0.5); ctx.beginPath(); ctx.ellipse(0,0,7,18,0,0,7); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(W*0.8+8,y); ctx.rotate(0.6-a*0.5); ctx.beginPath(); ctx.ellipse(0,0,7,18,0,0,7); ctx.fill(); ctx.restore(); } }
    // foam
    ctx.strokeStyle="rgba(220,240,230,.25)"; ctx.lineWidth=2;
    for(let y=(this.dist*2.4)%26;y<H;y+=26){ctx.beginPath();
      for(let x=W*0.2;x<=W*0.8;x+=18)ctx.lineTo(x,y+Math.sin((x+this.dist)*0.06)*3);ctx.stroke();}
    // whirlpools
    for(const w of this.whirl){ ctx.save(); ctx.translate(w.x,w.y); ctx.rotate(w.a);
      ctx.strokeStyle="#1a2e26"; ctx.lineWidth=4;
      for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(0,0,w.r-i*9,i,i+4); ctx.stroke(); } ctx.restore(); }
    // rocks (detailed boulders)
    for(const o of this.obst){ pBoulder(ctx,o.x,o.y,o.r); }
    // canoe
    const by=H*0.78; ctx.save(); ctx.translate(this.x,by);
    ctx.fillStyle="#3a2a18"; ctx.beginPath(); ctx.ellipse(0,6,30,12,0,0,7); ctx.fill();
    ctx.fillStyle="#5a4326"; ctx.beginPath(); ctx.ellipse(0,2,24,8,0,0,7); ctx.fill(); ctx.restore();
    Art.drawTR(ctx,this.x,by,72,{costume:"explorer",age:"elder",state:"paddle",t});
    bar(ctx,W/2-120,20,240,14,this.progress,"#86c06a","RIVER OF DOUBT");
    for(let i=0;i<this.maxHp;i++){ ctx.fillStyle=i<this.hp?"#ff5a5a":"#444"; heart(ctx,30+i*26,30,9); }
  }
}

/* -------- 9. Conservation : protect the wild (Yosemite) -------- */
class MGConserve {
  constructor(env){ this.env=env; this.status="play"; this.lane=1; this.lanes=[0.25,0.5,0.75];
    this.saved=0; this.goal=12; this.time=38; this.pop=[]; this.spawnT=0; this.act=0; this.scared=0; this.maxScared=4; }
  update(input){
    this.time-=1/60; if(this.time<=0) this.status=this.saved>=this.goal?"won":"lost";
    if(input.pressed("ArrowLeft"))this.lane=clamp(this.lane-1,0,2);
    if(input.pressed("ArrowRight"))this.lane=clamp(this.lane+1,0,2);
    if(this.act>0)this.act--;
    this.spawnT--; if(this.spawnT<=0){ this.spawnT=rand(30,50);
      // Only spawn into a lane that's currently empty, so two pop-ups can never
      // overlap on the same spot (which let one swing hit both a threat AND wildlife).
      const taken={}; for(const q of this.pop){ if(q.life>0&&!q.hit) taken[q.lane]=true; }
      const free=[0,1,2].filter(l=>!taken[l]);
      if(free.length){
        const r=Math.random();
        const type = r<0.6 ? "threat" : "wild";       // poacher/logger vs deer/bear
        this.pop.push({lane:free[Math.floor(rand(0,free.length))],life:rand(60,95),
          kind: type==="threat" ? (Math.random()<0.5?"poacher":"logger") : (Math.random()<0.5?"deer":"bear"),
          type, hit:false});
      } }
    for(const p of this.pop) p.life--;
    if(input.pressed("Space")){ this.act=10; Audio2.sfx.punch();
      for(const p of this.pop){ if(!p.hit&&p.lane===this.lane&&p.life>0){
        if(p.type==="threat"){ p.hit=true; this.saved++; Audio2.sfx.coin();
          this.env.particles.spawn(this.env.W*this.lanes[this.lane],this.env.H*0.58,{n:14,color:"#8be28b",spread:3}); }
        else { p.hit=true; this.scared++; Audio2.sfx.fail();
          this.env.particles.spawn(this.env.W*this.lanes[this.lane],this.env.H*0.58,{n:10,color:"#ff5a5a",spread:3}); }
        break;   // one swing affects at most one target
      } }
    }
    this.pop=this.pop.filter(p=>p.life>0&&!p.hit);
    if(this.saved>=this.goal) this.status="won";
    if(this.scared>=this.maxScared) this.status="lost";
    this.progress=this.saved/this.goal;
  }
  draw(ctx,t){
    const {W,H}=this.env;
    Art.drawBackground(ctx,9,"wilderness",W,H,t*0.2,(typeof CHAPTERS!=="undefined"?CHAPTERS[8].palette:{}),t);
    ctx.fillStyle="rgba(0,0,0,.30)"; ctx.fillRect(0,0,W,H);
    // groves (lane markers)
    for(let i=0;i<3;i++){ const x=W*this.lanes[i];
      ctx.fillStyle="#2f5a32"; ctx.beginPath(); ctx.ellipse(x,H*0.64,46,16,0,0,7); ctx.fill(); }
    // pop-ups (detailed poachers/loggers vs. wildlife)
    for(const p of this.pop){ const x=W*this.lanes[p.lane]; const up=Math.min(1,(95-p.life)/12); const y=H*0.64-34*up;
      const OL="#1c140d";
      if(p.type==="threat"){
        ctx.save(); ctx.translate(x,y);
        ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,2,16,5,0,0,7); ctx.fill();
        // body
        ctx.fillStyle=p.kind==="logger"?"#9a3a30":"#6a5a3a"; Art.rr(ctx,-12,-30,24,32,6); ctx.fill();
        if(p.kind==="logger"){ ctx.strokeStyle="#5a201a"; ctx.lineWidth=2;            // plaid
          for(let i=-9;i<12;i+=6){ctx.beginPath();ctx.moveTo(i,-30);ctx.lineTo(i,2);ctx.stroke();} }
        ctx.strokeStyle=OL; ctx.lineWidth=2.2; Art.rr(ctx,-12,-30,24,32,6); ctx.stroke();
        // head
        ctx.fillStyle="#e6b48a"; ctx.beginPath(); ctx.arc(0,-38,8,0,7); ctx.fill(); ctx.strokeStyle=OL; ctx.lineWidth=1.6; ctx.stroke();
        ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(3,-39,1.6,0,7); ctx.fill();
        // hat
        ctx.fillStyle="#3a2a18"; ctx.beginPath(); ctx.ellipse(0,-44,11,3,0,0,7); ctx.fill(); Art.rr(ctx,-7,-50,14,7,3); ctx.fill();
        // tool: rifle (poacher) or axe (logger)
        if(p.kind==="logger"){ ctx.strokeStyle="#6a4a2a"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(8,-26); ctx.lineTo(20,-44); ctx.stroke();
          ctx.fillStyle="#cfcccc"; ctx.beginPath(); ctx.moveTo(20,-44); ctx.lineTo(28,-48); ctx.lineTo(26,-38); ctx.fill(); }
        else { ctx.strokeStyle="#2a2018"; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-10,-22); ctx.lineTo(16,-32); ctx.stroke(); }
        ctx.fillStyle="#e2533b"; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("!",0,-56);
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x,y);
        ctx.fillStyle="rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0,2,18,5,0,0,7); ctx.fill();
        if(p.kind==="deer"){
          ctx.fillStyle="#b07a44"; Art.rr(ctx,-15,-22,26,22,9); ctx.fill();              // body
          ctx.strokeStyle=OL; ctx.lineWidth=2; Art.rr(ctx,-15,-22,26,22,9); ctx.stroke();
          ctx.fillStyle="#b07a44"; ctx.beginPath(); ctx.arc(13,-28,7,0,7); ctx.fill(); ctx.stroke(); // head
          ctx.fillStyle="#e8d8c0"; ctx.beginPath(); ctx.ellipse(-6,-12,5,7,0,0,7); ctx.fill();       // white belly spot
          ctx.strokeStyle="#7a5226"; ctx.lineWidth=2; ctx.beginPath();                                // antlers
          ctx.moveTo(13,-34); ctx.lineTo(9,-44); ctx.moveTo(11,-40); ctx.lineTo(4,-44);
          ctx.moveTo(15,-34); ctx.lineTo(20,-44); ctx.moveTo(17,-40); ctx.lineTo(24,-43); ctx.stroke();
          ctx.fillStyle="#15233a"; ctx.beginPath(); ctx.arc(16,-28,1.6,0,7); ctx.fill();
          ctx.fillStyle="#2a2018"; ctx.fillRect(-12,-2,4,5); ctx.fillRect(4,-2,4,5);                   // legs
        } else { // bear
          ctx.fillStyle="#5a4632"; Art.rr(ctx,-16,-24,32,24,11); ctx.fill();
          ctx.strokeStyle=OL; ctx.lineWidth=2; Art.rr(ctx,-16,-24,32,24,11); ctx.stroke();
          ctx.fillStyle="#5a4632"; ctx.beginPath(); ctx.arc(13,-26,9,0,7); ctx.fill(); ctx.stroke();
          ctx.fillStyle="#4a382a"; ctx.beginPath(); ctx.arc(8,-33,3.4,0,7); ctx.arc(18,-33,3.4,0,7); ctx.fill(); // ears
          ctx.fillStyle="#3a2c1e"; ctx.beginPath(); ctx.arc(17,-24,3,0,7); ctx.fill();                  // snout
          ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(11,-28,1.8,0,7); ctx.fill();
          ctx.fillStyle="#2a2018"; ctx.fillRect(-13,-2,5,4); ctx.fillRect(6,-2,5,4);
        }
        ctx.fillStyle="#8be28b"; ctx.font="bold 13px Trebuchet MS"; ctx.textAlign="center"; ctx.fillText("♥",0,-50);
        ctx.restore();
      }
    }
    // TR the naturalist ranger
    const tx=W*this.lanes[this.lane];
    Art.drawTR(ctx,tx,H*0.92,100,{costume:"naturalist",age:"mature",state:this.act>0?"swing":"idle",t});
    bar(ctx,30,28,300,18,this.progress,"#2e7d32","WILD PROTECTED "+this.saved+"/"+this.goal);
    ctx.textAlign="right"; ctx.fillStyle="#fff"; ctx.font="bold 14px Trebuchet MS";
    ctx.fillText("Wildlife scared: "+this.scared+"/"+this.maxScared,W-30,28);
    ctx.fillStyle=this.time<8?"#ff7a5a":"#ffd34d"; ctx.fillText(Math.ceil(this.time)+"s",W-30,48);
  }
}

const MINIGAMES = {
  bodybuild: MGBody, boxing: MGBox, river: MGRiver, patrol: MGPatrol,
  gunnery: MGGun, charge: MGCharge, telegraph: MGTele, bigstick: MGStick,
  conserve: MGConserve, rapids: MGRapids,
};
