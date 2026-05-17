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
- `packages/ai/src/captionTiming.ts` — new (builders + validators; imports types from `@short-workflow/shared`)
- `packages/ai/src/index.ts` — re-export new modules
- `packages/ai/package.json` — add `@elevenlabs/elevenlabs-js`
- `packages/shared/src/captionTiming.ts` — new (Zod schema + types, shared between worker and renderer)
- `packages/shared/src/index.ts` — re-export `captionTimingDocSchema` and types
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
  │     in:  text=narration, voiceId, modelId, voiceSettings,
  │          previousText, nextText, outputFormat="mp3_44100_128"
  │     out: { audioBase64, alignment: { characters, characterStartTimesSeconds, characterEndTimesSeconds } }
  ├─ if alignment is null/missing: mark audio asset failed, throw — retry (alignment is required)
  ├─ validate raw alignment (non-empty, equal-length arrays, finite numbers, end > start)
  │     fail audio if not — alignment is malformed
  ├─ derive audioDurationSeconds = max(characterEndTimesSeconds) (safe now: validation guarantees array is non-empty and finite)
  ├─ if audioDurationSeconds > sceneDurationSeconds + 0.5:
  │     mark audio asset failed, throw — job retries (see §Audio overflow)
  ├─ save audio asset (mp3, kind=audio, provider=elevenlabs)
  ├─ derive words[] from character alignment
  ├─ validate words[] (see §Validation)
  ├─ if valid: save caption_timing asset (json, kind=caption_timing, provider=elevenlabs)
  │     — file name is {audioAssetId}.json, pairing the caption to the audio
  │     — JSON also embeds sourceAudioAssetId for audit
  │  if invalid: log and skip — renderer falls back to static caption
  ├─ insert prompt_version row recording voiceSettings + modelId
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
- Call `client.textToSpeech.convertWithTimestamps(voiceId, body)`. The SDK uses camelCase exclusively in TypeScript and serializes to snake_case on the wire (confirmed via Context7 dump of `BodyTextToSpeechFull`).
- `voiceSettings` is a constant in this file:
  ```ts
  export const ELEVENLABS_VOICE_SETTINGS = {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.4,
    useSpeakerBoost: true,
  } as const;
  ```
- `outputFormat` is `"mp3_44100_128"` (compatible with all ElevenLabs tiers).
- Decode `audioBase64` to `Uint8Array`.
- Return `alignment` as-is when present, else `null`.

⚠️ Implementation flag: the request body type (`BodyTextToSpeechFull`) is confirmed camelCase via Context7. The response type is referenced but not dumped — when implementing, read the SDK type for `convertWithTimestamps` return value to confirm the exact field names (`audioBase64` and `alignment` with `characters`, `characterStartTimesSeconds`, `characterEndTimesSeconds`). Update parser if SDK uses different casing.

### `packages/shared/src/captionTiming.ts`

The caption timing types and Zod schema live in `packages/shared` so both `packages/ai` (writes) and `apps/render` (reads) depend only on `shared`. `apps/render` must not import `packages/ai` (per AGENTS.md boundary rules — render is a separate app, not an AI consumer).

```ts
import { z } from "zod";

export const captionWordSchema = z
  .object({
    text: z.string().min(1),
    start: z.number().nonnegative(),
    end: z.number().positive(),
  })
  .strict()
  .refine(({ start, end }) => end > start, {
    message: "caption_word_end_must_exceed_start",
    path: ["end"],
  });

export type CaptionWord = z.infer<typeof captionWordSchema>;

export const captionTimingDocSchema = z
  .object({
    version: z.literal(1),
    sourceAudioAssetId: z.string().min(1),
    narration: z.string().min(1),
    audioDurationSeconds: z.number().positive(),
    words: z.array(captionWordSchema).min(1),
  })
  .strict();

export type CaptionTimingDoc = z.infer<typeof captionTimingDocSchema>;
```

