# Role-Based Candidate Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single Tiny Mechanisms episode research call with five role-based candidate calls, a judge/refine call, stronger structured visual planning, and UI-visible terminal failure details.

**Architecture:** `packages/ai` owns role prompts, judge prompts, script visual-plan schemas, and OpenAI calls. `apps/worker` orchestrates parallel candidate calls and terminal failures without putting provider calls inside DB transactions. `apps/web` displays structured failed-job details from existing `job.output`, with no database migration.

**Tech Stack:** Bun workspaces, TypeScript, OpenAI Responses API, Zod, Drizzle ORM, ElysiaJS API, React/Vite frontend.

---

## Planning Constraint

Per user request, this plan does not add automated test tasks and does not ask implementation workers to run test suites. Use manual/static verification only.

## Source Spec

Implement from:

`docs/superpowers/specs/2026-05-24-role-based-candidate-pipeline-design.md`

Keep these scope decisions:

- No recent analytics context in generation prompts.
- No analytics digest.
- No Memory/RAG.
- No QA or vision verification calls.
- No image-prompt polish call.
- No metadata variants call.
- No database migration.
- No automatic retry for role candidate or judge quality failures.
- Legacy static seed generation remains supported.

## File Structure

Create:

- `apps/worker/src/errors.ts` - terminal workflow error class used to bypass capped auto-retry.
- `packages/ai/src/prompts/episodeJudge.ts` - candidate judge schemas, JSON schema, and judge prompt template.

Modify:

- `packages/db/src/queries/jobs.ts` - add `markJobTerminallyFailed` to mark a job failed terminally with structured `output`.
- `apps/worker/src/loop.ts` - detect terminal workflow errors and mark failed without retry.
- `apps/worker/src/handlers/generateScript.ts` - remove recent analytics from generation, call role-based research, and throw terminal failures.
- `packages/ai/src/prompts/episodeResearch.ts` - replace single-call candidate research shape with role-based candidate schemas/prompts.
- `packages/ai/src/episodeResearch.ts` - generate five role candidates in parallel, judge them, and return the refined brief.
- `packages/ai/src/prompts/index.ts` - export judge prompt module.
- `packages/ai/src/types.ts` - add refined brief and scene visual plan types to script input/output.
- `packages/ai/src/prompts/scriptPlan.ts` - consume refined brief and require/compile structured visual fields.
- `packages/ai/src/openai.ts` - preserve role candidate and judge payloads in script prompt history.
- `apps/web/src/features/projects/ProjectWorkflow.tsx` - render latest failed generation details under the workflow controls.

Do not modify:

- Database migrations.
- Render/karaoke timing implementation.
- Generated assets.
- `.env` files.

## Task 1: Terminal Job Failure Plumbing

**Files:**

- Create: `apps/worker/src/errors.ts`
- Modify: `packages/db/src/queries/jobs.ts`
- Modify: `apps/worker/src/loop.ts`

- [ ] **Step 1: Add a terminal workflow error type**

Create `apps/worker/src/errors.ts`:

```ts
export type TerminalWorkflowFailureOutput = Record<string, unknown>;

export class TerminalWorkflowError extends Error {
  readonly output: TerminalWorkflowFailureOutput;

  constructor(message: string, output: TerminalWorkflowFailureOutput) {
    super(message);
    this.name = "TerminalWorkflowError";
    this.output = output;
  }
}

export function isTerminalWorkflowError(error: unknown): error is TerminalWorkflowError {
  return error instanceof TerminalWorkflowError;
}
```

- [ ] **Step 2: Add a DB helper for terminal failure**

In `packages/db/src/queries/jobs.ts`, add after `markJobSucceeded`:

```ts
export async function markJobTerminallyFailed(
  db: DbClient,
  jobId: string,
  input: {
    errorMessage: string;
    output?: Record<string, unknown>;
  },
) {
  const [job] = await db
    .update(jobs)
    .set({
      status: "failed",
      errorMessage: input.errorMessage,
      output: input.output ?? null,
      finishedAt: sql`now()`,
      nextRetryAt: null,
      updatedAt: sql`now()`,
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return job ?? null;
}
```

Keep `markJobFailedOrRetry` unchanged for normal provider/network failures.

- [ ] **Step 3: Make the worker loop bypass auto-retry for terminal failures**

In `apps/worker/src/loop.ts`, update imports:

```ts
import {
  claimNextJob,
  createDbClient,
  markJobTerminallyFailed,
  markJobFailedOrRetry,
  recoverStaleJobs,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { isTerminalWorkflowError } from "./errors";
```

Inside the `catch` block, replace the first lines with:

```ts
      const message = errorMessage(error);
      const updatedJob = isTerminalWorkflowError(error)
        ? await markJobTerminallyFailed(db, job.id, {
            errorMessage: message,
            output: error.output,
          })
        : await markJobFailedOrRetry(db, job, message);
      const status = updatedJob?.status ?? "failed";
      const event = status === "pending" ? "job_retry_scheduled" : "job_failed";
```

Keep the existing `logWorkerError(...)` call after this block.

- [ ] **Step 4: Commit terminal failure plumbing**

```bash
git add apps/worker/src/errors.ts packages/db/src/queries/jobs.ts apps/worker/src/loop.ts
git commit -m "feat: support terminal workflow job failures"
```

## Task 2: Role-Based Candidate Prompt Schemas

**Files:**

- Modify: `packages/ai/src/prompts/episodeResearch.ts`

- [ ] **Step 1: Replace recent analytics input with role inputs**

In `packages/ai/src/prompts/episodeResearch.ts`, remove `recentVideoPromptContextSchema` and `RecentVideoPromptContext`.

Add role definitions near the top:

