import { describe, expect, test } from "bun:test";

import { getSceneDurationFrames, getTotalDurationFrames, resolveMediaSrc } from "./ShortVideo";

describe("ShortVideo helpers", () => {
  test("uses file URLs for absolute media paths", () => {
    expect(resolveMediaSrc("/tmp/render-assets/scene-1.png")).toBe(
      "file:///tmp/render-assets/scene-1.png",
    );
  });

  test("falls back to Remotion static files for relative media paths", () => {
    expect(resolveMediaSrc("scene-1.png")).toBe("/scene-1.png");
  });

  test("computes scene and total duration in frames", () => {
    const scenes = [{ durationSeconds: 2.5 }, { durationSeconds: 1 }, { durationSeconds: 0.25 }];

    expect(getSceneDurationFrames(scenes[0]!, 30)).toBe(75);
    expect(getTotalDurationFrames(scenes, 30)).toBe(113);
  });
});
