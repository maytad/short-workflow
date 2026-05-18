# Realtime Karaoke Subtitle + ElevenLabs TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static per-scene captions with realtime word-level karaoke subtitles, switching the TTS provider from Google Gemini to ElevenLabs `convertWithTimestamps` so word timing comes free with the audio response.

**Architecture:** Scene-by-scene job model is preserved. The `generate_scene_audio` handler now produces two ready assets per scene: a `kind="audio"` MP3 file from ElevenLabs and a paired `kind="caption_timing"` JSON file containing per-word timing. The renderer pairs caption to audio by file path (`captions/{audioAssetId}.json`) so regenerated audio cannot inherit stale captions. Remotion `<KaraokeCaption>` reads the timing JSON via `delayRender`/`continueRender`, derives the active word from `useCurrentFrame()` (local to `<Sequence>`), and animates color + scale via deterministic frame interpolation — no CSS transitions. Static caption fallback stays for legacy scenes and any caption-side failure.

**Tech Stack:** Bun workspaces + Turborepo, TypeScript, Zod, Drizzle ORM, Postgres enums, Remotion (`interpolate`, `Easing`, `delayRender`, `continueRender`), `@elevenlabs/elevenlabs-js` SDK, `bun test`.

**Spec:** `docs/superpowers/specs/2026-05-18-realtime-subtitle-design.md`

---

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `packages/shared/src/constants.ts` | Modify | Extend `ASSET_KINDS` and `ASSET_PROVIDERS` |
| `packages/shared/src/captionTiming.ts` | Create | `captionWordSchema`, `captionTimingDocSchema`, types |
| `packages/shared/src/index.ts` | Modify | Re-export caption timing schema |
| `packages/shared/src/render.ts` | Modify | Add optional `captionTimingPath` to scene input |
| `packages/db/src/schema.ts` | Modify | Mirror new enum values in Drizzle |
| `packages/db/migrations/0003_add_caption_timing/migration.sql` | Create | `ALTER TYPE ... ADD VALUE` |
| `packages/db/migrations/0003_add_caption_timing/down.sql` | Create | Irreversible — `RAISE EXCEPTION` |
| `packages/db/src/queries/assets.ts` | Modify | Add `getReadyAssetByPath` |
| `packages/ai/package.json` | Modify | Add `@elevenlabs/elevenlabs-js` dep |
| `packages/ai/src/elevenLabsTts.ts` | Create | SDK wrapper, single function |
| `packages/ai/src/captionTiming.ts` | Create | `validateAlignment`, `alignmentToWords`, `buildCaptionTimingDoc`, `validateCaptionTimingDoc` |
| `packages/ai/src/captionTiming.test.ts` | Create | Unit tests for validators + builder |
| `packages/shared/src/captionTiming.test.ts` | Create | Unit tests for Zod schema |
| `packages/ai/src/index.ts` | Modify | Re-export new modules |
| `apps/worker/src/assets.ts` | Modify | `sceneAudioPath` extension param, `sceneCaptionTimingPath` |
| `apps/worker/src/assets.test.ts` | Modify | Update for new signatures |
| `apps/worker/src/handlers/generateSceneAudio.ts` | Modify | Replace Gemini with ElevenLabs, save caption asset |
| `apps/worker/src/handlers/renderVideo.ts` | Modify | Pair caption timing to audio asset |
| `apps/worker/.env.example` | Modify | Add ElevenLabs env vars |
| `apps/render/src/render.ts` | Modify | Stage caption timing into `publicDir` |
| `apps/render/src/ShortVideo.tsx` | Modify | Split into `SceneCaption` + `KaraokeCaption` + `StaticCaption` |

---

## Task 1: Extend asset constants

**Files:**
- Modify: `packages/shared/src/constants.ts:7,13-19`

- [ ] **Step 1: Add `caption_timing` to `ASSET_KINDS`**

Edit `packages/shared/src/constants.ts` to update the `ASSET_KINDS` array:

```ts
export const ASSET_KINDS = [
  "image",
  "audio",
  "render",
  "thumbnail",
  "render_input",
  "caption_timing",
] as const;
```

- [ ] **Step 2: Add `elevenlabs` to `ASSET_PROVIDERS`**

In the same file, update `ASSET_PROVIDERS`:

```ts
export const ASSET_PROVIDERS = [
  "openai",
  "google_gemini",
  "google_tts",
  "remotion",
  "local",
  "elevenlabs",
] as const;
```

- [ ] **Step 3: Run typecheck**

Run: `bun run --filter @short-workflow/shared typecheck`
Expected: PASS (constants are arrays, no type errors yet — downstream packages will follow).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/constants.ts
git commit -m "feat(shared): add caption_timing kind and elevenlabs provider"
```

---

## Task 2: Caption timing schema in shared package

**Files:**
- Create: `packages/shared/src/captionTiming.ts`
- Create: `packages/shared/src/captionTiming.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the failing schema test**

Create `packages/shared/src/captionTiming.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { captionTimingDocSchema, captionWordSchema } from "./captionTiming";

describe("captionWordSchema", () => {
  test("accepts a well-formed word", () => {
    expect(() =>
      captionWordSchema.parse({ text: "hello", start: 0.1, end: 0.5 }),
    ).not.toThrow();
  });

  test("rejects empty text", () => {
    expect(() => captionWordSchema.parse({ text: "", start: 0, end: 0.1 })).toThrow();
  });

  test("rejects negative start", () => {
    expect(() => captionWordSchema.parse({ text: "x", start: -0.01, end: 0.1 })).toThrow();
  });

  test("rejects end <= start", () => {
    expect(() => captionWordSchema.parse({ text: "x", start: 0.5, end: 0.5 })).toThrow();
    expect(() => captionWordSchema.parse({ text: "x", start: 0.5, end: 0.4 })).toThrow();
  });
});

describe("captionTimingDocSchema", () => {
  const baseDoc = {
    version: 1,
    sourceAudioAssetId: "audio-asset-1",
    narration: "Hello world.",
    audioDurationSeconds: 1.2,
    words: [
      { text: "Hello", start: 0, end: 0.5 },
      { text: "world.", start: 0.5, end: 1.2 },
    ],
  };

  test("accepts a well-formed doc", () => {
    expect(() => captionTimingDocSchema.parse(baseDoc)).not.toThrow();
  });

  test("rejects version !== 1", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, version: 2 })).toThrow();
  });

  test("rejects empty words array", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, words: [] })).toThrow();
  });

  test("rejects audioDurationSeconds <= 0", () => {
    expect(() =>
      captionTimingDocSchema.parse({ ...baseDoc, audioDurationSeconds: 0 }),
    ).toThrow();
  });

  test("rejects missing sourceAudioAssetId", () => {
    const { sourceAudioAssetId: _omit, ...rest } = baseDoc;
    expect(() => captionTimingDocSchema.parse(rest)).toThrow();
  });

  test("rejects empty narration", () => {
    expect(() => captionTimingDocSchema.parse({ ...baseDoc, narration: "" })).toThrow();
  });

  test("rejects unknown keys (strict)", () => {
    expect(() =>
      captionTimingDocSchema.parse({ ...baseDoc, extra: 1 }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/shared/src/captionTiming.test.ts`
