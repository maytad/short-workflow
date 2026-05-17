# Prompt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved local prompt registry so script, image, and audio generation use versioned compiled prompts and record reproducible prompt payloads.

**Architecture:** Add pure prompt compiler modules under `packages/ai/src/prompts`, update OpenAI script generation to use Responses API Structured Outputs, and wire worker handlers to store compiled prompt payloads in `prompt_versions`. Reuse the existing `prompt_versions` table and add only query/helper code needed to read the latest script style context.

**Tech Stack:** Bun workspaces, TypeScript, Zod, OpenAI Responses API, Google GenAI image/TTS wrappers, Drizzle query helpers.

---

## MVP Validation Rule

The current `AGENTS.md` says not to add new automated tests or run test suites by default while the first local flow is still being built. This plan therefore uses typecheck and manual prompt review only.

Do not add new test files in this implementation. Do not run `bun test` unless the user explicitly asks for tests.

---

## File Map

- Create: `packages/ai/src/prompts/types.ts`
  - Owns shared prompt template and compiled prompt types.
- Create: `packages/ai/src/prompts/scriptPlan.ts`
  - Owns scene role mapping, OpenAI script plan instructions, JSON Schema, response parser, and semantic validation.
- Create: `packages/ai/src/prompts/imagePrompt.ts`
  - Owns deterministic scene image prompt compilation.
- Create: `packages/ai/src/prompts/ttsPrompt.ts`
  - Owns deterministic Gemini TTS prompt compilation.
- Create: `packages/ai/src/prompts/index.ts`
  - Exports prompt registry modules.
- Modify: `packages/ai/src/types.ts`
  - Adds style context and compiled prompt metadata to generation input/output types.
- Modify: `packages/ai/src/index.ts`
  - Exports prompt registry modules.
- Modify: `packages/ai/src/openai.ts`
  - Replaces string-only JSON prompt parsing with prompt registry + Structured Outputs.
- Modify: `packages/ai/src/openaiImage.ts`
  - Adds compiled prompt metadata to response metadata.
- Modify: `packages/ai/src/googleImage.ts`
  - Adds compiled prompt metadata to response metadata.
- Modify: `packages/ai/src/googleTts.ts`
  - Sends compiled TTS prompt instead of building a short inline prompt.
- Modify: `packages/db/src/queries/promptVersions.ts`
  - Adds latest prompt version lookup by project, optional scene, and purpose.
- Modify: `apps/worker/src/handlers/generateScript.ts`
  - Stores compiled script prompt payload and script response metadata.
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`
  - Compiles provider-ready image prompt and stores compiled prompt payload.
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`
  - Compiles provider-ready TTS prompt and stores compiled prompt payload.

---

## Task 1: Add Prompt Registry Types

**Files:**
- Create: `packages/ai/src/prompts/types.ts`
- Create: `packages/ai/src/prompts/index.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Create prompt shared types**

Create `packages/ai/src/prompts/types.ts`:

```ts
import type { ImageProvider } from "../types";

export type PromptPurpose = "script" | "image_prompt" | "ssml";
export type PromptProvider = ImageProvider | "google_tts";

export type PromptMessage = {
  role: "developer" | "user";
  content: string;
};

