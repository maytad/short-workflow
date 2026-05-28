# Fictional Archive Mystery Clean V2 Design

## Summary

Short Workflow should be rebuilt around a new episode-first workflow for fictional archive
mystery Shorts. The new channel direction is not Tiny Mechanisms and should not reuse the
old project, scene, SSML, karaoke, or one-click assumptions.

The product should create English 9:16 short-form fictional documentary videos about liminal
or uncanny places. Each episode starts from a fictional concept, generates candidate mysteries,
selects one strong visual anomaly, creates a continuity plan, generates one anchor image, uses
that anchor to generate the remaining beat images, generates one episode-level ElevenLabs
narration track, derives archive-style captions from timing data, and renders a local MP4.

The design intentionally discards old generated data. No migration from Tiny Mechanisms content
is required.

## Goals

- Replace Tiny Mechanisms with a clean fictional archive mystery workflow.
- Make the data model episode-first rather than scene-first.
- Use pinned `gpt-image-2-2026-04-21` as the primary image model.
- Preserve image continuity with an anchor image, reference assets, and a continuity bible.
- Use ElevenLabs for narration and timestamp data.
- Replace word-by-word karaoke with an archive documentary caption system.
- Keep the app single-user, local-running, English-only, and 9:16.
- Keep generated assets on the local filesystem and store portable relative paths in Postgres.
- Keep manual review gates for candidate selection, anchor approval, image review, narration
  review, and final render.
- Surface job failure reasons near the action that failed.

## Non-Goals

- No Tiny Mechanisms presets, seed bank, mechanical roles, mechanism keywords, or analytics-driven
  prompt loop.
- No migration of old projects, scenes, assets, jobs, renders, or YouTube upload schedules.
- No Google image generation path for this workflow.
- No RAG, memory retrieval, web research, or YouTube analytics in generation prompts.
- No `visual_qc_reviews` table.
- No SSML prompt path.
- No scene-level audio generation.
- No background music in the first clean version.
- No YouTube upload automation in this rebuild.
- No public deployment, auth, cloud storage, cloud rendering, Redis, or BullMQ.

## Research Rationale

The clean workflow is based on current provider and platform constraints:

- OpenAI lists `gpt-image-2` as the current image generation model with image generation and
  image edit endpoints. It supports high-fidelity image inputs, but the image guide still notes
  limitations around recurring visual consistency and precise composition control. The workflow
  should therefore use reference/edit chains and stored continuity data rather than relying only
  on repeated text prompts.
  The implementation should pin `gpt-image-2-2026-04-21` for reproducible behavior.
  - https://developers.openai.com/api/docs/models/gpt-image-2
  - https://developers.openai.com/api/docs/guides/image-generation
- ElevenLabs `convertWithTimestamps` returns audio plus character-level timing data. The API also
  supports request context such as previous and next text/request IDs for continuity when splitting
  generation. This fits an episode-level narration track and caption compiler.
  - https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps
  - https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech
- YouTube Shorts discovery uses viewer choice and retention signals including percentage of
  viewers who choose to view, average view duration, and average percentage viewed. The first frame,
  first line, and first seconds are therefore core product concerns.
  - https://support.google.com/youtube/answer/11914225
- TikTok creative guidance recommends a hook in the first six seconds, a proposition in the first
  three seconds, vertical 9:16 video, UI safe zones, and captions/text overlays for context. Even
  though the target platform is YouTube Shorts, this supports the same short-form creative grammar.
  - https://ads.tiktok.com/help/article/creative-best-practices
- W3C caption guidance treats captions as synchronized text for speech and important non-speech
  audio information. This supports a caption system that includes speech captions, evidence labels,
  and disclosure labels rather than generic word-by-word karaoke.
  - https://www.w3.org/WAI/media/av/captions/
- Remotion's timeline model fits this rebuild: use a root narration audio track, `Sequence`
  components for visual beats, frame-based captions from `useCurrentFrame`, and `delayRender` or
  related data-loading APIs only for render-time JSON/asset readiness.
  - https://github.com/remotion-dev/remotion/blob/main/packages/docs/docs/building-a-timeline.mdx
  - https://github.com/remotion-dev/remotion/blob/main/packages/docs/docs/captions/displaying.mdx

