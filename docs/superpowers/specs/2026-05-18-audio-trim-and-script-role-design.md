# Audio Trim and Script Role Design

## Status

Approved for planning on 2026-05-18.

## Goal

Remove visible dead-air freezes between generated scenes by making rendered scene durations follow the actual generated narration audio, and improve script generation quality by adding a clear role and editorial identity to the script planning prompt.

## Background

Short Workflow currently plans each scene with a fixed `scene.durationSeconds` value. The render input builder copies that planned value into each render scene, and `apps/render` uses it to set each Remotion `<Sequence durationInFrames>`. When ElevenLabs speech is shorter than the planned scene duration, the sequence continues after the audio ends. The viewer sees a static image and lingering caption until the planned scene duration expires, which feels like the video froze.

The audio generation flow already produces caption timing JSON under the scene caption timing asset path. That document includes `audioDurationSeconds`, which is a better source of truth for render-time sequence duration than the planned scene duration.

The script prompt also has a developer message with production rules, schema instructions, safety constraints, and visual constraints, but it lacks an explicit identity section such as "You are a senior short-form educational documentary writer and creative director." OpenAI prompt guidance recommends placing identity, high-level role, and business rules in developer-level instructions, while leaving request-specific values in the user message.

Relevant references:

- Remotion `calculateMetadata()` supports dynamic render metadata before rendering starts: https://www.remotion.dev/docs/calculate-metadata
- Remotion `<Sequence durationInFrames>` controls how long scene children remain mounted: https://www.remotion.dev/docs/sequence
- OpenAI prompt engineering guidance recommends developer-level identity, instructions, examples, and context sections: https://platform.openai.com/docs/guides/prompt-engineering
- OpenAI Structured Outputs guidance recommends keeping schema enforcement separate from prompt wording: https://platform.openai.com/docs/guides/structured-outputs

## Non-Goals

- Do not change stored database `scenes.duration_seconds`; it remains the planned duration from the generated scene plan.
- Do not add a freeform timeline editor.
- Do not force final renders to stay exactly 30, 45, or 60 seconds.
- Do not add background music, filler scenes, subtitle export, or cloud rendering.
- Do not introduce OpenAI dashboard reusable prompt objects in this change.
- Do not replace schema validation with prompt wording.

## Design Decisions

### Rendered Duration Follows Actual Audio

Rendered scene duration should be computed from the current audio asset's caption timing document when available.

For each render scene:

1. Keep the planned scene duration from the database for script structure and historical context.
2. Read the caption timing JSON for the selected current audio asset.
3. If the document parses and contains a positive `audioDurationSeconds`, compute effective render duration from audio duration plus a small tail buffer.
4. If the document is missing, stale, unreadable, or invalid, fall back to the planned `scene.durationSeconds`.

The render input remains the render attempt source of truth. Each render input JSON should contain the effective scene durations that Remotion will use for that specific render.

### Tail Buffer

Use a constant tail buffer of `0.25` seconds.

This preserves a small breath after narration before the next scene cuts in, while removing the longer visual pauses that currently feel like freezes. The buffer should be applied before converting to frames:

```ts
audioFrames = Math.ceil((audioDurationSeconds + 0.25) * fps);
```

### Frame Math

Frame math should be deterministic and use the render FPS from shared constants.

Recommended computation:

```ts
const plannedFrames = Math.round(scene.durationSeconds * fps);
const audioFrames = Math.ceil((audioDurationSeconds + TAIL_BUFFER_SECONDS) * fps);
const effectiveFrames = Math.max(1, Math.min(plannedFrames, audioFrames));
const effectiveDurationSeconds = effectiveFrames / fps;
```

The `Math.min(plannedFrames, audioFrames)` cap keeps final output at or below the planned target duration. The user has chosen that renders may become shorter according to actual audio.

If future work needs to preserve exact preset length, that should be a separate design for redistributing leftover time into an intentional outro or transition. This change should not hide leftover time inside every scene.

### Schema Changes

`renderInputSchema.format.durationSeconds` should allow totals below the MVP project creation range because actual rendered output can now be shorter than 20 seconds after trimming.

Recommended schema behavior:

- Keep `renderSceneInputSchema.durationSeconds` positive and capped at 60.
- Relax `renderInputSchema.format.durationSeconds` from `min(20).max(60)` to positive and max 60.

The project creation schema can keep the 20-60 second MVP range. Only render input duration needs to reflect post-audio effective output duration.

### Caption Timing Ownership

The worker should compute effective durations while building render input, not inside the Remotion component.

Reasons:

- The worker already selects current ready image/audio/caption timing assets.
- Remotion composition duration must be known before rendering frames.
- Fetching timing data inside the component would be too late for composition duration and may run repeatedly during rendering.
- Storing the effective duration in the render input makes each render reproducible.

### Render Input Shape

The minimal implementation can continue using `durationSeconds` on each render scene as the effective render duration. That keeps `apps/render` simple and preserves the existing contract that `ShortVideo` uses `scene.durationSeconds`.

