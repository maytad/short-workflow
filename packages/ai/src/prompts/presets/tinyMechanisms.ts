import type { GenerateScriptInput, ScriptScene } from "../../types";

export const TINY_MECHANISMS_PRESET_ID = "tiny_mechanisms" as const;
export const TINY_MECHANISMS_CHANNEL_NAME = "Tiny Mechanisms";
export const TINY_MECHANISMS_TOPIC_PREFIX = "tiny_mechanisms:";
export const TINY_MECHANISMS_PENDING_TOPIC = `${TINY_MECHANISMS_TOPIC_PREFIX}pending`;

export type TinyMechanismsMechanismFamily =
  | "spring_locking"
  | "stored_energy"
  | "one_way_ratchet"
  | "timing_release"
  | "motion_conversion"
  | "grip_and_release"
  | "guided_track"
  | "fluid_valve"
  | "precision_alignment"
  | "legacy_everyday";

export type TinyMechanismsAppealTier = "mass_appeal" | "kinetic_satisfying" | "workshop_tool";

export type TinyMechanismsSeed = {
  seedId: string;
  selectionStatus: "active" | "legacy";
  mechanismFamily: TinyMechanismsMechanismFamily;
  appealTier: TinyMechanismsAppealTier;
  objectOrMechanism: string;
  titleAngle: string;
  centralQuestion: string;
  viewerMisconception: string;
  mechanismHint: string;
  satisfyingMotion: string;
  visualReveal: string;
  loopPayoff: string;
  visualMetaphor: string;
  audienceContext: string;
  nativeSetting: string;
  hookEmotion: string;
  avoidVisualSetting: string;
  repeatRisk: "low" | "medium" | "high";
  riskLevel: "low";
};

type LegacySeedInput = {
  seedId: string;
  centralQuestion: string;
  everydayObjectOrPhenomenon: string;
  mechanismHint: string;
  visualMetaphor: string;
};

export const TINY_MECHANISMS_SCENE_ROLES_BY_DURATION = {
  30: ["hook", "context", "point", "payoff", "cta"],
  45: ["hook", "context", "point", "point", "payoff", "cta"],
  60: ["hook", "context", "point", "point", "point", "payoff", "cta"],
} as const satisfies Record<
  GenerateScriptInput["targetDurationSeconds"],
  readonly ScriptScene["role"][]
>;

export const TINY_MECHANISMS_CHANNEL_BIBLE = [
  "Channel: Tiny Mechanisms.",
  "Promise: one tiny physical mechanism revealed in under 45 seconds.",
  "Audience: English-speaking curious general audience at middle-school knowledge level.",
  "Tone: clear, curious, precise, lightly dramatic, and never generic.",
  "Format: faceless 9:16 mechanical micro-documentary with generated images, narration, captions, and a loopable ending.",
  "Allowed topics: tiny locks and latches, springs and stored energy, one-way mechanisms, timing releases, motion conversion, grip-and-release parts, guided tracks, small pumps, valves, and everyday precision mechanisms.",
  "Disallowed topics: medical advice, finance, legal advice, politics, war, crime, breaking news, public figures, dangerous instructions, children's characters, conspiracy framing, and unsupported claims.",
  "Topic gate: prefer everyday objects with a visible moving part, visible tension, a hidden physical cause, a common wrong assumption, and a mechanism that can be explained in three concrete cause-effect beats.",
  "Reject topics or angles that cannot show a physical part moving, locking, sliding, catching, bending, releasing, or changing state on screen.",
  "Novelty gate: keep the channel focused on visible mechanisms while varying mechanism family, visible action, viewer misconception, and visual strategy so recent videos do not feel templated.",
  "Captions: short mobile-readable beat summaries, not full narration paragraphs.",
  "Image direction: social-native hidden-mechanism frames with familiar everyday objects, native settings, selective cutaways, springs, cams, latches, gears, pawls, tracks, levers, valves, material texture, and no embedded text, logos, UI, or public figures.",
  "Retention: start from an impossible-looking behavior, reveal the hidden mechanism, and end with a loop payoff that reinterprets the first shot.",
].join("\n");

