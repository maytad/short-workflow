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
