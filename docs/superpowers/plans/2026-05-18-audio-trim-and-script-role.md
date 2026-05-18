# Audio Trim and Script Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trim each rendered scene to the actual generated narration audio plus a small tail buffer, and add a clear short-form documentary writer/director identity to the script generation prompt.

**Architecture:** The worker remains responsible for render input generation. It reads caption timing JSON for the selected current audio asset, computes effective render durations, writes those effective durations into the render input JSON, and leaves stored scene durations unchanged. The render app continues to trust `scene.durationSeconds`, while the script prompt gets a developer-level identity section without changing the structured output schema.

**Tech Stack:** Bun workspaces, TypeScript, Zod schemas in `packages/shared`, Bun worker in `apps/worker`, Remotion render app in `apps/render`, OpenAI prompt templates in `packages/ai`.

---

## File Structure

- Modify `packages/shared/src/render.ts`
  - Relax render input duration schemas so post-audio render totals can be below the project creation minimum.

- Modify `apps/worker/src/handlers/renderVideo.ts`
  - Add deterministic effective-duration helpers.
  - Read caption timing JSON from the local asset root.
  - Pass parsed audio duration into the pure render input builder.
  - Keep database render attempt duration as an integer by storing `Math.ceil(renderInput.format.durationSeconds)`.

- Modify `apps/worker/src/handlers/renderVideo.test.ts`
  - Extend existing focused render input checks for audio-trim behavior and fallback behavior.

- Modify `packages/ai/src/prompts/scriptPlan.ts`
  - Bump the prompt version.
  - Restructure the developer message into explicit sections with a role/identity.

- Modify `apps/web/src/features/projects/ProjectWorkflow.tsx`
  - Rename project duration display so it reads as a script target, not a guaranteed rendered length.

- Modify `apps/web/src/features/projects/SceneEditor.tsx`
  - Rename scene duration display so it reads as planned scene duration.

- Modify `apps/web/src/features/projects/RenderPanel.tsx`
  - Show latest render duration metadata when available so users can distinguish actual rendered length from the target preset.

- Modify `apps/web/src/routes/index.tsx`
  - Fix the projects index layout so the projects heading and list start at the top of the right column instead of leaving a large blank area.

- No DB migration
  - `renders.duration_seconds` stays integer metadata.
  - `scenes.duration_seconds` stays the planned duration.

- No Remotion component change
  - `apps/render/src/ShortVideo.tsx` already derives frame durations from render input scene durations.
  - `apps/render/src/Root.tsx` already calculates composition duration from render input scene durations.

## Task 1: Relax Render Input Duration Schema

**Files:**
- Modify: `packages/shared/src/render.ts`

- [ ] **Step 1: Update scene render duration schema**

In `packages/shared/src/render.ts`, change the render-scene duration validator from a one-second minimum to a positive render duration:

```ts
durationSeconds: z.number().positive().max(60),
```

This lets a short audio clip render as, for example, `0.8` seconds when the source audio is genuinely short.

- [ ] **Step 2: Update total render duration schema**

In the same file, change `format.durationSeconds` from:

```ts
durationSeconds: z.number().min(20).max(60),
```

to:

```ts
durationSeconds: z.number().positive().max(60),
```

Keep project creation schemas unchanged. Only render input accepts post-audio totals below 20 seconds.

- [ ] **Step 3: Run focused typecheck**

Run:

```bash
bun run --cwd packages/shared typecheck
```

Expected: command exits `0`.

- [ ] **Step 4: Commit schema change**

```bash
git add packages/shared/src/render.ts
git commit -m "fix(shared): allow trimmed render durations"
```

## Task 2: Add Pure Worker Duration Computation

**Files:**
- Modify: `apps/worker/src/handlers/renderVideo.ts`
- Modify: `apps/worker/src/handlers/renderVideo.test.ts`

- [ ] **Step 1: Extend `SceneAssetPair`**

