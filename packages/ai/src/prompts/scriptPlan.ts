import { z } from "zod";

import type { GenerateScriptInput, ProjectStyleContext, ScriptScene } from "../types";
import {
  getTinyMechanismsSeed,
  TINY_MECHANISMS_CHANNEL_BIBLE,
  TINY_MECHANISMS_PRESET_ID,
  TINY_MECHANISMS_SCENE_ROLES_BY_DURATION,
} from "./presets/tinyMechanisms";
import type { CompiledPrompt, PromptTemplate } from "./types";
import {
  VISUAL_HOOK_ARCHETYPES,
  isVisualHookArchetype,
  type VisualHookArchetype,
} from "./visualHooks";

const projectStyleContextSchema = z
  .object({
    visualStyle: z.string().min(1),
    tone: z.string().min(1),
    pacing: z.string().min(1),
    colorAndLighting: z.string().min(1),
    imageContinuity: z.string().min(1),
    voiceDirection: z.string().min(1),
  })
  .strict();

const scriptEpisodeSchema = z
  .object({
    seedId: z.string().min(1),
    workingTitle: z.string().min(1),
    centralQuestion: z.string().min(1),
    viewerCuriosity: z.string().min(1),
    mechanismSummary: z.string().min(1),
    payoff: z.string().min(1),
    riskFlags: z.array(z.string()),
  })
  .strict();

const scriptFactPackSchema = z
  .object({
    coreMechanism: z.string().min(1),
    supportingFacts: z.array(z.string().min(1)).min(1),
    simpleAnalogy: z.string().min(1),
    commonMisconception: z.string().min(1),
    doNotSay: z.array(z.string()),
    needsHumanReview: z.boolean(),
  })
  .strict();

export const scriptSceneSchema = z
  .object({
    position: z.number().int().positive(),
    role: z.enum(["hook", "context", "point", "payoff", "cta"]),
    durationSeconds: z.number().int().positive(),
    narration: z.string().min(1),
    caption: z.string().min(1),
    imagePrompt: z.string().min(1),
    ssml: z.string().min(1),
    visualBrief: z.string().min(1),
    visualHookArchetype: z.enum(VISUAL_HOOK_ARCHETYPES),
    ttsDirection: z.string().min(1),
  })
  .strict();

const metadataDraftSchema = z
  .object({
    youtubeTitle: z.string().min(1).max(100),
    description: z.string().min(1),
    hashtags: z.array(z.string().min(1)).min(1).max(5),
    disclosureHint: z.string().min(1),
  })
  .strict();

export const scriptPlanSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    episode: scriptEpisodeSchema,
    styleContext: projectStyleContextSchema,
    facts: scriptFactPackSchema,
    scenes: z.array(scriptSceneSchema),
    metadataDraft: metadataDraftSchema,
  })
  .strict();

export type ScriptPlan = z.infer<typeof scriptPlanSchema>;

const storedScriptSceneSchema = scriptSceneSchema.extend({
  visualHookArchetype: z.enum(VISUAL_HOOK_ARCHETYPES).optional(),
});

const storedScriptPlanSchema = scriptPlanSchema.extend({
  scenes: z.array(storedScriptSceneSchema),
});

export type CompiledScriptPlanPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_script_plan_v1";
  schemaVersion: 1;
};

