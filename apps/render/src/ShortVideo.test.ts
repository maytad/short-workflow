import { describe, expect, test } from "bun:test";

import {
  chunkWords,
  getSceneDurationFrames,
  getSceneMotionStyle,
  getTotalDurationFrames,
  pickActiveIndex,
  resolveMediaSrc,
  sceneMotionProfile,
} from "./ShortVideo";

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

describe("scene motion", () => {
  test("uses a stronger first beat for hook scenes", () => {
    const hook = sceneMotionProfile("hook", 1, 30);
    const context = sceneMotionProfile("context", 2, 30);

    expect(hook.beatEveryFrames).toBeLessThan(context.beatEveryFrames);
    expect(hook.pulseScale).toBeGreaterThan(context.pulseScale);
    expect(hook.baseScaleEnd).toBeGreaterThan(hook.baseScaleStart);
  });

  test("produces deterministic pan and punch-in values over a scene", () => {
    const start = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 0,
      position: 1,
      role: "hook",
    });
    const middle = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 75,
      position: 1,
      role: "hook",
    });
    const end = getSceneMotionStyle({
      durationInFrames: 180,
      fps: 30,
      frame: 179,
      position: 1,
      role: "hook",
    });

    expect(start.scale).toBeGreaterThan(1);
    expect(middle.scale).toBeGreaterThan(start.scale);
    expect(end.scale).toBeGreaterThan(start.scale);
    expect(start.translateX).not.toBe(end.translateX);
    expect(start.overlayOpacity).toBeGreaterThan(end.overlayOpacity);
  });

  test("keeps point scenes visually emphasized without hiding captions", () => {
    const style = getSceneMotionStyle({
      durationInFrames: 210,
      fps: 30,
      frame: 90,
      position: 3,
      role: "point",
    });

    expect(style.scale).toBeGreaterThan(1.04);
    expect(style.overlayOpacity).toBeGreaterThanOrEqual(0);
    expect(style.overlayOpacity).toBeLessThanOrEqual(0.22);
    expect(style.captionScrimOpacity).toBeGreaterThan(0);
  });

  test("clamps pulsed overlay opacity to the role maximum", () => {
    const maxOpacity = sceneMotionProfile("point", 3, 30).overlayMaxOpacity;
    const style = getSceneMotionStyle({
      durationInFrames: 210,
      fps: 30,
      frame: 14,
      position: 3,
      role: "point",
    });

    expect(style.overlayOpacity).toBeCloseTo(maxOpacity, 5);
  });

  test("keeps enough image bleed to cover horizontal pan", () => {
    const roles = ["hook", "context", "point", "payoff", "cta"] as const;
    const width = 1080;

    for (const role of roles) {
      for (const frame of [0, 209]) {
        const style = getSceneMotionStyle({
          durationInFrames: 210,
          fps: 30,
          frame,
          position: 1,
          role,
        });
        const horizontalBleed = ((style.scale - 1) * width) / 2;

        expect(horizontalBleed).toBeGreaterThanOrEqual(Math.abs(style.translateX));
      }
    }
  });
});
