import { describe, expect, test } from "bun:test";

import { chunkWords, getSceneDurationFrames, getTotalDurationFrames, pickActiveIndex, resolveMediaSrc } from "./ShortVideo";

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

describe("pickActiveIndex", () => {
  const words = [
    { text: "Hello", start: 0.0, end: 0.4 },
    { text: "world", start: 0.4, end: 0.9 },
    { text: "today", start: 0.9, end: 1.5 },
  ] as const;

  test("returns the index of the word whose window contains the current time", () => {
    expect(pickActiveIndex(words, 0.2)).toBe(0);
    expect(pickActiveIndex(words, 0.5)).toBe(1);
    expect(pickActiveIndex(words, 1.0)).toBe(2);
  });

  test("returns -1 when no word is active", () => {
    expect(pickActiveIndex(words, 1.6)).toBe(-1);
  });

  test("treats start as inclusive and end as exclusive", () => {
    expect(pickActiveIndex(words, 0.4)).toBe(1);
    expect(pickActiveIndex(words, 0.0)).toBe(0);
  });

  test("returns -1 for an empty word list", () => {
    expect(pickActiveIndex([], 0.5)).toBe(-1);
  });

  test("extends a word through the silence before the next word", () => {
    // ElevenLabs typically leaves 30-80ms of silence between words. The
    // highlight should stay on the previous word during that gap to avoid
    // flicker — only the post-roll (after the final word) returns -1.
    const gappy = [
      { text: "Hi", start: 0.0, end: 0.3 },
      { text: "there", start: 0.5, end: 0.9 },
    ] as const;
    expect(pickActiveIndex(gappy, 0.4)).toBe(0); // gap between words
    expect(pickActiveIndex(gappy, 0.5)).toBe(1); // next word starts
    expect(pickActiveIndex(gappy, 0.95)).toBe(-1); // post-roll
  });
});

describe("chunkWords", () => {
  test("splits on sentence-ending punctuation", () => {
    const words = [
      { text: "Hello", start: 0, end: 0.3 },
      { text: "world.", start: 0.3, end: 0.7 },
      { text: "How", start: 0.7, end: 0.9 },
      { text: "are", start: 0.9, end: 1.1 },
      { text: "you?", start: 1.1, end: 1.5 },
    ] as const;
    const chunks = chunkWords(words, { target: 5, min: 4, max: 6 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.map((e) => e.word.text)).toEqual(["Hello", "world."]);
    expect(chunks[1]?.map((e) => e.word.text)).toEqual(["How", "are", "you?"]);
  });

  test("preserves original word indices", () => {
    const words = [
      { text: "a", start: 0, end: 0.1 },
      { text: "b", start: 0.1, end: 0.2 },
      { text: "c.", start: 0.2, end: 0.3 },
      { text: "d", start: 0.3, end: 0.4 },
    ] as const;
    const chunks = chunkWords(words, { target: 5, min: 4, max: 6 });
    expect(chunks[0]?.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(chunks[1]?.map((e) => e.index)).toEqual([3]);
  });
});

