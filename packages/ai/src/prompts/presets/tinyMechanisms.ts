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

export type TinyMechanismsSeed = {
  seedId: string;
  selectionStatus: "active" | "legacy";
  mechanismFamily: TinyMechanismsMechanismFamily;
  objectOrMechanism: string;
  titleAngle: string;
  centralQuestion: string;
  viewerMisconception: string;
  mechanismHint: string;
  satisfyingMotion: string;
  visualReveal: string;
  loopPayoff: string;
  visualMetaphor: string;
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
  "Captions: short mobile-readable beat summaries, not full narration paragraphs.",
  "Image direction: social-native macro mechanism frames with real objects, cutaways, springs, cams, latches, gears, pawls, tracks, levers, valves, material texture, and no embedded text, logos, UI, or public figures.",
  "Retention: start from an impossible-looking behavior, reveal the hidden mechanism, and end with a loop payoff that reinterprets the first shot.",
].join("\n");

export const TINY_MECHANISMS_ACTIVE_SEEDS: [TinyMechanismsSeed, ...TinyMechanismsSeed[]] = [
  {
    seedId: "click_pen_cam_lock",
    selectionStatus: "active",
    mechanismFamily: "spring_locking",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "zipper_locking",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "ratchet_screwdriver_pawl",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "tape_measure_coiled_spring",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "watch_escapement_ticks",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "cam_follower_up_down",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "spray_bottle_check_valves",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "phone_screen_rotation",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
    objectOrMechanism: "phone MEMS accelerometer",
    titleAngle: "Your phone has a tiny moving weight that feels gravity",
    centralQuestion: "How does your phone know it turned sideways?",
    viewerMisconception: "The screen rotates because the camera or software sees the phone move.",
    mechanismHint:
      "A tiny suspended mass inside a motion sensor shifts relative to electrodes, letting software infer gravity direction.",
    satisfyingMotion: "tilt, shift, sense, rotate",
    visualReveal: "phone cutaway showing a microscopic suspended mass shifting as gravity arrows rotate",
    loopPayoff: "The screen turns because a tiny weight moved first.",
    visualMetaphor: "a microscopic pendulum trapped inside a silicon maze",
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "door_latch_beveled_tongue",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "mechanical_pencil_clutch",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "zip_tie_pawl_lock",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "pullback_toy_spring_motor",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "windup_music_box_comb",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "crank_slider_toy_engine",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "soap_pump_one_way_valve",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "camera_lens_aperture_blades",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "umbrella_runner_lock",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "hook_and_loop_fasteners",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "bike_freewheel_clicks",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "stapler_spring_return",
    selectionStatus: "active",
    mechanismFamily: "stored_energy",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "kitchen_timer_gear_train",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "scissors_lever_crossing",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "bicycle_pump_check_valve",
    selectionStatus: "active",
    mechanismFamily: "fluid_valve",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "garden_hose_quick_connector_lock",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "escalator_steps_level",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "padlock_shackle_latch",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "seatbelt_retractor_lock",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "retractable_pen_clip_spring",
    selectionStatus: "active",
    mechanismFamily: "spring_locking",
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
    repeatRisk: "high",
    riskLevel: "low",
  },
  {
    seedId: "metronome_sliding_weight",
    selectionStatus: "active",
    mechanismFamily: "timing_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "nail_clipper_compound_lever",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "camera_autofocus_lens_group",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "drawer_slide_ball_bearings",
    selectionStatus: "active",
    mechanismFamily: "guided_track",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "folding_ruler_hinge_detent",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "manual_can_opener_gear_bite",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "toy_gearbox_speed_tradeoff",
    selectionStatus: "active",
    mechanismFamily: "motion_conversion",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "combination_lock_wheels",
    selectionStatus: "active",
    mechanismFamily: "precision_alignment",
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
    repeatRisk: "low",
    riskLevel: "low",
  },
  {
    seedId: "tripod_quick_release_plate",
    selectionStatus: "active",
    mechanismFamily: "grip_and_release",
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
    repeatRisk: "medium",
    riskLevel: "low",
  },
  {
    seedId: "socket_wrench_direction_switch",
    selectionStatus: "active",
    mechanismFamily: "one_way_ratchet",
    objectOrMechanism: "socket wrench reversing pawl",
    titleAngle: "One tiny lever changes which direction counts",
    centralQuestion: "How does a socket wrench reverse direction with one small switch?",
    viewerMisconception: "The wrench flips the whole gear mechanism around.",
    mechanismHint:
      "The switch moves which side of the pawl catches the ratchet teeth, changing the locked direction while the other direction slips.",
    satisfyingMotion: "flip, catch, slip, turn",
    visualReveal: "cutaway showing the reversing lever shifting the pawl contact point",
    loopPayoff:
      "The switch does not move the bolt. It moves the rule for which clicks matter.",
    visualMetaphor: "a tiny traffic switch deciding which way the teeth are allowed to push",
    repeatRisk: "medium",
    riskLevel: "low",
  },
];

function legacySeed(input: LegacySeedInput): TinyMechanismsSeed {
  return {
    seedId: input.seedId,
    selectionStatus: "legacy",
    mechanismFamily: "legacy_everyday",
    objectOrMechanism: input.everydayObjectOrPhenomenon,
    titleAngle: input.centralQuestion,
    centralQuestion: input.centralQuestion,
    viewerMisconception: "The familiar object or phenomenon is simple and has no hidden mechanism.",
    mechanismHint: input.mechanismHint,
    satisfyingMotion: "reveal, compare, resolve",
    visualReveal: input.visualMetaphor,
    loopPayoff: "The hidden mechanism changes how the opening moment reads.",
    visualMetaphor: input.visualMetaphor,
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
    mechanismHint: "Rounded corners spread stress more evenly than sharp corners in a pressurized cabin.",
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
    mechanismHint: "Standing wave patterns create hot and cold zones unless food moves through them.",
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
    mechanismHint: "Surface tension pulls the film into the smallest possible area for the trapped air.",
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
    mechanismHint: "The scanner measures reflected light differences and decodes the stripe widths into numbers.",
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
    mechanismHint: "Autofocus looks for contrast and phase alignment to decide when edges are crisp.",
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
    mechanismHint: "Water expands as it freezes into an open crystal structure, making ice less dense.",
    visualMetaphor: "open crystal lattice inside a floating ice cube",
  }),
  legacySeed({
    seedId: "thermos_insulation",
    centralQuestion: "Why a thermos keeps drinks hot or cold",
    everydayObjectOrPhenomenon: "a thermos",
    mechanismHint: "A vacuum layer slows heat transfer by removing most conduction and convection paths.",
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
    visualMetaphor: "tiny sulfur particles leaving fingertips and attaching to a brushed steel surface",
  }),
  legacySeed({
    seedId: "soda_fizz",
    centralQuestion: "Why soda fizzes when you open it",
    everydayObjectOrPhenomenon: "carbonated soda",
    mechanismHint: "Opening the bottle lowers pressure, so dissolved carbon dioxide escapes as bubbles.",
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
