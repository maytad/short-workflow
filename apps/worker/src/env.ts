import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  LOCAL_ASSET_ROOT: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  return envSchema.parse(source);
}
