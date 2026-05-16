import OpenAI from "openai";
import { z } from "zod";

import type { GenerateScriptInput, GenerateScriptOutput, ScriptScene } from "./types";

const sceneRolesByDuration = {
  30: ["hook", "context", "point", "payoff", "cta"],
  45: ["hook", "context", "point", "point", "payoff", "cta"],
  60: ["hook", "context", "point", "point", "point", "payoff", "cta"],
} as const satisfies Record<GenerateScriptInput["targetDurationSeconds"], readonly ScriptScene["role"][]>;

const sceneSchema = z.object({
  position: z.number().int().positive(),
  role: z.enum(["hook", "context", "point", "payoff", "cta"]),
  durationSeconds: z.number().positive(),
  narration: z.string().min(1),
  caption: z.string().min(1),
  imagePrompt: z.string().min(1),
  ssml: z.string().min(1),
});

const scriptSchema = z.object({
  title: z.string().min(1),
  scenes: z.array(sceneSchema),
});

export async function generateScript(input: GenerateScriptInput): Promise<GenerateScriptOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const roles = sceneRolesByDuration[input.targetDurationSeconds];
  const client = new OpenAI({ apiKey });
  const prompt = buildPrompt(input, roles);

  const response = await client.responses.create({
    model,
    input: prompt,
  });

  const rawResponseText = extractResponseText(response);
  const parsedJson = parseJsonObject(rawResponseText);
  const parsed = scriptSchema.safeParse(parsedJson);
  if (!parsed.success || !hasExpectedScenePlan(parsed.data.scenes, roles)) {
    throw new Error("script_response_invalid");
  }

  return {
    title: parsed.data.title,
    scenes: parsed.data.scenes,
    responseText: JSON.stringify(parsed.data),
    responseMetadata: {
      model_id: response.model,
      finish_reason: extractFinishReason(response),
      response_id: response.id,
      status: response.status,
    },
  };
}

function buildPrompt(input: GenerateScriptInput, roles: readonly ScriptScene["role"][]): string {
  const rolesList = roles.join(", ");
  return [
    "Create a concise script plan for an English 9:16 short-form video.",
    `Topic: ${input.topic}`,
    `Target duration: ${input.targetDurationSeconds} seconds.`,
    `Return exactly ${roles.length} scenes with these roles in order: ${rolesList}.`,
    "All narration, captions, image prompts, and SSML must be English-only.",
    "Captions should be short on-screen text. Image prompts should describe a vertical visual for the scene.",
    "SSML must be valid speakable SSML using a single <speak> root.",
    "Return only compact JSON with this shape:",
    '{"title":"string","scenes":[{"position":1,"role":"hook","durationSeconds":6,"narration":"string","caption":"string","imagePrompt":"string","ssml":"<speak>string</speak>"}]}',
  ].join("\n");
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

function hasExpectedScenePlan(
  scenes: ScriptScene[],
  roles: readonly ScriptScene["role"][],
): boolean {
  if (scenes.length !== roles.length) {
    return false;
  }

  return scenes.every((scene, index) => scene.position === index + 1 && scene.role === roles[index]);
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