## Current State To Replace

The existing runtime has several old assumptions that should not be adapted in place:

- `projects` and `scenes` are the primary content tables.
- Job types are tied to `generate_script`, `generate_scene_image`, `generate_scene_audio`,
  `run_project_flow`, and `upload_youtube`.
- Scene content stores `image_prompt`, `narration`, `caption`, and `ssml`.
- Render input requires one `audioPath` per scene.
- Captions are rendered through `KaraokeCaption`, mechanism keywords, active yellow words, and
  Tiny Mechanisms-specific display behavior.
- Image prompts are compiled by a template named for Tiny Mechanisms and are still optimized for
  mechanical micro-documentary content.
- ElevenLabs audio generation is tied to each scene and stores prompt purpose as `ssml`.

The rebuild should remove these assumptions from active runtime code. Old design docs may remain
as history.

## Selected Approach

Use a clean episode-first architecture.

```text
episode concept
-> generate candidates
-> select one candidate
-> generate episode plan
-> generate anchor image
-> approve or regenerate anchor
-> generate beat images from anchor/reference images
-> approve or regenerate beat images
-> generate episode narration track
-> build archive caption timing
-> build render input
-> render local MP4
```

This is preferred over patching the current system because continuity, narration timing, caption
style, and job boundaries all change at the same time. A partial rename would keep the system
hard to reason about.

## Provider And Cost Guardrails

Image generation uses the pinned model ID `gpt-image-2-2026-04-21`.

For `gpt-image-2`, do not pass `input_fidelity`. OpenAI documents that this parameter is not
configurable for the model because every image input is processed at high fidelity automatically.
This is useful for anchor-to-beat continuity, but edit requests with reference images can consume
more input image tokens than text-only generation or lower-fidelity reference workflows.
Do not budget these edit calls like older low-fidelity image workflows; the reference images are a
real cost input.

Regeneration must therefore be capped:

- `MAX_ANCHOR_IMAGE_REGENERATIONS_PER_EPISODE = 2`
- `MAX_BEAT_IMAGE_REGENERATIONS_PER_BEAT = 2`

When a cap is reached, the UI should ask the user to revise the plan, regenerate the anchor, or
start a new episode. The worker should not continue spending provider calls automatically.

## Data Model

### episodes

Primary user-facing entity.

Required fields:

- `id`
- `title`
- `concept`
- `status`
- `disclosure_mode`
- `selected_candidate_id`
- `selected_plan_id`
- `selected_anchor_asset_id`
- `selected_narration_asset_id`
- `selected_caption_timing_asset_id`
- `selected_render_input_asset_id`
- `target_duration_seconds`
- `format`
- `created_at`
- `updated_at`

Selection fields are nullable until the relevant user approval or generation gate has completed.
`episodes.format` is the only persisted format source of truth. Plans and render inputs copy from
the episode; they do not own a separate format decision.

Status values:

- `draft`
- `candidates_ready`
- `plan_ready`
- `anchor_ready`
- `beats_ready`
- `narration_ready`
- `captions_ready`
- `render_input_ready`
- `rendering`
- `done`
- `failed`

Allowed status transitions:

```text
draft -> candidates_ready
candidates_ready -> plan_ready
plan_ready -> anchor_ready
anchor_ready -> beats_ready
beats_ready -> narration_ready
narration_ready -> captions_ready
captions_ready -> render_input_ready
render_input_ready -> rendering
rendering -> done
any non-terminal status -> failed (unrecoverable episode invalidation only)
failed -> draft only through explicit user reset
```

Regeneration transitions are also allowed:

```text
anchor_ready -> anchor_ready
beats_ready -> anchor_ready
beats_ready -> beats_ready
narration_ready -> narration_ready
captions_ready -> captions_ready
render_input_ready -> captions_ready
```

Regenerating an anchor after beat images exist moves the episode back to `anchor_ready`, clears
`selected_image_asset_id` on all beats, and makes existing beat image assets stale through lineage.
Regenerating one beat keeps the episode at `beats_ready` and only clears that beat's selected image
until a new image is approved.
Regenerating narration keeps the episode at `narration_ready` if it succeeds and leaves the previous
selected narration in place if it fails. Regenerating captions keeps the episode at `captions_ready`
if it succeeds and leaves the previous selected caption timing asset in place if it fails.
Changing any selected anchor or beat image after `render_input_ready` clears
`selected_render_input_asset_id` and moves the episode back to `captions_ready` when narration and
captions are still valid.

