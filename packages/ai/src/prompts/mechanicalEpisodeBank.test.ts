import { describe, expect, test } from "bun:test";

import { imagePromptTemplate } from "./imagePrompt";
import {
  getTinyMechanismsSeed,
  pickNextTinyMechanismsSeed,
  TINY_MECHANISMS_ACTIVE_SEEDS,
  TINY_MECHANISMS_PRESET_ID,
} from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";

describe("mechanical episode bank", () => {
  test("selects only active seeds while preserving legacy seed resolution", () => {
    const firstActive = pickNextTinyMechanismsSeed([]);
    expect(firstActive.selectionStatus).toBe("active");
    expect(firstActive.seedId).toBe(TINY_MECHANISMS_ACTIVE_SEEDS[0]?.seedId);

    const recordedVoice = getTinyMechanismsSeed("recorded_voice");
    expect(recordedVoice?.selectionStatus).toBe("legacy");

    const allActiveIds = TINY_MECHANISMS_ACTIVE_SEEDS.map((seed) => seed.seedId);
    expect(allActiveIds).not.toContain("recorded_voice");
  });

  test("active seeds are ordered to avoid adjacent mechanism families", () => {
    expect(TINY_MECHANISMS_ACTIVE_SEEDS.length).toBeGreaterThanOrEqual(30);

    for (let index = 1; index < TINY_MECHANISMS_ACTIVE_SEEDS.length; index += 1) {
      expect(TINY_MECHANISMS_ACTIVE_SEEDS[index]?.mechanismFamily).not.toBe(
        TINY_MECHANISMS_ACTIVE_SEEDS[index - 1]?.mechanismFamily,
      );
    }
  });

  test("active seeds include audience-first editorial fields", () => {
    const clickPen = getTinyMechanismsSeed("click_pen_cam_lock");
    expect(clickPen?.selectionStatus).toBe("active");
    expect(clickPen?.appealTier).toBe("mass_appeal");
    expect(clickPen?.audienceContext).toContain("pen");
    expect(clickPen?.nativeSetting).toContain("desk");
    expect(clickPen?.hookEmotion).toContain("same press");
    expect(clickPen?.avoidVisualSetting).toContain("workbench");
  });

  test("first twelve active seeds avoid workshop-tool dominance", () => {
    const firstTwelve = TINY_MECHANISMS_ACTIVE_SEEDS.slice(0, 12);
    expect(firstTwelve).toHaveLength(12);
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("ratchet_screwdriver_pawl");
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("socket_wrench_direction_switch");
    expect(firstTwelve.map((seed) => seed.seedId)).not.toContain("tripod_quick_release_plate");
    expect(firstTwelve.filter((seed) => seed.appealTier === "workshop_tool")).toHaveLength(0);
  });

  test("compiled script prompt includes mechanical episode concept fields", () => {
    const seed = getTinyMechanismsSeed("click_pen_cam_lock");
    expect(seed?.selectionStatus).toBe("active");

    const compiled = scriptPlanPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: "click_pen_cam_lock",
      targetDurationSeconds: 45,
    });

    const developerMessage = compiled.messages[0]?.content ?? "";
    const userMessage = compiled.messages[1]?.content ?? "";

    expect(compiled.templateVersion).toBe(5);
    expect(developerMessage).toContain("one tiny physical mechanism revealed");
    expect(developerMessage).toContain("Do not use a generic \"inside this object\" opening");
    expect(userMessage).toContain("<mechanism_family>spring_locking</mechanism_family>");
    expect(userMessage).toContain("<object_or_mechanism>click pen cam and spring</object_or_mechanism>");
    expect(userMessage).toContain("<viewer_misconception>The spring is doing all the clever work.</viewer_misconception>");
    expect(userMessage).toContain("<satisfying_motion>press, rotate, lock, release</satisfying_motion>");
    expect(userMessage).toContain("<visual_reveal>macro cutaway of the cam track stepping into the next notch</visual_reveal>");
    expect(userMessage).toContain("<loop_payoff>That click is not just a button. It remembers the last press.</loop_payoff>");
  });

  test("compiled image prompt emphasizes physical mechanism materiality", () => {
    const compiled = imagePromptTemplate.compile({
      provider: "openai",
      project: {
        id: "review-project",
        title: "Tiny Mechanisms: Why one click locks a pen",
        topic: "tiny_mechanisms:click_pen_cam_lock",
      },
      scene: {
        id: "review-scene",
        position: 1,
        role: "hook",
        durationSeconds: 3,
        narration: "One click locks the pen. The next click unlocks it.",
        caption: "One click remembers.",
        imagePrompt: "a click pen split open to reveal a rotating cam, spring, and refill",
        visualBrief: "The viewer sees that the click is caused by a cam stepping into a new locked position.",
        visualHookArchetype: "reveal_cutaway",
      },
    });

    expect(compiled.templateVersion).toBe(4);
    expect(compiled.prompt).toContain("MECHANICAL MATERIALITY");
    expect(compiled.prompt).toContain("springs, pins, gears, pawls, ratchets, cams, levers, tracks, valves");
    expect(compiled.prompt).toContain("Show one readable mechanism per frame");
  });
});
