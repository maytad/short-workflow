# YouTube Shorts Image Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated scene images more compelling for YouTube Shorts by turning the existing image prompt compiler into a retention-aware vertical frame director.

**Architecture:** Keep the deterministic prompt compiler in `packages/ai`; do not add a model call, database column, dependency, or frontend surface. Reuse the existing script `prompt_versions.response_text` to recover per-scene `visualBrief` and feed it into the image prompt compiler alongside the editable `scene.imagePrompt`.

**Tech Stack:** Bun workspaces, TypeScript, existing `packages/ai` prompt registry, existing worker image handler, OpenAI/Gemini image providers.

---

## File Structure

- Modify `packages/ai/src/prompts/imagePrompt.ts`: add optional visual brief input, role-specific visual direction, safe-caption composition rules, and a structured provider prompt.
- Modify `packages/ai/src/prompts/scriptPlan.ts`: strengthen script-generation instructions so `imagePrompt` seeds are concrete visual frames, and export a helper that extracts a scene's `visualBrief` from stored script response JSON.
- Modify `apps/worker/src/handlers/generateSceneImage.ts`: pass the extracted `visualBrief` into `imagePromptTemplate.compile()` and store it in `prompt_versions.prompt_payload.source`.
- Modify `packages/ai/src/prompts/review.ts`: update the local manual review fixture to include `visualBrief`.

No database migration is needed because `visualBrief` already exists in the script structured output and is stored in the project-level script prompt version response text.

Implementation note: Because both the script plan and scene image prompt behavior changed, `scriptPlanPrompt.version` and `imagePromptTemplate.version` must be bumped to `2` so new prompt_versions audit records do not mix old and new behavior under template version `1`.

---

## Task 1: Strengthen The Image Prompt Compiler

**Files:**
- Modify: `packages/ai/src/prompts/imagePrompt.ts`

- [ ] **Step 1: Add optional visual brief to image prompt input**

Update the `scene` input type:

```ts
scene: {
  id: string;
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  visualBrief?: string | null;
};
```

- [ ] **Step 2: Add role-specific visual jobs**

Add this helper below the template:

```ts
function roleVisualJob(role: ImagePromptInput["scene"]["role"]) {
  switch (role) {
    case "hook":
      return "visual surprise: an instantly readable close-up or impossible-looking clue that stops a mobile viewer in the first half-second";
    case "context":
      return "recognition: show the familiar everyday object or situation clearly before the mechanism is explained";
    case "point":
      return "mechanism proof: reveal cause and effect through macro detail, cutaway structure, or a physical visual metaphor";
    case "payoff":
      return "reveal: make the explanation feel resolved with a satisfying before/after or clear mechanism outcome";
    case "cta":
      return "loop-back: echo the opening visual idea, but with the mechanism now visually understood";
  }
}
```

- [ ] **Step 3: Replace the single-paragraph prompt with a structured Shorts frame prompt**

Inside `compile(input)`, keep the existing normalized variables and add:

```ts
const visualBrief = sentence(input.scene.visualBrief ?? "");
const roleJob = roleVisualJob(input.scene.role);
```

Then replace the `prompt` array with:

```ts
const prompt = [
  "Create a 9:16 vertical YouTube Shorts scene frame for a faceless micro-documentary.",
  "",
  "INTENT",
  "This image must stop a mobile viewer in the first half-second and remain readable behind large captions.",
  "",
  "SCENE ROLE",
  `Scene ${input.scene.position} is ${input.scene.role}. Visual job: ${roleJob}.`,
  `Scene duration: ${input.scene.durationSeconds} seconds.`,
  "",
  "SUBJECT",
  `Primary visual seed: ${imagePrompt}`,
  `Visual brief: ${visualBrief}`,
  `Narration context: ${narration}`,
  `Caption context only, do not render this as text: ${caption}`,
  "",
  "COMPOSITION",
  "Use one dominant subject that is recognizable on a phone screen at a glance.",
  "Use strong foreground, midground, and background separation with realistic depth.",
  "Leave clean negative space in the lower 25-30% of the frame for large overlaid captions.",
  "Keep critical details out of the bottom UI/caption area.",
  "Prefer a macro close-up, object cutaway, low-angle detail, top-down demonstration, or symbolic physical evidence when it makes the mechanism clearer.",
  "",
  "CAMERA AND LIGHT",
  "Use high-contrast documentary lighting, controlled highlights, grounded color, sharp focus on the key object, and mobile-readable subject separation.",
  "",
  "STYLE",
  `Visual style: ${visualStyle}`,
  `Continuity: ${imageContinuity}`,
  `Tone: ${tone}`,
  `Color and lighting: ${colorAndLighting}`,
  "Faceless editorial documentary still, cinematic realism, tactile materials, macro texture, and no generic futuristic gloss.",
  "",
  "CONSTRAINTS",
  "Do not include embedded text, captions, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
  "Prefer objects, hands, silhouettes, environments, physical diagrams-as-scenes, and documentary visual evidence.",
].join("\n");
```