Expected: FAIL with "Cannot find module './captionTiming'".

- [ ] **Step 3: Create the schema file**

Create `packages/shared/src/captionTiming.ts`:

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

- [ ] **Step 4: Re-export from shared index**

Edit `packages/shared/src/index.ts`. Add a new namespace export and a wildcard re-export, keeping the existing alphabetical order:

```ts
export * as api from "./api";
export * as captionTiming from "./captionTiming";
export * as constants from "./constants";
export * as render from "./render";
export * as schemas from "./schemas";

export * from "./api";
export * from "./captionTiming";
export * from "./constants";
export * from "./render";
export * from "./schemas";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test packages/shared/src/captionTiming.test.ts`
Expected: PASS for all 11 cases.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/captionTiming.ts packages/shared/src/captionTiming.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add caption timing schema with end>start refine"
```

---

## Task 3: Add `captionTimingPath` to render scene schema

**Files:**
- Modify: `packages/shared/src/render.ts:6-17`

- [ ] **Step 1: Edit `renderSceneInputSchema`**

Edit `packages/shared/src/render.ts`. The existing schema does not have a caption timing field; add `captionTimingPath` as optional:

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
    captionTimingPath: z.string().min(1).optional(),
  })
  .strict();
```

- [ ] **Step 2: Run typecheck**

Run: `bun run --filter @short-workflow/shared typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/render.ts
git commit -m "feat(shared): add optional captionTimingPath to render scene schema"
```

---

## Task 4: Update Drizzle schema enums

**Files:**
- Modify: `packages/db/src/schema.ts:25-46`

- [ ] **Step 1: Add `caption_timing` to `assetKindEnum`**

Edit `packages/db/src/schema.ts`:

```ts
export const assetKindEnum = pgEnum("asset_kind", [
  "image",
  "audio",
  "render",
  "thumbnail",
  "render_input",
  "caption_timing",
]);
```

- [ ] **Step 2: Add `elevenlabs` to `assetProviderEnum`**

In the same file:

```ts
export const assetProviderEnum = pgEnum("asset_provider", [
  "openai",
  "google_gemini",
  "google_tts",
  "remotion",
  "local",
  "elevenlabs",
]);
```

- [ ] **Step 3: Run typecheck**

Run: `bun run --filter @short-workflow/db typecheck`
Expected: PASS — `AssetRow["kind"]` and `AssetRow["provider"]` now include the new values.

- [ ] **Step 4: Verify no schema diff vs hand-written migration**

Run: `bun run db:generate -- --name add_caption_timing_check`
Inspect the generated SQL under `packages/db/migrations/`. If a new directory is generated, confirm its content is exactly the two `ALTER TYPE ... ADD VALUE` statements we will hand-write in Task 5. Then **delete** the auto-generated directory — we keep the hand-written one only because we also need `down.sql` semantics.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): mirror caption_timing kind and elevenlabs provider in drizzle"
```

---

## Task 5: Migration `0003_add_caption_timing`

**Files:**
- Create: `packages/db/migrations/0003_add_caption_timing/migration.sql`
- Create: `packages/db/migrations/0003_add_caption_timing/down.sql`

- [ ] **Step 1: Create the migration directory**

Run: `mkdir -p packages/db/migrations/0003_add_caption_timing`

- [ ] **Step 2: Write `migration.sql`**

Create `packages/db/migrations/0003_add_caption_timing/migration.sql`:

```sql
alter type asset_kind add value if not exists 'caption_timing';
alter type asset_provider add value if not exists 'elevenlabs';
```

- [ ] **Step 3: Write `down.sql`**

Create `packages/db/migrations/0003_add_caption_timing/down.sql`:

```sql
-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating asset_kind and asset_provider, casting every assets row,
-- and dropping the new types. We refuse to encode that here. If a true
-- rollback is needed, write a one-off migration that handles the cast
-- explicitly after confirming no rows use 'caption_timing' or 'elevenlabs'.
do $$
begin
  if exists (
    select 1 from assets
    where kind = 'caption_timing' or provider = 'elevenlabs'
  ) then
    raise exception 'down_blocked_rows_use_new_enum_values';
  end if;
  raise exception 'down_blocked_enum_value_drop_not_supported';
end$$;
```

- [ ] **Step 4: Run migration check**

Run: `bun run db:check`
Expected: PASS — no drift between schema and migrations.

- [ ] **Step 5: Apply migration**

Run: `bun run db:migrate:up`
Expected: migration `0003_add_caption_timing` reported as applied.

- [ ] **Step 6: Smoke-verify enum values exist in Postgres**

Run: `bun run db:studio` (or any Postgres client) and confirm `select unnest(enum_range(null::asset_kind))` includes `caption_timing` and `select unnest(enum_range(null::asset_provider))` includes `elevenlabs`. If you cannot use a client, skip this and rely on Task 13's runtime insert as the verification.

- [ ] **Step 7: Commit**

```bash
git add packages/db/migrations/0003_add_caption_timing
git commit -m "feat(db): add caption_timing kind and elevenlabs provider via ALTER TYPE"
```

---

## Task 6: `getReadyAssetByPath` query

**Files:**
- Modify: `packages/db/src/queries/assets.ts:1-105`

- [ ] **Step 1: Add the query function**

Edit `packages/db/src/queries/assets.ts`. Append after `getCurrentReadySceneAsset`:

```ts
export async function getReadyAssetByPath(
  db: DbClient,
  input: { sceneId: string; kind: AssetRow["kind"]; path: string },
) {
  const [row] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.sceneId, input.sceneId),
        eq(assets.kind, input.kind),
        eq(assets.path, input.path),
        eq(assets.status, "ready"),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return row ?? null;
}
```

- [ ] **Step 2: Run typecheck**

Run: `bun run --filter @short-workflow/db typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/queries/assets.ts
git commit -m "feat(db): add getReadyAssetByPath for caption-audio pairing"
```

---

## Task 7: Add ElevenLabs SDK dependency

**Files:**
- Modify: `packages/ai/package.json`

- [ ] **Step 1: Install the SDK pinned**

Run: `cd packages/ai && bun add @elevenlabs/elevenlabs-js@latest`
After install, open `packages/ai/package.json` and confirm `dependencies."@elevenlabs/elevenlabs-js"` is pinned to an exact version (e.g. `"2.x.y"`) rather than a caret range. If a caret was added, change it to the resolved version from `bun.lockb`.

- [ ] **Step 2: Confirm the resolution**

Run: `bun pm ls --filter @short-workflow/ai | grep elevenlabs`
Expected: a single resolved version is printed.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/package.json bun.lockb
git commit -m "chore(ai): add @elevenlabs/elevenlabs-js dependency"
```