export const TINY_MECHANISMS_ACTIVE_SEEDS: [TinyMechanismsSeed, ...TinyMechanismsSeed[]] = [
  {
    seedId: "click_pen_cam_lock",
    selectionStatus: "active",
    mechanismFamily: "spring_locking",
    appealTier: "mass_appeal",
    objectOrMechanism: "click pen cam and spring",
    titleAngle: "The click is a tiny mechanical memory",
    centralQuestion: "Why does one click lock a pen, but the next click releases it?",
    viewerMisconception: "The spring is doing all the clever work.",
    mechanismHint:
      "A rotating cam changes position on each press, alternately locking and releasing the refill.",
    satisfyingMotion: "press, rotate, lock, release",
    visualReveal: "macro cutaway of the cam track stepping into the next notch",
    loopPayoff: "That click is not just a button. It remembers the last press.",
    visualMetaphor: "a tiny plastic cam walking around a circular staircase",
    audienceContext:
      "Anyone who has clicked a pen and noticed the same press can do opposite things.",
    nativeSetting: "a desk, notebook, pocket, or hand-held writing moment",
    hookEmotion: "surprise that the same press has mechanical memory",
    avoidVisualSetting: "dark repair workbench or generic tool demonstration",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "zipper_locking",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "mass_appeal",
    objectOrMechanism: "zipper slider and interlocking teeth",
    titleAngle: "A zipper is a tiny machine that braids teeth together",
    centralQuestion: "Why does a zipper lock instead of sliding open under tension?",
    viewerMisconception: "The teeth simply press together by friction.",
    mechanismHint:
      "The slider guides two angled rows of teeth into an interlocking path so pulling force tightens the joint instead of opening it.",
    satisfyingMotion: "mesh, wedge, pull, lock",
    visualReveal: "macro slider cutaway forcing two tooth rows into one locked track",
    loopPayoff:
      "The slider is not just closing fabric. It is building a tiny bridge one tooth at a time.",
    visualMetaphor: "two miniature metal staircases zipping into a single rail",
    audienceContext:
      "Anyone who has zipped a jacket, bag, or pouch and expects it to stay closed under pulling.",
    nativeSetting: "jacket fabric, backpack fabric, travel pouch, or clothing close-up",
    hookEmotion: "tension from fabric being pulled sideways without bursting open",
    avoidVisualSetting: "bare metal parts on a workshop table",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "spray_bottle_check_valves",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
    appealTier: "mass_appeal",
    objectOrMechanism: "spray bottle pump and check valves",
    titleAngle: "One squeeze moves liquid only one direction",
    centralQuestion: "Why does a spray bottle pull liquid up instead of pushing it back down?",
    viewerMisconception: "The trigger simply squeezes liquid through a tube.",
    mechanismHint:
      "Two one-way valves alternate between drawing liquid into the pump chamber and forcing it out through the nozzle.",
    satisfyingMotion: "squeeze, seal, draw, spray",
    visualReveal: "transparent trigger head showing one valve opening while the other closes",
    loopPayoff: "The spray works because half the path is always saying no.",
    visualMetaphor: "two tiny doors taking turns inside a clear pump",
    audienceContext: "Anyone who has squeezed a spray bottle and expects liquid to climb a straw.",
    nativeSetting: "cleaning bottle, plant mister, bathroom spray, or kitchen counter close-up",
    hookEmotion: "curiosity about how one squeeze pulls liquid upward",
    avoidVisualSetting: "workshop pump teardown",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "phone_screen_rotation",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    appealTier: "mass_appeal",
    objectOrMechanism: "phone MEMS accelerometer",
    titleAngle: "Your phone has a tiny moving weight that feels gravity",
    centralQuestion: "How does your phone know it turned sideways?",
    viewerMisconception: "The screen rotates because the camera or software sees the phone move.",
    mechanismHint:
      "A tiny suspended mass inside a motion sensor shifts relative to electrodes, letting software infer gravity direction.",
    satisfyingMotion: "tilt, shift, sense, rotate",
    visualReveal:
      "phone cutaway showing a microscopic suspended mass shifting as gravity arrows rotate",
    loopPayoff: "The screen turns because a tiny weight moved first.",
    visualMetaphor: "a microscopic pendulum trapped inside a silicon maze",
    audienceContext: "Anyone who has turned a phone sideways and watched the screen rotate.",
    nativeSetting: "hand holding a phone on a couch, desk, or bed",
    hookEmotion: "surprise that a tiny moving weight helps the phone feel gravity",
    avoidVisualSetting: "floating circuit-board sci-fi view",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "door_latch_beveled_tongue",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
    appealTier: "mass_appeal",
    objectOrMechanism: "door latch beveled tongue and strike plate",
    titleAngle: "A door closes with one push because the latch is sloped",
    centralQuestion: "Why can a door close with a push, but needs the handle to open?",
    viewerMisconception: "The latch just pops in and out like a simple peg.",
    mechanismHint:
      "The beveled latch face rides over the strike plate and compresses the spring on closing, but the flat back blocks opening until the handle retracts it.",
    satisfyingMotion: "slide, compress, snap, block",
    visualReveal: "cutaway of the angled latch face sliding into a strike plate and snapping back",
    loopPayoff: "One side is a ramp. The other side is a wall.",
    visualMetaphor: "a tiny wedge that becomes a dead stop after it passes the frame",
    audienceContext: "Anyone who has pushed a door closed without turning the handle.",
    nativeSetting:
      "home door frame, bedroom door, cabinet door, or close-up of a latch meeting the strike plate",
    hookEmotion: "realization that one side acts like a ramp and the other side acts like a wall",
    avoidVisualSetting: "locksmith tutorial or security bypass framing",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "mechanical_pencil_clutch",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "mass_appeal",
    objectOrMechanism: "mechanical pencil clutch jaws",
    titleAngle: "The pencil grips lead, then lets it move",
    centralQuestion: "How does a mechanical pencil advance lead without dropping it?",
    viewerMisconception: "The button simply pushes the lead forward.",
    mechanismHint:
      "Tiny clutch jaws open and close around the lead so each press releases, advances, and grips it again.",
    satisfyingMotion: "clamp, release, advance, grip",
    visualReveal: "macro cutaway of clutch jaws opening around a graphite lead",
    loopPayoff: "The pencil writes because tiny fingers keep letting go at the right moment.",
    visualMetaphor: "three miniature jaws passing a graphite rod forward",
    audienceContext:
      "Students, artists, and note-takers recognize the tiny lead advancing one click at a time.",
    nativeSetting: "notebook, sketchbook, desk, or hand writing close-up",
    hookEmotion: "curiosity about how fragile lead moves without falling out",
    avoidVisualSetting: "engineering bench teardown",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "pullback_toy_spring_motor",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
    appealTier: "mass_appeal",
    objectOrMechanism: "pull-back toy spring motor and gears",
    titleAngle: "Pulling backward stores a launch",
    centralQuestion: "Why does a toy car shoot forward after you pull it backward?",
    viewerMisconception: "The wheels remember which way they were dragged.",
    mechanismHint:
      "Pulling backward winds a spring through gears; releasing the car lets the spring unwind through the wheels.",
    satisfyingMotion: "wind, hold, release, launch",
    visualReveal: "toy car cutaway showing gears winding a flat spring",
    loopPayoff: "The backward pull was the engine starting.",
    visualMetaphor: "a tiny coiled spring charging like a launch pad",
    audienceContext: "A familiar toy moment where pulling backward somehow creates forward motion.",
    nativeSetting: "toy car on a floor, table, or child-free play surface close-up",
    hookEmotion: "delight from a backward pull becoming a launch",
    avoidVisualSetting: "garage toolbench or realistic car repair framing",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "windup_music_box_comb",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "music box pinned cylinder and metal comb",
    titleAngle: "A music box plucks metal teeth in order",
    centralQuestion: "How does a music box play a melody without electronics?",
    viewerMisconception: "The spinning cylinder makes sound by itself.",
    mechanismHint:
      "Raised pins on a rotating cylinder pluck tuned metal teeth, and the spacing of pins sets the rhythm.",
    satisfyingMotion: "wind, rotate, pluck, ring",
    visualReveal: "macro pins lifting and releasing individual comb teeth",
    loopPayoff: "The song is written as bumps on a tiny cylinder.",
    visualMetaphor: "a brass drum reading music with metal fingertips",
    audienceContext: "People recognize the delicate sound and want to see how bumps become music.",
    nativeSetting: "open music box, keepsake box, or macro brass mechanism close-up",
    hookEmotion: "wonder that a melody is stored as tiny bumps",
    avoidVisualSetting: "industrial gear assembly",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "soap_pump_one_way_valve",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
    appealTier: "mass_appeal",
    objectOrMechanism: "soap dispenser piston and one-way valves",
    titleAngle: "A pump lifts soap without sucking it back down",
    centralQuestion: "Why does a soap pump refill itself after each press?",
    viewerMisconception: "The straw is always full and only needs pressure.",
    mechanismHint:
      "The piston creates pressure changes while one-way valves decide whether soap enters the chamber or exits the nozzle.",
    satisfyingMotion: "press, seal, lift, refill",
    visualReveal: "transparent soap pump showing piston chamber and two valve balls",
    loopPayoff: "The pump works because the soap gets only one open door at a time.",
    visualMetaphor: "a tiny elevator for liquid with doors that take turns",
    audienceContext: "Anyone who has pressed a soap pump and watched it refill for the next press.",
    nativeSetting: "bathroom sink, kitchen sink, or clean countertop dispenser",
    hookEmotion: "curiosity about how thick liquid climbs and does not fall back",
    avoidVisualSetting: "lab pump teardown",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "camera_lens_aperture_blades",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "camera aperture iris blades",
    titleAngle: "A circle is built from sliding blades",
    centralQuestion: "How does a camera lens make a perfect-looking hole that changes size?",
    viewerMisconception: "A single round part opens and closes like a drain.",
    mechanismHint:
      "Overlapping iris blades slide together so their inner edges form a changing polygon that reads as a circle.",
    satisfyingMotion: "slide, overlap, open, close",
    visualReveal: "front macro view of aperture blades spiraling into a smaller opening",
    loopPayoff: "The circle is actually a choreographed crowd of blades.",
    visualMetaphor: "metal petals closing around a dark center",
    audienceContext:
      "A visually satisfying iris motion even for viewers who are not photographers.",
    nativeSetting: "camera lens macro, clean desk, or hand-held lens close-up",
    hookEmotion: "satisfaction from sliding blades forming a changing circle",
    avoidVisualSetting: "abstract camera sensor diagram",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "umbrella_runner_lock",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
    appealTier: "mass_appeal",
    objectOrMechanism: "umbrella runner latch and shaft",
    titleAngle: "An umbrella stays open because a tiny latch catches the runner",
    centralQuestion: "Why does an umbrella stay open after one push?",
    viewerMisconception: "The ribs simply stay open from friction.",
    mechanismHint:
      "The runner slides along the shaft until a small spring catch locks it in place against the ribs' closing force.",
    satisfyingMotion: "slide, catch, hold, release",
    visualReveal: "umbrella shaft cutaway showing the runner snapping over a spring catch",
    loopPayoff: "The umbrella is held open by one tiny catch doing all the resisting.",
    visualMetaphor: "a ring climbing a pole and being caught by a hidden hook",
    audienceContext: "Anyone who has pushed an umbrella open and heard it snap into place.",
    nativeSetting: "rainy doorway, hand-held umbrella shaft, or entryway close-up",
    hookEmotion: "relief that one tiny catch holds the whole canopy open",
    avoidVisualSetting: "metal parts laid out on a bench",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "hook_and_loop_fasteners",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "mass_appeal",
    objectOrMechanism: "hook-and-loop fastener hooks and fabric loops",
    titleAngle: "Thousands of tiny hooks make a soft lock",
    centralQuestion: "Why do hook-and-loop fasteners stick firmly but peel apart easily?",
    viewerMisconception: "The material is sticky like glue.",
    mechanismHint:
      "Tiny hooks catch flexible loops across many contact points, then release one row at a time when peeled at an angle.",
    satisfyingMotion: "press, catch, peel, release",
    visualReveal: "macro hooks grabbing fabric loops and peeling free row by row",
    loopPayoff: "It feels like one strip, but it opens as thousands of tiny releases.",
    visualMetaphor: "a miniature forest of hooks catching soft loops",
    audienceContext:
      "Anyone who has pressed and peeled a hook-and-loop strip and heard the ripping release.",
    nativeSetting: "shoe strap, bag flap, jacket cuff, or fabric close-up",
    hookEmotion: "satisfaction from thousands of tiny hooks releasing row by row",
    avoidVisualSetting: "microscope-only science diagram",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "watch_escapement_ticks",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "watch escapement fork and escape wheel",
    titleAngle: "A watch releases time one tooth at a time",
    centralQuestion: "Why does a mechanical watch tick instead of unwinding all at once?",
    viewerMisconception: "The gears move slowly on their own.",
    mechanismHint:
      "The escapement locks and unlocks the gear train in tiny steps, letting stored spring energy escape at a controlled rhythm.",
    satisfyingMotion: "tick, lock, unlock, release",
    visualReveal: "macro escapement fork stopping and releasing a brass escape wheel tooth",
    loopPayoff: "A watch does not let time flow. It meters it out.",
    visualMetaphor: "a tiny gate releasing one glowing tooth per beat",
    audienceContext: "People know the tick of a watch even if they have never seen the mechanism.",
    nativeSetting: "macro watch movement, open caseback, jeweler-style close-up",
    hookEmotion: "satisfaction from time being released one tooth at a time",
    avoidVisualSetting: "oversized industrial gear collage",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "crank_slider_toy_engine",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "crank slider and piston",
    titleAngle: "Rotation becomes a piston stroke",
    centralQuestion: "How does a spinning crank push a piston in a straight line?",
    viewerMisconception: "The piston is pushed by a separate up-and-down part.",
    mechanismHint:
      "A connecting rod turns crank rotation into back-and-forth sliding motion along a guide.",
    satisfyingMotion: "spin, push, pull, return",
    visualReveal: "clear toy engine showing a crank pin dragging a piston through a straight track",
    loopPayoff: "The straight push is just a circle seen from the side.",
    visualMetaphor: "a tiny arm turning a wheel into a heartbeat",
    audienceContext: "A simple visible motion puzzle: spinning becomes straight pushing.",
    nativeSetting: "clear toy engine model or hand-cranked demo",
    hookEmotion: "satisfaction from a circle turning into a piston stroke",
    avoidVisualSetting: "real engine repair tutorial or greasy workshop view",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "stapler_spring_return",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
    appealTier: "mass_appeal",
    objectOrMechanism: "stapler hinge and return spring",
    titleAngle: "A stapler fires down, then resets itself",
    centralQuestion: "Why does a stapler pop back open after punching a staple?",
    viewerMisconception: "The metal body is just bending back.",
    mechanismHint:
      "A return spring stores energy during the press and lifts the handle back after the staple is driven.",
    satisfyingMotion: "press, punch, spring, return",
    visualReveal: "side cutaway of a stapler hinge compressing and releasing its spring",
    loopPayoff: "The reset starts the moment you press down.",
    visualMetaphor: "a tiny metal jaw breathing back open",
    audienceContext: "Anyone who has pressed a stapler and watched it pop back open.",
    nativeSetting: "desk, paper stack, office surface, or schoolwork close-up",
    hookEmotion: "satisfaction from punch and instant reset",
    avoidVisualSetting: "hardware repair bench",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "bike_freewheel_clicks",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "mass_appeal",
    objectOrMechanism: "bicycle freewheel pawls and hub teeth",
    titleAngle: "A bike can coast because tiny pawls stop pushing",
    centralQuestion: "Why can a bike wheel keep spinning when your pedals stop?",
    viewerMisconception: "The chain disconnects from the wheel.",
    mechanismHint:
      "Pawls inside the freewheel engage teeth when pedaling forward and click over them when the wheel outruns the pedals.",
    satisfyingMotion: "drive, coast, click, catch",
    visualReveal: "hub cutaway showing pawls catching while pedaling and clicking while coasting",
    loopPayoff: "That clicking sound is the bike choosing not to push.",
    visualMetaphor: "tiny spring gates tapping over a spinning crown",
    audienceContext: "Cyclists and casual riders recognize the clicking sound while coasting.",
    nativeSetting: "bike wheel close-up, driveway, bike stand, or hand-spun rear wheel",
    hookEmotion: "curiosity about why coasting clicks but pedaling drives",
    avoidVisualSetting: "bike repair tutorial framing",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "kitchen_timer_gear_train",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
    appealTier: "mass_appeal",
    objectOrMechanism: "mechanical kitchen timer spring, gears, and escapement",
    titleAngle: "A timer slows a spring down with gears",
    centralQuestion: "Why does a kitchen timer count down slowly instead of unwinding instantly?",
    viewerMisconception: "The knob itself moves slowly because of friction.",
    mechanismHint:
      "A wound spring drives a gear train, while a timing mechanism resists the release so the dial returns gradually.",
    satisfyingMotion: "wind, resist, tick, release",
    visualReveal: "timer cutaway showing spring energy passing through a compact gear train",
    loopPayoff: "The timer is a spring being forced to spend its energy slowly.",
    visualMetaphor: "a coiled spring feeding a tiny brass traffic jam",
    audienceContext: "Anyone who has twisted a kitchen timer and heard it tick down.",
    nativeSetting: "kitchen counter, oven-side counter, or hand turning a timer",
    hookEmotion: "curiosity about why the spring spends energy slowly",
    avoidVisualSetting: "generic clock repair table",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "scissors_lever_crossing",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
    appealTier: "mass_appeal",
    objectOrMechanism: "scissors pivot and crossing levers",
    titleAngle: "Two blades multiply your hand force at one point",
    centralQuestion: "Why can scissors cut with a small squeeze?",
    viewerMisconception: "Sharpness alone does the cutting.",
    mechanismHint:
      "The pivot turns handle motion into concentrated blade force, with the cutting point moving as the blades close.",
    satisfyingMotion: "squeeze, pivot, slice, close",
    visualReveal: "macro pivot view showing force traveling from handles to a tiny cutting point",
    loopPayoff: "The cut happens where two levers agree to meet.",
    visualMetaphor: "crossed arms focusing a push into one bright point",
    audienceContext: "Anyone who has cut paper and felt a small squeeze become a sharp bite.",
    nativeSetting: "paper, craft table, packaging, or desk close-up",
    hookEmotion: "surprise that two crossing levers focus force at one moving point",
    avoidVisualSetting: "tool catalog beauty shot",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "bicycle_pump_check_valve",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
    appealTier: "mass_appeal",
    objectOrMechanism: "bicycle pump check valve",
    titleAngle: "Air goes into the tire but cannot escape through the pump",
    centralQuestion: "Why does air stay in the tire when you pull the pump handle back?",
    viewerMisconception: "Air stays because the hose is too narrow to leak backward.",
    mechanismHint:
      "A check valve opens under forward pressure and closes when tire pressure tries to push air back.",
    satisfyingMotion: "push, open, seal, refill",
    visualReveal: "transparent pump head showing a valve flap opening and snapping closed",
    loopPayoff: "The pump works because the return path closes faster than the air can escape.",
    visualMetaphor: "a one-way door slammed shut by the air it just let through",
    audienceContext: "Anyone who has pumped a tire and wondered why air does not rush back out.",
    nativeSetting: "bike tire, pump head, garage floor, driveway, or hand pumping close-up",
    hookEmotion: "relief that a tiny door closes faster than air can escape",
    avoidVisualSetting: "industrial compressor diagram",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "garden_hose_quick_connector_lock",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    appealTier: "mass_appeal",
    objectOrMechanism: "garden hose quick connector collar and locking balls",
    titleAngle: "A small collar keeps pressure from popping parts apart",
    centralQuestion: "Why does a hose quick connector hold under water pressure?",
    viewerMisconception: "The parts are only held by a tight friction fit.",
    mechanismHint:
      "A sliding collar traps small locking balls or tabs in a groove, blocking the connector from pulling apart until the collar moves back.",
    satisfyingMotion: "push, align, click, lock",
    visualReveal: "transparent connector collar trapping tiny balls in a circular groove",
    loopPayoff: "The water is pushing, but the tiny balls are holding the line.",
    visualMetaphor: "a ring of small bearings becoming a locked fence",
    audienceContext:
      "Anyone who has clicked a hose connector together and trusted it under water pressure.",
    nativeSetting: "garden hose, outdoor faucet, wet hand close-up, or backyard setting",
    hookEmotion: "tension from water pressure trying to pull parts apart",
    avoidVisualSetting: "plumbing repair tutorial",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "escalator_steps_level",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
    appealTier: "mass_appeal",
    objectOrMechanism: "escalator step wheels and hidden tracks",
    titleAngle: "Steps stay level because two tracks disagree on purpose",
    centralQuestion: "Why do escalator steps stay flat while moving upward?",
    viewerMisconception: "Each step has its own motor or balancing mechanism.",
    mechanismHint:
      "Each step rides on front and rear wheels following separate tracks that control the step angle through the whole path.",
    satisfyingMotion: "ride, tilt, flatten, return",
    visualReveal: "side cutaway showing front and rear step wheels following different rails",
    loopPayoff: "The step is not balancing itself. The tracks are forcing it to behave.",
    visualMetaphor: "a staircase pulled through two invisible rails",
    audienceContext:
      "Anyone who has stood on escalator steps and assumed each step balances itself.",
    nativeSetting:
      "mall escalator side cutaway style, public escalator detail, or clean transit close-up",
    hookEmotion: "surprise that hidden tracks force the steps flat",
    avoidVisualSetting: "factory conveyor system",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "seatbelt_retractor_lock",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "mass_appeal",
    objectOrMechanism: "seatbelt retractor inertia lock",
    titleAngle: "Slow pull is smooth, fast pull locks instantly",
    centralQuestion: "Why does a seatbelt pull out slowly but lock when yanked?",
    viewerMisconception: "The belt fabric jams when pulled too fast.",
    mechanismHint:
      "An inertia-sensitive lock reacts to sudden spool acceleration and catches the retractor teeth.",
    satisfyingMotion: "pull, spin, trigger, jam",
    visualReveal: "seatbelt retractor cutaway showing a locking pawl snapping into a toothed spool",
    loopPayoff: "The belt is calm until speed makes the tiny lock wake up.",
    visualMetaphor: "a spinning wheel caught by a sudden metal tooth",
    audienceContext: "Anyone who has slowly pulled a seatbelt, then had it lock when yanked.",
    nativeSetting: "car interior, seatbelt strap close-up, or retractor cutaway model",
    hookEmotion: "surprise that speed wakes up a tiny lock",
    avoidVisualSetting: "crash scene, danger dramatization, or repair bench",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "metronome_sliding_weight",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "mechanical metronome pendulum and sliding weight",
    titleAngle: "Moving the weight changes the beat",
    centralQuestion: "Why does sliding a metronome weight make the ticks slower or faster?",
    viewerMisconception: "The spring inside changes strength each time.",
    mechanismHint:
      "Moving the weight changes the pendulum's effective balance, changing how long each swing takes.",
    satisfyingMotion: "slide, swing, delay, tick",
    visualReveal: "metronome cutaway showing the weight shifting along the pendulum rod",
    loopPayoff: "The beat changes because the swing gets a longer or shorter body.",
    visualMetaphor: "a tiny pendulum wearing a movable backpack",
    audienceContext:
      "People recognize the hypnotic tick and swinging weight even without music theory.",
    nativeSetting: "piano top, practice room, desk, or macro pendulum close-up",
    hookEmotion: "satisfaction from a visible swing changing rhythm",
    avoidVisualSetting: "physics classroom diagram",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "nail_clipper_compound_lever",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
    appealTier: "mass_appeal",
    objectOrMechanism: "nail clipper compound lever",
    titleAngle: "A tiny lever stack turns a soft press into a hard bite",
    centralQuestion: "Why can nail clippers cut with such a small press?",
    viewerMisconception: "The blades cut only because they are sharp.",
    mechanismHint:
      "A compound lever multiplies finger force before the jaws close over a very small distance.",
    satisfyingMotion: "press, multiply, snap, cut",
    visualReveal: "side macro view of the top lever pressing a second lever into the cutting jaws",
    loopPayoff: "Your finger moves a lot so the blades can move a little with force.",
    visualMetaphor: "two tiny levers stacking strength into one bite",
    audienceContext: "Anyone who has felt a tiny press become a sudden snap.",
    nativeSetting:
      "bathroom counter, grooming kit, or hand-held nail clipper close-up without graphic detail",
    hookEmotion: "surprise that stacked levers turn a soft press into a hard bite",
    avoidVisualSetting: "medical, injury, or tool teardown framing",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "camera_autofocus_lens_group",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    appealTier: "mass_appeal",
    objectOrMechanism: "camera autofocus lens group on rails",
    titleAngle: "Focus changes by moving glass a tiny distance",
    centralQuestion: "How does a camera make a blurry image sharp?",
    viewerMisconception: "The sensor fixes blur after the image arrives.",
    mechanismHint:
      "Small motors shift lens elements until contrast or phase alignment indicates the image is sharp at the sensor.",
    satisfyingMotion: "shift, hunt, sharpen, lock",
    visualReveal: "lens cutaway showing a glass group moving forward on guide rails",
    loopPayoff: "The camera finds sharpness by physically moving the glass.",
    visualMetaphor: "a tiny glass train sliding until edges snap into focus",
    audienceContext: "Anyone who has watched a blurry phone or camera image suddenly become sharp.",
    nativeSetting:
      "camera lens, phone camera module, desk photo setup, or hand-held camera close-up",
    hookEmotion: "satisfaction from blur snapping into focus",
    avoidVisualSetting: "abstract software-only diagram",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "drawer_slide_ball_bearings",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
    appealTier: "mass_appeal",
    objectOrMechanism: "drawer slide ball bearings and rails",
    titleAngle: "A heavy drawer glides on hidden rolling paths",
    centralQuestion: "Why can a loaded drawer slide smoothly instead of scraping?",
    viewerMisconception: "The metal rails are just polished smooth.",
    mechanismHint:
      "Ball bearings roll between nested rails, supporting weight while reducing sliding friction.",
    satisfyingMotion: "roll, support, extend, stop",
    visualReveal: "drawer slide cutaway showing ball bearings rolling between two rails",
    loopPayoff: "The drawer is not sliding as much as it is rolling in disguise.",
    visualMetaphor: "a hidden line of tiny wheels carrying a shelf",
    audienceContext:
      "Anyone who has opened a heavy drawer that glides smoothly instead of scraping.",
    nativeSetting: "kitchen drawer, desk drawer, toolbox drawer, or furniture close-up",
    hookEmotion: "satisfaction from heavy motion feeling effortless",
    avoidVisualSetting: "hardware store parts display",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "manual_can_opener_gear_bite",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "mass_appeal",
    objectOrMechanism: "manual can opener cutting wheel and feed gear",
    titleAngle: "A can opener walks around the rim",
    centralQuestion: "How does a manual can opener pull itself around a can?",
    viewerMisconception: "You are dragging the blade around by hand.",
    mechanismHint:
      "A feed gear bites the can rim and advances the opener while the cutting wheel slices just beside the seam.",
    satisfyingMotion: "bite, turn, advance, cut",
    visualReveal: "macro view of toothed feed wheel gripping the rim beside the cutting disc",
    loopPayoff: "The opener is not dragged around the can. It walks.",
    visualMetaphor: "a tiny gear foot stepping along a metal cliff",
    audienceContext: "Anyone who has turned a can opener and watched it walk around the rim.",
    nativeSetting: "kitchen counter, can lid close-up, or hand turning a can opener",
    hookEmotion: "surprise that the opener walks instead of being dragged",
    avoidVisualSetting: "workshop tool demo",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "toy_gearbox_speed_tradeoff",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "toy gearbox gear ratio",
    titleAngle: "Tiny gears trade speed for strength",
    centralQuestion: "Why can small gears make a weak motor push harder?",
    viewerMisconception: "More gears always mean more power is created.",
    mechanismHint:
      "Gear ratios trade speed for torque, so the output turns slower but can push with more twisting force.",
    satisfyingMotion: "mesh, slow, push, turn",
    visualReveal: "clear toy gearbox showing a fast small gear driving a slower large gear",
    loopPayoff: "The gearbox does not create strength. It trades speed for it.",
    visualMetaphor: "tiny wheels exchanging quick steps for a stronger shove",
    audienceContext:
      "A clear toy gearbox makes speed and strength tradeoffs visible without engineering language.",
    nativeSetting: "transparent toy gearbox, desk toy, or hand-cranked model",
    hookEmotion: "satisfaction from fast motion becoming slower but stronger",
    avoidVisualSetting: "industrial gearbox or car transmission repair",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "padlock_shackle_latch",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "mass_appeal",
    objectOrMechanism: "padlock shackle catches",
    titleAngle: "A padlock holds with two tiny catches",
    centralQuestion: "Why does a padlock shackle stay trapped until the key turns?",
    viewerMisconception: "The key directly pulls the shackle out.",
    mechanismHint:
      "Internal catches hold notches in the shackle; turning the key moves the plug and retracts those catches.",
    satisfyingMotion: "push, catch, turn, release",
    visualReveal: "transparent padlock body showing catches gripping the shackle notches",
    loopPayoff: "The key does not pull the lock open. It tells the catches to let go.",
    visualMetaphor: "two tiny hands holding a metal loop by its shoulders",
    audienceContext:
      "People recognize a padlock snap shut, but the explanation must stay non-bypass and principle-only.",
    nativeSetting: "transparent educational padlock model or close-up of a lock snapping shut",
    hookEmotion: "curiosity about what holds the metal loop after the snap",
    avoidVisualSetting:
      "lock-picking, decoding, bypass, locksmith tutorial, or unauthorized-opening framing",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "tape_measure_coiled_spring",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
    appealTier: "workshop_tool",
    objectOrMechanism: "retractable tape measure spring and curved blade",
    titleAngle: "The ruler is secretly trying to curl back up",
    centralQuestion: "Why does a tape measure snap back into its case?",
    viewerMisconception: "The metal tape pulls itself back because it is curved.",
    mechanismHint:
      "A coiled spring stores energy as the tape is pulled out, then rewinds the spool when the lock releases.",
    satisfyingMotion: "pull, bend, hold, rewind",
    visualReveal: "transparent tape measure case showing the spool and coiled spring tightening",
    loopPayoff: "The tape was never resting. It was waiting to rewind.",
    visualMetaphor: "a flat metal ribbon wrapped around a hidden spring heart",
    audienceContext: "Anyone who has watched a tape measure suddenly disappear back into its case.",
    nativeSetting: "home measuring moment, hand-held close-up, furniture edge, or craft table",
    hookEmotion: "snap-back tension and mild danger from a familiar object moving fast",
    avoidVisualSetting: "construction-site tool demo or generic workbench layout",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "cam_follower_up_down",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
    appealTier: "kinetic_satisfying",
    objectOrMechanism: "cam and follower",
    titleAngle: "A circle can create a perfectly timed push",
    centralQuestion: "How can a spinning circle make another part move up and down?",
    viewerMisconception: "Round parts can only make smooth circular motion.",
    mechanismHint:
      "An off-center or shaped cam changes radius as it turns, pushing a follower up and letting it drop at specific moments.",
    satisfyingMotion: "rotate, lift, pause, drop",
    visualReveal: "side cutaway of a pear-shaped cam lifting a vertical follower",
    loopPayoff: "The circle is not really a circle to the part touching it.",
    visualMetaphor: "a rotating hill under a tiny elevator",
    audienceContext:
      "A simple looping motion that is satisfying even before the viewer knows the part name.",
    nativeSetting: "clear tabletop model, toy automaton, or transparent demo mechanism",
    hookEmotion: "hypnotic curiosity from a circle creating a timed up-down push",
    avoidVisualSetting: "generic factory machine or abstract CAD diagram",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "zip_tie_pawl_lock",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "mass_appeal",
    objectOrMechanism: "zip tie pawl and angled teeth",
    titleAngle: "A zip tie tightens forever but will not back out",
    centralQuestion: "Why can you pull a zip tie tighter but not loosen it?",
    viewerMisconception: "The plastic is just squeezed too tightly to slide back.",
    mechanismHint:
      "A flexible pawl inside the head rides over angled teeth during tightening and digs into them when pulled backward.",
    satisfyingMotion: "pull, click, flex, block",
    visualReveal: "transparent zip tie head showing the pawl biting into angled teeth",
    loopPayoff: "Each click is a tiny promise not to go backward.",
    visualMetaphor: "a one-way staircase with a plastic hook on every step",
    audienceContext: "Anyone who has pulled a zip tie tighter and found it will not loosen.",
    nativeSetting: "cable bundle, drawer organization, luggage tag, or home setup close-up",
    hookEmotion: "tension from a tiny plastic part refusing to go backward",
    avoidVisualSetting: "industrial repair bench or restraint-like framing",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "retractable_pen_clip_spring",
    selectionStatus: "active",
    mechanismFamily: "spring_locking",
    appealTier: "mass_appeal",
    objectOrMechanism: "springy pen clip",
    titleAngle: "A pen clip bends without forgetting its shape",
    centralQuestion: "Why does a pen clip snap back instead of staying bent?",
    viewerMisconception: "The clip is hinged like a tiny door.",
    mechanismHint:
      "The clip acts like a cantilever spring, flexing within its elastic range and returning when the force is removed.",
    satisfyingMotion: "bend, store, release, return",
    visualReveal: "macro side view of a plastic clip bending with stress color bands",
    loopPayoff: "The clip is not opening. It is borrowing shape and giving it back.",
    visualMetaphor: "a tiny diving board storing a push",
    audienceContext:
      "Anyone who has clipped a pen to a notebook or pocket and watched the clip spring back.",
    nativeSetting: "notebook edge, shirt pocket, desk, or hand bending a pen clip",
    hookEmotion: "curiosity about how plastic borrows shape without keeping it",
    avoidVisualSetting: "material testing lab or toolbench",
    repeatRisk: "high",
    riskLevel: "low",
  },
  {
    seedId: "folding_ruler_hinge_detent",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "workshop_tool",
    objectOrMechanism: "folding ruler hinge detent",
    titleAngle: "A small stop makes the hinge feel magnetic",
    centralQuestion: "Why does a folding ruler snap into straight sections?",
    viewerMisconception: "The hinge is simply stiff from friction.",
    mechanismHint:
      "A detent notch and small spring-loaded bump create preferred positions that resist movement until enough force is applied.",
    satisfyingMotion: "fold, snap, hold, release",
    visualReveal: "hinge cutaway showing a bump dropping into a notch",
    loopPayoff: "That snap is a tiny part choosing its favorite position.",
    visualMetaphor: "a small bead falling into a mechanical valley",
    audienceContext:
      "People recognize a segmented ruler snapping straight even if they rarely use one.",
    nativeSetting: "hand unfolding a ruler on a table, framed around the snap positions",
    hookEmotion: "satisfaction from a hinge finding its favorite positions",
    avoidVisualSetting: "carpentry tutorial or tool catalog shot",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "combination_lock_wheels",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    appealTier: "mass_appeal",
    objectOrMechanism: "combination lock wheels and gates",
    titleAngle: "The lock opens only when invisible gates line up",
    centralQuestion: "Why does the right number sequence open a combination lock?",
    viewerMisconception: "The numbers are checked electronically or by a hidden code plate.",
    mechanismHint:
      "Rotating wheels align internal gates; when every gate lines up, a fence can drop and release the lock.",
    satisfyingMotion: "rotate, align, drop, release",
    visualReveal: "transparent lock showing wheel gates lining up under a falling fence",
    loopPayoff: "The numbers work because hidden gaps finally become one path.",
    visualMetaphor: "several tiny doors lining up into a single hallway",
    audienceContext:
      "People recognize dialing numbers, but the explanation must remain principle-only and non-bypass.",
    nativeSetting:
      "transparent educational combination lock model or close-up of dial wheels lining up",
    hookEmotion: "curiosity about hidden gaps lining up into one path",
    avoidVisualSetting: "cracking, decoding, bypass, or step-by-step opening instruction",
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "socket_wrench_direction_switch",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "workshop_tool",
    objectOrMechanism: "socket wrench reversing pawl",
    titleAngle: "One tiny lever changes which direction counts",
    centralQuestion: "How does a socket wrench reverse direction with one small switch?",
    viewerMisconception: "The wrench flips the whole gear mechanism around.",
    mechanismHint:
      "The switch moves which side of the pawl catches the ratchet teeth, changing the locked direction while the other direction slips.",
    satisfyingMotion: "flip, catch, slip, turn",
    visualReveal: "cutaway showing the reversing lever shifting the pawl contact point",
    loopPayoff: "The switch does not move the bolt. It moves the rule for which clicks matter.",
    visualMetaphor: "a tiny traffic switch deciding which way the teeth are allowed to push",
    audienceContext:
      "People recognize the clicky switch and ratchet sound more than the tool mechanics.",
    nativeSetting:
      "hand flipping the direction switch and hearing the click, framed as a sound and rule-change moment",
    hookEmotion: "surprise that one tiny lever changes which clicks matter",
    avoidVisualSetting: "auto repair tutorial, dark toolbench, or bolt-removal steps",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "tripod_quick_release_plate",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
    appealTier: "workshop_tool",
    objectOrMechanism: "tripod quick-release dovetail plate",
    titleAngle: "A camera locks fast because the plate wedges sideways",
    centralQuestion: "Why does a tripod quick-release plate hold a camera so securely?",
    viewerMisconception: "The screw alone holds all the load.",
    mechanismHint:
      "The plate slides into angled rails, so clamping force wedges the camera mount sideways instead of relying only on screw friction.",
    satisfyingMotion: "slide, wedge, clamp, release",
    visualReveal: "tripod head cutaway showing a dovetail plate wedged between angled rails",
    loopPayoff: "The camera is held by a wedge before the screw does the rest.",
    visualMetaphor: "a tiny rail trap that tightens when pressed sideways",
    audienceContext:
      "Creators recognize the fast click of attaching a camera, but it should be framed as a quick-lock moment.",
    nativeSetting:
      "camera mounting moment, hand sliding a plate into a tripod head, or creator desk close-up",
    hookEmotion: "satisfaction from one slide becoming a secure lock",
    avoidVisualSetting: "equipment repair tutorial",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "ratchet_screwdriver_pawl",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    appealTier: "workshop_tool",
    objectOrMechanism: "ratchet screwdriver pawl and toothed wheel",
    titleAngle: "This tool turns one way and refuses the other",
    centralQuestion: "Why can a ratchet screwdriver turn one way but slip back the other way?",
    viewerMisconception: "The handle is simply loose in one direction.",
    mechanismHint:
      "A spring-loaded pawl catches the steep side of each tooth in one direction and slides over the angled side in the other.",
    satisfyingMotion: "click, slip, catch, turn",
    visualReveal: "pawl tooth catching on one side and gliding over the next angled tooth",
    loopPayoff: "Every click is the tool choosing which direction counts.",
    visualMetaphor: "a tiny gate that opens one way and becomes a wall the other way",
    audienceContext: "People recognize the clicking sound even if they do not know the tool name.",
    nativeSetting:
      "a close hand-held screw-turning moment, framed around the click sound and one-way behavior",
    hookEmotion: "disbelief that only one direction counts",
    avoidVisualSetting:
      "repair tutorial, dark workbench beauty shot, or step-by-step tool instruction",
    repeatRisk: "medium",
    riskLevel: "low",
  },
];

