import { afterEach, expect, test } from "bun:test";

import { generateGoogleImageWithClient } from "./googleImage";
import { generateImage, generateImageWithProviders } from "./image";
import { generateScript } from "./openai";
import { generateOpenAIImageWithClient } from "./openaiImage";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalGoogleApiKey = process.env.GOOGLE_API_KEY;
const originalImageProvider = process.env.IMAGE_PROVIDER;
const originalOpenAiImageModel = process.env.OPENAI_IMAGE_MODEL;
const originalOpenAiImageSize = process.env.OPENAI_IMAGE_SIZE;

afterEach(() => {
  restoreEnv("OPENAI_API_KEY", originalOpenAiKey);
  restoreEnv("GOOGLE_API_KEY", originalGoogleApiKey);
  restoreEnv("IMAGE_PROVIDER", originalImageProvider);
  restoreEnv("OPENAI_IMAGE_MODEL", originalOpenAiImageModel);
  restoreEnv("OPENAI_IMAGE_SIZE", originalOpenAiImageSize);
});

test("generateScript throws before provider call when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;

  await expect(
    generateScript({ topic: "local coffee shop", targetDurationSeconds: 30 }),
  ).rejects.toThrow("OPENAI_API_KEY_missing");
});

test("generateImage defaults to OpenAI image generation", async () => {
  const calls: string[] = [];

  const result = await generateImageWithProviders(
    { prompt: "A vertical photo of a desk setup" },
    {
      openai: async () => {
        calls.push("openai");
        return {
          bytes: Uint8Array.from(Buffer.from("openai-image")),
          mimeType: "image/png",
          model: "gpt-image-2",
          provider: "openai",
          responseMetadata: {},
        };
      },
      googleGemini: async () => {
        calls.push("google_gemini");
        throw new Error("unexpected_google_provider");
      },
    },
  );

  expect(calls).toEqual(["openai"]);
  expect(result.provider).toBe("openai");
  expect(result.model).toBe("gpt-image-2");
});

test("generateImage can route to Google Gemini image generation", async () => {
  process.env.IMAGE_PROVIDER = "google_gemini";
  const calls: string[] = [];

  const result = await generateImageWithProviders(
    { prompt: "A vertical photo of a desk setup" },
    {
      openai: async () => {
        calls.push("openai");
        throw new Error("unexpected_openai_provider");
      },
      googleGemini: async () => {
        calls.push("google_gemini");
        return {
          bytes: Uint8Array.from(Buffer.from("google-image")),
          mimeType: "image/png",
          model: "gemini-2.5-flash-image",
          provider: "google_gemini",
          responseMetadata: {},
        };
      },
    },
  );

  expect(calls).toEqual(["google_gemini"]);
  expect(result.provider).toBe("google_gemini");
  expect(result.model).toBe("gemini-2.5-flash-image");
});

test("generateImage throws before OpenAI provider call when OPENAI_API_KEY is missing", async () => {
  delete process.env.IMAGE_PROVIDER;
  delete process.env.OPENAI_API_KEY;

  await expect(generateImage({ prompt: "A vertical photo of a desk setup" })).rejects.toThrow(
    "OPENAI_API_KEY_missing",
  );
});

test("generateImage throws before Google provider call when GOOGLE_API_KEY is missing", async () => {
  process.env.IMAGE_PROVIDER = "google_gemini";
  delete process.env.GOOGLE_API_KEY;

  await expect(generateImage({ prompt: "A vertical photo of a desk setup" })).rejects.toThrow(
    "GOOGLE_API_KEY_missing",
  );
});

test("generateOpenAIImageWithClient requests gpt-image-2 image content", async () => {
  const requests: unknown[] = [];
  const imageBytes = Buffer.from("fake-openai-image").toString("base64");
  const client = {
    images: {
      generate: async (request: unknown) => {
        requests.push(request);

        return {
          created: 1_777_777_777,
          data: [
            {
              b64_json: imageBytes,
              revised_prompt: "A vertical photo of a desk setup.",
            },
          ],
          output_format: "png",
          quality: "auto",
          size: "1088x1920",
        };
      },
    },
  };

  const result = await generateOpenAIImageWithClient(client, {
    prompt: "A vertical photo of a desk setup",
  });

  expect(requests).toEqual([
    {
      model: "gpt-image-2",
      prompt: "A vertical photo of a desk setup",
      n: 1,
      output_format: "png",
      quality: "auto",
      size: "1088x1920",
    },
  ]);
  expect(result.bytes).toEqual(Uint8Array.from(Buffer.from("fake-openai-image")));
  expect(result.mimeType).toBe("image/png");
  expect(result.model).toBe("gpt-image-2");
  expect(result.provider).toBe("openai");
  expect(result.responseMetadata).toEqual({
    model_id: "gpt-image-2",
    created: 1_777_777_777,
    output_format: "png",
    quality: "auto",
    revised_prompt: "A vertical photo of a desk setup.",
    size: "1088x1920",
  });
});

test("generateImageWithClient requests image content through Google GenAI client", async () => {
  const requests: unknown[] = [];
  const imageBytes = Buffer.from("fake-image").toString("base64");
  const client = {
    models: {
      generateContent: async (request: unknown) => {
        requests.push(request);

        return {
          candidates: [
            {
              finishReason: "STOP",
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: imageBytes,
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    },
  };

  const result = await generateGoogleImageWithClient(client, {
    prompt: "A vertical photo of a desk setup",
    model: "gemini-2.5-flash-image",
  });

  expect(requests).toEqual([
    {
      model: "gemini-2.5-flash-image",
      contents: "A vertical photo of a desk setup",
      config: {
        responseModalities: ["IMAGE"],
      },
    },
  ]);
  expect(result.bytes).toEqual(Uint8Array.from(Buffer.from("fake-image")));
  expect(result.mimeType).toBe("image/png");
  expect(result.model).toBe("gemini-2.5-flash-image");
  expect(result.provider).toBe("google_gemini");
  expect(result.responseMetadata).toEqual({
    model_id: "gemini-2.5-flash-image",
    mime_type: "image/png",
    finish_reason: "STOP",
    candidate_count: 1,
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
