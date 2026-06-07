/* ============================================================================
   audio.js  —  Tiny WebAudio engine: procedural chiptune music + SFX.
   No external files; everything is synthesized so the game stays portable.
   ========================================================================== */

const Audio2 = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  let currentTune = null;

  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }

  function resume() { ensure(); if (ctx.state === "suspended") ctx.resume(); }

  function tone(freq, dur, type = "square", vol = 0.2, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur = 0.2, vol = 0.25, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf; src.connect(g); g.connect(master);
    src.start(t);
  }

  // A tone whose pitch glides from f0 to f1 over `dur` (for meows, growls, etc.)
  function slide(f0, f1, dur, type = "sawtooth", vol = 0.2, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ---- SFX library ----
  const sfx = {
    jump:    () => tone(520, 0.14, "square", 0.18),
    land:    () => tone(180, 0.10, "triangle", 0.18),
    coin:    () => { tone(880, 0.07, "square", 0.16); tone(1320, 0.09, "square", 0.14, 0.06); },
    hit:     () => { noise(0.18, 0.3); tone(120, 0.18, "sawtooth", 0.18); },
    punch:   () => { tone(220, 0.08, "square", 0.22); noise(0.08, 0.18); },
    shoot:   () => { tone(700, 0.05, "sawtooth", 0.18); noise(0.12, 0.18); },
    success: () => { [523,659,784,1047].forEach((f,i)=>tone(f,0.16,"square",0.18,i*0.11)); },
    fail:    () => { [392,330,262].forEach((f,i)=>tone(f,0.22,"sawtooth",0.18,i*0.13)); },
    select:  () => tone(660, 0.08, "square", 0.16),
    powerup: () => { [392,494,587,784].forEach((f,i)=>tone(f,0.12,"triangle",0.18,i*0.07)); },
    paddle:  () => tone(300, 0.06, "triangle", 0.14),
    type:    () => tone(880, 0.04, "square", 0.12),
  };

  // ---- per-enemy defeat sounds (synthesized, character-appropriate) ----
  const foeSfx = {
    bully:    () => { tone(160,0.10,"square",0.22); slide(300,120,0.18,"square",0.16,0.04); },     // "oof" thud
    rival:    () => { tone(200,0.09,"square",0.2); slide(280,150,0.16,"square",0.15,0.05); },      // grunt
    bulldog:  () => { slide(280,90,0.22,"sawtooth",0.22); noise(0.12,0.18); },                      // dog yelp/woof
    alleycat: () => { slide(700,1100,0.10,"sawtooth",0.18); slide(1100,500,0.16,"sawtooth",0.16,0.10); }, // meow
    rattler:  () => { noise(0.26,0.22); tone(140,0.10,"sawtooth",0.12,0.02); },                     // rattle hiss
    tough:    () => { tone(150,0.10,"square",0.22); slide(260,110,0.2,"square",0.16,0.05); },       // big oof
    grafter:  () => { slide(440,180,0.18,"square",0.18); tone(120,0.10,"sawtooth",0.14,0.06); },    // deflating "ugh"
    wharfrat: () => { slide(900,1500,0.08,"square",0.16); slide(1500,800,0.10,"square",0.14,0.07); },// squeak
    gull:     () => { slide(1200,700,0.10,"sawtooth",0.16); slide(900,1300,0.12,"sawtooth",0.14,0.10); }, // squawk
    soldier:  () => { tone(180,0.09,"square",0.2); noise(0.14,0.2,0.04); },                          // clatter
    mosquito: () => { slide(1600,200,0.16,"sawtooth",0.16); },                                       // buzz cut-off
    boss:     () => { slide(220,80,0.26,"sawtooth",0.22); tone(70,0.14,"square",0.16,0.06); },       // pompous descend
    redtape:  () => { noise(0.22,0.22); slide(500,200,0.16,"triangle",0.12,0.02); },                 // paper crumple
    trust:    () => { [784,659,523,392].forEach((f,i)=>tone(f,0.10,"square",0.16,i*0.05));            // coins spilling
                      noise(0.18,0.14,0.05); },
    poacher:  () => { tone(170,0.09,"square",0.2); slide(300,130,0.18,"square",0.15,0.05); },        // grunt
    logger:   () => { tone(150,0.10,"square",0.2); noise(0.16,0.2,0.04); },                          // thud + timber
    piranha:  () => { slide(600,200,0.10,"sawtooth",0.18); tone(120,0.12,"sawtooth",0.14,0.06); },   // chomp/splash
    jaguar:   () => { slide(420,120,0.26,"sawtooth",0.22); noise(0.10,0.16,0.02); },                 // growl
  };
  // play an enemy's defeat sound by kind; falls back to the generic punch
  function foeDefeat(kind){
    const fn = foeSfx[kind];
    if (fn) fn(); else sfx.punch();
  }

  // ---- Music: simple looping bass+lead per mood ----
  const SCALE = { // midi-ish frequency tables
    A3:220, B3:247, C4:262, D4:294, E4:330, F4:349, G4:392,
    A4:440, B4:494, C5:523, D5:587, E5:659, G5:784, A5:880,
  };
  const TUNES = {
    heroic:  ["C4","E4","G4","C5","G4","E4","G4","E4"],
    frontier:["A3","C4","E4","A4","G4","E4","D4","C4"],
    tense:   ["A3","A3","C4","E4","D4","C4","B3","A3"],
    march:   ["G4","G4","C5","C5","E4","G4","C5","E4"],
    calm:    ["C4","E4","G4","E4","F4","A4","G4","E4"],
  };

  function playMusic(name) {
    ensure();
    if (currentTune === name) return;
    currentTune = name;
    stopMusic();
    if (!TUNES[name]) return;
    const seq = TUNES[name];
    musicStep = 0;
    musicTimer = setInterval(() => {
      if (muted) return;
      const note = seq[musicStep % seq.length];
      const f = SCALE[note] || 330;
      tone(f, 0.22, "triangle", 0.10);            // lead
      if (musicStep % 2 === 0) tone(f/2, 0.30, "square", 0.06); // bass
      musicStep++;
    }, 230);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }
  function isMuted(){ return muted; }

  return { resume, sfx, foeDefeat, playMusic, stopMusic, toggleMute, isMuted };
})();
