# Social-Native Image Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated scene images feel like scroll-stopping Shorts/Reels/TikTok frames, not only clean documentary illustrations.

**Architecture:** Keep this as a prompt/compiler upgrade inside `packages/ai` plus one worker pass-through change. Add a deterministic visual hook archetype layer to the script response and image prompt compiler. Do not add database columns, UI, new providers, new dependencies, or renderer changes.

**Tech Stack:** Bun workspaces, TypeScript, Zod, existing `packages/ai` prompt registry, existing worker image handler, OpenAI/Gemini image providers.

---

## Research Inputs

- OpenAI image prompting guidance: use structured prompt sections, concrete subject/material/viewpoint/lighting details, explicit constraints, and avoid vague style-only prompting.
- YouTube Shorts guidance: capture attention in the first few seconds; vertical 9:16 is essential.
- TikTok creative guidance: prioritize the hook, use 9:16 full-screen, keep content visible in safe zones, use suspense/surprise/emotion, and vary scenes.
- Meta Reels guidance: use strong hook/payoff, vertical 9:16, good lighting, creative tools, and safe zones; avoid low-quality or recycled/watermarked visuals.

## File Structure

- Create `packages/ai/src/prompts/visualHooks.ts`
  - Owns the visual hook archetype enum, role defaults, and archetype-specific direction text.
- Modify `packages/ai/src/prompts/scriptPlan.ts`
  - Bump `scriptPlanPrompt.version` from `3` to `4`.
  - Add `visualHookArchetype` to each script scene schema and JSON schema.
  - Strengthen visual instructions so script output seeds include subject + action + consequence + viewpoint.
  - Export a helper for reading each scene's `visualHookArchetype` from stored script response JSON.
- Modify `packages/ai/src/prompts/presets/tinyMechanisms.ts`
  - Align the channel bible image direction with the social-native visual strategy.
- Modify `packages/ai/src/prompts/imagePrompt.ts`
  - Bump `imagePromptTemplate.version` from `2` to `3`.
  - Accept optional `visualHookArchetype`.
  - Add a `SOCIAL HOOK FRAME` section and replace calm documentary wording with social-native visual direction.
- Modify `apps/worker/src/handlers/generateSceneImage.ts`
  - Extract and pass `visualHookArchetype` from latest script prompt response into the image prompt compiler.
  - Store it in the image prompt version payload source for auditability.
- Modify `packages/ai/src/prompts/review.ts`
  - Add `visualHookArchetype` to the sample scene and use it in local prompt review output.

No database migration is needed. The selected archetype lives in the script prompt response text and image prompt audit payload. Scene rows continue storing the editable `imagePrompt` only.

---

## Task 1: Add Visual Hook Archetype Helpers

**Files:**
- Create: `packages/ai/src/prompts/visualHooks.ts`

- [ ] **Step 1: Create the helper module**

Create `packages/ai/src/prompts/visualHooks.ts`:

```ts
export const VISUAL_HOOK_ARCHETYPES = [
  "impossible_macro",
  "consequence_first",
  "hands_on_demo",
  "before_after_contrast",
  "frozen_motion",
  "scale_shock",
  "reveal_cutaway",
] as const;

export type VisualHookArchetype = (typeof VISUAL_HOOK_ARCHETYPES)[number];
export type SceneRole = "hook" | "context" | "point" | "payoff" | "cta";

export function defaultVisualHookArchetype(role: SceneRole): VisualHookArchetype {
  switch (role) {
    case "hook":
      return "consequence_first";
    case "context":
      return "hands_on_demo";
    case "point":
      return "reveal_cutaway";
    case "payoff":
      return "before_after_contrast";
    case "cta":
      return "frozen_motion";
  }
}

export function visualHookDirection(archetype: VisualHookArchetype) {
  switch (archetype) {
    case "impossible_macro":
      return "make a familiar tiny mechanism look surprising through an extreme macro close-up, while keeping the object recognizable";
    case "consequence_first":
      return "show the outcome or problem already happening before the explanation begins";
    case "hands_on_demo":
      return "show hands interacting with the real object so the scene feels native to a phone-shot social feed";
    case "before_after_contrast":
      return "show two clearly different states in one frame without using text labels";
    case "frozen_motion":
      return "freeze a dynamic instant with visible motion cues, particles, waves, cracks, bubbles, or force lines";
    case "scale_shock":
      return "make a tiny structure feel large and tangible while preserving the real-world mechanism";
    case "reveal_cutaway":
      return "show the hidden internal mechanism through a clean cutaway, transparent layer, or physically plausible cross-section";
  }
}

export function isVisualHookArchetype(value: string): value is VisualHookArchetype {
  return VISUAL_HOOK_ARCHETYPES.includes(value as VisualHookArchetype);
}
```