export const SCRIPT_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "episode", "styleContext", "facts", "scenes", "metadataDraft"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    episode: {
      type: "object",
      additionalProperties: false,
      required: [
        "seedId",
        "workingTitle",
        "centralQuestion",
        "viewerCuriosity",
        "mechanismSummary",
        "payoff",
        "riskFlags",
      ],
      properties: {
        seedId: { type: "string", minLength: 1 },
        workingTitle: { type: "string", minLength: 1 },
        centralQuestion: { type: "string", minLength: 1 },
        viewerCuriosity: { type: "string", minLength: 1 },
        mechanismSummary: { type: "string", minLength: 1 },
        payoff: { type: "string", minLength: 1 },
        riskFlags: { type: "array", items: { type: "string" } },
      },
    },
    styleContext: {
      type: "object",
      additionalProperties: false,
      required: [
        "visualStyle",
        "tone",
        "pacing",
        "colorAndLighting",
        "imageContinuity",
        "voiceDirection",
      ],
      properties: {
        visualStyle: { type: "string", minLength: 1 },
        tone: { type: "string", minLength: 1 },
        pacing: { type: "string", minLength: 1 },
        colorAndLighting: { type: "string", minLength: 1 },
        imageContinuity: { type: "string", minLength: 1 },
        voiceDirection: { type: "string", minLength: 1 },
      },
    },
    facts: {
      type: "object",
      additionalProperties: false,
      required: [
        "coreMechanism",
        "supportingFacts",
        "simpleAnalogy",
        "commonMisconception",
        "doNotSay",
        "needsHumanReview",
      ],
      properties: {
        coreMechanism: { type: "string", minLength: 1 },
        supportingFacts: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
        simpleAnalogy: { type: "string", minLength: 1 },
        commonMisconception: { type: "string", minLength: 1 },
        doNotSay: { type: "array", items: { type: "string" } },
        needsHumanReview: { type: "boolean" },
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "position",
          "role",
          "durationSeconds",
          "narration",
          "caption",
          "imagePrompt",
          "ssml",
          "visualBrief",
          "visualHookArchetype",
          "ttsDirection",
        ],
        properties: {
          position: { type: "integer", minimum: 1 },
          role: { type: "string", enum: ["hook", "context", "point", "payoff", "cta"] },
          durationSeconds: { type: "integer", minimum: 1 },
          narration: { type: "string", minLength: 1 },
          caption: { type: "string", minLength: 1 },
          imagePrompt: { type: "string", minLength: 1 },
          ssml: { type: "string", minLength: 1 },
          visualBrief: { type: "string", minLength: 1 },
          visualHookArchetype: {
            type: "string",
            enum: VISUAL_HOOK_ARCHETYPES,
          },
          ttsDirection: { type: "string", minLength: 1 },
        },
      },
    },
    metadataDraft: {
      type: "object",
      additionalProperties: false,
      required: ["youtubeTitle", "description", "hashtags", "disclosureHint"],
      properties: {
        youtubeTitle: { type: "string", minLength: 1, maxLength: 100 },
        description: { type: "string", minLength: 1 },
        hashtags: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          items: { type: "string", minLength: 1 },
        },
        disclosureHint: { type: "string", minLength: 1 },
      },
    },
  },
} as const;

export const scriptPlanPrompt: PromptTemplate<GenerateScriptInput, CompiledScriptPlanPrompt> = {
  id: "tiny_mechanisms_script_plan",
  version: 5,
  purpose: "script",
  provider: "openai",
  compile(input) {
    const seed = getTinyMechanismsSeed(input.seedId);
    if (!seed) {
      throw new Error("tiny_mechanisms_seed_not_found");
    }

    const roles = TINY_MECHANISMS_SCENE_ROLES_BY_DURATION[input.targetDurationSeconds];

    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "tiny_mechanisms_script_plan_v1",
      schemaVersion: 1,
      modelParameters: {
        channelPresetId: input.channelPresetId,
        targetDurationSeconds: input.targetDurationSeconds,
        sceneRoles: roles,
      },
      metadata: {
        seed,
      },
      messages: [
        {
          role: "developer",
          content: [
            "# Identity",
            "You are a senior short-form educational documentary writer and creative director.",
            "You specialize in English 9:16 YouTube Shorts that explain tiny everyday mechanisms with tight pacing, visual-first scene planning, and clear payoff.",
            "",
            "# Editorial Mission",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "Create one focused micro-documentary episode from the selected seed. The final script should feel specific, concrete, and immediately understandable to a curious general audience.",
            "Every scene must earn its time with either curiosity, mechanism clarity, visual evidence, payoff, or a loop-back ending.",
            "Use the selected mechanical episode concept fields directly. Do not drift into a broad everyday-science explainer.",
            "Open with the misconception, impossible-looking behavior, or satisfying action already happening.",
            "Do not use a generic \"inside this object\" opening unless the selected title angle requires it.",
            "The hook and payoff must be connected by the selected loopPayoff.",
            "At least one point scene must reveal the named mechanism through the selected visualReveal.",
            "Narration should include the selected satisfyingMotion as concrete verbs where natural.",
            "Do not over-explain the entire object. Explain the selected mechanism only.",
            "Avoid repeating generic sentence shapes such as \"This works because\" and \"Inside, there is\".",
            "",
            "# Pacing Rules",
            "All narration, captions, image prompt seeds, SSML, and metadata drafts must be English.",
            "Write spoken narration that is compact, natural, and easy to understand when heard once.",
            "The first narration sentence must be understandable without context.",
            "The payoff must answer the hook instead of adding a new mystery.",
            "The cta scene is a loop-ending slot, not a long subscribe call-to-action.",
            "",
            "# Visual-First Rules",
            "Each scene must choose one visualHookArchetype from: impossible_macro, consequence_first, hands_on_demo, before_after_contrast, frozen_motion, scale_shock, reveal_cutaway.",
            "Each image prompt seed must describe a concrete vertical frame using subject + action already happening + consequence or tension + camera viewpoint.",
            "For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
            "Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
            "Hook image prompts must show the phenomenon already happening, not a calm setup before it happens.",
            "Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, frozen motion, scale shock, or a physical metaphor.",
            "Prefer real-world objects, hands, silhouettes, tabletop demonstrations, macro textures, and physically readable cause/effect over abstract floating diagrams.",
            "",
            "# Safety and Scope",
            "Do not invent a new topic. Use the selected seed exactly.",
            "Do not create medical, finance, legal, political, crime, disaster, public figure, or breaking-news content.",
            "For lock or security-adjacent mechanisms, explain internal principles only; never provide bypass, picking, decoding, cracking, defeating, tool-use, step sequences, or unauthorized-opening instructions.",
            "",
            "# Output Contract",
            "Return production-ready JSON that follows the supplied schema.",
            "Return the exact requested scene count and role order.",
            "SSML must use one <speak> root and speak the narration naturally.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `<channel_preset_id>${input.channelPresetId}</channel_preset_id>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<scene_roles>${roles.join(", ")}</scene_roles>`,
            `<seed_id>${seed.seedId}</seed_id>`,
            `<central_question>${seed.centralQuestion}</central_question>`,
            `<mechanism_family>${seed.mechanismFamily}</mechanism_family>`,
            `<object_or_mechanism>${seed.objectOrMechanism}</object_or_mechanism>`,
            `<title_angle>${seed.titleAngle}</title_angle>`,
            `<viewer_misconception>${seed.viewerMisconception}</viewer_misconception>`,
            `<mechanism_hint>${seed.mechanismHint}</mechanism_hint>`,
            `<satisfying_motion>${seed.satisfyingMotion}</satisfying_motion>`,
            `<visual_reveal>${seed.visualReveal}</visual_reveal>`,
            `<loop_payoff>${seed.loopPayoff}</loop_payoff>`,
            `<visual_metaphor>${seed.visualMetaphor}</visual_metaphor>`,
            `Return exactly ${roles.length} scenes in this role order.`,
          ].join("\n"),
        },
      ],
    };
  },
};

