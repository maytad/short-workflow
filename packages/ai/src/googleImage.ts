import type { GenerateImageOutput } from "./types";

type GoogleImagePart = {
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
};

type GoogleImageResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: GoogleImagePart[];
    };
  }>;
};

export async function generateImage(input: {
  prompt: string;
  model?: string;
}): Promise<GenerateImageOutput> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY_missing");
  }

  const model = input.model ?? process.env.GOOGLE_IMAGE_MODEL ?? "gemini-2.5-flash-image-preview";
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`google_image_request_failed:${response.status}`);
  }

  const data = (await response.json()) as GoogleImageResponse;
  const imagePart = findInlineImagePart(data);
  if (!imagePart) {
    throw new Error("google_image_response_invalid");
  }

  return {
    bytes: decodeBase64(imagePart.data),
    mimeType: "image/png",
    model,
    responseMetadata: {
      model_id: model,
      mime_type: imagePart.mimeType,
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

      const inlineDataSnake = part.inline_data;
      if (inlineDataSnake?.data && inlineDataSnake.mime_type?.startsWith("image/")) {
        return { data: inlineDataSnake.data, mimeType: inlineDataSnake.mime_type };
      }
    }
  }

  return undefined;
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
