import OpenAI from "openai";

import {
  CANDIDATE_JUDGE_JSON_SCHEMA,
  candidateJudgePrompt,
  parseCandidateJudgeResult,
  type CandidateJudgeInput,
  type CandidateJudgeResult,
  type RefinedEpisodeBrief,
} from "./prompts/episodeJudge";
import {
  EPISODE_CANDIDATE_ROLES,
  episodeResearchJsonSchemaForRole,
  episodeResearchPrompt,
  parseRoleEpisodeCandidateResponse,
  type EpisodeCandidate,
  type EpisodeCandidateRole,
  type EpisodeResearchInput,
  type RoleEpisodeCandidateResponse,
} from "./prompts/episodeResearch";
import { promptPayload } from "./prompts/types";

export type GenerateEpisodeResearchOutput = {
  candidates: RoleEpisodeCandidateResponse[];
  judge: CandidateJudgeResult;
  selectedCandidate: EpisodeCandidate;
  refinedBrief: RefinedEpisodeBrief;
  promptPayload: Record<string, unknown>;
  responseText: string;
  responseMetadata: Record<string, unknown>;
};

type RoleCandidateGenerationResult = {
  candidateResponse: RoleEpisodeCandidateResponse;
  promptPayload: Record<string, unknown>;
  responseMetadata: Record<string, unknown>;
};

type CandidateJudgeGenerationResult = {
  judge: CandidateJudgeResult;
  promptPayload: Record<string, unknown>;
  responseMetadata: Record<string, unknown>;
};

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

  for (const [index, result] of roleResults.entries()) {
    if (result.status === "rejected") {
      const role = EPISODE_CANDIDATE_ROLES[index] as EpisodeCandidateRole;
      throw new EpisodeCandidateRoleError(role, result.reason);
    }
  }

  const roleCandidateResults = roleResults.map(
    (result) => (result as PromiseFulfilledResult<RoleCandidateGenerationResult>).value,
  );
  const candidates = roleCandidateResults.map((result) => result.candidateResponse);
  const rolePromptPayloads = roleCandidateResults.map((result) => result.promptPayload);
  const roleResponseMetadata = roleCandidateResults.map((result) => result.responseMetadata);
  const candidateTuple = toCandidateJudgeTuple(candidates.map((candidate) => candidate.candidate));
  const judgeResult = await judgeEpisodeCandidates(client, model, {
    channelPresetId: input.channelPresetId,
    targetDurationSeconds: input.targetDurationSeconds,
    candidates: candidateTuple,
  });
  const { judge } = judgeResult;

  if (judge.status === "rejected") {
    throw new EpisodeCandidateJudgeRejection(judge);
  }

  const selectedCandidate = candidates.find(
    (candidate) => candidate.candidate.candidateId === judge.selectedCandidateId,
  )?.candidate;
  if (!selectedCandidate) {
    throw new Error("candidate_judge_selection_missing");
  }
  if (judge.selectedRoleSource !== selectedCandidate.roleSource) {
    throw new Error("candidate_judge_role_mismatch");
  }
  if (judge.refinedBrief.roleSource !== selectedCandidate.roleSource) {
    throw new Error("candidate_judge_refined_role_mismatch");
  }
  if (judge.refinedBrief.candidateId !== selectedCandidate.candidateId) {
    throw new Error("candidate_judge_refined_candidate_mismatch");
  }

  return {
    candidates,
    judge,
    selectedCandidate,
    refinedBrief: judge.refinedBrief,
    promptPayload: {
      source: input,
      rolePromptPayloads,
      roleCandidates: candidates,
      judgePromptPayload: judgeResult.promptPayload,
      selectedRefinedBrief: judge.refinedBrief,
    },
    responseText: JSON.stringify({ candidates, judge }),
    responseMetadata: {
      requested_model_id: model,
      role_response_metadata: roleResponseMetadata,
      judge_response_metadata: judgeResult.responseMetadata,
    },
  };
}

async function generateRoleCandidate(
  client: OpenAI,
  model: string,
  input: EpisodeResearchInput,
): Promise<RoleCandidateGenerationResult> {
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
        schema: episodeResearchJsonSchemaForRole(input.role) as unknown as Record<string, unknown>,
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

async function judgeEpisodeCandidates(
  client: OpenAI,
  model: string,
  input: CandidateJudgeInput,
): Promise<CandidateJudgeGenerationResult> {
  const compiled = candidateJudgePrompt.compile(input);
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
        schema: CANDIDATE_JUDGE_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const rawResponseText = extractResponseText(response, "candidate_judge_response_invalid");
  const judge = parseCandidateJudgeResult(parseJsonObject(rawResponseText));

  return {
    judge,
    promptPayload: promptPayload(compiled, input),
    responseMetadata: responseMetadata(response, compiled.schemaName, compiled.schemaVersion),
  };
}

function toCandidateJudgeTuple(
  candidates: EpisodeCandidate[],
): CandidateJudgeInput["candidates"] {
  if (candidates.length !== 5) {
    throw new Error("candidate_judge_requires_five_candidates");
  }

  return candidates as CandidateJudgeInput["candidates"];
}

function parseJsonObject(responseText: string): unknown {
  try {
    return JSON.parse(responseText);
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("episode_research_response_invalid");
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new Error("episode_research_response_invalid");
    }
  }
}

function extractResponseText(response: OpenAI.Responses.Response, invalidMessage: string): string {
  if (response.error) {
    throw errorWithCause(invalidMessage, response.error);
  }
  if (response.status && response.status !== "completed") {
    throw errorWithCause(invalidMessage, {
      status: response.status,
      incompleteDetails: response.incomplete_details,
    });
  }

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

function errorWithCause(message: string, cause: unknown): Error {
  return Object.assign(new Error(message), { cause });
}

function responseMetadata(
  response: OpenAI.Responses.Response,
  schemaName: string,
  schemaVersion: number,
): Record<string, unknown> {
  return {
    model_id: response.model,
    finish_reason: extractFinishReason(response),
    response_id: response.id,
    status: response.status,
    schema_name: schemaName,
    schema_version: schemaVersion,
  };
}

function extractFinishReason(response: OpenAI.Responses.Response): string | undefined {
  for (const output of response.output ?? []) {
    if (output.type === "message" && typeof output.status === "string") {
      return output.status;
    }
  }

  return response.status;
}