export function parseScriptPlan(value: unknown, input: GenerateScriptInput): ScriptPlan {
  const parsed = scriptPlanSchema.safeParse(value);
  const roles = TINY_MECHANISMS_SCENE_ROLES_BY_DURATION[input.targetDurationSeconds];

  if (!parsed.success || !hasExpectedScenePlan(parsed.data.scenes, roles)) {
    throw new Error("script_response_invalid");
  }

  if (parsed.data.episode.seedId !== input.seedId) {
    throw new Error("script_response_invalid");
  }

  const totalDuration = parsed.data.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  if (Math.abs(totalDuration - input.targetDurationSeconds) > 2) {
    throw new Error("script_response_invalid");
  }

  return parsed.data;
}

function hasExpectedScenePlan(
  scenes: ScriptScene[],
  roles: readonly ScriptScene["role"][],
): boolean {
  if (scenes.length !== roles.length) {
    return false;
  }

  return scenes.every(
    (scene, index) => scene.position === index + 1 && scene.role === roles[index],
  );
}

export function defaultProjectStyleContext(): ProjectStyleContext {
  return {
    visualStyle:
      "social-native vertical macro mechanism frames with real objects, cutaways, transparent housings, springs, cams, latches, gears, pawls, tracks, levers, valves, and tactile material texture",
    tone: "clear, curious, precise, lightly dramatic, and never generic",
    pacing: "brisk but intelligible short-form narration with a satisfying mechanical reveal",
    colorAndLighting:
      "high contrast, bright mobile-readable subject separation, tactile real-world texture, metallic and plastic detail, and clean caption-safe negative space",
    imageContinuity:
      "consistent mechanical micro-documentary language with one dominant object, one readable mechanism, and one satisfying motion beat per scene",
    voiceDirection: "warm documentary narrator with crisp articulation and a clean loop payoff",
  };
}

export function styleContextFromScriptResponseText(
  responseText: string | null | undefined,
): ProjectStyleContext | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = storedScriptPlanSchema.safeParse(JSON.parse(responseText));
    return parsed.success ? parsed.data.styleContext : undefined;
  } catch {
    return undefined;
  }
}

export function sceneVisualBriefFromScriptResponseText(
  responseText: string | null | undefined,
  scenePosition: number,
): string | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = storedScriptPlanSchema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return undefined;
    }

    return parsed.data.scenes.find((scene) => scene.position === scenePosition)?.visualBrief;
  } catch {
    return undefined;
  }
}

export function sceneVisualHookArchetypeFromScriptResponseText(
  responseText: string | null | undefined,
  scenePosition: number,
): VisualHookArchetype | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = storedScriptPlanSchema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return undefined;
    }

    const value = parsed.data.scenes.find(
      (scene) => scene.position === scenePosition,
    )?.visualHookArchetype;

    return value && isVisualHookArchetype(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