Re-export from `packages/shared/src/index.ts` so consumers can `import { captionTimingDocSchema, type CaptionTimingDoc } from "@short-workflow/shared"`.

### `packages/ai/src/captionTiming.ts`

Pure utility, no side effects. Imports `CaptionTimingDoc` from `@short-workflow/shared` and exposes builder + validators:

```ts
import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";

export type ElevenLabsAlignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

// Validates the *raw* alignment from ElevenLabs before any audio is written.
// Catches malformed responses (empty arrays, length mismatch, NaN, end <= start)
// that would otherwise sneak past the audio overflow gate (e.g. max([]) === -Infinity).
export function validateAlignment(
  alignment: ElevenLabsAlignment,
): { ok: true } | { ok: false; reason: string };

export function alignmentToWords(alignment: ElevenLabsAlignment): CaptionWord[];

export function buildCaptionTimingDoc(input: {
  alignment: ElevenLabsAlignment;
  sourceAudioAssetId: string;
}): CaptionTimingDoc;

// Timing-shape validation that runs *after* a doc is built. Cannot fail the
// audio — only decides whether to save caption_timing.
export function validateCaptionTimingDoc(
  doc: CaptionTimingDoc,
  options: { sceneDurationSeconds: number },
): { ok: true } | { ok: false; reason: string };
```

`validateAlignment` checks:

- `characters.length >= 1`
- `characterStartTimesSeconds.length === characters.length`
- `characterEndTimesSeconds.length === characters.length`
- every entry in both timing arrays is a finite number (`Number.isFinite`)
- every position `i`: `characterEndTimesSeconds[i] > characterStartTimesSeconds[i]`
- `characterStartTimesSeconds[0] >= 0`

If any check fails, return `{ ok: false, reason }`. The handler treats this as a malformed response and **fails the audio asset**, identical to alignment being `null`.

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

`validateCaptionTimingDoc` checks (timing-shape only — audio duration is gated upstream, see §Audio overflow):

- `words.length >= 1`
- every word: `start >= 0`, `end > start`
- monotonic: `words[i].end <= words[i+1].start + 0.05`
- `audioDurationSeconds > 0`

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

`assets.kind` and `assets.provider` are stored as Postgres enum types (`asset_kind`, `asset_provider` — see `packages/db/src/schema.ts:25` and `packages/db/migrations/0001_init/migration.sql:6`). The migration must use `ALTER TYPE ... ADD VALUE`, not check-constraint surgery.

`migration.sql`:

```sql
ALTER TYPE asset_kind ADD VALUE IF NOT EXISTS 'caption_timing';
ALTER TYPE asset_provider ADD VALUE IF NOT EXISTS 'elevenlabs';
```

`down.sql`:

Postgres has no `DROP VALUE` for enums. The only safe rollback is to recreate the enum without the new value, which requires every column referencing it to be cast through text. The migration is therefore irreversible in practice. Per AGENTS.md "intentionally irreversible migrations must include an explicit failing statement and a comment explaining why":

```sql
-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating asset_kind and asset_provider, casting every assets row,
-- and dropping the new types. We refuse to encode that here. If a true
-- rollback is needed, write a one-off migration that handles the cast
-- explicitly after confirming no rows use 'caption_timing' or 'elevenlabs'.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM assets WHERE kind = 'caption_timing' OR provider = 'elevenlabs') THEN
    RAISE EXCEPTION 'down_blocked_rows_use_new_enum_values';
  END IF;
  RAISE EXCEPTION 'down_blocked_enum_value_drop_not_supported';
END$$;
```

Both branches raise so the migration runner aborts and the migration row is not removed, matching the AGENTS.md rule "down.sql failures must abort and leave migrations applied".

### `packages/db/src/schema.ts`

Update Drizzle column definitions for `assets.kind` and `assets.provider` to mirror the constants. Run `bun run db:generate` and verify the generated SQL matches the hand-written `migration.sql` before applying.

