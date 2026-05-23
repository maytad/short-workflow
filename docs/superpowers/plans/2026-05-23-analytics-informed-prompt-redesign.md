# Analytics-Informed Prompt Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace new Tiny Mechanisms static seed selection with a backend-owned, analytics-informed episode research pipeline and simplify project creation to one frontend action.

**Architecture:** Keep the existing single-user local architecture. `apps/web` only starts project creation, `apps/api` owns backend defaults, `apps/worker` orchestrates `generate_script`, `packages/ai` owns prompt schemas/OpenAI calls, and `packages/db` supplies recent analytics context without new schema in this first implementation.

**Tech Stack:** Bun workspaces, ElysiaJS, React + Vite, TanStack Query, Drizzle ORM, hosted Supabase Postgres, OpenAI Responses API, Remotion frame-based rendering.

---

## Planning Constraint

Per user request, this plan does not add automated test tasks and does not ask the implementation worker to run test suites while writing or executing the plan. Use manual verification only.

## Source Spec

Implement from:

`docs/superpowers/specs/2026-05-23-analytics-informed-prompt-redesign-design.md`

Keep these scope boundaries:

- No live web trend scraping in generation.
- No YouTube search automation or competitor crawling.
- No database migration in the first implementation.
- No automatic publishing or re-rendering decisions.
- No background music.
- No standalone subtitle export.
- Preserve legacy/static seed regeneration for existing projects.
- Preserve karaoke subtitle timing by deriving timing from final audio/transcript assets, not model-generated captions.

## File Structure

Create:

- `packages/ai/src/prompts/episodeResearch.ts` - episode candidate schemas, JSON schema, prompt compiler, parser, and analytics context types.
- `packages/ai/src/episodeResearch.ts` - OpenAI client wrapper for episode research using Responses API.

Modify:

- `packages/ai/src/types.ts` - extend script input with selected AI episode brief and prompt history fields.
- `packages/ai/src/openai.ts` - support script generation from a selected AI episode brief and preserve combined prompt history.
- `packages/ai/src/prompts/scriptPlan.ts` - compile script prompts from either legacy static seed or selected AI episode brief; tighten 30-second hook-first rules.
- `packages/ai/src/prompts/imagePrompt.ts` - tighten first-frame hook image constraints.
- `packages/ai/src/prompts/presets/tinyMechanisms.ts` - add AI topic helpers and keep static seed helpers for legacy projects.
- `packages/shared/src/constants.ts` - add Tiny Mechanisms backend default duration.
- `packages/shared/src/api.ts` - make Tiny Mechanisms create request accept an empty body.
- `apps/api/src/routes/projects.ts` - apply Tiny Mechanisms backend default duration.
- `apps/web/src/features/projects/ProjectCreateForm.tsx` - remove duration selection and submit an empty body.
- `apps/web/src/features/projects/hooks.ts` - make Tiny Mechanisms create mutation body optional/empty.
- `packages/db/src/queries/youtubeAnalytics.ts` - expose compact recent creative analytics context for prompt generation.
- `apps/worker/src/handlers/generateScript.ts` - branch pending projects into AI episode research, keep legacy explicit seed flow, and store combined prompt payload.

Do not modify:

- `apps/render/src/Captions.tsx` unless manual verification exposes a subtitle issue.
- database migrations.
- `prompt_purpose` enum.

## Task 1: Backend-Owned Tiny Mechanisms Defaults

**Files:**

- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `apps/api/src/routes/projects.ts`

- [ ] **Step 1: Add a Tiny Mechanisms default duration constant**

In `packages/shared/src/constants.ts`, add this next to `DEFAULT_TARGET_DURATION_SECONDS`:

```ts
export const DEFAULT_TARGET_DURATION_SECONDS = 45;
export const TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS = 30;
export const DEFAULT_WORKER_CONCURRENCY = 2;
```

- [ ] **Step 2: Make the Tiny Mechanisms create schema accept an empty body**

In `packages/shared/src/api.ts`, update the constants import:

```ts
import {
  DEFAULT_TARGET_DURATION_SECONDS,
  TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS,
} from "./constants";
```

Replace `createTinyMechanismsProjectRequestSchema` with:

```ts
export const createTinyMechanismsProjectRequestSchema = z
  .object({
    targetDurationSeconds: durationPresetSecondsSchema
      .default(TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS)
      .optional(),
  })
  .strict()
  .transform((input) => ({
    targetDurationSeconds:
      input.targetDurationSeconds ?? TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS,
  }));
```

This keeps old callers that send `targetDurationSeconds` working, while allowing the frontend to send `{}`.

- [ ] **Step 3: Keep the API route backend-owned**

In `apps/api/src/routes/projects.ts`, keep the existing route shape but rely on the parsed default:

```ts
.post("/tiny-mechanisms", (context) => {
  const { body, db, set } = withRouteContext(context);
  const result = createTinyMechanismsProjectRequestSchema.safeParse(body ?? {});

  if (!result.success) {
    return validationFailed(set, result.error);
  }

  return services.createProject(db, {
    title: TINY_MECHANISMS_PENDING_TITLE,
    topic: TINY_MECHANISMS_PENDING_TOPIC,
    targetDurationSeconds: result.data.targetDurationSeconds,
  });
})
```

- [ ] **Step 4: Commit backend default changes**

```bash
git add packages/shared/src/constants.ts packages/shared/src/api.ts apps/api/src/routes/projects.ts
git commit -m "feat: default tiny mechanisms project settings"
```

## Task 2: Simplify Project Creation UI

