import { createHash } from "node:crypto";

import OpenAI from "openai";
import z from "zod";

export const YOUTUBE_DIAGNOSIS_REASONING_EFFORT = "xhigh" as const;

const nonEmptyStringArraySchema = z.array(z.string().min(1));

export const youtubeDiagnosisResponseSchema = z
  .object({
    summaryTh: z.string().min(1),
    likelyCauseTh: z.string().min(1),
    priority: z.enum(["low", "medium", "high"]),
    nextActionsTh: nonEmptyStringArraySchema,
    suggestedTitleEn: nonEmptyStringArraySchema,
    suggestedHookEn: nonEmptyStringArraySchema,
    suggestedVisualPromptEn: nonEmptyStringArraySchema,
    metadataNotesEn: nonEmptyStringArraySchema,
  })
  .strict();

const nonEmptyStringArrayJsonSchema = {
  type: "array",
  items: {
    type: "string",
    minLength: 1,
  },
};

export const YOUTUBE_DIAGNOSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "summaryTh",
    "likelyCauseTh",
    "priority",
    "nextActionsTh",
    "suggestedTitleEn",
    "suggestedHookEn",
    "suggestedVisualPromptEn",
    "metadataNotesEn",
  ],
  properties: {
    summaryTh: {
      type: "string",
      minLength: 1,
    },
    likelyCauseTh: {
      type: "string",
      minLength: 1,
    },
    priority: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    nextActionsTh: nonEmptyStringArrayJsonSchema,
    suggestedTitleEn: nonEmptyStringArrayJsonSchema,
    suggestedHookEn: nonEmptyStringArrayJsonSchema,
    suggestedVisualPromptEn: nonEmptyStringArrayJsonSchema,
    metadataNotesEn: nonEmptyStringArrayJsonSchema,
  },
} as const;

export type YoutubeDiagnosisResponse = z.infer<typeof youtubeDiagnosisResponseSchema>;
export type YoutubeDiagnosisInput = Record<string, unknown>;

type YoutubeDiagnosisClient = Pick<OpenAI, "responses">;

type DiagnoseYoutubeVideoInput = {
  diagnosisInput: YoutubeDiagnosisInput;
  client?: YoutubeDiagnosisClient;
  model?: string;
};

export function buildYoutubeDiagnosisInputHash(input: YoutubeDiagnosisInput): string {
  const hash = createHash("sha256").update(stableJson(input)).digest("hex");

  return `sha256:${hash}`;
}

export function parseYoutubeDiagnosisOutput(value: string): YoutubeDiagnosisResponse {
  return youtubeDiagnosisResponseSchema.parse(JSON.parse(value));
}

export async function diagnoseYoutubeVideo({
  diagnosisInput,
  client: injectedClient,
  model: inputModel,
}: DiagnoseYoutubeVideoInput): Promise<{
  diagnosis: YoutubeDiagnosisResponse;
  model: string;
  reasoningEffort: typeof YOUTUBE_DIAGNOSIS_REASONING_EFFORT | null;
  responseId: string;
  status: OpenAI.Responses.Response["status"];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = inputModel ?? process.env.OPENAI_MODEL ?? "gpt-5.5";

  if (!apiKey && !injectedClient) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const client = injectedClient ?? new OpenAI({ apiKey });
  const usesDefaultReasoning = model === "gpt-5.5";
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "developer",
        content:
          "Diagnose YouTube Shorts performance for Tiny Mechanisms. Return Thai analysis fields and English rewrite suggestions only. Be concrete and conservative. Do not recommend automatic publishing or make unsafe claims.",
      },
      {
        role: "user",
        content: JSON.stringify(diagnosisInput),
      },
    ],
    ...(usesDefaultReasoning
      ? {
          reasoning: {
            effort: YOUTUBE_DIAGNOSIS_REASONING_EFFORT,
          },
        }
      : {}),
    text: {
      format: {
        type: "json_schema",
        name: "youtube_video_diagnosis_v1",
        schema: YOUTUBE_DIAGNOSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });
  const diagnosis = parseYoutubeDiagnosisOutput(extractResponseText(response));

  return {
    diagnosis,
    model: response.model ?? model,
    reasoningEffort: usesDefaultReasoning ? YOUTUBE_DIAGNOSIS_REASONING_EFFORT : null,
    responseId: response.id,
    status: response.status,
  };
}

function stableJson(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonArrayValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => isJsonObjectValue(item))
        .sort(([leftKey], [rightKey]) => compareJsonKeys(leftKey, rightKey))
        .map(([key, item]) => [key, normalizeJsonValue(item)]),
    );
  }

  return value;
}

function normalizeJsonArrayValue(value: unknown): unknown {
  if (isJsonObjectValue(value)) {
    return normalizeJsonValue(value);
  }

  return null;
}

function isJsonObjectValue(value: unknown): boolean {
  return value !== undefined && typeof value !== "function" && typeof value !== "symbol";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function compareJsonKeys(leftKey: string, rightKey: string): number {
  if (leftKey < rightKey) {
    return -1;
  }

  if (leftKey > rightKey) {
    return 1;
  }

  return 0;
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
    throw new Error("youtube_diagnosis_response_invalid");
  }

  return text;
}
