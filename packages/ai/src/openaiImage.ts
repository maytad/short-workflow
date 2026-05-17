import OpenAI from "openai";

import type { GenerateImageInput, GenerateImageOutput } from "./types";

type OpenAIImageClient = {
  images: {
    generate(input: {
      model: string;
      prompt: string;
      n: 1;
      output_format: "png";
      quality: "auto";
      size: string;
    }): Promise<OpenAIImageResponse>;
  };
};

type OpenAIImageResponse = {
  created?: number;
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
  }>;
  output_format?: string;
  quality?: string;
  size?: string;
};

export async function generateOpenAIImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY_missing");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  return generateOpenAIImageWithClient(client, input);
}

export async function generateOpenAIImageWithClient(
  client: OpenAIImageClient,
  input: GenerateImageInput,
): Promise<GenerateImageOutput> {
  const model = input.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const size = process.env.OPENAI_IMAGE_SIZE ?? "1088x1920";
  const response = await client.images.generate({
    model,
    prompt: input.prompt,
    n: 1,
    output_format: "png",
    quality: "auto",
    size,
  });
  const image = response.data?.find((item) => item.b64_json);

  if (!image?.b64_json) {
    throw new Error("openai_image_response_invalid");
  }

  return {
    bytes: decodeBase64(image.b64_json),
    mimeType: "image/png",
    model,
    provider: "openai",
    responseMetadata: {
      model_id: model,
      created: response.created,
      output_format: response.output_format,
      quality: response.quality,
      revised_prompt: image.revised_prompt,
      size: response.size,
    },
  };
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}