**Files:**

- Modify: `apps/web/src/features/projects/ProjectCreateForm.tsx`
- Modify: `apps/web/src/features/projects/hooks.ts`

- [ ] **Step 1: Make the Tiny Mechanisms mutation accept no input**

In `apps/web/src/features/projects/hooks.ts`, replace `useCreateTinyMechanismsProjectMutation` with:

```ts
export function useCreateTinyMechanismsProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Project>("/projects/tiny-mechanisms", {
        body: JSON.stringify({}),
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}
```

- [ ] **Step 2: Remove duration state and unused imports**

In `apps/web/src/features/projects/ProjectCreateForm.tsx`, replace the imports with:

```tsx
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Sparkles } from "lucide-react";

import { useCreateTinyMechanismsProjectMutation } from "./hooks";
```

Remove:

```tsx
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/utils";

const DURATION_OPTIONS = [30, 45, 60] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];
const [selectedDuration, setSelectedDuration] = useState<DurationOption>(45);
```

- [ ] **Step 3: Submit an empty backend-owned creation request**

In `ProjectCreateForm`, replace the `createProject.mutate(...)` call with:

```tsx
createProject.mutate(undefined, {
  onSuccess: (project) => {
    void navigate({
      params: { projectId: project.id },
      to: "/projects/$projectId",
    });
  },
});
```

- [ ] **Step 4: Delete the duration segmented control markup**

Remove the whole block beginning with:

```tsx
<div className="grid gap-2">
  <span className="text-sm font-medium" id="target-duration-label">
    Target duration
  </span>
```

and ending with the closing `</div>` that wraps the mapped `DURATION_OPTIONS`.

Keep the preset description and create button.

- [ ] **Step 5: Adjust the user-facing copy**

Use this paragraph in `ProjectCreateForm`:

```tsx
<p className="mt-1 text-sm leading-6 text-muted-foreground">
  Create a backend-optimized English short about a small physical mechanism, then generate
  the script, scenes, images, voice, and render.
</p>
```

- [ ] **Step 6: Commit UI simplification**

```bash
git add apps/web/src/features/projects/ProjectCreateForm.tsx apps/web/src/features/projects/hooks.ts
git commit -m "feat: simplify tiny mechanisms project creation"
```

## Task 3: Add AI Topic Helpers

**Files:**

- Modify: `packages/ai/src/prompts/presets/tinyMechanisms.ts`

- [ ] **Step 1: Add the AI topic prefix**

Near the existing topic constants, add:

```ts
export const TINY_MECHANISMS_AI_TOPIC_PREFIX = `${TINY_MECHANISMS_TOPIC_PREFIX}ai:`;
```

- [ ] **Step 2: Add helper functions for AI-generated topic identities**

Near `encodeTinyMechanismsTopic`, add:

```ts
export function slugifyTinyMechanismsAiTopic(input: string) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return slug || "episode";
}

export function encodeTinyMechanismsAiTopic(slug: string) {
  return `${TINY_MECHANISMS_AI_TOPIC_PREFIX}${slugifyTinyMechanismsAiTopic(slug)}`;
}

export function parseTinyMechanismsAiTopicSlug(topic: string): string | null {
  if (!topic.startsWith(TINY_MECHANISMS_AI_TOPIC_PREFIX)) {
    return null;
  }

  return topic.slice(TINY_MECHANISMS_AI_TOPIC_PREFIX.length) || null;
}
```

- [ ] **Step 3: Commit AI topic helpers**

```bash
git add packages/ai/src/prompts/presets/tinyMechanisms.ts
git commit -m "feat: add tiny mechanisms ai topic helpers"
```

## Task 4: Add Episode Research Prompt

**Files:**

- Create: `packages/ai/src/prompts/episodeResearch.ts`
- Modify: `packages/ai/src/prompts/index.ts`

- [ ] **Step 1: Create `episodeResearch.ts` with schemas and types**

Create `packages/ai/src/prompts/episodeResearch.ts`:

```ts
import { z } from "zod";

import { TINY_MECHANISMS_CHANNEL_BIBLE, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import type { CompiledPrompt, PromptTemplate } from "./types";

export const recentVideoPromptContextSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
    title: z.string().min(1),
    views: z.number().nullable(),
    engagedViews: z.number().nullable(),
    averageViewPercentage: z.number().nullable(),
    averageViewDurationSeconds: z.number().nullable(),
    viewsPerHour: z.number().nullable(),
    likeRate: z.number().nullable(),
    hookNarration: z.string().nullable(),
    hookCaption: z.string().nullable(),
    hookImagePrompt: z.string().nullable(),
  })
  .strict();

export const episodeCandidateScoreSchema = z
  .object({
    feedClarity: z.number().int().min(1).max(5),
    swipeResistance: z.number().int().min(1).max(5),
    broadAppeal: z.number().int().min(1).max(5),
    visualNovelty: z.number().int().min(1).max(5),
    retentionPath: z.number().int().min(1).max(5),
    repeatRisk: z.number().int().min(1).max(5),
  })
  .strict();

export const episodeCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    objectOrMechanism: z.string().min(1),
    centralQuestion: z.string().min(1),
    firstFrame: z.string().min(1),
    firstLine: z.string().min(1),
    firstThreeWords: z.string().min(1),
    feedHypothesis: z.string().min(1),
    swipeRisk: z.enum(["low", "medium", "high"]),
    broadAudienceReason: z.string().min(1),
    retentionPromise: z.string().min(1),
    titleCuriosityGap: z.string().min(1),
    mechanismProof: z.string().min(1),
    visualReveal: z.string().min(1),
    loopPayoff: z.string().min(1),
    whyThisCanBeatRecentVideos: z.string().min(1),
    scores: episodeCandidateScoreSchema,
  })
  .strict();

export const episodeResearchSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    candidates: z.array(episodeCandidateSchema).length(5),
    selectedCandidateId: z.string().min(1),
    selectionRationale: z.string().min(1),
  })
  .strict()
  .refine(
    (value) => value.candidates.some((candidate) => candidate.candidateId === value.selectedCandidateId),
    "selected_candidate_missing",
  );

export type RecentVideoPromptContext = z.infer<typeof recentVideoPromptContextSchema>;
export type EpisodeCandidate = z.infer<typeof episodeCandidateSchema>;
export type EpisodeResearch = z.infer<typeof episodeResearchSchema>;

export type EpisodeResearchInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  recentVideos: RecentVideoPromptContext[];
};

export type CompiledEpisodeResearchPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_episode_research_v1";
  schemaVersion: 1;
};
```

