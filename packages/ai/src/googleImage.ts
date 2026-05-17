import { GoogleGenAI, Modality } from "@google/genai";

import type { GenerateImageInput, GenerateImageOutput } from "./types";

type GoogleImageClient = {
  models: {
    generateContent(input: {
      model: string;
      contents: string;
      config: {
        responseModalities: Modality[];
      };
    }): Promise<GoogleImageResponse>;
  };
};

type GoogleImageResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
  }>;
};

export async function generateGoogleImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY_missing");
  }

  const client = new GoogleGenAI({ apiKey });
  return generateGoogleImageWithClient(client, input);
}

export async function generateGoogleImageWithClient(
  client: GoogleImageClient,
  input: GenerateImageInput,
): Promise<GenerateImageOutput> {
  const model = input.model ?? process.env.GOOGLE_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const data = await client.models.generateContent({
    model,
    contents: input.prompt,
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  const imagePart = findInlineImagePart(data);
  if (!imagePart) {
    throw new Error("google_image_response_invalid");
  }

  return {
    bytes: decodeBase64(imagePart.data),
    mimeType: "image/png",
    model,
    provider: "google_gemini",
    responseMetadata: {
      model_id: model,
      mime_type: imagePart.mimeType,
      prompt_metadata: input.promptMetadata,
      finish_reason: data.candidates?.[0]?.finishReason,
      candidate_count: data.candidates?.length ?? 0,
    },
  };
}

function findInlineImagePart(
  data: GoogleImageResponse,
): { data: string; mimeType: string } | undefined {
  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inlineData = part.inlineData;
      if (inlineData?.data && inlineData.mimeType?.startsWith("image/")) {
        return { data: inlineData.data, mimeType: inlineData.mimeType };
      }
    }
  }

  return undefined;
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
