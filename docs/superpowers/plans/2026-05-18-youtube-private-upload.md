# YouTube Private Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only `Upload to YouTube` button that queues the latest successful render for private upload through the YouTube Data API.

**Architecture:** Keep upload as a project-level worker job named `upload_youtube`; the API handles OAuth, precondition checks, and job queueing while the worker performs resumable upload. OAuth tokens are local filesystem secrets under `LOCAL_ASSET_ROOT`, never database rows and never frontend data.

**Tech Stack:** Bun workspaces, TypeScript, ElysiaJS, Drizzle/Postgres migrations, TanStack Query, React, YouTube Data API via direct `fetch` and Node/Bun built-ins only.

---

## Source Spec

Implement the approved design in:

`docs/superpowers/specs/2026-05-18-youtube-private-upload-design.md`

Do not implement public/unlisted publishing, scheduling, thumbnail upload, playlists, multi-account switching, upload percentages, analytics, or browser automation.

## File Structure

- Modify `packages/shared/src/constants.ts`
  - Add `upload_youtube` to shared job type constants.
- Modify `packages/shared/src/schemas.ts`
  - Add YouTube auth/upload schemas and `youtubeUpload` detail summary.
- Modify `packages/shared/src/api.ts`
  - Export request/response types for YouTube auth and upload endpoints.
- Modify `packages/db/src/schema.ts`
  - Add `upload_youtube` to the Drizzle enum and job type check.
- Create `packages/db/migrations/0004_add_youtube_upload_job/migration.sql`
  - Add enum value and update `jobs_scene_id_per_type`.
- Create `packages/db/migrations/0004_add_youtube_upload_job/down.sql`
  - Fail loudly if rollback is requested because Postgres enum value removal is intentionally not encoded.
- Create `apps/api/src/services/youtubeAuth.ts`
  - Own OAuth URL creation, callback token exchange, token file storage, auth status, and disconnect.
- Modify `apps/api/src/services/projects.ts`
  - Build upload job input from latest successful render, ready render asset, and generated YouTube metadata.
- Create `apps/api/src/routes/youtube.ts`
  - Own YouTube auth endpoints.
- Modify `apps/api/src/routes/projects.ts`
  - Add `POST /projects/:projectId/youtube-upload`.
- Modify `apps/api/src/app.ts`
  - Register YouTube routes and allow route service injection in tests.
- Modify `apps/api/src/env.ts`
  - Add optional YouTube OAuth env vars.
- Modify `apps/api/src/app.test.ts`
  - Test auth status, auth URL, callback failure, missing connection, missing render, and queued upload job.
- Create `apps/worker/src/youtube/tokenStore.ts`
  - Read, write, refresh, and validate OAuth token files for worker use.
- Create `apps/worker/src/youtube/upload.ts`
  - Start YouTube resumable sessions and upload MP4 bytes using `fetch`.
- Create `apps/worker/src/youtube/upload.test.ts`
  - Unit test token refresh and upload request construction with mocked `fetch`.
- Create `apps/worker/src/handlers/uploadYoutube.ts`
  - Worker job handler that resolves local render MP4 and uploads it.
- Modify `apps/worker/src/handlers/index.ts`
  - Route `upload_youtube` jobs to the new handler.
- Modify `apps/worker/src/env.ts`
  - Add optional YouTube OAuth env vars.
- Modify `apps/web/src/api/queryKeys.ts`
  - Add YouTube auth query key.
- Modify `apps/web/src/features/projects/hooks.ts`
  - Add YouTube auth status/start/disconnect/upload mutations.
- Modify `apps/web/src/features/projects/assetUrls.ts`
  - Add YouTube Studio URL helper.
- Create `apps/web/src/features/projects/YoutubeUploadDialog.tsx`
  - Confirmation modal and connect/upload controls.
- Modify `apps/web/src/features/projects/RenderPanel.tsx`
  - Add upload button, dialog, and uploaded result state.
- Modify `apps/web/src/features/projects/ProjectWorkflow.tsx`
  - Pass `youtubeMetadata` and `youtubeUpload` into `RenderPanel`.
- Modify `apps/web/src/features/projects/workflow.test.ts`
  - Test URL helper and upload gating helpers.

No new dependency should be added. If implementation discovers a hard need for `googleapis` or another OAuth library, stop and ask before changing `package.json`.

---

## Task 1: Shared Contract And Database Migration

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/api.ts`
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/migrations/0004_add_youtube_upload_job/migration.sql`
- Create: `packages/db/migrations/0004_add_youtube_upload_job/down.sql`

- [ ] **Step 1: Add the job type constant**

In `packages/shared/src/constants.ts`, change `JOB_TYPES` to include `upload_youtube`:

```ts
export const JOB_TYPES = [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
  "upload_youtube",
] as const;
```

- [ ] **Step 2: Extend shared schemas**

In `packages/shared/src/schemas.ts`, after `youtubeMetadataSchema`, add:

```ts
export const youtubeAuthStatusSchema = z
  .object({
    connected: z.boolean(),
  })
  .strict();

export const youtubeAuthStartResponseSchema = z
  .object({
    authUrl: z.url(),
  })
  .strict();

export const youtubeUploadJobInputSchema = z
  .object({
    renderId: uuidSchema,
    outputAssetId: uuidSchema,
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1),
    tags: z.array(z.string().trim().min(1)).max(20),
    privacyStatus: z.literal("private"),
    selfDeclaredMadeForKids: z.literal(false),
    containsSyntheticMedia: z.literal(true),
  })
  .strict();

export const youtubeUploadJobOutputSchema = z
  .object({
    youtubeVideoId: z.string().min(1),
    youtubeStudioUrl: z.url(),
    privacyStatus: z.literal("private"),
    uploadedAt: isoDateSchema,
  })
  .strict();

export const youtubeUploadSummarySchema = z
  .object({
    jobId: uuidSchema,
    status: jobStatusSchema,
    youtubeVideoId: z.string().min(1).nullable(),
    youtubeStudioUrl: z.url().nullable(),
    privacyStatus: z.literal("private").nullable(),
    uploadedAt: nullableIsoDateSchema,
    errorMessage: nullableStringSchema,
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
  })
  .strict();
```

