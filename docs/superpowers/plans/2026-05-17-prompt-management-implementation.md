# Prompt Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the merged prompt-management design: a fixed `Tiny Mechanisms` channel preset with seed-based episode selection, Structured Outputs script planning, deterministic image/TTS prompt compilation, and reproducible `prompt_versions` payloads.

**Architecture:** Keep prompt registry and channel preset logic in `packages/ai`. Keep `apps/api` free of `@short-workflow/ai` by creating a pending Tiny Mechanisms project through the API, then let the worker choose the next unused seed during `generate_script`. Store preset/seed/style/fact metadata in existing `prompt_versions`; do not add database schema or external dependencies.

**Tech Stack:** Bun workspaces, TypeScript, Zod, React + TanStack Query, ElysiaJS, OpenAI Responses API Structured Outputs, Google GenAI image/TTS wrappers, Drizzle query helpers.

---

## MVP Validation Rule

`AGENTS.md` says not to add new automated tests or run test suites by default while the first local flow is still being built. This plan therefore uses typecheck and manual prompt review only.

Do not add new test files. Do not run `bun test` unless the user explicitly asks for tests.

---

## File Map

- Create: `packages/ai/src/prompts/types.ts`
  - Owns shared prompt template and compiled prompt payload helpers.
- Create: `packages/ai/src/prompts/presets/tinyMechanisms.ts`
  - Owns the `Tiny Mechanisms` channel bible, seed bank, seed parsing, seed selection, and role plan.
- Create: `packages/ai/src/prompts/scriptPlan.ts`
  - Owns the OpenAI Structured Outputs schema, script prompt compiler, parser, and semantic validation.
- Create: `packages/ai/src/prompts/imagePrompt.ts`
  - Owns deterministic scene image prompt compilation.
- Create: `packages/ai/src/prompts/ttsPrompt.ts`
  - Owns deterministic Gemini TTS prompt compilation.
- Create: `packages/ai/src/prompts/review.ts`
  - Owns manual prompt review output and is run by direct path only.
- Create: `packages/ai/src/prompts/index.ts`
  - Exports prompt registry modules except `review.ts`.
- Modify: `packages/ai/src/types.ts`
  - Adds preset-aware script generation types, style context, fact pack, metadata draft, and prompt metadata fields.
- Modify: `packages/ai/src/index.ts`
  - Exports the prompt registry.
- Modify: `packages/ai/src/openai.ts`
  - Replaces generic topic prompt with preset script compiler and Structured Outputs.
- Modify: `packages/ai/src/openaiImage.ts`
  - Adds prompt metadata to provider response metadata.
- Modify: `packages/ai/src/googleImage.ts`
  - Adds prompt metadata to provider response metadata.
- Modify: `packages/ai/src/googleTts.ts`
  - Sends compiled TTS prompt when provided.
- Modify: `packages/shared/src/api.ts`
  - Adds a Tiny Mechanisms project creation request schema.
- Modify: `apps/api/src/routes/projects.ts`
  - Adds `POST /projects/tiny-mechanisms`.
- Modify: `apps/web/src/features/projects/ProjectCreateForm.tsx`
  - Replaces custom title/topic form with fixed Tiny Mechanisms project creation UI.
- Modify: `apps/web/src/features/projects/hooks.ts`
  - Adds a mutation for the preset project endpoint.
- Modify: `apps/web/src/routes/index.tsx`
  - Hides internal preset topic strings from project cards.
- Modify: `packages/db/src/queries/promptVersions.ts`
  - Adds latest prompt version lookup.
- Modify: `apps/worker/src/handlers/generateScript.ts`
  - Chooses the next seed, compiles script prompt, stores payload, updates project title/topic, and replaces scenes.
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`
  - Compiles provider-ready image prompts using channel visual identity and latest style context.
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`
  - Compiles Gemini TTS prompts using channel voice identity and latest style context.

---

## Task 1: Add Prompt Registry Types And Tiny Mechanisms Preset

**Files:**
- Create: `packages/ai/src/prompts/types.ts`
- Create: `packages/ai/src/prompts/presets/tinyMechanisms.ts`
- Create: `packages/ai/src/prompts/index.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Create shared prompt types**

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

- [ ] **Step 2: Create the Tiny Mechanisms preset**

Create `packages/ai/src/prompts/presets/tinyMechanisms.ts`:

```ts
import type { GenerateScriptInput, ScriptScene } from "../../types";

export const TINY_MECHANISMS_PRESET_ID = "tiny_mechanisms" as const;
export const TINY_MECHANISMS_CHANNEL_NAME = "Tiny Mechanisms";
export const TINY_MECHANISMS_TOPIC_PREFIX = "tiny_mechanisms:";
export const TINY_MECHANISMS_PENDING_TOPIC = `${TINY_MECHANISMS_TOPIC_PREFIX}pending`;

export type TinyMechanismsSeed = {
  seedId: string;
  centralQuestion: string;
  everydayObjectOrPhenomenon: string;
  mechanismHint: string;
  visualMetaphor: string;
  riskLevel: "low";
};

export const TINY_MECHANISMS_SCENE_ROLES_BY_DURATION = {
  30: ["hook", "context", "point", "payoff", "cta"],
  45: ["hook", "context", "point", "point", "payoff", "cta"],
  60: ["hook", "context", "point", "point", "point", "payoff", "cta"],
} as const satisfies Record<
  GenerateScriptInput["targetDurationSeconds"],
  readonly ScriptScene["role"][]
>;

