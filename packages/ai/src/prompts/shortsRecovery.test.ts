import { describe, expect, test } from "bun:test";
import { candidateJudgePrompt } from "./episodeJudge";
import { episodeResearchPrompt } from "./episodeResearch";
import { imagePromptTemplate } from "./imagePrompt";
import { TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";

function developerMessage(compiled: { messages: Array<{ role: string; content: string }> }) {
  return compiled.messages.find((message) => message.role === "developer")?.content ?? "";
}

function userMessage(compiled: { messages: Array<{ role: string; content: string }> }) {
  return compiled.messages.find((message) => message.role === "user")?.content ?? "";
}

describe("shorts recovery prompt policy", () => {
  test("episode research treats recovery objects as examples and avoids recent repeats", () => {
    const compiled = episodeResearchPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      targetDurationSeconds: 30,
      role: "feed_stop_strategist",
      recentLocalTopics: [
        "Why This Zipper Opens Behind the Pull - tiny_mechanisms:ai:zipper-slider-throat",
        "Your Zipper Tab Is Secretly a Lock - tiny_mechanisms:ai:locking-zipper-slider-pull-tab",
      ],
    });
    const text = developerMessage(compiled);
    const request = userMessage(compiled);

    expect(compiled.templateVersion).toBe(4);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("first 0.5 seconds");
    expect(text).toContain("Stayed to watch under 45%");
    expect(text).toContain("Stayed to watch from 45-55%");
    expect(text).toContain("Stayed to watch from 55-60%");
    expect(text).toContain("Recovery example objects");
    expect(text).toContain("examples, not a ranked topic list");
    expect(text).toContain("presentation quality beats object category");
    expect(text).toContain("Do not repeat the same object");
    expect(text).toContain("pause perception, biology, voice, onions");
    expect(request).toContain("<recent_local_topics_json>");
    expect(request).toContain("locking-zipper-slider-pull-tab");
    expect(text).not.toContain("Prioritized recovery objects");
    expect(text).not.toContain("Prioritize latch, ratchet, zipper");
    expect(text).not.toContain("Do not default to latches");
    expect(text).not.toContain("A moving part is helpful but not required");
  });

  test("candidate judge selects for recovery gates instead of novelty drift", () => {
    const candidate = {
      candidateId: "candidate-1",
      roleSource: "feed_stop_strategist" as const,
      objectOrMechanism: "zipper teeth locking under sideways pull",
      centralQuestion: "Why does a zipper resist sideways pulling?",
      firstFrame: "A jacket zipper is pulled sideways but the teeth stay locked.",
      firstLine: "It should split open.",
      firstThreeWords: "It should split",
      feedHypothesis: "A visible sideways pull creates immediate tension.",
      swipeRisk: "low" as const,
      broadAudienceReason: "Everyone recognizes a zipper under tension.",
      retentionPromise: "The slider turns loose teeth into a locked rail.",
      titleCuriosityGap: "Why a Zipper Locks Under Tension",
      mechanismProof: "The slider wedges teeth into one interlocked track.",
      visualReveal: "Macro cutaway of zipper teeth meshing under force.",
      loopPayoff: "The pull makes the lock tighter.",
      whyThisCanBreakPattern: "It opens on visible tension rather than a clean diagram.",
      scores: {
        firstFrameClarity: 5,
        swipeResistance: 5,
        broadObjectFamiliarity: 5,
        visualNovelty: 4,
        retentionPath: 5,
        loopPayoffStrength: 4,
        genericRisk: 1,
      },
    };
    const compiled = candidateJudgePrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      targetDurationSeconds: 30,
      candidates: [candidate, candidate, candidate, candidate, candidate],
      recentLocalTopics: [
        "Why This Zipper Opens Behind the Pull - tiny_mechanisms:ai:zipper-slider-throat",
      ],
    });
    const text = developerMessage(compiled);
    const request = userMessage(compiled);

    expect(compiled.templateVersion).toBe(3);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("60%+");
    expect(text).toContain("Stayed to watch under 45%");
    expect(text).toContain("Stayed to watch from 45-55%");
    expect(text).toContain("Stayed to watch from 55-60%");
    expect(text).toContain("visible moving or tension state");
    expect(text).toContain(
      "Do not reward a candidate merely because it uses a recovery example object",
    );
    expect(text).toContain("Penalize candidates that repeat a recent local object");
    expect(text).toContain("penalize perception, biology, voice, onions");
    expect(request).toContain("<recent_local_topics_json>");
    expect(request).toContain("zipper-slider-throat");
    expect(text).not.toContain("Do not penalize non-mechanical causes");
  });

  test("script plan prompts the first scene for a short swipe-resistant hook", () => {
    const compiled = scriptPlanPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: "zipper_locking",
      targetDurationSeconds: 30,
    });
    const text = developerMessage(compiled);

    expect(compiled.templateVersion).toBe(15);
    expect(text).toContain("Stayed to watch");
    expect(text).toContain("first 1-3 seconds");
    expect(text).toContain("first caption must be no more than 4 words");
    expect(text).toContain("no clean product shot");
    expect(text).toContain("no diagram or cutaway as the opening image");
    expect(text).toContain("reveal the hidden mechanism within the first two seconds");
    expect(text).toContain("Stayed to watch under 45%");
    expect(text).not.toContain("The hidden cause does not need to be a moving mechanical part");
    expect(text).not.toContain("optical, acoustic, thermal, electrical, geometric, chemical");
  });

  test("image prompt treats the hook frame as the feed test product", () => {
    const compiled = imagePromptTemplate.compile({
      provider: "openai",
      project: {
        id: "project-1",
        title: "Tiny Mechanisms: zipper lock",
        topic: "tiny_mechanisms:zipper_locking",
      },
      scene: {
        id: "scene-1",
        position: 1,
        role: "hook",
        durationSeconds: 3,
        narration: "It should split open.",
        caption: "It should split",
        imagePrompt:
          "a jacket zipper pulled sideways while the interlocked teeth refuse to separate",
        visualBrief: "The viewer sees a familiar zipper under impossible-looking tension.",
        visualHookArchetype: "consequence_first",
      },
    });

    expect(compiled.templateVersion).toBe(8);
    expect(compiled.prompt).toContain("Stayed to watch");
    expect(compiled.prompt).toContain("first-frame feed test");
    expect(compiled.prompt).toContain("No clean product shot");
    expect(compiled.prompt).toContain("No clean diagram or cutaway as the opening frame");
    expect(compiled.prompt).toContain("caption context only");
  });
});