Then add exports near the existing exported types:

```ts
export type YoutubeAuthStatus = z.infer<typeof youtubeAuthStatusSchema>;
export type YoutubeAuthStartResponse = z.infer<typeof youtubeAuthStartResponseSchema>;
export type YoutubeUploadJobInput = z.infer<typeof youtubeUploadJobInputSchema>;
export type YoutubeUploadJobOutput = z.infer<typeof youtubeUploadJobOutputSchema>;
export type YoutubeUploadSummary = z.infer<typeof youtubeUploadSummarySchema>;
```

- [ ] **Step 3: Add `youtubeUpload` to project detail response**

In `packages/shared/src/api.ts`, import `youtubeUploadSummarySchema` from `./schemas`, then update `projectDetailResponseSchema`:

```ts
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
```

- [ ] **Step 4: Update Drizzle job enum and constraint**

In `packages/db/src/schema.ts`, add `"upload_youtube"` to `jobTypeEnum`:

```ts
export const jobTypeEnum = pgEnum("job_type", [
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
  "upload_youtube",
]);
```

Then update the `jobs_scene_id_per_type` check:

```ts
check(
  "jobs_scene_id_per_type",
  sql`
    case ${table.type}::text
      when 'generate_script' then ${table.sceneId} is null
      when 'render_video' then ${table.sceneId} is null
      when 'upload_youtube' then ${table.sceneId} is null
      when 'generate_scene_image' then ${table.sceneId} is not null
      when 'generate_scene_audio' then ${table.sceneId} is not null
      else false
    end
  `,
),
```

- [ ] **Step 5: Add migration SQL**

Create `packages/db/migrations/0004_add_youtube_upload_job/migration.sql`:

```sql
alter type job_type add value if not exists 'upload_youtube';

alter table jobs drop constraint jobs_scene_id_per_type;

alter table jobs add constraint jobs_scene_id_per_type check (
  case type::text
    when 'generate_script' then scene_id is null
    when 'render_video' then scene_id is null
    when 'upload_youtube' then scene_id is null
    when 'generate_scene_image' then scene_id is not null
    when 'generate_scene_audio' then scene_id is not null
    else false
  end
);
```

- [ ] **Step 6: Add reviewed down migration**

Create `packages/db/migrations/0004_add_youtube_upload_job/down.sql`:

```sql
-- Postgres does not support DROP VALUE on an enum type. Rolling back would
-- require recreating job_type, casting every jobs row, and dropping the new
-- type. We refuse to encode that here. If a true rollback is needed, write a
-- one-off migration after confirming no rows use 'upload_youtube'.
do $$
begin
  if exists (
    select 1 from jobs
    where type::text = 'upload_youtube'
  ) then
    raise exception 'down_blocked_rows_use_upload_youtube';
  end if;
  raise exception 'down_blocked_enum_value_drop_not_supported';
end$$;
```

- [ ] **Step 7: Run focused contract checks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd packages/db typecheck
```

Expected: both commands exit `0`.

---

## Task 2: API YouTube OAuth Services And Routes

**Files:**
- Modify: `apps/api/src/env.ts`
- Create: `apps/api/src/services/youtubeAuth.ts`
- Create: `apps/api/src/routes/youtube.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Add optional API env fields**

In `apps/api/src/env.ts`, extend `envSchema`:

```ts
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
```

Update the `Env` type pick and `parseEnv` return object to include the three YouTube fields.

- [ ] **Step 2: Create OAuth service**

Create `apps/api/src/services/youtubeAuth.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { YoutubeAuthStatus, YoutubeAuthStartResponse } from "@short-workflow/shared";
import { z } from "zod";

import { parseEnv, type Env } from "../env";

const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

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
  expires_at: z.string().datetime(),
});

const stateFileSchema = z
  .object({
    state: z.string().min(1),
    codeVerifier: z.string().min(1),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type YoutubeAuthServices = {
  getYoutubeAuthStatus: () => Promise<YoutubeAuthStatus>;
  createYoutubeAuthUrl: () => Promise<YoutubeAuthStartResponse>;
  handleYoutubeOAuthCallback: (input: { code?: string; state?: string }) => Promise<void>;
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
  return createHash("sha256").update(value).digest("base64url");
}

function youtubeDir(root: string) {
  return path.join(root, "youtube");
}

export function youtubeTokenPath(root: string) {
  return path.join(youtubeDir(root), "oauth-token.json");
}

function youtubeStatePath(root: string) {
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
    redirectUri: env.YOUTUBE_OAUTH_REDIRECT_URI,
  };
}

export function createYoutubeAuthServices(
  env: Env = parseEnv(),
  fetchFn: typeof fetch = fetch,
): YoutubeAuthServices {
  return {
    async getYoutubeAuthStatus() {
      try {
        const raw = await readJson(youtubeTokenPath(env.LOCAL_ASSET_ROOT));
        const parsed = storedTokenSchema.safeParse(raw);
        return { connected: parsed.success };
      } catch {
        return { connected: false };
      }
    },

    async createYoutubeAuthUrl() {
      const oauth = requireYoutubeOAuthEnv(env);
      const state = base64Url(randomBytes(32));
      const codeVerifier = base64Url(randomBytes(64));
      const codeChallenge = sha256Base64Url(codeVerifier);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
    },

    async handleYoutubeOAuthCallback(input) {
      if (!input.code || !input.state) {
        throw new Error("youtube_oauth_callback_invalid");
      }

      const oauth = requireYoutubeOAuthEnv(env);
      const stateFile = stateFileSchema.parse(await readJson(youtubeStatePath(env.LOCAL_ASSET_ROOT)));
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
      await writeFile(youtubeTokenPath(env.LOCAL_ASSET_ROOT), JSON.stringify(token, null, 2), {
        mode: 0o600,
      });
      await rm(youtubeStatePath(env.LOCAL_ASSET_ROOT), { force: true });
    },

    async disconnectYoutube() {
      await rm(youtubeTokenPath(env.LOCAL_ASSET_ROOT), { force: true });
      return { disconnected: true };
    },
  };
}
```

