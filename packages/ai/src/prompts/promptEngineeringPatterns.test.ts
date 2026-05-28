import { describe, expect, test } from "bun:test";

import { imagePromptTemplate } from "./imagePrompt";
import { TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";
import { ttsPromptTemplate } from "./ttsPrompt";

function developerMessage(compiled: { messages: Array<{ role: string; content: string }> }) {
  return compiled.messages.find((message) => message.role === "developer")?.content ?? "";
}

describe("prompt engineering pattern compliance", () => {
  test("tts prompt preserves transcript text for audio subtitle alignment", () => {
    const compiled = ttsPromptTemplate.compile({
      voiceName: "Kore",
      scene: {
        id: "scene-1",
        position: 1,
        role: "hook",
        durationSeconds: 3,
        narration: "It should split open.",
        ssml: "<speak>It should split open.</speak>",
      },
    });

    expect(compiled.templateVersion).toBe(2);
    expect(compiled.prompt).toContain("Speak only the transcript text exactly as provided.");
    expect(compiled.prompt).toContain(
      "Do not rewrite, summarize, normalize, add, remove, or reorder words.",
    );
    expect(compiled.prompt).toContain(
      "Do not speak director notes, headings, scene metadata, or SSML tag names.",
    );
    expect(compiled.prompt).toContain(
      "Audio/subtitle alignment depends on exact transcript fidelity.",
    );
  });

  test("script prompt has quality checks and avoids broad abstract sensory drift", () => {
    const compiled = scriptPlanPrompt.compile({
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: "zipper_locking",
      targetDurationSeconds: 30,
    });
    const text = developerMessage(compiled);

    expect(compiled.templateVersion).toBe(20);
    expect(text).toContain("# Prompt Engineering Quality Checks");
    expect(text).toContain(
      "Before finalizing, check that scene 1 can be understood with the image alone, the caption works as a graphic hook headline, and the first narration line describes visible action.",
    );
    expect(text).toContain(
      "Good hook pattern: zipper teeth are being pulled sideways while the slider keeps them locked.",
    );
    expect(text).toContain("blueprint_exploded_reveal");
    expect(text).toContain("technical product diagram adapted for Shorts");
    expect(text).toContain("large visible consequence");
    expect(text).toContain("Do not reveal the mechanism before scene 2");
    expect(text).toContain("graphic hook headline");
    expect(text).toContain("creative territory, visual proof mode");
    expect(text).toContain("reflection shift");
    expect(text).not.toContain("mechanism family, visible action, viewer misconception");
  });

  test("image prompt separates hook frames from explanatory cutaway frames", () => {
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

    expect(compiled.templateVersion).toBe(13);
    expect(compiled.prompt).toContain("# Blueprint Exploded Reveal Grammar");
    expect(compiled.prompt).toContain("Hook layout contract: live-action first");
    expect(compiled.prompt).toContain("Do not reveal the spring, cam, pawl, aligned holes");
    expect(compiled.prompt).toContain("Show one large visible consequence");
    expect(compiled.prompt).toContain("Blueprint Exploded Reveal Grammar");
    expect(compiled.prompt).toContain("technical product blueprint posters");
    expect(compiled.prompt).toContain("Do not render readable words");
    expect(compiled.prompt).toContain("VISUAL HOOK HEADLINE");
    expect(compiled.prompt).toContain(
      'Render this exact readable headline inside the generated image: "IT SHOULD SPLIT"',
    );
    expect(compiled.prompt).toContain("Use visual cues that survive silent autoplay");
    expect(compiled.prompt).toContain(
      "Example hook frame: zipper teeth pulled sideways while the seam stays locked, real fabric visible.",
    );
    expect(compiled.prompt).toContain("Example blueprint point frame");
  });
});
