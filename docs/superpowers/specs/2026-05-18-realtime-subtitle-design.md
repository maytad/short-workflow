# Realtime Karaoke Subtitle + ElevenLabs TTS Design

Date: 2026-05-18
Author: short-workflow MVP
Status: Draft, awaiting user review

## Goal

Replace the static per-scene caption with a realtime karaoke subtitle. Each spoken word highlights as the narrator says it. Highlight uses yellow color and a slight scale-up. Words display in 4-6 word chunks that swap when the active word leaves the chunk.

To support accurate word timing, switch the TTS provider for `generate_scene_audio` from Google Gemini TTS to ElevenLabs `convertWithTimestamps`. ElevenLabs returns audio plus character-level timing in the same response, so no separate ASR pass is needed.

## Non-Goals

- No change to script generation, image generation, retry logic, or job/asset model semantics.
- No streaming TTS (use `convertWithTimestamps`, not `streamWithTimestamps`).
- No voice cloning, no per-project voice override (deferred to a future spec).
- No background music, no subtitle export (`.srt`, `.vtt`).
- No automatic Gemini fallback when ElevenLabs fails — the existing job retry mechanism handles transient failures.

## Scope

Files that change:

- `packages/ai/src/elevenLabsTts.ts` — new
- `packages/ai/src/captionTiming.ts` — new
- `packages/ai/src/index.ts` — re-export new modules
- `packages/ai/package.json` — add `@elevenlabs/elevenlabs-js`
- `packages/shared/src/constants.ts` — extend `ASSET_KINDS` and `ASSET_PROVIDERS`
- `packages/shared/src/render.ts` — add optional `captionTimingPath` on `renderSceneInputSchema`
- `packages/db/migrations/<timestamp>_add_caption_timing/migration.sql` and `down.sql` — new
- `packages/db/src/schema.ts` — extend asset enums to match constants
- `apps/worker/src/handlers/generateSceneAudio.ts` — replace TTS provider, save second asset
- `apps/worker/src/assets.ts` — add `sceneCaptionTimingPath` helper
- `apps/worker/src/handlers/renderVideo.ts` — attach `captionTimingPath` when ready asset exists
- `apps/render/src/render.ts` — stage caption timing into Remotion `publicDir`
- `apps/render/src/ShortVideo.tsx` — split into `KaraokeCaption` and `StaticCaption`
- `apps/worker/.env.example` — add ElevenLabs env vars

Files explicitly NOT changed:

- `packages/ai/src/googleTts.ts` — left in place as dead code; remove in a follow-up cleanup spec.
- `packages/ai/src/prompts/ttsPrompt.ts` — left in place but no longer wired into the audio handler. ElevenLabs does not consume a prompt direction string. Remove in follow-up.
- `packages/ai/src/prompts/scriptPlan.ts` — `ssml` field still required by the script schema. ElevenLabs ignores SSML and uses `narration` plain text. Removing `ssml` from the schema is a separate decision.

## High-Level Pipeline

```
generate_scene_audio job
  ├─ load scene
  ├─ load neighboring scenes for context (previous, next)
  ├─ call ElevenLabs convertWithTimestamps
  │     in:  text=narration, voice_id, model_id, voice_settings,
  │          previous_text, next_text, output_format=mp3_44100_128
  │     out: { audio_base64, alignment: { characters, character_start_times_seconds, character_end_times_seconds } }
  ├─ save audio asset (mp3, kind=audio, provider=elevenlabs)
  ├─ derive words[] from character alignment
  ├─ validate words[] (see §Validation)
  ├─ if valid: save caption_timing asset (json, kind=caption_timing, provider=elevenlabs)
  │  if invalid: log and skip — renderer falls back to static caption
  ├─ insert prompt_version row recording voice settings + model_id
  └─ mark job succeeded
```

The job remains scene-by-scene. One scene equals one ElevenLabs request, one audio asset, and at most one caption_timing asset.

## Components

### `packages/ai/src/elevenLabsTts.ts`

Wraps the official SDK. Exposes one function:

```ts
export type ElevenLabsTtsInput = {
  narration: string;
  previousText?: string;
  nextText?: string;
  voiceId: string;
  modelId: string;
};

export type ElevenLabsTtsOutput = {
  bytes: Uint8Array;            // mp3 bytes decoded from audio_base64
  mimeType: "audio/mpeg";
  model: string;
  alignment: {
    characters: string[];
    characterStartTimesSeconds: number[];
    characterEndTimesSeconds: number[];
  } | null;
  responseMetadata: Record<string, unknown>;
};

export async function generateSpeechWithTimestamps(
  input: ElevenLabsTtsInput,
): Promise<ElevenLabsTtsOutput>;
```