If debugging planned versus effective duration becomes important, a later change can add optional fields such as:

- `plannedDurationSeconds`
- `audioDurationSeconds`
- `tailBufferSeconds`

Those fields are not required for this MVP fix.

## Script Prompt Role Design

### Current Prompt Issue

The current script developer message has many rules but no explicit identity. This can make the model satisfy the JSON contract without consistently adopting the desired creative judgment for English 9:16 educational shorts.

### Desired Identity

Add an identity section to the script plan developer prompt:

```text
# Identity
You are a senior short-form educational documentary writer and creative director.
You specialize in English 9:16 YouTube Shorts that explain tiny everyday mechanisms with tight pacing, visual-first scene planning, and clear payoff.
```

This is more appropriate than a generic role like "world-class creator" or an unrelated expert role such as "senior DevOps engineer." Domain-specific role guidance should describe the creator this product needs.

### Developer Message Structure

Refactor the script prompt developer message into clear sections:

```text
# Identity
# Editorial Mission
# Pacing Rules
# Visual-First Rules
# Safety and Scope
# Output Contract
```

The existing safety rules, language rules, cta rule, image prompt rules, visual brief requirements, and SSML requirements should remain. They should be moved into the appropriate sections rather than removed.

### User Message Scope

Keep dynamic request inputs in the user message:

- `channel_preset_id`
- `target_duration_seconds`
- `scene_roles`
- `seed_id`
- `central_question`
- `everyday_object_or_phenomenon`
- `mechanism_hint`
- `visual_metaphor`
- required scene count/order

This preserves the current separation where developer messages define the function and user messages pass arguments.

### Prompt Version

Bump `scriptPlanPrompt.version` from `2` to `3` when changing the prompt. This keeps prompt history understandable in `prompt_versions`.

## Error Handling and Fallbacks

### Missing Caption Timing

If a current audio asset has no ready caption timing asset, render with the planned scene duration.

This preserves legacy compatibility and avoids blocking old projects that were created before caption timing existed.

### Invalid Caption Timing

If the caption timing file cannot be read or fails `captionTimingDocSchema`, render with the planned scene duration and emit a worker warning that includes the scene id and caption timing asset path.

The render should not fail solely because caption timing is invalid. Missing or invalid audio/image assets should still fail through existing render preconditions.

### Audio Longer Than Planned

The existing audio generation guard rejects audio that exceeds planned duration by more than the overflow tolerance. This design keeps the render cap at planned duration for now.

If future renders reveal clipped audio, handle it as a separate audio generation issue by tightening the overflow tolerance or retrying TTS, not by silently extending every render.

## Data Flow

1. `handleRenderVideo()` loads the project and scenes.
2. For each scene, it selects current ready image and audio assets.
3. It derives the expected caption timing path from the selected audio asset id.
4. It looks up the ready caption timing asset by path.
5. `buildRenderInput()` receives the selected assets and computes effective scene duration.
6. The worker writes the render input JSON with effective durations.
7. `apps/render` parses the render input and uses `scene.durationSeconds` for sequence durations.
8. `Root.tsx` calculates total duration from the effective scene durations.
9. The final MP4 duration is the sum of effective scene durations and may be shorter than the project target duration.

## Validation

Use the lightest focused verification for touched areas.

Recommended checks:

- Worker render input check: caption timing with `audioDurationSeconds: 2.1` and planned duration `5` should produce `ceil((2.1 + 0.25) * 30) / 30`.
- Worker fallback check: no caption timing should preserve planned duration.
- Worker total duration check: `format.durationSeconds` should equal the sum of effective scene durations.
- Shared schema check: render input totals below 20 seconds should parse.
- Render helper check: `getTotalDurationFrames()` should continue to sum the render input scene durations.
- Prompt compile check: script prompt v3 should include `# Identity`, preserve JSON/schema instruction, preserve safety constraints, and keep dynamic seed data in the user message.

Per the current MVP note, do not add broad automated test coverage or run full test suites by default. Prefer targeted existing checks or small focused assertions for the changed files.

## Risks

- Very short generated audio may produce a render that feels too fast. The tail buffer mitigates this, and future prompt/audio work can improve narration density.
- Rendered output duration will no longer match the selected 30/45/60 preset exactly. This is intentional for the MVP because avoiding scene freezes is more important than exact duration.
- If caption timing exists but reflects the wrong audio asset, render timing could be wrong. The path lookup must use the selected current audio asset id to avoid this.
- The script role prompt can improve taste but cannot guarantee timing quality by itself. Timing must still be enforced at render input generation.

## Acceptance Criteria

- New renders with caption timing no longer hold each scene until the planned duration after narration ends.
- Legacy scenes without caption timing still render.
- Render input total duration is computed from effective scene durations and may be less than the project target duration.
- Script prompt has an explicit role/identity suited to short-form educational documentary writing.
- Existing schema-driven structured output remains in place.
- No unrelated files or generated assets are modified.