- [ ] **Step 3: Create YouTube auth routes**

Create `apps/api/src/routes/youtube.ts`:

```ts
import { Elysia } from "elysia";

import { conflict, internalError, jsonError } from "../http";
import { createYoutubeAuthServices, type YoutubeAuthServices } from "../services/youtubeAuth";

type StatusSetter = {
  status?: number | string;
};

type YoutubeRouteContext = {
  set: StatusSetter;
  query: {
    code?: string;
    state?: string;
    error?: string;
  };
};

function withYoutubeRouteContext(context: unknown) {
  return context as YoutubeRouteContext;
}

export function createYoutubeRoutes(services: YoutubeAuthServices = createYoutubeAuthServices()) {
  return new Elysia({ prefix: "/youtube" })
    .get("/auth/status", () => services.getYoutubeAuthStatus())
    .post("/auth/start", async ({ set }) => {
      try {
        return await services.createYoutubeAuthUrl();
      } catch (error) {
        if (error instanceof Error && error.message === "youtube_oauth_not_configured") {
          return conflict(set, "youtube_oauth_not_configured");
        }

        throw error;
      }
    })
    .post("/auth/disconnect", () => services.disconnectYoutube())
    .get("/oauth/callback", async (context) => {
      const { query, set } = withYoutubeRouteContext(context);
      if (query.error) {
        return jsonError(set, 400, "youtube_oauth_denied");
      }

      try {
        await services.handleYoutubeOAuthCallback({
          code: query.code,
          state: query.state,
        });

        return new Response(
          "<!doctype html><title>YouTube connected</title><p>YouTube is connected. Return to Short Workflow.</p>",
          { headers: { "content-type": "text/html; charset=utf-8" } },
        );
      } catch {
        return jsonError(set, 400, "youtube_oauth_callback_failed");
      }
    })
    .onError(({ set }) => internalError(set));
}
```

- [ ] **Step 4: Register routes in the app**

In `apps/api/src/app.ts`, import the route factory and service type:

```ts
import { createYoutubeRoutes } from "./routes/youtube";
import type { YoutubeAuthServices } from "./services/youtubeAuth";
```

Extend options:

```ts
type CreateAppOptions = {
  db?: DbClient;
  databaseUrl?: string;
  projectServices?: ProjectRouteServices;
  youtubeServices?: YoutubeAuthServices;
};
```

Register the route:

```ts
.use(createYoutubeRoutes(options.youtubeServices))
```

Place it after `healthRoutes` and before project routes.

- [ ] **Step 5: Add API auth tests**

In `apps/api/src/app.test.ts`, add these tests:

```ts
test("maps YouTube OAuth callback failure to bad request", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices(),
    youtubeServices: {
      getYoutubeAuthStatus: async () => ({ connected: false }),
      createYoutubeAuthUrl: async () => ({
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      }),
      handleYoutubeOAuthCallback: async () => {
        throw new Error("youtube_oauth_state_invalid");
      },
      disconnectYoutube: async () => ({ disconnected: true }),
    },
  });

  const response = await app.handle(request("/youtube/oauth/callback?code=abc&state=bad"));

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "youtube_oauth_callback_failed" });
});

test("returns YouTube auth status without exposing tokens", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices(),
    youtubeServices: {
      getYoutubeAuthStatus: async () => ({ connected: true }),
      createYoutubeAuthUrl: async () => ({ authUrl: "https://accounts.google.com/o/oauth2/v2/auth" }),
      handleYoutubeOAuthCallback: async () => {},
      disconnectYoutube: async () => ({ disconnected: true }),
    },
  });

  const response = await app.handle(request("/youtube/auth/status"));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ connected: true });
});

test("creates a YouTube auth URL", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices(),
    youtubeServices: {
      getYoutubeAuthStatus: async () => ({ connected: false }),
      createYoutubeAuthUrl: async () => ({ authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc" }),
      handleYoutubeOAuthCallback: async () => {},
      disconnectYoutube: async () => ({ disconnected: true }),
    },
  });

  const response = await app.handle(request("/youtube/auth/start", { method: "POST" }));

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
  });
});

test("maps missing YouTube OAuth env to conflict", async () => {
  const app = createApp({
    db: {} as never,
    projectServices: createServices(),
    youtubeServices: {
      getYoutubeAuthStatus: async () => ({ connected: false }),
      createYoutubeAuthUrl: async () => {
        throw new Error("youtube_oauth_not_configured");
      },
      handleYoutubeOAuthCallback: async () => {},
      disconnectYoutube: async () => ({ disconnected: true }),
    },
  });

  const response = await app.handle(request("/youtube/auth/start", { method: "POST" }));

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "youtube_oauth_not_configured" });
});
```

- [ ] **Step 6: Run focused API checks**

Run:

```bash
bun test apps/api/src/app.test.ts
bun run --cwd apps/api typecheck
```

Expected: both commands exit `0`.

---

## Task 3: API Upload Preconditions And Queue Endpoint

