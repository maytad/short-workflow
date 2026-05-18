import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { parseEnv, type Env } from "../env";

const DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI = "http://127.0.0.1:3001/youtube/oauth/callback";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const tokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().positive().optional(),
    refresh_token: z.string().min(1).optional(),
    scope: z.string().min(1).optional(),
    token_type: z.string().min(1),
  })
  .passthrough();

const storedTokenSchema = tokenResponseSchema.extend({
  refresh_token: z.string().min(1),
  expires_at: z.iso.datetime(),
});

const stateFileSchema = z
  .object({
    state: z.string().min(1),
    codeVerifier: z.string().min(1),
    expiresAt: z.iso.datetime(),
  })
  .strict();

export type YoutubeOAuthCallbackInput = {
  code?: string;
  state?: string;
};

export type YoutubeAuthStatus = {
  connected: boolean;
};

export type YoutubeAuthStartResponse = {
  authUrl: string;
};

export type YoutubeAuthServices = {
  getYoutubeAuthStatus: () => Promise<YoutubeAuthStatus>;
  createYoutubeAuthUrl: () => Promise<YoutubeAuthStartResponse>;
  handleYoutubeOAuthCallback: (input: YoutubeOAuthCallbackInput) => Promise<void>;
  disconnectYoutube: () => Promise<{ disconnected: true }>;
};

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function sha256Base64Url(value: string) {
  return base64Url(createHash("sha256").update(value).digest());
}

function youtubeDir(root: string) {
  return path.join(root, "youtube");
}

export function youtubeTokenPath(root: string) {
  return path.join(youtubeDir(root), "oauth-token.json");
}

export function youtubeStatePath(root: string) {
  return path.join(youtubeDir(root), "oauth-state.json");
}

async function readJson(pathname: string) {
  return JSON.parse(await readFile(pathname, "utf8")) as unknown;
}

function requireYoutubeOAuthEnv(env: Env) {
  if (!env.YOUTUBE_OAUTH_CLIENT_ID) {
    throw new Error("youtube_oauth_not_configured");
  }

  return {
    clientId: env.YOUTUBE_OAUTH_CLIENT_ID,
    clientSecret: env.YOUTUBE_OAUTH_CLIENT_SECRET,
    redirectUri: env.YOUTUBE_OAUTH_REDIRECT_URI ?? DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI,
  };
}

export async function getYoutubeAuthStatus(env: Env = parseEnv()): Promise<YoutubeAuthStatus> {
  try {
    const raw = await readJson(youtubeTokenPath(env.LOCAL_ASSET_ROOT));
    const parsed = storedTokenSchema.safeParse(raw);

    return { connected: parsed.success };
  } catch {
    return { connected: false };
  }
}

export async function createYoutubeAuthUrl(
  env: Env = parseEnv(),
): Promise<YoutubeAuthStartResponse> {
  const oauth = requireYoutubeOAuthEnv(env);
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(64));
  const codeChallenge = sha256Base64Url(codeVerifier);
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();

  await mkdir(youtubeDir(env.LOCAL_ASSET_ROOT), { recursive: true, mode: 0o700 });
  await writeFile(
    youtubeStatePath(env.LOCAL_ASSET_ROOT),
    JSON.stringify({ state, codeVerifier, expiresAt }, null, 2),
    { mode: 0o600 },
  );

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", oauth.clientId);
  authUrl.searchParams.set("redirect_uri", oauth.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", YOUTUBE_UPLOAD_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return { authUrl: authUrl.toString() };
}

export async function handleYoutubeOAuthCallback(
  input: YoutubeOAuthCallbackInput,
  env: Env = parseEnv(),
  fetchFn: typeof fetch = fetch,
) {
  if (!input.code || !input.state) {
    throw new Error("youtube_oauth_callback_invalid");
  }

  const oauth = requireYoutubeOAuthEnv(env);
  const rawState = await readJson(youtubeStatePath(env.LOCAL_ASSET_ROOT));
  const stateFile = stateFileSchema.parse(rawState);

  if (stateFile.state !== input.state || new Date(stateFile.expiresAt).getTime() < Date.now()) {
    throw new Error("youtube_oauth_state_invalid");
  }

  const body = new URLSearchParams({
    client_id: oauth.clientId,
    code: input.code,
    code_verifier: stateFile.codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: oauth.redirectUri,
  });

  if (oauth.clientSecret) {
    body.set("client_secret", oauth.clientSecret);
  }

  const response = await fetchFn("https://oauth2.googleapis.com/token", {
    body,
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("youtube_oauth_token_exchange_failed");
  }

  const parsed = tokenResponseSchema.parse(await response.json());

  if (!parsed.refresh_token) {
    throw new Error("youtube_oauth_refresh_token_missing");
  }

  const token = {
    ...parsed,
    expires_at: new Date(Date.now() + (parsed.expires_in ?? 3600) * 1000).toISOString(),
  };

  await mkdir(youtubeDir(env.LOCAL_ASSET_ROOT), { recursive: true, mode: 0o700 });
  await writeFile(youtubeTokenPath(env.LOCAL_ASSET_ROOT), JSON.stringify(token, null, 2), {
    mode: 0o600,
  });
  await rm(youtubeStatePath(env.LOCAL_ASSET_ROOT), { force: true });
}

export async function disconnectYoutube(env: Env = parseEnv()): Promise<{ disconnected: true }> {
  await rm(youtubeTokenPath(env.LOCAL_ASSET_ROOT), { force: true });

  return { disconnected: true };
}

export function createYoutubeAuthServices(
  env: Env = parseEnv(),
  fetchFn: typeof fetch = fetch,
): YoutubeAuthServices {
  return {
    getYoutubeAuthStatus: () => getYoutubeAuthStatus(env),
    createYoutubeAuthUrl: () => createYoutubeAuthUrl(env),
    handleYoutubeOAuthCallback: (input) => handleYoutubeOAuthCallback(input, env, fetchFn),
    disconnectYoutube: () => disconnectYoutube(env),
  };
}
