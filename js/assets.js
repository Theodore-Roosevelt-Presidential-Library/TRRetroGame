/* ============================================================================
   assets.js  —  Loads each chapter's AI/painted background (from CHAPTERS[].bg)
   with graceful fallback to the procedural scenery if an image can't load
   (e.g. opening index.html via file:// in a strict browser).
   ========================================================================== */

const Assets = (() => {
  const bg = {};        // chapterId -> Image
  const status = {};    // chapterId -> "loading" | "ok" | "fail"

  function load(){
    if (typeof CHAPTERS === "undefined") return;
    for (const ch of CHAPTERS){
      const img = new Image();
      status[ch.id] = "loading";
      img.onload  = () => { status[ch.id] = "ok"; bg[ch.id] = img; };
      img.onerror = () => { status[ch.id] = "fail"; bg[ch.id] = null; };
      img.src = "assets/bg/" + ch.bg;
      bg[ch.id] = img; // keep a ref so it isn't GC'd
    }
  }
  function getBG(id){ return status[id] === "ok" ? bg[id] : null; }
  function ready(id){ return status[id] === "ok"; }

  return { load, getBG, ready };
})();
