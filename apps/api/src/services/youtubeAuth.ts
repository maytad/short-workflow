import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { parseEnv, type Env } from "../env";

const DEFAULT_YOUTUBE_OAUTH_REDIRECT_URI = "http://127.0.0.1:3001/youtube/oauth/callback";
export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;
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

export const youtubeRefreshTokenResponseSchema = z
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
  hasRequiredScopes: boolean;
  reconnectRequired: boolean;
};

export type YoutubeToken = z.infer<typeof storedTokenSchema>;

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

export function hasRequiredYoutubeScopes(scope: string | undefined) {
  if (!scope) {
    return false;
  }

  const grantedScopes = new Set(scope.split(/\s+/).filter(Boolean));

  return YOUTUBE_OAUTH_SCOPES.every((requiredScope) => grantedScopes.has(requiredScope));
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

    if (!parsed.success) {
      return { connected: false, hasRequiredScopes: false, reconnectRequired: false };
    }

    const hasRequiredScopes = hasRequiredYoutubeScopes(parsed.data.scope);

    return {
      connected: true,
      hasRequiredScopes,
      reconnectRequired: !hasRequiredScopes,
    };
  } catch {
    return { connected: false, hasRequiredScopes: false, reconnectRequired: false };
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
  authUrl.searchParams.set("scope", YOUTUBE_OAUTH_SCOPES.join(" "));
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

export async function readYoutubeToken(env: Env = parseEnv()): Promise<YoutubeToken> {
  try {
    const raw = await readJson(youtubeTokenPath(env.LOCAL_ASSET_ROOT));
    const parsed = storedTokenSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error("youtube_not_connected");
    }

    return parsed.data;
  } catch (error) {
    if (error instanceof Error && error.message === "youtube_not_connected") {
      throw error;
    }

    throw new Error("youtube_not_connected");
  }
}

export function isYoutubeTokenExpired(token: YoutubeToken, now = Date.now()) {
  return new Date(token.expires_at).getTime() <= now + 60_000;
}

async function writeYoutubeToken(env: Env, token: YoutubeToken) {
  await mkdir(youtubeDir(env.LOCAL_ASSET_ROOT), { recursive: true, mode: 0o700 });
  const tokenPath = youtubeTokenPath(env.LOCAL_ASSET_ROOT);

  await writeFile(tokenPath, JSON.stringify(token, null, 2), { mode: 0o600 });
  await chmod(tokenPath, 0o600);
}

export async function refreshYoutubeToken({
  env = parseEnv(),
  token,
  fetchFn = fetch,
  now = Date.now(),
}: {
  env?: Env;
  token: YoutubeToken;
  fetchFn?: typeof fetch;
  now?: number;
}): Promise<YoutubeToken> {
  const oauth = requireYoutubeOAuthEnv(env);
  const body = new URLSearchParams({
    client_id: oauth.clientId,
    grant_type: "refresh_token",
    refresh_token: token.refresh_token,
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
    throw new Error("youtube_token_refresh_failed");
  }

  const parsed = youtubeRefreshTokenResponseSchema.safeParse(await response.json());

  if (!parsed.success) {
    throw new Error("youtube_token_refresh_failed");
  }

  const refreshed = storedTokenSchema.parse({
    ...token,
    ...parsed.data,
    refresh_token: token.refresh_token,
    scope: parsed.data.scope ?? token.scope,
    expires_at: new Date(now + (parsed.data.expires_in ?? 3600) * 1000).toISOString(),
  });

  await writeYoutubeToken(env, refreshed);

  return refreshed;
}

export async function readFreshYoutubeAccessToken({
  env = parseEnv(),
  fetchFn = fetch,
  now = Date.now(),
}: {
  env?: Env;
  fetchFn?: typeof fetch;
  now?: number;
} = {}) {
  const token = await readYoutubeToken(env);

  if (!hasRequiredYoutubeScopes(token.scope)) {
    throw new Error("youtube_reconnect_required");
  }

  if (!isYoutubeTokenExpired(token, now)) {
    return token.access_token;
  }

  const refreshed = await refreshYoutubeToken({ env, token, fetchFn, now });

  return refreshed.access_token;
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
