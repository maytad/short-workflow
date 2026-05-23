import { z } from "zod";

import { TINY_MECHANISMS_CHANNEL_BIBLE, TINY_MECHANISMS_PRESET_ID } from "./presets/tinyMechanisms";
import type { CompiledPrompt, PromptTemplate } from "./types";

export const recentVideoPromptContextSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
    title: z.string().min(1),
    views: z.number().nullable(),
    engagedViews: z.number().nullable(),
    averageViewPercentage: z.number().nullable(),
    averageViewDurationSeconds: z.number().nullable(),
    viewsPerHour: z.number().nullable(),
    likeRate: z.number().nullable(),
    hookNarration: z.string().nullable(),
    hookCaption: z.string().nullable(),
    hookImagePrompt: z.string().nullable(),
  })
  .strict();

export const episodeCandidateScoreSchema = z
  .object({
    feedClarity: z.number().int().min(1).max(5),
    swipeResistance: z.number().int().min(1).max(5),
    broadAppeal: z.number().int().min(1).max(5),
    visualNovelty: z.number().int().min(1).max(5),
    retentionPath: z.number().int().min(1).max(5),
    repeatRisk: z.number().int().min(1).max(5),
  })
  .strict();

export const episodeCandidateSchema = z
  .object({
    candidateId: z.string().min(1),
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
    whyThisCanBeatRecentVideos: z.string().min(1),
    scores: episodeCandidateScoreSchema,
  })
  .strict();

export const episodeResearchSchema = z
  .object({
    channelPresetId: z.literal(TINY_MECHANISMS_PRESET_ID),
    candidates: z.array(episodeCandidateSchema).length(5),
    selectedCandidateId: z.string().min(1),
    selectionRationale: z.string().min(1),
  })
  .strict()
  .refine(
    (value) =>
      value.candidates.some((candidate) => candidate.candidateId === value.selectedCandidateId),
    "selected_candidate_missing",
  );

export type RecentVideoPromptContext = z.infer<typeof recentVideoPromptContextSchema>;
export type EpisodeCandidateScore = z.infer<typeof episodeCandidateScoreSchema>;
export type EpisodeCandidate = z.infer<typeof episodeCandidateSchema>;
export type EpisodeResearch = z.infer<typeof episodeResearchSchema>;

export type EpisodeResearchInput = {
  channelPresetId: typeof TINY_MECHANISMS_PRESET_ID;
  targetDurationSeconds: 30 | 45 | 60;
  recentVideos: RecentVideoPromptContext[];
};

export type CompiledEpisodeResearchPrompt = CompiledPrompt & {
  purpose: "script";
  provider: "openai";
  messages: NonNullable<CompiledPrompt["messages"]>;
  schemaName: "tiny_mechanisms_episode_research_v1";
  schemaVersion: 1;
};

export const EPISODE_RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["channelPresetId", "candidates", "selectedCandidateId", "selectionRationale"],
  properties: {
    channelPresetId: { type: "string", enum: [TINY_MECHANISMS_PRESET_ID] },
    candidates: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "candidateId",
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
          "whyThisCanBeatRecentVideos",
          "scores",
        ],
        properties: {
          candidateId: { type: "string", minLength: 1 },
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
          whyThisCanBeatRecentVideos: { type: "string", minLength: 1 },
          scores: {
            type: "object",
            additionalProperties: false,
            required: [
              "feedClarity",
              "swipeResistance",
              "broadAppeal",
              "visualNovelty",
              "retentionPath",
              "repeatRisk",
            ],
            properties: {
              feedClarity: { type: "integer", minimum: 1, maximum: 5 },
              swipeResistance: { type: "integer", minimum: 1, maximum: 5 },
              broadAppeal: { type: "integer", minimum: 1, maximum: 5 },
              visualNovelty: { type: "integer", minimum: 1, maximum: 5 },
              retentionPath: { type: "integer", minimum: 1, maximum: 5 },
              repeatRisk: { type: "integer", minimum: 1, maximum: 5 },
            },
          },
        },
      },
    },
    selectedCandidateId: { type: "string", minLength: 1 },
    selectionRationale: { type: "string", minLength: 1 },
  },
} as const;

export const episodeResearchPrompt: PromptTemplate<
  EpisodeResearchInput,
  CompiledEpisodeResearchPrompt
> = {
  id: "tiny_mechanisms_episode_research",
  version: 1,
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
        candidateCount: 5,
      },
      metadata: {
        recentVideoCount: input.recentVideos.length,
      },
      messages: [
        {
          role: "developer",
          content: [
            "# Identity",
            "You are a YouTube Shorts creative strategist for Tiny Mechanisms.",
            "You generate episode candidates before scripts. You optimize for feed testing, first-frame clarity, stayed-to-watch, average view duration, average percentage viewed, and swipe resistance.",
            "",
            "# Channel",
            TINY_MECHANISMS_CHANNEL_BIBLE,
            "",
            "# Task",
            "Do not write the final script.",
            `Generate exactly 5 episode candidates for a ${input.targetDurationSeconds}-second English YouTube Short.`,
            "For 30-second optimization, prioritize completion, replay, and one instantly readable mechanism over breadth.",
            "Each candidate must start with a first frame that can be understood with sound off in under 0.5 seconds.",
            "Each first line must create curiosity in under 1 second.",
            "Prefer familiar everyday objects with visible physical motion, tension, resistance, release, cutting, sliding, snapping, bending, spraying, locking, or catching.",
            "Reject calm object portraits, abstract diagrams as hooks, medical advice, finance, legal, politics, crime, disaster, public figures, dangerous instructions, children's characters, and unsupported claims.",
            "Use low-performing recent videos as negative examples. Do not copy their topic shape, hook sentence shape, or first-frame composition.",
            "Use high-performing recent videos only as abstract patterns. Do not copy their object or wording.",
            "",
            "# Scoring",
            "Score each candidate from 1 to 5 for feedClarity, swipeResistance, broadAppeal, visualNovelty, retentionPath, and repeatRisk.",
            "For repeatRisk, 1 means low repeat risk and 5 means high repeat risk.",
            "Select exactly one candidate with the best balance of high feed clarity, high swipe resistance, high broad appeal, high visual novelty, high retention path, and low repeat risk.",
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
            `<recent_videos_json>${JSON.stringify(input.recentVideos)}</recent_videos_json>`,
          ].join("\n"),
        },
      ],
    };
  },
};

export function parseEpisodeResearch(value: unknown): EpisodeResearch {
  const parsed = episodeResearchSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("episode_research_response_invalid");
  }

  const selected = selectedEpisodeCandidate(parsed.data);
  if (!selected) {
    throw new Error("episode_candidate_selection_failed");
  }

  return parsed.data;
}

export function selectedEpisodeCandidate(research: EpisodeResearch): EpisodeCandidate | null {
  return (
    research.candidates.find(
      (candidate) => candidate.candidateId === research.selectedCandidateId,
    ) ?? null
  );
}