- [ ] **Step 2: Run a syntax/type check**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: fails only if imports/types need adjustment. If it fails because the new file is unused, continue; later tasks import it.

---

## Task 2: Extend Script Plan Output

**Files:**
- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/prompts/scriptPlan.ts`
- Modify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`

- [ ] **Step 1: Add the archetype to `ScriptScene`**

In `packages/ai/src/types.ts`, import the type:

```ts
import type { VisualHookArchetype } from "./prompts/visualHooks";
```

Then add the field to `ScriptScene`:

```ts
export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
  visualBrief: string;
  visualHookArchetype: VisualHookArchetype;
  ttsDirection: string;
};
```

- [ ] **Step 2: Update imports in `scriptPlan.ts`**

Add:

```ts
import {
  VISUAL_HOOK_ARCHETYPES,
  isVisualHookArchetype,
  type VisualHookArchetype,
} from "./visualHooks";
```

- [ ] **Step 3: Update Zod scene schema**

In `scriptSceneSchema`, add:

```ts
visualHookArchetype: z.enum(VISUAL_HOOK_ARCHETYPES),
```

- [ ] **Step 4: Update JSON schema required fields**

In `SCRIPT_PLAN_JSON_SCHEMA`, add `"visualHookArchetype"` to the scene `required` array after `"visualBrief"`.

Add the property:

```ts
visualHookArchetype: {
  type: "string",
  enum: VISUAL_HOOK_ARCHETYPES,
},
```

- [ ] **Step 5: Bump script prompt version**

Change:

```ts
version: 3,
```

to:

```ts
version: 4,
```

- [ ] **Step 6: Replace visual-first instructions with social-native rules**

In the `# Visual-First Rules` block, replace the existing five visual lines with:

```ts
"Each scene must choose one visualHookArchetype from: impossible_macro, consequence_first, hands_on_demo, before_after_contrast, frozen_motion, scale_shock, reveal_cutaway.",
"Each image prompt seed must describe a concrete vertical frame using subject + action already happening + consequence or tension + camera viewpoint.",
"For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
"Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
"Hook image prompts must show the phenomenon already happening, not a calm setup before it happens.",
"Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, frozen motion, scale shock, or a physical metaphor.",
"Prefer real-world objects, hands, silhouettes, tabletop demonstrations, macro textures, and physically readable cause/effect over abstract floating diagrams.",
```

- [ ] **Step 7: Update default style context**

Change `defaultProjectStyleContext().visualStyle` to:

```ts
"social-native vertical science frames with real objects, hands, macro details, action already in progress, and clear mechanism reveals"
```

Change `colorAndLighting` to:

```ts
"high contrast, bright mobile-readable subject separation, tactile real-world texture, and clean caption-safe negative space"
```

Change `imageContinuity` to:

```ts
"consistent short-form science visual language with one dominant object, one clear action, and one readable mechanism per scene"
```

- [ ] **Step 8: Align channel bible image direction**

In `packages/ai/src/prompts/presets/tinyMechanisms.ts`, change the `Image direction` line to:

```ts
"Image direction: social-native vertical science frames with one dominant object, action already in progress, real-world hands or macro details, clear mechanism reveals, no embedded text, no logos, no UI, no public figures.",
```

- [ ] **Step 9: Add stored-response extractor**

After `sceneVisualBriefFromScriptResponseText`, add:

