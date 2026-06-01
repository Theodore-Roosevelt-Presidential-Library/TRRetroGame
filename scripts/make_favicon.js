const fs=require("fs"),vm=require("vm"),path=require("path");
const {createCanvas}=require("canvas");
const GAME="/sessions/nice-gifted-euler/mnt/TRRetroGame";
function render(size){
  const cv=createCanvas(size,size); const ctx=cv.getContext("2d");
  const sb={console,Math,Date,JSON,parseInt,Set,Array,Object,String,Number};
  sb.window=sb; sb.Assets=undefined; sb.__ctx=ctx; sb.__S=size; vm.createContext(sb);
  const tiny = size<=20;
  // tiny: no rim, fill the disc with the head; larger: rim + head&shoulders
  const rim   = tiny ? 0 : Math.max(2,size*0.06);
  const feetY = tiny ? size*2.35 : size*1.78;
  const figH  = tiny ? size*2.7  : size*1.78;
  let src=fs.readFileSync(path.join(GAME,"js/sprites.js"),"utf8");
  src += `
  const S=__S, ctx=__ctx, rim=${rim};
  ctx.clearRect(0,0,S,S);
  const g=ctx.createLinearGradient(0,0,0,S); g.addColorStop(0,"#3f6f8e"); g.addColorStop(1,"#1f3a4a");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,7); ctx.fill();
  if(rim>0){ ctx.lineWidth=rim; ctx.strokeStyle="#d9b24a"; ctx.beginPath(); ctx.arc(S/2,S/2,S/2-rim/2,0,7); ctx.stroke(); }
  ctx.save(); ctx.beginPath(); ctx.arc(S/2,S/2,S/2-rim,0,7); ctx.clip();
  Art.drawTR(ctx, S*0.5, ${feetY}, ${figH}, {costume:"roughrider", age:"adult", state:"idle", t:300, face:1});
  ctx.restore();
  `;
  vm.runInContext(src,sb,{filename:"sprites.js"});
  return cv;
}
for(const s of [16,32,48,64,180,256]){
  fs.writeFileSync(path.join(GAME,"assets/favicon-"+s+".png"), render(s).toBuffer("image/png"));
}
console.log("DONE");