export const TINY_MECHANISMS_CHANNEL_BIBLE = [
  "Channel: Tiny Mechanisms.",
  "Promise: one everyday mystery explained in under 45 seconds.",
  "Audience: English-speaking curious general audience at middle-school knowledge level.",
  "Tone: clear, curious, precise, lightly dramatic, and never generic.",
  "Format: faceless 9:16 micro-documentary with generated images, narration, captions, and a loopable ending.",
  "Allowed topics: everyday object design, human perception, everyday physics, materials and chemistry, and small systems.",
  "Disallowed topics: medical advice, finance, legal advice, politics, war, crime, breaking news, public figures, dangerous instructions, children's characters, conspiracy framing, and unsupported claims.",
  "Captions: short mobile-readable beat summaries, not full narration paragraphs.",
  "Image direction: editorial documentary stills, macro details, object cutaways, symbolic diagrams-as-scenes, no embedded text, no logos, no UI, no public figures.",
  "Retention: first sentence must be understandable without context, payoff must answer the hook, final line must connect back to the opening idea.",
].join("\\n");

export const TINY_MECHANISMS_SEEDS: TinyMechanismsSeed[] = [
  {
    seedId: "recorded_voice",
    centralQuestion: "Why your recorded voice sounds wrong",
    everydayObjectOrPhenomenon: "a recorded human voice",
    mechanismHint: "Bone conduction makes your own voice sound deeper to you than it sounds through air to everyone else.",
    visualMetaphor: "sound waves traveling through a translucent skull and through open air",
    riskLevel: "low",
  },
  {
    seedId: "round_airplane_windows",
    centralQuestion: "Why airplane windows are round",
    everydayObjectOrPhenomenon: "airplane windows",
    mechanismHint: "Rounded corners spread stress more evenly than sharp corners in a pressurized cabin.",
    visualMetaphor: "stress lines flowing smoothly around a round airplane window",
    riskLevel: "low",
  },
  {
    seedId: "onion_tears",
    centralQuestion: "Why onions make your eyes water",
    everydayObjectOrPhenomenon: "cut onions",
    mechanismHint: "Cut onion cells release compounds that react into an eye-irritating gas.",
    visualMetaphor: "microscopic onion cells releasing a faint vapor toward an eye silhouette",
    riskLevel: "low",
  },
  {
    seedId: "cold_batteries",
    centralQuestion: "Why batteries drain faster in the cold",
    everydayObjectOrPhenomenon: "batteries in cold weather",
    mechanismHint: "Cold slows the chemical reactions that move charge through the battery.",
    visualMetaphor: "a frosted battery cross-section with sluggish glowing particles",
    riskLevel: "low",
  },
  {
    seedId: "microwave_cold_spots",
    centralQuestion: "Why microwave ovens leave cold spots",
    everydayObjectOrPhenomenon: "microwave heating",
    mechanismHint: "Standing wave patterns create hot and cold zones unless food moves through them.",
    visualMetaphor: "invisible wave bands crossing a plate with alternating warm and cold patches",
    riskLevel: "low",
  },
  {
    seedId: "damaged_qr_codes",
    centralQuestion: "Why QR codes still work when scratched",
    everydayObjectOrPhenomenon: "damaged QR codes",
    mechanismHint: "QR codes include error correction so missing pieces can be reconstructed.",
    visualMetaphor: "a torn QR code still forming a readable square pattern",
    riskLevel: "low",
  },
  {
    seedId: "zipper_locking",
    centralQuestion: "Why zippers lock instead of sliding open",
    everydayObjectOrPhenomenon: "zippers",
    mechanismHint: "The slider forces interlocking teeth together at precise angles so tension holds them in place.",
    visualMetaphor: "macro zipper teeth interlocking like tiny hooks under the slider",
    riskLevel: "low",
  },
  {
    seedId: "soap_bubbles_round",
    centralQuestion: "Why soap bubbles are round",
    everydayObjectOrPhenomenon: "soap bubbles",
    mechanismHint: "Surface tension pulls the film into the smallest possible area for the trapped air.",
    visualMetaphor: "a soap film tightening into a sphere with rainbow highlights",
    riskLevel: "low",
  },
  {
    seedId: "mirror_flip",
    centralQuestion: "Why mirrors appear to flip left and right",
    everydayObjectOrPhenomenon: "mirrors",
    mechanismHint: "Mirrors reverse depth, not left and right; the apparent flip comes from how people imagine turning around.",
    visualMetaphor: "a person silhouette and reflected axes showing front-back reversal",
    riskLevel: "low",
  },
  {
    seedId: "noise_cancelling",
    centralQuestion: "Why noise-cancelling headphones work better on steady sounds",
    everydayObjectOrPhenomenon: "noise-cancelling headphones",
    mechanismHint: "Predictable low-frequency noise is easier to cancel with an opposite sound wave than sudden irregular noise.",
    visualMetaphor: "two opposite waveforms flattening into a quiet line around headphones",
    riskLevel: "low",
  },
  {
    seedId: "barcode_scanners",
    centralQuestion: "Why barcode scanners can read black and white stripes",
    everydayObjectOrPhenomenon: "barcodes",
    mechanismHint: "The scanner measures reflected light differences and decodes the stripe widths into numbers.",
    visualMetaphor: "a red scanning beam turning stripe widths into a digital number trail",
    riskLevel: "low",
  },
  {
    seedId: "credit_card_chips",
    centralQuestion: "Why credit card chips are safer than magnetic stripes",
    everydayObjectOrPhenomenon: "credit card chips",
    mechanismHint: "Chip cards can create transaction-specific data instead of exposing one reusable magnetic pattern.",
    visualMetaphor: "a card chip creating a one-time glowing key beside a faded magnetic stripe",
    riskLevel: "low",
  },
  {
    seedId: "autofocus_sharpness",
    centralQuestion: "Why autofocus can tell an image is sharp",
    everydayObjectOrPhenomenon: "camera autofocus",
    mechanismHint: "Autofocus looks for contrast and phase alignment to decide when edges are crisp.",
    visualMetaphor: "a camera sensor locking onto a crisp edge after a blurred edge",
    riskLevel: "low",
  },
  {
    seedId: "popcorn_pops",
    centralQuestion: "Why popcorn kernels pop",
    everydayObjectOrPhenomenon: "popcorn",
    mechanismHint: "Water inside the kernel turns to steam until pressure ruptures the shell and expands the starch.",
    visualMetaphor: "a popcorn kernel cross-section building steam pressure",
    riskLevel: "low",
  },
  {
    seedId: "ice_floats",
    centralQuestion: "Why ice floats instead of sinking",
    everydayObjectOrPhenomenon: "ice cubes",
    mechanismHint: "Water expands as it freezes into an open crystal structure, making ice less dense.",
    visualMetaphor: "open crystal lattice inside a floating ice cube",
    riskLevel: "low",
  },
  {
    seedId: "thermos_insulation",
    centralQuestion: "Why a thermos keeps drinks hot or cold",
    everydayObjectOrPhenomenon: "a thermos",
    mechanismHint: "A vacuum layer slows heat transfer by removing most conduction and convection paths.",
    visualMetaphor: "a thermos cross-section with heat arrows blocked by a vacuum gap",
    riskLevel: "low",
  },
];

