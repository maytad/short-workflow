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
    visualBrief?: string | null;
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
  version: 2,
  purpose: "image_prompt",
  provider: "openai",
  compile(input) {
    const style = input.styleContext ?? defaultProjectStyleContext();
    const imagePrompt = sentence(input.scene.imagePrompt);
    const visualBrief = input.scene.visualBrief?.trim() ?? "";
    const narration = sentence(input.scene.narration);
    const caption = sentence(input.scene.caption);
    const visualStyle = sentence(style.visualStyle);
    const imageContinuity = sentence(style.imageContinuity);
    const tone = sentence(style.tone);
    const colorAndLighting = sentence(style.colorAndLighting);
    const roleJob = roleVisualJob(input.scene.role);
    const prompt = [
      "Create a 9:16 vertical YouTube Shorts scene frame for a faceless micro-documentary.",
      "",
      "INTENT",
      "This image must stop a mobile viewer in the first half-second and remain readable behind large captions.",
      "",
      "SCENE ROLE",
      `Scene ${input.scene.position} is ${input.scene.role}. Visual job: ${roleJob}.`,
      `Scene duration: ${input.scene.durationSeconds} seconds.`,
      "",
      "SUBJECT",
      `Primary visual seed: ${imagePrompt}`,
      ...(visualBrief ? [`Visual brief: ${sentence(visualBrief)}`] : []),
      `Narration context: ${narration}`,
      `Caption context only, do not render this as text: ${caption}`,
      "",
      "COMPOSITION",
      "Use one dominant subject that is recognizable on a phone screen at a glance.",
      "Use strong foreground, midground, and background separation with realistic depth.",
      "Leave clean negative space in the lower 25-30% of the frame for large overlaid captions.",
      "Keep critical details out of the bottom UI/caption area.",
      "Prefer a macro close-up, object cutaway, low-angle detail, top-down demonstration, or symbolic physical evidence when it makes the mechanism clearer.",
      "",
      "CAMERA AND LIGHT",
      "Use high-contrast documentary lighting, controlled highlights, grounded color, sharp focus on the key object, and mobile-readable subject separation.",
      "",
      "STYLE",
      `Visual style: ${visualStyle}`,
      `Continuity: ${imageContinuity}`,
      `Tone: ${tone}`,
      `Color and lighting: ${colorAndLighting}`,
      "Faceless editorial documentary still, cinematic realism, tactile materials, macro texture, and no generic futuristic gloss.",
      "",
      "CONSTRAINTS",
      "Do not include embedded text, captions, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
      "Prefer objects, hands, silhouettes, environments, physical diagrams-as-scenes, and documentary visual evidence.",
    ].join("\n");

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "image_prompt",
      provider: input.provider,
      prompt,
      modelParameters: {
        aspectRatio: "9:16",
        sceneRole: input.scene.role,
        roleVisualJob: roleJob,
      },
      metadata: {
        projectId: input.project.id,
        sceneId: input.scene.id,
      },
    };
  },
};

function roleVisualJob(role: ImagePromptInput["scene"]["role"]) {
  switch (role) {
    case "hook":
      return "visual surprise: an instantly readable close-up or impossible-looking clue that stops a mobile viewer in the first half-second";
    case "context":
      return "recognition: show the familiar everyday object or situation clearly before the mechanism is explained";
    case "point":
      return "mechanism proof: reveal cause and effect through macro detail, cutaway structure, or a physical visual metaphor";
    case "payoff":
      return "reveal: make the explanation feel resolved with a satisfying before/after or clear mechanism outcome";
    case "cta":
      return "loop-back: echo the opening visual idea, but with the mechanism now visually understood";
  }
}

function sentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return ".";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}