The status should represent the latest valid completed gate, not every active job. Active work is
derived from `jobs`. A recoverable failed job does not automatically set `episodes.status` to
`failed`; it leaves the episode at the last valid gate and records the failure on the job. Use
`episodes.status = failed` only when the episode itself becomes unrecoverable. From `failed`, the
only transition is an explicit user reset to `draft`.

`disclosure_mode` values:

- `metadata_only`
- `opening_overlay`
- `closing_overlay`
- `opening_and_closing`

Default should be `closing_overlay`. The content is fictional, but the first frame should stay
clean and hook-focused.

### episode_candidates

Generated options for one episode.

Required fields:

- `id`
- `episode_id`
- `title`
- `logline`
- `anomaly_class`
- `visual_feasibility_score`
- `hook_strength_score`
- `fiction_clarity_score`
- `concept_payload`
- `reject_reason`
- `created_at`

`concept_payload` stores structured candidate details such as location, anomaly, opening visual,
evidence object, narration angle, and anti-failure notes.

Thresholds:

- `hook_strength_score` must be at least `7`
- `visual_feasibility_score` must be at least `7`
- `fiction_clarity_score` must be at least `6`

Candidates below any threshold remain visible but cannot be selected unless the user explicitly
chooses an override action. If all candidates are below threshold, the job fails with
`all_candidates_below_threshold`.

### episode_plans

The approved production blueprint for an episode.

Required fields:

- `id`
- `episode_id`
- `anomaly_class`
- `shot_archetype`
- `continuity_bible`
- `beat_plan`
- `subtitle_plan`
- `voice_plan`
- `anti_failure_rules`
- `created_at`
- `updated_at`

`continuity_bible` must be the source of truth for visual continuity. It should include location
geometry, materials, lighting, camera behavior, evidence object, color palette, visual exclusions,
and recurring anchor details.

`beat_plan` stores ordered beat descriptions. It should not store provider outputs.

Required `continuity_bible` shape:

```ts
{
  locationType: string;
  locationGeometry: string;
  materials: string[];
  lighting: string;
  cameraStyle: string;
  colorPalette: string[];
  evidenceObject: string;
  recurringDetails: string[];
  visualExclusions: string[];
  anomalyRules: string[];
}
```

Required `beat_plan` item shape:

```ts
{
  position: number;
  role: "hook" | "setup" | "evidence" | "escalation" | "reveal" | "disclosure";
  plannedDurationSeconds: number;
  narration: string;
  captionIntent: string;
  visualPrompt: string;
  motionPreset: "locked_photo" | "slow_push" | "handheld_drift" | "flash_jitter";
}
```

Required `voice_plan` shape:

```ts
{
  voiceTone: "calm_archive" | "dry_investigator" | "low_documentary";
  pacing: "slow" | "measured" | "urgent";
  targetWords: { min: number; max: number };
  forbiddenDelivery: string[];
}
```

Required `subtitle_plan` shape:

```ts
{
  style: "archive_caption";
  maxWordsPerSpeechSegment: number;
  evidenceLabels: Array<{ beatPosition: number; text: string }>;
  soundLabels: Array<{ beatPosition: number; text: string }>;
  disclosureText: string;
}
```

Default `disclosureText` must be `Fictional archive reconstruction.`

### episode_beats

Ordered timeline beats derived from the selected plan.

Required fields:

- `id`
- `episode_id`
- `plan_id`
- `position`
- `role`
- `planned_duration_seconds`
- `reconciled_start_seconds`
- `reconciled_end_seconds`
- `narration`
- `caption_intent`
- `visual_prompt`
- `motion_preset`
- `selected_image_asset_id`
- `created_at`
- `updated_at`

`planned_duration_seconds` comes from the episode plan. `reconciled_start_seconds` and
`reconciled_end_seconds` are nullable until caption timing is built from the final narration
alignment. Render input generation requires every non-disclosure beat to have reconciled timing.

Role values:

- `hook`
- `setup`
- `evidence`
- `escalation`
- `reveal`
- `disclosure`