export function encodeTinyMechanismsTopic(seedId: string) {
  return `${TINY_MECHANISMS_TOPIC_PREFIX}${seedId}`;
}

export function parseTinyMechanismsSeedId(topic: string): string | null {
  if (!topic.startsWith(TINY_MECHANISMS_TOPIC_PREFIX)) {
    return null;
  }

  return topic.slice(TINY_MECHANISMS_TOPIC_PREFIX.length);
}

export function getTinyMechanismsSeed(seedId: string) {
  return TINY_MECHANISMS_SEEDS.find((seed) => seed.seedId === seedId) ?? null;
}

export function pickNextTinyMechanismsSeed(usedSeedIds: Iterable<string>) {
  const used = new Set(usedSeedIds);
  const seed = TINY_MECHANISMS_SEEDS.find((candidate) => !used.has(candidate.seedId));

  if (!seed) {
    throw new Error("tiny_mechanisms_seed_bank_exhausted");
  }

  return seed;
}

export function tinyMechanismsProjectTitle(seed: TinyMechanismsSeed) {
  return `Tiny Mechanisms: ${seed.centralQuestion}`;
}
```

- [ ] **Step 3: Export prompt modules**

Create `packages/ai/src/prompts/index.ts`:

```ts
export * from "./types";
export * from "./presets/tinyMechanisms";
```

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

- [ ] **Step 4: Verify prompt preset types**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit prompt preset scaffolding**

```bash
git add packages/ai/src/prompts packages/ai/src/index.ts
git commit -m "feat: add tiny mechanisms prompt preset"
```

---

## Task 2: Add Fixed Preset Project Creation Flow

**Files:**
- Modify: `packages/shared/src/api.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/web/src/features/projects/hooks.ts`
- Modify: `apps/web/src/features/projects/ProjectCreateForm.tsx`
- Modify: `apps/web/src/routes/index.tsx`

- [ ] **Step 1: Add a preset creation request schema**

In `packages/shared/src/api.ts`, add this after `createProjectRequestSchema`:

```ts
export const createTinyMechanismsProjectRequestSchema = z
  .object({
    targetDurationSeconds: durationPresetSecondsSchema.default(DEFAULT_TARGET_DURATION_SECONDS),
  })
  .strict();
```

Add this type export near the existing request types:

```ts
export type CreateTinyMechanismsProjectRequest = z.infer<
  typeof createTinyMechanismsProjectRequestSchema
>;
```

- [ ] **Step 2: Add the API endpoint without importing `@short-workflow/ai`**

In `apps/api/src/routes/projects.ts`, import the new schema:

```ts
import {
  createProjectRequestSchema,
  createTinyMechanismsProjectRequestSchema,
  updateProjectRequestSchema,
  updateSceneRequestSchema,
} from "@short-workflow/shared";
```

Add this route inside the `/projects` group after `.post("/")` and before any `/:projectId` route:

```ts
        .post("/tiny-mechanisms", (context) => {
          const { body, db, set } = withRouteContext(context);
          const result = createTinyMechanismsProjectRequestSchema.safeParse(body ?? {});

          if (!result.success) {
            return validationFailed(set, result.error);
          }

          return services.createProject(db, {
            title: "Tiny Mechanisms Episode",
            topic: "tiny_mechanisms:pending",
            targetDurationSeconds: result.data.targetDurationSeconds,
          });
        })
```

Do not add `@short-workflow/ai` to `apps/api/package.json`.

- [ ] **Step 3: Add a preset create mutation**

In `apps/web/src/features/projects/hooks.ts`, import the new type:

```ts
import type {
  CreateProjectRequest,
  CreateTinyMechanismsProjectRequest,
  Job,
  Project,
  ProjectDetailResponse,
  Scene,
  UpdateSceneRequest,
} from "@short-workflow/shared";
```

Add this hook after `useCreateProjectMutation`:

```ts
export function useCreateTinyMechanismsProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTinyMechanismsProjectRequest) =>
      apiFetch<Project>("/projects/tiny-mechanisms", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}