```ts
export const EPISODE_CANDIDATE_ROLES = [
  "feed_stop_strategist",
  "broad_object_selector",
  "visual_mechanism_director",
  "retention_architect",
  "loop_payoff_editor",
] as const;

export const episodeCandidateRoleSchema = z.enum(EPISODE_CANDIDATE_ROLES);

export type EpisodeCandidateRole = z.infer<typeof episodeCandidateRoleSchema>;
```

- [ ] **Step 2: Replace score schema**

Replace `episodeCandidateScoreSchema` with:

```ts
export const episodeCandidateScoreSchema = z
  .object({
    firstFrameClarity: z.number().int().min(1).max(5),
    swipeResistance: z.number().int().min(1).max(5),
    broadObjectFamiliarity: z.number().int().min(1).max(5),
    visualNovelty: z.number().int().min(1).max(5),
    retentionPath: z.number().int().min(1).max(5),
    loopPayoffStrength: z.number().int().min(1).max(5),
    genericRisk: z.number().int().min(1).max(5),
  })
  .strict();
```

- [ ] **Step 3: Replace candidate schema**

Replace `episodeCandidateSchema` with:

```ts
export const episodeCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    roleSource: episodeCandidateRoleSchema,
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
    whyThisCanBreakPattern: z.string().min(1),
    scores: episodeCandidateScoreSchema,
  })
  .strict();
```

- [ ] **Step 4: Replace research input/output types**

Replace `episodeResearchSchema` and `EpisodeResearchInput` with:

```ts
export const roleEpisodeCandidateResponseSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    role: episodeCandidateRoleSchema,
    candidate: episodeCandidateSchema,
  })
  .strict()
  .refine((value) => value.candidate.roleSource === value.role, "candidate_role_mismatch");

export type EpisodeCandidateScore = z.infer<typeof episodeCandidateScoreSchema>;
export type EpisodeCandidate = z.infer<typeof episodeCandidateSchema>;
export type RoleEpisodeCandidateResponse = z.infer<typeof roleEpisodeCandidateResponseSchema>;

export type EpisodeResearchInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  role: EpisodeCandidateRole;
};
```

Do not keep `recentVideos` in `EpisodeResearchInput`.

- [ ] **Step 5: Replace JSON schema**

Replace `EPISODE_RESEARCH_JSON_SCHEMA` with a strict schema for one role candidate:

```ts
export const EPISODE_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "role", "candidate"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    role: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    candidate: {
      type: "object",
      additionalProperties: false,
      required: [
        "candidateId",
        "roleSource",
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
        "whyThisCanBreakPattern",
        "scores",
      ],
      properties: {
        candidateId: { type: "string", minLength: 1 },
        roleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
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
        whyThisCanBreakPattern: { type: "string", minLength: 1 },
        scores: candidateScoreJsonSchema,
      },
    },
  },
} as const;
```

Define `candidateScoreJsonSchema` above it:

```ts
export const candidateScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "firstFrameClarity",
    "swipeResistance",
    "broadObjectFamiliarity",
    "visualNovelty",
    "retentionPath",
    "loopPayoffStrength",
    "genericRisk",
  ],
  properties: {
    firstFrameClarity: { type: "integer", minimum: 1, maximum: 5 },
    swipeResistance: { type: "integer", minimum: 1, maximum: 5 },
    broadObjectFamiliarity: { type: "integer", minimum: 1, maximum: 5 },
    visualNovelty: { type: "integer", minimum: 1, maximum: 5 },
    retentionPath: { type: "integer", minimum: 1, maximum: 5 },
    loopPayoffStrength: { type: "integer", minimum: 1, maximum: 5 },
    genericRisk: { type: "integer", minimum: 1, maximum: 5 },
  },
} as const;
```

- [ ] **Step 6: Add role prompt helpers**

Add:

```ts
function roleInstruction(role: EpisodeCandidateRole) {
  switch (role) {
    case "feed_stop_strategist":
      return "Optimize for the first frame, first 0.5 seconds, first line, and swipe resistance. The candidate must stop a silent mobile viewer before explanation matters.";
    case "broad_object_selector":
      return "Optimize for a familiar everyday object a broad audience recognizes instantly. Avoid niche mechanism-first choices that only appeal to specialists.";
    case "visual_mechanism_director":
      return "Optimize for visible motion and physical cause-effect: tension, snap, lock, slide, release, catch, pull, bend, or visible failure.";
    case "retention_architect":
      return "Optimize for a reveal path every 3-5 seconds. Avoid candidates with a strong hook but a flat middle.";
    case "loop_payoff_editor":
      return "Optimize for ending payoff, replay logic, and title curiosity. The final beat should make the opening frame more satisfying in retrospect.";
  }
}
```

- [ ] **Step 7: Update `episodeResearchPrompt.compile`**

Change the prompt so it generates one candidate for `input.role`, does not mention recent analytics, and includes:

```ts
modelParameters: {
  channelPresetId: input.channelPresetId,
  targetDurationSeconds: input.targetDurationSeconds,
  role: input.role,
},
metadata: {
  role: input.role,
},
messages: [
  {
    role: "developer",
    content: [
      "# Identity",
      "You are a specialized YouTube Shorts episode candidate strategist for Tiny Mechanisms.",
      "",
      "# Channel",
      TINY_MECHANISMS_CHANNEL_BIBLE,
      "",
      "# Shared Rules",
      "Generate exactly one episode candidate for the requested role.",
      "Do not write the final script.",
      "Do not use recent analytics or previous channel data.",
      "Use English only.",
      "Prefer familiar everyday objects with visible physical motion, tension, resistance, release, cutting, sliding, snapping, bending, locking, or catching.",
      "The hook frame must be consequence-first, action already happening, and understandable with sound off in under 0.5 seconds.",
      "Reject calm object portraits, clean explanatory diagrams as hooks, generic macro shots, medical advice, finance, legal, politics, crime, disaster, public figures, dangerous instructions, children's characters, and unsupported claims.",
      "Do not output timestamps, beat timing, word-level timing, or karaoke timing.",
      "",
      "# Role",
      roleInstruction(input.role),
      "",
      "# Scoring",
      "Score from 1 to 5 for firstFrameClarity, swipeResistance, broadObjectFamiliarity, visualNovelty, retentionPath, loopPayoffStrength, and genericRisk.",
      "For genericRisk, 1 means low generic risk and 5 means high generic risk.",
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
      `<candidate_role>${input.role}</candidate_role>`,
    ].join("\n"),
  },
],
```

