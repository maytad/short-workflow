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
  version: 13,
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
    const layoutContract = roleLayoutContract(input.scene.role, hookArchetype);
    const hookHeadline = hookHeadlineFromCaption(input.scene.role, input.scene.caption);
    const hookHeadlineRules = hookHeadline
      ? [
          "",
          "VISUAL HOOK HEADLINE",
          `Render this exact readable headline inside the generated image: "${hookHeadline}".`,
          "This is not a subtitle. It is a bold graphic hook integrated into the frame.",
          "Use large condensed uppercase sans-serif lettering, high contrast, clean black shadow or stroke, and no decorative punctuation.",
          "Use one or two short lines maximum. Keep the words perfectly spelled and do not add, remove, translate, or rewrite any word.",
          "Place the headline in clean negative space in the upper-left or upper-third area, away from the mechanism and away from the bottom caption-safe zone.",
          "Make the object action point toward the headline when possible: diagonal cord, spray, hand force, motion streak, bracket, underline, stamp, or impact mark.",
          "No other readable text anywhere in the image. If exact spelling cannot be maintained, prefer leaving the headline out over misspelling it.",
        ]
      : [
          "",
          "TEXT POLICY",
          `caption context only, do not render this as text: ${caption}`,
          "Do not render any readable text, labels, numbers, captions, words, or typography in this non-hook scene.",
        ];
    const prompt = [
      "Create one 9:16 vertical mechanical micro-documentary frame for a YouTube Short, Reel, or TikTok.",
      "The frame must feel art-directed, specific, and structurally composed, not like a generic macro render.",
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
      ...layoutContract,
      "",
      "VISIBLE PROOF AND HIDDEN CAUSE",
      "The frame must show visible physical evidence: action, contrast, surface behavior, sound-source clue, reflection shift, residue, deformation, contact, state change, resistance, or failure.",
      "Avoid calm object portraits where the viewer only sees the item sitting still.",
      "For hook scenes, show the visible result and only a mysterious clue; do not reveal the complete hidden mechanism yet.",
      "For point and payoff scenes, show both the visible result and the hidden cause through a cutaway, transparent edge, exposed gap, partial split view, reflection, highlighted contact point, or blueprint exploded reveal.",
      "The viewer should be able to answer what moved, what changed, or what is holding force in under half a second.",
      "Use visual cues that survive silent autoplay: colored highlight on the key part, subtle motion blur, pressure bend, contact point glow, simple unlabeled arrows, or the exact hook headline when this is a hook scene.",
      "",
      "VISUAL STRATEGY",
      "Choose one primary visual strategy for this scene: action-first close-up, native hand interaction, before/after contrast, frozen motion, force-path macro, transparent cutaway, or blueprint exploded reveal.",
      "Do not let every scene become a transparent cutaway, same macro tabletop shot, or same exploded stack.",
      "For hook scenes, prefer a recognizable real object under tension before using a clean cutaway or blueprint layout.",
      "For point scenes, prefer mechanism proof through a cutaway, exposed edge, force path, or blueprint exploded reveal.",
      "Use the selected strategy boldly. Do not blend every strategy into a safe generic image.",
      "",
      "# Blueprint Exploded Reveal Grammar",
      "Use this grammar only when the scene is point, payoff, or the visual hook archetype is blueprint_exploded_reveal.",
      "Borrow the composition logic of technical product blueprint posters: one familiar hero object, one compact exploded stack, one small cross-section inset, and leader lines or dimension ticks.",
      "Keep it mobile-readable: 3-5 separated parts or layers maximum, large object silhouette, high contrast, generous empty space, no dense labels.",
      "Parts should separate along the real mechanical axis: slider direction, spring compression axis, hinge rotation arc, pawl tooth path, cam rotation path, valve flow path, or lens/light path.",
      "Show one cause-effect path with visual cues: force arrows without words, glow on contact points, compression marks, dotted alignment guides, motion ghost, pressure bend, or flow lines.",
      "Use monochrome drafting paper, white blueprint, or muted technical illustration styling only when it clarifies the mechanism.",
      "Do not render readable words, fake labels, brand names, dimensions with numbers, patent text, UI, or logos.",
      "Do not create a full product teardown poster, catalog page, 8-10 layer stack, or four-panel collage.",
      "Example hook frame: zipper teeth pulled sideways while the seam stays locked, real fabric visible.",
      "Example blueprint point frame: a click pen shown as a large real barrel silhouette with four nearby separated layers: button, rotating cam, compressed spring, refill; unlabeled leader lines point to the cam notch and spring force path.",
      "Example blueprint payoff frame: a stapler jaw partly open with a small exploded inset showing anvil groove, staple legs, paper stack, and bend path.",
      "",
      "SCENE ROLE",
      `Scene ${input.scene.position} is ${input.scene.role}. Visual job: ${roleJob}.`,
      `Scene duration: ${input.scene.durationSeconds} seconds.`,
      "",
      "SUBJECT AND ACTION",
      `Primary visual seed: ${imagePrompt}`,
      ...(visualBrief ? [`Visual brief: ${sentence(visualBrief)}`] : []),
      `Narration context: ${narration}`,
      ...hookHeadlineRules,
      "",
      "COMPOSITION",
      "Use a clear vertical hierarchy: hook subject in the upper/middle frame, caption-safe negative space in the lower 25-30%.",
      "Keep critical details away from the top, bottom, and right-side platform UI areas.",
      "Use strong foreground/midground/background separation, but keep the image simple enough to read at thumbnail size.",
      "Prefer hands interacting with the object in its natural everyday setting for hook/context scenes.",
      "Prefer blueprint exploded reveal, selective cutaway, before/after contrast, or force-path macro for point/payoff scenes.",
      "Avoid centered isolated object on a blank background unless the separated layers, force path, or contact points create the visual interest.",
      "",
      "MECHANICAL MATERIALITY",
      "Show one readable mechanism per frame, anchored to a familiar object or setting.",
      "Prefer the natural everyday setting implied by the scene before using a tabletop demonstration.",
      "Use macro cutaways, transparent housings, blueprint exploded reveals, and frozen motion only when they clarify how the mechanism works.",
      "If using an exploded reveal, keep parts close together, keep the active force path visible, and show one cause-effect path rather than every internal part.",
      "Use tactile materials and physical clues when relevant: plastic, rubber, fabric, paper, water, metal, light, heat marks, residue, surface texture, contact points, small moving parts, and everyday object details.",
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
      "Social-native mechanical editorial visual: tactile, bold, clear, physically plausible, with either real-world macro lighting or clean blueprint drafting style.",
      "Avoid glossy sci-fi product advertising, corporate stock, generic exploded phone renders, and sterile CAD without a visible everyday behavior.",
      "",
      "CONSTRAINTS",
      hookHeadline
        ? `The only embedded readable text allowed is the exact hook headline "${hookHeadline}".`
        : "No embedded text, captions, readable labels, arrows with words, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
      "No readable labels, arrows with words, watermarks, logos, UI, fake screenshots, public figures, or deceptive real-event imagery.",
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
        ...(hookHeadline ? { hookHeadline } : {}),
      },
      metadata: {
        projectId: input.project.id,
        sceneId: input.scene.id,
      },
    };
  },
};