- [ ] **Step 4: Store role job in model parameters**

Extend `modelParameters`:

```ts
modelParameters: {
  aspectRatio: "9:16",
  sceneRole: input.scene.role,
  roleVisualJob: roleJob,
},
```

---

## Task 2: Extract Visual Briefs From Stored Script Responses

**Files:**
- Modify: `packages/ai/src/prompts/scriptPlan.ts`

- [ ] **Step 1: Add helper for scene visual brief lookup**

Add this export after `styleContextFromScriptResponseText`:

```ts
export function sceneVisualBriefFromScriptResponseText(
  responseText: string | null | undefined,
  scenePosition: number,
): string | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = scriptPlanSchema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return undefined;
    }

    return parsed.data.scenes.find((scene) => scene.position === scenePosition)?.visualBrief;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: Strengthen script prompt instructions for image seeds**

In the developer message array, replace:

```ts
"Image prompt seeds must describe visual subject matter and must not ask for embedded text.",
```

with:

```ts
"Each image prompt seed must describe a concrete visual frame, not a vague concept.",
"For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
"Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
"Hook image prompts must identify the object or phenomenon immediately and include a visual curiosity gap.",
"Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, or a physical metaphor.",
```

---

## Task 3: Pass Visual Briefs Through The Worker

**Files:**
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`

- [ ] **Step 1: Import the visual brief helper**

Update the `@short-workflow/ai` import:

```ts
import {
  generateImage,
  imagePromptTemplate,
  promptPayload,
  resolveImageProvider,
  sceneVisualBriefFromScriptResponseText,
  styleContextFromScriptResponseText,
} from "@short-workflow/ai";
```

- [ ] **Step 2: Extract visual brief beside style context**

After `styleContext`, add:

```ts
const visualBrief = sceneVisualBriefFromScriptResponseText(
  latestScriptPrompt?.responseText,
  scene.position,
);
```

- [ ] **Step 3: Pass visual brief into compiler without changing DB schema**

Change the `imagePromptTemplate.compile` scene input:

```ts
const compiledPrompt = imagePromptTemplate.compile({
  project,
  scene: {
    ...scene,
    ...(visualBrief ? { visualBrief } : {}),
  },
  provider,
  ...(styleContext ? { styleContext } : {}),
});
```

- [ ] **Step 4: Store visual brief in prompt payload source**

Extend the `promptPayload` source:

```ts
promptPayload: promptPayload(compiledPrompt, {
  projectId: project.id,
  sceneId: scene.id,
  imagePrompt: scene.imagePrompt,
  visualBrief: visualBrief ?? null,
}),
```

---

## Task 4: Update Manual Prompt Review Fixture

**Files:**
- Modify: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Add visual brief to sample scene**

Update `sampleScene`:

```ts
const sampleScene = {
  id: "review-scene",
  position: 1,
  role: "hook" as const,
  durationSeconds: 3,
  narration: "Your recorded voice is not lying to you. Your skull is.",
  caption: "Your skull changes your voice.",
  imagePrompt: seed.visualMetaphor,
  visualBrief:
    "A translucent side-profile skull shows two sound paths at once: vibrations traveling through bone and separate waves moving through open air.",
  ssml: "<speak>Your recorded voice is not lying to you. Your skull is.</speak>",
};
```

---

## Task 5: Verify The Prompt Change

**Files:**
- Review only: `packages/ai/src/prompts/review.ts`
- Review only: `packages/ai/src/prompts/imagePrompt.ts`

- [ ] **Step 1: Run AI package typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits `0`.

- [ ] **Step 2: Generate local prompt review JSON**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected: JSON output includes:

- `image.prompt` starts with `Create a 9:16 vertical YouTube Shorts scene frame`
- `image.prompt` includes `INTENT`
- `image.prompt` includes `Leave clean negative space in the lower 25-30%`
- `image.prompt` includes the visual brief text from `sampleScene`
- `image.modelParameters.roleVisualJob` is present

- [ ] **Step 3: Check git diff scope**

Run:

```bash
git status --short
git diff --stat
```

Expected touched implementation files:

- `packages/ai/src/prompts/imagePrompt.ts`
- `packages/ai/src/prompts/scriptPlan.ts`
- `apps/worker/src/handlers/generateSceneImage.ts`
- `packages/ai/src/prompts/review.ts`
- `bun.lock` may remain changed only if `bun install` normalized the existing package lockfile against `packages/ai/package.json`; no new dependency should be introduced.

---

## Self-Review

- Spec coverage: The plan keeps the MVP local, English, single-user, prompt-registry based, and uses existing `prompt_versions` without schema changes.
- Scope check: This is one bounded prompt-quality change; it does not add prompt UI, DB columns, provider changes, or renderer changes.
- Placeholder scan: No `TBD`, `TODO`, or deferred implementation steps remain.
- Type consistency: `visualBrief` is optional on image prompt input, extracted from validated `scriptPlanSchema`, and passed through the existing worker compile path.