Implementation:

- Read `process.env.ELEVENLABS_API_KEY`. Throw `ELEVENLABS_API_KEY_missing` if absent.
- Construct `new ElevenLabsClient({ apiKey })`.
- Call `client.textToSpeech.convertWithTimestamps(voiceId, body)` where body uses the camelCase fields confirmed in the SDK type definitions.
- `voice_settings` is a constant in this file:
  ```ts
  export const ELEVENLABS_VOICE_SETTINGS = {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.4,
    useSpeakerBoost: true,
  } as const;
  ```
- `output_format` is `"mp3_44100_128"` (compatible with all ElevenLabs tiers).
- Decode `audio_base64` to `Uint8Array`.
- Return `alignment` as-is when present, else `null`.

⚠️ Implementation flag: read SDK type definitions for the response shape before writing the parser. Context7 docs confirmed the request shape but not the response type. The expected response object has `audio_base64` (camelCase form may be `audioBase64`) and `alignment` with three parallel arrays.

### `packages/ai/src/captionTiming.ts`

Pure utility, no side effects. Exposes:

```ts
export type CaptionWord = { text: string; start: number; end: number };

export type CaptionTimingDoc = {
  version: 1;
  narration: string;
  audioDurationSeconds: number;
  words: CaptionWord[];
};

export function alignmentToWords(alignment: {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}): CaptionWord[];

export function buildCaptionTimingDoc(
  alignment: ElevenLabsAlignment,
): CaptionTimingDoc;

export function validateCaptionTimingDoc(
  doc: CaptionTimingDoc,
  options: { sceneDurationSeconds: number },
): { ok: true } | { ok: false; reason: string };
```

`alignmentToWords` walks the parallel arrays:

```
let current: { chars: number[] } | null = null
for i in 0..characters.length:
  c = characters[i]
  if c is whitespace:
    if current: emit word from current; current = null
  else:
    if current is null: current = { chars: [] }
    current.chars.push(i)
if current: emit word from current

emit word from { chars }:
  text  = chars.map(i => characters[i]).join("")
  start = characterStartTimesSeconds[chars[0]]
  end   = characterEndTimesSeconds[chars[chars.length - 1]]
```

Punctuation that immediately follows a word stays attached to that word. Standalone punctuation (rare) is appended to the previous word if any, otherwise dropped.

`narration` field in the doc is the concatenation of `characters[]`, not `scene.narration`. ElevenLabs may normalize text (e.g. expand "QR" → "Q R") and the renderer needs to display what was actually spoken.

`audioDurationSeconds` is `Math.max(...characterEndTimesSeconds)`.

`validateCaptionTimingDoc` checks:

- `words.length >= 1`
- every word: `start >= 0`, `end > start`
- monotonic: `words[i].end <= words[i+1].start + 0.05`
- `audioDurationSeconds <= sceneDurationSeconds + 0.5`

If any check fails, return `{ ok: false, reason }`. The handler logs the reason and skips saving the caption_timing asset; the audio asset still saves.

### `packages/shared/src/constants.ts`

```ts
export const ASSET_KINDS = [
  "image",
  "audio",
  "render",
  "thumbnail",
  "render_input",
  "caption_timing",
] as const;

export const ASSET_PROVIDERS = [
  "openai",
  "google_gemini",
  "google_tts",
  "remotion",
  "local",
  "elevenlabs",
] as const;
```

### `packages/shared/src/render.ts`

```ts
export const renderSceneInputSchema = z
  .object({
    id: uuidSchema,
    position: z.number().int().positive(),
    role: sceneRoleSchema,
    durationSeconds: z.number().min(1).max(60),
    narration: z.string(),
    caption: z.string(),
    imagePath: z.string().min(1),
    audioPath: z.string().min(1),
    captionTimingPath: z.string().optional(),
  })
  .strict();
```

`captionTimingPath` is the relative or absolute path used the same way `imagePath` and `audioPath` are.

### `packages/db/migrations/<timestamp>_add_caption_timing/`

`migration.sql`:

- Drop existing check constraints on `assets.kind` and `assets.provider`.
- Re-create with the new value sets matching `ASSET_KINDS` and `ASSET_PROVIDERS`.
- The exact statements depend on whether `assets.kind` and `assets.provider` are stored as enums or text+check; align with the current DDL when generating.

`down.sql`:

- Refuse rollback (`SELECT 1/0`) if any row uses `kind = 'caption_timing'` or `provider = 'elevenlabs'`. Per AGENTS.md migration rules, irreversible migrations must include an explicit failing statement and a comment explaining why.
- If no such rows exist, drop and re-create the constraints with the original value sets.

