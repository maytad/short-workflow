# YouTube Subscribe Lower Third Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hardcoded Tiny Mechanisms YouTube subscribe lower-third that appears only during the final `cta` scene in Remotion renders.

**Architecture:** Keep the feature render-local. Add pure timing helpers and focused tests in `apps/render/src/ShortVideo.tsx`, stage the static logo into the temporary Remotion public directory in `apps/render/src/render.ts`, then render a native React lower-third component only when `scene.role === "cta"`. The render input schema, API, worker, database, and web app remain unchanged.

**Tech Stack:** Remotion, React, TypeScript, Bun test, existing render CLI and static asset staging.

---

## Scope Check

The approved spec is one focused render-layer feature. It does not need decomposition into separate subsystem plans.

This plan intentionally avoids:

- database migrations
- shared render input schema changes
- API routes
- frontend settings
- YouTube API calls
- new dependencies
- HyperFrames installation

## File Structure

- Modify: `apps/render/src/ShortVideo.tsx`
  - Add exported pure helpers for CTA visibility, lower-third timing windows, and frame-derived animation state.
  - Add the `SubscribeLowerThird` component.
  - Render the component only for `cta` scenes.
- Modify: `apps/render/src/ShortVideo.test.ts`
  - Add Bun tests for helper behavior and deterministic animation state.
- Modify: `apps/render/src/render.ts`
  - Add static render asset staging for files that must exist in the temporary Remotion `publicDir`.
  - Stage `apps/render/public/logo/logo.png` as `logo/logo.png`.
- Modify: `apps/render/src/render.test.ts`
  - Add Bun tests for static asset staging and missing-asset tolerance.
- Create: `apps/render/public/logo/logo.png`
  - Copy from existing source file `logo/logo.png`.

## Implementation Notes

`apps/render/src/render.ts` currently creates a temporary `publicDir` and passes it to `bundle()`. A file placed under `apps/render/public/logo/logo.png` will not automatically exist in that temporary directory during `render:project`, so the implementation must explicitly copy static render assets into the temp `publicDir` before bundling.

The lower-third component may use local React state only to switch from the logo image to the `TM` avatar fallback after an image load failure. All animation state must come from local Remotion frames.

---

### Task 1: Add Failing Subscribe Timing Tests

**Files:**
- Modify: `apps/render/src/ShortVideo.test.ts`
- Later Modify: `apps/render/src/ShortVideo.tsx`

- [ ] **Step 1: Update the import in `apps/render/src/ShortVideo.test.ts`**

Replace the existing import block:

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

With this import block:

```ts
import {
  SUBSCRIBE_LOWER_THIRD,
  chunkWords,
  getSceneDurationFrames,
  getSceneMotionStyle,
  getSubscribeLowerThirdState,
  getSubscribeLowerThirdWindow,
  getTotalDurationFrames,
  pickActiveIndex,
  resolveMediaSrc,
  sceneMotionProfile,
  shouldShowSubscribeLowerThird,
} from "./ShortVideo";
```

- [ ] **Step 2: Append failing tests to `apps/render/src/ShortVideo.test.ts`**

Add this block after the existing `describe("scene motion", ...)` block:

```ts
describe("subscribe lower third", () => {
  test("uses Tiny Mechanisms hardcoded branding", () => {
    expect(SUBSCRIBE_LOWER_THIRD.channelName).toBe("Tiny Mechanisms");
    expect(SUBSCRIBE_LOWER_THIRD.logoPath).toBe("logo/logo.png");
    expect(SUBSCRIBE_LOWER_THIRD.durationSeconds).toBe(4.5);
  });

  test("renders only for cta scenes", () => {
    expect(shouldShowSubscribeLowerThird("cta")).toBe(true);

    for (const role of ["hook", "context", "point", "payoff"] as const) {
      expect(shouldShowSubscribeLowerThird(role)).toBe(false);
    }
  });

  test("uses the last 4.5 seconds for longer cta scenes", () => {
    const window = getSubscribeLowerThirdWindow({
      fps: 30,
      sceneDurationInFrames: 180,
    });

    expect(window).toEqual({
      durationInFrames: 135,
      endFrame: 180,
      startFrame: 45,
    });
  });

  test("clamps the lower third to short cta scenes", () => {
    const window = getSubscribeLowerThirdWindow({
      fps: 30,
      sceneDurationInFrames: 72,
    });

    expect(window).toEqual({
      durationInFrames: 72,
      endFrame: 72,
      startFrame: 0,
    });
  });

  test("returns deterministic frame states", () => {
    const hiddenBefore = getSubscribeLowerThirdState({
      fps: 30,
      frame: 44,
      sceneDurationInFrames: 180,
    });
    const entering = getSubscribeLowerThirdState({
      fps: 30,
      frame: 45,
      sceneDurationInFrames: 180,
    });
    const holding = getSubscribeLowerThirdState({
      fps: 30,
      frame: 90,
      sceneDurationInFrames: 180,
    });
    const subscribed = getSubscribeLowerThirdState({
      fps: 30,
      frame: 108,
      sceneDurationInFrames: 180,
    });
    const exiting = getSubscribeLowerThirdState({
      fps: 30,
      frame: 178,
      sceneDurationInFrames: 180,
    });
    const hiddenAfter = getSubscribeLowerThirdState({
      fps: 30,
      frame: 180,
      sceneDurationInFrames: 180,
    });

    expect(hiddenBefore.visible).toBe(false);
    expect(hiddenBefore.opacity).toBe(0);
    expect(entering.visible).toBe(true);
    expect(entering.opacity).toBe(0);
    expect(entering.scale).toBeCloseTo(0.96, 5);
    expect(holding.visible).toBe(true);
    expect(holding.opacity).toBeGreaterThan(0.95);
    expect(holding.subscribed).toBe(false);
    expect(subscribed.visible).toBe(true);
    expect(subscribed.subscribed).toBe(true);
    expect(exiting.visible).toBe(true);
    expect(exiting.opacity).toBeLessThan(0.5);
    expect(exiting.translateY).toBeGreaterThan(0);
    expect(hiddenAfter.visible).toBe(false);
    expect(hiddenAfter.opacity).toBe(0);
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the expected failure**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: FAIL with missing exports from `./ShortVideo`, including `SUBSCRIBE_LOWER_THIRD` or `getSubscribeLowerThirdState`.

- [ ] **Step 4: Leave the failing test uncommitted**

Do not commit this task alone. Task 2 makes the test pass and commits both test and implementation together.

---

### Task 2: Implement Pure Subscribe Timing Helpers

**Files:**
- Modify: `apps/render/src/ShortVideo.tsx`
- Test: `apps/render/src/ShortVideo.test.ts`

- [ ] **Step 1: Add constants, types, and helpers in `apps/render/src/ShortVideo.tsx`**

Insert this code after `getSceneMotionStyle` and before the caption timing helpers:

```ts
export const SUBSCRIBE_LOWER_THIRD = {
  channelName: "Tiny Mechanisms",
  durationSeconds: 4.5,
  logoPath: "logo/logo.png",
} as const;

export type SubscribeLowerThirdWindow = {
  durationInFrames: number;
  endFrame: number;
  startFrame: number;
};

export type SubscribeLowerThirdState = {
  buttonScale: number;
  localFrame: number;
  opacity: number;
  scale: number;
  subscribed: boolean;
  translateY: number;
  visible: boolean;
};

const hiddenSubscribeLowerThirdState: SubscribeLowerThirdState = {
  buttonScale: 1,
  localFrame: -1,
  opacity: 0,
  scale: 0.96,
  subscribed: false,
  translateY: 24,
  visible: false,
};

export function shouldShowSubscribeLowerThird(role: SceneMotionRole) {
  return role === "cta";
}

export function getSubscribeLowerThirdWindow(input: {
  fps: number;
  sceneDurationInFrames: number;
}): SubscribeLowerThirdWindow {
  const sceneDurationInFrames = Math.max(0, Math.round(input.sceneDurationInFrames));

  if (sceneDurationInFrames === 0) {
    return {
      durationInFrames: 0,
      endFrame: 0,
      startFrame: 0,
    };
  }

  const targetDurationInFrames = Math.max(
    1,
    Math.round(SUBSCRIBE_LOWER_THIRD.durationSeconds * input.fps),
  );
  const durationInFrames = Math.min(sceneDurationInFrames, targetDurationInFrames);
  const startFrame = Math.max(0, sceneDurationInFrames - durationInFrames);

  return {
    durationInFrames,
    endFrame: startFrame + durationInFrames,
    startFrame,
  };
}

