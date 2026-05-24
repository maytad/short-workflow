import { z } from "zod";

import type { GenerateScriptInput, ProjectStyleContext, ScriptScene } from "../types";
import {
  getTinyMechanismsSeed,
  TINY_MECHANISMS_CHANNEL_BIBLE,
  TINY_MECHANISMS_PRESET_ID,
  TINY_MECHANISMS_SCENE_ROLES_BY_DURATION,
} from "./presets/tinyMechanisms";
import type { RefinedEpisodeBrief } from "./episodeJudge";
import type { EpisodeCandidate } from "./episodeResearch";
import type { CompiledPrompt, PromptTemplate } from "./types";
import {
  isVisualHookArchetype,
  VISUAL_HOOK_ARCHETYPES,
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

export const sceneVisualPlanSchema = z
  .object({
    firstFrameJob: z.string().min(1),
    familiarObject: z.string().min(1),
    visibleAction: z.string().min(1),
    visibleConsequence: z.string().min(1),
    viewerQuestion: z.string().min(1),
    motionOrTension: z.string().min(1),
    cameraFraming: z.string().min(1),
    captionSafeZone: z.string().min(1),
    avoidVisuals: z.array(z.string().min(1)).min(1),
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
    visualPlan: sceneVisualPlanSchema,
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
  visualPlan: sceneVisualPlanSchema.optional(),
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

const SCENE_VISUAL_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "firstFrameJob",
    "familiarObject",
    "visibleAction",
    "visibleConsequence",
    "viewerQuestion",
    "motionOrTension",
    "cameraFraming",
    "captionSafeZone",
    "avoidVisuals",
  ],
  properties: {
    firstFrameJob: { type: "string", minLength: 1 },
    familiarObject: { type: "string", minLength: 1 },
    visibleAction: { type: "string", minLength: 1 },
    visibleConsequence: { type: "string", minLength: 1 },
    viewerQuestion: { type: "string", minLength: 1 },
    motionOrTension: { type: "string", minLength: 1 },
    cameraFraming: { type: "string", minLength: 1 },
    captionSafeZone: { type: "string", minLength: 1 },
    avoidVisuals: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
  },
} as const;

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
          "visualPlan",
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
          visualPlan: SCENE_VISUAL_PLAN_JSON_SCHEMA,
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

function scriptTopicFields(input: GenerateScriptInput): {
  seedId: string;
  objectOrMechanism: string;
  titleAngle: string;
  centralQuestion: string;
  viewerMisconception: string;
  mechanismHint: string;
  satisfyingMotion: string;
  visualReveal: string;
  loopPayoff: string;
  visualMetaphor: string;
  audienceContext: string;
  nativeSetting: string;
  hookEmotion: string;
  avoidVisualSetting: string;
  source: "refined_brief" | "ai_candidate" | "static_seed";
  refinedBrief?: RefinedEpisodeBrief;
  candidate?: EpisodeCandidate;
} {
  if (input.refinedEpisodeBrief) {
    const brief = input.refinedEpisodeBrief;
    return {
      seedId: input.seedId,
      objectOrMechanism: brief.objectOrMechanism,
      titleAngle: brief.titleCuriosityGap,
      centralQuestion: brief.centralQuestion,
      viewerMisconception: brief.viewerQuestion,
      mechanismHint: brief.mechanismProof,
      satisfyingMotion:
        "start with the surprising everyday behavior, reveal the smallest hidden cause, prove it visually, loop the payoff",
      visualReveal: brief.visualReveal,
      loopPayoff: brief.loopPayoff,
      visualMetaphor: brief.firstFrame,
      audienceContext: "a broad curious audience that recognizes the object immediately",
      nativeSetting: "the familiar setting where the object naturally appears",
      hookEmotion: brief.retentionPromise,
      avoidVisualSetting: brief.avoidAngles.join(", "),
      source: "refined_brief",
      refinedBrief: brief,
    };
  }

  if (input.episodeCandidate) {
    const candidate = input.episodeCandidate;
    return {
      seedId: input.seedId,
      objectOrMechanism: candidate.objectOrMechanism,
      titleAngle: candidate.titleCuriosityGap,
      centralQuestion: candidate.centralQuestion,
      viewerMisconception: candidate.feedHypothesis,
      mechanismHint: candidate.mechanismProof,
      satisfyingMotion:
        "start with the surprising everyday behavior, reveal the smallest hidden cause, prove it visually, loop the payoff",
      visualReveal: candidate.visualReveal,
      loopPayoff: candidate.loopPayoff,
      visualMetaphor: candidate.firstFrame,
      audienceContext: candidate.broadAudienceReason,
      nativeSetting: "the familiar setting where the object naturally appears",
      hookEmotion: candidate.retentionPromise,
      avoidVisualSetting: "generic workbench, calm object portrait, clean diagram as the opening frame",
      source: "ai_candidate",
      candidate,
    };
  }

  const seed = getTinyMechanismsSeed(input.seedId);
  if (!seed) {
    throw new Error("tiny_mechanisms_seed_not_found");
  }

  return {
    seedId: seed.seedId,
    objectOrMechanism: seed.objectOrMechanism,
    titleAngle: seed.titleAngle,
    centralQuestion: seed.centralQuestion,
    viewerMisconception: seed.viewerMisconception,
    mechanismHint: seed.mechanismHint,
    satisfyingMotion: seed.satisfyingMotion,
    visualReveal: seed.visualReveal,
    loopPayoff: seed.loopPayoff,
    visualMetaphor: seed.visualMetaphor,
    audienceContext: seed.audienceContext,
    nativeSetting: seed.nativeSetting,
    hookEmotion: seed.hookEmotion,
    avoidVisualSetting: seed.avoidVisualSetting,
    source: "static_seed",
  };
}

export const scriptPlanPrompt: PromptTemplate<GenerateScriptInput, CompiledScriptPlanPrompt> = {
  id: "tiny_mechanisms_script_plan",
  version: 12,
  purpose: "script",
  provider: "openai",
  compile(input) {
    const topic = scriptTopicFields(input);
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
        topicSource: topic.source,
        topic,
        episodeResearch: input.episodeResearch ?? null,
        refinedEpisodeBrief: input.refinedEpisodeBrief ?? null,
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
            "Create one focused micro-documentary episode from the selected topic brief. The final script should feel specific, concrete, and immediately understandable to a curious general audience.",
            "The first frame and first line must be strong enough for a Shorts feed test before the viewer hears the full explanation.",
            "For 30-second episodes, optimize completion and replay over breadth.",
            "Every scene must earn its time with either curiosity, mechanism clarity, visual evidence, payoff, or a loop-back ending.",
            "Start from the viewer-facing behavior before naming the mechanism.",
            "Write for people who recognize the everyday object, not for engineers, repair technicians, or tool collectors.",
            "Use the selected audienceContext, nativeSetting, hookEmotion, and avoidVisualSetting as creative constraints.",
            "Do not default to a workshop, repair bench, dark tabletop, or tool tutorial unless the selected nativeSetting explicitly requires it.",
            "When the topic is a tool, frame the hook around sound, surprise, resistance, speed, snap, or one-way behavior rather than repair steps.",
            "The hook should create a small emotional reason to keep watching: surprise, tension, disbelief, relief, or satisfying completion.",
            "Use the selected episode concept fields directly. Do not drift into a broad everyday-science explainer.",
            "Topic gate: every episode angle must preserve an everyday object or behavior, a visible surprise, a hidden cause, and a common wrong assumption.",
            "The hidden cause does not need to be a moving mechanical part. It may be physical, material, fluid, optical, acoustic, thermal, electrical, geometric, chemical, or another safe everyday cause.",
            "Reject topics or angles that cannot show visible evidence of the cause on screen through motion, contrast, deformation, flow, reflection, vibration, heat, sound, texture, residue, failure, or another image-readable effect.",
            "Use novelty axes before writing: mechanism family, visible action, viewer misconception, and visual strategy. If the angle feels too similar on more than two novelty axes, rewrite the angle while keeping the selected topic.",
            "Open with the misconception, impossible-looking behavior, or satisfying action already happening.",
            "Open with a visible contradiction. Preferred hook pattern: That [visible action] is not [common wrong explanation].",
            "The first second must show the contradiction on screen before the narration explains it.",
            "Preferred hook formulas: It should [expected action], but it [surprising action]; or [Object] does [surprising behavior] because [tiny part].",
            "YouTube title formula: familiar object plus surprising behavior. Prefer titles like Why a Zipper Locks Under Tension or This Tiny Cam Makes a Pen Remember.",
            'Do not use a generic "inside this object" opening unless the selected title angle requires it.',
            'Avoid abstract hook phrasing such as "not extra power", "not one round door", "without electronics", or "inside this object" when a visible action can carry the hook.',
            "The hook and payoff must be connected by the selected loopPayoff.",
            "At least one point scene must reveal the named mechanism through the selected visualReveal.",
            "Narration should include the selected satisfyingMotion as concrete verbs where natural.",
            "Do not over-explain the entire object. Explain the selected mechanism only.",
            'Avoid repeating generic sentence shapes such as "This works because" and "Inside, there is".',
            "Do not start with an intro, a calm setup, or a concept definition.",
            "Start with the visible surprise already happening, whether that is motion, contrast, deformation, flow, reflection, vibration, heat, sound, texture, residue, failure, or another image-readable effect.",
            "The first narration line must be no more than 8 words.",
            "The first caption must be no more than 4 words.",
            "Do not repeat the sentence shape That X is not Y unless it is clearly the strongest hook.",
            "Every 3-5 seconds must add a new visual reason to keep watching.",
            "",
            "# Pacing Rules",
            "All narration, captions, image prompt seeds, SSML, and metadata drafts must be English.",
            "Write spoken narration that is compact, natural, and easy to understand when heard once.",
            "Narration is the source text for TTS.",
            "Captions must be punch captions, not transcript lines.",
            "Captions are punch captions, not transcripts and not karaoke timing source text.",
            "Caption is short punch text for on-screen emphasis, not transcript text.",
            "Do not make caption match the full narration.",
            "Keep each caption to 2-4 words. A payoff may use 5 words only when the line stays readable.",
            "This 2-4 word caption rule overrides any broader channel-bible caption range.",
            "Do not copy full narration into captions.",
            "Do not output word-level timing, timestamps, beat timings, or karaoke timing.",
            "Karaoke timing is derived later from final audio and transcript alignment.",
            "Audio alignment owns karaoke timing later.",
            "Keep ttsDirection separate as delivery guidance only; do not merge it into narration or caption.",
            "Prefer state-change captions that name the visible change: Weight shifts, Sound cancels, Heat cracks, Light bends, Surface lets go.",
            "Avoid semicolons, periods, colons, parentheses, equals signs, and decorative punctuation in captions; write plain words instead.",
            "Keep total spoken narration within the approved budget: 30 seconds = 55-75 words, 45 seconds = 85-115 words, 60 seconds = 110-150 words.",
            "For each scene, target 2.0-2.4 spoken words per second and hard-cap narration at 2.6 spoken words per second.",
            "A 5-second CTA should be about 8-12 words. If a line does not fit, cut words instead of stretching the scene.",
            "The first narration sentence must be understandable without context.",
            "The payoff must answer the hook instead of adding a new mystery.",
            "The cta scene is a loop-ending slot, not a long subscribe call-to-action.",
            "Explain the hidden cause in three concrete beats when possible: visible behavior happens, hidden cause is revealed, output makes sense.",
            "Prefer concrete sensory verbs over abstract explanations: bends, sticks, slips, flows, reflects, vibrates, warms, cracks, cancels, separates.",
            "",
            "# Visual-First Rules",
            "Each scene must choose one visualHookArchetype from: impossible_macro, consequence_first, hands_on_demo, before_after_contrast, frozen_motion, scale_shock, reveal_cutaway.",
            "Each scene must include a visualPlan object describing firstFrameJob, familiarObject, visibleAction already happening, visibleConsequence, viewerQuestion, motionOrTension, cameraFraming, captionSafeZone, and avoidVisuals.",
            "Keep captions safe in the lower 25-30% of the vertical frame with clean negative space, while ensuring the main action remains readable above or around that zone.",
            "avoidVisuals must explicitly reject calm portrait shots, clean diagrams, generic macro shots, embedded labels, logos, watermarks, and any selected avoidVisualSetting.",
            "Each image prompt seed must describe a concrete vertical frame using subject + action already happening + consequence or tension + camera viewpoint.",
            "For each scene, make visualBrief explain what the viewer should understand from the image in under half a second.",
            "Image prompt seeds and visual briefs must not ask for embedded text, labels, captions, typography, UI, logos, or watermarks.",
            "Hook image prompts must show the phenomenon already happening, not a calm setup before it happens.",
            "The first image prompt must show action, tension, resistance, or a before-after consequence before any clean explanatory cutaway.",
            "Hook scenes should usually be consequence-first, hands-on, frozen-motion, or impossible-macro; save clean cutaways for point scenes unless the cutaway is the strongest hook.",
            "Point scene image prompts must show the mechanism through macro detail, object cutaway, cause/effect, frozen motion, scale shock, or a physical metaphor.",
            "Across the scene list, vary the visual strategy so the episode does not become the same macro close-up repeated with different parts.",
            "Prefer real-world objects, hands, silhouettes, tabletop demonstrations, macro textures, and physically readable cause/effect over abstract floating diagrams.",
            "Prefer the selected nativeSetting over generic tabletop demonstrations.",
            "If the selected avoidVisualSetting names a workbench, repair bench, tutorial, or tool catalog shot, avoid that framing in every scene imagePrompt and visualBrief.",
            "",
            "# Safety and Scope",
            "Do not invent a new topic. Use the selected topic exactly.",
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
            `<seed_id>${topic.seedId}</seed_id>`,
            `<topic_source>${topic.source}</topic_source>`,
            `<central_question>${topic.centralQuestion}</central_question>`,
            `<object_or_mechanism>${topic.objectOrMechanism}</object_or_mechanism>`,
            `<title_angle>${topic.titleAngle}</title_angle>`,
            `<viewer_misconception>${topic.viewerMisconception}</viewer_misconception>`,
            `<mechanism_hint>${topic.mechanismHint}</mechanism_hint>`,
            `<satisfying_motion>${topic.satisfyingMotion}</satisfying_motion>`,
            `<visual_reveal>${topic.visualReveal}</visual_reveal>`,
            `<loop_payoff>${topic.loopPayoff}</loop_payoff>`,
            `<visual_metaphor>${topic.visualMetaphor}</visual_metaphor>`,
            `<audience_context>${topic.audienceContext}</audience_context>`,
            `<native_setting>${topic.nativeSetting}</native_setting>`,
            `<hook_emotion>${topic.hookEmotion}</hook_emotion>`,
            `<avoid_visual_setting>${topic.avoidVisualSetting}</avoid_visual_setting>`,
            ...(topic.refinedBrief
              ? [
                  `<refined_production_brief_json>${JSON.stringify(topic.refinedBrief)}</refined_production_brief_json>`,
                ]
              : []),
            ...(topic.candidate
              ? [`<selected_candidate_json>${JSON.stringify(topic.candidate)}</selected_candidate_json>`]
              : []),
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

export function enrichScriptPlanImagePrompts(plan: ScriptPlan): ScriptPlan {
  return {
    ...plan,
    scenes: plan.scenes.map((scene) => ({
      ...scene,
      imagePrompt: sceneImagePromptFromVisualPlan(scene),
    })),
  };
}

export function sceneImagePromptFromVisualPlan(scene: ScriptScene): string {
  if (scene.imagePrompt.includes("First-frame job:")) {
    return scene.imagePrompt;
  }

  const plan = scene.visualPlan;
  const avoid = plan.avoidVisuals.join(", ");

  return [
    scene.imagePrompt,
    `First-frame job: ${plan.firstFrameJob}`,
    `Familiar object: ${plan.familiarObject}`,
    `Visible action already happening: ${plan.visibleAction}`,
    `Visible consequence: ${plan.visibleConsequence}`,
    `Viewer question: ${plan.viewerQuestion}`,
    `Motion or tension: ${plan.motionOrTension}`,
    `Camera framing: ${plan.cameraFraming}`,
    `Caption-safe zone: ${plan.captionSafeZone}`,
    `Avoid: ${avoid}`,
  ].join("\n");
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
      "social-native vertical hidden-mechanism frames with familiar everyday objects, native settings, clear motion, selective macro cutaways, transparent housings only when useful, and tactile material texture",
    tone: "clear, curious, precise, lightly dramatic, and never generic",
    pacing: "brisk but intelligible short-form narration with a satisfying mechanical reveal",
    colorAndLighting:
      "high contrast, bright mobile-readable subject separation, tactile real-world texture, metallic and plastic detail, and clean caption-safe negative space",
    imageContinuity:
      "consistent audience-first micro-documentary language with one familiar object, one strange behavior, one readable mechanism, and one satisfying motion beat per scene",
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
