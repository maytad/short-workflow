import { describe, expect, test } from "bun:test";

import { findActiveWord, getSceneDurationFrames, getTotalDurationFrames, resolveMediaSrc } from "./ShortVideo";

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
    const firstScene = scenes[0];

    expect(firstScene).toBeDefined();
    if (!firstScene) {
      throw new Error("Expected first scene");
    }

    expect(getSceneDurationFrames(firstScene, 30)).toBe(75);
    expect(getTotalDurationFrames(scenes, 30)).toBe(113);
  });
});

describe("findActiveWord", () => {
  const words = [
    { text: "Hello", start: 0.0, end: 0.4 },
    { text: "world", start: 0.4, end: 0.9 },
    { text: "today", start: 0.9, end: 1.5 },
  ];

  test("returns the word whose window contains the current time", () => {
    expect(findActiveWord(words, 0.2)).toEqual(words[0]);
    expect(findActiveWord(words, 0.5)).toEqual(words[1]);
    expect(findActiveWord(words, 1.0)).toEqual(words[2]);
  });

  test("returns null when no word is active", () => {
    expect(findActiveWord(words, 1.6)).toBeNull();
  });

  test("treats start as inclusive and end as exclusive", () => {
    expect(findActiveWord(words, 0.4)).toEqual(words[1]);
    expect(findActiveWord(words, 0.0)).toEqual(words[0]);
  });

  test("returns null for an empty word list", () => {
    expect(findActiveWord([], 0.5)).toBeNull();
  });
});