### `apps/worker/src/assets.ts`

The current `sceneAudioPath` (`apps/worker/src/assets.ts:58`) hard-codes `.wav`. ElevenLabs returns MP3, so writing MP3 bytes to a `.wav` path produces an asset whose extension lies to the renderer and debug tooling. Change the helper to take the file extension explicitly:

```ts
export function sceneAudioPath(
  projectId: string,
  sceneId: string,
  assetId: string,
  extension: "wav" | "mp3",
): string {
  return path.join(
    "projects",
    projectId,
    "scenes",
    sceneId,
    "audio",
    `${assetId}.${extension}`,
  );
}
```

Existing call sites (`generateSceneAudio.ts`) pass `"mp3"` for the new ElevenLabs path. The previous Gemini handler is no longer wired in (left as dead code), so no other call sites need updating.

Add a path helper for caption timing. The file is named after the **audio asset**, not the caption asset itself, so a render-time pairing only requires looking up the audio's id and reading the corresponding file path:

```ts
export function sceneCaptionTimingPath(
  projectId: string,
  sceneId: string,
  audioAssetId: string,
): string {
  return path.join(
    "projects",
    projectId,
    "scenes",
    sceneId,
    "captions",
    `${audioAssetId}.json`,
  );
}
```

On-disk layout: `LOCAL_ASSET_ROOT/projects/{id}/scenes/{id}/captions/{audioAssetId}.json`. Pairing is encoded in the path. No `assets.metadata` column is needed. A narrow DB lookup helper (`getReadyAssetByPath`, see §`renderVideo.ts`) is added so the renderer can confirm the caption asset row is `ready` rather than trusting an on-disk file that may be stranded from a partial run.

### `apps/worker/src/handlers/generateSceneAudio.ts`

Replace the Gemini TTS call with ElevenLabs. Steps:

1. Load `scene` via `getScene`.
2. Load all project scenes via `listProjectScenes` to find neighbors by position.
3. Load latest script `prompt_version` and derive `styleContext` (existing).
4. Create pending `audio` asset (provider `"elevenlabs"`).
5. Call `generateSpeechWithTimestamps`.
6. **Alignment required**: if `alignment` is `null` / missing → mark audio asset failed with `elevenlabs_alignment_missing`, throw the same error. The endpoint is documented to always return alignment; an absent alignment is a malformed response, not a normal case. Retry via existing backoff.
7. **Validate raw alignment** via `validateAlignment(alignment)` (see §`captionTiming.ts`). Catches empty arrays, length mismatch, NaN, and `end <= start`. If invalid → mark audio asset failed with `elevenlabs_alignment_invalid:<reason>`, throw, retry. This step **must** run before step 8, otherwise `Math.max(...[])` returns `-Infinity` and bypasses the audio overflow gate.
8. Compute `audioDurationSeconds = max(alignment.characterEndTimesSeconds)`.
9. **Audio overflow gate** (see §Audio overflow): if `audioDurationSeconds > scene.durationSeconds + 0.5` → mark audio asset failed with `audio_exceeds_scene_duration:<actual>s>${scene.durationSeconds}s`, throw the same error, do not write the file. Job retries via existing backoff.
10. Write audio bytes to `sceneAudioPath(projectId, sceneId, audioAsset.id, "mp3")`.
11. Mark audio asset ready (`mimeType: "audio/mpeg"`, `provider: "elevenlabs"`, `model: ELEVENLABS_MODEL_ID`).
12. Build `CaptionTimingDoc` with `sourceAudioAssetId = audioAsset.id`. Run `validateCaptionTimingDoc` (timing-shape only):
    - If invalid: log structured warning `caption_timing_invalid: <reason>`. Do **not** create a caption_timing asset. Continue to step 13.
    - If valid: create pending `caption_timing` asset (path = `sceneCaptionTimingPath(projectId, sceneId, audioAsset.id)`). Wrap the file write + mark-ready in a `try`:
      - On success: caption asset is `ready`. Continue.
      - On any failure during file write or mark-ready: call `markAssetFailed(captionAsset.id, message)`. If that **also** fails, log both errors at `error` level (`caption_mark_failed_twice`) and continue — this is the rare double-failure case. The audio asset and job still succeed regardless. The renderer's `getReadyAssetByPath` lookup will not return a `pending`/`failed` row, so it falls back to static caption.