function legacySeed(input: LegacySeedInput): TinyMechanismsSeed {
  return {
    seedId: input.seedId,
    selectionStatus: "legacy",
    mechanismFamily: "legacy_everyday",
    appealTier: "mass_appeal",
    objectOrMechanism: input.everydayObjectOrPhenomenon,
    titleAngle: input.centralQuestion,
    centralQuestion: input.centralQuestion,
    viewerMisconception: "The familiar object or phenomenon is simple and has no hidden mechanism.",
    mechanismHint: input.mechanismHint,
    satisfyingMotion: "reveal, compare, resolve",
    visualReveal: input.visualMetaphor,
    loopPayoff: "The hidden mechanism changes how the opening moment reads.",
    visualMetaphor: input.visualMetaphor,
    audienceContext: `A familiar everyday moment involving ${input.everydayObjectOrPhenomenon}.`,
    nativeSetting: "a familiar everyday setting where the object naturally appears",
    hookEmotion: "curiosity from seeing a familiar thing behave differently than expected",
    avoidVisualSetting: "generic laboratory, workshop bench, or abstract diagram by default",
    repeatRisk: "high",
    riskLevel: "low",
  };
}

const TINY_MECHANISMS_LEGACY_SEEDS: TinyMechanismsSeed[] = [
  legacySeed({
    seedId: "recorded_voice",
    centralQuestion: "Why your recorded voice sounds wrong",
    everydayObjectOrPhenomenon: "a recorded human voice",
    mechanismHint:
      "Bone conduction makes your own voice sound deeper to you than it sounds through air to everyone else.",
    visualMetaphor: "sound waves traveling through a translucent skull and through open air",
  }),
  legacySeed({
    seedId: "round_airplane_windows",
    centralQuestion: "Why airplane windows are round",
    everydayObjectOrPhenomenon: "airplane windows",
    mechanismHint:
      "Rounded corners spread stress more evenly than sharp corners in a pressurized cabin.",
    visualMetaphor: "stress lines flowing smoothly around a round airplane window",
  }),
  legacySeed({
    seedId: "onion_tears",
    centralQuestion: "Why onions make your eyes water",
    everydayObjectOrPhenomenon: "cut onions",
    mechanismHint: "Cut onion cells release compounds that react into an eye-irritating gas.",
    visualMetaphor: "microscopic onion cells releasing a faint vapor toward an eye silhouette",
  }),
  legacySeed({
    seedId: "cold_batteries",
    centralQuestion: "Why batteries drain faster in the cold",
    everydayObjectOrPhenomenon: "batteries in cold weather",
    mechanismHint: "Cold slows the chemical reactions that move charge through the battery.",
    visualMetaphor: "a frosted battery cross-section with sluggish glowing particles",
  }),
  legacySeed({
    seedId: "microwave_cold_spots",
    centralQuestion: "Why microwave ovens leave cold spots",
    everydayObjectOrPhenomenon: "microwave heating",
    mechanismHint:
      "Standing wave patterns create hot and cold zones unless food moves through them.",
    visualMetaphor: "invisible wave bands crossing a plate with alternating warm and cold patches",
  }),
  legacySeed({
    seedId: "damaged_qr_codes",
    centralQuestion: "Why QR codes still work when scratched",
    everydayObjectOrPhenomenon: "damaged QR codes",
    mechanismHint: "QR codes include error correction so missing pieces can be reconstructed.",
    visualMetaphor: "a torn QR code still forming a readable square pattern",
  }),
  legacySeed({
    seedId: "soap_bubbles_round",
    centralQuestion: "Why soap bubbles are round",
    everydayObjectOrPhenomenon: "soap bubbles",
    mechanismHint:
      "Surface tension pulls the film into the smallest possible area for the trapped air.",
    visualMetaphor: "a soap film tightening into a sphere with rainbow highlights",
  }),
  legacySeed({
    seedId: "mirror_flip",
    centralQuestion: "Why mirrors appear to flip left and right",
    everydayObjectOrPhenomenon: "mirrors",
    mechanismHint:
      "Mirrors reverse depth, not left and right; the apparent flip comes from how people imagine turning around.",
    visualMetaphor: "a person silhouette and reflected axes showing front-back reversal",
  }),
  legacySeed({
    seedId: "noise_cancelling",
    centralQuestion: "Why noise-cancelling headphones work better on steady sounds",
    everydayObjectOrPhenomenon: "noise-cancelling headphones",
    mechanismHint:
      "Predictable low-frequency noise is easier to cancel with an opposite sound wave than sudden irregular noise.",
    visualMetaphor: "two opposite waveforms flattening into a quiet line around headphones",
  }),
  legacySeed({
    seedId: "barcode_scanners",
    centralQuestion: "Why barcode scanners can read black and white stripes",
    everydayObjectOrPhenomenon: "barcodes",
    mechanismHint:
      "The scanner measures reflected light differences and decodes the stripe widths into numbers.",
    visualMetaphor: "a red scanning beam turning stripe widths into a digital number trail",
  }),
  legacySeed({
    seedId: "credit_card_chips",
    centralQuestion: "Why credit card chips are safer than magnetic stripes",
    everydayObjectOrPhenomenon: "credit card chips",
    mechanismHint:
      "Chip cards can create transaction-specific data instead of exposing one reusable magnetic pattern.",
    visualMetaphor: "a card chip creating a one-time glowing key beside a faded magnetic stripe",
  }),
  legacySeed({
    seedId: "autofocus_sharpness",
    centralQuestion: "Why autofocus can tell an image is sharp",
    everydayObjectOrPhenomenon: "camera autofocus",
    mechanismHint:
      "Autofocus looks for contrast and phase alignment to decide when edges are crisp.",
    visualMetaphor: "a camera sensor locking onto a crisp edge after a blurred edge",
  }),
  legacySeed({
    seedId: "popcorn_pops",
    centralQuestion: "Why popcorn kernels pop",
    everydayObjectOrPhenomenon: "popcorn",
    mechanismHint:
      "Water inside the kernel turns to steam until pressure ruptures the shell and expands the starch.",
    visualMetaphor: "a popcorn kernel cross-section building steam pressure",
  }),
  legacySeed({
    seedId: "ice_floats",
    centralQuestion: "Why ice floats instead of sinking",
    everydayObjectOrPhenomenon: "ice cubes",
    mechanismHint:
      "Water expands as it freezes into an open crystal structure, making ice less dense.",
    visualMetaphor: "open crystal lattice inside a floating ice cube",
  }),
  legacySeed({
    seedId: "thermos_insulation",
    centralQuestion: "Why a thermos keeps drinks hot or cold",
    everydayObjectOrPhenomenon: "a thermos",
    mechanismHint:
      "A vacuum layer slows heat transfer by removing most conduction and convection paths.",
    visualMetaphor: "a thermos cross-section with heat arrows blocked by a vacuum gap",
  }),
  legacySeed({
    seedId: "nonstick_pans",
    centralQuestion: "Why food slides off nonstick pans",
    everydayObjectOrPhenomenon: "nonstick pans",
    mechanismHint:
      "Low-surface-energy coatings make it harder for food molecules and oils to grip the pan surface.",
    visualMetaphor: "a fried egg gliding over a smooth microscopic surface like water on wax",
  }),
  legacySeed({
    seedId: "stainless_steel_garlic_smell",
    centralQuestion: "Why stainless steel can reduce garlic smell",
    everydayObjectOrPhenomenon: "garlic smell on hands",
    mechanismHint:
      "Sulfur-containing odor compounds can bind to stainless steel surfaces instead of staying on skin.",
    visualMetaphor:
      "tiny sulfur particles leaving fingertips and attaching to a brushed steel surface",
  }),
  legacySeed({
    seedId: "soda_fizz",
    centralQuestion: "Why soda fizzes when you open it",
    everydayObjectOrPhenomenon: "carbonated soda",
    mechanismHint:
      "Opening the bottle lowers pressure, so dissolved carbon dioxide escapes as bubbles.",
    visualMetaphor: "carbon dioxide bubbles rushing out of a dark soda like released springs",
  }),
  legacySeed({
    seedId: "compass_north",
    centralQuestion: "Why a compass points north",
    everydayObjectOrPhenomenon: "a compass needle",
    mechanismHint:
      "A magnetized needle aligns with Earth's magnetic field, which roughly points toward magnetic north.",
    visualMetaphor: "a compass needle floating inside faint magnetic field lines around Earth",
  }),
  legacySeed({
    seedId: "rubber_bands_snap_back",
    centralQuestion: "Why rubber bands snap back",
    everydayObjectOrPhenomenon: "rubber bands",
    mechanismHint:
      "Stretching lines up tangled polymer chains, and entropy pulls them back toward a more disordered shape.",
    visualMetaphor: "tangled elastic strands stretching straight, then curling back into loops",
  }),
  legacySeed({
    seedId: "washing_machine_spin",
    centralQuestion: "Why a washing machine spin cycle dries clothes",
    everydayObjectOrPhenomenon: "washing machine spin cycle",
    mechanismHint:
      "Fast rotation forces water out through drum holes while fabric stays inside the spinning basket.",
    visualMetaphor: "water droplets flinging outward from clothes against a perforated metal drum",
  }),
  legacySeed({
    seedId: "traffic_light_colors",
    centralQuestion: "Why traffic lights use red, yellow, and green",
    everydayObjectOrPhenomenon: "traffic light colors",
    mechanismHint:
      "The colors combine visibility, historical signaling conventions, and easy category separation.",
    visualMetaphor: "three colored signals cutting through mist at different attention levels",
  }),
  legacySeed({
    seedId: "stop_sign_octagons",
    centralQuestion: "Why stop signs are octagons",
    everydayObjectOrPhenomenon: "stop signs",
    mechanismHint:
      "A unique shape lets drivers recognize the sign from the back, side, or in poor visibility.",
    visualMetaphor: "an octagon silhouette standing out among circles, triangles, and rectangles",
  }),
  legacySeed({
    seedId: "pencils_write",
    centralQuestion: "Why pencils write on paper",
    everydayObjectOrPhenomenon: "pencils",
    mechanismHint:
      "Graphite layers slide off onto rough paper fibers, leaving a dark trail without melting or ink.",
    visualMetaphor: "thin graphite sheets peeling from a pencil tip onto paper fibers",
  }),
  legacySeed({
    seedId: "sticky_notes_peel",
    centralQuestion: "Why sticky notes peel off cleanly",
    everydayObjectOrPhenomenon: "sticky notes",
    mechanismHint:
      "Low-tack adhesive makes many weak contact points, enough to hold paper but weak enough to release.",
    visualMetaphor: "tiny soft adhesive dots letting go from a desk surface one by one",
  }),
  legacySeed({
    seedId: "ice_cubes_crack",
    centralQuestion: "Why ice cubes crack in warm drinks",
    everydayObjectOrPhenomenon: "ice cubes in drinks",
    mechanismHint:
      "The outside warms and expands faster than the cold center, creating stress that fractures the ice.",
    visualMetaphor: "crack lines racing through a clear ice cube as warm liquid surrounds it",
  }),
];