---

## Task 8: ElevenLabs SDK wrapper module

**Files:**
- Create: `packages/ai/src/elevenLabsTts.ts`

- [ ] **Step 1: Create the wrapper module**

Create `packages/ai/src/elevenLabsTts.ts`:

```ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type ElevenLabsAlignment = {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
};

export type ElevenLabsTtsInput = {
  narration: string;
  previousText?: string;
  nextText?: string;
  voiceId: string;
  modelId: string;
};

export type ElevenLabsTtsOutput = {
  bytes: Uint8Array;
  mimeType: "audio/mpeg";
  model: string;
  alignment: ElevenLabsAlignment | null;
  responseMetadata: Record<string, unknown>;
};

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.4,
  useSpeakerBoost: true,
} as const;

export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128" as const;

export async function generateSpeechWithTimestamps(
  input: ElevenLabsTtsInput,
): Promise<ElevenLabsTtsOutput> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY_missing");
  }

  const client = new ElevenLabsClient({ apiKey });

  const response = await client.textToSpeech.convertWithTimestamps(input.voiceId, {
    text: input.narration,
    modelId: input.modelId,
    voiceSettings: ELEVENLABS_VOICE_SETTINGS,
    outputFormat: ELEVENLABS_OUTPUT_FORMAT,
    previousText: input.previousText,
    nextText: input.nextText,
  });

  const audioBase64 = (response as { audioBase64?: string }).audioBase64;
  if (!audioBase64) {
    throw new Error("elevenlabs_audio_base64_missing");
  }

  const bytes = new Uint8Array(Buffer.from(audioBase64, "base64"));

  const rawAlignment = (response as { alignment?: unknown }).alignment;
  const alignment = parseAlignment(rawAlignment);

  return {
    bytes,
    mimeType: "audio/mpeg",
    model: input.modelId,
    alignment,
    responseMetadata: {
      modelId: input.modelId,
      voiceId: input.voiceId,
      outputFormat: ELEVENLABS_OUTPUT_FORMAT,
    },
  };
}

function parseAlignment(value: unknown): ElevenLabsAlignment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const a = value as Record<string, unknown>;
  if (
    !Array.isArray(a.characters) ||
    !Array.isArray(a.characterStartTimesSeconds) ||
    !Array.isArray(a.characterEndTimesSeconds)
  ) {
    return null;
  }

  return {
    characters: a.characters as string[],
    characterStartTimesSeconds: a.characterStartTimesSeconds as number[],
    characterEndTimesSeconds: a.characterEndTimesSeconds as number[],
  };
}
```

> Implementation note: the request body type (`BodyTextToSpeechFull`) is camelCase per the SDK. The response field names (`audioBase64`, `alignment`, `characterStartTimesSeconds`) are also camelCase per the same convention but were not dumped from Context7. If at runtime the SDK returns `audio_base64` / `character_start_times_seconds`, switch the parser to read the snake_case keys.

- [ ] **Step 2: Run typecheck**

Run: `bun run --filter @short-workflow/ai typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ai/src/elevenLabsTts.ts
git commit -m "feat(ai): add ElevenLabs convertWithTimestamps wrapper"
```

---

## Task 9: Caption timing builder + validators

**Files:**
- Create: `packages/ai/src/captionTiming.ts`
- Create: `packages/ai/src/captionTiming.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/ai/src/captionTiming.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  alignmentToWords,
  buildCaptionTimingDoc,
  validateAlignment,
  validateCaptionTimingDoc,
} from "./captionTiming";
import type { ElevenLabsAlignment } from "./elevenLabsTts";

const wellFormed: ElevenLabsAlignment = {
  characters: ["H", "i", " ", "y", "o", "u", "."],
  characterStartTimesSeconds: [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
  characterEndTimesSeconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
};

describe("validateAlignment", () => {
  test("accepts well-formed alignment", () => {
    expect(validateAlignment(wellFormed)).toEqual({ ok: true });
  });

  test("rejects empty arrays", () => {
    const result = validateAlignment({
      characters: [],
      characterStartTimesSeconds: [],
      characterEndTimesSeconds: [],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects length mismatch", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterStartTimesSeconds: wellFormed.characterStartTimesSeconds.slice(0, -1),
    });
    expect(result.ok).toBe(false);
  });

  test("rejects NaN", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterStartTimesSeconds: [Number.NaN, ...wellFormed.characterStartTimesSeconds.slice(1)],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects -Infinity", () => {
    const result = validateAlignment({
      ...wellFormed,
      characterEndTimesSeconds: [
        Number.NEGATIVE_INFINITY,
        ...wellFormed.characterEndTimesSeconds.slice(1),
      ],
    });
    expect(result.ok).toBe(false);
  });

  test("rejects end <= start at any index", () => {
    const ends = [...wellFormed.characterEndTimesSeconds];
    ends[2] = wellFormed.characterStartTimesSeconds[2]; // equal -> reject
    const result = validateAlignment({ ...wellFormed, characterEndTimesSeconds: ends });
    expect(result.ok).toBe(false);
  });

  test("rejects negative first start", () => {
    const starts = [...wellFormed.characterStartTimesSeconds];
    starts[0] = -0.01;
    const result = validateAlignment({ ...wellFormed, characterStartTimesSeconds: starts });
    expect(result.ok).toBe(false);
  });
});

describe("alignmentToWords", () => {
  test("derives words by whitespace and attaches trailing punctuation", () => {
    const words = alignmentToWords(wellFormed);
    expect(words).toEqual([
      { text: "Hi", start: 0.0, end: 0.2 },
      { text: "you.", start: 0.3, end: 0.7 },
    ]);
  });

  test("handles leading whitespace", () => {
    const alignment: ElevenLabsAlignment = {
      characters: [" ", "h", "i"],
      characterStartTimesSeconds: [0.0, 0.05, 0.1],
      characterEndTimesSeconds: [0.05, 0.1, 0.2],
    };
    const words = alignmentToWords(alignment);
    expect(words).toEqual([{ text: "hi", start: 0.05, end: 0.2 }]);
  });

  test("handles trailing whitespace", () => {
    const alignment: ElevenLabsAlignment = {
      characters: ["a", " "],
      characterStartTimesSeconds: [0.0, 0.1],
      characterEndTimesSeconds: [0.1, 0.2],
    };
    const words = alignmentToWords(alignment);
    expect(words).toEqual([{ text: "a", start: 0.0, end: 0.1 }]);
  });
});

describe("buildCaptionTimingDoc", () => {
  test("builds doc from alignment with sourceAudioAssetId", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    expect(doc.version).toBe(1);
    expect(doc.sourceAudioAssetId).toBe("audio-1");
    expect(doc.narration).toBe("Hi you.");
    expect(doc.audioDurationSeconds).toBeCloseTo(0.7, 6);
    expect(doc.words.length).toBe(2);
  });
});

describe("validateCaptionTimingDoc", () => {
  test("accepts well-formed doc", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    expect(validateCaptionTimingDoc(doc, { sceneDurationSeconds: 5 })).toEqual({ ok: true });
  });

  test("does NOT mask audio overflow as caption issue", () => {
    // Even if audioDurationSeconds exceeds scene, the caption-shape validator must still pass.
    // The audio overflow gate lives upstream in the handler, not here.
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    const result = validateCaptionTimingDoc(doc, { sceneDurationSeconds: 0.1 });
    expect(result.ok).toBe(true);
  });

  test("rejects non-monotonic words", () => {
    const doc = buildCaptionTimingDoc({
      alignment: wellFormed,
      sourceAudioAssetId: "audio-1",
    });
    // Force overlap > 0.05s
    doc.words[1].start = doc.words[0].end - 0.5;
    doc.words[1].end = doc.words[1].start + 0.1;
    const result = validateCaptionTimingDoc(doc, { sceneDurationSeconds: 5 });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test packages/ai/src/captionTiming.test.ts`