export type CompiledPrompt = {
  templateId: string;
  templateVersion: number;
  purpose: PromptPurpose;
  provider: PromptProvider;
  messages?: PromptMessage[];
  prompt?: string;
  schemaName?: string;
  schemaVersion?: number;
  modelParameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type PromptTemplate<TInput, TCompiled extends CompiledPrompt> = {
  id: string;
  version: number;
  purpose: PromptPurpose;
  provider: PromptProvider;
  compile(input: TInput): TCompiled;
};

export function promptPayload(compiled: CompiledPrompt, source: Record<string, unknown>) {
  return {
    source,
    templateId: compiled.templateId,
    templateVersion: compiled.templateVersion,
    purpose: compiled.purpose,
    provider: compiled.provider,
    messages: compiled.messages,
    prompt: compiled.prompt,
    schemaName: compiled.schemaName,
    schemaVersion: compiled.schemaVersion,
    modelParameters: compiled.modelParameters ?? {},
    metadata: compiled.metadata ?? {},
  };
}
```

- [ ] **Step 2: Create prompt registry barrel**

Create `packages/ai/src/prompts/index.ts`:

```ts
export * from "./types";
export * from "./scriptPlan";
export * from "./imagePrompt";
export * from "./ttsPrompt";
```

- [ ] **Step 3: Export prompts from AI package**

Modify `packages/ai/src/index.ts` so it includes:

```ts
export * from "./image";
export * from "./googleImage";
export * from "./googleTts";
export * from "./openai";
export * from "./openaiImage";
export * from "./prompts";
export * from "./types";
```

- [ ] **Step 4: Verify package exports typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: the command exits with code `0`.

- [ ] **Step 5: Commit prompt type scaffolding**

```bash
git add packages/ai/src/prompts/types.ts packages/ai/src/prompts/index.ts packages/ai/src/index.ts
git commit -m "feat: add prompt registry types"
```

---

## Task 2: Add Script Plan Prompt Compiler

**Files:**
- Create: `packages/ai/src/prompts/scriptPlan.ts`
- Modify: `packages/ai/src/types.ts`

- [ ] **Step 1: Extend script generation types**

Modify `packages/ai/src/types.ts` so script-related types become:

```ts
export type ProjectStyleContext = {
  visualStyle: string;
  tone: string;
  pacing: string;
  colorAndLighting: string;
  imageContinuity: string;
  voiceDirection: string;
};

export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
};

export type GenerateScriptInput = {
  topic: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type GenerateScriptOutput = {
  title: string;
  styleContext: ProjectStyleContext;
  scenes: ScriptScene[];
  promptPayload: Record<string, unknown>;
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

export type ImageProvider = "openai" | "google_gemini";

export type GenerateImageInput = {
  prompt: string;
  model?: string;
  provider?: ImageProvider;
  promptMetadata?: Record<string, unknown>;
};

export type GenerateImageOutput = {
  bytes: Uint8Array;
  mimeType: "image/png";
  model: string;
  provider: ImageProvider;
  responseMetadata: Record<string, unknown>;
};

export type GenerateAudioInput = {
  ssml: string;
  prompt?: string;
  model?: string;
  voiceName?: string;
  promptMetadata?: Record<string, unknown>;
};

export type GenerateAudioOutput = {
  bytes: Uint8Array;
  mimeType: "audio/wav";
  model: string;
  responseMetadata: Record<string, unknown>;
};
```

- [ ] **Step 2: Create script plan compiler**

Create `packages/ai/src/prompts/scriptPlan.ts`:

```ts
import { z } from "zod";

import type { GenerateScriptInput, ProjectStyleContext, ScriptScene } from "../types";
import type { CompiledPrompt, PromptTemplate } from "./types";

export const sceneRolesByDuration = {
  30: ["hook", "context", "point", "payoff", "cta"],
  45: ["hook", "context", "point", "point", "payoff", "cta"],
  60: ["hook", "context", "point", "point", "point", "payoff", "cta"],
} as const satisfies Record<GenerateScriptInput["targetDurationSeconds"], readonly ScriptScene["role"][]>;

export const projectStyleContextSchema = z
  .object({
    visualStyle: z.string().min(1),
    tone: z.string().min(1),
    pacing: z.string().min(1),
    colorAndLighting: z.string().min(1),
    imageContinuity: z.string().min(1),
    voiceDirection: z.string().min(1),
  })
  .strict();

export const scriptSceneSchema = z
  .object({
    position: z.number().int().positive(),
    role: z.enum(["hook", "context", "point", "payoff", "cta"]),
    durationSeconds: z.number().int().positive(),
    narration: z.string().min(1),
    caption: z.string().min(1),
    imagePrompt: z.string().min(1),
    ssml: z.string().min(1),
  })
  .strict();

export const scriptPlanSchema = z
  .object({
    title: z.string().min(1),
    styleContext: projectStyleContextSchema,
    scenes: z.array(scriptSceneSchema),
  })
  .strict();

export type ScriptPlan = z.infer<typeof scriptPlanSchema>;

export type CompiledScriptPlanPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "short_workflow_script_plan_v1";
  schemaVersion: 1;
};

export const SCRIPT_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "styleContext", "scenes"],
  properties: {
    title: { type: "string" },
    styleContext: {
      type: "object",
      additionalProperties: false,
      required: [
        "visualStyle",
        "tone",
        "pacing",
        "colorAndLighting",
        "imageContinuity",
        "voiceDirection",
      ],
      properties: {
        visualStyle: { type: "string" },
        tone: { type: "string" },
        pacing: { type: "string" },
        colorAndLighting: { type: "string" },
        imageContinuity: { type: "string" },
        voiceDirection: { type: "string" },
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "position",
          "role",
          "durationSeconds",
          "narration",
          "caption",
          "imagePrompt",
          "ssml",
        ],
        properties: {
          position: { type: "integer" },
          role: { type: "string", enum: ["hook", "context", "point", "payoff", "cta"] },
          durationSeconds: { type: "integer" },
          narration: { type: "string" },
          caption: { type: "string" },
          imagePrompt: { type: "string" },
          ssml: { type: "string" },
        },
      },
    },
  },
} as const;