- [ ] **Step 2: Add the JSON schema**

In the same file, add:

```ts
const nullableNumberSchema = { anyOf: [{ type: "number" }, { type: "null" }] } as const;
const nullableStringSchema = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

export const EPISODE_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "candidates", "selectedCandidateId", "selectionRationale"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    candidates: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "candidateId",
          "objectOrMechanism",
          "centralQuestion",
          "firstFrame",
          "firstLine",
          "firstThreeWords",
          "feedHypothesis",
          "swipeRisk",
          "broadAudienceReason",
          "retentionPromise",
          "titleCuriosityGap",
          "mechanismProof",
          "visualReveal",
          "loopPayoff",
          "whyThisCanBeatRecentVideos",
          "scores",
        ],
        properties: {
          candidateId: { type: "string", minLength: 1 },
          objectOrMechanism: { type: "string", minLength: 1 },
          centralQuestion: { type: "string", minLength: 1 },
          firstFrame: { type: "string", minLength: 1 },
          firstLine: { type: "string", minLength: 1 },
          firstThreeWords: { type: "string", minLength: 1 },
          feedHypothesis: { type: "string", minLength: 1 },
          swipeRisk: { type: "string", enum: ["low", "medium", "high"] },
          broadAudienceReason: { type: "string", minLength: 1 },
          retentionPromise: { type: "string", minLength: 1 },
          titleCuriosityGap: { type: "string", minLength: 1 },
          mechanismProof: { type: "string", minLength: 1 },
          visualReveal: { type: "string", minLength: 1 },
          loopPayoff: { type: "string", minLength: 1 },
          whyThisCanBeatRecentVideos: { type: "string", minLength: 1 },
          scores: {
            type: "object",
            additionalProperties: false,
            required: [
              "feedClarity",
              "swipeResistance",
              "broadAppeal",
              "visualNovelty",
              "retentionPath",
              "repeatRisk",
            ],
            properties: {
              feedClarity: { type: "integer", minimum: 1, maximum: 5 },
              swipeResistance: { type: "integer", minimum: 1, maximum: 5 },
              broadAppeal: { type: "integer", minimum: 1, maximum: 5 },
              visualNovelty: { type: "integer", minimum: 1, maximum: 5 },
              retentionPath: { type: "integer", minimum: 1, maximum: 5 },
              repeatRisk: { type: "integer", minimum: 1, maximum: 5 },
            },
          },
        },
      },
    },
    selectedCandidateId: { type: "string", minLength: 1 },
    selectionRationale: { type: "string", minLength: 1 },
  },
} as const;
```

- [ ] **Step 3: Add the prompt template**

In the same file, add:

```ts
export const episodeResearchPrompt: PromptTemplate<
  EpisodeResearchInput,
  CompiledEpisodeResearchPrompt
> = {
  id: "tiny_mechanisms_episode_research",
  version: 1,
  purpose: "script",
  provider: "openai",
  compile(input) {
    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "tiny_mechanisms_episode_research_v1",
      schemaVersion: 1,
      modelParameters: {
        channelPresetId: input.channelPresetId,
        targetDurationSeconds: input.targetDurationSeconds,
        candidateCount: 5,
      },
      metadata: {
        recentVideoCount: input.recentVideos.length,
      },
      messages: [
        {
          role: "developer",
          content: [
            "# Identity",
            "You are a YouTube Shorts creative strategist for Tiny Mechanisms.",
            "You generate episode candidates before scripts. You optimize for feed testing, first-frame clarity, stayed-to-watch, average view duration, average percentage viewed, and swipe resistance.",
            "",
            "# Channel",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "",
            "# Task",
            "Do not write the final script.",
            "Generate exactly 5 episode candidates for a 30-second English YouTube Short.",
            "Each candidate must start with a first frame that can be understood with sound off in under 0.5 seconds.",
            "Each first line must create curiosity in under 1 second.",
            "Prefer familiar everyday objects with visible physical motion, tension, resistance, release, cutting, sliding, snapping, bending, spraying, locking, or catching.",
            "Reject calm object portraits, abstract diagrams as hooks, medical advice, finance, legal, politics, crime, disaster, public figures, dangerous instructions, children's characters, and unsupported claims.",
            "Use low-performing recent videos as negative examples. Do not copy their topic shape, hook sentence shape, or first-frame composition.",
            "Use high-performing recent videos only as abstract patterns. Do not copy their object or wording.",
            "",
            "# Scoring",
            "Score each candidate from 1 to 5 for feedClarity, swipeResistance, broadAppeal, visualNovelty, retentionPath, and repeatRisk.",
            "For repeatRisk, 1 means low repeat risk and 5 means high repeat risk.",
            "Select exactly one candidate with the best balance of high feed clarity, high swipe resistance, high broad appeal, high visual novelty, high retention path, and low repeat risk.",
            "",
            "# Output",
            "Return JSON that follows the supplied schema.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `<channel_preset_id>${input.channelPresetId}</channel_preset_id>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<recent_videos_json>${JSON.stringify(input.recentVideos)}</recent_videos_json>`,
          ].join("\n"),
        },
      ],
    };
  },
};
```

