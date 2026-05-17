import { afterEach, expect, test } from "bun:test";

import { generateImage } from "./googleImage";
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

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
