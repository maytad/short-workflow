import { describe, expect, test } from "bun:test";

import { computeSceneStatus } from "./scenes";

describe("computeSceneStatus", () => {
  test("returns ready when required content fields are non-empty after trim", () => {
    expect(
      computeSceneStatus({
        narration: " Narration ",
        caption: " Caption ",
        imagePrompt: " Image prompt ",
        ssml: " <speak>Voice</speak> ",
      }),
    ).toBe("ready");
  });

  test("returns draft when any required content field is blank after trim", () => {
    expect(
      computeSceneStatus({
        narration: "Narration",
        caption: " ",
        imagePrompt: "Image prompt",
        ssml: "<speak>Voice</speak>",
      }),
    ).toBe("draft");
  });
});
