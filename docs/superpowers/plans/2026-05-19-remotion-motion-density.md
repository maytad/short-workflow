# Remotion Motion Density Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic role-based motion density to Remotion renders so static generated scene images feel more active without adding providers, dependencies, database fields, or render input schema changes.

**Architecture:** Keep motion render-only inside `apps/render/src/ShortVideo.tsx`. Export pure helper functions for profile selection and frame math, cover them with Bun tests, then wire a `SceneVisual` component into the existing scene sequence. The render input contract stays unchanged; scene `role`, `position`, `durationSeconds`, and FPS drive repeatable motion.

**Tech Stack:** Remotion, React, TypeScript, Bun test, existing `@short-workflow/shared` render schemas.

---

## Scope

Implement only render-layer motion:

- Continuous per-scene slow zoom and pan.
- Short punch-in pulses every 2-4 seconds.
- Role-specific motion intensity for `hook`, `context`, `point`, `payoff`, and `cta`.
- Lightweight visual emphasis overlays that stay behind captions.
- A caption-safe lower scrim to preserve readability over moving images.

Do not change:

- `packages/shared/src/render.ts`
- database schema or migrations
- worker render input generation
- AI prompts
- providers
- dependencies
- audio, captions, or upload behavior

## File Structure

- Modify: `apps/render/src/ShortVideo.tsx`
  - Owns render composition, media resolution, caption rendering, and the new deterministic scene motion helpers/component.
  - Export pure helper functions used by focused tests.
- Modify: `apps/render/src/ShortVideo.test.ts`
  - Adds behavior tests for motion profiles, deterministic frame values, and opacity bounds.
- No new files are required.

## Motion Design

### Profiles

Each scene role receives a deterministic profile:

```ts
type SceneMotionRole = RenderInput["scenes"][number]["role"];

type SceneMotionProfile = {
  baseScaleStart: number;
  baseScaleEnd: number;
  panX: number;
  panY: number;
  beatEveryFrames: number;
  beatOffsetFrames: number;
  pulseScale: number;
  pulseFrames: number;
  entranceScale: number;
  overlayMaxOpacity: number;
  captionScrimOpacity: number;
};
```

Recommended profile values:

- `hook`: highest intensity, early punch-in, beat every 2 seconds.
- `context`: calm recognition motion, beat every 4 seconds.
- `point`: medium-high inspection motion, beat every 3 seconds, strongest emphasis overlay.
- `payoff`: resolved reveal motion, beat every 3 seconds.
- `cta`: loop-back motion, beat every 3 seconds.

### Frame Math

Use Remotion-safe frame math only:

- `useCurrentFrame()` for local sequence frame.
- `interpolate()` with clamp extrapolation for continuous motion.
- `Easing.out(Easing.cubic)` for punch-in and entrance motion.
- No CSS `transition`, no CSS keyframes, no Tailwind animation classes.

### Layer Order

The scene layer order must be:

1. moving image
2. emphasis overlay/vignette
3. lower caption scrim
4. audio
5. existing caption renderer

Captions remain visually topmost.

---

### Task 1: Add Failing Motion Helper Tests

**Files:**
- Modify: `apps/render/src/ShortVideo.test.ts`
- Later Modify: `apps/render/src/ShortVideo.tsx`

- [ ] **Step 1: Update the import in `apps/render/src/ShortVideo.test.ts`**

Replace the existing import:

```ts
import { chunkWords, getSceneDurationFrames, getTotalDurationFrames, pickActiveIndex, resolveMediaSrc } from "./ShortVideo";
```

With this import:

```ts
import {
  chunkWords,
  getSceneDurationFrames,
  getSceneMotionStyle,
  getTotalDurationFrames,
  pickActiveIndex,
  resolveMediaSrc,
  sceneMotionProfile,
} from "./ShortVideo";
```

- [ ] **Step 2: Append failing tests to `apps/render/src/ShortVideo.test.ts`**

Add this block after the existing `describe("chunkWords", ...)` block:

```ts
describe("scene motion", () => {
  test("uses a stronger first beat for hook scenes", () => {
    const hook = sceneMotionProfile("hook", 1, 30);
    const context = sceneMotionProfile("context", 2, 30);

    expect(hook.beatEveryFrames).toBeLessThan(context.beatEveryFrames);
    expect(hook.pulseScale).toBeGreaterThan(context.pulseScale);
    expect(hook.baseScaleEnd).toBeGreaterThan(hook.baseScaleStart);
  });

  test("produces deterministic pan and punch-in values over a scene", () => {
    const start = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 0,
      position: 1,
      role: "hook",
    });
    const middle = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 75,
      position: 1,
      role: "hook",
    });
    const end = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 179,
      position: 1,
      role: "hook",
    });

    expect(start.scale).toBeGreaterThan(1);
    expect(middle.scale).toBeGreaterThan(start.scale);
    expect(end.scale).toBeGreaterThan(start.scale);
    expect(start.translateX).not.toBe(end.translateX);
    expect(start.overlayOpacity).toBeGreaterThan(end.overlayOpacity);
  });

  test("keeps point scenes visually emphasized without hiding captions", () => {
    const style = getSceneMotionStyle({
      durationInFrames: 210,
      fps: 30,
      frame: 90,
      position: 3,
      role: "point",
    });

    expect(style.scale).toBeGreaterThan(1.04);
    expect(style.overlayOpacity).toBeGreaterThanOrEqual(0);
    expect(style.overlayOpacity).toBeLessThanOrEqual(0.22);
    expect(style.captionScrimOpacity).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: FAIL with an export error similar to:

```text
Export named 'getSceneMotionStyle' not found in module
```

- [ ] **Step 4: Commit**

Do not commit this task alone. Keep the failing test uncommitted until Task 2 makes it pass.

---

### Task 2: Implement Pure Motion Profile Helpers

**Files:**
- Modify: `apps/render/src/ShortVideo.tsx`
- Test: `apps/render/src/ShortVideo.test.ts`

- [ ] **Step 1: Add motion types and helper functions in `apps/render/src/ShortVideo.tsx`**

Insert this code after `getTotalDurationFrames` and before `pickActiveIndex`:

```ts
type SceneMotionRole = RenderInput["scenes"][number]["role"];

export type SceneMotionProfile = {
  baseScaleStart: number;
  baseScaleEnd: number;
  panX: number;
  panY: number;
  beatEveryFrames: number;
  beatOffsetFrames: number;
  pulseScale: number;
  pulseFrames: number;
  entranceScale: number;
  overlayMaxOpacity: number;
  captionScrimOpacity: number;
};

export type SceneMotionStyle = {
  scale: number;
  translateX: number;
  translateY: number;
  overlayOpacity: number;
  captionScrimOpacity: number;
};

export type SceneMotionStyleInput = {
  durationInFrames: number;
  fps: number;
  frame: number;
  position: number;
  role: SceneMotionRole;
};

const deterministicDirection = (position: number) => (position % 2 === 0 ? -1 : 1);

export function sceneMotionProfile(
  role: SceneMotionRole,
  position: number,
  fps: number,
): SceneMotionProfile {
  const direction = deterministicDirection(position);
  const twoSeconds = Math.max(1, Math.round(2 * fps));
  const threeSeconds = Math.max(1, Math.round(3 * fps));
  const fourSeconds = Math.max(1, Math.round(4 * fps));

  switch (role) {
    case "hook":
      return {
        baseScaleStart: 1.045,
        baseScaleEnd: 1.105,
        panX: 34 * direction,
        panY: -20,
        beatEveryFrames: twoSeconds,
        beatOffsetFrames: Math.round(0.25 * fps),
        pulseScale: 0.028,
        pulseFrames: Math.round(0.32 * fps),
        entranceScale: 0.035,
        overlayMaxOpacity: 0.18,
        captionScrimOpacity: 0.32,
      };
    case "context":
      return {
        baseScaleStart: 1.035,
        baseScaleEnd: 1.075,
        panX: 24 * direction,
        panY: 10,
        beatEveryFrames: fourSeconds,
        beatOffsetFrames: Math.round(0.75 * fps),
        pulseScale: 0.012,
        pulseFrames: Math.round(0.28 * fps),
        entranceScale: 0.018,
        overlayMaxOpacity: 0.1,
        captionScrimOpacity: 0.28,
      };
    case "point":
      return {
        baseScaleStart: 1.055,
        baseScaleEnd: 1.12,
        panX: 28 * direction,
        panY: -14,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.45 * fps),
        pulseScale: 0.022,
        pulseFrames: Math.round(0.34 * fps),
        entranceScale: 0.024,
        overlayMaxOpacity: 0.22,
        captionScrimOpacity: 0.34,
      };
    case "payoff":
      return {
        baseScaleStart: 1.04,
        baseScaleEnd: 1.09,
        panX: 26 * direction,
        panY: -8,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.65 * fps),
        pulseScale: 0.018,
        pulseFrames: Math.round(0.3 * fps),
        entranceScale: 0.02,
        overlayMaxOpacity: 0.14,
        captionScrimOpacity: 0.32,
      };
    case "cta":
      return {
        baseScaleStart: 1.05,
        baseScaleEnd: 1.085,
        panX: -22 * direction,
        panY: 12,
        beatEveryFrames: threeSeconds,
        beatOffsetFrames: Math.round(0.35 * fps),
        pulseScale: 0.016,
        pulseFrames: Math.round(0.28 * fps),
        entranceScale: 0.018,
        overlayMaxOpacity: 0.12,
        captionScrimOpacity: 0.32,
      };
  }
}

