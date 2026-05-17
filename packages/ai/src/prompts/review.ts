import { imagePromptTemplate } from "./imagePrompt";
import { getTinyMechanismsSeed, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";
import { ttsPromptTemplate } from "./ttsPrompt";

const seed = getTinyMechanismsSeed("recorded_voice");
if (!seed) {
  throw new Error("review_seed_missing");
}

const script = scriptPlanPrompt.compile({
  channelPresetId: TINY_MECHANISMS_PRESET_ID,
  seedId: seed.seedId,
  targetDurationSeconds: 45,
});

const sampleProject = {
  id: "review-project",
  title: `Tiny Mechanisms: ${seed.centralQuestion}`,
  topic: `tiny_mechanisms:${seed.seedId}`,
};

const sampleScene = {
  id: "review-scene",
  position: 1,
  role: "hook" as const,
  durationSeconds: 3,
  narration: "Your recorded voice is not lying to you. Your skull is.",
  caption: "Your skull changes your voice.",
  imagePrompt: seed.visualMetaphor,
  ssml: "<speak>Your recorded voice is not lying to you. Your skull is.</speak>",
};

const image = imagePromptTemplate.compile({
  project: sampleProject,
  scene: sampleScene,
  provider: "openai",
});

const tts = ttsPromptTemplate.compile({
  scene: sampleScene,
  voiceName: "Kore",
});

console.log(
  JSON.stringify(
    {
      script,
      image,
      tts,
    },
    null,
    2,
  ),
);