In `apps/worker/src/handlers/renderVideo.ts`, extend the internal asset pair type:

```ts
type SceneAssetPair = {
  image: RenderSceneAsset | null;
  audio: RenderSceneAsset | null;
  captionTiming: RenderSceneAsset | null;
  captionTimingAudioDurationSeconds: number | null;
};
```

Every caller must now provide `captionTimingAudioDurationSeconds`, using `null` when timing is absent or invalid.

- [ ] **Step 2: Add duration constants and helpers**

Near the other module-level declarations in `apps/worker/src/handlers/renderVideo.ts`, add:

```ts
export const RENDER_TAIL_BUFFER_SECONDS = 0.25;

export function effectiveSceneDurationFrames(input: {
  plannedDurationSeconds: number;
  audioDurationSeconds: number | null | undefined;
  fps?: number;
  tailBufferSeconds?: number;
}) {
  const fps = input.fps ?? RENDER_FPS;
  const tailBufferSeconds = input.tailBufferSeconds ?? RENDER_TAIL_BUFFER_SECONDS;
  const plannedFrames = Math.round(input.plannedDurationSeconds * fps);

  if (!input.audioDurationSeconds || input.audioDurationSeconds <= 0) {
    return Math.max(1, plannedFrames);
  }

  const audioFrames = Math.ceil((input.audioDurationSeconds + tailBufferSeconds) * fps);
  return Math.max(1, Math.min(plannedFrames, audioFrames));
}

export function effectiveSceneDurationSeconds(input: {
  plannedDurationSeconds: number;
  audioDurationSeconds: number | null | undefined;
  fps?: number;
  tailBufferSeconds?: number;
}) {
  const fps = input.fps ?? RENDER_FPS;
  return effectiveSceneDurationFrames(input) / fps;
}
```

This keeps the frame math independently testable, caps the render duration at the planned scene duration, and lets total duration be summed from integer frames before converting back to seconds.

- [ ] **Step 3: Update `buildRenderInput()` to compute render scenes first**

In `buildRenderInput()`, replace the current early sum:

```ts
const durationSeconds = input.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
```

with a `renderScenes` array built before parsing:

```ts
let totalDurationFrames = 0;

const renderScenes = input.scenes.map((scene) => {
  if (scene.status !== "ready") {
    throw new Error(`render_preconditions_failed:scene_not_ready:${scene.id}`);
  }

  const assets = input.sceneAssets.get(scene.id);

  if (!assets?.image || !assets.audio) {
    throw new Error(`render_preconditions_failed:missing_scene_asset:${scene.id}`);
  }

  const durationFrames = effectiveSceneDurationFrames({
    plannedDurationSeconds: scene.durationSeconds,
    audioDurationSeconds: assets.captionTimingAudioDurationSeconds,
    fps: RENDER_FPS,
  });
  totalDurationFrames += durationFrames;

  return {
    id: scene.id,
    position: scene.position,
    role: scene.role,
    durationSeconds: durationFrames / RENDER_FPS,
    narration: scene.narration,
    caption: scene.caption,
    imagePath: absoluteAssetPath(input.assetRoot, assets.image.path),
    audioPath: absoluteAssetPath(input.assetRoot, assets.audio.path),
    ...(assets.captionTiming
      ? { captionTimingPath: absoluteAssetPath(input.assetRoot, assets.captionTiming.path) }
      : {}),
  };
});

const durationSeconds = totalDurationFrames / RENDER_FPS;
```

Then pass `renderScenes` into `renderInputSchema.parse()`:

```ts
scenes: renderScenes,
```

- [ ] **Step 4: Update existing test fixtures**

In `apps/worker/src/handlers/renderVideo.test.ts`, every `SceneAssetPair` fixture must include:

```ts
captionTimingAudioDurationSeconds: null,
```

for tests that should preserve planned duration.

- [ ] **Step 5: Add focused duration tests**

In `apps/worker/src/handlers/renderVideo.test.ts`, add tests inside `describe("buildRenderInput", () => { ... })`:

```ts
test("trims scene duration to caption timing audio duration plus tail buffer", () => {
  const input = buildRenderInput({
    assetRoot: "/tmp/asset-root",
    project,
    scenes: [scene],
    sceneAssets: new Map([
      [
        scene.id,
        {
          image: {
            id: "img-asset-1",
            path: "projects/project-1/scenes/scene-1/images/image.png",
            createdAt,
          },
          audio: {
            id: "audio-asset-1",
            path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
            createdAt,
          },
          captionTiming: {
            id: "caption-asset-1",
            path: "projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
            createdAt,
          },
          captionTimingAudioDurationSeconds: 2.1,
        },
      ],
    ]),
  });

  const expectedDuration = Math.ceil((2.1 + 0.25) * 30) / 30;
  expect(input.scenes[0]?.durationSeconds).toBe(expectedDuration);
  expect(input.format.durationSeconds).toBe(expectedDuration);
});

test("falls back to planned scene duration when caption timing duration is absent", () => {
  const input = buildRenderInput({
    assetRoot: "/tmp/asset-root",
    project,
    scenes: [scene],
    sceneAssets: new Map([
      [
        scene.id,
        {
          image: {
            id: "img-asset-1",
            path: "projects/project-1/scenes/scene-1/images/image.png",
            createdAt,
          },
          audio: {
            id: "audio-asset-1",
            path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
            createdAt,
          },
          captionTiming: null,
          captionTimingAudioDurationSeconds: null,
        },
      ],
    ]),
  });

  expect(input.scenes[0]?.durationSeconds).toBe(scene.durationSeconds);
  expect(input.format.durationSeconds).toBe(scene.durationSeconds);
});

test("caps trimmed duration at the planned scene duration", () => {
  const input = buildRenderInput({
    assetRoot: "/tmp/asset-root",
    project,
    scenes: [{ ...scene, durationSeconds: 3 }],
    sceneAssets: new Map([
      [
        scene.id,
        {
          image: {
            id: "img-asset-1",
            path: "projects/project-1/scenes/scene-1/images/image.png",
            createdAt,
          },
          audio: {
            id: "audio-asset-1",
            path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
            createdAt,
          },
          captionTiming: {
            id: "caption-asset-1",
            path: "projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
            createdAt,
          },
          captionTimingAudioDurationSeconds: 4,
        },
      ],
    ]),
  });

  expect(input.scenes[0]?.durationSeconds).toBe(3);
  expect(input.format.durationSeconds).toBe(3);
});
```

- [ ] **Step 6: Run focused worker tests**

Run:

```bash
bun test apps/worker/src/handlers/renderVideo.test.ts
```

Expected: command exits `0`.

- [ ] **Step 7: Commit pure worker duration logic**

```bash
git add apps/worker/src/handlers/renderVideo.ts apps/worker/src/handlers/renderVideo.test.ts
git commit -m "fix(worker): trim render scenes to audio timing"
```

## Task 3: Read Caption Timing JSON During Render Input Build

**Files:**
- Modify: `apps/worker/src/handlers/renderVideo.ts`

- [ ] **Step 1: Add imports**

At the top of `apps/worker/src/handlers/renderVideo.ts`, change the filesystem import:

```ts
import { mkdir, access } from "node:fs/promises";
```

to:

```ts
import { mkdir, access, readFile } from "node:fs/promises";
```

Also import the caption timing schema from shared:

```ts
import {
  RENDER_FPS,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  captionTimingDocSchema,
  renderInputSchema,
  type RenderInput,
} from "@short-workflow/shared";
```

- [ ] **Step 2: Add caption timing read helper**

Below the duration helper functions in `apps/worker/src/handlers/renderVideo.ts`, add:

