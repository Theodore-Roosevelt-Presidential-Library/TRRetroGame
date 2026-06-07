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

  // ---- Music: a unique pensive track per location ----
  // Note → frequency (two-and-a-bit octaves). "0" = a rest.
  const NOTE = {
    "0":0,
    G2:98, A2:110, B2:123,
    C3:131, D3:147, E3:165, F3:175, G3:196, A3:220, Bb3:233, B3:247,
    C4:262, D4:294, E4:330, F4:349, Fs4:370, G4:392, A4:440, Bb4:466, B4:494,
    C5:523, D5:587, E5:659, F5:698, G5:784, A5:880,
  };

  /* Each track:
       lead  — melody steps (looped)
       bass  — bass steps (looped; usually slower-feeling, half the notes)
       ms    — milliseconds per step (tempo; bigger = slower/more pensive)
       wave  — lead waveform; lvol — lead volume
     Themed to each chapter's place + what TR is doing there.            */
  const TRACKS = {
    // 1 — NYC boyhood: gentle, hopeful parlor melody (building the body)
    nyc:      { ms:300, wave:"triangle", lvol:0.10,
      lead:["E4","G4","C5","B4","A4","G4","E4","0","D4","E4","G4","E4","D4","C4","0","0"],
      bass:["C3","0","G3","0","A2","0","G3","0"] },
    // 2 — Harvard: bright, determined, collegiate
    harvard:  { ms:240, wave:"square", lvol:0.08,
      lead:["G4","A4","B4","C5","B4","A4","G4","E4","G4","C5","B4","G4","A4","G4","0","0"],
      bass:["C3","G3","C3","G3","D3","A3","D3","G3"] },
    // 3 — Dakota Badlands: lonesome, wide-open, grieving frontier
    badlands: { ms:360, wave:"triangle", lvol:0.11,
      lead:["A3","0","C4","D4","E4","0","D4","C4","A3","0","G3","A3","C4","0","0","0"],
      bass:["A2","0","0","E3","F3","0","0","E3"] },
    // 4 — NYPD midnight: noir, nocturnal, watchful
    midnight: { ms:300, wave:"sine", lvol:0.12,
      lead:["A3","B3","C4","B3","A3","0","E4","D4","C4","B3","A3","0","G4","0","0","0"],
      bass:["A2","0","A2","0","F3","0","E3","0"] },
    // 5 — Navy yard: stately, rolling like the sea
    navy:     { ms:300, wave:"triangle", lvol:0.10,
      lead:["D4","F4","A4","D5","A4","F4","D4","F4","C4","E4","G4","C5","G4","E4","0","0"],
      bass:["D3","0","A2","0","B2","0","A2","0"] },
    // 6 — Cuba / Kettle Hill: martial, charging, urgent
    charge:   { ms:200, wave:"square", lvol:0.10,
      lead:["G4","G4","C5","C5","E5","D5","C5","G4","A4","A4","D5","C5","B4","G4","0","0"],
      bass:["C3","C3","G3","G3","F3","F3","G3","G3"] },
    // 7 — Albany→White House: ascending, ceremonial ascent
    ascend:   { ms:260, wave:"triangle", lvol:0.10,
      lead:["C4","E4","G4","C5","E5","C5","G4","E4","D4","F4","A4","D5","C5","G4","0","0"],
      bass:["C3","G3","E3","G3","F3","C3","G3","C3"] },
    // 8 — Bully Pulpit Main Street: patriotic, march-like
    pulpit:   { ms:240, wave:"square", lvol:0.09,
      lead:["G4","C5","C5","B4","C5","D5","E5","C5","G4","A4","B4","C5","G4","E4","0","0"],
      bass:["C3","G3","C3","G3","G3","D3","G3","C3"] },
    // 9 — Yosemite conservation: serene, majestic, spacious
    wild:     { ms:380, wave:"sine", lvol:0.12,
      lead:["C4","E4","G4","A4","G4","E4","D4","0","F4","A4","C5","A4","G4","E4","0","0"],
      bass:["C3","0","F3","0","G3","0","C3","0"] },
    // 10 — Amazon River of Doubt: dark, mysterious, perilous (minor)
    doubt:    { ms:340, wave:"sine", lvol:0.12,
      lead:["A3","C4","E4","A4","G4","E4","F4","E4","D4","C4","B3","A3","E4","0","0","0"],
      bass:["A2","0","E3","0","F3","0","E3","0"] },
    // simple fallbacks (used by menus / cutscenes / results)
    calm:     { ms:320, wave:"triangle", lvol:0.10,
      lead:["C4","E4","G4","E4","F4","A4","G4","E4","D4","F4","A4","G4","E4","C4","0","0"],
      bass:["C3","0","G3","0","F3","0","G3","0"] },
  };

  function playMusic(name) {
    ensure();
    if (currentTune === name) return;
    currentTune = name;
    stopMusic();
    currentTune = name;            // (stopMusic clears it; set again)
    const tr = TRACKS[name] || TRACKS.calm;
    let step = 0;
    musicTimer = setInterval(() => {
      if (muted) return;
      const ln = tr.lead[step % tr.lead.length];
      const lf = NOTE[ln] || 0;
      if (lf) tone(lf, tr.ms/1000*0.9, tr.wave, tr.lvol);           // lead
      const bn = tr.bass[step % tr.bass.length];
      const bf = NOTE[bn] || 0;
      if (bf) tone(bf, tr.ms/1000*1.2, "square", 0.055);            // soft bass
      step++;
    }, name ? (TRACKS[name]||TRACKS.calm).ms : 300);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    currentTune = null;   // reset so a later playMusic() of the SAME tune restarts it
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  }
  function isMuted(){ return muted; }

  return { resume, sfx, foeDefeat, playMusic, stopMusic, toggleMute, isMuted };
})();