- [ ] **Step 4: Add parser helpers**

In the same file, add:

```ts
export function parseEpisodeResearch(value: unknown): EpisodeResearch {
  const parsed = episodeResearchSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("episode_research_response_invalid");
  }

  const selected = selectedEpisodeCandidate(parsed.data);
  if (!selected) {
    throw new Error("episode_candidate_selection_failed");
  }

  return parsed.data;
}

export function selectedEpisodeCandidate(research: EpisodeResearch): EpisodeCandidate | null {
  return (
    research.candidates.find(
      (candidate) => candidate.candidateId === research.selectedCandidateId,
    ) ?? null
  );
}
```

- [ ] **Step 5: Export prompt module**

In `packages/ai/src/prompts/index.ts`, add:

```ts
export * from "./episodeResearch";
```

- [ ] **Step 6: Commit episode research prompt**

```bash
git add packages/ai/src/prompts/episodeResearch.ts packages/ai/src/prompts/index.ts
git commit -m "feat: add tiny mechanisms episode research prompt"
```

## Task 5: Add OpenAI Episode Research Client

**Files:**

- Create: `packages/ai/src/episodeResearch.ts`
- Modify: `packages/ai/src/index.ts`

- [ ] **Step 1: Create the client wrapper**

Create `packages/ai/src/episodeResearch.ts`:

```ts
import OpenAI from "openai";

import {
  EPISODE_RESEARCH_JSON_SCHEMA,
  episodeResearchPrompt,
  parseEpisodeResearch,
  selectedEpisodeCandidate,
  type EpisodeResearch,
  type EpisodeResearchInput,
} from "./prompts/episodeResearch";
import { promptPayload } from "./prompts/types";

type GenerateEpisodeResearchOutput = {
  research: EpisodeResearch;
  selectedCandidate: NonNullable<ReturnType<typeof selectedEpisodeCandidate>>;
  promptPayload: Record<string, unknown>;
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

export async function generateEpisodeResearch(
  input: EpisodeResearchInput,
): Promise<GenerateEpisodeResearchOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const client = new OpenAI({ apiKey });
  const compiled = episodeResearchPrompt.compile(input);

  const response = await client.responses.create({
    model,
    input: compiled.messages,
    reasoning: {
      effort: "xhigh",
    },
    text: {
      format: {
        type: "json_schema",
        name: compiled.schemaName,
        schema: EPISODE_RESEARCH_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const rawResponseText = extractResponseText(response);
  const research = parseEpisodeResearch(JSON.parse(rawResponseText));
  const selectedCandidate = selectedEpisodeCandidate(research);
  if (!selectedCandidate) {
    throw new Error("episode_candidate_selection_failed");
  }

  return {
    research,
    selectedCandidate,
    promptPayload: promptPayload(compiled, input),
    responseText: JSON.stringify(research),
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

function extractResponseText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  const chunks: string[] = [];
  for (const output of response.output ?? []) {
    if (output.type !== "message") {
      continue;
    }

    for (const content of output.content ?? []) {
      if (content.type === "output_text") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("").trim();
  if (!text) {
    throw new Error("episode_research_response_invalid");
  }

  return text;
}

function extractFinishReason(response: OpenAI.Responses.Response): string | undefined {
  for (const output of response.output ?? []) {
    if (output.type === "message" && typeof output.status === "string") {
      return output.status;
    }
  }

  return response.status;
}
```

- [ ] **Step 2: Export the client**

In `packages/ai/src/index.ts`, add:

```ts
export * from "./episodeResearch";
```

- [ ] **Step 3: Commit the client wrapper**

```bash
git add packages/ai/src/episodeResearch.ts packages/ai/src/index.ts
git commit -m "feat: generate tiny mechanisms episode research"
```

## Task 6: Extend Script Generation Input For AI Briefs

**Files:**

- Modify: `packages/ai/src/types.ts`
- Modify: `packages/ai/src/openai.ts`
- Modify: `packages/ai/src/prompts/scriptPlan.ts`

- [ ] **Step 1: Add selected candidate types to script input**

In `packages/ai/src/types.ts`, import the candidate type:

```ts
import type { EpisodeCandidate, EpisodeResearch } from "./prompts/episodeResearch";
```

Replace `GenerateScriptInput` with:

```ts
export type GenerateScriptInput = {
  channelPresetId: ChannelPresetId;
  seedId: string;
  targetDurationSeconds: 30 | 45 | 60;
  episodeCandidate?: EpisodeCandidate;
  episodeResearch?: EpisodeResearch;
  episodeResearchPromptPayload?: Record<string, unknown>;
  episodeResearchResponseMetadata?: Record<string, unknown>;
};
```

- [ ] **Step 2: Let `scriptPlanPrompt` use either a static seed or AI candidate**

In `packages/ai/src/prompts/scriptPlan.ts`, import `EpisodeCandidate`:

```ts
import type { EpisodeCandidate } from "./episodeResearch";
```

Add helper functions above `scriptPlanPrompt`:

```ts
function scriptTopicFields(input: GenerateScriptInput): {
  seedId: string;
  objectOrMechanism: string;
  titleAngle: string;
  centralQuestion: string;
  viewerMisconception: string;
  mechanismHint: string;
  satisfyingMotion: string;
  visualReveal: string;
  loopPayoff: string;
  visualMetaphor: string;
  audienceContext: string;
  nativeSetting: string;
  hookEmotion: string;
  avoidVisualSetting: string;
  source: "ai_candidate" | "static_seed";
  candidate?: EpisodeCandidate;
} {
  if (input.episodeCandidate) {
    const candidate = input.episodeCandidate;
    return {
      seedId: input.seedId,
      objectOrMechanism: candidate.objectOrMechanism,
      titleAngle: candidate.titleCuriosityGap,
      centralQuestion: candidate.centralQuestion,
      viewerMisconception: candidate.feedHypothesis,
      mechanismHint: candidate.mechanismProof,
      satisfyingMotion: "start mid-action, reveal the moving part, prove the mechanism, loop the payoff",
      visualReveal: candidate.visualReveal,
      loopPayoff: candidate.loopPayoff,
      visualMetaphor: candidate.firstFrame,
      audienceContext: candidate.broadAudienceReason,
      nativeSetting: "the familiar setting where the object naturally appears",
      hookEmotion: candidate.retentionPromise,
      avoidVisualSetting: "generic workbench, calm object portrait, clean diagram as the opening frame",
      source: "ai_candidate",
      candidate,
    };
  }

  const seed = getTinyMechanismsSeed(input.seedId);
  if (!seed) {
    throw new Error("tiny_mechanisms_seed_not_found");
  }

  return {
    seedId: seed.seedId,
    objectOrMechanism: seed.objectOrMechanism,
    titleAngle: seed.titleAngle,
    centralQuestion: seed.centralQuestion,
    viewerMisconception: seed.viewerMisconception,
    mechanismHint: seed.mechanismHint,
    satisfyingMotion: seed.satisfyingMotion,
    visualReveal: seed.visualReveal,
    loopPayoff: seed.loopPayoff,
    visualMetaphor: seed.visualMetaphor,
    audienceContext: seed.audienceContext,
    nativeSetting: seed.nativeSetting,
    hookEmotion: seed.hookEmotion,
    avoidVisualSetting: seed.avoidVisualSetting,
    source: "static_seed",
  };
}
```

- [ ] **Step 3: Replace direct seed lookup inside `compile`**

Inside `scriptPlanPrompt.compile`, replace:

```ts
const seed = getTinyMechanismsSeed(input.seedId);
if (!seed) {
  throw new Error("tiny_mechanisms_seed_not_found");
}
```

with:

```ts
const topic = scriptTopicFields(input);
```

Then replace `metadata: { seed }` with:

```ts
metadata: {
  topicSource: topic.source,
  topic,
  episodeResearch: input.episodeResearch ?? null,
},
```

- [ ] **Step 4: Tighten the developer prompt**

In the developer message array inside `scriptPlanPrompt.compile`, replace static-seed-specific lines with these rules:

```ts
"Create one focused micro-documentary episode from the selected topic brief. The final script should feel specific, concrete, and immediately understandable to a curious general audience.",
"The first frame and first line must be strong enough for a Shorts feed test before the viewer hears the full explanation.",
"For 30-second episodes, optimize completion and replay over breadth.",
"Do not start with an intro, a calm setup, or a concept definition.",
"Start mid-action with a visible consequence, contradiction, resistance, release, snap, cut, slide, lock, or catch already happening.",
"The first narration line must be no more than 8 words.",
"The first caption must be no more than 4 words.",
"Do not repeat the sentence shape That X is not Y unless it is clearly the strongest hook.",
"Every 3-5 seconds must add a new visual reason to keep watching.",
"Captions are punch captions, not transcripts and not karaoke timing source text.",
"Do not output word-level timing. Audio alignment owns karaoke timing later.",
```

Keep the existing English-only, safety, caption, and visual-first constraints.

- [ ] **Step 5: Use topic fields in the user message**

Replace all `seed.*` references in the user message with `topic.*`:

```ts
`<seed_id>${topic.seedId}</seed_id>`,
`<topic_source>${topic.source}</topic_source>`,
`<central_question>${topic.centralQuestion}</central_question>`,
`<object_or_mechanism>${topic.objectOrMechanism}</object_or_mechanism>`,
`<title_angle>${topic.titleAngle}</title_angle>`,
`<viewer_misconception>${topic.viewerMisconception}</viewer_misconception>`,
`<mechanism_hint>${topic.mechanismHint}</mechanism_hint>`,
`<satisfying_motion>${topic.satisfyingMotion}</satisfying_motion>`,
`<visual_reveal>${topic.visualReveal}</visual_reveal>`,
`<loop_payoff>${topic.loopPayoff}</loop_payoff>`,
`<visual_metaphor>${topic.visualMetaphor}</visual_metaphor>`,
`<audience_context>${topic.audienceContext}</audience_context>`,
`<native_setting>${topic.nativeSetting}</native_setting>`,
`<hook_emotion>${topic.hookEmotion}</hook_emotion>`,
`<avoid_visual_setting>${topic.avoidVisualSetting}</avoid_visual_setting>`,
...(topic.candidate
  ? [`<selected_candidate_json>${JSON.stringify(topic.candidate)}</selected_candidate_json>`]
  : []),
```

