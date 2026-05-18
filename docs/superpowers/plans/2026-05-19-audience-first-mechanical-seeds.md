# Audience-First Mechanical Seeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `tiny_mechanisms` preset so new generated scripts feel like mass-appeal everyday hidden-mechanism Shorts, not a narrow workshop/tool explanation channel.

**Architecture:** Keep the change in the prompt layer. Enrich `TinyMechanismsSeed` with audience-facing editorial fields, reorder active seeds into an audience-first publishing sequence, and tune script/image prompts to prefer native everyday settings over workbench defaults. Existing DB rows, API contracts, worker jobs, scene schema, Remotion inputs, and legacy seed resolution remain unchanged.

**Tech Stack:** Bun, TypeScript, `bun:test`, existing `@short-workflow/ai` prompt registry.

---

## Context

Latest DB scripts after the mechanical seed bank change showed a clear pattern:

- `click_pen_cam_lock`: strong everyday hook.
- `zipper_locking`: strong everyday hook.
- `ratchet_screwdriver_pawl`: factually correct, but too tool/workshop-focused.
- `tape_measure_coiled_spring`: factually correct, but visually over-indexed on workshop tabletop.

Root cause:

- Active seed order put workshop/tool episodes too early.
- Seed fields describe mechanisms but not the viewer context or emotional hook.
- Script and image prompts over-emphasize cutaways, tabletop demonstrations, steel, pawls, ratchets, and toolbench materiality.

Target editorial model:

```text
Everyday Object -> Strange Behavior -> Hidden Mechanism -> Satisfying Reveal
```

The channel should still explain real mechanisms, but the opening promise should be accessible to people who recognize the object from daily life, not only people who already care about tools.

## File Structure

- Modify `docs/superpowers/specs/2026-05-18-mechanical-episode-bank-design.md`
  - Add an audience-first addendum so the approved design reflects this correction before code changes.
- Modify `packages/ai/src/prompts/presets/tinyMechanisms.ts`
  - Extend `TinyMechanismsSeed` with audience-facing fields.
  - Add default legacy values in `legacySeed()`.
  - Reorder `TINY_MECHANISMS_ACTIVE_SEEDS` so mass-appeal and kinetic-satisfying topics lead the queue.
- Modify `packages/ai/src/prompts/scriptPlan.ts`
  - Bump `scriptPlanPrompt.version` from `5` to `6`.
  - Add new seed fields to the compiled user message.
  - Add developer rules that force everyday hooks, native settings, and non-tutorial framing.
- Modify `packages/ai/src/prompts/imagePrompt.ts`
  - Bump `imagePromptTemplate.version` from `4` to `5`.
  - Replace workshop/tabletop-default wording with native-setting-first visual rules.
- Modify `packages/ai/src/prompts/review.ts`
  - Review a representative audience-first mix: everyday, kinetic-satisfying, and tool-risk seed.
- Modify `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`
  - Add targeted prompt compile tests for the new editorial fields, seed ordering, script prompt constraints, and image prompt constraints.

No migration, API, worker, frontend, or render changes are part of this plan.

---

### Task 1: Add Audience-First Spec Addendum

**Files:**
- Modify: `docs/superpowers/specs/2026-05-18-mechanical-episode-bank-design.md`

- [ ] **Step 1: Append the audience-first correction**

Append this section after the current `Prompt Changes` section or before `Initial Active Seed Set`:

```markdown
## Audience-First Correction

Early generated scripts showed that a purely mechanism-first bank can drift into a workshop/tool explanation channel. The preset should instead frame each episode as:

```text
Everyday Object -> Strange Behavior -> Hidden Mechanism -> Satisfying Reveal
```

The mechanism remains real, but the viewer-facing hook must start from a familiar object behavior, sound, risk, surprise, or satisfying motion. The script should avoid sounding like a repair tutorial, tool demo, or engineering lecture.

New active seeds should carry audience-facing fields:

```ts
appealTier: "mass_appeal" | "kinetic_satisfying" | "workshop_tool";
audienceContext: string;
nativeSetting: string;
hookEmotion: string;
avoidVisualSetting: string;
```

Field meanings:

- `appealTier`: editorial priority for selection order. `mass_appeal` and `kinetic_satisfying` should lead the active bank. `workshop_tool` should be sparse and never dominate early generation.
- `audienceContext`: why a non-engineer recognizes or cares about the object.
- `nativeSetting`: the preferred real-world setting for visuals.
- `hookEmotion`: the viewer feeling the hook should create, such as surprise, tension, relief, disbelief, or satisfying completion.
- `avoidVisualSetting`: visual defaults that would make the episode feel too generic or too workshop-like.

Prompt guidance must prefer native everyday settings over workbench defaults. Workbench, repair bench, dark tabletop, exploded tool demos, and generic steel-part closeups should appear only when the selected seed explicitly requires them.

The active seed order should prioritize everyday objects first. Tool-focused seeds such as ratchet screwdriver, socket wrench, tripod quick-release, and manual can opener remain valid, but they should be framed through sound, surprising behavior, or everyday outcome rather than repair instructions.
```

