import { describe, expect, test } from "bun:test";

import {
  captionBoxStyleForRole,
  chunkWords,
  isMechanismKeyword,
  pickActiveIndex,
  shouldShowPunchCaption,
} from "./Captions";
import {
  SUBSCRIBE_LOWER_THIRD,
  getSceneDurationFrames,
  getSceneMotionStyle,
  getSceneVisualOpacity,
  getSceneVisualTransitionFrames,
  getSubscribeLowerThirdState,
  getSubscribeLowerThirdWindow,
  getTotalDurationFrames,
  resolveMediaSrc,
  sceneMotionProfile,
  shouldShowSubscribeLowerThird,
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

  test("splits long spoken phrases by timing so captions stay scan-friendly", () => {
    const words = [
      { text: "The", start: 0, end: 0.15 },
      { text: "sliding", start: 0.15, end: 0.65 },
      { text: "block", start: 0.65, end: 1.1 },
      { text: "changes", start: 1.1, end: 1.55 },
      { text: "the", start: 1.55, end: 1.7 },
      { text: "pendulum", start: 1.7, end: 2.25 },
      { text: "body.", start: 2.25, end: 2.75 },
    ] as const;

    const chunks = chunkWords(words, { target: 4, min: 2, max: 5, maxDurationSeconds: 1.35 });

    expect(chunks.map((chunk) => chunk.map((entry) => entry.word.text))).toEqual([
      ["The", "sliding", "block"],
      ["changes", "the", "pendulum"],
      ["body."],
    ]);
  });
});

describe("caption emphasis", () => {
  test("recognizes mechanical verbs and nouns through punctuation", () => {
    expect(isMechanismKeyword("locks,")).toBe(true);
    expect(isMechanismKeyword("spring")).toBe(true);
    expect(isMechanismKeyword("tick.")).toBe(true);
    expect(isMechanismKeyword("zipper")).toBe(true);
    expect(isMechanismKeyword("teeth")).toBe(true);
    expect(isMechanismKeyword("strap")).toBe(true);
    expect(isMechanismKeyword("freewheel")).toBe(true);
    expect(isMechanismKeyword("ordinary")).toBe(false);
  });

  test("raises captions away from YouTube controls and subscribe lower third", () => {
    expect(captionBoxStyleForRole("hook").bottom).toBeGreaterThanOrEqual(260);
    expect(captionBoxStyleForRole("hook").right).toBeGreaterThanOrEqual(150);
    expect(captionBoxStyleForRole("cta").bottom).toBeGreaterThan(
      Number(captionBoxStyleForRole("hook").bottom),
    );
  });

  test("shows punch captions only at the beginning of hook scenes", () => {
    expect(shouldShowPunchCaption("hook", 0.2)).toBe(true);
    expect(shouldShowPunchCaption("hook", 1.4)).toBe(false);
    expect(shouldShowPunchCaption("point", 0.2)).toBe(false);
  });
});

describe("scene visual transitions", () => {
  test("uses a short visual crossfade without changing scene duration math", () => {
    const transitionFrames = getSceneVisualTransitionFrames({
      fps: 30,
      nextDurationInFrames: 180,
      previousDurationInFrames: 180,
    });

    expect(transitionFrames).toBe(9);
    expect(getTotalDurationFrames([{ durationSeconds: 6 }, { durationSeconds: 6 }], 30)).toBe(360);
  });

  test("caps visual crossfade for short adjacent scenes", () => {
    expect(
      getSceneVisualTransitionFrames({
        fps: 30,
        nextDurationInFrames: 12,
        previousDurationInFrames: 15,
      }),
    ).toBe(4);
  });

  test("fades incoming visuals over the transition window", () => {
    expect(getSceneVisualOpacity({ frame: 0, transitionInFrames: 9 })).toBe(0);

    const middle = getSceneVisualOpacity({ frame: 4, transitionInFrames: 9 });
    expect(middle).toBeGreaterThan(0);
    expect(middle).toBeLessThan(1);

    expect(getSceneVisualOpacity({ frame: 9, transitionInFrames: 9 })).toBe(1);
    expect(getSceneVisualOpacity({ frame: 20, transitionInFrames: 9 })).toBe(1);
  });

  test("keeps first-scene visuals fully opaque", () => {
    expect(getSceneVisualOpacity({ frame: 0, transitionInFrames: 0 })).toBe(1);
  });
});