- [ ] **Step 6: Preserve episode research in prompt payload**

In `packages/ai/src/openai.ts`, change the returned `promptPayload` to include episode research fields:

```ts
promptPayload: {
  ...promptPayload(compiled, input),
  episodeResearchPromptPayload: input.episodeResearchPromptPayload ?? null,
  episodeResearch: input.episodeResearch ?? null,
  selectedEpisodeCandidate: input.episodeCandidate ?? null,
},
```

Also add to `responseMetadata`:

```ts
episode_research_response_metadata: input.episodeResearchResponseMetadata ?? null,
selected_candidate_id: input.episodeCandidate?.candidateId ?? null,
```

- [ ] **Step 7: Commit script input changes**

```bash
git add packages/ai/src/types.ts packages/ai/src/openai.ts packages/ai/src/prompts/scriptPlan.ts
git commit -m "feat: generate scripts from selected episode briefs"
```

## Task 7: Add Recent Analytics Prompt Context Query

**Files:**

- Modify: `packages/db/src/queries/youtubeAnalytics.ts`

- [ ] **Step 1: Add an exported context type**

In `packages/db/src/queries/youtubeAnalytics.ts`, add near the existing exported types:

```ts
export type RecentYoutubeCreativePromptContext = {
  youtubeVideoId: string;
  title: string;
  views: number | null;
  engagedViews: number | null;
  averageViewPercentage: number | null;
  averageViewDurationSeconds: number | null;
  viewsPerHour: number | null;
  likeRate: number | null;
  hookNarration: string | null;
  hookCaption: string | null;
  hookImagePrompt: string | null;
};
```

- [ ] **Step 2: Add the recent context query**

Add this function:

```ts
export async function listRecentYoutubeCreativePromptContext(
  db: DbClient,
  input: { limit?: number; since?: Date } = {},
): Promise<RecentYoutubeCreativePromptContext[]> {
  const limit = input.limit ?? 12;
  const where = input.since ? gte(youtubeVideoLinks.publishedAt, input.since) : undefined;

  const baseQuery = db
    .select({
      youtubeVideoId: youtubeVideoLinks.youtubeVideoId,
      title: youtubeVideoLinks.title,
      projectId: youtubeVideoLinks.projectId,
      views: youtubeAnalyticsSnapshots.views,
      engagedViews: youtubeAnalyticsSnapshots.engagedViews,
      averageViewPercentage: youtubeAnalyticsSnapshots.averageViewPercentage,
      averageViewDurationSeconds: youtubeAnalyticsSnapshots.averageViewDurationSeconds,
      viewsPerHour: youtubeAnalyticsSnapshots.viewsPerHour,
      likeRate: youtubeAnalyticsSnapshots.likeRate,
    })
    .from(youtubeVideoLinks)
    .leftJoin(
      youtubeAnalyticsSnapshots,
      eq(youtubeAnalyticsSnapshots.youtubeVideoLinkId, youtubeVideoLinks.id),
    );

  const rows = await (where ? baseQuery.where(where) : baseQuery)
    .orderBy(desc(youtubeVideoLinks.publishedAt), desc(youtubeAnalyticsSnapshots.snapshotAt))
    .limit(limit * 3);

  const latestByVideoId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByVideoId.has(row.youtubeVideoId)) {
      latestByVideoId.set(row.youtubeVideoId, row);
    }
  }

  const contexts: RecentYoutubeCreativePromptContext[] = [];
  for (const row of [...latestByVideoId.values()].slice(0, limit)) {
    const hook = row.projectId
      ? await db
          .select({
            narration: scenes.narration,
            caption: scenes.caption,
            imagePrompt: scenes.imagePrompt,
          })
          .from(scenes)
          .where(and(eq(scenes.projectId, row.projectId), eq(scenes.role, "hook")))
          .orderBy(scenes.position)
          .limit(1)
      : [];

    contexts.push({
      youtubeVideoId: row.youtubeVideoId,
      title: row.title,
      views: row.views,
      engagedViews: row.engagedViews,
      averageViewPercentage: row.averageViewPercentage,
      averageViewDurationSeconds: row.averageViewDurationSeconds,
      viewsPerHour: row.viewsPerHour,
      likeRate: row.likeRate,
      hookNarration: hook[0]?.narration ?? null,
      hookCaption: hook[0]?.caption ?? null,
      hookImagePrompt: hook[0]?.imagePrompt ?? null,
    });
  }

  return contexts;
}
```

This uses existing analytics tables and scene data. It does not add a database migration.

- [ ] **Step 3: Commit analytics context query**

```bash
git add packages/db/src/queries/youtubeAnalytics.ts
git commit -m "feat: expose youtube creative prompt context"
```

## Task 8: Update Worker Script Flow

**Files:**

- Modify: `apps/worker/src/handlers/generateScript.ts`

- [ ] **Step 1: Update imports**

Replace the AI imports with:

```ts
import {
  encodeTinyMechanismsAiTopic,
  encodeTinyMechanismsTopic,
  generateEpisodeResearch,
  generateScript,
  getTinyMechanismsSeed,
  parseTinyMechanismsAiTopicSlug,
  parseTinyMechanismsSeedId,
  slugifyTinyMechanismsAiTopic,
  TINY_MECHANISMS_PENDING_TOPIC,
  TINY_MECHANISMS_PRESET_ID,
  tinyMechanismsProjectTitle,
} from "@short-workflow/ai";
```

Remove `pickNextTinyMechanismsSeed` from imports.

