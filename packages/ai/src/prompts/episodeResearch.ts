import { z } from "zod";

import { TINY_MECHANISMS_CHANNEL_BIBLE, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import { SHORTS_RECOVERY_RESEARCH_RULES } from "./shortsRecovery";
import type { CompiledPrompt, PromptTemplate } from "./types";

export const EPISODE_CANDIDATE_ROLES = [
  "feed_stop_strategist",
  "broad_object_selector",
  "visual_mechanism_director",
  "retention_architect",
  "loop_payoff_editor",
] as const;

export const episodeCandidateRoleSchema = z.enum(EPISODE_CANDIDATE_ROLES);
export type EpisodeCandidateRole = z.infer<typeof episodeCandidateRoleSchema>;

export const episodeCandidateScoreSchema = z
  .object({
    firstFrameClarity: z.number().int().min(1).max(5),
    swipeResistance: z.number().int().min(1).max(5),
    broadObjectFamiliarity: z.number().int().min(1).max(5),
    visualNovelty: z.number().int().min(1).max(5),
    retentionPath: z.number().int().min(1).max(5),
    loopPayoffStrength: z.number().int().min(1).max(5),
    genericRisk: z.number().int().min(1).max(5),
  })
  .strict();

export const episodeCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
    roleSource: episodeCandidateRoleSchema,
    objectOrMechanism: z.string().min(1),
    centralQuestion: z.string().min(1),
    firstFrame: z.string().min(1),
    firstLine: z.string().min(1),
    firstThreeWords: z.string().min(1),
    feedHypothesis: z.string().min(1),
    swipeRisk: z.enum(["low", "medium", "high"]),
    broadAudienceReason: z.string().min(1),
    retentionPromise: z.string().min(1),
    titleCuriosityGap: z.string().min(1),
    mechanismProof: z.string().min(1),
    visualReveal: z.string().min(1),
    loopPayoff: z.string().min(1),
    whyThisCanBreakPattern: z.string().min(1),
    creativeTerritory: z.string().min(1),
    visualProofMode: z.string().min(1),
    nearDuplicateRisk: z.enum(["low", "medium", "high"]),
    scores: episodeCandidateScoreSchema,
  })
  .strict();

export const roleEpisodeCandidateResponseSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    role: episodeCandidateRoleSchema,
    candidate: episodeCandidateSchema,
  })
  .strict()
  .refine((value) => value.candidate.roleSource === value.role, "candidate_role_mismatch");

export type EpisodeCandidateScore = z.infer<typeof episodeCandidateScoreSchema>;
export type EpisodeCandidate = z.infer<typeof episodeCandidateSchema>;
export type RoleEpisodeCandidateResponse = z.infer<typeof roleEpisodeCandidateResponseSchema>;

export type EpisodeResearchInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  role: EpisodeCandidateRole;
  recentLocalTopics?: readonly string[];
};

export type CompiledEpisodeResearchPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_episode_research_v1";
  schemaVersion: 1;
};

export const candidateScoreJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "firstFrameClarity",
    "swipeResistance",
    "broadObjectFamiliarity",
    "visualNovelty",
    "retentionPath",
    "loopPayoffStrength",
    "genericRisk",
  ],
  properties: {
    firstFrameClarity: { type: "integer", minimum: 1, maximum: 5 },
    swipeResistance: { type: "integer", minimum: 1, maximum: 5 },
    broadObjectFamiliarity: { type: "integer", minimum: 1, maximum: 5 },
    visualNovelty: { type: "integer", minimum: 1, maximum: 5 },
    retentionPath: { type: "integer", minimum: 1, maximum: 5 },
    loopPayoffStrength: { type: "integer", minimum: 1, maximum: 5 },
    genericRisk: { type: "integer", minimum: 1, maximum: 5 },
  },
} as const;