describe("scene motion", () => {
  test("uses a stronger first beat for hook scenes", () => {
    const hook = sceneMotionProfile("hook", 1, 30);
    const context = sceneMotionProfile("context", 2, 30);

    expect(hook.beatEveryFrames).toBeLessThan(context.beatEveryFrames);
    expect(hook.overlayMaxOpacity).toBeGreaterThan(context.overlayMaxOpacity);
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
    const profile = sceneMotionProfile("point", 3, 30);
    const maxOpacity = profile.overlayMaxOpacity;
    const style = getSceneMotionStyle({
      durationInFrames: 210,
      fps: 30,
      frame: profile.beatOffsetFrames + Math.round(profile.pulseFrames / 2),
      position: 3,
      role: "point",
    });

    expect(style.overlayOpacity).toBeCloseTo(maxOpacity, 5);
  });

  test("keeps beat emphasis from creating a visible scale jump", () => {
    const fps = 30;
    const profile = sceneMotionProfile("hook", 1, fps);
    const beforeBeat = getSceneMotionStyle({
      durationInFrames: 180,
      fps,
      frame: profile.beatOffsetFrames - 1,
      position: 1,
      role: "hook",
    });
    const beatStart = getSceneMotionStyle({
      durationInFrames: 180,
      fps,
      frame: profile.beatOffsetFrames,
      position: 1,
      role: "hook",
    });

    expect(Math.abs(beatStart.scale - beforeBeat.scale)).toBeLessThan(0.01);
  });

  test("keeps frame-to-frame zoom changes subtle across scene roles", () => {
    const roles = ["hook", "context", "point", "payoff", "cta"] as const;

    for (const role of roles) {
      let previous = getSceneMotionStyle({
        durationInFrames: 210,
        fps: 30,
        frame: 0,
        position: 1,
        role,
      });

      for (let frame = 1; frame < 210; frame += 1) {
        const current = getSceneMotionStyle({
          durationInFrames: 210,
          fps: 30,
          frame,
          position: 1,
          role,
        });

        expect(Math.abs(current.scale - previous.scale)).toBeLessThan(0.01);
        previous = current;
      }
    }
  });

  test("uses one-direction scene zoom without zoom-out pulses", () => {
    const roles = ["hook", "context", "point", "payoff", "cta"] as const;

    for (const role of roles) {
      let previous = getSceneMotionStyle({
        durationInFrames: 210,
        fps: 30,
        frame: 0,
        position: 1,
        role,
      });

      for (let frame = 1; frame < 210; frame += 1) {
        const current = getSceneMotionStyle({
          durationInFrames: 210,
          fps: 30,
          frame,
          position: 1,
          role,
        });

        expect(current.scale).toBeGreaterThanOrEqual(previous.scale);
        previous = current;
      }
    }
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

  test("clamps out-of-range frames to safe motion values", () => {
    const before = getSceneMotionStyle({
      durationInFrames: 90,
      fps: 30,
      frame: -20,
      position: 2,
      role: "payoff",
    });
    const after = getSceneMotionStyle({
      durationInFrames: 90,
      fps: 30,
      frame: 200,
      position: 2,
      role: "payoff",
    });

    expect(before.scale).toBeGreaterThan(1);
    expect(after.scale).toBeGreaterThan(1);
    expect(Number.isFinite(before.translateX)).toBe(true);
    expect(Number.isFinite(before.translateY)).toBe(true);
    expect(Number.isFinite(after.translateX)).toBe(true);
    expect(Number.isFinite(after.translateY)).toBe(true);
    expect(before.captionScrimOpacity).toBe(after.captionScrimOpacity);
  });
});

describe("subscribe lower third", () => {
  test("uses Tiny Mechanisms hardcoded branding", () => {
    expect(SUBSCRIBE_LOWER_THIRD.channelName).toBe("Tiny Mechanisms");
    expect(SUBSCRIBE_LOWER_THIRD.logoPath).toBe("logo/logo.png");
    expect(SUBSCRIBE_LOWER_THIRD.durationSeconds).toBe(4.5);
  });

  test("renders only for cta scenes", () => {
    expect(shouldShowSubscribeLowerThird("cta")).toBe(true);

    for (const role of ["hook", "context", "point", "payoff"] as const) {
      expect(shouldShowSubscribeLowerThird(role)).toBe(false);
    }
  });

  test("uses the last 4.5 seconds for longer cta scenes", () => {
    const window = getSubscribeLowerThirdWindow({
      fps: 30,
      sceneDurationInFrames: 180,
    });

    expect(window).toEqual({
      durationInFrames: 135,
      endFrame: 180,
      startFrame: 45,
    });
  });

  test("clamps the lower third to short cta scenes", () => {
    const window = getSubscribeLowerThirdWindow({
      fps: 30,
      sceneDurationInFrames: 72,
    });

    expect(window).toEqual({
      durationInFrames: 72,
      endFrame: 72,
      startFrame: 0,
    });
  });

  test("returns deterministic frame states", () => {
    const hiddenBefore = getSubscribeLowerThirdState({
      fps: 30,
      frame: 44,
      sceneDurationInFrames: 180,
    });
    const entering = getSubscribeLowerThirdState({
      fps: 30,
      frame: 45,
      sceneDurationInFrames: 180,
    });
    const holding = getSubscribeLowerThirdState({
      fps: 30,
      frame: 90,
      sceneDurationInFrames: 180,
    });
    const subscribed = getSubscribeLowerThirdState({
      fps: 30,
      frame: 108,
      sceneDurationInFrames: 180,
    });
    const exiting = getSubscribeLowerThirdState({
      fps: 30,
      frame: 178,
      sceneDurationInFrames: 180,
    });
    const hiddenAfter = getSubscribeLowerThirdState({
      fps: 30,
      frame: 180,
      sceneDurationInFrames: 180,
    });

    expect(hiddenBefore.visible).toBe(false);
    expect(hiddenBefore.opacity).toBe(0);
    expect(entering.visible).toBe(true);
    expect(entering.opacity).toBe(0);
    expect(entering.scale).toBeCloseTo(0.96, 5);
    expect(holding.visible).toBe(true);
    expect(holding.opacity).toBeGreaterThan(0.95);
    expect(holding.subscribed).toBe(false);
    expect(subscribed.visible).toBe(true);
    expect(subscribed.subscribed).toBe(true);
    expect(exiting.visible).toBe(true);
    expect(exiting.opacity).toBeLessThan(0.5);
    expect(exiting.translateY).toBeGreaterThan(0);
    expect(hiddenAfter.visible).toBe(false);
    expect(hiddenAfter.opacity).toBe(0);
  });
});
