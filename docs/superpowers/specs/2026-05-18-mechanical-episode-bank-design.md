# Mechanical Episode Bank Design

## Summary

Short Workflow's `tiny_mechanisms` preset should move from a broad everyday-mystery seed list to a curated mechanical episode bank. Each active episode seed should describe a specific creative angle, hidden mechanism, viewer misconception, satisfying motion, visual reveal, and loop payoff.

This keeps the channel focused on satisfying miniature mechanism reveals while preserving the existing MVP architecture: local preset, script generation, scene images, narration, captions, Remotion render, and prompt history.

The change is prompt-layer only. It does not add database tables, migrations, providers, UI controls, Remotion features, sound effects, or AI video transformation.

## Problem

The current seed shape is good for a first MVP, but it is too topic-like:

```ts
type TinyMechanismsSeed = {
  seedId: string;
  centralQuestion: string;
  everydayObjectOrPhenomenon: string;
  mechanismHint: string;
  visualMetaphor: string;
  riskLevel: "low";
};
```

This can produce repetitive videos because the system knows the object and mechanism, but not the creative difference between episodes. A list like "click pen, zipper, ratchet, watch, tape measure" is not enough. Without a stronger concept layer, many scripts will default to the same pattern:

1. Show object.
2. Say there is a hidden spring, gear, or latch.
3. Reveal a cutaway.
4. End with a generic "that's how it works."

That output would feel mass-produced even when the topics are technically different.

## Goals

- Make `tiny_mechanisms` feel like a focused channel about satisfying physical mechanisms.
- Keep each episode distinct through angle, mechanism family, motion beat, reveal style, and payoff.
- Preserve old seed ids so existing projects can still regenerate scripts.
- Keep new episode selection deterministic and local.
- Keep generated script, captions, image prompts, and SSML in English.
- Keep factual risk low and evergreen.
- Improve prompts without changing the database, API contract, worker job model, or Remotion input contract.

## Non-Goals

- No Country AI Transformation preset in this change.
- No AI video morphing, Runway/Kling/Sora pipeline, or frame interpolation.
- No ASMR sound-effect asset pipeline.
- No background music.
- No custom topic UI.
- No user-facing seed picker.
- No trend scraping or YouTube/TikTok data mining.
- No database-managed prompt templates.
- No automated content scheduler.

## Channel Direction

The preset promise changes from broad everyday mysteries to mechanical reveals:

Old:

```text
one everyday mystery explained in under 45 seconds
```

New:

```text
one tiny physical mechanism revealed in under 45 seconds
```

The channel should still be understandable to a curious general audience. The tone stays clear, precise, lightly dramatic, and non-hype. The creative center shifts toward physical mechanisms that can be shown through macro details, cutaways, transparent casings, tabletop demonstrations, and frozen motion.

Allowed active topic families:

- Tiny locks and latches.
- Springs and stored energy.
- One-way mechanisms.
- Timing and escapement mechanisms.
- Motion conversion mechanisms.
- Grip-and-release mechanisms.
- Guided tracks and cams.
- Small pumps and valves.
- Everyday precision mechanisms.

Allowed legacy topic families:

- Existing broad everyday science seeds already used by projects.
- Existing low-risk seeds that are not mechanical-first but should remain resolvable for regeneration.

Disallowed topic families remain unchanged:

- Medical advice, finance, legal advice, politics, war, crime, breaking news, public figures, dangerous instructions, children's characters, conspiracy framing, and unsupported claims.

Country-themed transformations are explicitly out of scope for the active `tiny_mechanisms` preset. They can become a separate future preset only after the core local video flow is stable.

## Seed Model

`TinyMechanismsSeed` should become a curated episode concept instead of a topic record.

```ts
type TinyMechanismsSeed = {
  seedId: string;
  selectionStatus: "active" | "legacy";
  mechanismFamily:
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
```

Field meanings:

- `selectionStatus`: active seeds are eligible for new pending projects; legacy seeds remain available for old project regeneration.
- `mechanismFamily`: the underlying mechanical pattern, used to curate variety.
- `objectOrMechanism`: the concrete thing being explained.
- `titleAngle`: the creative angle, not necessarily the final YouTube title.
- `centralQuestion`: the question the episode answers.
- `viewerMisconception`: the assumption the script can overturn.
- `mechanismHint`: the factual mechanism the script must preserve.
- `satisfyingMotion`: verbs and motion beats that should shape narration and visuals.
- `visualReveal`: the preferred reveal shot or cutaway logic.
- `loopPayoff`: the final line idea that loops back to the opening hook.
- `visualMetaphor`: a backup image idea when the actual mechanism is hard to show.
- `repeatRisk`: editorial signal for how easily the episode could feel similar to nearby episodes.
- `riskLevel`: remains `low` for MVP seeds.

