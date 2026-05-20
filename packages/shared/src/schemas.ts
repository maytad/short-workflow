import { z } from "zod";

import {
  ASSET_KINDS,
  ASSET_PROVIDERS,
  ASSET_STATUSES,
  DEFAULT_MAX_ATTEMPTS,
  DURATION_PRESETS_SECONDS,
  JOB_STATUSES,
  JOB_TYPES,
  PROJECT_STATUSES,
  RENDER_FPS,
  RENDER_HEIGHT,
  RENDER_STATUSES,
  RENDER_WIDTH,
  SCENE_ROLES,
  SCENE_STATUSES,
  STORAGE_DRIVERS,
} from "./constants";

export const uuidSchema = z.uuid();
export const isoDateSchema = z.iso.datetime();
export const nullableIsoDateSchema = isoDateSchema.nullable();

export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export const sceneStatusSchema = z.enum(SCENE_STATUSES);
export const sceneRoleSchema = z.enum(SCENE_ROLES);
export const assetKindSchema = z.enum(ASSET_KINDS);
export const assetStatusSchema = z.enum(ASSET_STATUSES);
export const storageDriverSchema = z.enum(STORAGE_DRIVERS);
export const assetProviderSchema = z.enum(ASSET_PROVIDERS);
export const jobTypeSchema = z.enum(JOB_TYPES);
export const jobStatusSchema = z.enum(JOB_STATUSES);
export const renderStatusSchema = z.enum(RENDER_STATUSES);
export const durationPresetSecondsSchema = z.union([
  z.literal(DURATION_PRESETS_SECONDS[0]),
  z.literal(DURATION_PRESETS_SECONDS[1]),
  z.literal(DURATION_PRESETS_SECONDS[2]),
]);

const jsonRecordSchema = z.record(z.string(), z.unknown());
const nullableUuidSchema = uuidSchema.nullable();
const nullableStringSchema = z.string().nullable();

export const projectSchema = z
  .object({
    id: uuidSchema,
    title: z.string(),
    topic: z.string(),
    status: projectStatusSchema,
    targetDurationSeconds: durationPresetSecondsSchema,
    language: z.literal("en"),
    format: z.literal("vertical_9_16"),
    hasSuccessfulRender: z.boolean().optional(),
    latestRenderStale: z.boolean().optional(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const sceneSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    position: z.number().int().positive(),
    role: sceneRoleSchema,
    durationSeconds: z.number().int().positive(),
    narration: z.string(),
    caption: z.string(),
    imagePrompt: z.string(),
    ssml: z.string(),
    status: sceneStatusSchema,
    contentUpdatedAt: isoDateSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const assetSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    sceneId: nullableUuidSchema,
    kind: assetKindSchema,
    storageDriver: storageDriverSchema,
    path: z.string().min(1),
    mimeType: nullableStringSchema,
    sizeBytes: z.number().int().nonnegative().nullable(),
    checksum: z
      .string()
      .regex(/^sha256:[a-f0-9]{64}$/)
      .nullable(),
    status: assetStatusSchema,
    provider: assetProviderSchema,
    model: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const jobSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    sceneId: nullableUuidSchema,
    type: jobTypeSchema,
    status: jobStatusSchema,
    attempts: z.number().int().nonnegative(),
    maxAttempts: z.number().int().positive().default(DEFAULT_MAX_ATTEMPTS),
    parentJobId: nullableUuidSchema,
    errorMessage: nullableStringSchema,
    input: jsonRecordSchema,
    output: jsonRecordSchema.nullable(),
    nextRetryAt: nullableIsoDateSchema,
    createdAt: isoDateSchema,
    startedAt: nullableIsoDateSchema,
    finishedAt: nullableIsoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeMetadataSchema = z
  .object({
    youtubeTitle: z.string().min(1).max(100),
    description: z.string().min(1),
    hashtags: z.array(z.string().min(1)).min(1).max(5),
    disclosureHint: z.string().min(1),
  })
  .strict();

export const youtubeAuthStatusSchema = z
  .object({
    connected: z.boolean(),
  })
  .strict();

export const youtubeAuthStartResponseSchema = z
  .object({
    authUrl: z.url(),
  })
  .strict();

export const youtubeUploadModeSchema = z.enum(["private", "scheduled_public"]);
export const youtubeUploadScheduleStatusSchema = z.enum([
  "reserved",
  "uploading",
  "scheduled",
  "failed",
  "cancelled",
]);

export const youtubeUploadScheduleSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    jobId: nullableUuidSchema,
    renderId: uuidSchema,
    outputAssetId: uuidSchema,
    scheduledPublishAt: isoDateSchema,
    timezone: z.string().min(1),
    status: youtubeUploadScheduleStatusSchema,
    youtubeVideoId: z.string().min(1).nullable(),
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeUploadRequestSchema = z
  .object({
    mode: youtubeUploadModeSchema.default("scheduled_public"),
  })
  .strict();

const baseYoutubeUploadJobInputSchema = z.object({
  renderId: uuidSchema,
  outputAssetId: uuidSchema,
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).max(20),
  privacyStatus: z.literal("private"),
  selfDeclaredMadeForKids: z.literal(false),
  containsSyntheticMedia: z.literal(true),
});

export const youtubeUploadJobInputSchema = z.discriminatedUnion("mode", [
  baseYoutubeUploadJobInputSchema
    .extend({
      mode: z.literal("private"),
      publishAt: z.never().optional(),
      scheduleId: z.never().optional(),
    })
    .strict(),
  baseYoutubeUploadJobInputSchema
    .extend({
      mode: z.literal("scheduled_public"),
      publishAt: isoDateSchema,
      scheduleId: uuidSchema,
    })
    .strict(),
]);

export const youtubeUploadJobOutputSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
    youtubeStudioUrl: z.url(),
    mode: youtubeUploadModeSchema,
    privacyStatus: z.literal("private"),
    publishAt: nullableIsoDateSchema,
    scheduleId: nullableUuidSchema,
    uploadedAt: isoDateSchema,
  })
  .strict();