13. Insert `prompt_version` (purpose `"ssml"`, provider `"elevenlabs"`) recording `voiceSettings`, `modelId`, and `audioAssetId` for audit.
14. Mark job succeeded with `{ assetId, captionTimingAssetId, promptVersionId }` (`captionTimingAssetId` is `null` when caption was skipped or failed).

Error handling:

- ElevenLabs call throws → audio asset marked failed, caption asset never created, error bubbles up to existing retry logic.
- Alignment missing or `validateAlignment` fails → audio asset marked failed (malformed response), error bubbles up, retry.
- Audio overflow gate fails → audio asset marked failed, error bubbles up. Treated as a real failure because the audio cannot be shown in the scene as-designed.
- File write fails after audio call → audio asset marked failed.
- `caption_timing` asset failure (file write or mark-ready) → mark the caption asset failed when possible, log, continue. Audio asset and job still succeed. The renderer fallback path covers this case. **Never** leave a caption asset in `pending` state.

### Audio overflow

ElevenLabs sometimes produces audio longer than the requested scene budget — pacing is out of our control. The Remotion render uses `Sequence durationInFrames = scene.durationSeconds * fps` (`apps/render/src/ShortVideo.tsx:48-53`), so any audio longer than the scene gets cut mid-word. Saving such audio as `ready` and pretending the caption fallback rescues us is wrong: the sound is broken, the caption is irrelevant.

Policy: **treat overflow as a failed audio generation**. The job retries; ElevenLabs is non-deterministic and will often produce a tighter take on retry. After `max_attempts` the job fails and surfaces in the UI for a manual fix (shorten narration in the script edit step, or bump scene duration).

Tolerance: 0.5 seconds. ElevenLabs occasionally pads ~100-300ms of trailing silence; 0.5s leaves headroom without letting a real overflow through.

This is the only validation that gates the audio asset. All other timing validations (monotonic words, etc.) are caption-only and never fail the audio.

### `apps/worker/src/handlers/renderVideo.ts`

In `buildRenderInput`, look up the caption_timing file by the **audio asset's id**, not the most-recent caption_timing asset independently. Without pairing, a regenerated audio (where caption_timing was skipped or failed to write) would inherit the previous run's caption_timing and the karaoke would drift against the new audio.

Pairing rule:

```
audioAsset = getCurrentReadySceneAsset(db, { sceneId, kind: "audio" })
captionPath = sceneCaptionTimingPath(projectId, sceneId, audioAsset.id)
captionAsset = getReadyAssetByPath(db, { sceneId, kind: "caption_timing", path: captionPath })
```

The file path is the source of truth for the pairing. The caption_timing JSON also stores `sourceAudioAssetId` for audit, but the renderer does not consult it — the file name already encodes the link.

When `captionAsset` is found and on-disk file exists, attach `captionTimingPath: absoluteAssetPath(...)` to the scene input. Otherwise, omit the field. The render schema accepts it as optional.

A new `db` query helper is needed: `getReadyAssetByPath(db, { sceneId, kind, path })` — a narrow lookup that returns the ready asset matching the exact path. This is cheaper and clearer than scanning all caption_timing rows for the scene.

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

The current renderer wraps each scene in `<Sequence durationInFrames={...} from={sequenceFrom}>` (`apps/render/src/ShortVideo.tsx:53`). Inside a `<Sequence>`, Remotion's `useCurrentFrame()` returns a **local** frame starting at 0 — not the global timeline frame. The caption component must therefore use only local frames; never add `sceneStartFrame`.