Existing broad seeds should not be deleted. They should become `selectionStatus: "legacy"` unless they are mechanical-first enough to keep active, such as `zipper_locking`, `phone_screen_rotation`, `escalator_steps_level`, `washing_machine_spin`, and `hook_and_loop_fasteners`.

## Selection Behavior

New pending projects should select from active seeds only.

Existing projects whose topic already contains a legacy seed id must still resolve through `getTinyMechanismsSeed(seedId)`. This prevents regeneration from failing after the seed bank changes.

The first implementation can keep deterministic list-order selection, but the active seed list must be ordered to avoid adjacent mechanism families. This keeps the change small and avoids adding state. A future implementation may improve selection by passing recent projects in order and skipping the latest mechanism family when possible.

Selection rules:

- `pickNextTinyMechanismsSeed(usedSeedIds)` only returns active seeds.
- Used active seeds are skipped.
- Used legacy seeds do not block active seed selection except by exact seed id.
- If all active seeds are used, the function fails with the existing exhausted-bank error.
- Legacy seeds are never selected for new pending projects.

## Prompt Changes

### Channel Bible

The channel bible should describe the preset as mechanical-first:

```text
Channel: Tiny Mechanisms.
Promise: one tiny physical mechanism revealed in under 45 seconds.
Format: faceless 9:16 mechanical micro-documentary with generated images, narration, large captions, and a loopable ending.
Image direction: social-native macro mechanism frames with real objects, cutaways, springs, cams, latches, gears, pawls, tracks, levers, valves, material texture, and no embedded text.
Retention: start from an impossible-looking behavior, reveal the hidden mechanism, and end with a loop payoff that reinterprets the first shot.
```

### Script Prompt

The script prompt should use the new seed fields directly in the user message:

```text
<mechanism_family>...</mechanism_family>
<object_or_mechanism>...</object_or_mechanism>
<title_angle>...</title_angle>
<viewer_misconception>...</viewer_misconception>
<satisfying_motion>...</satisfying_motion>
<visual_reveal>...</visual_reveal>
<loop_payoff>...</loop_payoff>
```

The developer instructions should add these editorial rules:

- Open with the misconception, impossible behavior, or satisfying action already happening.
- Do not use a generic "inside this object" opening unless the seed's angle requires it.
- The hook and payoff must be connected by the seed's `loopPayoff`.
- At least one point scene must reveal the named mechanism through the seed's `visualReveal`.
- Narration should include the seed's `satisfyingMotion` as concrete verbs where natural.
- Do not over-explain the entire object; explain the selected mechanism only.
- Avoid repeating the same sentence shapes across episodes, especially "This works because..." and "Inside, there is..."

`scriptPlanPrompt.version` should be bumped because prompt behavior changes. The structured output schema can remain the same unless implementation chooses to store new creative fields in the model response. The first implementation should avoid expanding the script response schema unless necessary.

### Image Prompt

The image prompt compiler already supports social-native visual hooks. It should lean harder into physical mechanism materiality:

- Prefer macro cutaways, transparent housings, exploded-but-physically-plausible views, and tabletop demonstrations.
- Show one readable mechanism per frame.
- Prefer steel, brass, plastic, rubber, springs, pins, gears, pawls, ratchets, cams, levers, tracks, valves, and textured surfaces.
- Do not produce abstract science diagrams when a physical mechanism can be shown.
- Preserve caption-safe lower-frame negative space.

`imagePromptTemplate.version` should be bumped if the prompt text changes.

## Initial Active Seed Set

The first active bank should target 30-40 seeds. This is enough variety for initial channel testing without pretending the MVP needs an infinite trend engine. The table below is the editorial inventory; the implementation should order the exported active array to avoid adjacent mechanism families.