- [ ] **Step 8: Replace parser helpers**

Replace `parseEpisodeResearch` / `selectedEpisodeCandidate` with:

```ts
export function parseRoleEpisodeCandidateResponse(value: unknown): RoleEpisodeCandidateResponse {
  const parsed = roleEpisodeCandidateResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("episode_candidate_response_invalid");
  }

  return parsed.data;
}
```

- [ ] **Step 9: Commit role candidate prompt schemas**

```bash
git add packages/ai/src/prompts/episodeResearch.ts
git commit -m "feat: define role based episode candidate prompts"
```

## Task 3: Candidate Judge Prompt

**Files:**

- Create: `packages/ai/src/prompts/episodeJudge.ts`
- Modify: `packages/ai/src/prompts/index.ts`

- [ ] **Step 1: Create judge schemas**

Create `packages/ai/src/prompts/episodeJudge.ts`:

```ts
import { z } from "zod";

import { TINY_MECHANISMS_CHANNEL_BIBLE, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import {
  candidateScoreJsonSchema,
  EPISODE_CANDIDATE_ROLES,
  episodeCandidateRoleSchema,
  episodeCandidateSchema,
  type EpisodeCandidate,
} from "./episodeResearch";
import type { CompiledPrompt, PromptTemplate } from "./types";

const candidateJudgeScoreSchema = z
  .object({
    candidateId: z.string().min(1),
    roleSource: episodeCandidateRoleSchema,
    firstFrameClarity: z.number().int().min(1).max(5),
    swipeResistance: z.number().int().min(1).max(5),
    broadObjectFamiliarity: z.number().int().min(1).max(5),
    visualNovelty: z.number().int().min(1).max(5),
    retentionPath: z.number().int().min(1).max(5),
    loopPayoffStrength: z.number().int().min(1).max(5),
    genericRisk: z.number().int().min(1).max(5),
    coreAverage: z.number().min(1).max(5),
    notes: z.string().min(1),
  })
  .strict();

export const refinedEpisodeBriefSchema = z
  .object({
    candidateId: z.string().min(1),
    roleSource: episodeCandidateRoleSchema,
    objectOrMechanism: z.string().min(1),
    centralQuestion: z.string().min(1),
    firstFrame: z.string().min(1),
    firstLine: z.string().min(1),
    firstThreeWords: z.string().min(1),
    viewerQuestion: z.string().min(1),
    retentionPromise: z.string().min(1),
    mechanismProof: z.string().min(1),
    visualReveal: z.string().min(1),
    loopPayoff: z.string().min(1),
    titleCuriosityGap: z.string().min(1),
    avoidAngles: z.array(z.string().min(1)).min(1),
  })
  .strict();

const candidateJudgeResultValueSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("selected"),
      selectedCandidateId: z.string().min(1),
      selectedRoleSource: episodeCandidateRoleSchema,
      scoreTable: z.array(candidateJudgeScoreSchema).length(5),
      selectionRationale: z.string().min(1),
      refinedBrief: refinedEpisodeBriefSchema,
    })
    .strict(),
  z
    .object({
      status: z.literal("rejected"),
      scoreTable: z.array(candidateJudgeScoreSchema).length(5),
      failureReason: z.string().min(1),
      thresholdSummary: z.string().min(1),
    })
    .strict(),
]);

export const candidateJudgeResultContainerSchema = z
  .object({
    result: candidateJudgeResultValueSchema,
  })
  .strict();

export type CandidateJudgeScore = z.infer<typeof candidateJudgeScoreSchema>;
export type RefinedEpisodeBrief = z.infer<typeof refinedEpisodeBriefSchema>;
export type CandidateJudgeResult = z.infer<typeof candidateJudgeResultValueSchema>;

export type CandidateJudgeInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  candidates: EpisodeCandidate[];
};
```

- [ ] **Step 2: Add the judge JSON schema**

In the same file, add:

```ts
const judgeScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "candidateId",
    "roleSource",
    "firstFrameClarity",
    "swipeResistance",
    "broadObjectFamiliarity",
    "visualNovelty",
    "retentionPath",
    "loopPayoffStrength",
    "genericRisk",
    "coreAverage",
    "notes",
  ],
  properties: {
    candidateId: { type: "string", minLength: 1 },
    roleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    ...candidateScoreJsonSchema.properties,
    coreAverage: { type: "number", minimum: 1, maximum: 5 },
    notes: { type: "string", minLength: 1 },
  },
} as const;

const refinedBriefJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "candidateId",
    "roleSource",
    "objectOrMechanism",
    "centralQuestion",
    "firstFrame",
    "firstLine",
    "firstThreeWords",
    "viewerQuestion",
    "retentionPromise",
    "mechanismProof",
    "visualReveal",
    "loopPayoff",
    "titleCuriosityGap",
    "avoidAngles",
  ],
  properties: {
    candidateId: { type: "string", minLength: 1 },
    roleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    objectOrMechanism: { type: "string", minLength: 1 },
    centralQuestion: { type: "string", minLength: 1 },
    firstFrame: { type: "string", minLength: 1 },
    firstLine: { type: "string", minLength: 1 },
    firstThreeWords: { type: "string", minLength: 1 },
    viewerQuestion: { type: "string", minLength: 1 },
    retentionPromise: { type: "string", minLength: 1 },
    mechanismProof: { type: "string", minLength: 1 },
    visualReveal: { type: "string", minLength: 1 },
    loopPayoff: { type: "string", minLength: 1 },
    titleCuriosityGap: { type: "string", minLength: 1 },
    avoidAngles: {
      type: "array",
      minItems: 1,
      items: { type: "string", minLength: 1 },
    },
  },
} as const;

const selectedJudgeResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "selectedCandidateId",
    "selectedRoleSource",
    "scoreTable",
    "selectionRationale",
    "refinedBrief",
  ],
  properties: {
    status: { type: "string", enum: ["selected"] },
    selectedCandidateId: { type: "string", minLength: 1 },
    selectedRoleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    scoreTable: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: judgeScoreJsonSchema,
    },
    selectionRationale: { type: "string", minLength: 1 },
    refinedBrief: refinedBriefJsonSchema,
  },
} as const;

const rejectedJudgeResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "scoreTable", "failureReason", "thresholdSummary"],
  properties: {
    status: { type: "string", enum: ["rejected"] },
    scoreTable: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: judgeScoreJsonSchema,
    },
    failureReason: { type: "string", minLength: 1 },
    thresholdSummary: { type: "string", minLength: 1 },
  },
} as const;

export const CANDIDATE_JUDGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["result"],
  properties: {
    result: {
      anyOf: [selectedJudgeResultJsonSchema, rejectedJudgeResultJsonSchema],
    },
  },
} as const;
```

- [ ] **Step 3: Add compiled prompt type and prompt template**

Add:

```ts
export type CompiledCandidateJudgePrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_candidate_judge_v1";
  schemaVersion: 1;
};

export const candidateJudgePrompt: PromptTemplate<
  CandidateJudgeInput,
  CompiledCandidateJudgePrompt
> = {
  id: "tiny_mechanisms_candidate_judge",
  version: 1,
  purpose: "script",
  provider: "openai",
  compile(input) {
    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "tiny_mechanisms_candidate_judge_v1",
      schemaVersion: 1,
      modelParameters: {
        channelPresetId: input.channelPresetId,
        targetDurationSeconds: input.targetDurationSeconds,
        candidateCount: input.candidates.length,
      },
      metadata: {
        candidateIds: input.candidates.map((candidate) => candidate.candidateId),
      },
      messages: [
        {
          role: "developer",
          content: [
            "# Identity",
            "You are CandidateJudgeAgent for Tiny Mechanisms.",
            "You are strict. You select only candidates strong enough for a 30-second YouTube Short feed test.",
            "",
            "# Channel",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "",
            "# Task",
            "Score all 5 candidates independently.",
            "Select one candidate only if it clears the quality threshold.",
            "If no candidate clears the threshold, return status rejected.",
            "If selected, refine the winner into a production brief. Do not invent a new topic.",
            "",
            "# Threshold",
            "Core average is the average of firstFrameClarity, swipeResistance, broadObjectFamiliarity, visualNovelty, retentionPath, and loopPayoffStrength.",
            "A selected candidate must have coreAverage >= 4.",
            "A selected candidate must have genericRisk <= 2.",
            "",
            "# Output",
            "Return JSON that follows the supplied schema.",
            "Wrap the selected or rejected judge result under the top-level result key.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `<channel_preset_id>${input.channelPresetId}</channel_preset_id>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<candidates_json>${JSON.stringify(input.candidates)}</candidates_json>`,
          ].join("\n"),
        },
      ],
    };
  },
};
```

- [ ] **Step 4: Add parser with threshold enforcement**

Add:

```ts
export function parseCandidateJudgeResult(value: unknown): CandidateJudgeResult {
  const parsed = candidateJudgeResultContainerSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("candidate_judge_response_invalid");
  }

  const result = parsed.data.result;

  if (result.status === "selected") {
    const selectedScore = result.scoreTable.find(
      (score) => score.candidateId === result.selectedCandidateId,
    );

    if (!selectedScore || selectedScore.coreAverage < 4 || selectedScore.genericRisk > 2) {
      return {
        status: "rejected",
        scoreTable: result.scoreTable,
        failureReason: "No candidate cleared the medium quality threshold.",
        thresholdSummary: "Requires coreAverage >= 4 and genericRisk <= 2.",
      };
    }
  }

  return result;
}
```

- [ ] **Step 5: Export judge prompt module**

In `packages/ai/src/prompts/index.ts`, add:

```ts
export * from "./episodeJudge";
```

- [ ] **Step 6: Commit judge prompt schemas**

```bash
git add packages/ai/src/prompts/episodeJudge.ts packages/ai/src/prompts/index.ts
git commit -m "feat: add tiny mechanisms candidate judge prompt"
```

## Task 4: Role-Based Episode Research Client

**Files:**

- Modify: `packages/ai/src/episodeResearch.ts`
- Modify: `packages/ai/src/types.ts`

- [ ] **Step 1: Update script input types**

In `packages/ai/src/types.ts`, replace the episode research imports:

```ts
import type { CandidateJudgeResult, RefinedEpisodeBrief } from "./prompts/episodeJudge";
import type {
  EpisodeCandidate,
  RoleEpisodeCandidateResponse,
} from "./prompts/episodeResearch";
```

Replace the episode fields in `GenerateScriptInput`:

```ts
  episodeCandidate?: EpisodeCandidate;
  refinedEpisodeBrief?: RefinedEpisodeBrief;
  episodeResearch?: {
    candidates: RoleEpisodeCandidateResponse[];
    judge: CandidateJudgeResult;
  };
  episodeResearchPromptPayload?: Record<string, unknown>;
  episodeResearchResponseMetadata?: Record<string, unknown>;
```

