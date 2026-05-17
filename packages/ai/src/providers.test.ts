import { afterEach, expect, test } from "bun:test";

import { generateImage, generateImageWithClient } from "./googleImage";
import { generateScript } from "./openai";

const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalGoogleApiKey = process.env.GOOGLE_API_KEY;

afterEach(() => {
  restoreEnv("OPENAI_API_KEY", originalOpenAiKey);
  restoreEnv("GOOGLE_API_KEY", originalGoogleApiKey);
});

test("generateScript throws before provider call when OPENAI_API_KEY is missing", async () => {
  delete process.env.OPENAI_API_KEY;

  await expect(
    generateScript({ topic: "local coffee shop", targetDurationSeconds: 30 }),
  ).rejects.toThrow("OPENAI_API_KEY_missing");
});

test("generateImage throws before provider call when GOOGLE_API_KEY is missing", async () => {
  delete process.env.GOOGLE_API_KEY;

  await expect(generateImage({ prompt: "A vertical photo of a desk setup" })).rejects.toThrow(
    "GOOGLE_API_KEY_missing",
  );
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

  const result = await generateImageWithClient(client, {
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
