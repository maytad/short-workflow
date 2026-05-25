import type { ImageProvider, ProjectStyleContext } from "../types";
import { defaultProjectStyleContext } from "./scriptPlan";
import { SHORTS_RECOVERY_IMAGE_RULES } from "./shortsRecovery";
import type { CompiledPrompt, PromptTemplate } from "./types";
import {
  defaultVisualHookArchetype,
  type VisualHookArchetype,
  visualHookDirection,
} from "./visualHooks";

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
    visualHookArchetype?: VisualHookArchetype | null;
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
  version: 8,
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
    const hookArchetype =
      input.scene.visualHookArchetype ?? defaultVisualHookArchetype(input.scene.role);
    const hookDirection = visualHookDirection(hookArchetype);
    const prompt = [
      "Create one 9:16 vertical social-native science frame for a YouTube Short, Reel, or TikTok.",
      "",
      "RETENTION JOB",
      "The hook frame is the product. It must stop a silent mobile viewer before narration matters.",
      "This must work as a first-frame visual hook on a phone screen with sound off.",
      "The viewer should understand the object, the action, and the curiosity gap in under 0.5 seconds.",
      "",
      "# Shorts Recovery Policy",
      ...SHORTS_RECOVERY_IMAGE_RULES,
      "",
      "SOCIAL HOOK FRAME",
      `Visual hook archetype: ${hookArchetype}.`,
      `Archetype direction: ${hookDirection}.`,
      "First-frame feed test: the image must be interesting before the title, narration, or caption helps.",
      "No clean product shot for hook scenes.",
      "No clean diagram or cutaway as the opening frame unless the cutaway is the visible surprise.",
      "Show the phenomenon already happening. Do not show a calm setup before the interesting moment.",
      "Do not create a calm object portrait for the hook.",
      "Do not use a clean explanatory diagram as the first frame.",
      "Start with consequence, motion, tension, resistance, release, or visible failure.",
      "Use one dominant subject filling roughly 55-70% of the upper and middle frame.",
      "Make the frame feel like an intentional short-form opening shot, not a generic stock illustration.",
      "",
      "VISIBLE TENSION AND HIDDEN CAUSE",
      "The frame must show visible mechanical tension: stretched, locked, snapped, squeezed, caught, pulled, sliding, or releasing.",
      "Avoid calm object portraits where the viewer only sees the item sitting still.",
      "Show both the visible result and the hidden cause in the same frame when possible through a cutaway, transparent edge, exposed gap, partial split view, reflection, or highlighted contact point.",
      "The viewer should be able to answer what moved, what changed, or what is holding force in under half a second.",
      "Use non-text visual cues only: colored highlight on the key part, subtle motion blur, pressure bend, contact point glow, or simple unlabeled arrows.",
      "",
      "VISUAL STRATEGY",
      "Choose one primary visual strategy for this scene: consequence-first close-up, transparent cutaway, before/after split, force-path macro, impossible-looking frozen motion, or native-setting hand interaction.",
      "Do not let every scene become a transparent cutaway or the same macro tabletop shot.",
      "For hook scenes, prefer a recognizable real object under tension before using a clean cutaway.",
      "For point scenes, prefer mechanism proof through a cutaway, exposed edge, force path, or physically plausible transparent layer.",
      "",
      "# Scene-Specific Cutaway Policy",
      "Hook scenes: start with a real object under action, tension, resistance, or visible failure before any cutaway.",
      "Point and payoff scenes: use cutaway or transparent views only to prove the cause after the hook is established.",
      "If the scene role is hook, any cutaway must still feel like an active real-world moment, not a still technical diagram.",
      "Example hook: zipper teeth pulled sideways while the seam stays locked, real fabric visible.",
      "Example point frame: partial cutaway shows teeth interlocking after the real hook is clear.",
      "",
      "SCENE ROLE",
      `Scene ${input.scene.position} is ${input.scene.role}. Visual job: ${roleJob}.`,
      `Scene duration: ${input.scene.durationSeconds} seconds.`,
      "",
      "SUBJECT AND ACTION",
      `Primary visual seed: ${imagePrompt}`,
      ...(visualBrief ? [`Visual brief: ${sentence(visualBrief)}`] : []),
      `Narration context: ${narration}`,
      `caption context only, do not render this as text: ${caption}`,
      "",
      "COMPOSITION",
      "Use a clear vertical hierarchy: hook subject in the upper/middle frame, caption-safe negative space in the lower 25-30%.",
      "Keep critical details away from the top, bottom, and right-side platform UI areas.",
      "Use strong foreground/midground/background separation, but keep the image simple enough to read at thumbnail size.",
      "Prefer hands interacting with the object in its natural everyday setting, macro close-ups, selective cutaways, before/after contrast, frozen motion, or scale-shock compositions when they clarify the mechanism.",
      "",
      "MECHANICAL MATERIALITY",
      "Show one readable mechanism per frame, anchored to a familiar object or setting.",
      "Prefer the natural everyday setting implied by the scene before using a tabletop demonstration.",
      "Use macro cutaways, transparent housings, exploded-but-physically-plausible views, and frozen motion only when they clarify how the mechanism works.",
      "Use tactile materials and parts when relevant: plastic, rubber, fabric, paper, water, springs, pins, gears, pawls, ratchets, cams, levers, tracks, valves, screws, hinges, bearings, and textured surfaces.",
      "Make the mechanism feel small, precise, physically possible, and connected to a recognizable everyday moment.",
      "Do not default to a workshop, repair bench, dark tabletop, tool catalog shot, or teardown layout unless those are explicitly part of the scene.",
      "Avoid abstract floating science diagrams when a real physical mechanism can be shown.",
      "",
      "CAMERA AND LIGHT",
      "Use a specific camera viewpoint: extreme macro, close-up, low-angle detail, native-setting detail shot, or clean cutaway view.",
      "Use bright high-contrast lighting, sharp focus on the key object, tactile real-world texture, and readable silhouettes.",
      "",
      "STYLE",
      `Visual style: ${visualStyle}`,
      `Continuity: ${imageContinuity}`,
      `Tone: ${tone}`,
      `Color and lighting: ${colorAndLighting}`,
      "Social-native science visual, photorealistic or physically plausible, tactile, bold, clear, not glossy sci-fi, not corporate stock.",
      "",
      "CONSTRAINTS",
      "No embedded text, captions, labels, arrows with words, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
      "Do not create abstract floating concept art or generic sci-fi machinery when the selected mechanism can be shown with a real object, native setting, cutaway, or transparent housing.",
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
        visualHookArchetype: hookArchetype,
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
