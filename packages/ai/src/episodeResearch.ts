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
  const research = parseEpisodeResearch(parseJsonObject(rawResponseText));
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