```ts
export function sceneVisualHookArchetypeFromScriptResponseText(
  responseText: string | null | undefined,
  scenePosition: number,
): VisualHookArchetype | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = scriptPlanSchema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return undefined;
    }

    const value = parsed.data.scenes.find(
      (scene) => scene.position === scenePosition,
    )?.visualHookArchetype;

    return value && isVisualHookArchetype(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 10: Run prompt compile assertion**

Run:

```bash
bun -e 'import { scriptPlanPrompt } from "./packages/ai/src/prompts/scriptPlan.ts"; const compiled = scriptPlanPrompt.compile({ channelPresetId: "tiny_mechanisms", seedId: "recorded_voice", targetDurationSeconds: 45 }); const dev = compiled.messages[0]?.content ?? ""; const schema = JSON.stringify(compiled.schemaVersion); if (compiled.templateVersion !== 4) throw new Error("wrong_script_version"); if (!dev.includes("visualHookArchetype")) throw new Error("missing_visual_hook_instruction"); if (!dev.includes("subject + action already happening + consequence or tension + camera viewpoint")) throw new Error("missing_social_frame_formula"); if (schema !== "1") throw new Error("schema_version_changed_unexpectedly");'
```

Expected: exits `0`.

---

## Task 3: Upgrade Image Prompt Compiler

**Files:**
- Modify: `packages/ai/src/prompts/imagePrompt.ts`

- [ ] **Step 1: Import visual hook helpers**

Add:

```ts
import {
  defaultVisualHookArchetype,
  visualHookDirection,
  type VisualHookArchetype,
} from "./visualHooks";
```

- [ ] **Step 2: Extend image prompt input**

Add to `scene`:

```ts
visualHookArchetype?: VisualHookArchetype | null;
```

- [ ] **Step 3: Bump image prompt version**

Change:

```ts
version: 2,
```

to:

```ts
version: 3,
```

- [ ] **Step 4: Add hook archetype variables**

Inside `compile(input)`, after `roleJob`:

```ts
const hookArchetype =
  input.scene.visualHookArchetype ?? defaultVisualHookArchetype(input.scene.role);
