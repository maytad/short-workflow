import { z } from "zod";

export const envSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    LOCAL_ASSET_ROOT: z.string().min(1),
    API_HOST: z.string().default("127.0.0.1"),
    API_PORT: z.coerce.number().positive().default(3001),
  })
  .passthrough();

export type Env = Pick<
  z.infer<typeof envSchema>,
  "DATABASE_URL" | "LOCAL_ASSET_ROOT" | "API_HOST" | "API_PORT"
>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const { DATABASE_URL, LOCAL_ASSET_ROOT, API_HOST, API_PORT } =
    envSchema.parse(input);

  return {
    DATABASE_URL,
    LOCAL_ASSET_ROOT,
    API_HOST,
    API_PORT,
  };
}