The `disclosure` beat may be very short and may not require its own image if the overlay can sit
over the final visual beat. If it has no selected image, render input must mark the beat as
reusing the previous visual.

### assets

Append-only generated files.

Required fields:

- `id`
- `episode_id`
- `beat_id`
- `role`
- `kind`
- `storage_driver`
- `path`
- `mime_type`
- `size_bytes`
- `checksum`
- `provider`
- `model`
- `parent_anchor_asset_id`
- `reference_asset_ids`
- `status`
- `error_message`
- `created_at`
- `updated_at`

Role values:

- `anchor`
- `beat`
- `narration`
- `caption_timing`
- `render_input`
- `video`

Kind values:

- `image`
- `audio`
- `json`
- `video`

Provider values:

- `openai`
- `elevenlabs`
- `remotion`
- `local`

`parent_anchor_asset_id` links beat images back to the approved anchor image. `reference_asset_ids`
stores the actual image references used by the generation or edit request.

Nullable rules:

- `beat_id` is required for role `beat`
- `beat_id` is optional for role `caption_timing` only if the caption asset covers the full episode
- `beat_id` must be null for roles `anchor`, `narration`, `render_input`, and `video`
- `parent_anchor_asset_id` is required for role `beat`
- `parent_anchor_asset_id` must be null for role `anchor`
- `reference_asset_ids` is required for role `beat` and should include at least the anchor asset ID

### generation_attempts

Prompt, request, response, and failure history.

Required fields:

- `id`
- `episode_id`
- `asset_id`
- `purpose`
- `action`
- `prompt`
- `input_asset_ids`
- `response_metadata`
- `status`
- `error`
- `created_at`

Purpose values:

- `candidate`
- `episode_plan`
- `anchor_image`
- `beat_image`
- `narration`
- `caption_timing`
- `render_input`
- `render`

Action values:

- `generate`
- `edit`
- `compile`
- `render`

Use this table instead of `visual_qc_reviews`. Manual rejection reasons can be stored as failed or
superseded attempts with clear notes.

Nullable rules:

- `asset_id` is null before an asset row exists, such as candidate and episode plan attempts
- `asset_id` is required after a generation attempt creates or edits an asset
- `input_asset_ids` is required for image edit attempts and render input compilation
- `input_asset_ids` must include the anchor image for every `beat_image` edit attempt

Regeneration counters are derived from `generation_attempts`; do not store separate mutable counter
columns. Count attempts where `prompt.mode = "regenerate"` and
`response_metadata.provider_billable = true`. This includes provider-submitted failures and
successful-but-rejected images because both consume provider budget. Pre-validation failures do not
count.

Anchor regeneration count is per episode and never resets. Beat regeneration count is scoped to
`beat_id + parent_anchor_asset_id`; if a new anchor is approved, all beat image selections are
cleared and beat regeneration counts start fresh for the new anchor lineage.

### jobs

The existing worker concept remains, but the job table should become episode-level infrastructure.

Required fields:

- `id`
- `episode_id`
- `type`
- `status`
- `attempts`
- `max_attempts`
- `input`
- `output`
- `error_message`
- `next_retry_at`
- `created_at`
- `started_at`
- `finished_at`
- `updated_at`

Job type values:

- `generate_episode_candidates`
- `generate_episode_plan`
- `generate_anchor_image`
- `generate_beat_images`
- `generate_narration_track`
- `build_archive_captions`
- `build_render_input`
- `render_video`

Regeneration uses the same job types with explicit `input.mode = "regenerate"` and target IDs in
the job input. The first version can enforce only one active job per episode because the app is
single-user and local-running.

The one-active-job rule is enforced with a partial unique index:

```sql
unique (episode_id)
where status in ('pending', 'processing')
```

This keeps manual actions predictable and prevents simultaneous provider calls from racing the
episode state machine.

### renders

Render attempt metadata.

Required fields:

- `id`
- `episode_id`
- `input_asset_id`
- `output_asset_id`
- `duration_seconds`
- `width`
- `height`
- `fps`
- `status`
- `error_message`
- `created_at`
- `updated_at`

The MP4 path lives in the output video asset. The render input JSON path lives in the render input
asset.

## Job Flow

### 1. Generate Episode Candidates

