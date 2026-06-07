/* ============================================================================
   assets.js  —  Loads each chapter's AI/painted background (from CHAPTERS[].bg)
   with graceful fallback to the procedural scenery if an image can't load
   (e.g. opening index.html via file:// in a strict browser).
   ========================================================================== */

const Assets = (() => {
  const bg = {};        // chapterId -> Image
  const status = {};    // chapterId -> "loading" | "ok" | "fail"
  const VER = "20260621";   // cache-buster — keep in sync with index.html ?v=

  function load(){
    if (typeof CHAPTERS === "undefined") return;
    for (const ch of CHAPTERS){
      const img = new Image();
      status[ch.id] = "loading";
      img.onload  = () => {
        // Rasterize the WebP into an offscreen canvas ONCE. Safari/WebKit
        // discards decoded image data and re-decodes a WebP on every drawImage,
        // which tanks the frame rate when the background is drawn each frame.
        // A canvas source is decoded once and blitted cheaply thereafter, so the
        // game runs full-speed in Safari (Chrome already cached the decode).
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          bg[ch.id] = c;
        } catch(e){ bg[ch.id] = img; }   // fall back to the raw image if needed
        status[ch.id] = "ok";
      };
      img.onerror = () => { status[ch.id] = "fail"; bg[ch.id] = null; };
      img.src = "assets/bg/" + ch.bg + "?v=" + VER;
      bg[ch.id] = img; // keep a ref so it isn't GC'd before onload
    }
  }
  function getBG(id){ return status[id] === "ok" ? bg[id] : null; }
  function ready(id){ return status[id] === "ok"; }

  return { load, getBG, ready };
})();