export const scriptPlanPrompt: PromptTemplate<GenerateScriptInput, CompiledScriptPlanPrompt> = {
  id: "script_plan",
  version: 1,
  purpose: "script",
  provider: "openai",
  compile(input) {
    const roles = sceneRolesByDuration[input.targetDurationSeconds];

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "short_workflow_script_plan_v1",
      schemaVersion: 1,
      modelParameters: {
        targetDurationSeconds: input.targetDurationSeconds,
        sceneRoles: roles,
      },
      messages: [
        {
          role: "developer",
          content: [
            "You create English 9:16 short-form video script plans for a single-user local editor.",
            "The output must be production-ready JSON that follows the supplied schema.",
            "All narration, captions, image prompt seeds, and SSML must be English.",
            "Write for a faceless explainer, visual essay, or mini-documentary short.",
            "Do not add background music, subtitle files, or publishing instructions.",
            "Captions must be short on-screen text, not full narration paragraphs.",
            "Image prompt seeds must describe visual subject matter without asking for embedded text.",
            "SSML must use one <speak> root and speak the narration naturally.",
            "Keep the project style context consistent across all scenes.",
          ].join("\\n"),
        },
        {
          role: "user",
          content: [
            `<topic>${input.topic}</topic>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<scene_roles>${roles.join(", ")}</scene_roles>`,
            `Return exactly ${roles.length} scenes in this role order.`,
          ].join("\\n"),
        },
      ],
    };
  },
};

export function parseScriptPlan(
  value: unknown,
  roles: readonly ScriptScene["role"][],
  targetDurationSeconds: GenerateScriptInput["targetDurationSeconds"],
): ScriptPlan {
  const parsed = scriptPlanSchema.safeParse(value);

  if (!parsed.success || !hasExpectedScenePlan(parsed.data.scenes, roles)) {
    throw new Error("script_response_invalid");
  }

  const totalDuration = parsed.data.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(totalDuration - targetDurationSeconds) > 2) {
    throw new Error("script_response_invalid");
  }

  return parsed.data;
}

function hasExpectedScenePlan(
  scenes: ScriptScene[],
  roles: readonly ScriptScene["role"][],
): boolean {
  if (scenes.length !== roles.length) {
    return false;
  }

  return scenes.every(
    (scene, index) => scene.position === index + 1 && scene.role === roles[index],
  );
}

export function defaultProjectStyleContext(): ProjectStyleContext {
  return {
    visualStyle: "faceless documentary stills with cinematic realism",
    tone: "clear, credible, and high-retention without hype",
    pacing: "fast enough for short-form video while remaining intelligible",
    colorAndLighting: "natural contrast, controlled highlights, and grounded color",
    imageContinuity: "consistent documentary visual language across scenes",
    voiceDirection: "warm documentary narrator with crisp articulation",
  };
}