export function getSubscribeLowerThirdState(input: {
  fps: number;
  frame: number;
  sceneDurationInFrames: number;
}): SubscribeLowerThirdState {
  const window = getSubscribeLowerThirdWindow({
    fps: input.fps,
    sceneDurationInFrames: input.sceneDurationInFrames,
  });

  if (
    window.durationInFrames === 0 ||
    input.frame < window.startFrame ||
    input.frame >= window.endFrame
  ) {
    return hiddenSubscribeLowerThirdState;
  }

  const localFrame = input.frame - window.startFrame;
  const entranceFrames = Math.max(
    1,
    Math.min(Math.round(0.4 * input.fps), Math.floor(window.durationInFrames / 3)),
  );
  const exitFrames = Math.max(
    1,
    Math.min(Math.round(0.36 * input.fps), Math.floor(window.durationInFrames / 3)),
  );
  const pressFrames = Math.max(
    1,
    Math.min(Math.round(0.24 * input.fps), Math.floor(window.durationInFrames / 4)),
  );
  const pressStartFrame = Math.min(
    Math.round(1.65 * input.fps),
    Math.max(0, window.durationInFrames - exitFrames - pressFrames - 1),
  );

  const entranceProgress = interpolate(localFrame, [0, entranceFrames], [0, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitStartFrame = Math.max(0, window.durationInFrames - exitFrames);
  const exitProgress = interpolate(
    localFrame,
    [exitStartFrame, Math.max(exitStartFrame + 1, window.durationInFrames - 1)],
    [1, 0],
    {
      easing: Easing.in(Easing.cubic),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const pressProgress =
    localFrame >= pressStartFrame && localFrame <= pressStartFrame + pressFrames
      ? interpolate(
          localFrame,
          [pressStartFrame, pressStartFrame + pressFrames / 2, pressStartFrame + pressFrames],
          [0, 1, 0],
          {
            easing: Easing.out(Easing.cubic),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )
      : 0;

  return {
    buttonScale: 1 - 0.08 * pressProgress,
    localFrame,
    opacity: Math.min(entranceProgress, exitProgress),
    scale: 0.96 + 0.04 * entranceProgress,
    subscribed: localFrame >= pressStartFrame + pressFrames,
    translateY: 28 * (1 - entranceProgress) + 20 * (1 - exitProgress),
    visible: true,
  };
}
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: PASS for all tests in `ShortVideo.test.ts`.

- [ ] **Step 3: Commit the timing helper slice**

Run:

```bash
git add apps/render/src/ShortVideo.tsx apps/render/src/ShortVideo.test.ts
git commit -m "feat: add subscribe lower third timing helpers"
```

Expected: commit succeeds with only the two render files staged.

---

### Task 3: Add Failing Static Asset Staging Tests

**Files:**
- Modify: `apps/render/src/render.test.ts`
- Later Modify: `apps/render/src/render.ts`

- [ ] **Step 1: Update the import in `apps/render/src/render.test.ts`**

Replace:

```ts
import { stageRenderInputAssets } from "./render";
```

With:

```ts
import { stageRenderInputAssets, stageRenderStaticAssets } from "./render";
```

- [ ] **Step 2: Append failing tests to `apps/render/src/render.test.ts`**

Add this block after the existing `describe("stageRenderInputAssets", ...)` block:

```ts
describe("stageRenderStaticAssets", () => {
  test("copies configured static assets into the public directory", async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "render-static-source-"));
    const publicDir = await mkdtemp(path.join(os.tmpdir(), "render-static-public-"));
    tempDirs.push(sourceDir, publicDir);

    const sourceLogo = path.join(sourceDir, "logo.png");
    await writeFile(sourceLogo, "logo-bytes");

    await stageRenderStaticAssets(publicDir, [
      {
        publicPath: "logo/logo.png",
        sourcePath: sourceLogo,
      },
    ]);

    await expect(readFile(path.join(publicDir, "logo/logo.png"), "utf8")).resolves.toBe(
      "logo-bytes",
    );
  });

  test("skips missing static assets so render fallback can handle them", async () => {
    const publicDir = await mkdtemp(path.join(os.tmpdir(), "render-static-public-"));
    tempDirs.push(publicDir);

    await stageRenderStaticAssets(publicDir, [
      {
        publicPath: "logo/logo.png",
        sourcePath: path.join(publicDir, "missing-logo.png"),
      },
    ]);

    await expect(readFile(path.join(publicDir, "logo/logo.png"), "utf8")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the focused test and confirm the expected failure**

Run:

```bash
bun test apps/render/src/render.test.ts
```

Expected: FAIL with a missing export for `stageRenderStaticAssets`.

- [ ] **Step 4: Leave the failing test uncommitted**

Do not commit this task alone. Task 4 makes the test pass and commits both test and implementation together.

---

### Task 4: Implement Static Render Asset Staging

**Files:**
- Modify: `apps/render/src/render.ts`
- Test: `apps/render/src/render.test.ts`

- [ ] **Step 1: Add static asset staging helpers in `apps/render/src/render.ts`**

Insert this code after `toLocalPath` and before `stageAsset`:

```ts
type RenderStaticAsset = {
  publicPath: string;
  sourcePath: string;
};

export const RENDER_STATIC_ASSETS: readonly RenderStaticAsset[] = [
  {
    publicPath: "logo/logo.png",
    sourcePath: path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "public",
      "logo",
      "logo.png",
    ),
  },
];

const fileErrorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;

export async function stageRenderStaticAssets(
  publicDir: string,
  assets: readonly RenderStaticAsset[] = RENDER_STATIC_ASSETS,
) {
  for (const asset of assets) {
    const destinationPath = path.join(publicDir, asset.publicPath);

    try {
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(asset.sourcePath, destinationPath);
    } catch (error) {
      if (fileErrorCode(error) === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
}
```

- [ ] **Step 2: Call static asset staging from `renderProject`**

Find this code in `apps/render/src/render.ts`:

```ts
const publicDir = await mkdtemp(path.join(os.tmpdir(), "short-render-"));
const stagedRenderInput = await stageRenderInputAssets(renderInput, publicDir);
const entryPoint = path.join(path.dirname(fileURLToPath(import.meta.url)), "Root.tsx");
```

Replace it with:

```ts
const publicDir = await mkdtemp(path.join(os.tmpdir(), "short-render-"));
await stageRenderStaticAssets(publicDir);
const stagedRenderInput = await stageRenderInputAssets(renderInput, publicDir);
const entryPoint = path.join(path.dirname(fileURLToPath(import.meta.url)), "Root.tsx");
```

- [ ] **Step 3: Run the focused render staging test**

Run:

```bash
bun test apps/render/src/render.test.ts
```

Expected: PASS for all tests in `render.test.ts`.

- [ ] **Step 4: Commit the static staging slice**

Run:

```bash
git add apps/render/src/render.ts apps/render/src/render.test.ts
git commit -m "feat: stage render static assets"
```

Expected: commit succeeds with only the two render staging files staged.

---

### Task 5: Render The Subscribe Lower Third In CTA Scenes

**Files:**
- Modify: `apps/render/src/ShortVideo.tsx`
- Test: `apps/render/src/ShortVideo.test.ts`

- [ ] **Step 1: Add the avatar and lower-third components in `apps/render/src/ShortVideo.tsx`**

Insert this code after `SceneCaption` and before `SceneVisual`:

```tsx
function SubscribeAvatar({ src }: { src: string }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoFailed) {
    return (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #f5f5f5, #cfcfcf)",
          borderRadius: "50%",
          color: "#111111",
          display: "flex",
          flexShrink: 0,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: 24,
          fontWeight: 900,
          height: 68,
          justifyContent: "center",
          width: 68,
        }}
      >
        TM
      </div>
    );
  }

  return (
    <img
      alt=""
      onError={() => setLogoFailed(true)}
      src={src}
      style={{
        backgroundColor: "#111111",
        borderRadius: "50%",
        flexShrink: 0,
        height: 68,
        objectFit: "cover",
        width: 68,
      }}
    />
  );
}

function SubscribeCheckMark() {
  return (
    <span
      aria-hidden="true"
      style={{
        borderBottom: "3px solid currentColor",
        borderLeft: "3px solid currentColor",
        display: "inline-block",
        height: 9,
        transform: "rotate(-45deg) translateY(-1px)",
        width: 16,
      }}
    />
  );
}

function SubscribeLowerThird({ durationInFrames }: { durationInFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const state = getSubscribeLowerThirdState({
    fps,
    frame,
    sceneDurationInFrames: durationInFrames,
  });

  if (!state.visible) {
    return null;
  }

  return (
    <div
      style={{
        alignItems: "center",
        background: "rgba(10, 10, 10, 0.82)",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        borderRadius: 28,
        bottom: 48,
        boxShadow: "0 18px 44px rgba(0, 0, 0, 0.42)",
        color: "#ffffff",
        display: "flex",
        gap: 18,
        height: 104,
        left: 64,
        opacity: state.opacity,
        padding: "18px 20px",
        position: "absolute",
        transform: `translate3d(0, ${state.translateY}px, 0) scale(${state.scale})`,
        transformOrigin: "left bottom",
        width: 620,
        zIndex: 5,
      }}
    >
      <SubscribeAvatar src={resolveMediaSrc(SUBSCRIBE_LOWER_THIRD.logoPath)} />
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          gap: 5,
          minWidth: 0,
        }}
      >
        <div
          style={{
            color: "rgba(255, 255, 255, 0.62)",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0,
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          YouTube
        </div>
        <div
          style={{
            color: "#ffffff",
            fontFamily:
              "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            fontSize: 31,
            fontWeight: 900,
            letterSpacing: 0,
            lineHeight: 1.05,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {SUBSCRIBE_LOWER_THIRD.channelName}
        </div>
      </div>
      <div
        style={{
          alignItems: "center",
          backgroundColor: state.subscribed ? "#2f2f2f" : "#ff0033",
          borderRadius: 999,
          color: "#ffffff",
          display: "flex",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          fontSize: state.subscribed ? 20 : 22,
          fontWeight: 900,
          gap: 10,
          height: 54,
          justifyContent: "center",
          lineHeight: 1,
          padding: "0 22px",
          transform: `scale(${state.buttonScale})`,
          transformOrigin: "center",
          width: 178,
        }}
      >
        {state.subscribed ? <SubscribeCheckMark /> : null}
        {state.subscribed ? "Subscribed" : "Subscribe"}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire the component into the scene sequence**

Find this scene content in `ShortVideo`:

```tsx
<SceneVisual durationInFrames={durationInFrames} scene={scene} />
<Audio src={resolveMediaSrc(scene.audioPath)} />
<SceneCaption scene={scene} />
```

Replace it with:

```tsx
<SceneVisual durationInFrames={durationInFrames} scene={scene} />
<Audio src={resolveMediaSrc(scene.audioPath)} />
<SceneCaption scene={scene} />
{shouldShowSubscribeLowerThird(scene.role) ? (
  <SubscribeLowerThird durationInFrames={durationInFrames} />
) : null}
```

- [ ] **Step 3: Run the focused ShortVideo tests**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts
```

Expected: PASS for all tests in `ShortVideo.test.ts`.

- [ ] **Step 4: Run render typecheck**

Run:

```bash
bun run --cwd apps/render typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the component slice**

Run:

```bash
git add apps/render/src/ShortVideo.tsx apps/render/src/ShortVideo.test.ts
git commit -m "feat: render subscribe lower third in cta"
```

Expected: commit succeeds with only the ShortVideo files staged.

---

### Task 6: Add The Tiny Mechanisms Logo Asset

**Files:**
- Create: `apps/render/public/logo/logo.png`
- Source: `logo/logo.png`

- [ ] **Step 1: Copy the existing logo into the render public tree**

Run:

```bash
mkdir -p apps/render/public/logo
cp logo/logo.png apps/render/public/logo/logo.png
```

Expected: `apps/render/public/logo/logo.png` exists.

- [ ] **Step 2: Verify the copied logo file exists and is non-empty**

Run:

```bash
test -s apps/render/public/logo/logo.png
```

Expected: command exits with status `0`.

- [ ] **Step 3: Commit the logo asset**

Run:

```bash
git add apps/render/public/logo/logo.png
git commit -m "feat: add render subscribe logo"
```

Expected: commit succeeds with the logo asset staged.

---

### Task 7: Final Verification

**Files:**
- Verify: `apps/render/src/ShortVideo.tsx`
- Verify: `apps/render/src/ShortVideo.test.ts`
- Verify: `apps/render/src/render.ts`
- Verify: `apps/render/src/render.test.ts`
- Verify: `apps/render/public/logo/logo.png`

- [ ] **Step 1: Run focused render tests**

Run:

```bash
bun test apps/render/src/ShortVideo.test.ts apps/render/src/render.test.ts
```

Expected: PASS for both test files.

- [ ] **Step 2: Run render package typecheck**

Run:

```bash
bun run --cwd apps/render typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run render package check**

Run:

```bash
bun run --cwd apps/render check
```

Expected: PASS for the render package test command.

- [ ] **Step 4: Confirm the worktree contains only expected implementation files**

Run:

```bash
git status --short
```

Expected: any remaining modified or untracked files are either unrelated pre-existing files, or the exact files from this plan. Do not stage `.claude/settings.local.json` or `.DS_Store`.

- [ ] **Step 5: Report verification evidence**

In the completion response, report:

```text
Verified:
- bun test apps/render/src/ShortVideo.test.ts apps/render/src/render.test.ts
- bun run --cwd apps/render typecheck
- bun run --cwd apps/render check
```

Also mention any visual verification that was run in the local app or Remotion Studio. If no visual render was run because no ready render fixture was available, state that directly.