```

- [ ] **Step 4: Replace custom title/topic UI with a fixed preset form**

In `apps/web/src/features/projects/ProjectCreateForm.tsx`, remove `react-hook-form`, `zodResolver`, `CreateProjectRequest`, and `createProjectRequestSchema` usage. Keep the duration segmented control and submit a fixed preset request.

Use this component shape:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { useCreateTinyMechanismsProjectMutation } from "./hooks";

const DURATION_OPTIONS = [30, 45, 60] as const;

export function ProjectCreateForm() {
  const navigate = useNavigate();
  const createProject = useCreateTinyMechanismsProjectMutation();
  const [selectedDuration, setSelectedDuration] = useState<(typeof DURATION_OPTIONS)[number]>(45);

  return (
    <form
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        const project = await createProject.mutateAsync({
          targetDurationSeconds: selectedDuration,
        });
        await navigate({
          params: { projectId: project.id },
          to: "/projects/$projectId",
        });
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Tiny Mechanisms</h2>
          <p className="text-sm text-muted-foreground">Create one everyday mystery explainer.</p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createProject.isPending}
          type="submit"
        >
          {createProject.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Create
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-md border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
            Hidden mechanics of everyday things
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            The app will pick the next unused episode seed and generate an English faceless short.
          </p>
        </div>

        <div className="grid gap-1">
          <span className="text-sm font-medium">Target duration</span>
          <div className="inline-grid grid-cols-3 rounded-md border border-border bg-background p-1">
            {DURATION_OPTIONS.map((duration) => (
              <button
                className={cn(
                  "h-8 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  selectedDuration === duration &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
                key={duration}
                onClick={() => setSelectedDuration(duration)}
                type="button"
              >
                {duration}s
              </button>
            ))}
          </div>
        </div>

        {createProject.error ? (
          <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            Project creation failed. Check the API and try again.
          </p>
        ) : null}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Hide internal preset topic strings in project cards**

In `apps/web/src/routes/index.tsx`, add:

```tsx
function projectDescription(topic: string) {
  return topic.startsWith("tiny_mechanisms:")
    ? "Tiny Mechanisms episode"
    : topic;
}
```

Then replace:

```tsx
{project.topic}
```

with:

```tsx
{projectDescription(project.topic)}
```

- [ ] **Step 6: Verify API and web typecheck**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/web typecheck
```

Expected: all commands exit with code `0`.

- [ ] **Step 7: Commit fixed preset project creation**

```bash
git add packages/shared/src/api.ts apps/api/src/routes/projects.ts apps/web/src/features/projects/hooks.ts apps/web/src/features/projects/ProjectCreateForm.tsx apps/web/src/routes/index.tsx
git commit -m "feat: add tiny mechanisms project flow"
```

---

## Task 3: Add Preset-Aware Script Plan Compiler

**Files:**
- Modify: `packages/ai/src/types.ts`
- Create: `packages/ai/src/prompts/scriptPlan.ts`

- [ ] **Step 1: Extend AI script generation types**

Replace `packages/ai/src/types.ts` with this shape while preserving `ImageProvider`, image output, and audio output exports:

```ts
export type ChannelPresetId = "tiny_mechanisms";

export type ProjectStyleContext = {
  visualStyle: string;
  tone: string;
  pacing: string;
  colorAndLighting: string;
  imageContinuity: string;
  voiceDirection: string;
};

export type ScriptEpisode = {
  seedId: string;
  workingTitle: string;
  centralQuestion: string;
  viewerCuriosity: string;
  mechanismSummary: string;
  payoff: string;
  riskFlags: string[];
};

export type ScriptFactPack = {
  coreMechanism: string;
  supportingFacts: string[];
  simpleAnalogy: string;
  commonMisconception: string;
  doNotSay: string[];
  needsHumanReview: boolean;
};

export type ScriptMetadataDraft = {
  youtubeTitle: string;
  description: string;
  hashtags: string[];
  disclosureHint: string;
};

export type ScriptScene = {
  position: number;
  role: "hook" | "context" | "point" | "payoff" | "cta";
  durationSeconds: number;
  narration: string;
  caption: string;
  imagePrompt: string;
  ssml: string;
  visualBrief: string;
  ttsDirection: string;
};

export type GenerateScriptInput = {
  channelPresetId: ChannelPresetId;
  seedId: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type GenerateScriptOutput = {
  title: string;
  channelPresetId: ChannelPresetId;
  episode: ScriptEpisode;
  styleContext: ProjectStyleContext;
  facts: ScriptFactPack;
  scenes: ScriptScene[];
  metadataDraft: ScriptMetadataDraft;
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

- [ ] **Step 2: Create the script prompt compiler**

Create `packages/ai/src/prompts/scriptPlan.ts` with:

```ts
import { z } from "zod";

import type { GenerateScriptInput, ProjectStyleContext, ScriptScene } from "../types";
import {
  getTinyMechanismsSeed,
  TINY_MECHANISMS_CHANNEL_BIBLE,
  TINY_MECHANISMS_PRESET_ID,
  TINY_MECHANISMS_SCENE_ROLES_BY_DURATION,
} from "./presets/tinyMechanisms";
import type { CompiledPrompt, PromptTemplate } from "./types";

const projectStyleContextSchema = z
  .object({
    visualStyle: z.string().min(1),
    tone: z.string().min(1),
    pacing: z.string().min(1),
    colorAndLighting: z.string().min(1),
    imageContinuity: z.string().min(1),
    voiceDirection: z.string().min(1),
  })
  .strict();

const scriptEpisodeSchema = z
  .object({
    seedId: z.string().min(1),
    workingTitle: z.string().min(1),
    centralQuestion: z.string().min(1),
    viewerCuriosity: z.string().min(1),
    mechanismSummary: z.string().min(1),
    payoff: z.string().min(1),
    riskFlags: z.array(z.string()),
  })
  .strict();

const scriptFactPackSchema = z
  .object({
    coreMechanism: z.string().min(1),
    supportingFacts: z.array(z.string().min(1)).min(1),
    simpleAnalogy: z.string().min(1),
    commonMisconception: z.string().min(1),
    doNotSay: z.array(z.string()),
    needsHumanReview: z.boolean(),
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
    visualBrief: z.string().min(1),
    ttsDirection: z.string().min(1),
  })
  .strict();

const metadataDraftSchema = z
  .object({
    youtubeTitle: z.string().min(1).max(100),
    description: z.string().min(1),
    hashtags: z.array(z.string().min(1)).min(1).max(5),
    disclosureHint: z.string().min(1),
  })
  .strict();

export const scriptPlanSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    episode: scriptEpisodeSchema,
    styleContext: projectStyleContextSchema,
    facts: scriptFactPackSchema,
    scenes: z.array(scriptSceneSchema),
    metadataDraft: metadataDraftSchema,
  })
  .strict();

export type ScriptPlan = z.infer<typeof scriptPlanSchema>;

