# Rough Rider — The Theodore Roosevelt Adventure

A web-based, Nintendo-style game that tells the **entire life of Theodore
Roosevelt** (1858–1919) across **10 chapters**. Each chapter is a Mario/Zelda-style
2D platformer played over an AI-rendered painted backdrop, ends in its own
**mini-game**, and then pauses on a **learning recap** of the history you found.

Built for the **Theodore Roosevelt Presidential Library**. All historical content
is drawn from the Library's `Book_Text` collection, with dates and quotations
verified against the source texts. The game is family-friendly and intended for
education and fun.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Controls](#controls)
3. [How the game is structured](#how-the-game-is-structured)
4. [The 10 chapters](#the-10-chapters)
5. [Fact achievements by level](#fact-achievements-by-level)
6. [Enemies by level](#enemies-by-level)
7. [Graphics & audio](#graphics--audio)
8. [Project layout](#project-layout)
9. [Code architecture](#code-architecture)
10. [Working on the game](#working-on-the-game)
11. [Backgrounds & regenerating art](#backgrounds--regenerating-art)
12. [Historical sourcing](#historical-sourcing)
13. [Known limitations & ideas](#known-limitations--ideas)

---

## Quick start

No installation, build step, or internet connection is required.

1. Open the project folder and **double-click `index.html`** — it runs in any
   modern browser (Chrome, Edge, Safari, Firefox).
2. **Click the game canvas once** so it can capture the keyboard and start audio
   (browsers block sound until the first interaction).
3. Press **ENTER** to begin. Press **C** at the title screen for Chapter Select.

> Tip: press **F** for fullscreen and **M** to mute/unmute at any time.

If you prefer to serve it over `http://` (some browsers are stricter about
loading images from `file://`), any static server works, e.g. from the project
folder: `python3 -m http.server` then open `http://localhost:8000`. The game also
runs fine straight from `file://` — if a background image is ever blocked, it
falls back to procedurally drawn scenery automatically.

---

## Controls

**Title / menus**

| Key | Action |
|-----|--------|
| `ENTER` | Start / confirm |
| `C` | Open Chapter Select (from the title) |
| `← → ↑ ↓` | Move the selection in Chapter Select |
| `ESC` | Back to title |
| `F` | Toggle fullscreen |
| `M` | Toggle mute |
| `↑ ↑ ↓ ↓ ← → ← → B A` | **Hidden:** reset all saved progress (see below) |

**Platformer levels**

| Key | Action |
|-----|--------|
| `← / →` | Run left / right |
| `SPACE` or `↑` | Jump — press **twice** for a **double-jump** |
| (land on a foe) | Stomp it to defeat it |
| `ESC` | Return to the title |

Each mini-game shows its own controls on an intro card **and** along the bottom
of the screen while you play. The per-game keys are listed in
[The 10 chapters](#the-10-chapters).

**On a phone or tablet (touch)**

On touch devices the game shows on-screen controls automatically. The left-hand
D-pad adapts to each game: for run-only stages it's a tight **◄ ►** pair (the two
buttons sit right next to each other for easy thumbing); for top-down/aiming
games — the **NYPD Midnight Ramble** (move up/down) and **Naval Gunnery** (aim) —
it becomes a full **▲▼◄►** cross. The large action button at bottom-right is
labelled for the moment (**JUMP / FIRE / DODGE / LIGHT / GO**), the boxing match
adds **J/K** punch buttons, and the telegraph race shows an on-screen letter
keypad. Small **back / mute / fullscreen** buttons sit at top-right.

The **title screen** shows **▶ Start** and **≡ Chapters** buttons. On **Chapter
Select you simply tap the chapter card you want** to start it (the d-pad + ENTER
still work too). On cutscenes, mini-game intros, and the recap/result screens, just
**tap the screen** to continue. The game is 16:9, so it prompts you to rotate to
**landscape** in portrait. These controls are rendered **only on touch devices** —
desktop is unchanged and shows nothing extra. On touch, the on-canvas keyboard
cues ("Press ENTER…", "Press S to skip", the controls strip) are hidden or
rephrased to "Tap…", so the screen relies on the buttons and tap-to-continue.

**Full screen on mobile.** Browsers only allow fullscreen from a tap (it can't be
triggered automatically on rotate). So on a phone you get a clean start flow:
hold the device in **portrait** and you see a "rotate to landscape" hint; rotate to
**landscape** and a full-screen **"Tap to Start"** splash appears. One tap enters
fullscreen, locks the orientation to landscape, and drops you on the title screen.
The fullscreen code tries every vendor prefix and falls back to the document
element for broad support.

**iOS Safari** has no Fullscreen API and keeps its toolbars on screen, and `100vh`
there counts the area *behind* those bars — which previously pushed the 16:9
playfield off-screen. The game now measures the **actually visible** viewport via
`window.visualViewport` (published as CSS `--vw`/`--vh`, with `svh`/`dvh`
fallbacks) and fits a **letterboxed 16:9 box** inside it, so it's fully usable even
with the Safari toolbars visible — nothing is cropped. For a genuinely chromeless
experience the splash invites iPhone users to **Share → Add to Home Screen**; the
page ships the Apple web-app meta tags so it then launches full-screen from the
icon (and detects that standalone mode at runtime).

---

## How the game is structured

A full chapter plays out as a short loop of five screens:

1. **Cutscene** — a portrait of TR at the right age, a paragraph of biography,
   plus a **YOUR OBJECTIVE** block and a **WATCH OUT FOR** block naming that
   chapter's enemies.
2. **Platformer level** — run and jump across ground and floating platforms,
   leap over pits, stomp era-appropriate foes, collect **◉ coins**, and open
   glowing **★ treasure chests** (each reveals one real TR fact). Reach the flag.
   You have 3 hearts.
3. **Mini-game intro card** — the goal and the exact keys to press.
4. **Mini-game** — a unique skill challenge themed to the chapter.
5. **Learning recap** — after you win, the game **pauses** on a study screen
   listing everything Theodore did in that period, marking which history
   treasures you **collected (✓)** and which you **missed (✗)**. Press `ENTER`
   when you're ready to continue.

After the final chapter the game closes on a legacy screen featuring TR's
verbatim **"Man in the Arena"** passage.

---

## The 10 chapters

| # | Years | Chapter | Mini-game | Mini-game keys |
|---|-------|---------|-----------|----------------|
| 1 | 1858–1876 | A Sickly Boy in New York | **Make Your Body** (rhythm lifting) | `SPACE` in time with the ring |
| 2 | 1876–1882 | Harvard & the Boxing Ring | **Harvard Boxing Match** | `← →` bob/dodge · `J` jab · `K` cross |
| 3 | 1884–1886 | Into the Dakota Badlands | **Catch the Boat Thieves** (river chase) | `← →` steer into their wake · hold `SPACE` to paddle |
| 4 | 1895–1897 | Cleaning Up the NYPD | **The Midnight Ramble** | arrows move · `SPACE` lantern |
| 5 | 1897–1898 | Assistant Secretary of the Navy | **Naval Gunnery Drill** | `↑ ↓` aim · `SPACE` fire |
| 6 | 1898 | The Rough Riders | **Charge Up Kettle Hill** | `SPACE`/`↑` jump (double-jump) |
| 7 | 1898–1901 | Governor to the White House | **The Telegraph Race** | press the shown **letter keys** |
| 8 | 1901–1909 | The Bully Pulpit | **Big Stick: Bust the Trusts** | `← →` lane · `SPACE` swing |
| 9 | 1903–1909 | Conservation & Yosemite | **Protect the Wild** | `← →` move · `SPACE` ward off threat |
| 10 | 1909–1914 | Safari, the Amazon & the Last Fight | **The River of Doubt** | `← →` steer · `SPACE` paddle hard |

TR visibly **ages and changes costume** through these chapters: a big-headed boy
→ a Harvard student → a Dakota cowboy → a police commissioner → a naval officer
→ a Rough Rider → the President → a Yosemite naturalist → an aged Amazon explorer.

---

## Fact achievements by level

Each chapter hides **four ★ history treasures** in its platformer level. Opening
one pops a "HISTORY UNLOCKED" card with a real fact from Theodore Roosevelt's
life, and the end-of-level recap screen tallies which you found (✓) and which you
missed (✗). The facts are listed below in the order they appear (chronologically
within each chapter).

### Chapter 1 — A Sickly Boy in New York (1858–1876)
1. Born in NYC, October 27, 1858
2. Suffered severe childhood asthma
3. Bullied on a stagecoach at age 13
4. Took up boxing & weightlifting to grow strong

### Chapter 2 — Harvard & the Boxing Ring (1876–1882)
1. Entered Harvard in 1876
2. Boxed in the lightweight division
3. Married Alice Hathaway Lee, 1880
4. Elected to the NY Assembly at 23, 1881

### Chapter 3 — Into the Dakota Badlands (1884–1886)
1. Lost his wife & mother, Feb 14, 1884
2. Ranched the Elkhorn in Dakota Territory
3. Faced down the "Four Eyes" saloon bully
4. Captured boat thieves on the river, 1886

### Chapter 4 — Cleaning Up the NYPD (1895–1897)
1. Named Police Commissioner, 1895
2. Walked "midnight rambles" after dark
3. Caught officers shirking their duty
4. Broke Tammany bribery & graft

### Chapter 5 — Assistant Secretary of the Navy (1897–1898)
1. Assistant Secretary of the Navy, 1897
2. Drilled the fleet to readiness
3. "Speak softly and carry a big stick"
4. Resigned to enlist for Cuba

### Chapter 6 — The Rough Riders (1898)
1. Raised the volunteer Rough Riders
2. Sailed to Cuba, June 1898
3. Charged Kettle Hill, July 1, 1898
4. Came home a national hero

### Chapter 7 — Governor to the White House (1898–1901)
1. Elected Governor of New York, 1898
2. Elected Vice President, 1900
3. McKinley assassinated, September 1901
4. Became President at 42 — the youngest ever

### Chapter 8 — The Bully Pulpit (1901–1909)
1. Took office as President, 1901
2. Busted the Northern Securities trust, 1902
3. Settled the coal strike — a "Square Deal"
4. Won the Nobel Peace Prize, 1906

### Chapter 9 — Conservation & Yosemite (1903–1909)
1. Camped Yosemite with John Muir, 1903
2. Created 5 national parks
3. Signed the Antiquities Act, 1906
4. Protected ~230 million acres of land

### Chapter 10 — Safari, the Amazon & the Last Fight (1909–1914)
1. African safari for the Smithsonian, 1909
2. Ran as "Bull Moose" — shot in 1912, finished his speech
3. Mapped Brazil's River of Doubt, 1913–14
4. His last great adventure, dared to the end

> All 40 facts are also defined in `js/data.js` (each chapter's `facts[]` array),
> so editing them there updates both the in-game treasures and this list's source.

---

## Enemies by level

Every chapter's foes are matched to its time and place (researched from the source
texts) and drawn as detailed, cel-shaded sprites. Each level has a **primary**
enemy and a **secondary** enemy; in play, roughly every third foe is the secondary
type. Stomp a foe from above (Mario-style) to defeat it; touching one from the side
costs a heart. In **Conservation**, the "wildlife" are friendly — see the note.

| # | Chapter | Primary enemy | Secondary enemy | Why these foes |
|---|---------|---------------|-----------------|----------------|
| 1 | A Sickly Boy in New York | **Bully** — a bigger boy in a flat cap with fists up | **Alley cat** — a stray of the 1860s streets | TR was manhandled by bullies on a stagecoach at 13, the spark that made him build his body |
| 2 | Harvard & the Boxing Ring | **Yale rival** — a rival boxer in a dark turtleneck | **Bulldog** — the rival school's mascot | His college years were defined by competitive boxing and athletic rivalry |
| 3 | Into the Dakota Badlands | **Rattlesnake** — a coiled prairie rattler | **Saloon tough** — the brute who jeered "Four Eyes" | The Badlands frontier and the famous saloon confrontation |
| 4 | Cleaning Up the NYPD | **Grafter** — a corrupt Tammany man with a bribe | **Alley cat** — the strays of the midnight beat | His war on police corruption and Tammany Hall graft |
| 5 | Assistant Secretary of the Navy | **Wharf rat** — a dockside rat | **Gull** — a screeching harbor gull (flies) | Set around the Navy yard and harbor |
| 6 | The Rough Riders | **Spanish soldier** — a kepi-wearing rifleman | **Mosquito** — a yellow-fever carrier (flies) | The Cuban campaign, where disease killed more men than battle |
| 7 | Governor to the White House | **Machine boss** — a fat-cat in a top hat with a cigar | **Red tape** — a bundle of bureaucratic paperwork | His climb through machine politics and government bureaucracy |
| 8 | The Bully Pulpit | **Trust** — a monopoly money-bag in a top hat | **Machine boss** — the political fixer who shields them | His trust-busting fight against monopolies |
| 9 | Conservation & Yosemite | **Poacher** — a rifle-toting hunter | **Logger** — a lumberjack with an axe | The threats to the wild lands and wildlife he set out to protect |
| 10 | Safari, the Amazon & the Last Fight | **Piranha** — a leaping river fish (flies/jumps) | **Jaguar** — a crouching jungle cat | The deadly wildlife of the River of Doubt expedition |

**Flyers** (gull, mosquito, piranha) hover and bob at head height instead of
walking the ground. In **Chapter 9 (Conservation)** the level's poachers and
loggers are the enemies, but its *mini-game* also features **deer and bears** you
must **spare** (marked with a ♥) — scaring the wildlife counts against you.

> Enemy keys live in `js/data.js` as each chapter's `enemy` / `enemy2` fields, and
> the matching sprite art is the big `switch (kind)` in `drawFoe` (`js/game.js`).
> To change a foe, point the data key at a different sprite case.

---

## Graphics & audio

**Backgrounds** are AI-rendered painted scene images (`assets/bg/*.webp`, 1365×768)
loaded at startup and panned with parallax. They're saved as **web-optimized WebP**
(~120 KB each, ~1.5 MB total instead of ~19 MB of PNG) so they load quickly with no
visible quality loss. If an image fails to load, the engine falls back to
procedurally drawn scenery so the game always runs.

**Characters and sprites** are drawn entirely in code on an HTML5 canvas in an
**anime / Japanimation** style — large expressive eyes, clean dark outlines,
two-tone cel shading, and a rim light. Roosevelt has distinct **walk** and **run**
animation cycles (bent knees, arm pump, forward lean) and turns cleanly to face
left or right. Mini-game props (battleships, the deck gun, cannon shells, bullets,
boulders, ice floes, money-bag trusts, telegraph key, wildlife, etc.) are drawn to
the same detailed, shaded standard.

**Audio** is fully synthesized at runtime with the Web Audio API — there are no
audio files. Each chapter has its own pensive, looping chiptune track themed to its
location and goal: a hopeful NYC boyhood theme, a bright Harvard tune, a lonesome
Badlands melody, a noir NYPD-night theme, a stately Navy march, a martial San Juan
charge, a ceremonial rise-to-the-presidency theme, a patriotic Bully Pulpit march,
a serene Yosemite wilderness theme, and a dark minor-key Amazon theme (each with its
own melody, bass line, tempo, and waveform). Sound effects (jump, coin, hit, punch,
cannon, success, fail) and per-enemy defeat sounds are generated on the fly.
Everything is portable: copy the folder and it works.

---

## Project layout

```
TRRetroGame/
├── index.html              ← open this to play
├── README.md               ← this file
├── css/
│   └── style.css           ← page frame, canvas sizing, fullscreen styling
├── assets/
│   ├── favicon.ico / favicon-*.png        ← site icon: the TR sprite in a medallion
│   └── bg/
│       ├── ch1_nyc.webp … ch9_amazon.webp ← 9 chapter backdrops (web-optimized)
│       ├── ch_town.webp                   ← Bully Pulpit Main Street backdrop
│       └── GEMINI_PROMPTS.md              ← prompts to regenerate any backdrop
├── scripts/
│   └── make_favicon.js     ← regenerates the favicons from the TR sprite (needs node-canvas)
└── js/
    ├── data.js             ← all 10 chapters: text, dates, facts, costumes,
    │                          ages, enemies, objectives, mini-game configs, quotes
    ├── assets.js           ← background-image loader with graceful fallback
    ├── audio.js            ← Web Audio synth: music themes + SFX
    ├── sprites.js          ← anime TR (ages/outfits, walk/run) + scenery +
    │                          the background compositor (Art.*)
    ├── minigames.js        ← the 10 mini-game classes + shared detailed props
    ├── game.js             ← engine: loop, input, state machine, platformer
    │                          levels, enemy sprites, HUD, menus, recap screen
    └── touch.js            ← touch-only on-screen controls (no-ops on desktop)
```

Scripts load in this order from `index.html`:
`data.js → assets.js → audio.js → sprites.js → minigames.js → game.js → touch.js`.

---

## Code architecture

The game is plain ES (no framework, no bundler). Each file owns one concern.

### `data.js` — content
Exports two globals: `TR_QUOTES` and `CHAPTERS` (an array of 10 chapter objects).
Each chapter carries:

- `id`, `years`, `title`, `subtitle`, `place`, `blurb`
- `bg` — background filename in `assets/bg/`
- `scenery` — procedural fallback key (used only if the image fails to load)
- `age` — life stage: `child | teen | adult | mature | elder`
- `costume` — outfit key (see `sprites.js` `COSTUMES`)
- `enemy` / `enemy2` — era-correct foe keys (see `drawFoe` in `game.js`)
- `foes` / `objective` — the text shown on the cutscene intro
- `facts[]` — four chronological facts, surfaced as collectible ★ treasures
- `minigame` — `{ type, name, goal, controls, win }`

To tune content you usually only edit this file.

### `sprites.js` — `Art.*`
A self-contained module exposing:

- `Art.drawTR(ctx, x, y, height, opts)` — draws Roosevelt. `opts` includes
  `costume`, `age`, `state` (`idle | walk | run | jump | punch | paddle | swing |
  hat`), `t` (animation clock), and `face` (`1` right / `-1` left). `COSTUMES`
  and `AGE` tables drive proportions, outfit colors, hats, and features
  (mustache, gray hair, pince-nez).
- `Art.Particles` — a tiny particle system used for coins, hits, sparks.
- `Art.scenery` — procedural fallback painters keyed by `scenery`.
- `Art.drawBackground(ctx, chId, sceneryKey, W, H, cam, pal, t)` — draws the AI
  PNG with a parallax pan, or the procedural fallback if it isn't loaded.
- helpers: `Art.rr` (rounded rect), `Art.shade` (lighten/darken a hex color).

### `minigames.js` — the challenges
Ten classes (`MGBody`, `MGBox`, `MGRiver`, `MGPatrol`, `MGGun`, `MGCharge`,
`MGTele`, `MGStick`, `MGConserve`, `MGRapids`) registered in the `MINIGAMES` map
by `type`. Each implements the same contract:

```js
class MGExample {
  constructor(env) { /* env = { W, H, particles, rng } */ this.status = "play"; }
  update(input)    { /* input.down(code), input.pressed(code); set this.status */ }
  draw(ctx, t)     { /* render the whole screen */ }
}
// status transitions to "won" or "lost"; this.progress (0..1) feeds the HUD bar.
```

This file also defines shared **detailed prop painters** reused across games:
`pBattleship`, `pDeckGun`, `pShell`, `pSplash`, `pBullet`, `pCannonball`,
`pBoulder`, `pIce`, `pBarbwire`, `pShirker`, `pTrust`, `pCitizen`.

### `game.js` — the engine
A single IIFE that owns the canvas, input, and a state machine:
`MENU → SELECT → CUTSCENE → LEVEL → MGINTRO → MG → RECAP → WIN → (next) / END`.
It builds each platformer level procedurally (`buildLevel`), runs physics and
collision (`updateLevel`), renders the world and HUD (`drawLevel`), draws the
era-correct enemies (`drawFoe`), and handles the cutscene, intro, recap, win/lose,
and ending screens. The main `frame()` loop clears the canvas every frame, then
dispatches on the current state. It also exposes a small `window.TRTouch` bridge
(`down`/`up`/`tap`/`info`) that mirrors the keyboard, used only by `touch.js`.

### `touch.js` — touch controls (mobile only)
A self-contained module that returns immediately unless the browser reports a
**coarse (touch) pointer**, so it builds *nothing* on desktop. On a phone/tablet
it overlays HTML buttons inside `#frame` and feeds `window.TRTouch` — which sets
the exact same `keysDown`/`keysPressed` sets the keyboard uses — so no game logic
changes. The button set adapts per screen (movement + action while playing,
J/K in boxing, ▲/▼ in gunnery, a letter keypad in telegraph, and tap-to-continue
on menus). All styling is scoped to `body.is-touch` in `style.css`.

### `audio.js` — `Audio2.*`
`Audio2.resume()`, `Audio2.playMusic(name)`, `Audio2.stopMusic()`,
`Audio2.toggleMute()`, and `Audio2.sfx.*` (jump, land, coin, hit, punch, shoot,
success, fail, select, powerup, paddle, type). All synthesized — no audio files.
`Audio2.foeDefeat(kind)` plays a **character-specific defeat sound** when you
stomp an enemy (a cat meow, a dog yelp, a snake's rattle, a rat squeak, a gull
squawk, a mosquito buzz cut short, coins spilling from a "trust," a jaguar growl,
etc.), keyed to the enemy's `kind`; unknown kinds fall back to the generic punch.
The per-foe sounds live in the `foeSfx` table in `audio.js`.

### `assets.js` — `Assets.*`
`Assets.load()` kicks off loading every chapter's background image;
`Assets.getBG(id)` returns the `Image` once ready (or `null`), which
`Art.drawBackground` uses to decide between the photo and the procedural fallback.

---

## Working on the game

There's no build. Edit a `.js` file and refresh the browser.

**Common tasks**

- *Change a fact, blurb, or objective* → edit the chapter in `data.js`.
- *Add/adjust an enemy* → add a `case` in `drawFoe` (`game.js`) and reference its
  key via `enemy`/`enemy2` in `data.js`.
- *Tune a mini-game's difficulty* → edit its class constructor (e.g. `goal`,
  `time`, spawn rates) in `minigames.js`.
- *Adjust an outfit or add a costume* → edit the `COSTUMES`/`AGE` tables in
  `sprites.js`.
- *Swap a backdrop* → drop a new image into `assets/bg/` with the same filename
  (the `bg` field in `data.js` controls the exact name; WebP is preferred for size).

**Syntax-checking** (no runtime needed): `node --check js/<file>.js`.

**Headless smoke test:** the engine and all ten mini-games can be exercised
without a browser by loading the scripts into a mock canvas context and stepping
`update`/`draw` for each mini-game and a sample platformer level. This is how the
game is verified after changes — it confirms every chapter and mini-game runs to a
win/lose state with no runtime errors. (Optional: `npm install canvas` lets you
render real PNG previews of any sprite or screen for visual QA.)

---

## Backgrounds & regenerating art

The chapter backdrops live in `assets/bg/` as web-optimized WebP files named
`ch1_nyc.webp` … `ch9_amazon.webp`, plus `ch_town.webp` for the Bully Pulpit. The
loader keys off the `bg` field in each chapter (`data.js`), so to replace any scene
you overwrite the file referenced there — no code change.

They were exported from 1365×768 source art at WebP quality 80, which shrinks each
scene from ~1.4–3.9 MB (PNG) down to ~70–180 KB with no visible quality loss —
about **1.5 MB total** instead of ~19 MB, so the game starts quickly.

`assets/bg/GEMINI_PROMPTS.md` contains a ready-to-paste prompt for each scene
(painterly, 16:9, no characters, no text) so you can regenerate them in
Gemini/Imagen. If you generate a new PNG, re-export it to WebP (e.g. Pillow:
`Image.open("scene.png").convert("RGB").save("scene.webp","WEBP",quality=80,method=6)`)
and point the chapter's `bg` field at it.

---

## Historical sourcing

Dates, quotations, and the chapter facts were checked against the Library's
`Book_Text` collection, including the *Captivating History* biography of Theodore
Roosevelt and H. Paul Jeffers' *The Bully Pulpit: A Teddy Roosevelt Book of
Quotations*. Facts appear in chronological order within each chapter. Two headline
quotations are reproduced verbatim from those sources: **"Speak softly and carry a
big stick; you will go far,"** and the closing **"Man in the Arena"** passage.
Roosevelt's death is presented in the closing legacy screen rather than inside the
Amazon chapter, to keep each chapter's events period-accurate.

The **TRPL wordmark** (`assets/trpl_wordmark.svg`) appears on the title, chapter
select, recap, win, and legacy screens (top-left), and links out in a new tab to
the Library at **https://www.trlibrary.com/**. Its visibility is toggled by state
in `game.js`; it's hidden during active play so it never covers the action.

---

## Completion reward (promo code)

Finishing **all 10 chapters** unlocks a reward on the final ("Man in the Arena")
screen: a promo code plus a green **"Claim your free youth ticket"** button that
links to the Library. The intended offer is **1 free youth admission with a paid
adult ticket**.

**How it works**
- Each chapter is marked cleared (in `localStorage`, key `tr_cleared_v1`) only when
  its mini-game is genuinely won — skipping doesn't count. Progress survives a
  refresh. When all 10 are cleared, `allCleared()` is true and the reward shows.
- Before completion the ending instead nudges: "clear all 10 chapters to unlock a
  special reward."
- The code is **stored base64-encoded** (`codeEnc`) and only decoded at runtime
  when the reward is earned, so a casual *view source* / Ctrl-F won't reveal it.

**To change the offer** — edit the `REWARD` object near the top of `js/game.js`:

```js
const REWARD = {
  codeEnc: "Uk9VR0hSSURFUg==",   // base64 of the code; run btoa("YOURCODE") in a console
  get code(){ return atob(this.codeEnc); },
  headline: "YOU COMPLETED THE JOURNEY!",
  offer: "1 FREE youth admission with a paid adult ticket",
  url: "https://www.trlibrary.com/",   // where the Claim button links
};
```
To set a new code, open any browser console, run `btoa("YOURNEWCODE")`, and paste
the result as `codeEnc`.

**Important — base64 is light obfuscation, NOT security.** The game is a static
site, so a determined user can still recover the code from the running page. The
real limits must live in **your ticketing system**: create the code there with the
rules that matter — *requires a paid adult ticket*, a **total redemption cap**,
**one-per-customer**, and an **expiration date**. The game only *displays* the code
and links to the site; it doesn't validate redemptions. If you later want
genuinely unique, single-use codes, that needs a small backend
(serverless function or a ticketing-API integration) — the same reward screen can
point its button there without other changes.

---

## Score

A running score accumulates as you play and **persists across levels** (saved in
`localStorage`, key `tr_score_v1`):

| Action | Points |
|--------|--------|
| Coin collected | **1** |
| Foe defeated (stomped) | **2** |
| Treasure chest opened | **5** |

The total shows in the level HUD (top-center, "SCORE n"), on each chapter's recap
screen ("TOTAL SCORE: n"), and in the Chapter Select header ("★ Score: n"). Point
values live in the `PTS` object near the top of `js/game.js`; `addScore()` writes
through to `localStorage` on every pickup. To reset a player's score, clear that
key (or clear site data), or use the hidden reset code below.

---

## Hidden reset code

Entering the classic Konami code on the keyboard —
**`↑ ↑ ↓ ↓ ← → ← → B A`** — wipes all saved progress: it clears both
`localStorage` keys (`tr_cleared_v1` cleared-chapters and `tr_score_v1` score),
resets them in memory so the completion badges and score update immediately,
plays the power-up chime, and flashes **"Progress reset!"** on screen.

For safety it is **only armed on the start, Chapter Select, and completion
screens** — during a level, cutscene, or mini-game the sequence is ignored, and
any partial attempt is forgotten the moment you leave an eligible screen, so it
can't be triggered accidentally mid-game. The matcher (`konamiCheck` in
`js/game.js`) uses a rolling buffer of the last 10 keys, so stray keypresses
before or during the attempt won't jam it. It is keyboard-only, so it stays
hidden from casual play on touch devices.

---

## Known limitations & ideas

- A hand-coded canvas game can't match console *hardware* 3D; the art targets a
  polished, modern hand-drawn 2D look rather than literal "Switch" rendering.
- Backgrounds are static painted scenes panned with parallax, not fully animated
  environments.
- Possible future additions: a high-score / time-attack mode, gamepad support,
  more treasure facts per chapter, and animated foreground elements in the
  backdrops.

*A respectful tribute to Theodore Roosevelt, made for the Theodore Roosevelt
Presidential Library.*