export const youtubeUploadSummarySchema = z
  .object({
    jobId: uuidSchema,
    status: jobStatusSchema,
    mode: youtubeUploadModeSchema.nullable(),
    youtubeVideoId: z.string().min(1).nullable(),
    youtubeStudioUrl: z.url().nullable(),
    privacyStatus: z.literal("private").nullable(),
    publishAt: nullableIsoDateSchema,
    scheduledPublishAt: nullableIsoDateSchema,
    scheduleStatus: youtubeUploadScheduleStatusSchema.nullable(),
    timezone: z.string().min(1).nullable(),
    uploadedAt: nullableIsoDateSchema,
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeVideoLinkSourceSchema = z.enum(["db_upload", "channel_discovery"]);
export const youtubeVideoLinkStatusSchema = z.enum(["linked", "unlinked"]);
export const youtubeDiagnosisTypeSchema = z.enum(["rule_based", "ai"]);
export const youtubeDiagnosisPrioritySchema = z.enum(["low", "medium", "high"]);

export const youtubeVideoLinkSchema = z
  .object({
    id: uuidSchema,
    youtubeVideoId: z.string().min(1),
    projectId: nullableUuidSchema,
    uploadJobId: nullableUuidSchema,
    source: youtubeVideoLinkSourceSchema,
    linkStatus: youtubeVideoLinkStatusSchema,
    title: z.string().min(1),
    description: nullableStringSchema,
    publishedAt: nullableIsoDateSchema,
    durationSeconds: z.number().int().positive().nullable(),
    privacyStatus: nullableStringSchema,
    lastSyncedAt: nullableIsoDateSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeAnalyticsSnapshotSchema = z
  .object({
    id: uuidSchema,
    youtubeVideoLinkId: uuidSchema,
    youtubeVideoId: z.string().min(1),
    snapshotAt: isoDateSchema,
    windowDays: z.number().int().positive(),
    views: z.number().int().nonnegative().nullable(),
    engagedViews: z.number().int().nonnegative().nullable(),
    likes: z.number().int().nonnegative().nullable(),
    comments: z.number().int().nonnegative().nullable(),
    shares: z.number().int().nonnegative().nullable(),
    subscribersGained: z.number().int().nullable(),
    averageViewDurationSeconds: z.number().int().nonnegative().nullable(),
    averageViewPercentage: z.number().nullable(),
    viewsPerHour: z.number().nullable(),
    likeRate: z.number().nullable(),
    createdAt: isoDateSchema,
  })
  .strict();

export const youtubeVideoDiagnosisSchema = z
  .object({
    id: uuidSchema,
    youtubeVideoLinkId: uuidSchema,
    snapshotId: uuidSchema,
    diagnosisType: youtubeDiagnosisTypeSchema,
    model: nullableStringSchema,
    reasoningEffort: nullableStringSchema,
    inputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    summaryTh: z.string().min(1),
    suggestionsEn: jsonRecordSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export const youtubeAnalyticsCreativeContextSchema = z
  .object({
    projectId: uuidSchema,
    projectTitle: z.string().min(1),
    topic: z.string().min(1),
    seedId: z.string().min(1).nullable(),
    appealTier: z.string().min(1).nullable(),
    mechanismFamily: z.string().min(1).nullable(),
    visualHookArchetype: z.string().min(1).nullable(),
    hookNarration: nullableStringSchema,
    hookCaption: nullableStringSchema,
    hookImagePrompt: nullableStringSchema,
    scriptPromptVersion: z.number().int().positive().nullable(),
    imagePromptVersion: z.number().int().positive().nullable(),
  })
  .strict();

export const renderSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    status: renderStatusSchema,
    inputAssetId: nullableUuidSchema,
    outputAssetId: nullableUuidSchema,
    durationSeconds: z.number().min(20).max(60),
    width: z.literal(RENDER_WIDTH),
    height: z.literal(RENDER_HEIGHT),
    fps: z.literal(RENDER_FPS),
    aiDisclosureAcknowledgedAt: nullableIsoDateSchema,
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Render = z.infer<typeof renderSchema>;
export type YoutubeMetadata = z.infer<typeof youtubeMetadataSchema>;
export type YoutubeAuthStatus = z.infer<typeof youtubeAuthStatusSchema>;
export type YoutubeAuthStartResponse = z.infer<typeof youtubeAuthStartResponseSchema>;
export type YoutubeUploadMode = z.infer<typeof youtubeUploadModeSchema>;
export type YoutubeUploadRequest = z.infer<typeof youtubeUploadRequestSchema>;
export type YoutubeUploadSchedule = z.infer<typeof youtubeUploadScheduleSchema>;
export type YoutubeUploadScheduleStatus = z.infer<typeof youtubeUploadScheduleStatusSchema>;
export type YoutubeUploadJobInput = z.infer<typeof youtubeUploadJobInputSchema>;
export type YoutubeUploadJobOutput = z.infer<typeof youtubeUploadJobOutputSchema>;
export type YoutubeUploadSummary = z.infer<typeof youtubeUploadSummarySchema>;
export type YoutubeVideoLinkSource = z.infer<typeof youtubeVideoLinkSourceSchema>;
export type YoutubeVideoLinkStatus = z.infer<typeof youtubeVideoLinkStatusSchema>;
export type YoutubeDiagnosisType = z.infer<typeof youtubeDiagnosisTypeSchema>;
export type YoutubeDiagnosisPriority = z.infer<typeof youtubeDiagnosisPrioritySchema>;
export type YoutubeVideoLink = z.infer<typeof youtubeVideoLinkSchema>;
export type YoutubeAnalyticsSnapshot = z.infer<typeof youtubeAnalyticsSnapshotSchema>;
export type YoutubeVideoDiagnosis = z.infer<typeof youtubeVideoDiagnosisSchema>;
export type YoutubeAnalyticsCreativeContext = z.infer<
  typeof youtubeAnalyticsCreativeContextSchema
>;