export type CompiledScriptPlanPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_script_plan_v1";
  schemaVersion: 1;
};

export const SCRIPT_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "episode", "styleContext", "facts", "scenes", "metadataDraft"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    episode: {
      type: "object",
      additionalProperties: false,
      required: [
        "seedId",
        "workingTitle",
        "centralQuestion",
        "viewerCuriosity",
        "mechanismSummary",
        "payoff",
        "riskFlags",
      ],
      properties: {
        seedId: { type: "string" },
        workingTitle: { type: "string" },
        centralQuestion: { type: "string" },
        viewerCuriosity: { type: "string" },
        mechanismSummary: { type: "string" },
        payoff: { type: "string" },
        riskFlags: { type: "array", items: { type: "string" } },
      },
    },
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
    facts: {
      type: "object",
      additionalProperties: false,
      required: [
        "coreMechanism",
        "supportingFacts",
        "simpleAnalogy",
        "commonMisconception",
        "doNotSay",
        "needsHumanReview",
      ],
      properties: {
        coreMechanism: { type: "string" },
        supportingFacts: { type: "array", items: { type: "string" } },
        simpleAnalogy: { type: "string" },
        commonMisconception: { type: "string" },
        doNotSay: { type: "array", items: { type: "string" } },
        needsHumanReview: { type: "boolean" },
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
          "visualBrief",
          "ttsDirection",
        ],
        properties: {
          position: { type: "integer" },
          role: { type: "string", enum: ["hook", "context", "point", "payoff", "cta"] },
          durationSeconds: { type: "integer" },
          narration: { type: "string" },
          caption: { type: "string" },
          imagePrompt: { type: "string" },
          ssml: { type: "string" },
          visualBrief: { type: "string" },
          ttsDirection: { type: "string" },
        },
      },
    },
    metadataDraft: {
      type: "object",
      additionalProperties: false,
      required: ["youtubeTitle", "description", "hashtags", "disclosureHint"],
      properties: {
        youtubeTitle: { type: "string" },
        description: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        disclosureHint: { type: "string" },
      },
    },
  },
} as const;

export const scriptPlanPrompt: PromptTemplate<GenerateScriptInput, CompiledScriptPlanPrompt> = {
  id: "tiny_mechanisms_script_plan",
  version: 1,
  purpose: "script",
  provider: "openai",
  compile(input) {
    const seed = getTinyMechanismsSeed(input.seedId);
    if (!seed) {
      throw new Error("tiny_mechanisms_seed_not_found");
    }

    const roles = TINY_MECHANISMS_SCENE_ROLES_BY_DURATION[input.targetDurationSeconds];

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "tiny_mechanisms_script_plan_v1",
      schemaVersion: 1,
      modelParameters: {
        channelPresetId: input.channelPresetId,
        targetDurationSeconds: input.targetDurationSeconds,
        sceneRoles: roles,
      },
      metadata: {
        seed,
      },
      messages: [
        {
          role: "developer",
          content: [
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "Return production-ready JSON that follows the supplied schema.",
            "Do not invent a new topic. Use the selected seed exactly.",
            "Do not create medical, finance, legal, political, crime, disaster, public figure, or breaking-news content.",
            "All narration, captions, image prompt seeds, SSML, and metadata drafts must be English.",
            "The cta scene is a loop-ending slot, not a long subscribe call-to-action.",
            "Image prompt seeds must describe visual subject matter and must not ask for embedded text.",
            "SSML must use one <speak> root and speak the narration naturally.",
          ].join("\\n"),
        },
        {
          role: "user",
          content: [
            `<channel_preset_id>${input.channelPresetId}</channel_preset_id>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<scene_roles>${roles.join(", ")}</scene_roles>`,
            `<seed_id>${seed.seedId}</seed_id>`,
            `<central_question>${seed.centralQuestion}</central_question>`,
            `<everyday_object_or_phenomenon>${seed.everydayObjectOrPhenomenon}</everyday_object_or_phenomenon>`,
            `<mechanism_hint>${seed.mechanismHint}</mechanism_hint>`,
            `<visual_metaphor>${seed.visualMetaphor}</visual_metaphor>`,
            `Return exactly ${roles.length} scenes in this role order.`,
          ].join("\\n"),
        },
      ],
    };
  },
};

