import { speechTextFromSsml } from "../googleTts";
import type { ProjectStyleContext } from "../types";
import { defaultProjectStyleContext } from "./scriptPlan";
import type { CompiledPrompt, PromptTemplate } from "./types";

export type TtsPromptInput = {
  scene: {
    id: string;
    position: number;
    role: "hook" | "context" | "point" | "payoff" | "cta";
    durationSeconds: number;
    narration: string;
    ssml: string;
  };
  voiceName: string;
  styleContext?: ProjectStyleContext;
};

export type CompiledTtsPrompt = CompiledPrompt & {
  purpose: "ssml";
  provider: "google_tts";
  prompt: string;
};

export const ttsPromptTemplate: PromptTemplate<TtsPromptInput, CompiledTtsPrompt> = {
  id: "tiny_mechanisms_scene_tts_prompt",
  version: 2,
  purpose: "ssml",
  provider: "google_tts",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const transcript = speechTextFromSsml(input.scene.ssml) || input.scene.narration;

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "ssml",
      provider: "google_tts",
      prompt: [
        "Synthesize speech for this short-form educational narration. Do not read headings or instructions aloud.",
        "",
        "### AUDIO PROFILE",
        "Name: Tiny Mechanisms Narrator",
        `Voice: ${input.voiceName}`,
        `Role: ${style.voiceDirection}`,
        "",
        "### DIRECTOR NOTES",
        `Tone: ${style.tone}`,
        `Pace: ${style.pacing}`,
        `Scene role: ${input.scene.role}`,
        `Scene target duration: ${input.scene.durationSeconds} seconds`,
        "Energy: start hooks with urgency, settle into explanation, and land payoff lines cleanly.",
        "Pauses: use brief natural pauses after hooks and before payoffs. Preserve proper nouns exactly as written.",
        "Speak only the transcript text exactly as provided.",
        "Do not rewrite, summarize, normalize, add, remove, or reorder words.",
        "Do not speak director notes, headings, scene metadata, or SSML tag names.",
        "Audio/subtitle alignment depends on exact transcript fidelity.",
        "",
        "### TRANSCRIPT",
        transcript,
      ].join("\n"),
      modelParameters: {
        voiceName: input.voiceName,
        sceneRole: input.scene.role,
      },
      metadata: {
        sceneId: input.scene.id,
        transcript,
      },
    };
  },
};
