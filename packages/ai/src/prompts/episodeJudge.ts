import { z } from "zod";
import {
  candidateScoreJsonSchema,
  EPISODE_CANDIDATE_ROLES,
  type EpisodeCandidate,
  episodeCandidateRoleSchema,
} from "./episodeResearch";
import {
  TINY_MECHANISMS_CHANNEL_BIBLE,
  type TINY_MECHANISMS_PRESET_ID,
} from "./presets/tinyMechanisms";
import { SHORTS_RECOVERY_JUDGE_RULES } from "./shortsRecovery";
import type { CompiledPrompt, PromptTemplate } from "./types";

export const candidateJudgeScoreSchema = z
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

const selectedCandidateJudgeResultSchema = z
  .object({
    status: z.literal("selected"),
    scoreTable: z.array(candidateJudgeScoreSchema).length(5),
    selectedCandidateId: z.string().min(1),
    selectedRoleSource: episodeCandidateRoleSchema,
    selectionRationale: z.string().min(1),
    refinedBrief: refinedEpisodeBriefSchema,
  })
  .strict();

const rejectedCandidateJudgeResultSchema = z
  .object({
    status: z.literal("rejected"),
    scoreTable: z.array(candidateJudgeScoreSchema).length(5),
    failureReason: z.string().min(1),
    thresholdSummary: z.string().min(1),
  })
  .strict();

export const candidateJudgeResultContainerSchema = z
  .object({
    result: z.union([selectedCandidateJudgeResultSchema, rejectedCandidateJudgeResultSchema]),
  })
  .strict();

export type CandidateJudgeScore = z.infer<typeof candidateJudgeScoreSchema>;
export type RefinedEpisodeBrief = z.infer<typeof refinedEpisodeBriefSchema>;
export type CandidateJudgeResult = z.infer<typeof candidateJudgeResultContainerSchema>["result"];

function computedCoreAverage(score: CandidateJudgeScore) {
  return (
    (score.firstFrameClarity +
      score.swipeResistance +
      score.broadObjectFamiliarity +
      score.visualNovelty +
      score.retentionPath +
      score.loopPayoffStrength) /
    6
  );
}

export type CandidateJudgeInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  candidates: [
    EpisodeCandidate,
    EpisodeCandidate,
    EpisodeCandidate,
    EpisodeCandidate,
    EpisodeCandidate,
  ];
};

export type CompiledCandidateJudgePrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_candidate_judge_v1";
  schemaVersion: 1;
};

export const CANDIDATE_JUDGE_SCORE_JSON_SCHEMA = {
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

export const REFINED_EPISODE_BRIEF_JSON_SCHEMA = {
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
    avoidAngles: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
  },
} as const;

const CANDIDATE_JUDGE_SCORES_ARRAY_JSON_SCHEMA = {
  type: "array",
  minItems: 5,
  maxItems: 5,
  items: CANDIDATE_JUDGE_SCORE_JSON_SCHEMA,
} as const;

const SELECTED_CANDIDATE_JUDGE_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "status",
    "scoreTable",
    "selectedCandidateId",
    "selectedRoleSource",
    "selectionRationale",
    "refinedBrief",
  ],
  properties: {
    status: { type: "string", enum: ["selected"] },
    scoreTable: CANDIDATE_JUDGE_SCORES_ARRAY_JSON_SCHEMA,
    selectedCandidateId: { type: "string", minLength: 1 },
    selectedRoleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    selectionRationale: { type: "string", minLength: 1 },
    refinedBrief: REFINED_EPISODE_BRIEF_JSON_SCHEMA,
  },
} as const;

const REJECTED_CANDIDATE_JUDGE_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "scoreTable", "failureReason", "thresholdSummary"],
  properties: {
    status: { type: "string", enum: ["rejected"] },
    scoreTable: CANDIDATE_JUDGE_SCORES_ARRAY_JSON_SCHEMA,
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
      anyOf: [
        SELECTED_CANDIDATE_JUDGE_RESULT_JSON_SCHEMA,
        REJECTED_CANDIDATE_JUDGE_RESULT_JSON_SCHEMA,
      ],
    },
  },
} as const;