Expected: FAIL with "Cannot find module './captionTiming'".

- [ ] **Step 3: Create the implementation**

Create `packages/ai/src/captionTiming.ts`:

```ts
import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";

import type { ElevenLabsAlignment } from "./elevenLabsTts";

type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validateAlignment(alignment: ElevenLabsAlignment): ValidationResult {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = alignment;

  if (characters.length === 0) {
    return { ok: false, reason: "empty_characters" };
  }
  if (
    characterStartTimesSeconds.length !== characters.length ||
    characterEndTimesSeconds.length !== characters.length
  ) {
    return { ok: false, reason: "length_mismatch" };
  }
  if (characterStartTimesSeconds[0] < 0) {
    return { ok: false, reason: "negative_first_start" };
  }
  for (let i = 0; i < characters.length; i += 1) {
    const s = characterStartTimesSeconds[i];
    const e = characterEndTimesSeconds[i];
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      return { ok: false, reason: `non_finite_at_${i}` };
    }
    if (e <= s) {
      return { ok: false, reason: `end_le_start_at_${i}` };
    }
  }
  return { ok: true };
}

export function alignmentToWords(alignment: ElevenLabsAlignment): CaptionWord[] {
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } = alignment;
  const words: CaptionWord[] = [];
  let chunk: number[] = [];

  const flush = () => {
    if (chunk.length === 0) return;
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    words.push({
      text: chunk.map((i) => characters[i]).join(""),
      start: characterStartTimesSeconds[first],
      end: characterEndTimesSeconds[last],
    });
    chunk = [];
  };

  for (let i = 0; i < characters.length; i += 1) {
    const c = characters[i];
    if (/\s/.test(c)) {
      flush();
    } else {
      chunk.push(i);
    }
  }
  flush();

  return words;
}

export function buildCaptionTimingDoc(input: {
  alignment: ElevenLabsAlignment;
  sourceAudioAssetId: string;
}): CaptionTimingDoc {
  const { alignment, sourceAudioAssetId } = input;
  const words = alignmentToWords(alignment);
  const narration = alignment.characters.join("");
  const audioDurationSeconds = Math.max(...alignment.characterEndTimesSeconds);

  return {
    version: 1,
    sourceAudioAssetId,
    narration,
    audioDurationSeconds,
    words,
  };
}

export function validateCaptionTimingDoc(
  doc: CaptionTimingDoc,
  _options: { sceneDurationSeconds: number },
): ValidationResult {
  if (doc.words.length === 0) {
    return { ok: false, reason: "empty_words" };
  }
  if (doc.audioDurationSeconds <= 0) {
    return { ok: false, reason: "non_positive_audio_duration" };
  }
  for (let i = 0; i < doc.words.length; i += 1) {
    const w = doc.words[i];
    if (w.start < 0) return { ok: false, reason: `word_${i}_negative_start` };
    if (w.end <= w.start) return { ok: false, reason: `word_${i}_end_le_start` };
    if (i > 0) {
      const prev = doc.words[i - 1];
      if (w.start + 0.05 < prev.end) {
        return { ok: false, reason: `word_${i}_not_monotonic` };
      }
    }
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test packages/ai/src/captionTiming.test.ts`
Expected: PASS for all 13 cases.

- [ ] **Step 5: Re-export from `packages/ai/src/index.ts`**

Edit `packages/ai/src/index.ts`. Add the new modules to the existing exports (preserve order):

```ts
export * from "./image";
export * from "./googleImage";
export * from "./googleTts";
export * from "./openai";
export * from "./openaiImage";
export * from "./prompts";
export * from "./types";
export * from "./elevenLabsTts";
export * from "./captionTiming";
```

- [ ] **Step 6: Run typecheck**

Run: `bun run --filter @short-workflow/ai typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ai/src/captionTiming.ts packages/ai/src/captionTiming.test.ts packages/ai/src/index.ts
git commit -m "feat(ai): add caption timing builder, validators, and tests"
```

---

## Task 10: Update worker asset path helpers

**Files:**
- Modify: `apps/worker/src/assets.ts:54-69`
- Modify: `apps/worker/src/assets.test.ts`

- [ ] **Step 1: Update the failing test first**