### `packages/db/src/schema.ts`

Update Drizzle column definitions for `assets.kind` and `assets.provider` to mirror the constants. Run `bun run db:generate` and verify the generated SQL matches the hand-written `migration.sql` before applying.

### `apps/worker/src/assets.ts`

Add a path helper:

```ts
export function sceneCaptionTimingPath(
  projectId: string,
  sceneId: string,
  assetId: string,
): string {
  return path.posix.join(
    "projects",
    projectId,
    "scenes",
    sceneId,
    "captions",
    `${assetId}.json`,
  );
}
```

Mirrors the existing `sceneAudioPath` shape so `LOCAL_ASSET_ROOT/projects/{id}/scenes/{id}/captions/...` is the on-disk layout.

### `apps/worker/src/handlers/generateSceneAudio.ts`

Replace the Gemini TTS call with ElevenLabs. Steps:

1. Load `scene` via `getScene`.
2. Load all project scenes via `listProjectScenes` to find neighbors by position.
3. Load latest script `prompt_version` and derive `styleContext` (existing).
4. Create pending `audio` asset (provider `"elevenlabs"`).
5. Call `generateSpeechWithTimestamps`.
6. Write audio bytes to `sceneAudioPath(...)`.
7. Mark audio asset ready (`mimeType: "audio/mpeg"`, `provider: "elevenlabs"`, `model: ELEVENLABS_MODEL_ID`).
8. If `alignment` present:
   - Build `CaptionTimingDoc`.
   - Run `validateCaptionTimingDoc`.
   - On valid: create pending `caption_timing` asset, write JSON file, mark ready.
   - On invalid: log structured warning `caption_timing_invalid: <reason>`, skip caption asset.
9. Insert `prompt_version` (purpose `"ssml"`, provider `"elevenlabs"`) recording the request body shape and model id for audit.
10. Mark job succeeded with `{ assetId, captionTimingAssetId, promptVersionId }`.

Error handling:

- ElevenLabs call throws → audio asset is marked failed, caption asset is never created, job error bubbles up to existing retry logic.
- File write fails after audio call → audio asset marked failed.
- `caption_timing` asset failure (file write or DB insert) → log and continue. Audio asset and job still succeed. The renderer fallback path covers this case.

### `apps/worker/src/handlers/renderVideo.ts`

In `buildRenderInput`, additionally fetch the current ready `caption_timing` asset for each scene (via `getCurrentReadySceneAsset` extended to accept `kind: "caption_timing"`, or a new helper `getCurrentReadyCaptionTiming`). When present, attach `captionTimingPath: absoluteAssetPath(...)` to the scene input.

If absent, omit the field. The render schema accepts it as optional.

### `apps/render/src/render.ts`

Extend `stageRenderInputAssets` to also stage `captionTimingPath` when present:

```ts
captionTimingPath: scene.captionTimingPath
  ? await stageAsset({
      assetPath: scene.captionTimingPath,
      kind: "caption",
      publicDir,
      sceneId: scene.id,
    })
  : undefined,
```

Add `"caption"` as an accepted `kind` in `stageAsset` for the staged filename suffix.

### `apps/render/src/ShortVideo.tsx`

Split caption rendering:

```tsx
function SceneCaption({ scene, sceneStartFrame, fps }) {
  if (scene.captionTimingPath) {
    return (
      <KaraokeCaption
        timingSrc={resolveMediaSrc(scene.captionTimingPath)}
        sceneStartFrame={sceneStartFrame}
        fps={fps}
      />
    );
  }
  return <StaticCaption text={scene.caption} />;
}
```

`StaticCaption` is the current caption block.

`KaraokeCaption` reads the JSON via Remotion's data fetching (`useEffect` + `fetch(timingSrc)` + `useState`, then `delayRender`/`continueRender` to keep the bundle waiting until the JSON loads). Once words are loaded:

- Compute `t = (useCurrentFrame() - sceneStartFrame) / fps`.
- Find `activeIndex` such that `words[i].start <= t < words[i].end`. If none, use `-1`.
- Build chunks via `chunkWords(words, { target: 5, min: 4, max: 6 })`:
  - Greedy walk. Start a new chunk after a word ending in `.`, `?`, `!`, or after a comma if chunk size >= `min`.
  - Force a break after `max` words even without punctuation.
- Choose the chunk that contains `activeIndex`; if `activeIndex === -1`, choose the first chunk for pre-roll and the last chunk for post-roll based on `t` vs the chunk boundaries.
- Render the chunk in one line, white text. The active word gets:
  - color `#FFD400`
  - `transform: scale(1.08)`
  - `transition: transform 80ms ease-out, color 80ms ease-out`