function hookHeadlineFromCaption(role: ImagePromptInput["scene"]["role"], caption: string) {
  if (role !== "hook") {
    return null;
  }

  const normalized = caption
    .replace(/[;:,.!?()[\]{}"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

  if (!normalized) {
    return null;
  }

  return normalized.split(" ").slice(0, 4).join(" ");
}

function roleLayoutContract(
  role: ImagePromptInput["scene"]["role"],
  archetype: VisualHookArchetype,
) {
  if (role === "hook") {
    return [
      "Hook layout contract: live-action first, not poster-first.",
      "Show the phenomenon already happening. Do not show a calm setup before the interesting moment.",
      "No clean product shot for hook scenes.",
      "No clean diagram, blueprint sheet, exploded teardown, or sliced-open teaching view as the opening frame.",
      "Do not reveal the spring, cam, pawl, aligned holes, valve, or other hidden cause in full detail in the hook.",
      "Show one large visible consequence that reads in a still frame: slack suddenly appears, a cord shoots free, a part snaps open, a latch refuses to move, a strap stops under force, or a piece changes state.",
      "Do not rely on tiny internal details, subtle tail length changes, or a small black mechanism on a dark background as the main hook.",
      "If the mechanism is black, dark, or tiny, use a contrasting cord, fabric, background, hand position, highlight, or silhouette so the action is readable on a phone.",
      "Start with consequence, motion, tension, resistance, release, or visible failure.",
      "Use one dominant subject filling roughly 55-70% of the upper and middle frame.",
      "Make the frame feel like an intentional short-form opening shot, not a generic stock illustration.",
    ];
  }

  if (archetype === "blueprint_exploded_reveal" || role === "point") {
    return [
      "Blueprint reveal layout contract: hero object plus mechanism evidence.",
      "Compose like a vertical technical blueprint sheet adapted for Shorts: large recognizable object silhouette, compact exploded stack beside or above it, small inset/cross-section, and unlabeled leader lines.",
      "Use 3-5 separated physical layers or parts maximum. Do not show every part.",
      "Keep the separated parts close enough that the viewer sees how they fit back together.",
      "Make the active cause visible: compression, locking tooth, cam notch, pawl contact, valve flow, hinge arc, spring force, or sliding track.",
      "No readable callout text or numbers; the caption system handles words separately.",
    ];
  }

  if (role === "payoff" || role === "cta") {
    return [
      "Payoff layout contract: resolved mechanism plus echo of the opening action.",
      "Show the real object behavior again, with a small ghosted cutaway, force path, or compact exploded inset that explains why it happened.",
      "Keep the explanation visual and satisfying rather than technical.",
    ];
  }

  return [
    "Context layout contract: recognizable everyday object in its native setting.",
    "Use a hand, surface, or familiar environment to make the object immediately legible.",
    "Avoid poster layouts until the mechanism reveal scenes.",
  ];
}

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
