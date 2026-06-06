/* ============================================================================
   touch.js  —  On-screen controls for TOUCH DEVICES ONLY.
   Builds nothing on desktop: the whole module no-ops unless the browser
   reports a coarse (touch) pointer. Buttons feed window.TRTouch, which mirrors
   the keyboard, so no game logic changes.
   ========================================================================== */

(() => {
  // Touch detection — must be coarse pointer AND have touch points.
  const isTouch =
    (("ontouchstart" in window) || (navigator.maxTouchPoints > 0)) &&
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (!isTouch) return;                       // ← desktop: do absolutely nothing

  const frame = document.getElementById("frame");
  if (!frame || typeof window.TRTouch === "undefined") {
    // TRTouch is set up in game.js; if it isn't ready yet, retry shortly.
    return void setTimeout(arguments.callee, 60);
  }
  const T = window.TRTouch;
  document.body.classList.add("is-touch");

  // ---- overlay root ----
  const ui = document.createElement("div");
  ui.id = "touch-ui";
  frame.appendChild(ui);

  /* helper: make a button that holds a key while pressed (for movement) */
  function holdBtn(label, code, cls){
    const b = document.createElement("button");
    b.className = "tbtn " + (cls||"");
    b.innerHTML = label;
    const start = e => { e.preventDefault(); b.classList.add("on"); T.down(code); };
    const end   = e => { e.preventDefault(); b.classList.remove("on"); T.up(code); };
    b.addEventListener("touchstart", start, {passive:false});
    b.addEventListener("touchend", end, {passive:false});
    b.addEventListener("touchcancel", end, {passive:false});
    b.dataset.code = code;
    return b;
  }
  /* helper: a tap button (single edge press) */
  function tapBtn(label, code, cls){
    const b = document.createElement("button");
    b.className = "tbtn " + (cls||"");
    b.innerHTML = label;
    b.addEventListener("touchstart", e => { e.preventDefault(); b.classList.add("on"); T.tap(code); }, {passive:false});
    const off = e => { e.preventDefault(); b.classList.remove("on"); };
    b.addEventListener("touchend", off, {passive:false});
    b.addEventListener("touchcancel", off, {passive:false});
    b.dataset.code = code;
    return b;
  }

  // ---- left cluster: D-pad (left / right) ----
  const dpad = document.createElement("div"); dpad.className = "tcluster tleft";
  const bL = holdBtn("◄", "ArrowLeft", "dpad");
  const bR = holdBtn("►", "ArrowRight", "dpad");
  dpad.appendChild(bL); dpad.appendChild(bR);
  ui.appendChild(dpad);

  // ---- right cluster: action buttons (relabeled per screen) ----
  const act = document.createElement("div"); act.className = "tcluster tright";
  // Primary action — Space (jump / paddle / fire / confirm). Held for movement-y games.
  const bA = holdBtn("A", "Space", "big");
  // Up — used as jump alt + menu navigation
  const bUp = holdBtn("▲", "ArrowUp", "");
  const bDn = holdBtn("▼", "ArrowDown", "");
  // Secondary (boxing K / generic) and tertiary (boxing J)
  const bK = tapBtn("K", "KeyK", "");
  const bJ = tapBtn("J", "KeyJ", "");
  act.appendChild(bUp); act.appendChild(bDn);
  act.appendChild(bJ); act.appendChild(bK); act.appendChild(bA);
  ui.appendChild(act);

  // ---- top-right utility row: menu / mute / fullscreen ----
  const util = document.createElement("div"); util.className = "tutil";
  const bMenu = tapBtn("⤺", "Escape", "util");        // back to title
  const bMute = document.createElement("button"); bMute.className="tbtn util"; bMute.innerHTML="♪";
  bMute.addEventListener("touchstart", e=>{e.preventDefault(); const m=T.toggleMute(); bMute.classList.toggle("off",m);}, {passive:false});
  const bFull = document.createElement("button"); bFull.className="tbtn util"; bFull.innerHTML="⛶";
  bFull.addEventListener("touchstart", e=>{e.preventDefault(); T.toggleFull();}, {passive:false});
  util.appendChild(bMenu); util.appendChild(bMute); util.appendChild(bFull);
  ui.appendChild(util);

  // ---- big "confirm" tap target for menus/cutscenes/recap (Enter) ----
  // Implemented as tapping the canvas area; we add a transparent layer that is
  // only active on non-playing screens.
  const tapLayer = document.createElement("div"); tapLayer.className="ttap";
  tapLayer.innerHTML = '<span>TAP</span>';
  tapLayer.addEventListener("touchstart", e => { e.preventDefault(); T.tap("Enter"); }, {passive:false});
  ui.appendChild(tapLayer);

  // ---- "Tap to Start" full-screen splash ----
  // Fullscreen can only be entered from a user gesture (browsers reject it on
  // rotate). So once the phone is in landscape, we cover the screen with a single
  // big "Tap to Start" button. Tapping it: enters fullscreen + locks landscape,
  // then begins the game — one clean gesture.
  const FS = window.TRFull || null;
  const startOverlay = document.createElement("div");
  startOverlay.className = "tstart";
  startOverlay.innerHTML =
    '<div class="tstart-card">' +
      '<div class="tstart-title">ROUGH RIDER</div>' +
      '<div class="tstart-sub">The Theodore Roosevelt Adventure</div>' +
      '<div class="tstart-btn">▶ &nbsp;Tap to Start</div>' +
      '<div class="tstart-note">Enters full screen</div>' +
    '</div>';
  let started = false;             // becomes true after the first Tap to Start
  startOverlay.addEventListener("touchstart", e => {
    e.preventDefault();
    if (FS && FS.supported && FS.supported() && !(FS.active && FS.active())) {
      FS.toggle();                 // fullscreen + landscape lock (no-op where unsupported)
    }
    started = true;
    startOverlay.classList.remove("show");
    // Drop the player onto the normal title screen (fullscreen now active), where
    // they can choose Start or Chapter Select with the on-screen controls.
  }, {passive:false});
  ui.appendChild(startOverlay);

  function isLandscape(){
    return (window.matchMedia && window.matchMedia("(orientation: landscape)").matches) ||
           (window.innerWidth > window.innerHeight);
  }
  function refreshFsBanner(){
    const supported = FS && FS.supported && FS.supported();
    const active    = FS && FS.active && FS.active();
    // Show the Tap-to-Start splash only before the player has started, while in
    // landscape (portrait already shows the rotate hint). It launches the game.
    const showStart = !started && isLandscape();
    startOverlay.classList.toggle("show", showStart);
    // corner fullscreen button: keep it only where the API is supported and the
    // player is already in the game (so they can re-enter FS if they exited)
    bFull.style.display = supported ? "" : "none";
  }

  // ---- per-screen adaptation: show only the buttons each screen needs ----
  const PLAY_STATES = new Set(["level","mg"]);
  function refresh(){
    const info = T.info();
    const playing = PLAY_STATES.has(info.state);
    const boxing  = info.state==="mg" && info.mgType==="boxing";
    const gunnery = info.state==="mg" && info.mgType==="gunnery";
    const telegraph = info.state==="mg" && info.mgType==="telegraph";
    const selecting = info.state==="select";

    // movement clusters only while playing or selecting a chapter
    dpad.style.display = (playing || selecting) ? "" : "none";
    act.style.display  = (playing || selecting) ? "" : "none";

    // up/down arrows: gunnery (aim) + chapter select; jump uses A elsewhere
    bUp.style.display = (gunnery || selecting) ? "" : "none";
    bDn.style.display = (gunnery || selecting) ? "" : "none";
    // boxing punch buttons only in the boxing match
    bJ.style.display = boxing ? "" : "none";
    bK.style.display = boxing ? "" : "none";
    // primary A button: hidden in telegraph (it's all letters) and chapter select (use TAP=Enter)
    bA.style.display = (playing && !telegraph) ? "" : "none";
    bA.innerHTML = boxing ? "DODGE✦" :
                   gunnery ? "FIRE" :
                   (info.state==="level") ? "JUMP" : "GO";

    // telegraph: build a compact letter keypad in the action cluster
    setupLetters(telegraph, info.letter);

    // the big TAP-to-continue layer: on every NON-playing screen
    tapLayer.style.display = playing ? "none" : "flex";
  }

  // --- telegraph letter pad (only while that mini-game runs) ---
  let letterPad=null;
  function setupLetters(on, current){
    if(!on){ if(letterPad){ letterPad.remove(); letterPad=null; } return; }
    if(!letterPad){
      letterPad=document.createElement("div"); letterPad.className="tletters";
      "ABCDEFGHJKLMNPRSTUVWY".split("").forEach(ch=>{
        const b=tapBtn(ch,"Key"+ch,"lk"); letterPad.appendChild(b);
      });
      ui.appendChild(letterPad);
    }
    // highlight the letter the dispatch is currently asking for
    for(const b of letterPad.children){
      b.classList.toggle("want", current && b.dataset.code==="Key"+current);
    }
  }

  // poll a few times a second to keep button layout in sync with game state
  setInterval(()=>{ refresh(); refreshFsBanner(); }, 120);
  // also react immediately to orientation / fullscreen changes
  ["orientationchange","resize","fullscreenchange","webkitfullscreenchange"].forEach(ev=>{
    window.addEventListener(ev, ()=>setTimeout(refreshFsBanner, 60));
  });
  refresh(); refreshFsBanner();
})();