export function styleContextFromScriptResponseText(
  responseText: string | null | undefined,
): ProjectStyleContext | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = scriptPlanSchema.safeParse(JSON.parse(responseText));
    return parsed.success ? parsed.data.styleContext : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 3: Verify prompt compiler typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: the command exits with code `0`.

- [ ] **Step 4: Commit script prompt compiler**

```bash
git add packages/ai/src/types.ts packages/ai/src/prompts/scriptPlan.ts
git commit -m "feat: add script plan prompt compiler"
```

---

## Task 3: Use Structured Outputs For Script Generation

**Files:**
- Modify: `packages/ai/src/openai.ts`

- [ ] **Step 1: Replace local schemas and prompt builder imports**

Modify the imports at the top of `packages/ai/src/openai.ts`:

```ts
import OpenAI from "openai";

import {
  parseScriptPlan,
  sceneRolesByDuration,
  SCRIPT_PLAN_JSON_SCHEMA,
  scriptPlanPrompt,
} from "./prompts/scriptPlan";
import { promptPayload } from "./prompts/types";
import type { GenerateScriptInput, GenerateScriptOutput } from "./types";
```

Remove the local `sceneRolesByDuration`, `sceneSchema`, `scriptSchema`, `buildPrompt`, and `hasExpectedScenePlan` definitions from this file.

- [ ] **Step 2: Update the Responses API call**

Replace `generateScript` with:

```ts
export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const roles = sceneRolesByDuration[input.targetDurationSeconds];
  const client = new OpenAI({ apiKey });
  const compiled = scriptPlanPrompt.compile(input);

  const scriptPlanJsonSchema = SCRIPT_PLAN_JSON_SCHEMA as unknown as Record<string, unknown>;
  const response = await client.responses.create({
    model,
    input: compiled.messages,
    text: {
      format: {
        type: "json_schema",
        name: compiled.schemaName,
        schema: scriptPlanJsonSchema,
        strict: true,
      },
    },
  });

  const rawResponseText = extractResponseText(response);
  const parsedJson = parseJsonObject(rawResponseText);
  const parsed = parseScriptPlan(parsedJson, roles, input.targetDurationSeconds);

  return {
    title: parsed.title,
    styleContext: parsed.styleContext,
    scenes: parsed.scenes,
    promptPayload: promptPayload(compiled, input),
    responseText: JSON.stringify(parsed),
    responseMetadata: {
      model_id: response.model,
      finish_reason: extractFinishReason(response),
      response_id: response.id,
      status: response.status,
      prompt_template_id: compiled.templateId,
      prompt_template_version: compiled.templateVersion,
      schema_name: compiled.schemaName,
      schema_version: compiled.schemaVersion,
    },
  };
}
```

- [ ] **Step 3: Keep JSON parsing as provider safety fallback only**

Keep `parseJsonObject`, `extractResponseText`, and `extractFinishReason` in `packages/ai/src/openai.ts`. Do not use regex parsing as the primary contract; Structured Outputs is the primary contract, and `parseJsonObject` is only there because `output_text` is a string.

- [ ] **Step 4: Verify OpenAI wrapper typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit structured script generation**

```bash
git add packages/ai/src/openai.ts
git commit -m "feat: use structured script prompts"
```

---

## Task 4: Store Script Prompt Payload And Style Context

**Files:**
- Modify: `apps/worker/src/handlers/generateScript.ts`
- Modify: `packages/db/src/queries/promptVersions.ts`

- [ ] **Step 1: Store compiled script prompt payload**

Modify the `insertPromptVersion` call in `apps/worker/src/handlers/generateScript.ts`:

```ts
  const promptVersion = await insertPromptVersion(db, {
    projectId: project.id,
    sceneId: null,
    purpose: "script",
    provider: "openai",
    promptPayload: script.promptPayload,
    responseText: script.responseText,
    responseMetadata: script.responseMetadata,
  });
```