```ts
async function readCaptionTimingAudioDurationSeconds(input: {
  assetRoot: string;
  sceneId: string;
  captionTiming: RenderSceneAsset | null;
}) {
  if (!input.captionTiming) {
    return null;
  }

  const absolutePath = absoluteAssetPath(input.assetRoot, input.captionTiming.path);

  try {
    const raw = await readFile(absolutePath, "utf8");
    const parsed = captionTimingDocSchema.parse(JSON.parse(raw));
    return parsed.audioDurationSeconds;
  } catch (error) {
    console.warn("caption_timing_audio_duration_unavailable", {
      sceneId: input.sceneId,
      path: input.captionTiming.path,
      reason: errorMessage(error),
    });
    return null;
  }
}
```

This implements the legacy fallback from the spec. Invalid timing should not block render when the audio asset itself exists.

- [ ] **Step 3: Wire helper inside `handleRenderVideo()`**

Inside the per-scene loop in `handleRenderVideo()`, after caption timing lookup, add:

```ts
const captionTimingAudioDurationSeconds = await readCaptionTimingAudioDurationSeconds({
  assetRoot: handlerEnv.LOCAL_ASSET_ROOT,
  sceneId: scene.id,
  captionTiming,
});
```

Then replace:

```ts
sceneAssets.set(scene.id, { image, audio, captionTiming });
```

with:

```ts
sceneAssets.set(scene.id, {
  image,
  audio,
  captionTiming,
  captionTimingAudioDurationSeconds,
});
```

- [ ] **Step 4: Store integer render metadata**

In `handleRenderVideo()`, change the `createRenderAttempt()` call from:

```ts
durationSeconds: renderInput.format.durationSeconds,
```

to:

```ts
durationSeconds: Math.ceil(renderInput.format.durationSeconds),
```

This avoids a DB migration because `renders.duration_seconds` is an integer metadata column. The exact frame-derived duration remains in the render input JSON.

- [ ] **Step 5: Run typechecks**

Run:

```bash
bun run --cwd apps/worker typecheck
bun run --cwd apps/render typecheck
```

Expected: both commands exit `0`.

- [ ] **Step 6: Run focused worker test again**

Run:

```bash
bun test apps/worker/src/handlers/renderVideo.test.ts
```

Expected: command exits `0`.

- [ ] **Step 7: Commit caption timing file read**

```bash
git add apps/worker/src/handlers/renderVideo.ts
git commit -m "fix(worker): read audio duration from caption timing"
```

## Task 4: Add Script Prompt Identity

**Files:**
- Modify: `packages/ai/src/prompts/scriptPlan.ts`

- [ ] **Step 1: Bump prompt version**

In `scriptPlanPrompt`, change:

```ts
version: 2,
```

to:

```ts
version: 3,
```

- [ ] **Step 2: Replace developer message content with structured sections**

Inside `scriptPlanPrompt.compile()`, replace the current developer message `content` array with this sectioned content:

```ts
content: [
  "# Identity",
  "You are a senior short-form educational documentary writer and creative director.",
  "You specialize in English 9:16 YouTube Shorts that explain tiny everyday mechanisms with tight pacing, visual-first scene planning, and clear payoff.",
  "",
  "# Editorial Mission",
  TINY_MECHANISMS_CHANNEL_BIBLE,
  "Create one focused micro-documentary episode from the selected seed. The final script should feel specific, concrete, and immediately understandable to a curious general audience.",
  "Every scene must earn its time with either curiosity, mechanism clarity, visual evidence, payoff, or a loop-back ending.",
  "",
  "# Pacing Rules",
  "All narration, captions, image prompt seeds, SSML, and metadata drafts must be English.",
  "Write spoken narration that is compact, natural, and easy to understand when heard once.",
  "The first narration sentence must be understandable without context.",
  "The payoff must answer the hook instead of adding a new mystery.",
  "The cta scene is a loop-ending slot, not a long subscribe call-to-action.",
  "",
  "# Visual-First Rules",
  "Each image prompt seed must describe a concrete visual frame, not a vague concept.",
  "For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
  "Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
  "Hook image prompts must identify the object or phenomenon immediately and include a visual curiosity gap.",
  "Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, or a physical metaphor.",
  "",
  "# Safety and Scope",
  "Do not invent a new topic. Use the selected seed exactly.",
  "Do not create medical, finance, legal, political, crime, disaster, public figure, or breaking-news content.",
  "",
  "# Output Contract",
  "Return production-ready JSON that follows the supplied schema.",
  "Return the exact requested scene count and role order.",
  "SSML must use one <speak> root and speak the narration naturally.",
].join("\n"),
```