export const EPISODE_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "role", "candidate"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    role: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
    candidate: {
      type: "object",
      additionalProperties: false,
      required: [
        "candidateId",
        "roleSource",
        "objectOrMechanism",
        "centralQuestion",
        "firstFrame",
        "firstLine",
        "firstThreeWords",
        "feedHypothesis",
        "swipeRisk",
        "broadAudienceReason",
        "retentionPromise",
        "titleCuriosityGap",
        "mechanismProof",
        "visualReveal",
        "loopPayoff",
        "whyThisCanBreakPattern",
        "creativeTerritory",
        "visualProofMode",
        "nearDuplicateRisk",
        "scores",
      ],
      properties: {
        candidateId: { type: "string", minLength: 1 },
        roleSource: { type: "string", enum: EPISODE_CANDIDATE_ROLES },
        objectOrMechanism: { type: "string", minLength: 1 },
        centralQuestion: { type: "string", minLength: 1 },
        firstFrame: { type: "string", minLength: 1 },
        firstLine: { type: "string", minLength: 1 },
        firstThreeWords: { type: "string", minLength: 1 },
        feedHypothesis: { type: "string", minLength: 1 },
        swipeRisk: { type: "string", enum: ["low", "medium", "high"] },
        broadAudienceReason: { type: "string", minLength: 1 },
        retentionPromise: { type: "string", minLength: 1 },
        titleCuriosityGap: { type: "string", minLength: 1 },
        mechanismProof: { type: "string", minLength: 1 },
        visualReveal: { type: "string", minLength: 1 },
        loopPayoff: { type: "string", minLength: 1 },
        whyThisCanBreakPattern: { type: "string", minLength: 1 },
        creativeTerritory: { type: "string", minLength: 1 },
        visualProofMode: { type: "string", minLength: 1 },
        nearDuplicateRisk: { type: "string", enum: ["low", "medium", "high"] },
        scores: candidateScoreJsonSchema,
      },
    },
  },
} as const;

export function episodeResearchJsonSchemaForRole(role: EpisodeCandidateRole) {
  return {
    ...EPISODE_RESEARCH_JSON_SCHEMA,
    properties: {
      ...EPISODE_RESEARCH_JSON_SCHEMA.properties,
      role: { type: "string", enum: [role] },
      candidate: {
        ...EPISODE_RESEARCH_JSON_SCHEMA.properties.candidate,
        properties: {
          ...EPISODE_RESEARCH_JSON_SCHEMA.properties.candidate.properties,
          roleSource: { type: "string", enum: [role] },
        },
      },
    },
  } as const;
}

export function roleInstruction(role: EpisodeCandidateRole): string {
  switch (role) {
    case "feed_stop_strategist":
      return "Focus on the first frame, the first 0.5 seconds, the first line, and maximum swipe resistance. Start from a familiar everyday situation with an immediate visible contradiction, not from a mechanism family or broad fact.";
    case "broad_object_selector":
      return "Focus on a familiar everyday object or setting that a broad audience recognizes immediately. Prefer a surprising use moment, failure, trace, contrast, or state change over another cap, valve, latch, or pump demonstration.";
    case "visual_mechanism_director":
      return "Focus on visual proof of cause and effect that can be understood from the picture alone. Vary proof modes across material transfer, optical clues, acoustic clues, surface behavior, heat, residue, deformation, contact points, and state changes.";
    case "retention_architect":
      return "Focus on a reveal path that gives the viewer a new visual reason to keep watching every 3-5 seconds. Avoid flat middle explanations and reveal the hidden cause early.";
    case "loop_payoff_editor":
      return "Focus on ending payoff, replay logic, and a title curiosity gap that resolves the first-frame contradiction. The payoff must make the opening action make sense.";
  }

  const exhaustiveRole: never = role;
  return exhaustiveRole;
}

function recentLocalTopicLines(recentLocalTopics: readonly string[] | undefined): string[] {
  if (!recentLocalTopics || recentLocalTopics.length === 0) {
    return [
      "# Recent Local Topic Hints",
      "No recent local topics were supplied. Still avoid making all roles converge on the same proof family, object shape, or title angle.",
    ];
  }

  return [
    "# Recent Local Topic Hints",
    "These are duplicate warnings only, not analytics, performance evidence, memory, retrieval, or a ranked topic list.",
    "Avoid the same object, title angle, mechanism family, visual proof mode, or adjacent everyday cluster unless the user explicitly requested a repeat.",
    "Do not solve freshness by moving to the nearest adjacent cluster; for example, bottle cap ring, ketchup squeeze cap, soap pump, spray bottle pump, and tub diverter are all cap/valve/liquid-path neighbors when one of them is recent.",
    `Recent local topic count: ${recentLocalTopics.length}.`,
  ];
}

export const episodeResearchPrompt: PromptTemplate<
  EpisodeResearchInput,
  CompiledEpisodeResearchPrompt