| Seed id | Family | Angle | Motion / reveal |
| --- | --- | --- | --- |
| `click_pen_cam_lock` | `spring_locking` | The click is a tiny mechanical memory | press, rotate, lock, release / cam-track cutaway |
| `retractable_pen_clip_spring` | `spring_locking` | Why a pen clip snaps back without breaking | bend, store, return / springy plastic close-up |
| `zipper_tooth_locking` | `grip_and_release` | Why a zipper does not simply slide open | mesh, pull, wedge / slider forcing teeth together |
| `mechanical_pencil_clutch` | `grip_and_release` | How a pencil grips lead, then lets it move | clamp, release, advance / tiny jaws around graphite |
| `door_latch_beveled_tongue` | `guided_track` | Why a door closes with one push but needs a handle to open | slide, compress, snap / beveled latch into strike plate |
| `zip_tie_pawl_lock` | `one_way_ratchet` | Why a zip tie tightens forever but will not back out | pull, click, block / pawl biting angled teeth |
| `ratchet_screwdriver_pawl` | `one_way_ratchet` | Why this tool turns one way and refuses the other | click, slip, catch / pawl and ratchet wheel |
| `bike_freewheel_clicks` | `one_way_ratchet` | Why a bike can coast while the wheel keeps spinning | drive, coast, click / pawls engaging hub teeth |
| `socket_wrench_direction_switch` | `one_way_ratchet` | One tiny lever changes the direction of force | flip, catch, release / reversible pawl path |
| `tape_measure_coiled_spring` | `stored_energy` | The ruler is secretly trying to curl back up | pull, bend, rewind / coiled spring and curved tape |
| `pullback_toy_spring_motor` | `stored_energy` | Pulling backward stores a launch | wind, hold, release / spring motor cutaway |
| `windup_music_box_comb` | `timing_release` | A music box plays by plucking metal teeth in order | wind, rotate, pluck / pinned cylinder hitting comb |
| `watch_escapement_ticks` | `timing_release` | A watch releases time one tooth at a time | tick, lock, unlock / escapement fork and wheel |
| `metronome_sliding_weight` | `timing_release` | Why moving the weight changes the beat | swing, delay, return / pendulum balance reveal |
| `kitchen_timer_gear_train` | `timing_release` | A timer slows a spring down with gear friction | wind, resist, tick / gear train and escapement |
| `cam_follower_up_down` | `motion_conversion` | A circle can create a perfectly timed push | rotate, lift, drop / cam profile pushing follower |
| `crank_slider_toy_engine` | `motion_conversion` | Rotation becomes a piston stroke | spin, push, pull / crank-slider cutaway |
| `scissors_lever_crossing` | `motion_conversion` | Two blades multiply your hand force at one point | squeeze, pivot, slice / pivot leverage close-up |
| `nail_clipper_compound_lever` | `motion_conversion` | A tiny lever stack turns a soft press into a hard bite | press, multiply, snap / nested lever force path |
| `stapler_spring_return` | `stored_energy` | A stapler fires down, then resets itself | press, punch, return / spring return and hinge |
| `spray_bottle_check_valves` | `fluid_valve` | One squeeze moves liquid only one direction | squeeze, seal, draw, spray / twin check valves |
| `soap_pump_one_way_valve` | `fluid_valve` | A pump can lift soap without sucking it back down | press, lift, refill / piston and valve cutaway |
| `bicycle_pump_check_valve` | `fluid_valve` | Air goes into the tire but cannot escape through the pump | push, seal, flow / valve flap closing |
| `garden_hose_quick_connector_lock` | `precision_alignment` | A tiny twist keeps pressure from popping parts apart | align, twist, lock / thread and taper close-up |
| `camera_lens_aperture_blades` | `precision_alignment` | A circle is built from sliding blades | slide, overlap, open, close / iris mechanism |
| `camera_autofocus_lens_group` | `precision_alignment` | Focus changes by moving glass a tiny distance | shift, sharpen, lock / lens group moving on rails |
| `tripod_quick_release_plate` | `grip_and_release` | A camera locks fast because the plate wedges sideways | slide, wedge, snap / dovetail plate lock |
| `umbrella_runner_lock` | `guided_track` | Why an umbrella stays open after one push | slide, catch, hold / runner latch on shaft |
| `seatbelt_retractor_lock` | `one_way_ratchet` | Slow pull is smooth, fast pull locks instantly | pull, spin, jam / inertia lock close-up |
| `drawer_slide_ball_bearings` | `guided_track` | A heavy drawer glides on hidden rolling paths | roll, support, extend / ball-bearing track |
| `folding_ruler_hinge_detent` | `grip_and_release` | A small stop makes the hinge feel magnetic | snap, hold, release / detent ball and hinge pocket |
| `padlock_shackle_latch` | `grip_and_release` | A padlock holds with two tiny catches | push, catch, turn, release / shackle latch cutaway |
| `combination_lock_wheels` | `precision_alignment` | The lock opens only when invisible gates line up | rotate, align, drop / wheel gates and fence |
| `toy_gearbox_speed_tradeoff` | `motion_conversion` | Tiny gears trade speed for strength | mesh, slow, push / gear train ratio reveal |
| `manual_can_opener_gear_bite` | `one_way_ratchet` | A can opener walks around the rim | bite, turn, advance / cutting wheel and gear |
| `escalator_step_tracks` | `guided_track` | Steps stay level because two tracks disagree on purpose | ride, tilt, flatten / hidden dual-track path |