Add DB imports:

```ts
listRecentYoutubeCreativePromptContext,
```

Remove DB imports that are no longer used after this change:

```ts
listProjects,
withAdvisoryTransactionLock,
```

- [ ] **Step 2: Replace static seed reservation with topic resolution**

Replace `resolveTinyMechanismsSeed` and `reserveTinyMechanismsSeed` with:

```ts
async function resolveExplicitTinyMechanismsSeed(project: ProjectRow) {
  const aiSlug = parseTinyMechanismsAiTopicSlug(project.topic);
  if (aiSlug) {
    return null;
  }

  const parsedSeedId = parseTinyMechanismsSeedId(project.topic);

  if (parsedSeedId === "") {
    throw new Error("tiny_mechanisms_seed_not_found");
  }

  if (parsedSeedId !== null && parsedSeedId !== "pending") {
    const existingSeed = getTinyMechanismsSeed(parsedSeedId);
    if (!existingSeed) {
      throw new Error("tiny_mechanisms_seed_not_found");
    }

    return existingSeed;
  }

  if (project.topic !== TINY_MECHANISMS_PENDING_TOPIC && parsedSeedId === null) {
    throw new Error("unsupported_project_prompt_preset");
  }

  return null;
}
```

Remove `TINY_MECHANISMS_SEED_LOCK_KEY`. New AI episode research must not run inside a database advisory transaction or a long-held lock. Atomic job claiming already prevents two workers from processing the same job.

- [ ] **Step 3: Build script input for legacy/static projects**

Add:

```ts
async function buildLegacyScriptInput(project: ProjectRow) {
  const seed = await resolveExplicitTinyMechanismsSeed(project);
  if (!seed) {
    return null;
  }

  return {
    titleFallback: tinyMechanismsProjectTitle(seed),
    topic: encodeTinyMechanismsTopic(seed.seedId),
    input: {
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: seed.seedId,
      targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
    },
  };
}
```

- [ ] **Step 4: Build script input for pending AI projects**

Add:

```ts
async function buildPendingAiScriptInput(db: DbClient, project: ProjectRow) {
  if (project.topic !== TINY_MECHANISMS_PENDING_TOPIC) {
    throw new Error("unsupported_project_prompt_preset");
  }

  const targetDuration = targetDurationSeconds(project.targetDurationSeconds);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentVideos = await listRecentYoutubeCreativePromptContext(db, {
    limit: 12,
    since,
  });
  const episodeResearch = await generateEpisodeResearch({
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    targetDurationSeconds: targetDuration,
    recentVideos,
  });
  const slug = slugifyTinyMechanismsAiTopic(episodeResearch.selectedCandidate.objectOrMechanism);

  return {
    titleFallback: `Tiny Mechanisms: ${episodeResearch.selectedCandidate.centralQuestion}`,
    topic: encodeTinyMechanismsAiTopic(slug),
    input: {
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: `ai:${slug}`,
      targetDurationSeconds: targetDuration,
      episodeCandidate: episodeResearch.selectedCandidate,
      episodeResearch: episodeResearch.research,
      episodeResearchPromptPayload: episodeResearch.promptPayload,
      episodeResearchResponseMetadata: episodeResearch.responseMetadata,
    },
  };
}
```

- [ ] **Step 5: Replace `generateProjectScript` pre-script setup**

Replace:

```ts
const { project, seed } = await reserveTinyMechanismsSeed(db, projectId);
const scriptInput = {
  channelPresetId: TINY_MECHANISMS_PRESET_ID,
  seedId: seed.seedId,
  targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
};
const script = await generateScript(scriptInput);
```

with:

```ts
const project = await getProject(db, projectId);
if (!project) {
  throw new Error("project_not_found");
}

const legacySetup = await buildLegacyScriptInput(project);
const scriptSetup = legacySetup ?? (await buildPendingAiScriptInput(db, project));
const script = await generateScript(scriptSetup.input);
```

The OpenAI episode research call in `buildPendingAiScriptInput` intentionally happens before the write transaction. Do not wrap it in `withDbTransaction` or `withAdvisoryTransactionLock`.

- [ ] **Step 6: Update project title/topic after script generation**

Inside the transaction, replace:

```ts
await updateProject(tx, project.id, {
  title: script.title || tinyMechanismsProjectTitle(seed),
  topic: encodeTinyMechanismsTopic(seed.seedId),
});
```

with:

```ts
await updateProject(tx, projectId, {
  title: script.title || scriptSetup.titleFallback,
  topic: scriptSetup.topic,
});
```

- [ ] **Step 7: Update result seed id**

Replace:

```ts
seedId: seed.seedId,
```

with:

```ts
seedId: scriptSetup.input.seedId,
```

- [ ] **Step 8: Commit worker flow**

```bash
git add apps/worker/src/handlers/generateScript.ts
git commit -m "feat: select tiny mechanisms episodes with ai research"
```

## Task 9: Tighten Image Prompt Hook Rules

**Files:**

- Modify: `packages/ai/src/prompts/imagePrompt.ts`

- [ ] **Step 1: Add first-frame product language**

In `imagePromptTemplate.compile`, replace the first retention section:

```ts
"RETENTION JOB",
"This must work as a first-frame visual hook on a phone screen with sound off.",
"The viewer should understand the object and feel a curiosity gap in under 0.5 seconds.",
```

with:

```ts
"RETENTION JOB",
"The hook frame is the product. It must stop a silent mobile viewer before narration matters.",
"This must work as a first-frame visual hook on a phone screen with sound off.",
"The viewer should understand the object, the action, and the curiosity gap in under 0.5 seconds.",
```