export function parseScriptPlan(
  value: unknown,
  input: GenerateScriptInput,
): ScriptPlan {
  const parsed = scriptPlanSchema.safeParse(value);
  const roles = TINY_MECHANISMS_SCENE_ROLES_BY_DURATION[input.targetDurationSeconds];

  if (!parsed.success || !hasExpectedScenePlan(parsed.data.scenes, roles)) {
    throw new Error("script_response_invalid");
  }

  if (parsed.data.episode.seedId !== input.seedId) {
    throw new Error("script_response_invalid");
  }

  const totalDuration = parsed.data.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(totalDuration - input.targetDurationSeconds) > 2) {
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
    visualStyle: "faceless editorial documentary stills with cinematic realism, macro details, object cutaways, and clear vertical composition",
    tone: "clear, curious, precise, lightly dramatic, and never generic",
    pacing: "brisk but intelligible short-form narration",
    colorAndLighting: "natural contrast, controlled highlights, grounded color, and mobile-readable subject separation",
    imageContinuity: "consistent documentary visual language across scenes with one concrete object-level detail per scene",
    voiceDirection: "warm documentary narrator with crisp articulation and a clean payoff",
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

- [ ] **Step 3: Verify script compiler typecheck**

Add the script compiler export to `packages/ai/src/prompts/index.ts`:

```ts
export * from "./types";
export * from "./presets/tinyMechanisms";
export * from "./scriptPlan";
```

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 4: Commit script compiler**

```bash
git add packages/ai/src/types.ts packages/ai/src/prompts/index.ts packages/ai/src/prompts/scriptPlan.ts
git commit -m "feat: add tiny mechanisms script compiler"
```

---

## Task 4: Use Structured Outputs In OpenAI Script Generation

**Files:**
- Modify: `packages/ai/src/openai.ts`

- [ ] **Step 1: Replace generic prompt imports**

At the top of `packages/ai/src/openai.ts`, use:

```ts
import OpenAI from "openai";

import {
  parseScriptPlan,
  SCRIPT_PLAN_JSON_SCHEMA,
  scriptPlanPrompt,
} from "./prompts/scriptPlan";
import { promptPayload } from "./prompts/types";
import type { GenerateScriptInput, GenerateScriptOutput } from "./types";
```

Remove the local Zod schemas, `sceneRolesByDuration`, `buildPrompt`, and `hasExpectedScenePlan`.

- [ ] **Step 2: Replace `generateScript`**

Use this implementation:

```ts
export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const client = new OpenAI({ apiKey });
  const compiled = scriptPlanPrompt.compile(input);

  const response = await client.responses.create({
    model,
    input: compiled.messages,
    text: {
      format: {
        type: "json_schema",
        name: compiled.schemaName,
        schema: SCRIPT_PLAN_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const rawResponseText = extractResponseText(response);
  const parsedJson = parseJsonObject(rawResponseText);
  const parsed = parseScriptPlan(parsedJson, input);

  return {
    title: parsed.episode.workingTitle,
    channelPresetId: parsed.channelPresetId,
    episode: parsed.episode,
    styleContext: parsed.styleContext,
    facts: parsed.facts,
    scenes: parsed.scenes,
    metadataDraft: parsed.metadataDraft,
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

- [ ] **Step 3: Keep response parsing helpers**

Keep `parseJsonObject`, `extractResponseText`, and `extractFinishReason` in `packages/ai/src/openai.ts`. `parseJsonObject` is only a string-to-object safety step because the Responses API returns `output_text` as text.

- [ ] **Step 4: Verify OpenAI wrapper typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 5: Commit structured script generation**

```bash
git add packages/ai/src/openai.ts
git commit -m "feat: use structured tiny mechanisms scripts"
```

---

## Task 5: Select Episode Seeds And Persist Script Prompt Payloads

**Files:**
- Modify: `packages/db/src/queries/promptVersions.ts`
- Modify: `apps/worker/src/handlers/generateScript.ts`

- [ ] **Step 1: Add latest prompt version lookup**

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

- [ ] **Step 2: Update script handler imports**

In `apps/worker/src/handlers/generateScript.ts`, replace imports with:

```ts
import {
  encodeTinyMechanismsTopic,
  generateScript,
  getTinyMechanismsSeed,
  parseTinyMechanismsSeedId,
  pickNextTinyMechanismsSeed,
  TINY_MECHANISMS_PENDING_TOPIC,
  TINY_MECHANISMS_PRESET_ID,
  tinyMechanismsProjectTitle,
} from "@short-workflow/ai";
import {
  getProject,
  insertPromptVersion,
  listProjects,
  markJobSucceeded,
  replaceProjectScenes,
  setProjectStatus,
  updateProject,
  type DbClient,
  type JobRow,
  type ProjectRow,
} from "@short-workflow/db";
```

- [ ] **Step 3: Add seed selection helpers**

Add these helpers above `handleGenerateScript`:

```ts
function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

async function resolveTinyMechanismsSeed(db: DbClient, project: ProjectRow) {
  const parsedSeedId = parseTinyMechanismsSeedId(project.topic);

  if (parsedSeedId && parsedSeedId !== "pending") {
    const existingSeed = getTinyMechanismsSeed(parsedSeedId);
    if (!existingSeed) {
      throw new Error("tiny_mechanisms_seed_not_found");
    }

    return existingSeed;
  }

  if (project.topic !== TINY_MECHANISMS_PENDING_TOPIC && parsedSeedId === null) {
    throw new Error("unsupported_project_prompt_preset");
  }

  const projects = await listProjects(db);
  const usedSeedIds = projects
    .filter((candidate) => candidate.id !== project.id)
    .map((candidate) => parseTinyMechanismsSeedId(candidate.topic))
    .filter((seedId): seedId is string => Boolean(seedId && seedId !== "pending"));

  return pickNextTinyMechanismsSeed(usedSeedIds);
}
```

- [ ] **Step 4: Replace the script handler body**

Inside `handleGenerateScript`, after loading `project`, replace the old `promptPayload` and `insertPromptVersion` flow with:

```ts
  const seed = await resolveTinyMechanismsSeed(db, project);
  const scriptInput = {
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    seedId: seed.seedId,
    targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
  };

  const script = await generateScript(scriptInput);
  const promptVersion = await insertPromptVersion(db, {
    projectId: project.id,
    sceneId: null,
    purpose: "script",
    provider: "openai",
    promptPayload: script.promptPayload,
    responseText: script.responseText,
    responseMetadata: script.responseMetadata,
  });
  const scenes = await replaceProjectScenes(db, project.id, script.scenes);

  await updateProject(db, project.id, {
    title: script.title || tinyMechanismsProjectTitle(seed),
    topic: encodeTinyMechanismsTopic(seed.seedId),
  });
  await setProjectStatus(db, project.id, "ready");
  await markJobSucceeded(db, job.id, {
    sceneIds: scenes.map((scene) => scene.id),
    promptVersionId: promptVersion.id,
    seedId: seed.seedId,
    channelPresetId: script.channelPresetId,
    metadataDraft: script.metadataDraft,
  });
```

- [ ] **Step 5: Verify worker and DB typecheck**

Run:

```bash
bun run --cwd packages/db typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 6: Commit script persistence**

```bash
git add packages/db/src/queries/promptVersions.ts apps/worker/src/handlers/generateScript.ts
git commit -m "feat: persist tiny mechanisms script prompts"
```

---

## Task 6: Add Image Prompt Compiler And Wire Image Jobs

**Files:**
- Create: `packages/ai/src/prompts/imagePrompt.ts`
- Modify: `packages/ai/src/openaiImage.ts`
- Modify: `packages/ai/src/googleImage.ts`
- Modify: `apps/worker/src/handlers/generateSceneImage.ts`

- [ ] **Step 1: Create deterministic image prompt compiler**

Create `packages/ai/src/prompts/imagePrompt.ts`:

```ts
import type { ImageProvider, ProjectStyleContext } from "../types";
import { defaultProjectStyleContext } from "./scriptPlan";
import type { CompiledPrompt, PromptTemplate } from "./types";

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
  id: "tiny_mechanisms_scene_image_prompt",
  version: 1,
  purpose: "image_prompt",
  provider: "openai",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const prompt = [
      "Create a vertical 9:16 editorial documentary image for a short-form science explainer.",
      `Project: ${input.project.title}.`,
      `Scene ${input.scene.position} role: ${input.scene.role}.`,
      `Scene duration: ${input.scene.durationSeconds} seconds.`,
      `Specific subject and action: ${input.scene.imagePrompt}.`,
      `Narration context: ${input.scene.narration}.`,
      `Caption context only, do not render this as text: ${input.scene.caption}.`,
      `Visual style: ${style.visualStyle}.`,
      `Continuity: ${style.imageContinuity}.`,
      `Tone: ${style.tone}.`,
      `Color and lighting: ${style.colorAndLighting}.`,
      "Use strong vertical framing, clear subject hierarchy, macro details or object cutaways when useful, and realistic depth.",
      "Do not include text, captions, watermarks, logos, UI, public figures, fake screenshots, or misleading depictions of real events.",
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

- [ ] **Step 2: Add prompt metadata to image provider responses**

In both `packages/ai/src/openaiImage.ts` and `packages/ai/src/googleImage.ts`, add `prompt_metadata: input.promptMetadata` to returned `responseMetadata`.

OpenAI response metadata should include:

```ts
prompt_metadata: input.promptMetadata,
```

Gemini response metadata should include:

```ts
prompt_metadata: input.promptMetadata,
```

- [ ] **Step 3: Wire image handler to compiled prompts**

In `apps/worker/src/handlers/generateSceneImage.ts`, import:

```ts
import {
  generateImage,
  imagePromptTemplate,
  promptPayload,
  resolveImageProvider,
  styleContextFromScriptResponseText,
} from "@short-workflow/ai";
```

Add `getLatestPromptVersion` and `getProject` to the DB imports.

After loading `scene`, load project and latest script style:

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

Before calling `generateImage`, compile:

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

Replace the image `insertPromptVersion` payload with:

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

- [ ] **Step 4: Verify image prompt integration**

Add the image prompt export to `packages/ai/src/prompts/index.ts`:

```ts
export * from "./types";
export * from "./presets/tinyMechanisms";
export * from "./scriptPlan";
export * from "./imagePrompt";
```

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit image prompt integration**

```bash
git add packages/ai/src/prompts/index.ts packages/ai/src/prompts/imagePrompt.ts packages/ai/src/openaiImage.ts packages/ai/src/googleImage.ts apps/worker/src/handlers/generateSceneImage.ts
git commit -m "feat: compile tiny mechanisms image prompts"
```

---

## Task 7: Add TTS Prompt Compiler And Wire Audio Jobs

**Files:**
- Create: `packages/ai/src/prompts/ttsPrompt.ts`
- Modify: `packages/ai/src/googleTts.ts`
- Modify: `apps/worker/src/handlers/generateSceneAudio.ts`

- [ ] **Step 1: Create TTS prompt compiler**

Create `packages/ai/src/prompts/ttsPrompt.ts`:

```ts
import { speechTextFromSsml } from "../googleTts";
import type { ProjectStyleContext } from "../types";
import { defaultProjectStyleContext } from "./scriptPlan";
import type { CompiledPrompt, PromptTemplate } from "./types";

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
  id: "tiny_mechanisms_scene_tts_prompt",
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
        "Synthesize speech for this short-form educational narration. Do not read headings or instructions aloud.",
        "",
        "### AUDIO PROFILE",
        "Name: Tiny Mechanisms Narrator",
        `Voice: ${input.voiceName}`,
        `Role: ${style.voiceDirection}`,
        "",
        "### DIRECTOR NOTES",
        `Tone: ${style.tone}`,
        `Pace: ${style.pacing}`,
        `Scene role: ${input.scene.role}`,
        `Scene target duration: ${input.scene.durationSeconds} seconds`,
        "Energy: start hooks with urgency, settle into explanation, and land payoff lines cleanly.",
        "Pauses: use brief natural pauses after hooks and before payoffs. Preserve proper nouns exactly as written.",
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

- [ ] **Step 2: Update Google TTS input type and prompt selection**

In `packages/ai/src/googleTts.ts`, replace the local `GenerateSpeechInput` type import with:

```ts
import type { GenerateAudioInput, GenerateAudioOutput } from "./types";
```

Change both function signatures to use `GenerateAudioInput`.

Replace:

```ts
  const prompt = `Read the following transcript naturally for a short-form video narration:\n\n${narrationText}`;
```

with:

```ts
  const prompt =
    input.prompt ??
    `Synthesize speech for this short-form video narration.\n\n### TRANSCRIPT\n${narrationText}`;
```

Add this to response metadata:

```ts
prompt_metadata: input.promptMetadata,
```

- [ ] **Step 3: Wire audio handler to compiled prompts**

In `apps/worker/src/handlers/generateSceneAudio.ts`, import:

```ts
import {
  generateSpeech,
  promptPayload,
  styleContextFromScriptResponseText,
  ttsPromptTemplate,
} from "@short-workflow/ai";
```

Add `getLatestPromptVersion` to the DB imports.

After loading `scene`, add:

```ts
  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);