- [ ] **Step 2: Add latest prompt version query**

Append this helper to `packages/db/src/queries/promptVersions.ts`:

```ts
export async function getLatestPromptVersion(db: DbClient, scope: PromptVersionScope) {
  const [promptVersion] = await db
    .select()
    .from(promptVersions)
    .where(promptVersionScopeWhere(scope))
    .orderBy(desc(promptVersions.revision), desc(promptVersions.createdAt))
    .limit(1);

  return promptVersion ?? null;
}
```

- [ ] **Step 3: Verify worker and DB typecheck**

Run:

```bash
bun run --cwd packages/db typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 4: Commit script prompt persistence**

```bash
git add apps/worker/src/handlers/generateScript.ts packages/db/src/queries/promptVersions.ts
git commit -m "feat: persist compiled script prompt payloads"
```

---

## Task 5: Add Image Prompt Compiler And Wire Image Jobs

**Files:**
- Create: `packages/ai/src/prompts/imagePrompt.ts`
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`
- Modify: `packages/ai/src/openaiImage.ts`
- Modify: `packages/ai/src/googleImage.ts`

- [ ] **Step 1: Create deterministic image prompt compiler**

Create `packages/ai/src/prompts/imagePrompt.ts`:

```ts
import type { ImageProvider, ProjectStyleContext } from "../types";
import type { CompiledPrompt, PromptTemplate } from "./types";
import { defaultProjectStyleContext } from "./scriptPlan";

export type ImagePromptInput = {
  project: {
    id: string;
    title: string;
    topic: string;
  };
  scene: {
    id: string;
    position: number;
    role: "hook" | "context" | "point" | "payoff" | "cta";
    durationSeconds: number;
    narration: string;
    caption: string;
    imagePrompt: string;
  };
  provider: ImageProvider;
  styleContext?: ProjectStyleContext;
};

export type CompiledImagePrompt = CompiledPrompt & {
  purpose: "image_prompt";
  provider: ImageProvider;
  prompt: string;
};

export const imagePromptTemplate: PromptTemplate<ImagePromptInput, CompiledImagePrompt> = {
  id: "scene_image_prompt",
  version: 1,
  purpose: "image_prompt",
  provider: "openai",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const prompt = [
      `Create a vertical 9:16 image for scene ${input.scene.position} of an English short-form video.`,
      `Project: ${input.project.title}. Topic: ${input.project.topic}.`,
      `Scene role: ${input.scene.role}. Scene duration: ${input.scene.durationSeconds} seconds.`,
      `Visual seed: ${input.scene.imagePrompt}.`,
      `Narration context: ${input.scene.narration}.`,
      `On-screen caption context only, do not render this as text: ${input.scene.caption}.`,
      `Visual style: ${style.visualStyle}.`,
      `Continuity: ${style.imageContinuity}.`,
      `Tone: ${style.tone}.`,
      `Color and lighting: ${style.colorAndLighting}.`,
      "Composition: strong vertical framing, clear subject hierarchy, cinematic but natural, no split-screen layout.",
      "Camera language: documentary still, realistic depth, intentional foreground/background separation.",
      "Do not include embedded captions, subtitles, typography, UI, watermarks, logos, or unreadable text.",
      "Prefer faceless scenes, objects, places, hands, silhouettes, environments, symbolic details, and documentary visual evidence.",
    ].join(" ");

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "image_prompt",
      provider: input.provider,
      prompt,
      modelParameters: {
        aspectRatio: "9:16",
        sceneRole: input.scene.role,
      },
      metadata: {
        projectId: input.project.id,
        sceneId: input.scene.id,
      },
    };
  },
};
```

- [ ] **Step 2: Add style context reader in image handler**

Replace the existing `@short-workflow/ai` import in `apps/worker/src/handlers/generateSceneImage.ts` with:

```ts
import {
  generateImage,
  imagePromptTemplate,
  promptPayload,
  resolveImageProvider,
  styleContextFromScriptResponseText,
} from "@short-workflow/ai";
```

Add `getLatestPromptVersion` and `getProject` to the existing `@short-workflow/db` import list.

- [ ] **Step 3: Compile image prompt before provider call**

In `handleGenerateSceneImage`, after loading `scene`, load project and style context:

```ts
  const project = await getProject(db, scene.projectId);
  if (!project) {
    throw new Error("project_not_found");
  }

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);
```

Then replace:

```ts
    const generated = await generateImage({ prompt: scene.imagePrompt, provider });
```

with:

```ts
    const compiledPrompt = imagePromptTemplate.compile({
      project,
      scene,
      provider,
      styleContext,
    });
    const generated = await generateImage({
      prompt: compiledPrompt.prompt,
      provider,
      promptMetadata: {
        templateId: compiledPrompt.templateId,
        templateVersion: compiledPrompt.templateVersion,
      },
    });
```

- [ ] **Step 4: Store compiled image prompt payload**

Replace the image `insertPromptVersion` payload:

```ts
    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "image_prompt",
      provider: generated.provider,
      model: generated.model,
      promptPayload: promptPayload(compiledPrompt, {
        projectId: project.id,
        sceneId: scene.id,
        imagePrompt: scene.imagePrompt,
      }),
      responseMetadata: generated.responseMetadata,
    });
```

- [ ] **Step 5: Add prompt metadata to image provider responses**

In both `packages/ai/src/openaiImage.ts` and `packages/ai/src/googleImage.ts`, add `prompt_metadata: input.promptMetadata` to the returned `responseMetadata` object.

Example for OpenAI:

```ts
    responseMetadata: {
      model_id: model,
      created: response.created,
      output_format: response.output_format,
      quality: response.quality,
      revised_prompt: image.revised_prompt,
      size: response.size,
      prompt_metadata: input.promptMetadata,
    },
```

Example for Gemini:

```ts
    responseMetadata: {
      model_id: model,
      mime_type: imagePart.mimeType,
      finish_reason: data.candidates?.[0]?.finishReason,
      candidate_count: data.candidates?.length ?? 0,
      prompt_metadata: input.promptMetadata,
    },
```

- [ ] **Step 6: Verify image prompt integration**

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit image prompt integration**

```bash
git add packages/ai/src/prompts/imagePrompt.ts apps/worker/src/handlers/generateSceneImage.ts packages/ai/src/openaiImage.ts packages/ai/src/googleImage.ts
git commit -m "feat: compile image generation prompts"
```

---

## Task 6: Add TTS Prompt Compiler And Wire Audio Jobs

**Files:**
- Create: `packages/ai/src/prompts/ttsPrompt.ts`
- Modify: `packages/ai/src/googleTts.ts`
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`

- [ ] **Step 1: Create TTS prompt compiler**

Create `packages/ai/src/prompts/ttsPrompt.ts`:

```ts
import type { ProjectStyleContext } from "../types";
import { speechTextFromSsml } from "../googleTts";
import type { CompiledPrompt, PromptTemplate } from "./types";
import { defaultProjectStyleContext } from "./scriptPlan";

export type TtsPromptInput = {
  scene: {
    id: string;
    position: number;
    role: "hook" | "context" | "point" | "payoff" | "cta";
    durationSeconds: number;
    narration: string;
    ssml: string;
  };
  voiceName: string;
  styleContext?: ProjectStyleContext;
};

export type CompiledTtsPrompt = CompiledPrompt & {
  purpose: "ssml";
  provider: "google_tts";
  prompt: string;
};

