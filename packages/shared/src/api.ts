import { z } from "zod";

import {
  DEFAULT_TARGET_DURATION_SECONDS,
  TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS,
} from "./constants";
import {
  assetSchema,
  durationPresetSecondsSchema,
  jobSchema,
  projectSchema,
  renderSchema,
  sceneSchema,
  youtubeAnalyticsCreativeContextSchema,
  youtubeAnalyticsSnapshotSchema,
  youtubeMetadataSchema,
  youtubeVideoDiagnosisSchema,
  youtubeVideoLinkSchema,
  youtubeUploadScheduleSchema,
  youtubeUploadSummarySchema,
  uuidSchema,
} from "./schemas";

export const createProjectRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    topic: z.string().trim().min(1).max(1000),
    targetDurationSeconds: durationPresetSecondsSchema.default(DEFAULT_TARGET_DURATION_SECONDS),
  })
  .strict();

export const createTinyMechanismsProjectRequestSchema = z
  .object({
    targetDurationSeconds: durationPresetSecondsSchema.optional(),
  })
  .strict()
  .transform((input) => ({
    targetDurationSeconds:
      input.targetDurationSeconds ?? TINY_MECHANISMS_DEFAULT_TARGET_DURATION_SECONDS,
  }));

export const updateProjectRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    topic: z.string().trim().min(1).max(1000).optional(),
  })
  .strict();

export const updateSceneRequestSchema = z
  .object({
    narration: z.string().optional(),
    caption: z.string().optional(),
    imagePrompt: z.string().optional(),
    ssml: z.string().optional(),
    durationSeconds: z.number().int().min(1).max(60).optional(),
  })
  .strict();

export const projectDetailResponseSchema = z
  .object({
    project: projectSchema,
    scenes: z.array(sceneSchema),
    assets: z.array(assetSchema),
    renders: z.array(renderSchema),
    jobs: z.array(jobSchema),
    youtubeMetadata: youtubeMetadataSchema.nullable(),
    youtubeUpload: youtubeUploadSummarySchema.nullable(),
  })
  .strict();

export const bulkAssetQueueResponseSchema = z
  .object({
    jobs: z.array(jobSchema),
    queuedCount: z.number().int().nonnegative(),
    existingActiveCount: z.number().int().nonnegative(),
    skippedCurrentCount: z.number().int().nonnegative(),
  })
  .strict();

export const youtubeUploadResponseSchema = z
  .object({
    job: jobSchema,
    schedule: youtubeUploadScheduleSchema.nullable(),
  })
  .strict();

export const youtubeAnalyticsRefreshRequestSchema = z
  .object({
    windowDays: z.number().int().min(1).max(90).default(30),
  })
  .strict();

export const youtubeAnalyticsAuthStatusSchema = z
  .object({
    connected: z.boolean(),
    hasRequiredScopes: z.boolean(),
    reconnectRequired: z.boolean(),
  })
  .strict();

export const youtubeAnalyticsAggregatesSchema = z
  .object({
    recentVideoCount: z.number().int().nonnegative(),
    totalViews: z.number().int().nonnegative(),
    needsAttentionCount: z.number().int().nonnegative(),
    medianAverageViewPercentage: z.number().nullable(),
    bestPerformerVideoId: z.string().min(1).nullable(),
  })
  .strict();

export const youtubeAnalyticsVideoSummarySchema = z
  .object({
    link: youtubeVideoLinkSchema,
    latestSnapshot: youtubeAnalyticsSnapshotSchema.nullable(),
    latestRuleDiagnosis: youtubeVideoDiagnosisSchema.nullable(),
    latestAiDiagnosis: youtubeVideoDiagnosisSchema.nullable(),
    creativeContext: youtubeAnalyticsCreativeContextSchema.nullable(),
  })
  .strict();

export const youtubeAnalyticsDashboardResponseSchema = z
  .object({
    auth: youtubeAnalyticsAuthStatusSchema,
    windowDays: z.number().int().min(1).max(90),
    aggregates: youtubeAnalyticsAggregatesSchema,
    videos: z.array(youtubeAnalyticsVideoSummarySchema),
  })
  .strict();

export const youtubeAiDiagnosisRequestSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
  })
  .strict();

export const youtubeAiDiagnosisResponseSchema = z
  .object({
    diagnosis: youtubeVideoDiagnosisSchema,
  })
  .strict();

export const renderPreconditionErrorSchema = z
  .object({
    error: z.literal("render_preconditions_failed"),
    details: z
      .object({
        projectHasNoScenes: z.boolean(),
        scenesNotReady: z.array(uuidSchema),
        scenesMissingImage: z.array(uuidSchema),
        scenesMissingAudio: z.array(uuidSchema),
        scenesStaleImage: z.array(uuidSchema),
        scenesStaleAudio: z.array(uuidSchema),
      })
      .strict(),
  })
  .strict();

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type CreateTinyMechanismsProjectRequest = z.input<
  typeof createTinyMechanismsProjectRequestSchema
>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UpdateSceneRequest = z.infer<typeof updateSceneRequestSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type BulkAssetQueueResponse = z.infer<typeof bulkAssetQueueResponseSchema>;
export type YoutubeUploadResponse = z.infer<typeof youtubeUploadResponseSchema>;
export type YoutubeAnalyticsRefreshRequest = z.infer<
  typeof youtubeAnalyticsRefreshRequestSchema
>;
export type YoutubeAnalyticsDashboardResponse = z.infer<
  typeof youtubeAnalyticsDashboardResponseSchema
>;
export type YoutubeAnalyticsVideoSummary = z.infer<typeof youtubeAnalyticsVideoSummarySchema>;
export type YoutubeAiDiagnosisRequest = z.infer<typeof youtubeAiDiagnosisRequestSchema>;
export type YoutubeAiDiagnosisResponse = z.infer<typeof youtubeAiDiagnosisResponseSchema>;
export type RenderPreconditionError = z.infer<typeof renderPreconditionErrorSchema>;
