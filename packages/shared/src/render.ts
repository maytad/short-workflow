import { z } from "zod";

import { RENDER_FPS, RENDER_HEIGHT, RENDER_WIDTH } from "./constants";
import { sceneRoleSchema, uuidSchema } from "./schemas";

export const renderSceneInputSchema = z
  .object({
    id: uuidSchema,
    position: z.number().int().positive(),
    role: sceneRoleSchema,
    durationSeconds: z.number().min(1).max(60),
    narration: z.string(),
    caption: z.string(),
    imagePath: z.string().min(1),
    audioPath: z.string().min(1),
  })
  .strict();

export const renderInputSchema = z
  .object({
    projectId: uuidSchema,
    title: z.string(),
    format: z
      .object({
        width: z.literal(RENDER_WIDTH),
        height: z.literal(RENDER_HEIGHT),
        fps: z.literal(RENDER_FPS),
        durationSeconds: z.number().min(20).max(60),
      })
      .strict(),
    scenes: z.array(renderSceneInputSchema).min(1),
  })
  .strict();

export type RenderSceneInput = z.infer<typeof renderSceneInputSchema>;
export type RenderInput = z.infer<typeof renderInputSchema>;