Edit `apps/worker/src/assets.test.ts`. Replace the existing scene-audio test (line 53-57) with two cases, and add a caption-timing case. Also update the import to include `sceneCaptionTimingPath`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import {
  absoluteAssetPath,
  renderInputPath,
  sceneAudioPath,
  sceneCaptionTimingPath,
  writeAssetFile,
} from "./assets";

describe("asset utilities", () => {
  test("joins the asset root and relative path", () => {
    expect(absoluteAssetPath("/asset-root", "projects/project-1/file.txt")).toBe(
      path.join("/asset-root", "projects/project-1/file.txt"),
    );
  });

  test("rejects paths that escape the asset root", () => {
    expect(() => absoluteAssetPath("/asset-root", "../escape.png")).toThrow(
      "asset_path_escapes_root",
    );
    expect(() => absoluteAssetPath("/asset-root", "/tmp/outside-root.png")).toThrow(
      "asset_path_escapes_root",
    );
  });

  test("writes bytes and returns file metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "short-workflow-assets-"));

    try {
      const bytes = new TextEncoder().encode("worker asset payload");
      const result = await writeAssetFile(
        root,
        "projects/project-1/scenes/scene-1/images/asset-1.png",
        bytes,
      );

      expect(result).toEqual({
        absolutePath: path.join(root, "projects/project-1/scenes/scene-1/images/asset-1.png"),
        sizeBytes: bytes.byteLength,
        checksum: "sha256:4678f89204f4480245b8b9c6c0f9728da3fcd5c7485d85fb16c9819093fb5c63",
      });
      expect(await readFile(result.absolutePath)).toEqual(Buffer.from(bytes));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("builds render input paths under the project input directory", () => {
    expect(renderInputPath("project-1", "render-1")).toBe(
      path.join("projects", "project-1", "input", "render-1.json"),
    );
  });

  test("builds scene audio paths with mp3 extension", () => {
    expect(sceneAudioPath("project-1", "scene-1", "asset-1", "mp3")).toBe(
      path.join("projects", "project-1", "scenes", "scene-1", "audio", "asset-1.mp3"),
    );
  });

  test("builds scene audio paths with wav extension", () => {
    expect(sceneAudioPath("project-1", "scene-1", "asset-1", "wav")).toBe(
      path.join("projects", "project-1", "scenes", "scene-1", "audio", "asset-1.wav"),
    );
  });

  test("builds scene caption timing paths under captions directory", () => {
    expect(sceneCaptionTimingPath("project-1", "scene-1", "audio-asset-1")).toBe(
      path.join("projects", "project-1", "scenes", "scene-1", "captions", "audio-asset-1.json"),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test apps/worker/src/assets.test.ts`
Expected: FAIL — `sceneAudioPath` signature doesn't accept extension, `sceneCaptionTimingPath` is not exported.

- [ ] **Step 3: Update `sceneAudioPath` and add `sceneCaptionTimingPath`**

Edit `apps/worker/src/assets.ts`. Replace the existing `sceneAudioPath` (line 58-60) and append the caption helper:

```ts
export function sceneAudioPath(
  projectId: string,
  sceneId: string,
  assetId: string,
  extension: "wav" | "mp3",
) {
  return path.join("projects", projectId, "scenes", sceneId, "audio", `${assetId}.${extension}`);
}

export function sceneCaptionTimingPath(projectId: string, sceneId: string, audioAssetId: string) {
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test apps/worker/src/assets.test.ts`
Expected: PASS for all 7 cases.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/assets.ts apps/worker/src/assets.test.ts
git commit -m "feat(worker): sceneAudioPath takes extension and add sceneCaptionTimingPath"
```

---

## Task 11: Replace TTS provider in `generateSceneAudio` handler

**Files:**
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`

- [ ] **Step 1: Rewrite the handler**

Replace the contents of `apps/worker/src/handlers/generateSceneAudio.ts` with:

```ts
import {
  buildCaptionTimingDoc,
  generateSpeechWithTimestamps,
  styleContextFromScriptResponseText,
  validateAlignment,
  validateCaptionTimingDoc,
  ELEVENLABS_VOICE_SETTINGS,
} from "@short-workflow/ai";
import {
  createPendingAsset,
  getLatestPromptVersion,
  getScene,
  insertPromptVersion,
  listProjectScenes,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { sceneAudioPath, sceneCaptionTimingPath, writeAssetFile } from "../assets";
import { resolveHandlerEnv, type HandlerEnv } from "./types";

const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const AUDIO_OVERFLOW_TOLERANCE_SECONDS = 0.5;

export async function handleGenerateSceneAudio(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const handlerEnv = resolveHandlerEnv(env);
  const scene = await getScene(db, job.sceneId);
  if (!scene) {
    throw new Error("scene_not_found");
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error("ELEVENLABS_VOICE_ID_missing");
  }
  const modelId = process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_ELEVENLABS_MODEL_ID;

  const projectScenes = await listProjectScenes(db, scene.projectId);
  const ordered = [...projectScenes].sort((a, b) => a.position - b.position);
  const myIndex = ordered.findIndex((s) => s.id === scene.id);
  const previousText = myIndex > 0 ? ordered[myIndex - 1].narration : undefined;
  const nextText = myIndex >= 0 && myIndex < ordered.length - 1 ? ordered[myIndex + 1].narration : undefined;

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);

  let audioAsset: AssetRow | null = null;
  let audioReady = false;

  try {
    audioAsset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "audio",
      path: sceneAudioPath(scene.projectId, scene.id, "pending", "mp3"),
      provider: "elevenlabs",
    });

    const generated = await generateSpeechWithTimestamps({
      narration: scene.narration,
      previousText,
      nextText,
      voiceId,
      modelId,
    });

    if (!generated.alignment) {
      throw new Error("elevenlabs_alignment_missing");
    }

    const alignmentCheck = validateAlignment(generated.alignment);
    if (!alignmentCheck.ok) {
      throw new Error(`elevenlabs_alignment_invalid:${alignmentCheck.reason}`);
    }

    const audioDurationSeconds = Math.max(...generated.alignment.characterEndTimesSeconds);
    if (audioDurationSeconds > scene.durationSeconds + AUDIO_OVERFLOW_TOLERANCE_SECONDS) {
      throw new Error(
        `audio_exceeds_scene_duration:${audioDurationSeconds.toFixed(3)}s>${scene.durationSeconds}s`,
      );
    }

    const finalAudioPath = sceneAudioPath(scene.projectId, scene.id, audioAsset.id, "mp3");
    const audioFile = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, finalAudioPath, generated.bytes);

    await markAssetReady(db, audioAsset.id, {
      path: finalAudioPath,
      mimeType: generated.mimeType,
      sizeBytes: audioFile.sizeBytes,
      checksum: audioFile.checksum,
      provider: "elevenlabs",
      model: generated.model,
    });
    audioReady = true;

    const captionTimingAssetId = await saveCaptionTiming({
      db,
      handlerEnv,
      scene,
      audioAssetId: audioAsset.id,
      generatedAlignment: generated.alignment,
    });

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "ssml",
      provider: "elevenlabs",
      model: generated.model,
      promptPayload: {
        narration: scene.narration,
        previousText: previousText ?? null,
        nextText: nextText ?? null,
        voiceId,
        modelId,
        voiceSettings: ELEVENLABS_VOICE_SETTINGS,
        audioAssetId: audioAsset.id,
        styleContext: styleContext ?? null,
      },
      responseMetadata: generated.responseMetadata,
    });

    await markJobSucceeded(db, job.id, {
      assetId: audioAsset.id,
      captionTimingAssetId,
      promptVersionId: promptVersion.id,
    });
  } catch (error) {
    if (audioAsset && !audioReady) {
      await markAssetFailed(db, audioAsset.id, errorMessage(error));
    }
    throw error;
  }
}

async function saveCaptionTiming(input: {
  db: DbClient;
  handlerEnv: ReturnType<typeof resolveHandlerEnv>;
  scene: { projectId: string; id: string; durationSeconds: number };
  audioAssetId: string;
  generatedAlignment: NonNullable<
    Awaited<ReturnType<typeof generateSpeechWithTimestamps>>["alignment"]
  >;
}): Promise<string | null> {
  const { db, handlerEnv, scene, audioAssetId, generatedAlignment } = input;

  const doc = buildCaptionTimingDoc({
    alignment: generatedAlignment,
    sourceAudioAssetId: audioAssetId,
  });
  const docCheck = validateCaptionTimingDoc(doc, { sceneDurationSeconds: scene.durationSeconds });
  if (!docCheck.ok) {
    console.warn(`caption_timing_invalid:${docCheck.reason}`);
    return null;
  }

  const captionPath = sceneCaptionTimingPath(scene.projectId, scene.id, audioAssetId);
  const captionAsset = await createPendingAsset(db, {
    projectId: scene.projectId,
    sceneId: scene.id,
    kind: "caption_timing",
    path: captionPath,
    provider: "elevenlabs",
  });

  try {
    const bytes = new TextEncoder().encode(`${JSON.stringify(doc, null, 2)}\n`);
    const file = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, captionPath, bytes);
    await markAssetReady(db, captionAsset.id, {
      path: captionPath,
      mimeType: "application/json",
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      provider: "elevenlabs",
      model: null,
    });
    return captionAsset.id;
  } catch (writeError) {
    const message = errorMessage(writeError);
    try {
      await markAssetFailed(db, captionAsset.id, message);
    } catch (markError) {
      console.error("caption_mark_failed_twice", { write: message, mark: errorMessage(markError) });
    }
    return null;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run --filter @short-workflow/worker typecheck`
Expected: PASS.

- [ ] **Step 3: Run worker tests**

Run: `bun test apps/worker`
Expected: PASS — no handler-level tests exist for `generateSceneAudio`, so this just runs `assets.test.ts` from Task 10.

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/handlers/generateSceneAudio.ts
git commit -m "feat(worker): replace Gemini TTS with ElevenLabs and save caption timing"
```

---

## Task 12: Pair caption timing in `renderVideo` handler

**Files:**
- Modify: `apps/worker/src/handlers/renderVideo.ts:53-104`

- [ ] **Step 1: Update the import set**

Edit `apps/worker/src/handlers/renderVideo.ts`. Add `getReadyAssetByPath` to the `@short-workflow/db` import block and add `sceneCaptionTimingPath` to the `../assets` import:

```ts
import {
  createPendingAsset,
  createRenderAttempt,
  getCurrentReadySceneAsset,
  getProject,
  getReadyAssetByPath,
  listProjectScenes,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  markRenderFailed,
  markRenderSucceeded,
  setProjectStatus,
  type AssetRow,
  type DbClient,
  type JobRow,
  type RenderRow,
} from "@short-workflow/db";

import {
  absoluteAssetPath,
  renderInputPath,
  renderOutputPath,
  sceneCaptionTimingPath,
  statAssetFile,
  writeAssetFile,
} from "../assets";
```

- [ ] **Step 2: Extend `SceneAssetPair` and `buildRenderInput`**

In the same file, replace the `RenderSceneAsset` / `SceneAssetPair` types and the `buildRenderInput` function (line 53-104):

```ts
type RenderSceneAsset = Pick<AssetRow, "id" | "path" | "createdAt">;

type SceneAssetPair = {
  image: RenderSceneAsset | null;
  audio: RenderSceneAsset | null;
  captionTiming: RenderSceneAsset | null;
};

export function buildRenderInput(input: {
  assetRoot: string;
  project: RenderProject;
  scenes: RenderScene[];
  sceneAssets: Map<string, SceneAssetPair>;
}): RenderInput {
  if (input.scenes.length === 0) {
    throw new Error("render_preconditions_failed:no_scenes");
  }

  const durationSeconds = input.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);

  return renderInputSchema.parse({
    projectId: input.project.id,
    title: input.project.title,
    format: {
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      fps: RENDER_FPS,
      durationSeconds,
    },
    scenes: input.scenes.map((scene) => {
      if (scene.status !== "ready") {
        throw new Error(`render_preconditions_failed:scene_not_ready:${scene.id}`);
      }

      const assets = input.sceneAssets.get(scene.id);

      if (!assets?.image || !assets.audio) {
        throw new Error(`render_preconditions_failed:missing_scene_asset:${scene.id}`);
      }

      return {
        id: scene.id,
        position: scene.position,
        role: scene.role,
        durationSeconds: scene.durationSeconds,
        narration: scene.narration,
        caption: scene.caption,
        imagePath: absoluteAssetPath(input.assetRoot, assets.image.path),
        audioPath: absoluteAssetPath(input.assetRoot, assets.audio.path),
        captionTimingPath: assets.captionTiming
          ? absoluteAssetPath(input.assetRoot, assets.captionTiming.path)
          : undefined,
      };
    }),
  });
}
```

- [ ] **Step 3: Update the asset-loading block in `handleRenderVideo`**

In the same file, find the `for (const scene of scenes)` loop (line 117-124) and replace with:

```ts
for (const scene of scenes) {
  const [image, audio] = await Promise.all([
    getCurrentReadySceneAsset(db, { sceneId: scene.id, kind: "image" }),
    getCurrentReadySceneAsset(db, { sceneId: scene.id, kind: "audio" }),
  ]);

  let captionTiming: RenderSceneAsset | null = null;
  if (audio) {
    const captionPath = sceneCaptionTimingPath(project.id, scene.id, audio.id);
    captionTiming = await getReadyAssetByPath(db, {
      sceneId: scene.id,
      kind: "caption_timing",
      path: captionPath,
    });
  }

  sceneAssets.set(scene.id, { image, audio, captionTiming });
}
```

- [ ] **Step 4: Typecheck**

Run: `bun run --filter @short-workflow/worker typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/handlers/renderVideo.ts
git commit -m "feat(worker): pair caption timing to audio asset by file path"
```

---

## Task 13: Stage caption timing in `apps/render`

**Files:**
- Modify: `apps/render/src/render.ts:54-106`

- [ ] **Step 1: Extend `stageAsset` to accept `caption` kind**

Edit `apps/render/src/render.ts`. Update the `stageAsset` `kind` union (line 61):

```ts
const stageAsset = async ({
  assetPath,
  kind,
  publicDir,
  sceneId,
}: {
  assetPath: string;
  kind: "audio" | "image" | "caption";
  publicDir: string;
  sceneId: string;
}) => {
```

The existing function body (extension detection, copy) is reused as-is.

- [ ] **Step 2: Stage `captionTimingPath` in `stageRenderInputAssets`**

In the same file, replace the inner mapper (line 84-106):

```ts
export const stageRenderInputAssets = async (
  renderInput: RenderInput,
  publicDir: string,
): Promise<RenderInput> => ({
  ...renderInput,
  scenes: await Promise.all(
    renderInput.scenes.map(async (scene) => ({
      ...scene,
      audioPath: await stageAsset({
        assetPath: scene.audioPath,
        kind: "audio",
        publicDir,
        sceneId: scene.id,
      }),
      imagePath: await stageAsset({
        assetPath: scene.imagePath,
        kind: "image",
        publicDir,
        sceneId: scene.id,
      }),
      captionTimingPath: scene.captionTimingPath
        ? await stageAsset({
            assetPath: scene.captionTimingPath,
            kind: "caption",
            publicDir,
            sceneId: scene.id,
          })
        : undefined,
    })),
  ),
});
```

- [ ] **Step 3: Typecheck**

Run: `bun run --filter @short-workflow/render typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/render/src/render.ts
git commit -m "feat(render): stage caption timing JSON into Remotion publicDir"
```

---

## Task 14: Karaoke caption Remotion components

**Files:**
- Modify: `apps/render/src/ShortVideo.tsx`

- [ ] **Step 1: Add the chunker helper**

Edit `apps/render/src/ShortVideo.tsx`. Add the chunker as a top-level (non-component) function so no React hooks are invoked. Add it near the existing helpers (`getSceneDurationFrames`, etc.):

```tsx
import type { CaptionTimingDoc, CaptionWord } from "@short-workflow/shared";

type ChunkedWord = { word: CaptionWord; index: number };
type Chunk = ChunkedWord[];

const PUNCT_SENTENCE = new Set([".", "?", "!"]);

export function chunkWords(
  words: readonly CaptionWord[],
  opts: { target: number; min: number; max: number },
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = [];

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = [];
    }
  };

  for (let i = 0; i < words.length; i += 1) {
    current.push({ word: words[i], index: i });
    const text = words[i].text;
    const lastChar = text.slice(-1);

    if (current.length >= opts.max) {
      flush();
      continue;
    }
    if (PUNCT_SENTENCE.has(lastChar)) {
      flush();
      continue;
    }
    if (lastChar === "," && current.length >= opts.min) {
      flush();
    }
  }
  flush();
  return chunks;
}

function pickActiveIndex(words: readonly CaptionWord[], t: number): number {
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].start <= t && t < words[i].end) return i;
  }
  return -1;
}

function pickChunk(chunks: readonly Chunk[], activeIndex: number): Chunk {
  if (activeIndex < 0) {
    return chunks[0] ?? [];
  }
  for (const chunk of chunks) {
    if (chunk.some((entry) => entry.index === activeIndex)) {
      return chunk;
    }
  }
  return chunks[chunks.length - 1] ?? [];
}
```

- [ ] **Step 2: Add `<StaticCaption>`, `<KaraokeCaption>`, and `<SceneCaption>` components**

Replace the inline caption div in `ShortVideo` (line 71-88) and add the three new components above the `ShortVideo` export:

```tsx
import {
  Audio,
  Easing,
  Img,
  Sequence,
  cancelRender,
  continueRender,
  delayRender,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useEffect, useRef, useState } from "react";

import { captionTimingDocSchema } from "@short-workflow/shared";

const CAPTION_BOX_STYLE = {
  position: "absolute",
  left: 72,
  right: 72,
  bottom: 150,
  color: "#ffffff",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  fontSize: 62,
  fontWeight: 800,
  lineHeight: 1.12,
  textAlign: "center" as const,
  textShadow: "0 3px 8px rgba(0,0,0,0.9), 0 0 28px rgba(0,0,0,0.85)",
};

function StaticCaption({ text }: { text: string }) {
  return <div style={CAPTION_BOX_STYLE}>{text}</div>;
}

function KaraokeCaption({
  timingSrc,
  staticFallback,
}: {
  timingSrc: string;
  staticFallback: string;
}) {
  // All hooks declared up front, never inside a conditional.
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender("caption_timing_load"));
  const [doc, setDoc] = useState<CaptionTimingDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const continuedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const releaseHandle = () => {
      if (continuedRef.current) return;
      continuedRef.current = true;
      continueRender(handle);
    };

    fetch(timingSrc)
      .then((r) => {
        if (!r.ok) throw new Error(`fetch_status_${r.status}`);
        return r.json();
      })
      .then((json) => captionTimingDocSchema.parse(json))
      .then((parsed) => {
        if (!cancelled) setDoc(parsed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        releaseHandle();
      });

    return () => {
      cancelled = true;
      releaseHandle();
    };
  }, [timingSrc, handle]);

  if (failed || !doc) {
    return <StaticCaption text={staticFallback} />;
  }

  const t = localFrame / fps;
  const activeIndex = pickActiveIndex(doc.words, t);
  const chunks = chunkWords(doc.words, { target: 5, min: 4, max: 6 });
  const selected = pickChunk(chunks, activeIndex);

  return (
    <div style={CAPTION_BOX_STYLE}>
      {selected.map((entry) => {
        const { word, index } = entry;
        const isActive = index === activeIndex;
        const wordStartFrame = Math.round(word.start * fps);
        const wordEndFrame = Math.round(word.end * fps);
        const desiredEase = Math.round(0.08 * fps);
        const minSpan = 2;
        const effectiveEnd = Math.max(wordStartFrame + minSpan, wordEndFrame);
        const easeFrames = Math.max(
          1,
          Math.min(desiredEase, Math.floor((effectiveEnd - wordStartFrame) / 2)),
        );
        const easeIn = wordStartFrame + easeFrames;
        const easeOut = effectiveEnd + easeFrames;
        const scaleProgress = interpolate(
          localFrame,
          [wordStartFrame, easeIn, effectiveEnd, easeOut],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          },
        );
        const scale = 1 + 0.08 * scaleProgress;
        const color = isActive ? "#FFD400" : "#FFFFFF";

        return (
          <span
            key={index}
            style={{
              display: "inline-block",
              color,
              transform: `scale(${scale})`,
              transformOrigin: "center",
              marginRight: "0.25em",
            }}
          >
            {word.text}
          </span>
        );
      })}
    </div>
  );
}

function SceneCaption({
  scene,
}: {
  scene: RenderInput["scenes"][number];
}) {
  if (scene.captionTimingPath) {
    return (
      <KaraokeCaption
        timingSrc={resolveMediaSrc(scene.captionTimingPath)}
        staticFallback={scene.caption}
      />
    );
  }
  return <StaticCaption text={scene.caption} />;
}
```

> The `cancelRender` import is added defensively for future use; if your linter rejects unused imports, drop it. The component itself never calls `cancelRender`.

- [ ] **Step 3: Use `<SceneCaption>` inside `ShortVideo`**

In the same file, replace the inline caption `<div>` block in the existing `ShortVideo` map (line 71-88) with:

```tsx
<Img
  src={resolveMediaSrc(scene.imagePath)}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }}
/>
<Audio src={resolveMediaSrc(scene.audioPath)} />
<SceneCaption scene={scene} />
```

- [ ] **Step 4: Typecheck**

Run: `bun run --filter @short-workflow/render typecheck`
Expected: PASS. If TypeScript flags `cancelRender` as unused, remove it from the imports.

- [ ] **Step 5: Run Remotion Studio for visual verification**

Run: `bun run dev:render`
In Remotion Studio, load any existing project's render input that has a `captionTimingPath` (skip if none exists yet — Task 16 covers manual end-to-end). Confirm:
- Active word visibly highlights yellow.
- Past words return to white (no trailing highlight).
- 4-6 word chunks swap when the active word moves out.

If no caption_timing assets exist yet, this step is just a typecheck/preview pass — defer the visual check to Task 16.

- [ ] **Step 6: Commit**

```bash
git add apps/render/src/ShortVideo.tsx
git commit -m "feat(render): add KaraokeCaption with deterministic frame interpolation"
```

---

## Task 15: ElevenLabs env vars in worker `.env.example`

**Files:**
- Modify: `apps/worker/.env.example`

- [ ] **Step 1: Append the new vars**

Edit `apps/worker/.env.example`. Append at the end:

```
# ElevenLabs TTS — required for generate_scene_audio
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

- [ ] **Step 2: Commit**

```bash
git add apps/worker/.env.example
git commit -m "chore(worker): document ElevenLabs env vars"
```

---

## Task 16: End-to-end manual verification

**Files (read-only verification):**
- `LOCAL_ASSET_ROOT/projects/<id>/scenes/<id>/audio/<audioAssetId>.mp3`
- `LOCAL_ASSET_ROOT/projects/<id>/scenes/<id>/captions/<audioAssetId>.json`

- [ ] **Step 1: Configure env**

Set `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` in the worker's runtime env. `ELEVENLABS_MODEL_ID` defaults to `eleven_multilingual_v2`.

- [ ] **Step 2: Pick a scene and queue audio generation**

Use any existing tiny-mechanisms project. Re-queue the `generate_scene_audio` job for one scene (or set the scene back to `draft` and re-promote it through the existing flow that enqueues the job).

- [ ] **Step 3: Verify on disk**

After the job succeeds:
- `audio/<audioAssetId>.mp3` exists, plays back as the spoken narration.
- `captions/<audioAssetId>.json` exists with the same `<audioAssetId>` as the audio file.
- The JSON parses against `captionTimingDocSchema` (try `bun run -e "import('./packages/shared/src/captionTiming').then(m => m.captionTimingDocSchema.parse(JSON.parse(require('fs').readFileSync('<path>'))))"`).
- `sourceAudioAssetId` inside the JSON equals the audio asset's id.

- [ ] **Step 4: Render the project**

Trigger a `render_video` job (or re-run the existing render flow for the project).

- [ ] **Step 5: Watch the rendered MP4**

Open the produced MP4 and confirm:
- The active word visibly highlights yellow `#FFD400` and scales slightly (1.08).
- Past words return to white (not yellow).
- 4-6 word chunks swap as the narration progresses.
- Audio remains in sync with the highlight.

- [ ] **Step 6: Regression check — pairing**

Regenerate audio for the same scene a second time. Confirm:
- A new audio asset id is produced.
- A new `captions/<newAudioAssetId>.json` is written (or the scene falls back to static if caption save was skipped).
- Render again and confirm the caption tracks the **new** audio, not a stale one from the first run.

- [ ] **Step 7: Regression check — legacy fallback**

Pick a project whose audio was generated under the old Gemini handler (no caption_timing asset). Render it. Confirm:
- The MP4 still plays the audio.
- The static caption is shown for those scenes.

- [ ] **Step 8: Document the run**

Record in the PR description:
- Resolved `@elevenlabs/elevenlabs-js` version.
- Voice id used.
- Any field-name surprises observed in the SDK response (so future implementers know whether to update `parseAlignment`).

---

## Self-Review

After all tasks land, run the full pipeline once more end-to-end and confirm:

- [ ] `bun run typecheck` PASS in every workspace
- [ ] `bun test` PASS at repo root (covers `assets.test.ts`, `captionTiming.test.ts` x2)
- [ ] `bun run db:check` PASS
- [ ] One scene rendered with karaoke captions, verified visually
- [ ] One legacy scene (no caption_timing) rendered with static captions
- [ ] Regenerated audio pairs with new caption_timing, never stale

If any step fails, fix and re-run from the failing task; do not bypass checks.
