import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { WorkerEnv } from "../env";

export const youtubeTokenSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    token_type: z.string().min(1),
    scope: z.string().min(1).optional(),
    expires_at: z.iso.datetime(),
  })
  .passthrough();

const youtubeRefreshTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().positive().optional(),
    scope: z.string().min(1).optional(),
    token_type: z.string().min(1),
  })
  .passthrough();

export type YoutubeToken = z.infer<typeof youtubeTokenSchema>;

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function youtubeTokenPath(root: string) {
  return path.join(root, "youtube", "oauth-token.json");
}

export async function readYoutubeToken(root: string): Promise<YoutubeToken> {
  return youtubeTokenSchema.parse(JSON.parse(await readFile(youtubeTokenPath(root), "utf8")));
}

export async function writeYoutubeToken(root: string, token: YoutubeToken): Promise<void> {
  const tokenPath = youtubeTokenPath(root);
  const tokenDir = path.dirname(tokenPath);

  await mkdir(tokenDir, { recursive: true, mode: 0o700 });
  await chmod(tokenDir, 0o700);
  await writeFile(tokenPath, `${JSON.stringify(youtubeTokenSchema.parse(token), null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(tokenPath, 0o600);
}

export function isExpired(token: YoutubeToken, now = Date.now()) {
  return new Date(token.expires_at).getTime() <= now + 60_000;
}

export async function refreshYoutubeToken(input: {
  env: Pick<WorkerEnv, "YOUTUBE_OAUTH_CLIENT_ID" | "YOUTUBE_OAUTH_CLIENT_SECRET">;
  token: YoutubeToken;
  fetchFn?: FetchFn;
  now?: number;
}): Promise<YoutubeToken> {
  if (!input.env.YOUTUBE_OAUTH_CLIENT_ID) {
    throw new Error("youtube_oauth_not_configured");
  }

  const body = new URLSearchParams({
    client_id: input.env.YOUTUBE_OAUTH_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: input.token.refresh_token,
  });

  if (input.env.YOUTUBE_OAUTH_CLIENT_SECRET) {
    body.set("client_secret", input.env.YOUTUBE_OAUTH_CLIENT_SECRET);
  }

  const fetchFn = input.fetchFn ?? fetch;
  const response = await fetchFn("https://oauth2.googleapis.com/token", {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("youtube_token_refresh_failed");
  }

  const parsed = youtubeRefreshTokenResponseSchema.parse(await response.json());
  const now = input.now ?? Date.now();

  return youtubeTokenSchema.parse({
    ...input.token,
    ...parsed,
    refresh_token: input.token.refresh_token,
    expires_at: new Date(now + (parsed.expires_in ?? 3600) * 1000).toISOString(),
  });
}