- Font, weight, position, and shadow remain identical to the current `StaticCaption` so the visual baseline does not jump between scenes that have or lack timing.

### `apps/worker/.env.example`

```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

`eleven_multilingual_v2` is the documented widely-available default. The user can override via env to try `eleven_v3` or `eleven_flash_v2_5`.

## Validation

Per AGENTS.md MVP testing policy: lightweight checks only.

- `captionTiming.test.ts` (new, in `packages/ai`): unit-test `alignmentToWords` and `validateCaptionTimingDoc` against fixed fixtures (one well-formed, one with whitespace at start, one missing alignment data).
- Manual: run `generate_scene_audio` for one scene of an existing tiny-mechanisms project. Verify on disk:
  - `audio/<id>.mp3` exists, plays back.
  - `captions/<id>.json` exists, schema matches §Components.
- Manual: render that scene through Remotion Studio. Confirm the active word visibly highlights and stays in sync.
- Migration: `bun run db:check` → `bun run db:migrate:up`. Insert a test row with the new kind/provider to confirm the constraints accept it.

## Edge Cases

| Case | Behavior |
| --- | --- |
| ElevenLabs 5xx or network error | Throw, existing `next_retry_at` backoff retries. |
| ElevenLabs 4xx (auth/quota) | Throw, retries, max attempts hit, job fails. |
| Response missing `alignment` | Save audio, skip caption_timing, log `alignment_missing`. |
| `validateCaptionTimingDoc` fails | Save audio, skip caption_timing, log reason. |
| Scene narration changes after audio gen | `content_updated_at` bump invalidates the audio asset for staleness checks (existing behavior). Regenerating produces new audio + new caption_timing assets. |
| Multiple regenerations | Append-only. `getCurrentReadySceneAsset` already returns the most recent ready asset per kind. |
| Scene without caption_timing | Renderer uses `StaticCaption`. No render error. |
| Rendering an old project (Gemini WAV scenes) | Audio still plays via existing `audio` kind. No `caption_timing` exists. Renderer falls back. |

## Rollback

- Worker: revert `generateSceneAudio.ts` to the Gemini TTS implementation. New audio assets revert to WAV. Old ElevenLabs MP3 assets continue to play (Remotion Audio supports both).
- Renderer: no rollback needed. The optional `captionTimingPath` continues to work for any existing assets.
- Migration: if no rows exist with `caption_timing` or `elevenlabs`, the down migration succeeds. Otherwise it fails loudly per AGENTS.md.
- Old Gemini-generated scenes do not gain karaoke unless the user regenerates audio.

## Dependencies

- New runtime dep: `@elevenlabs/elevenlabs-js` (latest). ⚠️ Per AGENTS.md "Ask first before adding dependencies": user has approved this in conversation, but the implementation plan must record the exact pinned version.

## Open Questions / Implementation Flags

1. SDK response shape — read `node_modules/@elevenlabs/elevenlabs-js/.../convertWithTimestamps` return type before writing the parser. The body type is confirmed (`BodyTextToSpeechFull`, camelCase). The response type is referenced in docs but not dumped in detail.
2. `eleven_v3` model — only available on certain account tiers. Default env value is `eleven_multilingual_v2`. The user can change it.
3. `assets.kind` / `assets.provider` storage — confirm in schema whether these are Postgres enums or text + check constraints. The migration shape differs slightly between the two.
4. Punctuation grouping in `alignmentToWords` — initial implementation attaches trailing punctuation to the preceding word. If observed behavior in the live response is different (e.g. spaces around punctuation), adjust the grouping rule and add a fixture.

## Decision Log

- **TTS provider**: ElevenLabs `convertWithTimestamps` over Gemini + ASR. Reason: timing comes free with TTS, single round-trip, lower complexity.
- **Granularity**: word-level karaoke (option A). Reason: user choice.
- **Active word style**: yellow + scale 1.08. Reason: user choice.
- **Layout**: 4-6 word chunk swap (option A). Reason: user choice.
- **Voice strategy**: hard-coded env (option C). Reason: user choice. Schema accepts `captionTimingPath` as optional, leaving room for per-project voice override later.
- **Job unit**: scene-by-scene, not single-shot. Reason: preserves scene-level retry, asset 1:1 model, edit-one-scene workflow. ElevenLabs `previous_text`/`next_text` covers the prosody continuity argument for one-shot.
- **Caption asset format**: JSON file under `LOCAL_ASSET_ROOT/projects/{id}/scenes/{id}/captions/`. Reason: matches existing append-only file layout. No new table needed.
- **Static caption fallback in renderer**: kept. Reason: lets old projects render without regen; required by append-only constraint.
