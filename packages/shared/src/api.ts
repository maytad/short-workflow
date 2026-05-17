import { z } from "zod";

import { DEFAULT_TARGET_DURATION_SECONDS } from "./constants";
import {
  assetSchema,
  durationPresetSecondsSchema,
  jobSchema,
  projectSchema,
  renderSchema,
  sceneSchema,
  youtubeMetadataSchema,
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
    targetDurationSeconds: durationPresetSecondsSchema.default(DEFAULT_TARGET_DURATION_SECONDS),
  })
  .strict();

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
export type CreateTinyMechanismsProjectRequest = z.infer<
  typeof createTinyMechanismsProjectRequestSchema
>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type UpdateSceneRequest = z.infer<typeof updateSceneRequestSchema>;
export type ProjectDetailResponse = z.infer<typeof projectDetailResponseSchema>;
export type RenderPreconditionError = z.infer<typeof renderPreconditionErrorSchema>;