Input:

- episode concept
- target duration
- channel format: `fictional_archive_mystery`

Output:

- 5-8 `episode_candidates`
- each with structured anomaly, hook, evidence object, and scoring

Failure examples:

- provider error
- invalid structured output
- all candidates below hook or feasibility threshold

### 2. Select Candidate

This is a UI/API action, not a worker job. It sets `episodes.selected_candidate_id`.

The UI should show title, logline, anomaly class, hook score, visual feasibility score, and reject
reason if any.

### 3. Generate Episode Plan

Input:

- selected candidate
- target duration
- disclosure mode

Output:

- one `episode_plans` row
- ordered `episode_beats`

The plan must include:

- continuity bible
- beat plan
- voice plan
- subtitle plan
- anti-failure rules

### 4. Generate Anchor Image

Input:

- continuity bible
- hook beat
- shot archetype

Output:

- one pending then ready image asset with role `anchor`
- one generation attempt with purpose `anchor_image`

The anchor image is the visual source of truth. It must show the impossible contradiction clearly
at phone size and keep the lower safe zone usable for captions. It must not contain readable text,
signs, logos, numbers, UI, or watermarks.

### 5. Approve Or Regenerate Anchor

This is a manual gate. If the anchor looks fake, warped, too subtle, too long-corridor, or visually
confusing, regenerate before any beat images are created.

Approving an anchor sets `episodes.selected_anchor_asset_id` to the approved anchor asset. Beat
generation must use this selected anchor as `parent_anchor_asset_id`.

If an anchor is approved after beat images already exist, clear all `episode_beats.selected_image_asset_id`
values and move `episodes.status` back to `anchor_ready`.

### 6. Generate Beat Images

Input:

- approved anchor image
- continuity bible
- beat visual prompts
- optional previous beat reference

Output:

- beat image assets linked to the anchor through `parent_anchor_asset_id`
- reference IDs stored in `reference_asset_ids`

Beat images use the OpenAI image edit endpoint with the anchor image as a high-fidelity reference.
Independent text-only image generation is limited to the initial anchor image. If edit generation
fails for a provider or moderation reason, the job should fail or retry according to the normal job
policy rather than silently falling back to independent generation.

### 7. Approve Or Regenerate Beat Images

This is a manual gate. Regenerating one beat should not invalidate the anchor. If the anchor itself
is wrong, regenerate from the anchor step and mark later beat assets stale through lineage.

Approving a beat image sets `episode_beats.selected_image_asset_id`. Render input generation must
use only selected beat images.

### 8. Generate Narration Track

Input:

- ordered episode beats
- voice plan
- full spoken script

Output:

- one audio asset with role `narration`
- raw ElevenLabs alignment metadata in generation attempt response metadata

Default behavior is one episode-level audio request. If the script exceeds provider limits, split
only as a fallback and pass previous/next text or request IDs for continuity.

On success, set `episodes.selected_narration_asset_id` to the generated narration asset.

### 9. Build Archive Captions

Input:

- narration text
- ElevenLabs timing data
- subtitle plan
- episode beats

Output:

- one caption timing JSON asset

This step is a deterministic compiler, not a creative generation call. It may use plan hints for
evidence overlays, but speech timing must come from provider alignment.
On success, set `episodes.selected_caption_timing_asset_id` to the generated caption timing asset.

Timing reconciliation:

1. Start from `episode_beats.planned_duration_seconds`.
2. Generate the final episode-level narration.
3. Derive phrase timings from ElevenLabs alignment.
4. Recompute beat start/end boundaries from the narration phrases assigned to each beat.
5. If total audio duration is within 2 seconds of target duration, stretch or shrink visual beat
   image durations to match the actual narration and write the result to
   `episode_beats.reconciled_start_seconds` and `episode_beats.reconciled_end_seconds`.
6. If total audio duration exceeds the target by more than 2 seconds, fail with
   `narration_exceeds_duration` and require script revision before render input generation.

The render input always follows actual narration duration and reconciled beat timing, not the
original planned duration. `renderInput.format.durationSeconds` is derived from the selected
narration audio duration rounded up to a whole frame at the render FPS.

### 10. Build Render Input

Input:

- approved beat images
- narration audio
- caption timing JSON
- episode plan