- [ ] **Step 2: Review the spec addendum for scope**

Confirm the addendum does not introduce:

- database changes
- user-facing seed picker
- trend scraping
- AI video transformation
- audio sound-effect pipeline
- publishing automation

Expected: the addendum is prompt-layer only.

- [ ] **Step 3: Commit the spec update**

```bash
git add docs/superpowers/specs/2026-05-18-mechanical-episode-bank-design.md
git commit -m "docs: add audience-first mechanical seed correction"
```

---

### Task 2: Add Failing Tests for Audience-First Seed Metadata

**Files:**
- Modify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`

- [ ] **Step 1: Add tests for seed appeal fields and front-loaded order**

Add these tests inside the existing `describe("mechanical episode bank", () => { ... })` block:

```ts
  test("active seeds include audience-first editorial fields", () => {
    const clickPen = getTinyMechanismsSeed("click_pen_cam_lock");
    expect(clickPen?.selectionStatus).toBe("active");
    expect(clickPen?.appealTier).toBe("mass_appeal");
    expect(clickPen?.audienceContext).toContain("pen");
    expect(clickPen?.nativeSetting).toContain("desk");
    expect(clickPen?.hookEmotion).toContain("same press");
    expect(clickPen?.avoidVisualSetting).toContain("workbench");
  });

  test("first twelve active seeds avoid workshop-tool dominance", () => {
    const firstTwelve = TINY_MECHANISMS_ACTIVE_SEEDS.slice(0, 12);
    expect(firstTwelve).toHaveLength(12);
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("ratchet_screwdriver_pawl");
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("socket_wrench_direction_switch");
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("tripod_quick_release_plate");
    expect(firstTwelve.filter((seed) => seed.appealTier === "workshop_tool")).toHaveLength(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: FAIL because `appealTier`, `audienceContext`, `nativeSetting`, `hookEmotion`, and `avoidVisualSetting` do not exist yet.

---

### Task 3: Extend the Seed Type and Legacy Defaults

**Files:**
- Modify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`

- [ ] **Step 1: Add the appeal tier type**

Near `TinyMechanismsMechanismFamily`, add:

```ts
export type TinyMechanismsAppealTier =
  | "mass_appeal"
  | "kinetic_satisfying"
  | "workshop_tool";
```

- [ ] **Step 2: Extend `TinyMechanismsSeed`**

Update `TinyMechanismsSeed` to include the new fields:

```ts
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
```

- [ ] **Step 3: Add legacy defaults**

Update `legacySeed()` so old projects remain resolvable without needing per-legacy editorial data:

```ts
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
```

- [ ] **Step 4: Run the test to verify the type errors move to missing active seed fields**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: TypeScript/Bun test still fails because active seeds have not all been populated with the new required fields.

---

### Task 4: Populate Active Seeds and Reorder the Queue

**Files:**
- Modify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`

- [ ] **Step 1: Add fields to the first active seed**

Update `click_pen_cam_lock` with these fields after `mechanismFamily`:

```ts
    appealTier: "mass_appeal",
```

Add these fields before `repeatRisk`:

```ts
    audienceContext: "Anyone who has clicked a pen and noticed the same press can do opposite things.",
    nativeSetting: "a desk, notebook, pocket, or hand-held writing moment",
    hookEmotion: "surprise that the same press has mechanical memory",
    avoidVisualSetting: "dark repair workbench or generic tool demonstration",
```

- [ ] **Step 2: Populate all active seeds**

Add `appealTier`, `audienceContext`, `nativeSetting`, `hookEmotion`, and `avoidVisualSetting` to every active seed.

Use these values:

```ts
// zipper_locking
appealTier: "mass_appeal",
audienceContext: "Anyone who has zipped a jacket, bag, or pouch and expects it to stay closed under pulling.",
nativeSetting: "jacket fabric, backpack fabric, travel pouch, or clothing close-up",
hookEmotion: "tension from fabric being pulled sideways without bursting open",
avoidVisualSetting: "bare metal parts on a workshop table",

// ratchet_screwdriver_pawl
appealTier: "workshop_tool",
audienceContext: "People recognize the clicking sound even if they do not know the tool name.",
nativeSetting: "a close hand-held screw-turning moment, framed around the click sound and one-way behavior",
hookEmotion: "disbelief that only one direction counts",
avoidVisualSetting: "repair tutorial, dark workbench beauty shot, or step-by-step tool instruction",

// tape_measure_coiled_spring
appealTier: "workshop_tool",
audienceContext: "Anyone who has watched a tape measure suddenly disappear back into its case.",
nativeSetting: "home measuring moment, hand-held close-up, furniture edge, or craft table",
hookEmotion: "snap-back tension and mild danger from a familiar object moving fast",
avoidVisualSetting: "construction-site tool demo or generic workbench layout",

// watch_escapement_ticks
appealTier: "kinetic_satisfying",
audienceContext: "People know the tick of a watch even if they have never seen the mechanism.",
nativeSetting: "macro watch movement, open caseback, jeweler-style close-up",
hookEmotion: "satisfaction from time being released one tooth at a time",
avoidVisualSetting: "oversized industrial gear collage",

// cam_follower_up_down
appealTier: "kinetic_satisfying",
audienceContext: "A simple looping motion that is satisfying even before the viewer knows the part name.",
nativeSetting: "clear tabletop model, toy automaton, or transparent demo mechanism",
hookEmotion: "hypnotic curiosity from a circle creating a timed up-down push",
avoidVisualSetting: "generic factory machine or abstract CAD diagram",

// spray_bottle_check_valves
appealTier: "mass_appeal",
audienceContext: "Anyone who has squeezed a spray bottle and expects liquid to climb a straw.",
nativeSetting: "cleaning bottle, plant mister, bathroom spray, or kitchen counter close-up",
hookEmotion: "curiosity about how one squeeze pulls liquid upward",
avoidVisualSetting: "workshop pump teardown",

// phone_screen_rotation
appealTier: "mass_appeal",
audienceContext: "Anyone who has turned a phone sideways and watched the screen rotate.",
nativeSetting: "hand holding a phone on a couch, desk, or bed",
hookEmotion: "surprise that a tiny moving weight helps the phone feel gravity",
avoidVisualSetting: "floating circuit-board sci-fi view",

// door_latch_beveled_tongue
appealTier: "mass_appeal",
audienceContext: "Anyone who has pushed a door closed without turning the handle.",
nativeSetting: "home door frame, bedroom door, cabinet door, or close-up of a latch meeting the strike plate",
hookEmotion: "realization that one side acts like a ramp and the other side acts like a wall",
avoidVisualSetting: "locksmith tutorial or security bypass framing",

// mechanical_pencil_clutch
appealTier: "mass_appeal",
audienceContext: "Students, artists, and note-takers recognize the tiny lead advancing one click at a time.",
nativeSetting: "notebook, sketchbook, desk, or hand writing close-up",
hookEmotion: "curiosity about how fragile lead moves without falling out",
avoidVisualSetting: "engineering bench teardown",

// zip_tie_pawl_lock
appealTier: "mass_appeal",
audienceContext: "Anyone who has pulled a zip tie tighter and found it will not loosen.",
nativeSetting: "cable bundle, drawer organization, luggage tag, or home setup close-up",
hookEmotion: "tension from a tiny plastic part refusing to go backward",
avoidVisualSetting: "industrial repair bench or restraint-like framing",

// pullback_toy_spring_motor
appealTier: "mass_appeal",
audienceContext: "A familiar toy moment where pulling backward somehow creates forward motion.",
nativeSetting: "toy car on a floor, table, or child-free play surface close-up",
hookEmotion: "delight from a backward pull becoming a launch",
avoidVisualSetting: "garage toolbench or realistic car repair framing",

// windup_music_box_comb
appealTier: "kinetic_satisfying",
audienceContext: "People recognize the delicate sound and want to see how bumps become music.",
nativeSetting: "open music box, keepsake box, or macro brass mechanism close-up",
hookEmotion: "wonder that a melody is stored as tiny bumps",
avoidVisualSetting: "industrial gear assembly",

// crank_slider_toy_engine
appealTier: "kinetic_satisfying",
audienceContext: "A simple visible motion puzzle: spinning becomes straight pushing.",
nativeSetting: "clear toy engine model or hand-cranked demo",
hookEmotion: "satisfaction from a circle turning into a piston stroke",
avoidVisualSetting: "real engine repair tutorial or greasy workshop view",

// soap_pump_one_way_valve
appealTier: "mass_appeal",
audienceContext: "Anyone who has pressed a soap pump and watched it refill for the next press.",
nativeSetting: "bathroom sink, kitchen sink, or clean countertop dispenser",
hookEmotion: "curiosity about how thick liquid climbs and does not fall back",
avoidVisualSetting: "lab pump teardown",

// camera_lens_aperture_blades
appealTier: "kinetic_satisfying",
audienceContext: "A visually satisfying iris motion even for viewers who are not photographers.",
nativeSetting: "camera lens macro, clean desk, or hand-held lens close-up",
hookEmotion: "satisfaction from sliding blades forming a changing circle",
avoidVisualSetting: "abstract camera sensor diagram",

// umbrella_runner_lock
appealTier: "mass_appeal",
audienceContext: "Anyone who has pushed an umbrella open and heard it snap into place.",
nativeSetting: "rainy doorway, hand-held umbrella shaft, or entryway close-up",
hookEmotion: "relief that one tiny catch holds the whole canopy open",
avoidVisualSetting: "metal parts laid out on a bench",

// hook_and_loop_fasteners
appealTier: "mass_appeal",
audienceContext: "Anyone who has pressed and peeled a hook-and-loop strip and heard the ripping release.",
nativeSetting: "shoe strap, bag flap, jacket cuff, or fabric close-up",
hookEmotion: "satisfaction from thousands of tiny hooks releasing row by row",
avoidVisualSetting: "microscope-only science diagram",

// bike_freewheel_clicks
appealTier: "mass_appeal",
audienceContext: "Cyclists and casual riders recognize the clicking sound while coasting.",
nativeSetting: "bike wheel close-up, driveway, bike stand, or hand-spun rear wheel",
hookEmotion: "curiosity about why coasting clicks but pedaling drives",
avoidVisualSetting: "bike repair tutorial framing",

// stapler_spring_return
appealTier: "mass_appeal",
audienceContext: "Anyone who has pressed a stapler and watched it pop back open.",
nativeSetting: "desk, paper stack, office surface, or schoolwork close-up",
hookEmotion: "satisfaction from punch and instant reset",
avoidVisualSetting: "hardware repair bench",

// kitchen_timer_gear_train
appealTier: "mass_appeal",
audienceContext: "Anyone who has twisted a kitchen timer and heard it tick down.",
nativeSetting: "kitchen counter, oven-side counter, or hand turning a timer",
hookEmotion: "curiosity about why the spring spends energy slowly",
avoidVisualSetting: "generic clock repair table",

// scissors_lever_crossing
appealTier: "mass_appeal",
audienceContext: "Anyone who has cut paper and felt a small squeeze become a sharp bite.",
nativeSetting: "paper, craft table, packaging, or desk close-up",
hookEmotion: "surprise that two crossing levers focus force at one moving point",
avoidVisualSetting: "tool catalog beauty shot",

// bicycle_pump_check_valve
appealTier: "mass_appeal",
audienceContext: "Anyone who has pumped a tire and wondered why air does not rush back out.",
nativeSetting: "bike tire, pump head, garage floor, driveway, or hand pumping close-up",
hookEmotion: "relief that a tiny door closes faster than air can escape",
avoidVisualSetting: "industrial compressor diagram",

// garden_hose_quick_connector_lock
appealTier: "mass_appeal",
audienceContext: "Anyone who has clicked a hose connector together and trusted it under water pressure.",
nativeSetting: "garden hose, outdoor faucet, wet hand close-up, or backyard setting",
hookEmotion: "tension from water pressure trying to pull parts apart",
avoidVisualSetting: "plumbing repair tutorial",

// escalator_steps_level
appealTier: "mass_appeal",
audienceContext: "Anyone who has stood on escalator steps and assumed each step balances itself.",
nativeSetting: "mall escalator side cutaway style, public escalator detail, or clean transit close-up",
hookEmotion: "surprise that hidden tracks force the steps flat",
avoidVisualSetting: "factory conveyor system",

// padlock_shackle_latch
appealTier: "mass_appeal",
audienceContext: "People recognize a padlock snap shut, but the explanation must stay non-bypass and principle-only.",
nativeSetting: "transparent educational padlock model or close-up of a lock snapping shut",
hookEmotion: "curiosity about what holds the metal loop after the snap",
avoidVisualSetting: "lock-picking, decoding, bypass, locksmith tutorial, or unauthorized-opening framing",

// seatbelt_retractor_lock
appealTier: "mass_appeal",
audienceContext: "Anyone who has slowly pulled a seatbelt, then had it lock when yanked.",
nativeSetting: "car interior, seatbelt strap close-up, or retractor cutaway model",
hookEmotion: "surprise that speed wakes up a tiny lock",
avoidVisualSetting: "crash scene, danger dramatization, or repair bench",

// retractable_pen_clip_spring
appealTier: "mass_appeal",
audienceContext: "Anyone who has clipped a pen to a notebook or pocket and watched the clip spring back.",
nativeSetting: "notebook edge, shirt pocket, desk, or hand bending a pen clip",
hookEmotion: "curiosity about how plastic borrows shape without keeping it",
avoidVisualSetting: "material testing lab or toolbench",

// metronome_sliding_weight
appealTier: "kinetic_satisfying",
audienceContext: "People recognize the hypnotic tick and swinging weight even without music theory.",
nativeSetting: "piano top, practice room, desk, or macro pendulum close-up",
hookEmotion: "satisfaction from a visible swing changing rhythm",
avoidVisualSetting: "physics classroom diagram",

// nail_clipper_compound_lever
appealTier: "mass_appeal",
audienceContext: "Anyone who has felt a tiny press become a sudden snap.",
nativeSetting: "bathroom counter, grooming kit, or hand-held nail clipper close-up without graphic detail",
hookEmotion: "surprise that stacked levers turn a soft press into a hard bite",
avoidVisualSetting: "medical, injury, or tool teardown framing",

// camera_autofocus_lens_group
appealTier: "mass_appeal",
audienceContext: "Anyone who has watched a blurry phone or camera image suddenly become sharp.",
nativeSetting: "camera lens, phone camera module, desk photo setup, or hand-held camera close-up",
hookEmotion: "satisfaction from blur snapping into focus",
avoidVisualSetting: "abstract software-only diagram",

// drawer_slide_ball_bearings
appealTier: "mass_appeal",
audienceContext: "Anyone who has opened a heavy drawer that glides smoothly instead of scraping.",
nativeSetting: "kitchen drawer, desk drawer, toolbox drawer, or furniture close-up",
hookEmotion: "satisfaction from heavy motion feeling effortless",
avoidVisualSetting: "hardware store parts display",

// folding_ruler_hinge_detent
appealTier: "workshop_tool",
audienceContext: "People recognize a segmented ruler snapping straight even if they rarely use one.",
nativeSetting: "hand unfolding a ruler on a table, framed around the snap positions",
hookEmotion: "satisfaction from a hinge finding its favorite positions",
avoidVisualSetting: "carpentry tutorial or tool catalog shot",

// manual_can_opener_gear_bite
appealTier: "mass_appeal",
audienceContext: "Anyone who has turned a can opener and watched it walk around the rim.",
nativeSetting: "kitchen counter, can lid close-up, or hand turning a can opener",
hookEmotion: "surprise that the opener walks instead of being dragged",
avoidVisualSetting: "workshop tool demo",

// toy_gearbox_speed_tradeoff
appealTier: "kinetic_satisfying",
audienceContext: "A clear toy gearbox makes speed and strength tradeoffs visible without engineering language.",
nativeSetting: "transparent toy gearbox, desk toy, or hand-cranked model",
hookEmotion: "satisfaction from fast motion becoming slower but stronger",
avoidVisualSetting: "industrial gearbox or car transmission repair",

// combination_lock_wheels
appealTier: "mass_appeal",
audienceContext: "People recognize dialing numbers, but the explanation must remain principle-only and non-bypass.",
nativeSetting: "transparent educational combination lock model or close-up of dial wheels lining up",
hookEmotion: "curiosity about hidden gaps lining up into one path",
avoidVisualSetting: "cracking, decoding, bypass, or step-by-step opening instruction",

// tripod_quick_release_plate
appealTier: "workshop_tool",
audienceContext: "Creators recognize the fast click of attaching a camera, but it should be framed as a quick-lock moment.",
nativeSetting: "camera mounting moment, hand sliding a plate into a tripod head, or creator desk close-up",
hookEmotion: "satisfaction from one slide becoming a secure lock",
avoidVisualSetting: "equipment repair tutorial",

// socket_wrench_direction_switch
appealTier: "workshop_tool",
audienceContext: "People recognize the clicky switch and ratchet sound more than the tool mechanics.",
nativeSetting: "hand flipping the direction switch and hearing the click, framed as a sound and rule-change moment",
hookEmotion: "surprise that one tiny lever changes which clicks matter",
avoidVisualSetting: "auto repair tutorial, dark toolbench, or bolt-removal steps",
```

- [ ] **Step 3: Reorder active seeds**

Reorder `TINY_MECHANISMS_ACTIVE_SEEDS` so the first twelve seed ids are exactly:

```ts
[
  "click_pen_cam_lock",
  "zipper_locking",
  "spray_bottle_check_valves",
  "phone_screen_rotation",
  "door_latch_beveled_tongue",
  "mechanical_pencil_clutch",
  "pullback_toy_spring_motor",
  "windup_music_box_comb",
  "soap_pump_one_way_valve",
  "camera_lens_aperture_blades",
  "umbrella_runner_lock",
  "hook_and_loop_fasteners",
]
```

Keep no adjacent `mechanismFamily` duplicates across the whole active array.

Recommended remaining order:

```ts
[
  "watch_escapement_ticks",
  "crank_slider_toy_engine",
  "stapler_spring_return",
  "bike_freewheel_clicks",
  "kitchen_timer_gear_train",
  "scissors_lever_crossing",
  "bicycle_pump_check_valve",
  "garden_hose_quick_connector_lock",
  "escalator_steps_level",
  "seatbelt_retractor_lock",
  "metronome_sliding_weight",
  "nail_clipper_compound_lever",
  "camera_autofocus_lens_group",
  "drawer_slide_ball_bearings",
  "manual_can_opener_gear_bite",
  "toy_gearbox_speed_tradeoff",
  "padlock_shackle_latch",
  "tape_measure_coiled_spring",
  "cam_follower_up_down",
  "zip_tie_pawl_lock",
  "retractable_pen_clip_spring",
  "folding_ruler_hinge_detent",
  "combination_lock_wheels",
  "tripod_quick_release_plate",
  "ratchet_screwdriver_pawl",
  "socket_wrench_direction_switch",
]
```

- [ ] **Step 4: Run seed tests**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: seed metadata and ordering tests pass; script/image prompt version tests still fail until later tasks update versions.

---

### Task 5: Add Audience Fields to Script Prompt

**Files:**
- Modify: `packages/ai/src/prompts/scriptPlan.ts`
- Modify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`

- [ ] **Step 1: Update the script prompt test expectation**

In `compiled script prompt includes mechanical episode concept fields`, change:

```ts
    expect(compiled.templateVersion).toBe(5);
```

to:

```ts
    expect(compiled.templateVersion).toBe(6);
```

Add these assertions after the existing field assertions:

```ts
    expect(userMessage).toContain("<appeal_tier>mass_appeal</appeal_tier>");
    expect(userMessage).toContain("<audience_context>Anyone who has clicked a pen");
    expect(userMessage).toContain("<native_setting>a desk, notebook, pocket, or hand-held writing moment</native_setting>");
    expect(userMessage).toContain("<hook_emotion>surprise that the same press has mechanical memory</hook_emotion>");
    expect(userMessage).toContain("<avoid_visual_setting>dark repair workbench or generic tool demonstration</avoid_visual_setting>");
    expect(developerMessage).toContain("Start from the viewer-facing behavior before naming the mechanism");
    expect(developerMessage).toContain("Do not default to a workshop, repair bench, dark tabletop, or tool tutorial");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: FAIL because the script prompt still has version `5` and lacks the new fields/rules.

- [ ] **Step 3: Bump script prompt version**

Change:

```ts
  version: 5,
```

to:

```ts
  version: 6,
```

- [ ] **Step 4: Add audience-first developer rules**

In the `# Editorial Mission` content array, after:

```ts
            "Every scene must earn its time with either curiosity, mechanism clarity, visual evidence, payoff, or a loop-back ending.",
```

add:

```ts
            "Start from the viewer-facing behavior before naming the mechanism.",
            "Write for people who recognize the everyday object, not for engineers, repair technicians, or tool collectors.",
            "Use the selected audienceContext, nativeSetting, hookEmotion, and avoidVisualSetting as creative constraints.",
            "Do not default to a workshop, repair bench, dark tabletop, or tool tutorial unless the selected nativeSetting explicitly requires it.",
            "When the seed is a tool, frame the hook around sound, surprise, resistance, speed, snap, or one-way behavior rather than repair steps.",
            "The hook should create a small emotional reason to keep watching: surprise, tension, disbelief, relief, or satisfying completion.",
```

- [ ] **Step 5: Add visual setting rules**

In the `# Visual-First Rules` content array, after:

```ts
            "Prefer real-world objects, hands, silhouettes, tabletop demonstrations, macro textures, and physically readable cause/effect over abstract floating diagrams.",
```

add:

```ts
            "Prefer the selected nativeSetting over generic tabletop demonstrations.",
            "If the selected avoidVisualSetting names a workbench, repair bench, tutorial, or tool catalog shot, avoid that framing in every scene imagePrompt and visualBrief.",
```

- [ ] **Step 6: Add new user message tags**

In the user message content array, after:

```ts
            `<mechanism_family>${seed.mechanismFamily}</mechanism_family>`,
```

add:

```ts
            `<appeal_tier>${seed.appealTier}</appeal_tier>`,
```

After:

```ts
            `<visual_metaphor>${seed.visualMetaphor}</visual_metaphor>`,
```

add:

```ts
            `<audience_context>${seed.audienceContext}</audience_context>`,
            `<native_setting>${seed.nativeSetting}</native_setting>`,
            `<hook_emotion>${seed.hookEmotion}</hook_emotion>`,
            `<avoid_visual_setting>${seed.avoidVisualSetting}</avoid_visual_setting>`,
```

- [ ] **Step 7: Update default style context**

Replace `visualStyle` in `defaultProjectStyleContext()` with:

```ts
      "social-native vertical hidden-mechanism frames with familiar everyday objects, native settings, clear motion, selective macro cutaways, transparent housings only when useful, and tactile material texture",
```

Replace `imageContinuity` with:

```ts
      "consistent audience-first micro-documentary language with one familiar object, one strange behavior, one readable mechanism, and one satisfying motion beat per scene",
```

- [ ] **Step 8: Run prompt tests**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: script prompt tests pass; image prompt version tests still fail until Task 6.

---

### Task 6: Tune the Image Prompt Away From Workshop Defaults

**Files:**
- Modify: `packages/ai/src/prompts/imagePrompt.ts`
- Modify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`

- [ ] **Step 1: Update image prompt test expectation**

In `compiled image prompt emphasizes physical mechanism materiality`, change:

```ts
    expect(compiled.templateVersion).toBe(4);
```

to:

```ts
    expect(compiled.templateVersion).toBe(5);
```

Replace:

```ts
    expect(compiled.prompt).toContain("springs, pins, gears, pawls, ratchets, cams, levers, tracks, valves");
```

with:

```ts
    expect(compiled.prompt).toContain("Prefer the natural everyday setting implied by the scene");
    expect(compiled.prompt).toContain("Do not default to a workshop, repair bench, dark tabletop, tool catalog shot, or teardown layout");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: FAIL because `imagePromptTemplate.version` is still `4` and the new constraints do not exist.

- [ ] **Step 3: Bump image prompt version**

Change:

```ts
  version: 4,
```

to:

```ts
  version: 5,
```

- [ ] **Step 4: Replace composition/toolbench wording**

Replace this line:

```ts
      "Prefer hands interacting with objects, macro close-ups, cutaways, before/after contrast, frozen motion, or scale-shock compositions when they clarify the mechanism.",
```

with:

```ts
      "Prefer hands interacting with the object in its natural everyday setting, macro close-ups, selective cutaways, before/after contrast, frozen motion, or scale-shock compositions when they clarify the mechanism.",
```

- [ ] **Step 5: Replace materiality section wording**

Replace the `MECHANICAL MATERIALITY` section lines with:

```ts
      "MECHANICAL MATERIALITY",
      "Show one readable mechanism per frame, anchored to a familiar object or setting.",
      "Prefer the natural everyday setting implied by the scene before using a tabletop demonstration.",
      "Use macro cutaways, transparent housings, exploded-but-physically-plausible views, and frozen motion only when they clarify how the mechanism works.",
      "Use tactile materials and parts when relevant: plastic, rubber, fabric, paper, water, springs, pins, gears, pawls, ratchets, cams, levers, tracks, valves, screws, hinges, bearings, and textured surfaces.",
      "Make the mechanism feel small, precise, physically possible, and connected to a recognizable everyday moment.",
      "Do not default to a workshop, repair bench, dark tabletop, tool catalog shot, or teardown layout unless those are explicitly part of the scene.",
      "Avoid abstract floating science diagrams when a real physical mechanism can be shown.",
```

- [ ] **Step 6: Run image prompt tests**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected: all tests in `mechanicalEpisodeBank.test.ts` pass.

---

### Task 7: Update Review Harness

**Files:**
- Modify: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Change representative review seed ids**

Replace:

```ts
const reviewSeedIds = ["click_pen_cam_lock", "watch_escapement_ticks", "spray_bottle_check_valves"];
```

with:

```ts
const reviewSeedIds = [
  "spray_bottle_check_valves",
  "pullback_toy_spring_motor",
  "ratchet_screwdriver_pawl",
];
```

Reason:

- `spray_bottle_check_valves`: mass-appeal everyday object.
- `pullback_toy_spring_motor`: playful mass-appeal stored energy.
- `ratchet_screwdriver_pawl`: workshop-tool risk case that should now be framed around sound/one-way behavior, not tutorial repair.

- [ ] **Step 2: Add compact editorial summary to review output**

Inside the returned object for each review, add:

```ts
    editorial: {
      appealTier: seed.appealTier,
      audienceContext: seed.audienceContext,
      nativeSetting: seed.nativeSetting,
      hookEmotion: seed.hookEmotion,
      avoidVisualSetting: seed.avoidVisualSetting,
    },
```

The return object should become:

```ts
  return {
    seed,
    editorial: {
      appealTier: seed.appealTier,
      audienceContext: seed.audienceContext,
      nativeSetting: seed.nativeSetting,
      hookEmotion: seed.hookEmotion,
      avoidVisualSetting: seed.avoidVisualSetting,
    },
    script,
    image,
    tts,
  };
```

- [ ] **Step 3: Run review summary**

Run:

```bash
bun packages/ai/src/prompts/review.ts | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const payload=JSON.parse(s); const rows=payload.reviews; console.log(JSON.stringify({count:rows.length,seeds:rows.map(r=>r.seed.seedId),tiers:rows.map(r=>r.editorial.appealTier),scriptVersions:[...new Set(rows.map(r=>r.script.templateVersion))],imageVersions:[...new Set(rows.map(r=>r.image.templateVersion))]}, null, 2));})"
```

Expected output:

```json
{
  "count": 3,
  "seeds": [
    "spray_bottle_check_valves",
    "pullback_toy_spring_motor",
    "ratchet_screwdriver_pawl"
  ],
  "tiers": [
    "mass_appeal",
    "mass_appeal",
    "workshop_tool"
  ],
  "scriptVersions": [
    6
  ],
  "imageVersions": [
    5
  ]
}
```

---

### Task 8: Verification and Commit

**Files:**
- Verify: `packages/ai/src/prompts/mechanicalEpisodeBank.test.ts`
- Verify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`
- Verify: `packages/ai/src/prompts/scriptPlan.ts`
- Verify: `packages/ai/src/prompts/imagePrompt.ts`
- Verify: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Run targeted prompt tests**

Run:

```bash
bun test packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
```

Expected:

```text
pass mechanical episode bank > selects only active seeds while preserving legacy seed resolution
pass mechanical episode bank > active seeds are ordered to avoid adjacent mechanism families
pass mechanical episode bank > compiled script prompt includes mechanical episode concept fields
pass mechanical episode bank > compiled image prompt emphasizes physical mechanism materiality
pass mechanical episode bank > active seeds include audience-first editorial fields
pass mechanical episode bank > first twelve active seeds avoid workshop-tool dominance
```

- [ ] **Step 2: Run package typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected:

```text
$ tsc --noEmit
```

with exit code `0`.

- [ ] **Step 3: Run package check**

Run:

```bash
bun run --cwd packages/ai check
```

Expected: all `packages/ai` tests pass.

- [ ] **Step 4: Inspect compiled prompts for workshop defaults**

Run:

```bash
bun -e 'import { scriptPlanPrompt } from "./packages/ai/src/prompts/scriptPlan.ts"; import { TINY_MECHANISMS_PRESET_ID } from "./packages/ai/src/prompts/presets/tinyMechanisms.ts"; for (const seedId of ["spray_bottle_check_valves","pullback_toy_spring_motor","ratchet_screwdriver_pawl"]) { const compiled = scriptPlanPrompt.compile({ channelPresetId: TINY_MECHANISMS_PRESET_ID, seedId, targetDurationSeconds: 45 }); const dev = compiled.messages[0]?.content ?? ""; const user = compiled.messages[1]?.content ?? ""; console.log(JSON.stringify({ seedId, version: compiled.templateVersion, hasNativeSetting: user.includes("<native_setting>"), hasAvoidSetting: user.includes("<avoid_visual_setting>"), preventsWorkshopDefault: dev.includes("Do not default to a workshop") }, null, 2)); }'
```

Expected: each printed object has:

```json
{
  "version": 6,
  "hasNativeSetting": true,
  "hasAvoidSetting": true,
  "preventsWorkshopDefault": true
}
```

- [ ] **Step 5: Run review summary**

Run:

```bash
bun packages/ai/src/prompts/review.ts | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const payload=JSON.parse(s); const rows=payload.reviews; console.log(JSON.stringify({count:rows.length,seeds:rows.map(r=>r.seed.seedId),tiers:rows.map(r=>r.editorial.appealTier),scriptVersions:[...new Set(rows.map(r=>r.script.templateVersion))],imageVersions:[...new Set(rows.map(r=>r.image.templateVersion))]}, null, 2));})"
```

Expected: three review seeds, tiers `mass_appeal`, `mass_appeal`, `workshop_tool`, script version `6`, image version `5`.

- [ ] **Step 6: Confirm git scope**

Run:

```bash
git status --short
```

Expected touched files for this plan:

```text
M docs/superpowers/specs/2026-05-18-mechanical-episode-bank-design.md
M packages/ai/src/prompts/imagePrompt.ts
M packages/ai/src/prompts/mechanicalEpisodeBank.test.ts
M packages/ai/src/prompts/presets/tinyMechanisms.ts
M packages/ai/src/prompts/review.ts
M packages/ai/src/prompts/scriptPlan.ts
```

Do not stage unrelated files such as `.DS_Store` or local editor settings.

- [ ] **Step 7: Commit implementation**

```bash
git add docs/superpowers/specs/2026-05-18-mechanical-episode-bank-design.md packages/ai/src/prompts/imagePrompt.ts packages/ai/src/prompts/mechanicalEpisodeBank.test.ts packages/ai/src/prompts/presets/tinyMechanisms.ts packages/ai/src/prompts/review.ts packages/ai/src/prompts/scriptPlan.ts
git commit -m "feat: make mechanical seeds audience-first"
```

---

## Post-Implementation Manual Check

After implementation, generate one new script from a pending `tiny_mechanisms` project.

Expected qualitative result:

- Next selected seed should be the earliest unused seed in the new audience-first order.
- Hook should start with an everyday behavior or surprising motion.
- Visual prompts should prefer native settings like desk, kitchen, phone-in-hand, sink, jacket, umbrella, or toy surface.
- Workshop/toolbench language should not appear unless the seed is explicitly tool-focused.
- Tool-focused seeds should read as sound/surprise/behavior Shorts, not repair tutorials.

---

## Self-Review

- Spec coverage: The plan updates the existing mechanical episode bank spec with the audience-first correction before code changes.
- Scope: Prompt-layer only. No DB, API, worker, frontend, Remotion, provider, or migration changes.
- Type consistency: New fields are added to `TinyMechanismsSeed`, populated by active seeds and legacy helper, and consumed by `scriptPlanPrompt`.
- Versioning: Script prompt bumps from `5` to `6`; image prompt bumps from `4` to `5`.
- Verification: Targeted prompt tests, package typecheck, package check, and compiled prompt inspection are included.
