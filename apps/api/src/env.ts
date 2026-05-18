import { z } from "zod";

export const envSchema = z.looseObject({
  DATABASE_URL: z.url(),
  LOCAL_ASSET_ROOT: z.string().min(1),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().positive().default(3001),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  YOUTUBE_OAUTH_REDIRECT_URI: z
    .url()
    .default("http://127.0.0.1:3001/youtube/oauth/callback"),
});

type ParsedEnv = z.infer<typeof envSchema>;

export type Env = Pick<ParsedEnv, "DATABASE_URL" | "LOCAL_ASSET_ROOT" | "API_HOST" | "API_PORT"> &
  Partial<
    Pick<
      ParsedEnv,
      "YOUTUBE_OAUTH_CLIENT_ID" | "YOUTUBE_OAUTH_CLIENT_SECRET" | "YOUTUBE_OAUTH_REDIRECT_URI"
    >
  >;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const {
    DATABASE_URL,
    LOCAL_ASSET_ROOT,
    API_HOST,
    API_PORT,
    YOUTUBE_OAUTH_CLIENT_ID,
    YOUTUBE_OAUTH_CLIENT_SECRET,
    YOUTUBE_OAUTH_REDIRECT_URI,
  } = envSchema.parse(input);

  const env: Env = {
    DATABASE_URL,
    LOCAL_ASSET_ROOT,
    API_HOST,
    API_PORT,
  };

  if (YOUTUBE_OAUTH_CLIENT_ID !== undefined) {
    env.YOUTUBE_OAUTH_CLIENT_ID = YOUTUBE_OAUTH_CLIENT_ID;
  }

  if (YOUTUBE_OAUTH_CLIENT_SECRET !== undefined) {
    env.YOUTUBE_OAUTH_CLIENT_SECRET = YOUTUBE_OAUTH_CLIENT_SECRET;
  }

  if (YOUTUBE_OAUTH_CLIENT_ID !== undefined || input.YOUTUBE_OAUTH_REDIRECT_URI !== undefined) {
    env.YOUTUBE_OAUTH_REDIRECT_URI = YOUTUBE_OAUTH_REDIRECT_URI;
  }

  return env;
}
