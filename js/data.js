/* ============================================================================
   data.js  —  Theodore Roosevelt biography content & level definitions
   Sourced from the Theodore Roosevelt Presidential Library Book_Text collection.
   Dates, quotes, and facts verified against primary/secondary sources.

   Each chapter carries:
     id, years, title, subtitle, place, blurb
     bg        — background image filename in assets/bg/
     scenery   — procedural fallback key (used only if the image fails to load)
     age       — life stage: child | teen | adult | mature | elder
     costume   — outfit key (see sprites.js COSTUMES)
     enemy / enemy2 — era-correct foe keys (see drawFoe in game.js)
     facts[]   — chronological, matched to the chapter's time period
     minigame  — {type, name, goal, controls, win}
   ========================================================================== */

const TR_QUOTES = {
  arena:
    "The credit belongs to the man who is actually in the arena; whose face is " +
    "marred by dust and sweat and blood; who errs and comes short again and again… " +
    "who knows the great enthusiasms, the great devotions, and spends himself in a " +
    "worthy cause; who at the worst, if he fails, at least fails while doing greatly.",
  bigStick: "Speak softly and carry a big stick; you will go far.",
  bullMoose: "I'm as fit as a bull moose.",
};

const CHAPTERS = [
  {
    id: 1, years: "1858–1876",
    title: "A Sickly Boy in New York",
    subtitle: "Building the Body",
    place: "Manhattan, New York City",
    blurb:
      "Theodore Roosevelt was born October 27, 1858, into a wealthy New York " +
      "family — but he was a frail, asthmatic child who fought for every breath. " +
      "After bullies manhandled him on a stagecoach at thirteen, his father told " +
      "him, \"You have the mind but you have not the body.\" Young \"Teedie\" began " +
      "to MAKE his body.",
    bg: "ch1_nyc.png", scenery: "city1870", age: "child", costume: "boy",
    enemy: "bully", enemy2: "alleycat",
    foes: "Stagecoach bullies and stray alley cats of old New York.",
    objective: "Run the block, dodge the bullies, and gather the four ★ that tell how a frail boy chose to build himself up.",
    palette: { sky1:"#cfe0ef", sky2:"#aebfd2", ground:"#6d5436", accent:"#8a5a2b", far:"#7d8aa0" },
    facts: [
      "Born in NYC, October 27, 1858",
      "Suffered severe childhood asthma",
      "Bullied on a stagecoach at age 13",
      "Took up boxing & weightlifting to grow strong",
    ],
    minigame: {
      type: "bodybuild", name: "MAKE YOUR BODY",
      goal: "Fill the STRENGTH bar before time runs out.",
      controls: "Tap SPACE in rhythm with the glowing ring to lift. Don't mash — time it!",
      win: "Through sheer will, Teedie grew strong. \"I will make my body,\" he vowed — and he did.",
    },
  },
  {
    id: 2, years: "1876–1882",
    title: "Harvard & the Boxing Ring",
    subtitle: "The Strenuous Life Begins",
    place: "Cambridge, Massachusetts",
    blurb:
      "At Harvard, Roosevelt threw himself into everything — science, rowing, and " +
      "boxing, where he fought in the lightweight division. He married Alice " +
      "Hathaway Lee in 1880 and, restless for the fight, won a seat in the New York " +
      "State Assembly at just 23.",
    bg: "ch2_harvard.png", scenery: "campus", age: "teen", costume: "student",
    enemy: "rival", enemy2: "bulldog",
    foes: "A Yale boxing rival and his bulldog mascot around Harvard Yard.",
    objective: "Cross the campus past your rival and his bulldog to reach the ring.",
    palette: { sky1:"#e7ddc4", sky2:"#cdbf9a", ground:"#5b4a2f", accent:"#7a3b2e", far:"#9a8f6f" },
    facts: [
      "Entered Harvard in 1876",
      "Boxed in the lightweight division",
      "Married Alice Hathaway Lee, 1880",
      "Elected to the NY Assembly at 23, 1881",
    ],
    minigame: {
      type: "boxing", name: "HARVARD BOXING MATCH",
      goal: "Out-boxing your Harvard rival — land hits and drain his stamina.",
      controls: "← / → bob & weave.  J = quick JAB,  K = power CROSS.  Watch his wind-up, dodge, then strike!",
      win: "Roosevelt fought to the final bell and won his lightweight bout — and a lifelong love of the contest.",
    },
  },
  {
    id: 3, years: "1884–1886",
    title: "Into the Dakota Badlands",
    subtitle: "Grief, Cattle & the River Pursuit",
    place: "Medora, Dakota Territory",
    blurb:
      "On February 14, 1884, Roosevelt's wife Alice and his mother both died in the " +
      "same house on the same day. \"The light has gone out of my life,\" he wrote. " +
      "He fled west to ranch the Badlands, faced down a saloon bully who jeered " +
      "\"Four Eyes,\" and chased boat thieves across the icy Little Missouri.",
    bg: "ch3_badlands.png", scenery: "badlands", age: "adult", costume: "cowboy",
    enemy: "rattler", enemy2: "tough",
    foes: "Prairie rattlesnakes and a saloon tough who sneered 'Four Eyes.'",
    objective: "Ride the Badlands, avoid the rattlers and the saloon tough, and reach the river.",
    palette: { sky1:"#f3c98a", sky2:"#d98c52", ground:"#8a5a32", accent:"#b5651d", far:"#9c6b45" },
    facts: [
      "Lost his wife & mother, Feb 14, 1884",
      "Ranched the Elkhorn in Dakota Territory",
      "Faced down the 'Four Eyes' saloon bully",
      "Captured boat thieves on the river, 1886",
    ],
    minigame: {
      type: "river", name: "CATCH THE BOAT THIEVES",
      goal: "Chase down the fleeing thieves and close the gap to catch them.",
      controls: "← / → steer into their wake.  Hold SPACE to paddle & gain on them. Dodge ice floes & rocks.",
      win: "Roosevelt brought the thieves to justice — reading Tolstoy to them along the way.",
    },
  },
  {
    id: 4, years: "1895–1897",
    title: "Cleaning Up the NYPD",
    subtitle: "The Midnight Rambles",
    place: "New York City",
    blurb:
      "As President of the New York City Police Board from 1895, Roosevelt attacked " +
      "corruption head-on. He prowled the streets after dark on his famous " +
      "\"midnight rambles,\" catching officers asleep or drinking on duty and " +
      "breaking the grip of Tammany graft.",
    bg: "ch4_nightcity.png", scenery: "nightcity", age: "adult", costume: "cop",
    enemy: "grafter", enemy2: "alleycat",
    foes: "Tammany grafters and the alley cats of the midnight beat.",
    objective: "Walk the night beat, slip past the grafters, and reach the station house.",
    palette: { sky1:"#2c3550", sky2:"#171c2e", ground:"#2a2a33", accent:"#caa64a", far:"#3a4260" },
    facts: [
      "Named Police Commissioner, 1895",
      "Walked 'midnight rambles' after dark",
      "Caught officers shirking their duty",
      "Broke Tammany bribery & graft",
    ],
    minigame: {
      type: "patrol", name: "THE MIDNIGHT RAMBLE",
      goal: "Catch the slacking officers in your lantern light before dawn.",
      controls: "Arrow keys move.  SPACE flashes your lantern to catch a shirking cop.",
      win: "The press loved it. Reform had a face — big teeth, small spectacles, endless energy.",
    },
  },
  {
    id: 5, years: "1897–1898",
    title: "Assistant Secretary of the Navy",
    subtitle: "Speak Softly, Build a Big Stick",
    place: "Washington, D.C.",
    blurb:
      "Appointed Assistant Secretary of the Navy in 1897, Roosevelt believed a " +
      "strong fleet kept the peace. \"Speak softly and carry a big stick,\" he later " +
      "said. He drilled American warships to readiness — then resigned to go fight.",
    bg: "ch5_harbor.png", scenery: "harbor", age: "adult", costume: "navy",
    enemy: "wharfrat", enemy2: "gull",
    foes: "Wharf rats and screeching gulls around the Navy yard.",
    objective: "Cross the docks past the rats and gulls to the gunnery range.",
    palette: { sky1:"#bcd6e6", sky2:"#7fa7c4", ground:"#33506a", accent:"#d9a441", far:"#5b809e" },
    facts: [
      "Assistant Secretary of the Navy, 1897",
      "Drilled the fleet to readiness",
      "\"Speak softly and carry a big stick\"",
      "Resigned to enlist for Cuba",
    ],
    minigame: {
      type: "gunnery", name: "NAVAL GUNNERY DRILL",
      goal: "Hit the target ships before they drift off the horizon.",
      controls: "↑ / ↓ aim the cannon.  SPACE to FIRE.  Lead the moving targets!",
      win: "A fleet at \"the highest training\" — ready, Roosevelt believed, to keep the peace.",
    },
  },
  {
    id: 6, years: "1898",
    title: "The Rough Riders",
    subtitle: "The Charge Up the Heights",
    place: "San Juan Heights, Cuba",
    blurb:
      "Roosevelt resigned to raise a volunteer cavalry — the \"Rough Riders.\" In " +
      "the Cuban heat they battled Spanish fire and yellow-fever mosquitoes alike. " +
      "On July 1, 1898, he led the charge up Kettle Hill, grazed by a bullet, and " +
      "became a national hero.",
    bg: "ch6_sanjuan.png", scenery: "cubahill", age: "adult", costume: "roughrider",
    enemy: "soldier", enemy2: "mosquito",
    foes: "Spanish soldiers and swarms of yellow-fever mosquitoes in Cuba.",
    objective: "Push through the soldiers and mosquitoes to the foot of Kettle Hill.",
    palette: { sky1:"#cfe7b0", sky2:"#8fb86a", ground:"#5f7a39", accent:"#a23a2c", far:"#7c9b5a" },
    facts: [
      "Raised the volunteer Rough Riders",
      "Sailed to Cuba, June 1898",
      "Charged Kettle Hill, July 1, 1898",
      "Came home a national hero",
    ],
    minigame: {
      type: "charge", name: "CHARGE UP KETTLE HILL",
      goal: "Reach the top of the hill while dodging fire and obstacles.",
      controls: "SPACE / ↑ to JUMP (tap twice for a double-jump). You auto-run uphill — don't get pinned!",
      win: "\"The great day of my life,\" Roosevelt called it. The hill — and the headlines — were his.",
    },
  },
  {
    id: 7, years: "1898–1901",
    title: "Governor to the White House",
    subtitle: "An Unexpected Ascent",
    place: "Albany → Washington, D.C.",
    blurb:
      "War hero Roosevelt was elected Governor of New York, then swept onto the " +
      "1900 ticket as Vice President. On September 6, 1901, President McKinley was " +
      "shot; he died on the 14th. At 42, Roosevelt became the youngest President " +
      "in American history.",
    bg: "ch7_capitol.png", scenery: "capitol", age: "mature", costume: "president",
    enemy: "boss", enemy2: "redtape",
    foes: "Political machine bosses and tangles of bureaucratic red tape.",
    objective: "Climb from Albany to Washington, dodging bosses and red tape, to the telegraph office.",
    palette: { sky1:"#dfe6ef", sky2:"#b0bccf", ground:"#4a4f5e", accent:"#c0392b", far:"#7d879b" },
    facts: [
      "Elected Governor of New York, 1898",
      "Elected Vice President, 1900",
      "McKinley assassinated, September 1901",
      "Became President at 42 — the youngest ever",
    ],
    minigame: {
      type: "telegraph", name: "THE TELEGRAPH RACE",
      goal: "Send the urgent dispatches by striking the right keys in time.",
      controls: "Press the LETTER KEYS shown on screen before each expires. Speed builds your score!",
      win: "The nation held its breath — and a new, restless President took the oath of office.",
    },
  },
  {
    id: 8, years: "1901–1909",
    title: "The Bully Pulpit",
    subtitle: "A Square Deal for All",
    place: "Main Street, America",
    blurb:
      "President Roosevelt used the presidency as a \"bully pulpit,\" stumping from " +
      "town to town. He busted the Northern Securities trust in 1902, settled the " +
      "great coal strike with a \"Square Deal,\" and in 1906 won the Nobel Peace " +
      "Prize for ending the Russo-Japanese War.",
    bg: "ch_town.png", scenery: "capitol", age: "mature", costume: "president",
    enemy: "trust", enemy2: "boss",
    foes: "Monopoly 'trust' money-bags and the bosses who protect them.",
    objective: "Stump down Main Street past the trusts and bosses to the speaker\u2019s platform.",
    palette: { sky1:"#bcd2e6", sky2:"#9bb2cc", ground:"#9a7a52", accent:"#b0402f", far:"#8a9bb0" },
    facts: [
      "Took office as President, 1901",
      "Busted the Northern Securities trust, 1902",
      "Settled the coal strike — a 'Square Deal'",
      "Won the Nobel Peace Prize, 1906",
    ],
    minigame: {
      type: "bigstick", name: "BIG STICK: BUST THE TRUSTS",
      goal: "Smash the monopoly 'trusts' that pop up — but spare the citizens!",
      controls: "← / → move between lanes.  SPACE swings the Big Stick. Hit TRUSTS, spare CITIZENS.",
      win: "A 'Square Deal' for all — the rich man and the poor man treated exactly alike.",
    },
  },
  {
    id: 9, years: "1903–1909",
    title: "Conservation & Yosemite",
    subtitle: "Leave It As It Is",
    place: "Yosemite, California",
    blurb:
      "In 1903 Roosevelt camped three nights in Yosemite with naturalist John Muir, " +
      "sleeping under the sequoias. \"Leave it as it is,\" he urged of the Grand " +
      "Canyon. As President he created 5 national parks, signed the 1906 Antiquities " +
      "Act, and protected roughly 230 million acres of public land.",
    bg: "ch8_wilderness.png", scenery: "wilderness", age: "mature", costume: "naturalist",
    enemy: "poacher", enemy2: "logger",
    foes: "Poachers and loggers threatening the groves and wildlife.",
    objective: "Travel into Yosemite, turning back poachers and loggers, sparing the wildlife.",
    palette: { sky1:"#bfe0c2", sky2:"#7bbf86", ground:"#3f6b3b", accent:"#2e7d32", far:"#5f9e69" },
    facts: [
      "Camped Yosemite with John Muir, 1903",
      "Created 5 national parks",
      "Signed the Antiquities Act, 1906",
      "Protected ~230 million acres of land",
    ],
    minigame: {
      type: "conserve", name: "PROTECT THE WILD",
      goal: "Guard the forest & wildlife — stop poachers and loggers, spare the animals.",
      controls: "← / → move the ranger between groves.  SPACE to ward off a threat. Don't scare the wildlife!",
      win: "\"Leave it as it is.\" Roosevelt's wild places still belong to every American today.",
    },
  },
  {
    id: 10, years: "1909–1914",
    title: "Safari, the Amazon & the Last Fight",
    subtitle: "Into the River of Doubt",
    place: "Africa → Brazil",
    blurb:
      "After the presidency Roosevelt hunted in Africa for the Smithsonian, then ran " +
      "again in 1912 as a \"Bull Moose\" — shot in Milwaukee, he finished his speech " +
      "with the bullet still in him. In 1913–14 he and his son Kermit nearly died " +
      "mapping Brazil's uncharted \"River of Doubt.\"",
    bg: "ch9_amazon.png", scenery: "amazon", age: "elder", costume: "explorer",
    enemy: "piranha", enemy2: "jaguar",
    foes: "Leaping piranha and a stalking jaguar along the jungle river.",
    objective: "Trek to the headwaters past piranha and a jaguar to launch the canoe.",
    palette: { sky1:"#3b5a4a", sky2:"#1f3a30", ground:"#243b2c", accent:"#86c06a", far:"#2c4d3c" },
    facts: [
      "African safari for the Smithsonian, 1909",
      "Ran as 'Bull Moose' — shot in 1912, finished his speech",
      "Mapped Brazil's River of Doubt, 1913–14",
      "His last great adventure, dared to the end",
    ],
    minigame: {
      type: "rapids", name: "THE RIVER OF DOUBT",
      goal: "Paddle the canoe down the deadly rapids to the river's mouth.",
      controls: "← / → steer.  SPACE to paddle hard through rough water. Avoid rocks & whirlpools.",
      win: "\"The River of Doubt\" was mapped at last. Roosevelt had dared greatly to the very end.",
    },
  },
];
