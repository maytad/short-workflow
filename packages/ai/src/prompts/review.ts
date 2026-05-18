import { imagePromptTemplate } from "./imagePrompt";
import { getTinyMechanismsSeed, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { scriptPlanPrompt } from "./scriptPlan";
import { ttsPromptTemplate } from "./ttsPrompt";

const reviewSeedIds = ["click_pen_cam_lock", "watch_escapement_ticks", "spray_bottle_check_valves"];

const reviews = reviewSeedIds.map((seedId, index) => {
  const seed = getTinyMechanismsSeed(seedId);
  if (!seed) {
    throw new Error(`review_seed_missing:${seedId}`);
  }

  const script = scriptPlanPrompt.compile({
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    seedId: seed.seedId,
    targetDurationSeconds: 45,
  });

  const sampleProject = {
    id: `review-project-${index + 1}`,
    title: `Tiny Mechanisms: ${seed.centralQuestion}`,
    topic: `tiny_mechanisms:${seed.seedId}`,
  };

  const sampleScene = {
    id: `review-scene-${index + 1}`,
    position: 1,
    role: "hook" as const,
    durationSeconds: 3,
    narration: seed.loopPayoff,
    caption: seed.titleAngle,
    imagePrompt: seed.visualReveal,
    visualBrief: `Show ${seed.objectOrMechanism} through ${seed.visualReveal}.`,
    visualHookArchetype: "reveal_cutaway" as const,
    ssml: `<speak>${seed.loopPayoff}</speak>`,
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

  return {
    seed,
    script,
    image,
    tts,
  };
});

console.log(JSON.stringify({ reviews }, null, 2));