export const ttsPromptTemplate: PromptTemplate<TtsPromptInput, CompiledTtsPrompt> = {
  id: "scene_tts_prompt",
  version: 1,
  purpose: "ssml",
  provider: "google_tts",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const transcript = speechTextFromSsml(input.scene.ssml) || input.scene.narration;

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "ssml",
      provider: "google_tts",
      prompt: [
        "Synthesize speech for this short-form video narration. Do not read headings or instructions aloud.",
        "",
        "### AUDIO PROFILE",
        `Voice: ${input.voiceName}.`,
        `Role: ${style.voiceDirection}.`,
        "",
        "### DIRECTOR NOTES",
        `Tone: ${style.tone}.`,
        `Pacing: ${style.pacing}.`,
        `Scene role: ${input.scene.role}. Keep delivery appropriate for a ${input.scene.durationSeconds}-second scene.`,
        "Performance: warm documentary narration, crisp articulation, energetic but intelligible.",
        "Pauses: respect natural sentence breaks. Preserve proper nouns exactly as written.",
        "",
        "### TRANSCRIPT",
        transcript,
      ].join("\\n"),
      modelParameters: {
        voiceName: input.voiceName,
        sceneRole: input.scene.role,
      },
      metadata: {
        sceneId: input.scene.id,
        transcript,
      },
    };
  },
};
```

- [ ] **Step 2: Update Google TTS input type**

In `packages/ai/src/googleTts.ts`, replace the local `GenerateSpeechInput` type with the shared type:

```ts
import type { GenerateAudioInput, GenerateAudioOutput } from "./types";
```

Then change function signatures:

```ts
export async function generateSpeech(input: GenerateAudioInput): Promise<GenerateAudioOutput> {
```

and:

```ts
export async function generateSpeechWithClient(
  client: GoogleTtsClient,
  input: GenerateAudioInput,
): Promise<GenerateAudioOutput> {
```

- [ ] **Step 3: Use compiled prompt when provided**

In `generateSpeechWithClient`, replace:

```ts
  const narrationText = speechTextFromSsml(input.ssml);
  const prompt = `Read the following transcript naturally for a short-form video narration:\n\n${narrationText}`;
```

with:

```ts
  const narrationText = speechTextFromSsml(input.ssml);
  const prompt =
    input.prompt ??
    `Synthesize speech for this short-form video narration.\n\n### TRANSCRIPT\n${narrationText}`;
```

Add `prompt_metadata: input.promptMetadata` to `responseMetadata`.

- [ ] **Step 4: Compile TTS prompt in audio handler**

Replace the existing `@short-workflow/ai` import in `apps/worker/src/handlers/generateSceneAudio.ts` with:

```ts
import {
  generateSpeech,
  promptPayload,
  styleContextFromScriptResponseText,
  ttsPromptTemplate,
} from "@short-workflow/ai";
```

Add `getLatestPromptVersion` to the existing `@short-workflow/db` import list.

After loading `scene`, add:

```ts
  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);
```

Before calling `generateSpeech`, add:

```ts
    const voiceName = process.env.GEMINI_TTS_VOICE ?? "Kore";
    const compiledPrompt = ttsPromptTemplate.compile({
      scene,
      voiceName,
      styleContext,
    });
```

Replace:

```ts
    const generated = await generateSpeech({ ssml: scene.ssml });
```

with:

```ts
    const generated = await generateSpeech({
      ssml: scene.ssml,
      prompt: compiledPrompt.prompt,
      voiceName,
      promptMetadata: {
        templateId: compiledPrompt.templateId,
        templateVersion: compiledPrompt.templateVersion,
      },
    });
```

- [ ] **Step 5: Store compiled TTS prompt payload**

Replace the audio `insertPromptVersion` payload:

```ts
    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "ssml",
      provider: "google_gemini",
      model: generated.model,
      promptPayload: promptPayload(compiledPrompt, {
        sceneId: scene.id,
        ssml: scene.ssml,
        narration: scene.narration,
      }),
      responseMetadata: generated.responseMetadata,
    });
