import OpenAI from "openai";

import {
  parseScriptPlan,
  SCRIPT_PLAN_JSON_SCHEMA,
  scriptPlanPrompt,
} from "./prompts/scriptPlan";
import { promptPayload } from "./prompts/types";
import type { GenerateScriptInput, GenerateScriptOutput } from "./types";

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

function parseJsonObject(responseText: string): unknown {
  try {
    return JSON.parse(responseText);
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("script_response_invalid");
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      throw new Error("script_response_invalid");
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
    throw new Error("script_response_invalid");
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