- [ ] **Step 2: Add calm portrait and diagram bans**

In the `SOCIAL HOOK FRAME` section, add:

```ts
"Do not create a calm object portrait for the hook.",
"Do not use a clean explanatory diagram as the first frame.",
"Start with consequence, motion, tension, resistance, release, or visible failure.",
```

- [ ] **Step 3: Keep caption-safe composition**

Keep the existing caption-safe negative space instruction. Do not ask the image model to render captions or karaoke text.

- [ ] **Step 4: Commit image prompt update**

```bash
git add packages/ai/src/prompts/imagePrompt.ts
git commit -m "feat: tighten tiny mechanisms hook image prompts"
```

## Task 10: Protect Karaoke Subtitle Timing In Prompt Boundaries

**Files:**

- Modify: `packages/ai/src/prompts/scriptPlan.ts`

- [ ] **Step 1: Add explicit caption/timing separation**

In the `# Pacing Rules` section of `scriptPlanPrompt`, add:

```ts
"Narration is the source text for TTS.",
"Caption is short punch text for on-screen emphasis, not transcript text.",
"Do not make caption match the full narration.",
"Do not output word-level timing, timestamps, beat timings, or karaoke timing.",
"Karaoke timing is derived later from final audio and transcript alignment.",
```

- [ ] **Step 2: Tighten caption length in the prompt**

Replace:

```ts
"Keep each caption to 2-5 words unless a payoff needs one extra word.",
```

with:

```ts
"Keep each caption to 2-4 words. A payoff may use 5 words only when the line stays readable.",
```

- [ ] **Step 3: Ensure `ttsDirection` remains separate**

Keep the schema field:

```ts
ttsDirection: z.string().min(1),
```

Do not merge `ttsDirection` into `caption` or `narration`.

- [ ] **Step 4: Commit subtitle safety prompt changes**

```bash
git add packages/ai/src/prompts/scriptPlan.ts
git commit -m "fix: keep captions separate from karaoke timing"
```

## Task 11: Manual Verification Only

**Files:**

- No source files.

- [ ] **Step 1: Confirm working tree status**

Run:

```bash
git status -sb
```

Expected:

```text
## main...origin/main [ahead N]
```

or a clean feature branch status. Do not run automated tests.

- [ ] **Step 2: Start local services for manual verification**

Use the existing local dev command:

```bash
bun run dev
```

If that is too broad for the current machine, run only the needed apps:

```bash
bun run dev:api
bun run dev:web
bun run dev:worker
```

Do not run automated test suites.

- [ ] **Step 3: Manually verify project creation**

Open the web app and confirm:

- The create form has no duration segmented control.
- The create form has one create button.
- Clicking the button creates a Tiny Mechanisms project.
- The created project shows `30s` in the project list/detail.

- [ ] **Step 4: Manually verify script generation**

From the created project:

- Trigger `generate_script`.
- Confirm the worker does not log `tiny_mechanisms_seed_bank_exhausted`.
- Confirm scenes are created.
- Confirm the project topic becomes `tiny_mechanisms:ai:<slug>`.

- [ ] **Step 5: Manually inspect prompt history**

Using the database viewer or a one-off read command, inspect the latest `prompt_versions` row for the project.

Confirm `prompt_payload` includes:

- `episodeResearchPromptPayload`
- `episodeResearch`
- `selectedEpisodeCandidate`
- final script prompt messages

Confirm `response_metadata` includes:

- `selected_candidate_id`
- `episode_research_response_metadata`

- [ ] **Step 6: Manually inspect generated script constraints**

Confirm:

- total planned duration is 30 seconds, within the existing tolerance.
- scene roles are `hook`, `context`, `point`, `payoff`, `cta`.
- hook narration starts immediately and is short.
- hook caption is not a transcript line.
- captions are short punch captions.
- no model output includes word-level timing.

- [ ] **Step 7: Manually verify subtitle safety when rendering later**

If you render a project after audio generation:

- Confirm karaoke captions use `caption_timing` assets when present.
- Confirm renderer falls back to scene-level captions when timing is missing.
- Confirm no subtitle highlight continues beyond the scene audio duration.
- Confirm no prompt-generated caption text is treated as word-level timing.

- [ ] **Step 8: Commit any manual verification fixes**

If manual verification reveals a required fix, commit that fix with a focused message:

```bash
git add <changed-files>
git commit -m "fix: correct analytics informed prompt flow"
```

## Task 12: Push Implementation Branch

**Files:**

- No source files.

- [ ] **Step 1: Check final status**

```bash
git status -sb
git log --oneline -n 8
```

- [ ] **Step 2: Push the branch**

If working on `main` by explicit user direction:

```bash
git push origin main
```

If working on a feature branch:

```bash
git push -u origin "$(git branch --show-current)"
```

## Spec Coverage Self-Review

- UI simplification: Task 2.
- Backend default 30 seconds: Task 1.
- New AI topic identity: Task 3.
- Episode candidate research prompt: Task 4.
- OpenAI episode research call: Task 5.
- Script generation from selected brief: Task 6.
- Recent analytics context: Task 7.
- Pending project worker flow: Task 8.
- Hook-first image prompt tightening: Task 9.
- Karaoke subtitle safety: Task 10 and Task 11.
- No DB migration: followed throughout the plan.
- Legacy seed regeneration: Task 8 keeps explicit seed handling.
- No automated tests: followed throughout the plan per user request.