- [ ] **Step 2: Update client imports**

In `packages/ai/src/episodeResearch.ts`, import judge prompt helpers:

```ts
import {
  CANDIDATE_JUDGE_JSON_SCHEMA,
  candidateJudgePrompt,
  parseCandidateJudgeResult,
  type CandidateJudgeResult,
  type RefinedEpisodeBrief,
} from "./prompts/episodeJudge";
import {
  EPISODE_CANDIDATE_ROLES,
  EPISODE_RESEARCH_JSON_SCHEMA,
  episodeResearchPrompt,
  parseRoleEpisodeCandidateResponse,
  type EpisodeCandidate,
  type EpisodeCandidateRole,
  type EpisodeResearchInput,
  type RoleEpisodeCandidateResponse,
} from "./prompts/episodeResearch";
```

- [ ] **Step 3: Replace output type**

Replace `GenerateEpisodeResearchOutput` with:

```ts
type GenerateEpisodeResearchOutput = {
  candidates: RoleEpisodeCandidateResponse[];
  judge: CandidateJudgeResult;
  selectedCandidate: EpisodeCandidate;
  refinedBrief: RefinedEpisodeBrief;
  promptPayload: Record<string, unknown>;
  responseText: string;
  responseMetadata: Record<string, unknown>;
};
```

- [ ] **Step 4: Replace `generateEpisodeResearch` orchestration**

Replace `generateEpisodeResearch` with:

```ts
export async function generateEpisodeResearch(
  input: Omit<EpisodeResearchInput, "role">,
): Promise<GenerateEpisodeResearchOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const client = new OpenAI({ apiKey });
  const roleResults = await Promise.allSettled(
    EPISODE_CANDIDATE_ROLES.map((role) =>
      generateRoleCandidate(client, model, {
        ...input,
        role,
      }),
    ),
  );

  const candidates: RoleEpisodeCandidateResponse[] = [];
  const rolePromptPayloads: Record<string, unknown>[] = [];
  const roleResponseMetadata: Record<string, unknown>[] = [];

  for (let index = 0; index < roleResults.length; index += 1) {
    const role = EPISODE_CANDIDATE_ROLES[index];
    const result = roleResults[index];

    if (result.status === "rejected") {
      throw new EpisodeCandidateRoleError(role, result.reason);
    }

    candidates.push(result.value.candidateResponse);
    rolePromptPayloads.push(result.value.promptPayload);
    roleResponseMetadata.push(result.value.responseMetadata);
  }

  const judgeResult = await judgeEpisodeCandidates(client, model, {
    channelPresetId: input.channelPresetId,
    targetDurationSeconds: input.targetDurationSeconds,
    candidates: candidates.map((candidate) => candidate.candidate),
  });

  if (judgeResult.judge.status === "rejected") {
    throw new EpisodeCandidateJudgeRejection(judgeResult.judge);
  }

  const selectedCandidate = candidates.find(
    (candidate) => candidate.candidate.candidateId === judgeResult.judge.selectedCandidateId,
  )?.candidate;

  if (!selectedCandidate) {
    throw new Error("candidate_judge_selection_missing");
  }

  return {
    candidates,
    judge: judgeResult.judge,
    selectedCandidate,
    refinedBrief: judgeResult.judge.refinedBrief,
    promptPayload: {
      rolePromptPayloads,
      roleCandidates: candidates,
      judgePromptPayload: judgeResult.promptPayload,
      selectedRefinedBrief: judgeResult.judge.refinedBrief,
    },
    responseText: JSON.stringify({
      candidates,
      judge: judgeResult.judge,
    }),
    responseMetadata: {
      model_id: model,
      role_response_metadata: roleResponseMetadata,
      judge_response_metadata: judgeResult.responseMetadata,
    },
  };
}
```

- [ ] **Step 5: Add role candidate helper**

Add:

```ts
async function generateRoleCandidate(
  client: OpenAI,
  model: string,
  input: EpisodeResearchInput,
) {
  const compiled = episodeResearchPrompt.compile(input);
  const response = await client.responses.create({
    model,
    input: compiled.messages,
    reasoning: { effort: "xhigh" },
    text: {
      format: {
        type: "json_schema",
        name: compiled.schemaName,
        schema: EPISODE_RESEARCH_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const rawResponseText = extractResponseText(response, "episode_candidate_response_invalid");
  const candidateResponse = parseRoleEpisodeCandidateResponse(parseJsonObject(rawResponseText));

  return {
    candidateResponse,
    promptPayload: promptPayload(compiled, input),
    responseMetadata: responseMetadata(response, compiled.schemaName, compiled.schemaVersion),
  };
}
```

- [ ] **Step 6: Add judge helper**

Add:

```ts
async function judgeEpisodeCandidates(
  client: OpenAI,
  model: string,
  input: Parameters<typeof candidateJudgePrompt.compile>[0],
) {
  const compiled = candidateJudgePrompt.compile(input);
  const response = await client.responses.create({
    model,
    input: compiled.messages,
    reasoning: { effort: "xhigh" },
    text: {
      format: {
        type: "json_schema",
        name: compiled.schemaName,
        schema: CANDIDATE_JUDGE_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const rawResponseText = extractResponseText(response, "candidate_judge_response_invalid");

  return {
    judge: parseCandidateJudgeResult(parseJsonObject(rawResponseText)),
    promptPayload: promptPayload(compiled, input),
    responseMetadata: responseMetadata(response, compiled.schemaName, compiled.schemaVersion),
  };
}
```

- [ ] **Step 7: Add error classes for worker mapping**

Add near the output type:

```ts
export class EpisodeCandidateRoleError extends Error {
  readonly role: EpisodeCandidateRole;

  constructor(role: EpisodeCandidateRole, cause: unknown) {
    super(`candidate_generation_failed:${role}`);
    this.name = "EpisodeCandidateRoleError";
    this.role = role;
    this.cause = cause;
  }
}

export class EpisodeCandidateJudgeRejection extends Error {
  readonly judge: Extract<CandidateJudgeResult, { status: "rejected" }>;

  constructor(judge: Extract<CandidateJudgeResult, { status: "rejected" }>) {
    super("candidate_judge_rejected");
    this.name = "EpisodeCandidateJudgeRejection";
    this.judge = judge;
  }
}
```

- [ ] **Step 8: Update helper functions**

Change `extractResponseText` to accept an error code:

```ts
function extractResponseText(response: OpenAI.Responses.Response, invalidMessage: string): string {
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
    throw new Error(invalidMessage);
  }

  return text;
}
```

Add:

```ts
function responseMetadata(
  response: OpenAI.Responses.Response,
  schemaName: string,
  schemaVersion: number,
) {
  return {
    model_id: response.model,
    finish_reason: extractFinishReason(response),
    response_id: response.id,
    status: response.status,
    schema_name: schemaName,
    schema_version: schemaVersion,
  };
}
```

Keep `parseJsonObject` and `extractFinishReason`.

- [ ] **Step 9: Commit role-based research client**

```bash
git add packages/ai/src/episodeResearch.ts packages/ai/src/types.ts
git commit -m "feat: generate role based episode candidates"
```

## Task 5: Script Prompt Refined Brief And Visual Plan

**Files:**

- Modify: `packages/ai/src/prompts/scriptPlan.ts`
- Modify: `packages/ai/src/openai.ts`

- [ ] **Step 1: Import refined brief type**

In `packages/ai/src/prompts/scriptPlan.ts`, replace the `EpisodeCandidate` import with:

```ts
import type { RefinedEpisodeBrief } from "./episodeJudge";
```

- [ ] **Step 2: Add scene visual plan schema**

Add above `scriptSceneSchema`:

```ts
const sceneVisualPlanSchema = z
  .object({
    firstFrameJob: z.string().min(1),
    familiarObject: z.string().min(1),
    visibleAction: z.string().min(1),
    visibleConsequence: z.string().min(1),
    viewerQuestion: z.string().min(1),
    motionOrTension: z.string().min(1),
    cameraFraming: z.string().min(1),
    captionSafeZone: z.string().min(1),
    avoidVisuals: z.array(z.string().min(1)).min(1),
  })
  .strict();
```

- [ ] **Step 3: Require visual plan in script scenes**

Add to `scriptSceneSchema`:

```ts
    visualPlan: sceneVisualPlanSchema,
```

Add `visualPlan` to `SCRIPT_PLAN_JSON_SCHEMA.scenes.items.required`, and add this property:

```ts
          visualPlan: {
            type: "object",
            additionalProperties: false,
            required: [
              "firstFrameJob",
              "familiarObject",
              "visibleAction",
              "visibleConsequence",
              "viewerQuestion",
              "motionOrTension",
              "cameraFraming",
              "captionSafeZone",
              "avoidVisuals",
            ],
            properties: {
              firstFrameJob: { type: "string", minLength: 1 },
              familiarObject: { type: "string", minLength: 1 },
              visibleAction: { type: "string", minLength: 1 },
              visibleConsequence: { type: "string", minLength: 1 },
              viewerQuestion: { type: "string", minLength: 1 },
              motionOrTension: { type: "string", minLength: 1 },
              cameraFraming: { type: "string", minLength: 1 },
              captionSafeZone: { type: "string", minLength: 1 },
              avoidVisuals: {
                type: "array",
                minItems: 1,
                items: { type: "string", minLength: 1 },
              },
            },
          },
```

- [ ] **Step 4: Update script topic fields for refined briefs**