export function getSceneMotionStyle(input: SceneMotionStyleInput): SceneMotionStyle {
  const duration = Math.max(1, input.durationInFrames);
  const frame = Math.min(Math.max(0, input.frame), duration - 1);
  const profile = sceneMotionProfile(input.role, input.position, input.fps);
  const progress = duration <= 1 ? 1 : frame / (duration - 1);

  const baseScale = interpolate(
    progress,
    [0, 1],
    [profile.baseScaleStart, profile.baseScaleEnd],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    },
  );

  const entranceProgress = interpolate(frame, [0, Math.round(0.45 * input.fps)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const rawBeatFrame = frame - profile.beatOffsetFrames;
  const beatFrame = Math.max(0, rawBeatFrame);
  const beatPosition =
    profile.beatEveryFrames > 0 ? beatFrame % profile.beatEveryFrames : beatFrame;
  const pulseProgress =
    rawBeatFrame >= 0 && beatPosition <= profile.pulseFrames
      ? interpolate(beatPosition, [0, profile.pulseFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : 0;

  const scale =
    baseScale + profile.entranceScale * entranceProgress + profile.pulseScale * pulseProgress;

  return {
    scale,
    translateX: interpolate(progress, [0, 1], [-profile.panX, profile.panX], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
    translateY: interpolate(progress, [0, 1], [-profile.panY, profile.panY], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
    overlayOpacity:
      profile.overlayMaxOpacity * (1 - progress) +
      profile.overlayMaxOpacity * 0.35 * pulseProgress,
    captionScrimOpacity: profile.captionScrimOpacity,
  };
}
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: PASS for all existing tests and the three new `scene motion` tests.

- [ ] **Step 3: Commit**

```bash
git add apps/render/src/ShortVideo.tsx apps/render/src/ShortVideo.test.ts
git commit -m "feat: add render motion profile helpers"
```

---

### Task 3: Wire Motion Into Scene Rendering

**Files:**
- Modify: `apps/render/src/ShortVideo.tsx`
- Test: `apps/render/src/ShortVideo.test.ts`

- [ ] **Step 1: Add `SceneVisual` component in `apps/render/src/ShortVideo.tsx`**

Insert this component after `SceneCaption` and before `ShortVideo`:

```tsx
function SceneVisual({
  durationInFrames,
  scene,
}: {
  durationInFrames: number;
  scene: RenderInput["scenes"][number];
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const motion = getSceneMotionStyle({
    durationInFrames,
    fps,
    frame,
    position: scene.position,
    role: scene.role,
  });

  return (
    <>
      <Img
        src={resolveMediaSrc(scene.imagePath)}
        style={{
          height: "100%",
          objectFit: "cover",
          transform: `translate3d(${motion.translateX}px, ${motion.translateY}px, 0) scale(${motion.scale})`,
          transformOrigin: "center",
          width: "100%",
        }}
      />
      <div
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.16), rgba(0,0,0,0) 36%), linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.18))",
          inset: 0,
          opacity: motion.overlayOpacity,
          pointerEvents: "none",
          position: "absolute",
        }}
      />
      <div
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.66) 100%)",
          bottom: 0,
          height: 520,
          left: 0,
          opacity: motion.captionScrimOpacity,
          pointerEvents: "none",
          position: "absolute",
          right: 0,
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Replace direct image rendering inside `ShortVideo`**

In the `ShortVideo` scene sequence, replace this block:

```tsx
<Img
  src={resolveMediaSrc(scene.imagePath)}
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
  }}
/>
```

With:

```tsx
<SceneVisual durationInFrames={durationInFrames} scene={scene} />
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/render/src/ShortVideo.tsx
git commit -m "feat: animate render scene images"
```

---

### Task 4: Add A Tiny Render Fixture Check

**Files:**
- Modify: `apps/render/src/ShortVideo.test.ts`
- Modify: `apps/render/src/ShortVideo.tsx` only if Task 4 test exposes an issue

- [ ] **Step 1: Add a helper-level test for safe frame clamping**

Append this test inside `describe("scene motion", ...)`:

```ts
  test("clamps out-of-range frames to safe motion values", () => {
    const before = getSceneMotionStyle({
      durationInFrames: 90,
      fps: 30,
      frame: -20,
      position: 2,
      role: "payoff",
    });
    const after = getSceneMotionStyle({
      durationInFrames: 90,
      fps: 30,
      frame: 200,
      position: 2,
      role: "payoff",
    });

    expect(before.scale).toBeGreaterThan(1);
    expect(after.scale).toBeGreaterThan(1);
    expect(Number.isFinite(before.translateX)).toBe(true);
    expect(Number.isFinite(after.translateY)).toBe(true);
    expect(before.captionScrimOpacity).toBe(after.captionScrimOpacity);
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/render/src/ShortVideo.test.ts
git commit -m "test: cover render motion frame bounds"
```

---

### Task 5: Typecheck And Render Verification

**Files:**
- Verify: `apps/render/src/ShortVideo.tsx`
- Verify: `apps/render/src/ShortVideo.test.ts`

- [ ] **Step 1: Run render package typecheck**

Run:

```bash
bun run --cwd apps/render typecheck
```

Expected: TypeScript exits with code 0.

- [ ] **Step 2: Run render package tests**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts apps/render/src/render.test.ts
```

Expected: All selected render tests pass.

- [ ] **Step 3: Create a tiny temporary render fixture**

Run:

```bash
rm -rf /tmp/short-workflow-motion-density-fixture
mkdir -p /tmp/short-workflow-motion-density-fixture
node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const dir = "/tmp/short-workflow-motion-density-fixture";
const imagePath = path.join(dir, "scene.svg");
const audioPath = path.join(dir, "scene.wav");
const inputPath = path.join(dir, "input.json");

fs.writeFileSync(
  imagePath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
    <rect width="1080" height="1920" fill="#050505"/>
    <rect x="170" y="260" width="740" height="760" rx="56" fill="#d6d2c4"/>
    <circle cx="540" cy="640" r="210" fill="#1f2937"/>
    <circle cx="540" cy="640" r="116" fill="#f7c948"/>
    <rect x="220" y="1220" width="640" height="120" rx="32" fill="#ffffff" opacity="0.22"/>
  </svg>`,
);

const sampleRate = 44100;
const seconds = 2;
const samples = sampleRate * seconds;
const dataSize = samples * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);
fs.writeFileSync(audioPath, buffer);

fs.writeFileSync(
  inputPath,
  `${JSON.stringify(
    {
      projectId: "00000000-0000-4000-8000-000000000101",
      title: "Motion Density Fixture",
      format: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 2,
      },
      scenes: [
        {
          id: "00000000-0000-4000-8000-000000000102",
          position: 1,
          role: "hook",
          durationSeconds: 2,
          narration: "A tiny mechanism moves.",
          caption: "A tiny mechanism moves",
          imagePath,
          audioPath,
        },
      ],
    },
    null,
    2,
  )}\n`,
);
NODE
```

Expected: command exits with code 0 and writes fixture files under `/tmp/short-workflow-motion-density-fixture`.

- [ ] **Step 4: Run a tiny fixture render**

Run:

```bash
bun run --cwd apps/render render:project -- --input /tmp/short-workflow-motion-density-fixture/input.json --output /tmp/short-workflow-motion-density-fixture/output.mp4
```

Expected output includes:

```text
Rendered /tmp/short-workflow-motion-density-fixture/output.mp4
```

Also verify the file exists:

```bash
test -s /tmp/short-workflow-motion-density-fixture/output.mp4
```

Expected: command exits with code 0.

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intended files from this plan are modified or committed. Pre-existing unrelated files such as `.claude/settings.local.json`, `.DS_Store`, or other untracked plan files must not be staged or modified by this plan.

---

## Self-Review

Spec coverage:

- Render-only deterministic motion is covered by Tasks 2 and 3.
- No schema, provider, database, dependency, or worker changes are included.
- TDD is covered by Task 1 before Task 2.
- Caption readability is covered by `captionScrimOpacity` in Tasks 2 and 3.
- Frame safety and bounded opacity are covered by Tasks 1 and 4.
- Remotion-specific verification is covered by Task 5.

Placeholder scan:

- The plan contains no red-flag placeholder patterns or unspecified test instructions.
- Every code-changing step includes concrete code.

Type consistency:

- `sceneMotionProfile` and `getSceneMotionStyle` are defined in Task 2 before being imported by tests and used by `SceneVisual`.
- `SceneMotionRole` derives from `RenderInput["scenes"][number]["role"]`, matching the existing render schema.
- `SceneVisual` receives `durationInFrames` from the existing local variable in `ShortVideo`.