**Files:**
- Modify: `apps/api/src/services/projects.ts`
- Modify: `apps/api/src/routes/projects.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `packages/shared/src/api.ts`

- [ ] **Step 1: Add upload summary to project detail**

In `apps/api/src/services/projects.ts`, import shared output schema:

```ts
import { youtubeMetadataSchema, youtubeUploadJobOutputSchema } from "@short-workflow/shared";
```

Then update `getProjectDetail` return:

```ts
return {
  project,
  scenes,
  assets,
  renders,
  jobs,
  youtubeMetadata: latestYoutubeMetadata(jobs),
  youtubeUpload: latestYoutubeUpload(jobs),
};
```

Add this helper near `latestYoutubeMetadata`:

```ts
function latestYoutubeUpload(jobs: JobRow[]) {
  const job = jobs.find((candidate) => candidate.type === "upload_youtube");
  if (!job) {
    return null;
  }

  const parsedOutput = youtubeUploadJobOutputSchema.safeParse(job.output);

  return {
    jobId: job.id,
    status: job.status,
    youtubeVideoId: parsedOutput.success ? parsedOutput.data.youtubeVideoId : null,
    youtubeStudioUrl: parsedOutput.success ? parsedOutput.data.youtubeStudioUrl : null,
    privacyStatus: parsedOutput.success ? parsedOutput.data.privacyStatus : null,
    uploadedAt: parsedOutput.success ? parsedOutput.data.uploadedAt : null,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
```

If the project service already serializes dates elsewhere before returning to the web client, keep the existing style and do not convert dates twice.

- [ ] **Step 2: Add upload input builder**

In `apps/api/src/services/projects.ts`, add:

```ts
export async function buildYoutubeUploadJobInput(db: DbClient, projectId: string) {
  const [renders, assets, jobs] = await Promise.all([
    listProjectRenders(db, projectId),
    listProjectAssets(db, projectId),
    listProjectJobs(db, projectId),
  ]);

  const metadata = latestYoutubeMetadata(jobs);
  if (!metadata) {
    throw new Error("youtube_upload_preconditions_failed:metadata");
  }

  const latestSucceededRender = renders.find((render) => render.status === "succeeded");
  if (!latestSucceededRender?.outputAssetId) {
    throw new Error("youtube_upload_preconditions_failed:render");
  }

  const outputAsset = assets.find(
    (asset) =>
      asset.id === latestSucceededRender.outputAssetId &&
      asset.kind === "render" &&
      asset.status === "ready" &&
      asset.storageDriver === "local",
  );
  if (!outputAsset) {
    throw new Error("youtube_upload_preconditions_failed:render_asset");
  }

  return {
    renderId: latestSucceededRender.id,
    outputAssetId: outputAsset.id,
    title: metadata.youtubeTitle,
    description: metadata.description,
    tags: metadata.hashtags.map((tag) => tag.replace(/^#/, "")),
    privacyStatus: "private" as const,
    selfDeclaredMadeForKids: false as const,
    containsSyntheticMedia: true as const,
  };
}
```

- [ ] **Step 3: Add project route service fields**

In `apps/api/src/routes/projects.ts`, import and add:

```ts
import { buildYoutubeUploadJobInput } from "../services/projects";
import { createYoutubeAuthServices } from "../services/youtubeAuth";
```

Extend `ProjectRouteServices`:

```ts
buildYoutubeUploadJobInput: typeof buildYoutubeUploadJobInput;
getYoutubeAuthStatus?: ReturnType<typeof createYoutubeAuthServices>["getYoutubeAuthStatus"];
```

Add a lazy default function near `defaultServices`:

```ts
async function defaultYoutubeAuthStatus() {
  return createYoutubeAuthServices().getYoutubeAuthStatus();
}
```

Then add defaults:

```ts
buildYoutubeUploadJobInput,
getYoutubeAuthStatus: defaultYoutubeAuthStatus,
```

- [ ] **Step 4: Add upload queue endpoint**

In the project routes group, after `POST /:projectId/render`, add:

```ts
.post("/:projectId/youtube-upload", async (context) => {
  const { db, params, set } = withRouteContext(context);
  const projectId = requireRouteParam(params.projectId, "projectId");
  const project = await services.getProject(db, projectId);

  if (!project) {
    return notFound(set);
  }

  const authStatus = await (services.getYoutubeAuthStatus ?? defaultYoutubeAuthStatus)();
  if (!authStatus.connected) {
    return conflict(set, "youtube_not_connected");
  }

  try {
    const input = await services.buildYoutubeUploadJobInput(db, project.id);
    return services.createJobIdempotent(db, {
      projectId: project.id,
      sceneId: null,
      type: "upload_youtube",
      input,
      maxAttempts: 1,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("youtube_upload_preconditions_failed")
    ) {
      return jsonError(set, 422, "youtube_upload_preconditions_failed");
    }

    throw error;
  }
})
```

- [ ] **Step 5: Add upload route tests**

In `apps/api/src/app.test.ts`, create a reusable upload job fixture:

```ts
const youtubeJob = {
  ...job,
  id: "66666666-6666-4666-8666-666666666666",
  type: "upload_youtube",
  input: {
    renderId: "77777777-7777-4777-8777-777777777777",
    outputAssetId: renderAsset.id,
    title: "Test title",
    description: "Test description",
    tags: ["TinyMechanisms"],
    privacyStatus: "private",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  },
} as const;
```

Add this test:

```ts
test("returns conflict when YouTube is not connected", async () => {
  let createdJob = false;
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      getYoutubeAuthStatus: async () => ({ connected: false }),
      createJobIdempotent: async () => {
        createdJob = true;
        return youtubeJob;
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/youtube-upload`, { method: "POST" }),
  );

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "youtube_not_connected" });
  expect(createdJob).toBe(false);
});
```

Add this test:

```ts
test("queues a private YouTube upload job", async () => {
  let receivedInput: unknown;
  const uploadInput = youtubeJob.input;
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      getYoutubeAuthStatus: async () => ({ connected: true }),
      buildYoutubeUploadJobInput: async () => uploadInput,
      createJobIdempotent: async (_db, input) => {
        receivedInput = input;
        return youtubeJob;
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/youtube-upload`, { method: "POST" }),
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: youtubeJob.id, type: "upload_youtube" });
  expect(receivedInput).toEqual({
    projectId: project.id,
    sceneId: null,
    type: "upload_youtube",
    input: uploadInput,
    maxAttempts: 1,
  });
});
```

Add this test:

```ts
test("returns upload precondition errors before queueing YouTube upload", async () => {
  let createdJob = false;
  const app = createApp({
    db: {} as never,
    projectServices: createServices({
      getYoutubeAuthStatus: async () => ({ connected: true }),
      buildYoutubeUploadJobInput: async () => {
        throw new Error("youtube_upload_preconditions_failed:render");
      },
      createJobIdempotent: async () => {
        createdJob = true;
        return youtubeJob;
      },
    }),
  });

  const response = await app.handle(
    request(`/projects/${project.id}/youtube-upload`, { method: "POST" }),
  );

  expect(response.status).toBe(422);
  expect(await response.json()).toEqual({ error: "youtube_upload_preconditions_failed" });
  expect(createdJob).toBe(false);
});
```

- [ ] **Step 6: Run focused API checks**

Run:

```bash
bun test apps/api/src/app.test.ts
bun run --cwd apps/api typecheck
```

Expected: both commands exit `0`.

---

## Task 4: Worker YouTube Upload Client And Handler

**Files:**
- Modify: `apps/worker/src/env.ts`
- Create: `apps/worker/src/youtube/tokenStore.ts`
- Create: `apps/worker/src/youtube/upload.ts`
- Create: `apps/worker/src/youtube/upload.test.ts`
- Create: `apps/worker/src/handlers/uploadYoutube.ts`
- Modify: `apps/worker/src/handlers/index.ts`

- [ ] **Step 1: Extend worker env**

In `apps/worker/src/env.ts`, add optional YouTube fields:

```ts
const envSchema = z.object({
  DATABASE_URL: z.url(),
  LOCAL_ASSET_ROOT: z.string().min(1),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  YOUTUBE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  YOUTUBE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
});
```

- [ ] **Step 2: Create token store**

Create `apps/worker/src/youtube/tokenStore.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import type { WorkerEnv } from "../env";

const tokenSchema = z
  .object({
    access_token: z.string().min(1),
    refresh_token: z.string().min(1),
    token_type: z.string().min(1),
    scope: z.string().min(1).optional(),
    expires_at: z.string().datetime(),
  })
  .passthrough();

export type YoutubeToken = z.infer<typeof tokenSchema>;

export function youtubeTokenPath(root: string) {
  return path.join(root, "youtube", "oauth-token.json");
}

export async function readYoutubeToken(root: string) {
  return tokenSchema.parse(JSON.parse(await readFile(youtubeTokenPath(root), "utf8")));
}

export async function writeYoutubeToken(root: string, token: YoutubeToken) {
  const pathname = youtubeTokenPath(root);
  await mkdir(path.dirname(pathname), { recursive: true, mode: 0o700 });
  await writeFile(pathname, JSON.stringify(token, null, 2), { mode: 0o600 });
}

export function isExpired(token: YoutubeToken, now = Date.now()) {
  return new Date(token.expires_at).getTime() <= now + 60_000;
}

export async function refreshYoutubeToken(input: {
  env: WorkerEnv;
  token: YoutubeToken;
  fetchFn?: typeof fetch;
}) {
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

  const response = await (input.fetchFn ?? fetch)("https://oauth2.googleapis.com/token", {
    body,
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("youtube_token_refresh_failed");
  }

  const refreshed = z
    .object({
      access_token: z.string().min(1),
      expires_in: z.number().positive().optional(),
      scope: z.string().min(1).optional(),
      token_type: z.string().min(1),
    })
    .passthrough()
    .parse(await response.json());

  return {
    ...input.token,
    ...refreshed,
    refresh_token: input.token.refresh_token,
    expires_at: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
  };
}
```

- [ ] **Step 3: Create resumable upload client**

Create `apps/worker/src/youtube/upload.ts`:

```ts
import { readFile, stat } from "node:fs/promises";

import type { YoutubeUploadJobInput, YoutubeUploadJobOutput } from "@short-workflow/shared";

export async function uploadPrivateYoutubeVideo(input: {
  accessToken: string;
  filePath: string;
  upload: YoutubeUploadJobInput;
  fetchFn?: typeof fetch;
}): Promise<YoutubeUploadJobOutput> {
  const fetchImpl = input.fetchFn ?? fetch;
  const fileInfo = await stat(input.filePath);
  const sessionUrl = new URL("https://www.googleapis.com/upload/youtube/v3/videos");
  sessionUrl.searchParams.set("uploadType", "resumable");
  sessionUrl.searchParams.set("part", "snippet,status");
  sessionUrl.searchParams.set("notifySubscribers", "false");

  const startResponse = await fetchImpl(sessionUrl, {
    body: JSON.stringify({
      snippet: {
        title: input.upload.title,
        description: input.upload.description,
        tags: input.upload.tags,
      },
      status: {
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    }),
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-length": String(fileInfo.size),
      "x-upload-content-type": "video/mp4",
    },
    method: "POST",
  });

  if (!startResponse.ok) {
    throw new Error(`youtube_upload_session_failed:${startResponse.status}`);
  }

  const uploadUrl = startResponse.headers.get("location");
  if (!uploadUrl) {
    throw new Error("youtube_upload_session_missing_location");
  }

  const bytes = await readFile(input.filePath);
  const uploadResponse = await fetchImpl(uploadUrl, {
    body: bytes,
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-length": String(fileInfo.size),
      "content-type": "video/mp4",
    },
    method: "PUT",
  });

  if (!uploadResponse.ok) {
    throw new Error(`youtube_upload_failed:${uploadResponse.status}`);
  }

  const json = (await uploadResponse.json()) as { id?: string };
  if (!json.id) {
    throw new Error("youtube_upload_missing_video_id");
  }

  return {
    youtubeVideoId: json.id,
    youtubeStudioUrl: `https://studio.youtube.com/video/${json.id}/edit`,
    privacyStatus: "private",
    uploadedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Add upload client tests**

Create `apps/worker/src/youtube/upload.test.ts`:

```ts
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { refreshYoutubeToken } from "./tokenStore";
import { uploadPrivateYoutubeVideo } from "./upload";

describe("youtube upload client", () => {
  test("refreshes an access token without dropping the refresh token", async () => {
    const response = new Response(
      JSON.stringify({
        access_token: "new-access",
        expires_in: 3600,
        token_type: "Bearer",
      }),
      { status: 200 },
    );
    const fetchCalls: RequestInfo[] = [];
    const fetchFn = async (url: RequestInfo) => {
      fetchCalls.push(url);
      return response;
    };

    const token = await refreshYoutubeToken({
      env: {
        DATABASE_URL: "postgres://user:pass@example.com/db",
        LOCAL_ASSET_ROOT: "/tmp/assets",
        WORKER_CONCURRENCY: 1,
        YOUTUBE_OAUTH_CLIENT_ID: "client-id",
      },
      fetchFn: fetchFn as typeof fetch,
      token: {
        access_token: "old-access",
        refresh_token: "refresh-token",
        token_type: "Bearer",
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
    });

    expect(fetchCalls[0]?.toString()).toBe("https://oauth2.googleapis.com/token");
    expect(token.access_token).toBe("new-access");
    expect(token.refresh_token).toBe("refresh-token");
  });

  test("creates a private resumable upload and uploads mp4 bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "youtube-upload-"));
    const videoPath = path.join(root, "video.mp4");
    await writeFile(videoPath, new Uint8Array([1, 2, 3]));

    const requests: { url: string; method: string; bodyText: string | null }[] = [];
    const fetchFn = async (url: RequestInfo | URL, init?: RequestInit) => {
      const bodyText =
        typeof init?.body === "string" ? init.body : init?.body ? "binary-body" : null;
      requests.push({
        url: url.toString(),
        method: init?.method ?? "GET",
        bodyText,
      });

      if (init?.method === "POST") {
        return new Response(null, {
          headers: { location: "https://upload.youtube.test/session" },
          status: 200,
        });
      }

      return new Response(JSON.stringify({ id: "yt-video-id" }), { status: 200 });
    };

    const output = await uploadPrivateYoutubeVideo({
      accessToken: "access-token",
      fetchFn: fetchFn as typeof fetch,
      filePath: videoPath,
      upload: {
        renderId: "77777777-7777-4777-8777-777777777777",
        outputAssetId: "55555555-5555-4555-8555-555555555555",
        title: "Title",
        description: "Description",
        tags: ["TinyMechanisms"],
        privacyStatus: "private",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    });

    expect(requests[0]?.url).toContain("uploadType=resumable");
    expect(requests[0]?.bodyText).toContain('"privacyStatus":"private"');
    expect(requests[0]?.bodyText).toContain('"containsSyntheticMedia":true');
    expect(requests[1]).toMatchObject({
      method: "PUT",
      url: "https://upload.youtube.test/session",
      bodyText: "binary-body",
    });
    expect(output.youtubeVideoId).toBe("yt-video-id");
    expect(output.youtubeStudioUrl).toBe("https://studio.youtube.com/video/yt-video-id/edit");
  });
});
```

- [ ] **Step 5: Create worker handler**

Create `apps/worker/src/handlers/uploadYoutube.ts`:

```ts
import { getAsset, markJobSucceeded, type DbClient, type JobRow } from "@short-workflow/db";
import { youtubeUploadJobInputSchema } from "@short-workflow/shared";

import { absoluteAssetPath } from "../assets";
import { parseEnv } from "../env";
import { isExpired, readYoutubeToken, refreshYoutubeToken, writeYoutubeToken } from "../youtube/tokenStore";
import { uploadPrivateYoutubeVideo } from "../youtube/upload";

export async function handleUploadYoutube(db: DbClient, job: JobRow) {
  const uploadInput = youtubeUploadJobInputSchema.parse(job.input);
  const env = parseEnv();
  const asset = await getAsset(db, uploadInput.outputAssetId);

  if (
    !asset ||
    asset.projectId !== job.projectId ||
    asset.kind !== "render" ||
    asset.status !== "ready" ||
    asset.storageDriver !== "local"
  ) {
    throw new Error("youtube_render_asset_missing");
  }

  let token = await readYoutubeToken(env.LOCAL_ASSET_ROOT);
  if (isExpired(token)) {
    token = await refreshYoutubeToken({ env, token });
    await writeYoutubeToken(env.LOCAL_ASSET_ROOT, token);
  }

  const output = await uploadPrivateYoutubeVideo({
    accessToken: token.access_token,
    filePath: absoluteAssetPath(env.LOCAL_ASSET_ROOT, asset.path),
    upload: uploadInput,
  });

  await markJobSucceeded(db, job.id, output);
}
```

If line length becomes hard to read, split the imports; do not change function names or output fields.

- [ ] **Step 6: Route job type to handler**

In `apps/worker/src/handlers/index.ts`, import the handler:

```ts
import { handleUploadYoutube } from "./uploadYoutube";
```

Add the switch case:

```ts
case "upload_youtube":
  await handleUploadYoutube(db, job);
  break;
```

- [ ] **Step 7: Run focused worker checks**

Run:

```bash
bun test apps/worker/src/youtube/upload.test.ts
bun run --cwd apps/worker typecheck
```

Expected: both commands exit `0`.

---

## Task 5: Frontend Upload Button And Confirmation Modal

**Files:**
- Modify: `apps/web/src/api/queryKeys.ts`
- Modify: `apps/web/src/features/projects/hooks.ts`
- Modify: `apps/web/src/features/projects/assetUrls.ts`
- Create: `apps/web/src/features/projects/YoutubeUploadDialog.tsx`
- Modify: `apps/web/src/features/projects/RenderPanel.tsx`
- Modify: `apps/web/src/features/projects/ProjectWorkflow.tsx`
- Modify: `apps/web/src/features/projects/workflow.test.ts`

- [ ] **Step 1: Add query keys**

In `apps/web/src/api/queryKeys.ts`, add:

```ts
youtube: {
  authStatus: ["youtube", "auth-status"] as const,
},
```

Keep it at the top-level `queryKeys` object beside `projects`.

- [ ] **Step 2: Add API hooks**

In `apps/web/src/features/projects/hooks.ts`, import YouTube response types:

```ts
import type { YoutubeAuthStartResponse, YoutubeAuthStatus, Job } from "@short-workflow/shared";
```

If `Job` is already imported from that package, extend the existing import instead of duplicating it.

Add:

```ts
export function useYoutubeAuthStatusQuery(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => apiFetch<YoutubeAuthStatus>("/youtube/auth/status"),
    queryKey: queryKeys.youtube.authStatus,
  });
}

export function useStartYoutubeAuthMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<YoutubeAuthStartResponse>("/youtube/auth/start", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.youtube.authStatus });
    },
  });
}

export function useDisconnectYoutubeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ disconnected: true }>("/youtube/auth/disconnect", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.youtube.authStatus });
    },
  });
}

export function useUploadYoutubeMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/${projectId}/youtube-upload`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}
```

- [ ] **Step 3: Add Studio URL helper**

In `apps/web/src/features/projects/assetUrls.ts`, add:

```ts
export function youtubeStudioUrl(videoId: string) {
  return `https://studio.youtube.com/video/${encodeURIComponent(videoId)}/edit`;
}
```

- [ ] **Step 4: Add upload gating helpers and tests**

In `apps/web/src/features/projects/RenderPanel.tsx`, export a helper:

```ts
export function canUploadYoutube(input: {
  activeUploadJob: boolean;
  hasOutputAsset: boolean;
  hasYoutubeMetadata: boolean;
  latestRenderSucceeded: boolean;
}) {
  return (
    input.latestRenderSucceeded &&
    input.hasOutputAsset &&
    input.hasYoutubeMetadata &&
    !input.activeUploadJob
  );
}
```

In `apps/web/src/features/projects/workflow.test.ts`, add:

```ts
import { canUploadYoutube } from "./RenderPanel";
import { youtubeStudioUrl } from "./assetUrls";

test("builds YouTube Studio URLs from video ids", () => {
  expect(youtubeStudioUrl("abc123")).toBe("https://studio.youtube.com/video/abc123/edit");
});

test("gates YouTube upload on render output, metadata, and active jobs", () => {
  expect(
    canUploadYoutube({
      activeUploadJob: false,
      hasOutputAsset: true,
      hasYoutubeMetadata: true,
      latestRenderSucceeded: true,
    }),
  ).toBe(true);

  expect(
    canUploadYoutube({
      activeUploadJob: true,
      hasOutputAsset: true,
      hasYoutubeMetadata: true,
      latestRenderSucceeded: true,
    }),
  ).toBe(false);
});
```

- [ ] **Step 5: Create confirmation dialog component**

Create `apps/web/src/features/projects/YoutubeUploadDialog.tsx`:

```tsx
import type { Asset, YoutubeMetadata } from "@short-workflow/shared";
import { ExternalLink, Loader2, Upload } from "lucide-react";

import { assetPreviewUrl } from "./assetUrls";
import {
  useStartYoutubeAuthMutation,
  useUploadYoutubeMutation,
  useYoutubeAuthStatusQuery,
} from "./hooks";

type YoutubeUploadDialogProps = {
  metadata: YoutubeMetadata;
  onClose: () => void;
  outputAsset: Asset;
  projectId: string;
};

export function YoutubeUploadDialog({
  metadata,
  onClose,
  outputAsset,
  projectId,
}: YoutubeUploadDialogProps) {
  const authStatus = useYoutubeAuthStatusQuery();
  const startAuth = useStartYoutubeAuthMutation();
  const uploadYoutube = useUploadYoutubeMutation(projectId);
  const connected = authStatus.data?.connected ?? false;

  const connectYoutube = async () => {
    const result = await startAuth.mutateAsync();
    window.open(result.authUrl, "_blank", "noopener,noreferrer");
  };

  const confirmUpload = async () => {
    await uploadYoutube.mutateAsync();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Upload to YouTube</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This upload will be private. Review details before queueing.
            </p>
          </div>
          <button
            className="rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <video
          className="mt-4 aspect-[9/16] max-h-80 w-full rounded-md border border-border bg-muted object-contain"
          controls
          preload="metadata"
          src={assetPreviewUrl(outputAsset)}
        />

        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="font-medium">Title</dt>
            <dd className="mt-1 break-words text-muted-foreground">{metadata.youtubeTitle}</dd>
          </div>
          <div>
            <dt className="font-medium">Description</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
              {metadata.description}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Hashtags</dt>
            <dd className="mt-1 break-words text-muted-foreground">
              {metadata.hashtags.join(" ")}
            </dd>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-background p-2">
              <dt className="font-medium">Privacy</dt>
              <dd className="text-muted-foreground">Private</dd>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <dt className="font-medium">Audience</dt>
              <dd className="text-muted-foreground">Not made for kids</dd>
            </div>
          </div>
        </dl>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {!connected ? (
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              disabled={startAuth.isPending}
              onClick={() => void connectYoutube()}
              type="button"
            >
              {startAuth.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
              Connect YouTube
            </button>
          ) : (
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              disabled={uploadYoutube.isPending}
              onClick={() => void confirmUpload()}
              type="button"
            >
              {uploadYoutube.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Confirm private upload
            </button>
          )}
        </div>

        {startAuth.error || uploadYoutube.error ? (
          <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            YouTube upload setup failed. Check OAuth settings and try again.
          </p>
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Wire RenderPanel props and button**

In `apps/web/src/features/projects/RenderPanel.tsx`, extend imports:

```ts
import type { Asset, Job, Render, RenderPreconditionError, YoutubeMetadata, YoutubeUploadSummary } from "@short-workflow/shared";
import { Upload } from "lucide-react";
import { YoutubeUploadDialog } from "./YoutubeUploadDialog";
```

Extend props:

```ts
type RenderPanelProps = {
  activeJobs: Job[];
  assets: Asset[];
  projectId: string;
  renders: Render[];
  youtubeMetadata: YoutubeMetadata | null;
  youtubeUpload: YoutubeUploadSummary | null;
};
```

Inside the component, add state and derived values:

```ts
const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
const activeUploadJob = activeJobs.some(
  (job) =>
    job.type === "upload_youtube" && (job.status === "pending" || job.status === "processing"),
);
const youtubeUploadReady = canUploadYoutube({
  activeUploadJob,
  hasOutputAsset: Boolean(outputAsset),
  hasYoutubeMetadata: Boolean(youtubeMetadata),
  latestRenderSucceeded: latestRender?.status === "succeeded",
});
```

After the `Open folder` button, add:

```tsx
{youtubeMetadata ? (
  <button
    className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
    disabled={!youtubeUploadReady}
    onClick={() => setYoutubeDialogOpen(true)}
    type="button"
  >
    <Upload className="size-4 shrink-0" aria-hidden="true" />
    {activeUploadJob ? "Uploading to YouTube" : "Upload to YouTube"}
  </button>
) : null}
```

After the successful render block, add uploaded result:

```tsx
{youtubeUpload?.youtubeVideoId && youtubeUpload.youtubeStudioUrl ? (
  <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
    <p className="font-medium">Uploaded privately to YouTube</p>
    <p className="mt-1 break-words text-xs text-muted-foreground">
      Video ID: {youtubeUpload.youtubeVideoId}
    </p>
    <a
      className="mt-2 inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
      href={youtubeUpload.youtubeStudioUrl}
      rel="noreferrer"
      target="_blank"
    >
      Open in YouTube Studio
    </a>
  </div>
) : null}

{youtubeDialogOpen && outputAsset && youtubeMetadata ? (
  <YoutubeUploadDialog
    metadata={youtubeMetadata}
    onClose={() => setYoutubeDialogOpen(false)}
    outputAsset={outputAsset}
    projectId={projectId}
  />
) : null}
```

- [ ] **Step 7: Pass props from workflow**

In `apps/web/src/features/projects/ProjectWorkflow.tsx`, update `RenderPanel`:

```tsx
<RenderPanel
  activeJobs={activeWorkflowJobs}
  assets={detail.assets}
  projectId={projectId}
  renders={detail.renders}
  youtubeMetadata={detail.youtubeMetadata}
  youtubeUpload={detail.youtubeUpload}
/>
```

- [ ] **Step 8: Run focused web checks**

Run:

```bash
bun test apps/web/src/features/projects/workflow.test.ts
bun run --cwd apps/web typecheck
```

Expected: both commands exit `0`.

---

## Task 6: Final Verification And Manual Upload Checklist

**Files:**
- Check all files touched by Tasks 1-5.

- [ ] **Step 1: Run focused tests**

Run:

```bash
bun test apps/api/src/app.test.ts
bun test apps/worker/src/youtube/upload.test.ts
bun test apps/web/src/features/projects/workflow.test.ts
```

Expected: all commands exit `0`.

- [ ] **Step 2: Run focused typechecks**

Run:

```bash
bun run --cwd packages/shared typecheck
bun run --cwd packages/db typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/worker typecheck
bun run --cwd apps/web typecheck
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run migration check**

Run:

```bash
bun run db:check
```

Expected: exits `0`.

Do not run `bun run db:migrate:up` unless the user confirms the hosted Supabase database should be changed.

- [ ] **Step 4: Manual setup checklist**

Before manual upload testing, confirm `.env` includes server-only values:

```text
YOUTUBE_OAUTH_CLIENT_ID=...
YOUTUBE_OAUTH_CLIENT_SECRET=...
YOUTUBE_OAUTH_REDIRECT_URI=http://127.0.0.1:3001/youtube/oauth/callback
```

Confirm no `VITE_YOUTUBE_*` variable is introduced.

- [ ] **Step 5: Manual local upload check**

Run local services:

```bash
bun run dev:api
bun run dev:worker
bun run dev:web
```

Then manually verify:

1. Open a project with a successful render.
2. Click `Upload to YouTube`.
3. If disconnected, click `Connect YouTube`.
4. Complete Google OAuth in the browser.
5. Return to the app and click `Upload to YouTube` again.
6. Confirm private upload.
7. Wait for `upload youtube` job to complete.
8. Confirm the UI shows YouTube video id and `Open in YouTube Studio`.
9. Open Studio and verify privacy is `Private`.

- [ ] **Step 6: Run diff checks**

Run:

```bash
git diff --check
git diff --stat
```

Expected: no whitespace errors; stat includes only the planned shared/db/api/worker/web files and migration files.

## Self-Review

- Spec coverage: This plan implements private-only direct upload, local OAuth token storage, confirmation modal, worker job upload, derived upload summary, error handling, and focused verification.
- Scope check: The plan does not implement public/unlisted publishing, scheduling, thumbnails, playlists, upload percentages, analytics, or browser automation.
- Dependency check: The plan uses direct `fetch` and built-ins; it does not add `googleapis` or any package dependency.
- Type consistency: Shared schemas define `upload_youtube`, `YoutubeUploadJobInput`, `YoutubeUploadJobOutput`, and `YoutubeUploadSummary`; API, worker, and web tasks use those names consistently.
