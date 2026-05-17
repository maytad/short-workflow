import type { ImageProvider, ProjectStyleContext } from "../types";
import { defaultProjectStyleContext } from "./scriptPlan";
import type { CompiledPrompt, PromptTemplate } from "./types";

export type ImagePromptInput = {
  project: {
    id: string;
    title: string;
    topic: string;
  };
  scene: {
    id: string;
    position: number;
    role: "hook" | "context" | "point" | "payoff" | "cta";
    durationSeconds: number;
    narration: string;
    caption: string;
    imagePrompt: string;
  };
  provider: ImageProvider;
  styleContext?: ProjectStyleContext;
};

export type CompiledImagePrompt = CompiledPrompt & {
  purpose: "image_prompt";
  provider: ImageProvider;
  prompt: string;
};

export const imagePromptTemplate: PromptTemplate<ImagePromptInput, CompiledImagePrompt> = {
  id: "tiny_mechanisms_scene_image_prompt",
  version: 1,
  purpose: "image_prompt",
  provider: "openai",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const imagePrompt = sentence(input.scene.imagePrompt);
    const narration = sentence(input.scene.narration);
    const caption = sentence(input.scene.caption);
    const visualStyle = sentence(style.visualStyle);
    const imageContinuity = sentence(style.imageContinuity);
    const tone = sentence(style.tone);
    const colorAndLighting = sentence(style.colorAndLighting);
    const prompt = [
      "Create a vertical 9:16 editorial documentary image for a short-form science explainer.",
      `Project: ${sentence(input.project.title)}`,
      `Scene ${input.scene.position} role: ${input.scene.role}.`,
      `Scene duration: ${input.scene.durationSeconds} seconds.`,
      `Specific subject and action: ${imagePrompt}`,
      `Narration context: ${narration}`,
      `Caption context only, do not render this as text: ${caption}`,
      `Visual style: ${visualStyle}`,
      `Continuity: ${imageContinuity}`,
      `Tone: ${tone}`,
      `Color and lighting: ${colorAndLighting}`,
      "Use strong vertical framing, clear subject hierarchy, macro details or object cutaways when useful, and realistic depth.",
      "Do not include text, captions, watermarks, logos, UI, public figures, fake screenshots, or misleading depictions of real events.",
      "Prefer faceless scenes, objects, places, hands, silhouettes, environments, symbolic details, and documentary visual evidence.",
    ].join(" ");

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "image_prompt",
      provider: input.provider,
      prompt,
      modelParameters: {
        aspectRatio: "9:16",
        sceneRole: input.scene.role,
      },
      metadata: {
        projectId: input.project.id,
        sceneId: input.scene.id,
      },
    };
  },
};

function sentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return ".";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