Output:

- one render input JSON asset

On success, set `episodes.selected_render_input_asset_id` to the generated render input asset.

### 11. Render Video

Input:

- render input JSON asset

Output:

- one MP4 video asset
- one render row updated to succeeded or failed

## Prompt Architecture

### Candidate Prompt

The candidate prompt should generate several fictional mystery concepts and score them. It should
optimize for one large visible contradiction that can be understood in under half a second.

Required candidate fields:

- title
- logline
- anomaly_class
- location_type
- impossible_contradiction
- first_frame_description
- evidence_object
- documentary_angle
- visual_feasibility_score
- hook_strength_score
- fiction_clarity_score
- anti_failure_rules

### Episode Plan Prompt

The plan prompt turns the selected candidate into a production blueprint. It must produce JSON only.

Required plan fields:

- anomaly_class
- shot_archetype
- continuity_bible
- beat_plan
- voice_plan
- subtitle_plan
- anti_failure_rules

The plan should not produce image files, audio timing, or render input.

### Anchor Image Prompt

The anchor image prompt should be strict and reusable. It should describe:

- found-footage evidence frame
- flash-lit documentary photo
- unsettling liminal architecture
- one obvious impossible contradiction
- foreground evidence object for scale
- harsh practical lighting
- clean lower safe zone
- no in-image text, signs, logos, numbers, watermark, or UI

The prompt should avoid over-specific location fixes that break when the location changes. The
location-specific details should come from `continuity_bible`.

### Beat Image Prompt

Each beat image prompt must include:

- continuity bible summary
- anchor image reference
- beat-specific visual action
- what must remain consistent
- what may change
- anti-failure rules for the anomaly class

The prompt should not randomly restyle the location. It should not ask for subtle anomalies that
only read at full size.

### Narration Prompt

Narration should be concise spoken English. It should sound like a serious fictional documentary,
not a horror story and not a YouTube explainer.

Rules:

- no SSML
- no stage directions
- no markdown
- no speaker labels
- no digits when words are clearer for TTS
- no symbols or emojis
- no real crime implication
- no claims that the event is real

For a 45-second episode, target roughly 85-105 spoken English words. If audio exceeds the target
duration, revise the script before increasing voice speed.

### Caption Compiler

Caption text should be compiled from narration timing and subtitle plan hints.

The compiler should create phrase-level segments instead of active word highlighting. The model
should not be asked to invent word-level timestamps.

## Image Continuity Strategy

Continuity must be handled through data and references, not by continually patching a text prompt.

Required continuity inputs:

- anchor image asset
- continuity bible
- anomaly class
- beat position
- previous approved beat image when useful

Recommended reference chain:

```text
anchor image
-> beat 1 image uses anchor
-> beat 2 image uses anchor plus beat 1 if needed
-> beat 3 image uses anchor plus beat 2 if needed
```

Every generated beat image should store:

- parent anchor asset ID
- reference asset IDs
- prompt JSON
- model
- provider
- response metadata

If a beat fails visually, regenerate only that beat with the same anchor and stricter beat prompt.
If multiple beats fail because the world is wrong, regenerate the anchor.

Beat regeneration is capped by the provider guardrail. The UI should display remaining
regenerations per beat.

## Anomaly Classes

The first implementation should support a small set of anomaly classes instead of unlimited random
places.

The anomaly class registry lives in `packages/shared` as constants and Zod schemas. Database enums,
API schemas, and prompt templates must derive from that shared registry rather than duplicating
string literals.

Starting set:

- `missing_room`
- `dead_end_track`
- `impossible_corridor`
- `shadow_absence`
- `sealed_exit`
- `repeating_door`
- `wrong_reflection`

Each class should have prompt rules and anti-failure rules.

Example:

```text
dead_end_track:
- the rail line must visibly terminate in a physically impossible way
- the platform must still look like a real transit station
- no wall should look like a normal construction barrier unless the contradiction is obvious
- use one foreground object for scale
- avoid unreadable deep tunnels
```

## Voiceover Design

Use ElevenLabs as the narration provider.

Default model:

- `eleven_multilingual_v2` unless testing proves a better English-only model for the chosen voice

Default settings:

- `stability`: around `0.6`
- `similarity_boost`: around `0.75`
- `style`: `0` to `0.15`
- `use_speaker_boost`: true when supported by the model
- `speed`: `0.96` to `1.04` for minor correction only

The current old setting with higher style is too performative for a restrained archive documentary.
Voice selection matters more than settings. The chosen voice should sound calm, observant, and
slightly uneasy without theatrical horror acting.

The narration job must store:

- exact spoken text
- voice ID
- model ID
- voice settings
- output format
- request IDs if available
- raw alignment
- normalized alignment when available

Caption timing should prefer normalized alignment when text normalization is applied.

## Asset Directory Layout

All generated files live under `LOCAL_ASSET_ROOT` with portable relative paths.

Episode layout:

```text
episodes/{episodeId}/
  images/
    anchor/{assetId}.png
    beats/{beatId}/{assetId}.png
  audio/
    narration/{assetId}.mp3
  captions/
    {assetId}.json
  render-input/
    {assetId}.json
  renders/
    {assetId}.mp4
```

The database stores only these relative paths. The frontend never receives raw filesystem paths;
it requests asset previews through API endpoints.

## Archive Caption System

Replace `KaraokeCaption` with an archive documentary caption system.

Segment kinds:

- `hook`
- `speech`
- `evidence`
- `sound`
- `disclosure`

Segment shape:

```ts
{
  id: string;
  kind: "hook" | "speech" | "evidence" | "sound" | "disclosure";
  text: string;
  startSeconds: number;
  endSeconds: number;
  anchor: "upper" | "middle" | "lower";
  priority: number;
}
```

Priority semantics:

- higher priority wins when segments overlap in the same anchor region
- default priorities are `speech = 10`, `sound = 20`, `evidence = 30`, `hook = 40`,
  `disclosure = 50`
- render at most two simultaneous caption segments
- `hook` and `disclosure` suppress lower-priority `speech` segments if they overlap

Caption rules:

- no word-by-word karaoke
- no active yellow word pulse
- no mechanism keyword coloring
- phrase-level speech captions, usually 3-6 words
- maximum two lines
- keep within mobile safe zones
- do not cover the visual anomaly
- evidence labels should be sparse and documentary-like
- disclosure segment must be readable but should not destroy the opening hook

The renderer should fall back to static phrase captions if caption JSON is missing or invalid.

Disclosure overlay text:

```text
Fictional archive reconstruction.
```

For `closing_overlay`, show this as a final lower-third disclosure for at least 2 seconds. For
`opening_and_closing`, show a shorter opening label:

```text
Fictional reconstruction.
```

The opening label must not appear on the first hook frame unless the user explicitly chooses
`opening_overlay` or `opening_and_closing`.

## Render Input V2

Render input should become episode timeline data.

Shape:

```ts
{
  episodeId: string;
  title: string;
  format: {
    width: 1080;
    height: 1920;
    fps: 30;
    durationSeconds: number;
  };
  narrationAudioPath: string;
  captionTimingPath: string;
  beats: Array<{
    id: string;
    position: number;
    role: string;
    startSeconds: number;
    endSeconds: number;
    imagePath?: string;
    reusePreviousVisual?: boolean;
    motionPreset: string;
  }>;
  subtitleSegments: Array<{
    kind: string;
    text: string;
    startSeconds: number;
    endSeconds: number;
    anchor: string;
  }>;
}
```

Non-disclosure beats require `imagePath`. A disclosure beat may omit `imagePath` only when
`reusePreviousVisual = true`; the renderer should hold the previous beat image behind the
disclosure overlay.

Remotion should render:

- one root narration `<Audio>`
- beat image `<Sequence>` components
- global-time caption overlays
- subtle image motion only, such as slow push, handheld drift, flash jitter, or frame noise

Do not animate with CSS transitions. Motion must be frame-driven.

## UI Flow

The episode detail page should be a step-by-step editor:

1. Concept
2. Candidates
3. Plan
4. Anchor Image
5. Beat Images
6. Narration and Captions
7. Render

Each step should show the active job state and failure reason near the action button.

Manual gates:

- choose candidate
- approve anchor image
- approve or regenerate beat images
- preview narration and captions
- render final video

The UI should show image and audio previews through API-served asset URLs, not local filesystem
paths.

## API Surface