Existing broad seeds that remain useful can be converted:

- `zipper_locking` should keep resolving. It can remain active with expanded fields, or become legacy while a new active `zipper_tooth_locking` seed covers the refined angle.
- `phone_screen_rotation` can remain active under `precision_alignment` only if framed as a tiny MEMS sensor mechanism.
- `escalator_steps_level` can remain active as `escalator_step_tracks`.
- `washing_machine_spin` should become legacy unless reframed around a physical clutch, drum, or pump mechanism.
- `hook_and_loop_fasteners` can remain active as `grip_and_release`.

## Repetition Controls

The first repetition control is editorial, not algorithmic:

- Active seeds are ordered to alternate mechanism families.
- Each active seed has a distinct `titleAngle`, `viewerMisconception`, `visualReveal`, and `loopPayoff`.
- Prompt rules ban generic openings and generic endings.
- `repeatRisk: "high"` seeds should not ship active in the first batch unless the angle is unusually strong.

The second repetition control is visual:

- Each seed should prefer a different reveal type where possible: cam cutaway, pawl close-up, spring coil, transparent housing, exploded view, tabletop demo, frozen motion, or material cross-section.
- The image prompt compiler should prevent all scenes from becoming the same "floating cutaway diagram" style.

The third repetition control is publishing review:

- Prompt review should generate sample compiled prompts for at least three seeds from different mechanism families.
- The reviewer should check whether the hook, mechanism, visual reveal, and loop payoff are visibly different.

## Architecture

No architecture boundary changes are required.

Files expected to change during implementation:

- `packages/ai/src/prompts/presets/tinyMechanisms.ts`
- `packages/ai/src/prompts/scriptPlan.ts`
- `packages/ai/src/prompts/imagePrompt.ts`
- `packages/ai/src/prompts/review.ts`

No database files should change.

No frontend route or UI files should change.

No worker job schema should change. The worker continues to reserve a seed, generate a structured script plan, replace scene rows, and store prompt history.

## Data Flow

The data flow stays the same:

```text
pending tiny_mechanisms project
-> reserve next active seed
-> compile script prompt with mechanical episode concept fields
-> OpenAI structured script plan
-> editable scenes
-> compile image prompts with scene visual brief and hook archetype
-> generate images and audio
-> Remotion render
```

The only data shape change is the in-code seed object inside `packages/ai`.

## Error Handling

Existing errors remain valid:

- Unknown explicit seed id: `tiny_mechanisms_seed_not_found`.
- No active unused seed remains: `tiny_mechanisms_seed_bank_exhausted`.
- Invalid script output: `script_response_invalid`.

Legacy seed handling:

- `getTinyMechanismsSeed(seedId)` must resolve active and legacy seeds.
- `pickNextTinyMechanismsSeed(usedSeedIds)` must only return active seeds.
- If an old project references a legacy seed, regeneration must use that legacy seed instead of failing.

## Validation

Use the lightest relevant checks for this MVP stage:

- Run the prompt review helper for representative seeds from at least three different mechanism families.
- Compile the script prompt and assert the new seed fields appear in the compiled user message.
- Compile the image prompt and assert mechanical materiality directions appear in the prompt.
- Run the package typecheck for `packages/ai` if available.

Do not add new automated tests unless needed to protect the changed prompt helpers. Manual prompt review is acceptable for this stage.

## Implementation Notes

- Keep the existing `tiny_mechanisms:` topic prefix.
- Preserve existing seed ids where projects may already reference them.
- Prefer adding `selectionStatus` over deleting broad seeds.
- Keep all generated content English-only.
- Do not add factual claims that require current-event research.
- Do not store binary data, provider payloads, or generated assets in prompt seed definitions.
- Bump prompt template versions when prompt behavior changes.

## Future Work

After this design proves useful, separate specs can cover:

- A Country AI Transformation preset.
- An ASMR sound-effect asset pipeline.
- Seed family-aware selection based on recent project order.
- A user-facing seed picker.
- A post-render editorial scoring checklist for retention and repetition.

These are intentionally excluded from this design.