export const candidateJudgePrompt: PromptTemplate<
  CandidateJudgeInput,
  CompiledCandidateJudgePrompt
> = {
  id: "tiny_mechanisms_candidate_judge",
  version: 3,
  purpose: "script",
  provider: "openai",
  compile(input) {
    if (input.candidates.length !== 5) {
      throw new Error("candidate_judge_requires_five_candidates");
    }

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
            `You are CandidateJudgeAgent for Tiny Mechanisms, a strict selection judge for a ${input.targetDurationSeconds}-second YouTube Short feed test.`,
            "",
            "# Channel",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "",
            "# Inputs",
            "Use only the supplied candidates, channel preset, target duration, and channel bible.",
            "Do not use recent analytics, memory, retrieval, external research, or unstated prior performance.",
            "",
            "# Shorts Recovery Policy",
            ...SHORTS_RECOVERY_JUDGE_RULES,
            "For this recovery batch, penalize perception, biology, voice, onions, abstract physics gimmicks, calm product shots, clean diagrams, and repeated cabinet or push-latch variants.",
            "",
            "# Task",
            "Score all 5 candidates independently.",
            "Select only if a candidate clears the threshold.",
            "The coreAverage is the average of firstFrameClarity, swipeResistance, broadObjectFamiliarity, visualNovelty, retentionPath, and loopPayoffStrength.",
            "A selected candidate must have coreAverage >= 4 and genericRisk <= 2.",
            "For genericRisk, 1 means low generic risk and 5 means high generic risk.",
            "Do not choose by familiar mechanism strength alone. Reward the candidate that opens the widest fresh creative territory while staying visually clear.",
            "Treat familiar mechanisms as high generic risk only when the first frame is calm, diagrammatic, repeated, or visually indistinct from recent videos.",
            "Penalize candidates that lack a visible moving or tension state unless the visual proof is unusually immediate and concrete.",
            "Prefer candidates whose object, hidden cause, first-frame behavior, and reveal path differ from the other candidates in the batch.",
            "If one candidate clears the threshold, choose the strongest fresh candidate for the feed test.",
            "If no candidate clears the threshold, return rejected with failureReason and thresholdSummary.",
            "If selected, refine the winner into a production brief without inventing a new topic.",
            "The refined brief must preserve the selected candidate's object or mechanism, central question, visual reveal, and loop payoff.",
            "English only.",
            "",
            "# Output",
            "Return JSON that follows the supplied schema.",
            "Wrap the selected or rejected object under the top-level result key.",
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

export function parseCandidateJudgeResult(value: unknown): CandidateJudgeResult {
  const parsed = candidateJudgeResultContainerSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("candidate_judge_result_invalid");
  }

  const { result } = parsed.data;
  if (result.status === "rejected") {
    const validCandidateExists = result.scoreTable.some(
      (score) => computedCoreAverage(score) >= 4 && score.genericRisk <= 2,
    );
    if (validCandidateExists) {
      throw new Error("candidate_judge_rejected_valid_candidate");
    }

    return result;
  }

  const selectedScore = result.scoreTable.find(
    (score) => score.candidateId === result.selectedCandidateId,
  );
  if (
    selectedScore === undefined ||
    result.selectedRoleSource !== selectedScore.roleSource ||
    result.refinedBrief.candidateId !== result.selectedCandidateId ||
    result.refinedBrief.roleSource !== selectedScore.roleSource
  ) {
    throw new Error("candidate_judge_result_invalid");
  }

  if (computedCoreAverage(selectedScore) < 4 || selectedScore.genericRisk > 2) {
    throw new Error("candidate_judge_result_invalid");
  }

  return result;
}