Split caption rendering:

```tsx
function SceneCaption({ scene }: { scene: RenderInput["scenes"][number] }) {
  if (scene.captionTimingPath) {
    return <KaraokeCaption timingSrc={resolveMediaSrc(scene.captionTimingPath)} staticFallback={scene.caption} />;
  }
  return <StaticCaption text={scene.caption} />;
}
```

`StaticCaption` is the current caption block.

`KaraokeCaption` does data fetching via Remotion's `delayRender` / `continueRender` pattern, with explicit failure handling so the renderer is never left hanging:

```tsx
const [handle] = useState(() => delayRender("caption_timing_load"));
const [doc, setDoc] = useState<CaptionTimingDoc | null>(null);
const [failed, setFailed] = useState(false);

useEffect(() => {
  let cancelled = false;
  fetch(timingSrc)
    .then((r) => { if (!r.ok) throw new Error(`fetch_status_${r.status}`); return r.json(); })
    .then((json) => captionTimingDocSchema.parse(json))     // Zod parse
    .then((parsed) => { if (!cancelled) { setDoc(parsed); continueRender(handle); } })
    .catch(() => {
      if (cancelled) return;
      setFailed(true);
      continueRender(handle);                               // never call cancelRender — fall back to static
    });
  return () => { cancelled = true; };
}, [timingSrc, handle]);

if (failed || !doc) {
  // While loading we render the static fallback so a frame screenshot is never blank.
  // After failure we keep the static fallback for the rest of the scene.
  return <StaticCaption text={staticFallback} />;
}
```

Failure policy: never `cancelRender` for caption issues. A bad caption file is a soft fault — the audio still plays and the static caption is meaningful. `cancelRender` would abort the entire video render, which is far worse than losing karaoke on one scene.

Once `doc` is loaded:

- All math uses **local frame**: `const localFrame = useCurrentFrame()` and `t = localFrame / fps`. No `sceneStartFrame` parameter, no global frame.
- Find `activeIndex` such that `doc.words[i].start <= t < doc.words[i].end`. If none, use `-1`. `activeIndex` is the **global** index into `doc.words`.
- Build chunks via `chunkWords(doc.words, { target: 5, min: 4, max: 6 })`. The chunker preserves the original word index so chunk renders never use a chunk-local index by accident:

  ```ts
  type ChunkedWord = { word: CaptionWord; index: number };  // index is into doc.words
  type Chunk = ChunkedWord[];

  function chunkWords(words: CaptionWord[], opts: { target: number; min: number; max: number }): Chunk[];
  ```

  Greedy walk. Start a new chunk after a word ending in `.`, `?`, `!`, or after a comma if chunk size >= `min`. Force a break after `max` words even without punctuation.