```

- [ ] **Step 6: Verify TTS integration**

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 7: Commit TTS prompt integration**

```bash
git add packages/ai/src/prompts/ttsPrompt.ts packages/ai/src/googleTts.ts apps/worker/src/handlers/generateSceneAudio.ts
git commit -m "feat: compile narration prompts"
```

---

## Task 7: Manual Prompt Review Helper

**Files:**
- Create: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Add a manual review helper**

Create `packages/ai/src/prompts/review.ts`:

```ts
import { imagePromptTemplate } from "./imagePrompt";
import { scriptPlanPrompt } from "./scriptPlan";
import { ttsPromptTemplate } from "./ttsPrompt";

const sampleProject = {
  id: "review-project",
  title: "Why old maps still matter",
  topic: "How old maps changed the way people understood power, trade, and risk",
};

const sampleScene = {
  id: "review-scene",
  projectId: sampleProject.id,
  position: 1,
  role: "hook" as const,
  durationSeconds: 3,
  narration: "A map is never just a picture of land.",
  caption: "Maps are arguments.",
  imagePrompt: "An antique map table with hands comparing trade routes under warm light",
  ssml: "<speak>A map is never just a picture of land.</speak>",
};

const script = scriptPlanPrompt.compile({
  topic: sampleProject.topic,
  targetDurationSeconds: 45,
});

const image = imagePromptTemplate.compile({
  project: sampleProject,
  scene: sampleScene,
  provider: "openai",
});

const tts = ttsPromptTemplate.compile({
  scene: sampleScene,
  voiceName: "Kore",
});

console.log(
  JSON.stringify(
    {
      script,
      image,
      tts,
    },
    null,
    2,
  ),
);
```

- [ ] **Step 2: Export review helper only by direct path**

Do not export `review.ts` from `packages/ai/src/prompts/index.ts`. It is a manual direct-run helper, not library API.

- [ ] **Step 3: Run manual prompt review**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected: prints JSON with `script`, `image`, and `tts` compiled prompt objects. Manually confirm:

- `script.messages[0].role` is `developer`.
- `script.schemaName` is `short_workflow_script_plan_v1`.
- `image.prompt` includes `vertical 9:16`.
- `image.prompt` includes the no embedded text guidance.
- `tts.prompt` includes `### DIRECTOR NOTES`.
- `tts.prompt` includes `### TRANSCRIPT`.

- [ ] **Step 4: Verify typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit manual review helper**

```bash
git add packages/ai/src/prompts/review.ts
git commit -m "chore: add prompt review helper"
```

---

## Task 8: Final Verification

**Files:**
- Verify only, no file edits expected.

- [ ] **Step 1: Run package typechecks**

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd packages/db typecheck
bun run --cwd apps/worker typecheck
```

Expected: every command exits with code `0`.

- [ ] **Step 2: Run manual prompt review**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected: JSON prints compiled script, image, and TTS prompts. Confirm the same bullets from Task 7 Step 3.

- [ ] **Step 3: Inspect prompt payload size risk**

Run:

```bash
bun packages/ai/src/prompts/review.ts | wc -c
```

Expected: output is comfortably below `64000` bytes for the sample prompt payloads.

- [ ] **Step 4: Check git diff scope**

Run:

```bash
git status --short
git diff --stat
```

Expected: only prompt-management implementation files are modified. Existing unrelated dirty files from earlier UI/API preview work may still be present; do not revert them.

- [ ] **Step 5: Final commit if any verification-only fixes were needed**

If Steps 1-4 required tiny fixes, commit only those prompt-management files:

```bash
git add packages/ai/src packages/db/src/queries/promptVersions.ts apps/worker/src/handlers/generateScript.ts apps/worker/src/handlers/generateSceneImage.ts apps/worker/src/handlers/generateSceneAudio.ts
git commit -m "fix: finish prompt management integration"
```

Skip this commit if there were no changes after Task 7.

---

## Self-Review Notes

- Spec coverage: local prompt registry, Structured Outputs, deterministic image/TTS prompt compilers, prompt history payloads, and no DB schema changes are covered.
- Test policy: this plan deliberately avoids new automated tests and test-suite runs per current `AGENTS.md`.
- Type consistency: `ProjectStyleContext`, prompt payload metadata, and prompt compiler names are introduced before worker integration tasks use them.