```

Before calling `generateSpeech`, compile:

```ts
    const voiceName = process.env.GEMINI_TTS_VOICE ?? "Kore";
    const compiledPrompt = ttsPromptTemplate.compile({
      scene,
      voiceName,
      styleContext,
    });

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

Replace the audio `insertPromptVersion` payload with:

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

- [ ] **Step 4: Verify TTS integration**

Add the TTS prompt export to `packages/ai/src/prompts/index.ts`:

```ts
export * from "./types";
export * from "./presets/tinyMechanisms";
export * from "./scriptPlan";
export * from "./imagePrompt";
export * from "./ttsPrompt";
```

Run:

```bash
bun run --cwd packages/ai typecheck
bun run --cwd apps/worker typecheck
```

Expected: both commands exit with code `0`.

- [ ] **Step 5: Commit TTS prompt integration**

```bash
git add packages/ai/src/prompts/index.ts packages/ai/src/prompts/ttsPrompt.ts packages/ai/src/googleTts.ts apps/worker/src/handlers/generateSceneAudio.ts
git commit -m "feat: compile tiny mechanisms narration prompts"
```

---

## Task 8: Add Manual Prompt Review Helper

**Files:**
- Create: `packages/ai/src/prompts/review.ts`

- [ ] **Step 1: Create direct-run review helper**