- Choose the chunk that contains `activeIndex` (i.e. some `entry.index === activeIndex`); if `activeIndex === -1`, choose the first chunk for pre-roll (`t` before the first word) and the last chunk for post-roll (`t` after the last word).
- Render the chunk in one line, white text. The active word is animated via Remotion's deterministic frame interpolation, **not CSS transitions** — Remotion renders frame-by-frame and CSS transitions are not guaranteed to evaluate at frame boundaries (per `remotion-best-practices` skill). Approach:

  ```tsx
  // Iterate the chunk by destructuring; never use the array index of the chunk itself.
  // `entry.index` is the original index into doc.words and is what activeIndex refers to.
  {selectedChunk.map((entry) => {
    const { word, index } = entry;
    const isActive = index === activeIndex;

    // All frames are LOCAL to this Sequence — never add a scene offset.
    const wordStartFrame = Math.round(word.start * fps);
    const wordEndFrame   = Math.round(word.end   * fps);

    // Clamp ease durations so the four-stop range stays strictly increasing
    // even for very short words (interpolate throws otherwise).
    const desiredEase  = Math.round(0.08 * fps);
    const minSpan      = 2;                       // ensure end > start by at least 2 frames
    const effectiveEnd = Math.max(wordStartFrame + minSpan, wordEndFrame);
    const easeFrames   = Math.max(1, Math.min(desiredEase, Math.floor((effectiveEnd - wordStartFrame) / 2)));
    const easeIn       = wordStartFrame + easeFrames;
    const easeOut      = effectiveEnd   + easeFrames;
    // Range stops are now guaranteed strictly increasing:
    // wordStartFrame < easeIn <= effectiveEnd < easeOut

    const scaleProgress = interpolate(
      frame,
      [wordStartFrame, easeIn, effectiveEnd, easeOut],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
    );

    const scale = 1 + 0.08 * scaleProgress;
    // Color uses the discrete activeIndex — only the currently-spoken word is yellow.
    // Past words return to white instead of staying highlighted.
    const color = isActive ? "#FFD400" : "#FFFFFF";

    return (
      <span key={index} style={{ display: "inline-block", color, transform: `scale(${scale})` }}>
        {word.text}{" "}
      </span>
    );
  })}
  ```

  Each word in the chunk derives `scaleProgress` from `frame`, so the value is the same on every render of the same frame. No CSS transitions, no `requestAnimationFrame`-style timers.

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

- `captionTiming.test.ts` (new, in `packages/shared`): unit-test `captionTimingDocSchema` accepts a well-formed doc and rejects: missing `version`, `version !== 1`, empty `words`, `start < 0`, `end <= start` per word, `audioDurationSeconds <= 0`, missing `sourceAudioAssetId`.
- `captionTiming.test.ts` (new, in `packages/ai`): unit-test `validateAlignment`, `alignmentToWords`, `buildCaptionTimingDoc`, and `validateCaptionTimingDoc` against fixed fixtures. Cases:
  - well-formed alignment → words derived correctly
  - empty arrays → `validateAlignment` rejects
  - length mismatch (`characters.length !== characterStartTimesSeconds.length`) → `validateAlignment` rejects
  - NaN / -Infinity timestamp → `validateAlignment` rejects
  - `end <= start` for some character → `validateAlignment` rejects
  - whitespace at start of `characters` → first word still has correct start time
  - overflow audio duration → caller's overflow gate fires (the unit test asserts `validateCaptionTimingDoc` does **not** mask overflow as a caption issue)
- Manual: run `generate_scene_audio` for one scene of an existing tiny-mechanisms project. Verify on disk:
  - `audio/<audioAssetId>.mp3` exists, plays back.
  - `captions/<audioAssetId>.json` exists (same id as the audio file), schema matches §Components, `sourceAudioAssetId` matches the audio asset.
- Manual: render that scene through Remotion Studio. Confirm the active word visibly highlights and stays in sync.
- Manual regression: regenerate audio for a scene where caption_timing was previously saved. Confirm the renderer pairs to the **new** audio's caption_timing (or falls back to static if the new run skipped it) — does not pick up the stale caption_timing.
- Migration: `bun run db:check` → `bun run db:migrate:up`. Insert a test row using the new enum values to confirm `ALTER TYPE ... ADD VALUE` took effect.

## Edge Cases

