export const VISUAL_HOOK_ARCHETYPES = [
  "impossible_macro",
  "consequence_first",
  "hands_on_demo",
  "before_after_contrast",
  "frozen_motion",
  "scale_shock",
  "reveal_cutaway",
] as const;

export type VisualHookArchetype = (typeof VISUAL_HOOK_ARCHETYPES)[number];
export type SceneRole = "hook" | "context" | "point" | "payoff" | "cta";

export function defaultVisualHookArchetype(role: SceneRole): VisualHookArchetype {
  switch (role) {
    case "hook":
      return "consequence_first";
    case "context":
      return "hands_on_demo";
    case "point":
      return "reveal_cutaway";
    case "payoff":
      return "before_after_contrast";
    case "cta":
      return "frozen_motion";
  }
}

export function visualHookDirection(archetype: VisualHookArchetype) {
  switch (archetype) {
    case "impossible_macro":
      return "make a familiar tiny mechanism look surprising through an extreme macro close-up, while keeping the object recognizable";
    case "consequence_first":
      return "show the outcome or problem already happening before the explanation begins";
    case "hands_on_demo":
      return "show hands interacting with the real object so the scene feels native to a phone-shot social feed";
    case "before_after_contrast":
      return "show two clearly different states in one frame without using text labels";
    case "frozen_motion":
      return "freeze a dynamic instant with visible motion cues, particles, waves, cracks, bubbles, or force lines";
    case "scale_shock":
      return "make a tiny structure feel large and tangible while preserving the real-world mechanism";
    case "reveal_cutaway":
      return "show the hidden internal mechanism through a clean cutaway, transparent layer, or physically plausible cross-section";
  }
}

export function isVisualHookArchetype(value: string): value is VisualHookArchetype {
  return VISUAL_HOOK_ARCHETYPES.includes(value as VisualHookArchetype);
}