Do not move seed-specific values into the developer message. Keep them in the existing user message XML tags.

- [ ] **Step 3: Run prompt assertion**

Run:

```bash
bun -e 'import { scriptPlanPrompt } from "./packages/ai/src/prompts/scriptPlan.ts"; import { TINY_MECHANISMS_PRESET_ID } from "./packages/ai/src/prompts/presets/tinyMechanisms.ts"; const compiled = scriptPlanPrompt.compile({ channelPresetId: TINY_MECHANISMS_PRESET_ID, seedId: "recorded_voice", targetDurationSeconds: 45 }); const dev = compiled.messages[0]?.content ?? ""; const user = compiled.messages[1]?.content ?? ""; if (compiled.templateVersion !== 3) throw new Error("wrong_version"); if (!dev.includes("# Identity")) throw new Error("missing_identity"); if (!dev.includes("senior short-form educational documentary writer and creative director")) throw new Error("missing_role"); if (!dev.includes("Return production-ready JSON")) throw new Error("missing_json_contract"); if (!dev.includes("Do not create medical, finance, legal")) throw new Error("missing_safety"); if (!user.includes("<seed_id>recorded_voice</seed_id>")) throw new Error("missing_user_seed");'
```

Expected: command exits `0` with no output.

- [ ] **Step 4: Run AI package typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: command exits `0`.

- [ ] **Step 5: Commit prompt identity**

```bash
git add packages/ai/src/prompts/scriptPlan.ts
git commit -m "feat(ai): add script prompt identity"
```

## Task 5: Clarify Duration Labels and Fix Projects Index Layout

**Files:**
- Modify: `apps/web/src/features/projects/ProjectWorkflow.tsx`
- Modify: `apps/web/src/features/projects/SceneEditor.tsx`
- Modify: `apps/web/src/features/projects/RenderPanel.tsx`
- Modify: `apps/web/src/routes/index.tsx`

- [ ] **Step 1: Keep project creation target duration selector unchanged**

Do not remove or rename the `Target duration` selector in `apps/web/src/features/projects/ProjectCreateForm.tsx`.

Reason: this selector still controls the project preset, script target duration, scene count, and planned scene roles. The final MP4 may be shorter after audio trim, but the target remains useful during project creation.

- [ ] **Step 2: Rename project sidebar duration label**

In `apps/web/src/features/projects/ProjectWorkflow.tsx`, change:

```tsx
<dt className="text-muted-foreground">Duration</dt>
```

to:

```tsx
<dt className="text-muted-foreground">Script target</dt>
```

Keep the value unchanged:

```tsx
<dd className="font-medium">{detail.project.targetDurationSeconds}s</dd>
```

- [ ] **Step 3: Rename read-only scene duration label**

In `apps/web/src/features/projects/SceneEditor.tsx`, change:

```tsx
Duration seconds
```

to:

```tsx
Planned duration seconds
```

The field remains read-only and continues to show `selectedScene.durationSeconds`.

- [ ] **Step 4: Show latest render duration metadata**

In `apps/web/src/features/projects/RenderPanel.tsx`, after the latest render status paragraph, add a compact duration line when `latestRender` exists:

```tsx
{latestRender ? (
  <p className="text-xs text-muted-foreground">
    Rendered length: about {latestRender.durationSeconds}s
  </p>
) : null}
```