Initial API routes:

- `GET /health`
- `GET /episodes`
- `POST /episodes`
- `GET /episodes/:episodeId`
- `DELETE /episodes/:episodeId`
- `GET /episodes/:episodeId/jobs`
- `GET /episodes/:episodeId/jobs/:jobId`
- `POST /episodes/:episodeId/jobs/generate-candidates`
- `POST /episodes/:episodeId/candidates/:candidateId/select`
- `POST /episodes/:episodeId/jobs/generate-plan`
- `POST /episodes/:episodeId/jobs/generate-anchor-image`
- `POST /episodes/:episodeId/jobs/regenerate-anchor-image`
- `POST /episodes/:episodeId/anchor/images/:assetId/approve`
- `POST /episodes/:episodeId/jobs/generate-beat-images`
- `POST /episodes/:episodeId/beats/:beatId/jobs/regenerate-image`
- `POST /episodes/:episodeId/beats/:beatId/images/:assetId/approve`
- `POST /episodes/:episodeId/jobs/generate-narration`
- `POST /episodes/:episodeId/jobs/build-captions`
- `POST /episodes/:episodeId/jobs/build-render-input`
- `POST /episodes/:episodeId/jobs/render-video`
- `GET /assets/:assetId/file`

Mutating endpoints must reject requests with `409 Conflict` when the episode already has an active
pending or processing job.

## Error Handling

Jobs should fail loudly with actionable messages.

Examples:

- `candidate_generation_invalid_schema`
- `all_candidates_below_threshold`
- `episode_plan_invalid_schema`
- `anchor_image_generation_failed`
- `beat_image_reference_missing`
- `elevenlabs_alignment_missing`
- `narration_exceeds_duration`
- `caption_timing_invalid`
- `render_input_missing_asset`
- `render_video_failed`

Retry should be explicit for creative failures. Provider/network failures can use the existing
capped retry pattern.

Recoverable job failures should not discard approved work. For example, if narration generation
fails while the episode is at `beats_ready`, the failed job is visible in the UI and the episode
stays at `beats_ready` so the user can retry narration without regenerating candidates, plans,
anchors, or beat images.

## Migration Strategy

This rebuild intentionally discards old user data.

Implementation may use a destructive schema migration that drops old workflow tables and creates
the new episode-first schema. Because the project requires reversible migrations, the matching
`down.sql` should restore the previous schema structure. It does not need to restore dropped data.

Rollback is therefore schema-reversible but not data-recoverable.

## Code Removal Map

Implementation should remove or replace active runtime references to:

- Tiny Mechanisms constants and presets
- seed-bank recovery paths
- old project/scene schemas where they are user-facing workflow state
- `generate_script`
- `generate_scene_image`
- `generate_scene_audio`
- `run_project_flow`
- `upload_youtube`
- `ssml`
- `KaraokeCaption`
- mechanism keyword caption styling
- Google image provider path for this workflow
- YouTube scheduling and upload UI for this clean rebuild

Historical docs can remain.

## Verification Plan

Because this is a design/spec step, no implementation verification is required yet. The later
implementation plan should include the lightest relevant checks:

- database schema generation and check
- migration up/down check for the new schema
- shared schema typecheck
- API health check
- one worker smoke path with mocked or real provider credentials
- one Remotion render smoke using local fixture assets
- manual UI check for candidate, anchor, beat image, narration, caption, and render steps

## Acceptance Criteria

The rebuild is successful when:

- a user can create one fictional archive mystery episode
- candidates are generated and manually selectable
- an episode plan is generated from the selected candidate
- one anchor image is generated and approved
- beat images are generated from the approved anchor/reference chain
- ElevenLabs creates one episode-level narration track with timing data
- archive captions are generated without word-by-word karaoke
- Remotion renders a local 9:16 MP4
- generated content is English
- fictional disclosure is present according to `disclosure_mode`
- active runtime code no longer depends on Tiny Mechanisms, scene-level SSML, or old karaoke
  styling
- job failure reasons are visible near the failed workflow action

## Disclosure Decision

The default disclosure mode is `closing_overlay`. The content remains fictional, but the first
frame stays hook-focused and free of disclosure text. Users can switch to `opening_and_closing`
for stricter disclosure when needed.