| Case | Behavior |
| --- | --- |
| ElevenLabs 5xx or network error | Throw, existing `next_retry_at` backoff retries. |
| ElevenLabs 4xx (auth/quota) | Throw, retries, max attempts hit, job fails. |
| Audio longer than `scene.durationSeconds + 0.5` | Audio asset marked failed, error thrown, job retries. After max attempts the job surfaces in the UI for manual narration shortening. |
| Response missing `alignment` | Audio asset marked failed (`elevenlabs_alignment_missing`), error thrown, job retries. Treated as a malformed response, not a normal case. |
| Alignment present but malformed (empty arrays, length mismatch, NaN, end ≤ start) | Audio asset marked failed (`elevenlabs_alignment_invalid:<reason>`), error thrown, job retries. Validated **before** the audio overflow gate so `Math.max([])` cannot bypass it. |
| `validateCaptionTimingDoc` fails (timing-shape) | Save audio. Do not create the caption_timing asset (no pending row left behind). Log reason. Renderer falls back to static caption. |
| Caption file write fails after caption asset created | `markAssetFailed` on the caption asset, log, continue. Audio asset and job still succeed. Renderer falls back to static caption. |
| Scene narration changes after audio gen | `content_updated_at` bump invalidates the audio asset for staleness checks (existing behavior). Regenerating produces a new audio + new caption_timing pair. |
| Audio regenerated, caption_timing skipped this time | Renderer pairs caption_timing to audio via the file path `captions/{audioAssetId}.json`. The lookup against the new audio asset's id returns null, so stale caption_timing from a prior run is **not** picked up. Renderer falls back to static caption for the new audio. |
| Multiple regenerations | Append-only. Pairing is by file path keyed on the audio asset's id, so each audio has at most one matching caption_timing on disk. |
| Scene without caption_timing | Renderer uses `StaticCaption`. No render error. |
| Rendering an old project (Gemini WAV scenes) | Audio still plays via existing `audio` kind. No `caption_timing` exists. Renderer falls back. |

## Rollback

- Worker: revert `generateSceneAudio.ts` to the Gemini TTS implementation. New audio assets revert to WAV. Old ElevenLabs MP3 assets continue to play (Remotion Audio supports both).
- Renderer: no rollback needed. The optional `captionTimingPath` continues to work for any existing assets.
- Migration: irreversible (Postgres has no `DROP VALUE` for enums). The `down.sql` always raises. To truly roll back, write a one-off migration that recreates the enum types after confirming no rows use the new values — see `down.sql` comment.
- Old Gemini-generated scenes do not gain karaoke unless the user regenerates audio.

## Dependencies

- New runtime dep: `@elevenlabs/elevenlabs-js` (latest). Per AGENTS.md "Ask first before adding dependencies": user has approved this in conversation, but the implementation plan must record the exact pinned version.

## Open Questions / Implementation Flags

1. **SDK response shape** — the request body type (`BodyTextToSpeechFull`, camelCase) is confirmed via Context7. The response type for `convertWithTimestamps` is referenced but not dumped. When implementing, read the SDK type for the return value to confirm `audioBase64` and `alignment` field names. Adjust the parser if SDK uses different casing.
2. **`eleven_v3` model** — only available on certain account tiers. Default env value is `eleven_multilingual_v2`. The user can override.
3. **Punctuation grouping in `alignmentToWords`** — initial implementation attaches trailing punctuation to the preceding word. If observed behavior in the live response is different (e.g. spaces around punctuation), adjust the grouping rule and add a fixture.
4. **Audio overflow tolerance value** — 0.5s chosen as a starting point. May need to tune up (more permissive) or down (stricter) once we see real ElevenLabs output across the seed bank. Treat the constant as easy to change.
5. **Alignment-missing policy** — currently treated as a malformed response that fails the audio. If real ElevenLabs traffic shows this happens routinely (e.g. for very short text), revisit and either save audio without caption (and re-introduce the static-caption fallback for that case) or add a fallback duration source.

## Decision Log