Change `scriptTopicFields` to use `input.refinedEpisodeBrief` first:

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
  source: "refined_brief" | "ai_candidate" | "static_seed";
  refinedBrief?: RefinedEpisodeBrief;
} {
  if (input.refinedEpisodeBrief) {
    const brief = input.refinedEpisodeBrief;
    return {
      seedId: input.seedId,
      objectOrMechanism: brief.objectOrMechanism,
      titleAngle: brief.titleCuriosityGap,
      centralQuestion: brief.centralQuestion,
      viewerMisconception: brief.viewerQuestion,
      mechanismHint: brief.mechanismProof,
      satisfyingMotion:
        "start mid-action, reveal the moving part, prove the mechanism, loop the payoff",
      visualReveal: brief.visualReveal,
      loopPayoff: brief.loopPayoff,
      visualMetaphor: brief.firstFrame,
      audienceContext: "a broad curious audience that recognizes the object immediately",
      nativeSetting: "the familiar setting where the object naturally appears",
      hookEmotion: brief.retentionPromise,
      avoidVisualSetting: brief.avoidAngles.join(", "),
      source: "refined_brief",
      refinedBrief: brief,
    };
  }
```

Keep the existing `input.episodeCandidate` branch after this for backward compatibility during the transition.

- [ ] **Step 5: Include refined brief in prompt metadata/user message**

In `metadata`, add:

```ts
        refinedEpisodeBrief: input.refinedEpisodeBrief ?? null,
```

In the user message, replace selected candidate JSON with:

```ts
            ...(topic.refinedBrief
              ? [`<refined_production_brief_json>${JSON.stringify(topic.refinedBrief)}</refined_production_brief_json>`]
              : []),
```

Keep existing selected candidate JSON fallback for `topic.candidate` if it remains.

- [ ] **Step 6: Add visual plan prompt rules**

In the developer prompt visual section, add:

```ts
"Each scene must include a visualPlan object.",
"visualPlan.firstFrameJob states what the frame must accomplish in the first half-second.",
"visualPlan.familiarObject names the recognizable object a general viewer sees immediately.",
"visualPlan.visibleAction must describe action already happening, not a setup before action.",
"visualPlan.visibleConsequence must describe the visible result, failure, tension, lock, release, or contradiction.",
"visualPlan.viewerQuestion must be one clear visual question the frame creates.",
"visualPlan.motionOrTension must name the physical force, motion, resistance, or release.",
"visualPlan.cameraFraming must specify phone-readable 9:16 framing.",
"visualPlan.captionSafeZone must preserve clean lower 25-30% space.",
"visualPlan.avoidVisuals must list calm portrait, clean diagram as hook, generic macro shot, labels, logos, and any topic-specific bad framing.",
```

- [ ] **Step 7: Compile visual plans into image prompts**

Add below `parseScriptPlan`:

```ts
function sceneImagePromptFromVisualPlan(scene: ScriptScene): string {
  return [
    scene.imagePrompt,
    `First-frame job: ${scene.visualPlan.firstFrameJob}`,
    `Familiar object: ${scene.visualPlan.familiarObject}`,
    `Visible action already happening: ${scene.visualPlan.visibleAction}`,
    `Visible consequence: ${scene.visualPlan.visibleConsequence}`,
    `Viewer question: ${scene.visualPlan.viewerQuestion}`,
    `Motion or tension: ${scene.visualPlan.motionOrTension}`,
    `Camera framing: ${scene.visualPlan.cameraFraming}`,
    `Caption-safe zone: ${scene.visualPlan.captionSafeZone}`,
    `Avoid: ${scene.visualPlan.avoidVisuals.join(", ")}`,
  ].join(". ");
}
```

In `parseScriptPlan`, after duration validation and before return:

```ts
  return {
    ...parsed.data,
    scenes: parsed.data.scenes.map((scene) => ({
      ...scene,
      imagePrompt: sceneImagePromptFromVisualPlan(scene),
    })),
  };
```

- [ ] **Step 8: Preserve visual plan payload in script output**

In `packages/ai/src/openai.ts`, add refined brief fields to `promptPayload`:

```ts
      refinedEpisodeBrief: input.refinedEpisodeBrief ?? null,
```

Add to `responseMetadata`:

```ts
      selected_candidate_role: input.refinedEpisodeBrief?.roleSource ?? input.episodeCandidate?.roleSource ?? null,
```

- [ ] **Step 9: Commit script visual plan changes**

```bash
git add packages/ai/src/prompts/scriptPlan.ts packages/ai/src/openai.ts
git commit -m "feat: add structured visual plans to scripts"
```

## Task 6: Worker Orchestration Without Analytics Context

**Files:**

- Modify: `apps/worker/src/handlers/generateScript.ts`

- [ ] **Step 1: Update imports**

Remove `listRecentYoutubeCreativePromptContext`.

Add:

```ts
  EpisodeCandidateJudgeRejection,
  EpisodeCandidateRoleError,
```

from `@short-workflow/ai`, and add:

```ts
import { TerminalWorkflowError } from "../errors";
```

- [ ] **Step 2: Remove recent analytics query**

In `buildPendingAiScriptInput`, delete:

```ts
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentVideos = await listRecentYoutubeCreativePromptContext(db, {
    limit: 12,
    since,
  });
```

Call `generateEpisodeResearch` with no `recentVideos`:

```ts
  const research = await generateEpisodeResearch({
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    targetDurationSeconds: targetDuration,
  });
```

- [ ] **Step 3: Map candidate failures to terminal workflow errors**

Wrap the `generateEpisodeResearch` call:

```ts
  let research: Awaited<ReturnType<typeof generateEpisodeResearch>>;
  try {
    research = await generateEpisodeResearch({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      targetDurationSeconds: targetDuration,
    });
  } catch (error) {
    if (error instanceof EpisodeCandidateRoleError) {
      throw new TerminalWorkflowError("candidate_generation_failed", {
        stage: "candidate_generation",
        failedRole: error.role,
        reason: error.cause instanceof Error ? error.cause.message : String(error.cause),
      });
    }

    if (error instanceof EpisodeCandidateJudgeRejection) {
      throw new TerminalWorkflowError("candidate_judge_rejected", {
        stage: "candidate_judge",
        reason: error.judge.failureReason,
        thresholdSummary: error.judge.thresholdSummary,
        scoreTable: error.judge.scoreTable,
      });
    }

    throw error;
  }
```

- [ ] **Step 4: Use refined brief in script input**

Update the returned script input:

```ts
      episodeCandidate: research.selectedCandidate,
      refinedEpisodeBrief: research.refinedBrief,
      episodeResearch: {
        candidates: research.candidates,
        judge: research.judge,
      },
      episodeResearchPromptPayload: research.promptPayload,
      episodeResearchResponseMetadata: research.responseMetadata,
```

Keep `seedId: \`ai:${slug}\`` and project topic update.

- [ ] **Step 5: Commit worker orchestration**

```bash
git add apps/worker/src/handlers/generateScript.ts
git commit -m "feat: orchestrate role based script research"
```

## Task 7: UI Failure Detail Display

**Files:**

- Modify: `apps/web/src/features/projects/ProjectWorkflow.tsx`

- [ ] **Step 1: Add failure detail helpers**

In `ProjectWorkflow.tsx`, add below `isGenerateScriptStartable`:

```tsx
function latestGenerationFailure(jobs: Job[]) {
  return jobs.find(
    (job) =>
      job.status === "failed" &&
      (job.type === "generate_script" || job.type === "run_project_flow"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failureOutput(job: Job | undefined) {
  return isRecord(job?.output) ? job.output : null;
}

function scoreRows(output: Record<string, unknown> | null) {
  const table = output?.scoreTable;
  return Array.isArray(table) ? table.filter(isRecord) : [];
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
```

- [ ] **Step 2: Track latest failed generation job**

Inside `ProjectWorkflow`, after active jobs:

```tsx
  const latestFailedGenerationJob = latestGenerationFailure(detail.jobs);
  const latestFailureOutput = failureOutput(latestFailedGenerationJob);
  const latestFailureScores = scoreRows(latestFailureOutput);
```

- [ ] **Step 3: Render failure details under generate controls**

In the `detail.scenes.length === 0` branch, after mutation error messages, add:

```tsx
            {latestFailedGenerationJob ? (
              <div className="mt-3 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm text-accent-foreground">
                <div className="flex items-center gap-2 font-medium">
                  <AlertCircle className="size-4" />
                  Script generation failed
                </div>
                <dl className="mt-2 grid gap-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">Stage</dt>
                    <dd>{textValue(latestFailureOutput?.stage) ?? "workflow"}</dd>
                  </div>
                  {textValue(latestFailureOutput?.failedRole) ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Role</dt>
                      <dd>{textValue(latestFailureOutput?.failedRole)}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="w-24 shrink-0 text-muted-foreground">Reason</dt>
                    <dd>
                      {textValue(latestFailureOutput?.reason) ??
                        latestFailedGenerationJob.errorMessage ??
                        "Generation failed."}
                    </dd>
                  </div>
                  {textValue(latestFailureOutput?.thresholdSummary) ? (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Threshold</dt>
                      <dd>{textValue(latestFailureOutput?.thresholdSummary)}</dd>
                    </div>
                  ) : null}
                </dl>
                {latestFailureScores.length > 0 ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="pr-3 font-medium">Role</th>
                          <th className="pr-3 font-medium">Core</th>
                          <th className="pr-3 font-medium">Generic</th>
                          <th className="font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latestFailureScores.map((score, index) => (
                          <tr key={`${textValue(score.candidateId) ?? "candidate"}-${index}`}>
                            <td className="pr-3 py-1">{textValue(score.roleSource) ?? "-"}</td>
                            <td className="pr-3 py-1">
                              {numberValue(score.coreAverage)?.toFixed(1) ?? "-"}
                            </td>
                            <td className="pr-3 py-1">
                              {numberValue(score.genericRisk)?.toFixed(0) ?? "-"}
                            </td>
                            <td className="py-1">{textValue(score.notes) ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <p className="mt-3 text-xs text-muted-foreground">Try generating again.</p>
              </div>
            ) : null}
```

- [ ] **Step 4: Commit UI failure display**

```bash
git add apps/web/src/features/projects/ProjectWorkflow.tsx
git commit -m "feat: show script candidate failure details"
```

## Task 8: Manual/Static Verification Only

**Files:**

- No source files.

- [ ] **Step 1: Check status**

```bash
git status -sb
```

Expected: branch ahead with commits and no uncommitted source changes.

- [ ] **Step 2: Static scan for removed analytics prompt input**

```bash
rg -n "recentVideos|listRecentYoutubeCreativePromptContext|recent_videos_json|analytics digest|Memory/RAG" packages/ai/src apps/worker/src/handlers/generateScript.ts
```

Expected: no references in role candidate generation or worker script setup. Existing unrelated analytics modules are outside this scan.

- [ ] **Step 3: Static scan for role prompts and judge path**

```bash
rg -n "feed_stop_strategist|broad_object_selector|visual_mechanism_director|retention_architect|loop_payoff_editor|CandidateJudgeAgent|candidate_judge_rejected|candidate_generation_failed" packages/ai/src apps/worker/src apps/web/src/features/projects/ProjectWorkflow.tsx
```

Expected: all five roles, judge prompt, worker terminal failure mapping, and UI display references are present.

- [ ] **Step 4: Static scan for karaoke timing guardrails**

```bash
rg -n "word-level timing|timestamps|beat timings|karaoke timing|caption.*transcript|punch" packages/ai/src/prompts
```

Expected: script/candidate prompts explicitly forbid timing output and keep captions separate from transcripts.

- [ ] **Step 5: Whitespace check**

```bash
git diff --check HEAD~7..HEAD
```

Expected: no output.

- [ ] **Step 6: Manual UI check**

Start the local apps with the smallest useful dev commands for the machine, then:

- create or open a Tiny Mechanisms project with no scenes,
- trigger script generation,
- inspect worker logs for five role candidate calls followed by judge and script,
- if a terminal candidate failure is forced manually, confirm `ProjectWorkflow` displays stage, role/reason or score table,
- confirm no automated test suite was run.

## Task 9: Push Branch

**Files:**

- No source files.

- [ ] **Step 1: Check final commits**

```bash
git log --oneline -n 10
git status -sb
```

- [ ] **Step 2: Push current branch**

If working on `main` by explicit user direction:

```bash
git push origin main
```

If working on a feature branch:

```bash
git push -u origin "$(git branch --show-current)"
```

## Spec Coverage Self-Review

- Five role-based candidate calls: Tasks 2 and 4.
- CandidateJudgeAgent: Tasks 3 and 4.
- No recent analytics in generation prompt: Tasks 2, 4, 6, and Task 8 scan.
- No Memory/RAG or analytics digest: Tasks 2 and 8.
- No QA/vision/image polish calls: no tasks add them.
- Structured visual fields without DB migration: Task 5.
- Terminal failure with UI details: Tasks 1, 6, and 7.
- Prompt history for role outputs, judge output, selected brief, and script prompt: Tasks 4 and 5.
- Legacy static seed path: Task 6 leaves `buildLegacyScriptInput` intact.
- No automated tests in plan: followed throughout per user request.
