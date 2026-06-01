/* ============================================================================
   sprites.js  —  Anime/Japanimation Theodore Roosevelt who changes AGE and
   OUTFIT per chapter, with natural walk/run cycles and clean left/right facing.
   Plus a particle system, procedural fallback scenery, and the background
   image compositor.
   ========================================================================== */

const Art = (() => {

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shade(hex, amt){
    const n=parseInt(hex.slice(1),16);
    let r=(n>>16)&255,g=(n>>8)&255,b=n&255;
    r=Math.max(0,Math.min(255,r+amt));g=Math.max(0,Math.min(255,g+amt));b=Math.max(0,Math.min(255,b+amt));
    return "#"+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  }

  /* Outfits (period-correct) + which life stage they default to. */
  const COSTUMES = {
    boy:        {coat:"#5f7d3f",pants:"#4a4030",shirt:"#f0e9d6",hat:null,         age:"child"},
    student:    {coat:"#7a2f2a",pants:"#33302c",shirt:"#f3eee0",hat:null,         age:"teen"},
    cowboy:     {coat:"#8a5e34",pants:"#3a2e22",shirt:"#e3d3a8",hat:"#9a6a3a",hatType:"brim", age:"adult"},
    cop:        {coat:"#26324c",pants:"#1c2333",shirt:"#cdd6e6",hat:"#1c2740",hatType:"helmet", age:"adult"},
    navy:       {coat:"#274761",pants:"#22384e",shirt:"#f2f2f2",hat:"#f2f2f2",hatType:"navy", age:"adult"},
    roughrider: {coat:"#9a8a5a",pants:"#3a4a66",shirt:"#d8c79a",hat:"#86714a",hatType:"campaign", bandana:true, suspenders:true, age:"adult"},
    president:  {coat:"#2f2f33",pants:"#242427",shirt:"#ffffff",hat:null,         age:"mature"},
    naturalist: {coat:"#6e6a3c",pants:"#5a5230",shirt:"#e6dcc0",hat:"#7d7038",hatType:"brim", age:"mature"},
    explorer:   {coat:"#62714e",pants:"#4a4f3a",shirt:"#dcd6bd",hat:"#7d7850",hatType:"brim", age:"elder"},
  };

  /* Life-stage proportions (anime head:body ratios). */
  const AGE = {
    child:  {legL:18, torsoH:20, torsoW:26, headR:18, eye:1.55, must:false, gray:false, stoop:0},
    teen:   {legL:30, torsoH:26, torsoW:27, headR:15, eye:1.30, must:false, gray:false, stoop:0},
    adult:  {legL:34, torsoH:31, torsoW:31, headR:14, eye:1.05, must:true,  gray:false, stoop:0},
    mature: {legL:34, torsoH:33, torsoW:34, headR:14, eye:1.00, must:true,  gray:false, stoop:0},
    elder:  {legL:32, torsoH:33, torsoW:35, headR:14, eye:0.98, must:true,  gray:true,  stoop:2},
  };

  function drawTR(ctx, x, y, s, opts = {}) {
    const costume = opts.costume || "cowboy";
    const C = COSTUMES[costume] || COSTUMES.cowboy;
    const age = opts.age || C.age || "adult";
    const a = AGE[age] || AGE.adult;
    const state = opts.state || "idle";
    const t = opts.t || 0;
    const face = opts.face || 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face, 1);          // clean left/right turn
    ctx.lineJoin = "round"; ctx.lineCap = "round";

    const totalUnits = a.legL + a.torsoH + a.headR*1.9 + 4;
    const k = s / totalUnits;
    const OL = "#2a1d12";
    const ol = Math.max(1.5, 2.0*k*(a.headR/14));

    /* ---- gait ----
       walk: moderate stride, slight bob.  run: big stride, forward lean,
       arm pump, stronger bob.  idle: gentle breathing.                       */
    const run = state === "run";
    const walk = state === "walk";
    let legA, armA, bob, lean;
    if (run){
      // smoother, less frantic stride: lower frequency, eased extremes
      const p=t*0.0185;
      const s=Math.sin(p);
      legA = s*0.92;
      armA = -s*0.85;
      // double-bounce bob (one dip per foot-plant) reads as natural running
      bob  = (Math.abs(Math.sin(p))*-3.4 - 0.6)*k;
      lean = 0.13;
    } else if (walk){
      const p=t*0.011;
      const s=Math.sin(p);
      legA = s*0.55;
      armA = -s*0.48;
      bob  = (Math.abs(Math.sin(p))*-1.8)*k;
      lean = 0.04;
    } else {
      const p=t*0.0125;
      legA = Math.sin(p)*0.05;
      armA = Math.sin(p)*0.05;
      bob  = Math.sin(p)*1.0;
      lean = 0;
    }
    const jump = state === "jump";
    if (jump){ legA=0.5; armA=-0.6; bob=-3*k; lean=0.12; }

    ctx.rotate(lean*0.0); // lean applied to torso/head below, feet stay planted

    const legL=a.legL*k, torsoH=a.torsoH*k, torsoW=a.torsoW*k, headR=a.headR*k;
    const hipY = -legL + (jump?-2*k:bob) + a.stoop*k;

    const coat=C.coat, coatSh=shade(coat,-30), coatHi=shade(coat,26);
    const pants=C.pants, pantsSh=shade(pants,-26), shirt=C.shirt;
    const skin="#f0c79a", skinSh=shade(skin,-30), skinHi=shade(skin,16);

    function orr(x0,y0,w,h,r,fill,outline=true){
      rr(ctx,x0,y0,w,h,r); ctx.fillStyle=fill; ctx.fill();
      if(outline){ ctx.strokeStyle=OL; ctx.lineWidth=ol; ctx.stroke(); }
    }

    // ground shadow (squashes a touch on run)
    ctx.save(); ctx.globalAlpha=0.22; ctx.fillStyle="#000";
    ctx.beginPath(); ctx.ellipse(0,0,torsoW*0.55*(run?0.85:1),4*k,0,0,7); ctx.fill(); ctx.restore();

    // ---- legs with bent knee on the forward swing ----
    function leg(dir, ang, front){
      ctx.save(); ctx.translate(torsoW*0.18*dir, hipY); ctx.rotate(ang);
      const upper=legL*0.55, lower=legL*0.55;
      orr(-2.7*k,0,5.4*k,upper,2.4*k, front?pants:pantsSh);
      // lower leg, slightly bent when swung forward
      ctx.save(); ctx.translate(0,upper); ctx.rotate((run?0.5:0.25)*Math.max(0,ang*dir));
      orr(-2.6*k,0,5.2*k,lower,2.2*k, front?pants:pantsSh);
      // boot
      rr(ctx,-3.6*k,lower-5*k,7.6*k,7*k,2*k); ctx.fillStyle="#2a2018"; ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=ol; ctx.stroke();
      ctx.restore(); ctx.restore();
    }
    leg(-1,-legA,false);   // back leg first

    // torso (leans forward on the move)
    ctx.save();
    ctx.translate(0,hipY); ctx.rotate(-lean*face*0 + lean); ctx.translate(0,-hipY);
    const torsoTop=hipY-torsoH;
    orr(-torsoW/2,torsoTop,torsoW,torsoH,torsoW*0.26,coat);
    ctx.save(); rr(ctx,-torsoW/2,torsoTop,torsoW,torsoH,torsoW*0.26); ctx.clip();
    ctx.fillStyle=coatSh; ctx.fillRect(-torsoW/2,torsoTop,torsoW*0.40,torsoH);
    ctx.fillStyle=coatHi; ctx.fillRect(torsoW*0.30,torsoTop,torsoW*0.20,torsoH);
    ctx.restore();
    // shirt placket + tie
    ctx.fillStyle=shirt; rr(ctx,-torsoW*0.17,torsoTop+2*k,torsoW*0.34,torsoH*0.82,3*k); ctx.fill();
    ctx.strokeStyle=OL; ctx.lineWidth=ol*0.7; ctx.stroke();
    if(C.suspenders){
      // cavalry suspenders over a fatigue blouse + a couple of pocket flaps
      ctx.strokeStyle="#5a4a2c"; ctx.lineWidth=ol*0.9;
      ctx.beginPath(); ctx.moveTo(-torsoW*0.18,torsoTop+2*k); ctx.lineTo(-torsoW*0.10,torsoTop+torsoH*0.9);
      ctx.moveTo(torsoW*0.18,torsoTop+2*k); ctx.lineTo(torsoW*0.10,torsoTop+torsoH*0.9); ctx.stroke();
      ctx.fillStyle=shade(coat,-16);                                  // breast pocket flaps
      rr(ctx,-torsoW*0.30,torsoTop+torsoH*0.30,torsoW*0.20,torsoH*0.16,2*k); ctx.fill();
      rr(ctx, torsoW*0.10,torsoTop+torsoH*0.30,torsoW*0.20,torsoH*0.16,2*k); ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=ol*0.6;
      ctx.strokeRect(-torsoW*0.30,torsoTop+torsoH*0.30,torsoW*0.20,torsoH*0.16);
      ctx.strokeRect( torsoW*0.10,torsoTop+torsoH*0.30,torsoW*0.20,torsoH*0.16);
    } else {
      ctx.fillStyle = costume==="president" ? "#b03030" : (costume==="navy"?"#1d3247":"#3a2e22");
      rr(ctx,-1.6*k,torsoTop+3*k,3.2*k,torsoH*0.62,1.4*k); ctx.fill();
    }

    // back arm
    arm(-1,-armA,false);

    // ---- head ----
    const headCY=torsoTop-headR*0.92;
    drawHead(headCY);

    // front arm (after head so a raised hand reads in front)
    arm(1,armA,true);
    ctx.restore(); // torso lean

    leg(1,legA,true);   // front leg last (over torso base)

    ctx.restore();

    // ----- nested helpers -----
    function arm(dir,ang,front){
      ctx.save(); ctx.translate(torsoW*0.46*dir,torsoTop+torsoH*0.18);
      let rot=ang*dir;
      if(state==="punch"&&dir===1)rot=-1.4;
      if(state==="paddle")rot=dir===1?-0.7:0.6;
      if(state==="swing")rot=dir===1?-2.2:0.3;
      if(state==="hat"&&dir===1)rot=-2.45;
      ctx.rotate(rot);
      const col = front?coat:coatSh;
      orr(-2.4*k,0,4.8*k,torsoH*0.46,2.3*k,col);          // upper arm (sleeve)
      ctx.save(); ctx.translate(0,torsoH*0.44); ctx.rotate(run?0.4:0.18);
      orr(-2.3*k,0,4.6*k,torsoH*0.34,2.2*k,col);          // forearm
      ctx.beginPath(); ctx.arc(0,torsoH*0.40,3.0*k,0,7); ctx.fillStyle=skin; ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=ol*0.7; ctx.stroke();
      ctx.restore(); ctx.restore();
    }

    function drawHead(cy){
      function facePath(){
        ctx.beginPath();
        ctx.moveTo(-headR, cy-headR*0.12);
        ctx.quadraticCurveTo(-headR, cy-headR, 0, cy-headR);
        ctx.quadraticCurveTo(headR, cy-headR, headR, cy-headR*0.12);
        ctx.quadraticCurveTo(headR, cy+headR*0.55, headR*0.34, cy+headR);
        ctx.quadraticCurveTo(0, cy+headR*1.06, -headR*0.34, cy+headR);  // chin
        ctx.quadraticCurveTo(-headR, cy+headR*0.55, -headR, cy-headR*0.12);
        ctx.closePath();
      }
      facePath(); ctx.fillStyle=skin; ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=ol; ctx.stroke();
      ctx.save(); facePath(); ctx.clip();
      ctx.fillStyle=skinSh; ctx.fillRect(-headR,cy-headR,headR*0.42,headR*2);   // left shade
      ctx.fillStyle=skinHi; ctx.fillRect(headR*0.62,cy-headR,headR*0.5,headR*2); // right rim
      ctx.restore();
      // ear (back side)
      ctx.beginPath(); ctx.arc(-headR*0.92,cy+headR*0.06,headR*0.16,0,7); ctx.fillStyle=skin; ctx.fill();
      ctx.strokeStyle=OL; ctx.lineWidth=ol*0.6; ctx.stroke();

      // eyes (facing slightly toward camera-forward / +x)
      const eyeY=cy+headR*0.05, eyeR=headR*0.26*a.eye;
      const e1=headR*0.12, e2=headR*0.6;
      function eye(ex){
        ctx.beginPath(); ctx.ellipse(ex,eyeY,eyeR*0.9,eyeR*1.2,0,0,7); ctx.fillStyle="#fff"; ctx.fill();
        ctx.strokeStyle=OL; ctx.lineWidth=ol*0.6; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex+eyeR*0.12,eyeY+eyeR*0.16,eyeR*0.55,eyeR*0.92,0,0,7); ctx.fillStyle="#3a6ea5"; ctx.fill();
        ctx.beginPath(); ctx.ellipse(ex+eyeR*0.12,eyeY+eyeR*0.22,eyeR*0.28,eyeR*0.5,0,0,7); ctx.fillStyle="#15233a"; ctx.fill();
        ctx.beginPath(); ctx.arc(ex-eyeR*0.2,eyeY-eyeR*0.3,eyeR*0.26,0,7); ctx.fillStyle="#fff"; ctx.fill();
      }
      eye(e1); eye(e2);
      // determined brows
      ctx.strokeStyle=OL; ctx.lineWidth=ol;
      ctx.beginPath(); ctx.moveTo(e1-eyeR,eyeY-eyeR*1.4); ctx.lineTo(e1+eyeR*0.7,eyeY-eyeR*1.65); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(e2-eyeR*0.7,eyeY-eyeR*1.65); ctx.lineTo(e2+eyeR,eyeY-eyeR*1.4); ctx.stroke();
      // nose
      ctx.strokeStyle=skinSh; ctx.lineWidth=ol*0.7;
      ctx.beginPath(); ctx.moveTo(headR*0.42,eyeY+eyeR*0.7); ctx.lineTo(headR*0.56,eyeY+eyeR*1.15); ctx.stroke();

      // mouth / mustache
      const mY=cy+headR*0.56;
      if(a.must){
        ctx.fillStyle=a.gray?"#9a8d80":"#6a4a2c";
        ctx.beginPath();
        ctx.moveTo(-headR*0.5,mY-headR*0.03);
        ctx.quadraticCurveTo(headR*0.05,mY-headR*0.22,headR*0.6,mY-headR*0.03);
        ctx.quadraticCurveTo(headR*0.3,mY+headR*0.14,headR*0.05,mY+headR*0.03);
        ctx.quadraticCurveTo(-headR*0.25,mY+headR*0.14,-headR*0.5,mY-headR*0.03);
        ctx.fill();
      } else {
        ctx.strokeStyle=OL; ctx.lineWidth=ol*0.8;
        ctx.beginPath(); ctx.moveTo(-headR*0.18,mY); ctx.quadraticCurveTo(headR*0.1,mY+headR*0.14,headR*0.4,mY); ctx.stroke();
      }

      // pince-nez (not for youngest child)
      if(age!=="child"){
        ctx.strokeStyle="#20242a"; ctx.lineWidth=Math.max(1.3,1.5*k);
        ctx.beginPath(); ctx.arc(e1,eyeY,eyeR*1.25,0,7); ctx.stroke();
        ctx.beginPath(); ctx.arc(e2,eyeY,eyeR*1.25,0,7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e1+eyeR*1.25,eyeY); ctx.lineTo(e2-eyeR*1.25,eyeY); ctx.stroke();
      }

      // ---- hair (side-parted sweep, NOT a crown) ----
      if(!(C.hat && (C.hatType==="helmet" || C.hatType==="navy"))){
        const hairCol = a.gray ? "#9a8f80" : (age==="child" ? "#c79a44" : "#6e4a2c");
        ctx.fillStyle=hairCol; ctx.strokeStyle=OL; ctx.lineWidth=ol;
        ctx.beginPath();
        ctx.moveTo(-headR*1.02, eyeY-eyeR*0.4);
        // crown — single smooth dome with a side-swept bang, no zigzag spikes
        ctx.quadraticCurveTo(-headR*1.12, cy-headR*1.18, -headR*0.2, cy-headR*1.16);
        ctx.quadraticCurveTo(headR*0.55, cy-headR*1.14, headR*1.04, cy-headR*0.72);
        ctx.lineTo(headR*1.02, eyeY-eyeR*0.5);
        // bang sweeping across the brow (side part on the right)
        ctx.quadraticCurveTo(headR*0.5, cy-headR*0.5, headR*0.05, cy-headR*0.62);
        ctx.quadraticCurveTo(-headR*0.5, cy-headR*0.72, -headR*1.02, cy-headR*0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if(a.gray){
          ctx.save(); ctx.globalAlpha=0.5; ctx.fillStyle="#e6e0d6";
          ctx.fillRect(-headR*1.0, eyeY-eyeR*0.7, headR*0.26, eyeR*1.3);
          ctx.fillRect(headR*0.74, eyeY-eyeR*0.7, headR*0.26, eyeR*1.3); ctx.restore();
        }
      }

      // ---- hat (fully covers the scalp) ----
      if(C.hat){
        ctx.strokeStyle=OL; ctx.lineWidth=ol;
        const hy=cy-headR*0.86;
        if(C.hatType==="navy"){
          rr(ctx,-headR*1.0,hy,headR*2.0,headR*0.5,headR*0.18); ctx.fillStyle=C.hat; ctx.fill(); ctx.stroke();
          rr(ctx,-headR*0.55,hy-headR*0.4,headR*1.1,headR*0.46,headR*0.14); ctx.fillStyle="#274761"; ctx.fill(); ctx.stroke();
          ctx.fillStyle="#d9b24a"; ctx.beginPath(); ctx.arc(0,hy-headR*0.16,headR*0.12,0,7); ctx.fill();
        } else if(C.hatType==="helmet"){
          rr(ctx,-headR*0.96,hy-headR*0.34,headR*1.92,headR*0.92,headR*0.62); ctx.fillStyle=C.hat; ctx.fill(); ctx.stroke();
          rr(ctx,-headR*1.04,hy+headR*0.42,headR*2.08,headR*0.26,headR*0.1); ctx.fillStyle=shade(C.hat,-20); ctx.fill();
          ctx.fillStyle="#d9a441"; ctx.beginPath(); ctx.arc(0,hy,headR*0.16,0,7); ctx.fill();  // shield
        } else { // brim — campaign / cowboy / explorer / naturalist
          ctx.beginPath(); ctx.ellipse(headR*0.05,hy+headR*0.18,headR*1.55,headR*0.42,0,0,7);
          ctx.fillStyle=shade(C.hat,-26); ctx.fill(); ctx.stroke();                          // brim
          rr(ctx,-headR*0.86,hy-headR*0.74,headR*1.72,headR*0.95,headR*0.22); ctx.fillStyle=C.hat; ctx.fill(); ctx.stroke(); // crown
          rr(ctx,-headR*0.86,hy+headR*0.02,headR*1.72,headR*0.2,headR*0.08); ctx.fillStyle=shade(C.hat,-26); ctx.fill();     // band
        }
      }
    }
  }

  /* ---------------- Particle system ---------------- */
  class Particles {
    constructor(){ this.list=[]; }
    spawn(x,y,opts={}){
      const n=opts.n||1;
      for(let i=0;i<n;i++){
        this.list.push({ x,y,
          vx:(opts.vx??(Math.random()*2-1))*(opts.spread||1),
          vy:(opts.vy??(-Math.random()*2))*(opts.spread||1),
          g:opts.g??0.05, life:opts.life??40, max:opts.life??40,
          size:opts.size??3, color:opts.color||"#fff", shape:opts.shape||"circle" });
      }
    }
    update(){ for(const p of this.list){ p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.life--; }
      this.list=this.list.filter(p=>p.life>0); }
    draw(ctx){ for(const p of this.list){ ctx.save(); ctx.globalAlpha=Math.max(0,p.life/p.max);
      ctx.fillStyle=p.color;
      if(p.shape==="rect"){ ctx.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size); }
      else { ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,7); ctx.fill(); } ctx.restore(); } }
  }

  /* ---------------- Procedural fallback scenery ---------------- */
  function genericScene(ctx,W,H,cam,pal,t,kind){
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,pal.sky1||"#9ec9e2"); g.addColorStop(1,pal.sky2||"#6b86a0");
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    if(kind==="nightcity"){
      ctx.fillStyle="#fff";
      for(let i=0;i<60;i++){ const x=((i*97-cam*0.1)%W+W)%W, y=(i*53)%(H*0.5);
        ctx.globalAlpha=0.4+0.5*Math.abs(Math.sin(i)); ctx.fillRect(x,y,2,2); }
      ctx.globalAlpha=1;
    } else {
      ctx.fillStyle="rgba(255,250,220,.85)"; ctx.beginPath();
      ctx.arc(kind==="campus"||kind==="capitol"?W*0.22:W*0.8, H*0.2, 30, 0, 7); ctx.fill();
    }
    const far=pal.far||shade(pal.ground||"#556070",46);
    ctx.fillStyle=far; ctx.beginPath(); ctx.moveTo(0,H);
    for(let x=0;x<=W;x+=14){ const y=H*0.5+Math.sin((x+cam*0.3)*0.006)*26+Math.sin((x+cam*0.3)*0.013)*12; ctx.lineTo(x,y); }
    ctx.lineTo(W,H); ctx.closePath(); ctx.fill();
    const gy=H*0.7; const gg=ctx.createLinearGradient(0,gy,0,H);
    gg.addColorStop(0,pal.ground||"#5a4a30"); gg.addColorStop(1,"#0c0a08");
    ctx.fillStyle=gg; ctx.fillRect(0,gy,W,H-gy);
    ctx.fillStyle=pal.accent||"#8a5a2b"; ctx.fillRect(0,gy,W,6);
  }
  const SCENE_KEYS=["city1870","campus","badlands","nightcity","harbor","cubahill","capitol","wilderness","amazon"];
  const scenery={};
  for(const key of SCENE_KEYS){ scenery[key]=(ctx,W,H,cam,pal,t)=>genericScene(ctx,W,H,cam,pal,t,key); }

  /* ---------------- Background compositor ---------------- */
  function drawBackground(ctx, chId, sceneryKey, W, H, cam, pal, t){
    const img = (typeof Assets !== "undefined") ? Assets.getBG(chId) : null;
    if (img){
      const iw=img.width, ih=img.height;
      const scale=Math.max(W/iw, H/ih);
      const dw=iw*scale, dh=ih*scale;
      const pan=(cam*0.25) % Math.max(1,(dw-W));
      ctx.drawImage(img, -pan, H-dh, dw, dh);
      const g=ctx.createLinearGradient(0,0,0,H);
      g.addColorStop(0,"rgba(255,255,255,0.05)");
      g.addColorStop(0.5,"rgba(0,0,0,0)");
      g.addColorStop(1,"rgba(0,0,0,0.16)");
      ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
      return true;
    }
    if (scenery[sceneryKey]) scenery[sceneryKey](ctx,W,H,cam,pal,t);
    else { ctx.fillStyle=pal.sky2||"#222"; ctx.fillRect(0,0,W,H); }
    return false;
  }

  return { drawTR, Particles, scenery, rr, shade, drawBackground };
})();