- **TTS provider**: ElevenLabs `convertWithTimestamps` over Gemini + ASR. Reason: timing comes free with TTS, single round-trip, lower complexity.
- **Granularity**: word-level karaoke. Reason: user choice.
- **Active word style**: yellow + scale 1.08, animated via Remotion `interpolate` (not CSS transitions). Reason: user choice for the look; deterministic frame-based animation required by Remotion render model.
- **Layout**: 4-6 word chunk swap. Reason: user choice.
- **Voice strategy**: hard-coded env. Reason: user choice. Schema accepts `captionTimingPath` as optional, leaving room for per-project voice override later.
- **Job unit**: scene-by-scene, not single-shot. Reason: preserves scene-level retry, asset 1:1 model, edit-one-scene workflow. ElevenLabs `previousText`/`nextText` covers the prosody continuity argument for one-shot.
- **Caption asset format**: JSON file under `LOCAL_ASSET_ROOT/projects/{id}/scenes/{id}/captions/`. Reason: matches existing append-only file layout. No new table needed.
- **Audio overflow handling**: gate the audio asset itself (mark failed, throw, retry) rather than save audio + skip caption. Reason: an audio that runs past `scene.durationSeconds` gets cut mid-word in Remotion's `Sequence`. The render is broken, not just the caption.
- **Raw alignment validation before audio gate**: `validateAlignment` runs against the response before the overflow gate so empty / malformed arrays cannot bypass it (`Math.max([])` is `-Infinity`, which would silently pass an overflow check). Reason: defense in depth against a malformed-but-non-null alignment response.
- **Caption timing schema lives in `packages/shared`**: `captionTimingDocSchema` and its types are defined in `packages/shared/src/captionTiming.ts` and consumed by both `packages/ai` (writes) and `apps/render` (reads). Reason: `apps/render` must not import `packages/ai` (render is a separate app). Keeping the schema in `shared` is the only way both sides can validate the same JSON without crossing app boundaries.
- **Caption-audio pairing**: caption_timing files are named after the audio asset's id (`captions/{audioAssetId}.json`). The renderer pairs by file path, not by scanning recent assets. The JSON also stores `sourceAudioAssetId` for audit but the renderer does not consult it. A narrow DB lookup (`getReadyAssetByPath`) is added so the renderer trusts the DB row's `ready` status, not just the on-disk file. Reason: without pairing, regenerated audio inherits stale caption_timing and karaoke drifts. File-path encoding avoids adding an `assets.metadata` column.
- **Chunk preserves original word index**: `chunkWords` returns `{ word, index }[]` where `index` is the index into `doc.words`. The renderer compares `index === activeIndex` rather than the chunk's local array index. Reason: a chunk-local index would silently mis-highlight every word in the second chunk onward.
- **Caption word schema enforces `end > start`**: `captionWordSchema` includes a `.refine` clause so the Zod parse rejects malformed words at the renderer's fetch step too, not just at the worker's writer. Reason: the renderer must defend against a malformed file produced by an older or buggy worker.
- **Renderer uses local frame, not global**: `KaraokeCaption` is a child of `<Sequence>`, where `useCurrentFrame()` is local (starts at 0 per scene). The component derives word frames from local time only — no `sceneStartFrame` parameter. Reason: passing global frame math into a Sequence-scoped component would make every scene after the first render incorrectly (negative frames, never-active words).
- **Caption fetch failure handling**: `KaraokeCaption` calls `continueRender(handle)` on fetch/parse error and falls back to `<StaticCaption>`. Never `cancelRender` for caption issues. Reason: a bad caption file is a soft fault — the audio still plays and the static caption is meaningful. `cancelRender` would abort the entire video.
- **Clamped ease durations in `interpolate`**: `easeFrames = max(1, min(desiredEase, floor(wordSpan / 2)))` so the four-stop range stays strictly increasing for very short words. Reason: `interpolate` throws on a duplicated stop, and very short words (<160ms) are common.
- **Audio file extension**: `sceneAudioPath` takes the extension as a parameter. Reason: ElevenLabs returns MP3 while the old helper hard-coded `.wav`; mislabeled extensions break the renderer and debug tooling.
- **Migration shape**: `ALTER TYPE ... ADD VALUE` for the existing Postgres enums (`asset_kind`, `asset_provider`). Reason: that's how the schema actually stores these — confirmed via `packages/db/src/schema.ts` and `packages/db/migrations/0001_init/migration.sql`.
- **Static caption fallback in renderer**: kept. Reason: lets old projects render without re-generating audio; required by append-only constraint.