This value is integer metadata from `renders.duration_seconds`, rounded up by the worker. It is intentionally approximate; the exact frame-derived duration remains in the render input JSON.

- [ ] **Step 5: Fix projects index right-column blank space**

In `apps/web/src/routes/index.tsx`, replace the current three direct grid children:

```tsx
<section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
  <ProjectCreateForm />

  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p className="text-sm font-medium text-muted-foreground">Projects</p>
      <h1 className="text-2xl font-semibold tracking-normal">Short video workflow</h1>
    </div>
    {projectsQuery.isFetching ? (
      <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Refreshing
      </span>
    ) : null}
  </div>

  <div className="lg:col-start-2">
    <div className="rounded-lg border border-border bg-card shadow-sm">
      ...
    </div>
  </div>
</section>
```

with a two-child grid where the right column owns both heading and list:

```tsx
<section className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
  <ProjectCreateForm />

  <div className="min-w-0 space-y-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Projects</p>
        <h1 className="text-2xl font-semibold tracking-normal">Short video workflow</h1>
      </div>
      {projectsQuery.isFetching ? (
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Refreshing
        </span>
      ) : null}
    </div>

    <div className="rounded-lg border border-border bg-card shadow-sm">
      ...
    </div>
  </div>
</section>
```

When applying this, move the existing loading/error/empty/project-list contents unchanged into the right-column card. Do not keep `lg:col-start-2`; the wrapper already occupies the right column.

Reason: the current layout has three grid children. The list is forced into column 2 but lands in the next grid row after the left creation card, so the right column has a large blank area above the project list. Wrapping heading and list in one right-column container makes them start at the same top baseline as the create card.

- [ ] **Step 6: Run web typecheck**

Run:

```bash
bun run --cwd apps/web typecheck
```

Expected: command exits `0`.

- [ ] **Step 7: Commit UI wording and projects layout**

```bash
git add apps/web/src/features/projects/ProjectWorkflow.tsx apps/web/src/features/projects/SceneEditor.tsx apps/web/src/features/projects/RenderPanel.tsx apps/web/src/routes/index.tsx
git commit -m "fix(web): clarify durations and align projects layout"
```

## Task 6: Final Focused Verification

**Files:**
- Verify changed files only.

- [ ] **Step 1: Check git diff for accidental unrelated edits**

Run:

```bash
git status --short
git diff --stat HEAD~5..HEAD
```

Expected:

- Only files from this plan are included in the implementation commits.
- Pre-existing unrelated dirty files may still appear in `git status --short`; do not stage them.

- [ ] **Step 2: Run focused checks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd apps/worker typecheck
bun run --cwd apps/render typecheck
bun run --cwd packages/ai typecheck
bun run --cwd apps/web typecheck
bun test apps/worker/src/handlers/renderVideo.test.ts
```

Expected: every command exits `0`.

- [ ] **Step 3: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output and exit `0`.

- [ ] **Step 4: Inspect render input behavior manually if local assets are available**

If a project with current ready audio and caption timing assets exists locally, run the normal render command for that project:

```bash
bun run render:project --project <projectId>
```

Expected:

- The generated render input JSON under `LOCAL_ASSET_ROOT/projects/{projectId}/input/{renderId}.json` has scene `durationSeconds` values close to `audioDurationSeconds + 0.25`, capped by planned scene duration.
- The final MP4 does not hold a static scene long after narration ends.

If no local project assets are available, skip this manual render and record that only typecheck and focused worker tests were run.

- [ ] **Step 5: Prepare final implementation summary**

Summarize:

- Effective render durations now come from caption timing audio duration when available.
- Legacy scenes without caption timing fall back to planned durations.
- Render row duration metadata is rounded up to stay compatible with the integer DB column.
- Script generation prompt now has a documentary writer/director identity and sectioned developer instructions.
- Frontend duration labels now distinguish planned script target from approximate rendered length.
- Projects index no longer leaves a large blank area above the project list on desktop.
- List exact verification commands run and their outcomes.
