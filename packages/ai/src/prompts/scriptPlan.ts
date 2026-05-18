import { z } from "zod";

import type { GenerateScriptInput, ProjectStyleContext, ScriptScene } from "../types";
import {
  getTinyMechanismsSeed,
  TINY_MECHANISMS_CHANNEL_BIBLE,
  TINY_MECHANISMS_PRESET_ID,
  TINY_MECHANISMS_SCENE_ROLES_BY_DURATION,
} from "./presets/tinyMechanisms";
import type { CompiledPrompt, PromptTemplate } from "./types";

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
  version: 2,
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
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "Return production-ready JSON that follows the supplied schema.",
            "Do not invent a new topic. Use the selected seed exactly.",
            "Do not create medical, finance, legal, political, crime, disaster, public figure, or breaking-news content.",
            "All narration, captions, image prompt seeds, SSML, and metadata drafts must be English.",
            "The cta scene is a loop-ending slot, not a long subscribe call-to-action.",
            "Each image prompt seed must describe a concrete visual frame, not a vague concept.",
            "For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
            "Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
            "Hook image prompts must identify the object or phenomenon immediately and include a visual curiosity gap.",
            "Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, or a physical metaphor.",
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
            `<everyday_object_or_phenomenon>${seed.everydayObjectOrPhenomenon}</everyday_object_or_phenomenon>`,
            `<mechanism_hint>${seed.mechanismHint}</mechanism_hint>`,
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
      "faceless editorial documentary stills with cinematic realism, macro details, object cutaways, and clear vertical composition",
    tone: "clear, curious, precise, lightly dramatic, and never generic",
    pacing: "brisk but intelligible short-form narration",
    colorAndLighting:
      "natural contrast, controlled highlights, grounded color, and mobile-readable subject separation",
    imageContinuity:
      "consistent documentary visual language across scenes with one concrete object-level detail per scene",
    voiceDirection: "warm documentary narrator with crisp articulation and a clean payoff",
  };
}

export function styleContextFromScriptResponseText(
  responseText: string | null | undefined,
): ProjectStyleContext | undefined {
  if (!responseText) {
    return undefined;
  }

  try {
    const parsed = scriptPlanSchema.safeParse(JSON.parse(responseText));
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
    const parsed = scriptPlanSchema.safeParse(JSON.parse(responseText));
    if (!parsed.success) {
      return undefined;
    }

    return parsed.data.scenes.find((scene) => scene.position === scenePosition)?.visualBrief;
  } catch {
    return undefined;
  }
}