> = {
  id: "tiny_mechanisms_episode_research",
  version: 5,
  purpose: "script",
  provider: "openai",
  compile(input) {
    return {
      templateId: this.id,
      templateVersion: this.version,
      purpose: "script",
      provider: "openai",
      schemaName: "tiny_mechanisms_episode_research_v1",
      schemaVersion: 1,
      modelParameters: {
        channelPresetId: input.channelPresetId,
        targetDurationSeconds: input.targetDurationSeconds,
        role: input.role,
        recentLocalTopicCount: input.recentLocalTopics?.length ?? 0,
      },
      metadata: {
        role: input.role,
        recentLocalTopics: input.recentLocalTopics ?? [],
      },
      messages: [
        {
          role: "developer",
          content: [
            "# Identity",
            "You are a YouTube Shorts creative strategist for Tiny Mechanisms.",
            "You generate episode candidates before scripts. You optimize for first-frame clarity, completion, replay, swipe resistance, and concrete visual hooks.",
            "",
            "# Channel",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "",
            "# Shorts Recovery Policy",
            ...SHORTS_RECOVERY_RESEARCH_RULES,
            "For this recovery batch, do not over-correct into the nearest safe cluster after pausing a weak topic. Freshness means a different everyday situation, viewer misconception, and visual proof mode.",
            "",
            ...recentLocalTopicLines(input.recentLocalTopics),
            "",
            "# Task",
            "Generate exactly one candidate for the requested role.",
            `The candidate is for a ${input.targetDurationSeconds}-second English YouTube Short.`,
            "Do not write the final script.",
            "Use only this request, the channel bible, and the requested role.",
            "`role` and `candidate.roleSource` must both equal the requested candidate role.",
            "English only.",
            roleInstruction(input.role),
            "Do not start by choosing from a fixed mechanism category or taxonomy.",
            "Start from an everyday moment that feels visually surprising, then identify the smallest hidden cause that explains it.",
            "The hidden cause can come from any safe image-readable physical behavior; mechanism-family labels are descriptive metadata after the hook, not a menu to choose from.",
            "Avoid broad lectures and non-visual claims. Biology, perception, voice, optical, acoustic, thermal, material, fluid, electrical, geometric, and everyday chemical causes are allowed only when the visual proof is concrete and safe.",
            "Use latches, springs, cams, one-way locks, ratchets, click mechanisms, caps, pumps, or valves only when the everyday situation and proof mode are clearly fresher than recent local topics.",
            "The first frame must be understandable with sound off in under 0.5 seconds.",
            "The first line must create curiosity in under 1 second.",
            "The first three words must be concrete enough to stop a feed scroll.",
            "Prefer familiar everyday behavior with a visible surprise and a provable hidden cause. Motion and tension can work, but do not default to pressure, valves, caps, pumps, or liquid flow because they are easy to stage.",
            "Strong candidates may use visible motion, still-image contradiction, contrast, texture change, reflection, vibration, heat, sound-source clues, failure, deformation, residue, phase change, material transfer, surface behavior, or another image-readable effect.",
            "Reject calm object portraits, abstract diagrams as hooks, medical advice, finance, legal, politics, crime, disaster, public figures, dangerous instructions, children's characters, and unsupported claims.",
            "Reject candidates that only restate a known object mechanism without a surprising everyday behavior in the first frame.",
            "Reject candidates that require timestamps, beat timing, word-level timing, karaoke timing, or any other timeline annotation.",
            "",
            "# Scoring",
            "Score the candidate from 1 to 5 for firstFrameClarity, swipeResistance, broadObjectFamiliarity, visualNovelty, retentionPath, loopPayoffStrength, and genericRisk.",
            "For genericRisk, 1 means low generic risk and 5 means high generic risk.",
            "Raise genericRisk and nearDuplicateRisk for familiar push-pop, latch, spring, cam-track, one-way lock, ratchet, clicker, cap, pump, or valve ideas unless the everyday situation, first frame, visual proof mode, and hidden cause feel clearly new.",
            "Set creativeTerritory to the everyday situation and viewer emotion, not the mechanism family.",
            "Set visualProofMode to the visible evidence type, such as material transfer, reflection shift, sound-source clue, texture failure, deformation, residue trail, heat change, flow path, or contact-point reveal.",
            "",
            "# Output",
            "Return JSON that follows the supplied schema.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            `<channel_preset_id>${input.channelPresetId}</channel_preset_id>`,
            `<target_duration_seconds>${input.targetDurationSeconds}</target_duration_seconds>`,
            `<candidate_role>${input.role}</candidate_role>`,
            `<recent_local_topics_json>${JSON.stringify(input.recentLocalTopics ?? [])}</recent_local_topics_json>`,
          ].join("\n"),
        },
      ],
    };
  },
};

export function parseRoleEpisodeCandidateResponse(value: unknown): RoleEpisodeCandidateResponse {
  const parsed = roleEpisodeCandidateResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("episode_candidate_response_invalid");
  }
  return parsed.data;
}