const hookDirection = visualHookDirection(hookArchetype);
```

- [ ] **Step 5: Replace the prompt body**

Replace the `prompt` array with:

```ts
const prompt = [
  "Create one 9:16 vertical social-native science frame for a YouTube Short, Reel, or TikTok.",
  "",
  "RETENTION JOB",
  "This must work as a first-frame visual hook on a phone screen with sound off.",
  "The viewer should understand the object and feel a curiosity gap in under 0.5 seconds.",
  "",
  "SOCIAL HOOK FRAME",
  `Visual hook archetype: ${hookArchetype}.`,
  `Archetype direction: ${hookDirection}.`,
  "Show the phenomenon already happening. Do not show a calm setup before the interesting moment.",
  "Use one dominant subject filling roughly 55-70% of the upper and middle frame.",
  "Make the frame feel like an intentional short-form opening shot, not a generic stock illustration.",
  "",
  "SCENE ROLE",
  `Scene ${input.scene.position} is ${input.scene.role}. Visual job: ${roleJob}.`,
  `Scene duration: ${input.scene.durationSeconds} seconds.`,
  "",
  "SUBJECT AND ACTION",
  `Primary visual seed: ${imagePrompt}`,
  ...(visualBrief ? [`Visual brief: ${sentence(visualBrief)}`] : []),
  `Narration context: ${narration}`,
  `Caption context only, do not render this as text: ${caption}`,
  "",
  "COMPOSITION",
  "Use a clear vertical hierarchy: hook subject in the upper/middle frame, caption-safe negative space in the lower 25-30%.",
  "Keep critical details away from the top, bottom, and right-side platform UI areas.",
  "Use strong foreground/midground/background separation, but keep the image simple enough to read at thumbnail size.",
  "Prefer hands interacting with objects, macro close-ups, cutaways, before/after contrast, frozen motion, or scale-shock compositions when they clarify the mechanism.",
  "",
  "CAMERA AND LIGHT",
  "Use a specific camera viewpoint: extreme macro, close-up, low-angle detail, top-down tabletop demo, or clean cutaway view.",
  "Use bright high-contrast lighting, sharp focus on the key object, tactile real-world texture, and readable silhouettes.",
  "",
  "STYLE",
  `Visual style: ${visualStyle}`,
  `Continuity: ${imageContinuity}`,
  `Tone: ${tone}`,
  `Color and lighting: ${colorAndLighting}`,
  "Social-native science visual, photorealistic or physically plausible, tactile, bold, clear, not glossy sci-fi, not corporate stock.",
  "",
  "CONSTRAINTS",
  "No embedded text, captions, labels, arrows with words, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
  "Do not create abstract floating concept art unless the mechanism cannot be shown with a physical object.",
].join(\"\\n\");
```

- [ ] **Step 6: Store archetype in model parameters**

Extend `modelParameters`:

```ts
modelParameters: {
  aspectRatio: "9:16",
  sceneRole: input.scene.role,
  roleVisualJob: roleJob,
  visualHookArchetype: hookArchetype,
},
```

- [ ] **Step 7: Run image prompt assertion**

Run:

```bash
bun -e 'import { imagePromptTemplate } from "./packages/ai/src/prompts/imagePrompt.ts"; const compiled = imagePromptTemplate.compile({ project: { id: "p", title: "Why Cold Batteries Fade Fast", topic: "cold batteries" }, provider: "openai", scene: { id: "s", position: 1, role: "hook", durationSeconds: 3, narration: "Cold does not drain your battery. It slows it down.", caption: "Cold slows the chemistry.", imagePrompt: "a frozen phone battery struggling to power a bright screen", visualBrief: "A frosted battery cross-section shows sluggish particles stuck between terminals.", visualHookArchetype: "consequence_first" } }); if (compiled.templateVersion !== 3) throw new Error("wrong_image_version"); if (!compiled.prompt.includes("SOCIAL HOOK FRAME")) throw new Error("missing_social_hook_frame"); if (!compiled.prompt.includes("Show the phenomenon already happening")) throw new Error("missing_action_already_happening"); if (!compiled.prompt.includes("55-70%")) throw new Error("missing_subject_scale"); if (compiled.modelParameters.visualHookArchetype !== "consequence_first") throw new Error("missing_model_param");'
```

Expected: exits `0`.

---

## Task 4: Pass Archetype Through Worker

**Files:**
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`

- [ ] **Step 1: Import the extractor**

Update the `@short-workflow/ai` import to include:

```ts
sceneVisualHookArchetypeFromScriptResponseText,
```

- [ ] **Step 2: Extract archetype beside visual brief**

After `visualBrief`, add:

```ts
const visualHookArchetype = sceneVisualHookArchetypeFromScriptResponseText(
  latestScriptPrompt?.responseText,
  scene.position,
);
```

- [ ] **Step 3: Pass archetype into image prompt compiler**

Change the scene object passed to `imagePromptTemplate.compile()`:

```ts
scene: {
  ...scene,
  ...(visualBrief ? { visualBrief } : {}),
  ...(visualHookArchetype ? { visualHookArchetype } : {}),
},
```

- [ ] **Step 4: Store archetype in prompt payload source**

Extend the `promptPayload` source:

```ts
promptPayload: promptPayload(compiledPrompt, {
  projectId: project.id,
  sceneId: scene.id,
  imagePrompt: scene.imagePrompt,
  visualBrief: visualBrief ?? null,
  visualHookArchetype: visualHookArchetype ?? null,
}),
```

- [ ] **Step 5: Run worker typecheck**

Run:

```bash
bun run --cwd apps/worker typecheck
```

Expected: exits `0`.

---

## Task 5: Update Prompt Review Fixture

**Files:**
- Modify: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Update sample scene**

Add to `sampleScene`:

```ts
visualHookArchetype: "consequence_first" as const,
```

Also make `imagePrompt` more social-native:

```ts
imagePrompt:
  "a hand holding a phone voice recorder near a mouth while a translucent jaw shows skull vibrations and a separate air-wave path entering the microphone",
```

- [ ] **Step 2: Run prompt review**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected output:

- `script.templateVersion` is `4`
- `image.templateVersion` is `3`
- `image.prompt` includes `SOCIAL HOOK FRAME`
- `image.prompt` includes `Visual hook archetype: consequence_first`
- `image.prompt` reads like a social-native opening frame, not only a neutral documentary still

---

## Task 6: Final Verification

**Files:**
- Check all files touched by Tasks 1-5.

- [ ] **Step 1: Run focused typechecks**

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd apps/worker typecheck
```

Expected: both exit `0`.

- [ ] **Step 2: Run prompt assertions**

Run the two `bun -e` assertions from Task 2 and Task 3 again.

Expected: both exit `0`.

- [ ] **Step 3: Run diff check**

Run:

```bash
git diff --check
git diff --stat
```

Expected changed implementation files:

- `packages/ai/src/prompts/visualHooks.ts`
- `packages/ai/src/types.ts`
- `packages/ai/src/prompts/scriptPlan.ts`
- `packages/ai/src/prompts/presets/tinyMechanisms.ts`
- `packages/ai/src/prompts/imagePrompt.ts`
- `apps/worker/src/handlers/generateSceneImage.ts`
- `packages/ai/src/prompts/review.ts`

No migration, API route, frontend UI, provider dependency, or renderer change should be introduced by this plan.

## Self-Review

- Spec coverage: The plan addresses the research finding that Shorts need first-frame promise, visual interruption, full-screen 9:16 readability, safe zones, and fast comprehension.
- Scope check: This is one bounded prompt-quality upgrade with no storage or UI changes.
- Placeholder scan: No placeholder markers or deferred steps remain.
- Type consistency: `visualHookArchetype` is added to script output, extracted from stored response text, passed into the image compiler, and recorded in prompt payload metadata.
