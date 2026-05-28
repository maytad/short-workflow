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
- Use `gpt-image-2` as the primary image model.
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
- `target_duration_seconds`
- `format`
- `created_at`
- `updated_at`

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

### episode_plans

The approved production blueprint for an episode.

Required fields:

- `id`
- `episode_id`
- `format`
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

### episode_beats

Ordered timeline beats derived from the selected plan.

Required fields:

- `id`
- `episode_id`
- `plan_id`
- `position`
- `role`
- `duration_seconds`
- `narration`
- `caption_intent`
- `visual_prompt`
- `motion_preset`
- `created_at`
- `updated_at`

Role values:

- `hook`
- `setup`
- `evidence`
- `escalation`
- `reveal`
- `disclosure`

The `disclosure` beat may be very short and may not require its own image if the overlay can sit
over the final visual beat.

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

### jobs

The existing worker concept remains, but the job table should become episode-level infrastructure.

Required fields:

- `id`
- `episode_id`
- `type`
- `status`
- `attempts`
- `max_attempts`
- `parent_job_id`
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

### 10. Build Render Input

Input:

- approved beat images
- narration audio
- caption timing JSON
- episode plan

Output:

- one render input JSON asset

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

- format: `fictional_archive_mystery`
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

## Anomaly Classes

The first implementation should support a small set of anomaly classes instead of unlimited random
places.

Suggested starting set:

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
    imagePath: string;
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