export const TINY_MECHANISMS_SEEDS: TinyMechanismsSeed[] = [
  ...TINY_MECHANISMS_ACTIVE_SEEDS,
  ...TINY_MECHANISMS_LEGACY_SEEDS,
];

export function encodeTinyMechanismsTopic(seedId: string) {
  return `${TINY_MECHANISMS_TOPIC_PREFIX}${seedId}`;
}

export function parseTinyMechanismsSeedId(topic: string): string | null {
  if (!topic.startsWith(TINY_MECHANISMS_TOPIC_PREFIX)) {
    return null;
  }

  return topic.slice(TINY_MECHANISMS_TOPIC_PREFIX.length);
}

export function getTinyMechanismsSeed(seedId: string) {
  return TINY_MECHANISMS_SEEDS.find((seed) => seed.seedId === seedId) ?? null;
}

export function pickNextTinyMechanismsSeed(usedSeedIds: Iterable<string>) {
  const used = new Set(usedSeedIds);
  const seed = TINY_MECHANISMS_ACTIVE_SEEDS.find((candidate) => !used.has(candidate.seedId));

  if (!seed) {
    throw new Error("tiny_mechanisms_seed_bank_exhausted");
  }

  return seed;
}

export function tinyMechanismsProjectTitle(seed: TinyMechanismsSeed) {
  return `Tiny Mechanisms: ${seed.centralQuestion}`;
}