Create `packages/ai/src/prompts/review.ts`:

```ts
import { imagePromptTemplate } from "./imagePrompt";
import { getTinyMechanismsSeed, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";
import { ttsPromptTemplate } from "./ttsPrompt";

const seed = getTinyMechanismsSeed("recorded_voice");
if (!seed) {
  throw new Error("review_seed_missing");
}

const script = scriptPlanPrompt.compile({
  channelPresetId: TINY_MECHANISMS_PRESET_ID,
  seedId: seed.seedId,
  targetDurationSeconds: 45,
});

const sampleProject = {
  id: "review-project",
  title: `Tiny Mechanisms: ${seed.centralQuestion}`,
  topic: `tiny_mechanisms:${seed.seedId}`,
};

const sampleScene = {
  id: "review-scene",
  position: 1,
  role: "hook" as const,
  durationSeconds: 3,
  narration: "Your recorded voice is not lying to you. Your skull is.",
  caption: "Your skull changes your voice.",
  imagePrompt: seed.visualMetaphor,
  ssml: "<speak>Your recorded voice is not lying to you. Your skull is.</speak>",
};

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

Do not export `review.ts` from `packages/ai/src/prompts/index.ts`.

- [ ] **Step 2: Run manual prompt review**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected: prints JSON with `script`, `image`, and `tts` compiled prompt objects. Manually confirm:

- `script.messages[0].role` is `developer`.
- `script.schemaName` is `tiny_mechanisms_script_plan_v1`.
- `script.messages` include `Tiny Mechanisms`.
- `image.prompt` includes `vertical 9:16`.
- `image.prompt` includes no embedded text guidance.
- `tts.prompt` includes `### DIRECTOR NOTES`.
- `tts.prompt` includes `### TRANSCRIPT`.

- [ ] **Step 3: Verify typecheck**

Run:

```bash
bun run --cwd packages/ai typecheck
```

Expected: exits with code `0`.

- [ ] **Step 4: Commit manual review helper**

```bash
git add packages/ai/src/prompts/review.ts
git commit -m "chore: add tiny mechanisms prompt review helper"
```

---

## Task 9: Final Verification

**Files:**
- Verify only, no file edits expected.

- [ ] **Step 1: Run package typechecks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd packages/ai typecheck
bun run --cwd packages/db typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/web typecheck
bun run --cwd apps/worker typecheck
```

Expected: every command exits with code `0`.

- [ ] **Step 2: Run manual prompt review**

Run:

```bash
bun packages/ai/src/prompts/review.ts
```

Expected: JSON prints compiled script, image, and TTS prompts. Confirm the same bullets from Task 8 Step 2.

- [ ] **Step 3: Inspect prompt payload size risk**

Run:

```bash
bun packages/ai/src/prompts/review.ts | wc -c
```

Expected: output is comfortably below `64000` bytes for the sample prompt payloads.

- [ ] **Step 4: Manual UI/API verification**

Run the API and web dev servers in separate terminals:

```bash
bun run dev:api
bun run dev:web
```

Expected manual checks:

- The create form shows `Tiny Mechanisms`, no title input, and no topic textarea.
- Creating a project calls `POST /projects/tiny-mechanisms`.
- The created project opens successfully.
- The project card does not show `tiny_mechanisms:pending`.
- `Generate script` can queue a `generate_script` job.

- [ ] **Step 5: Check git diff scope**

Run:

```bash
git status --short
git diff --stat
```

Expected: only prompt-management implementation files are modified.

- [ ] **Step 6: Final commit if verification fixes were needed**

If Steps 1-5 required tiny fixes, commit only those prompt-management files:

```bash
git add packages/ai/src packages/shared/src/api.ts packages/db/src/queries/promptVersions.ts apps/api/src/routes/projects.ts apps/web/src/features/projects apps/web/src/routes/index.tsx apps/worker/src/handlers/generateScript.ts apps/worker/src/handlers/generateSceneImage.ts apps/worker/src/handlers/generateSceneAudio.ts
git commit -m "fix: finish tiny mechanisms prompt integration"
```

Skip this commit if there were no changes after Task 8.

---

## Self-Review Notes

- Spec coverage: fixed `Tiny Mechanisms` preset, hidden custom topic/title UI, seed bank, channel bible, episode selection, fact pack, Structured Outputs, image/TTS prompt compilers, prompt history payloads, no DB schema changes, and manual validation are covered.
- Package boundaries: `apps/api` does not import `@short-workflow/ai`; seed selection runs in the worker where the AI package already exists.
- Test policy: this plan deliberately avoids new automated tests and test-suite runs per current `AGENTS.md`.
- Type consistency: `ChannelPresetId`, script episode/facts/metadata types, prompt compiler names, and provider metadata fields are introduced before worker integration tasks use them.
