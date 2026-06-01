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

  function noise(dur = 0.2, vol = 0.25) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf; src.connect(g); g.connect(master);
    src.start(t);
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

  return { resume, sfx, playMusic, stopMusic, toggleMute, isMuted };
})();
