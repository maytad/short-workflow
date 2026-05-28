import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { JobRow } from "@short-workflow/db";

import { createApp } from "./app";
import type { ProjectRouteServices } from "./routes/projects";
import {
  hasRequiredYoutubeScopes,
  refreshYoutubeToken,
  youtubeTokenPath,
} from "./services/youtubeAuth";

const project = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test project",
  topic: "Test topic",
  status: "draft",
  targetDurationSeconds: 45,
  language: "en",
  format: "vertical_9_16",
  createdAt: new Date("2026-05-17T00:00:00.000Z"),
  updatedAt: new Date("2026-05-17T00:00:00.000Z"),
} as const;

const job = {
  id: "22222222-2222-4222-8222-222222222222",
  projectId: project.id,
  sceneId: null,
  type: "render_video",
  status: "pending",
  attempts: 0,
  maxAttempts: 5,
  parentJobId: null,
  errorMessage: null,
  input: { projectId: project.id },
  output: null,
  nextRetryAt: null,
  createdAt: new Date("2026-05-17T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date("2026-05-17T00:00:00.000Z"),
} as const;

const scene = {
  id: "33333333-3333-4333-8333-333333333333",
  projectId: project.id,
  position: 1,
  role: "hook",
  durationSeconds: 10,
  narration: "Updated narration",
  caption: "Updated caption",
  imagePrompt: "Updated image prompt",
  ssml: "<speak>Updated narration</speak>",
  status: "ready",
  contentUpdatedAt: new Date("2026-05-17T00:00:00.000Z"),
  createdAt: new Date("2026-05-17T00:00:00.000Z"),
  updatedAt: new Date("2026-05-17T00:00:00.000Z"),
} as const;

const asset = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId: project.id,
  sceneId: scene.id,
  kind: "image",
  storageDriver: "local",
  path: "projects/test/scenes/scene/images/asset.png",
  mimeType: "image/png",
  sizeBytes: 7,
  checksum: null,
  status: "ready",
  provider: "openai",
  model: "gpt-image-2",
  createdAt: new Date("2026-05-17T00:00:00.000Z"),
  updatedAt: new Date("2026-05-17T00:00:00.000Z"),
} as const;

const renderAsset = {
  ...asset,
  id: "55555555-5555-4555-8555-555555555555",
  kind: "render",
  mimeType: "video/mp4",
  path: "projects/test/renders/render.mp4",
  provider: "remotion",
  sceneId: null,
} as const;

const youtubeJob = {
  ...job,
  id: "66666666-6666-4666-8666-666666666666",
  type: "upload_youtube",
  input: {
    mode: "private",
    renderId: "77777777-7777-4777-8777-777777777777",
    outputAssetId: renderAsset.id,
    title: "Test title",
    description: "Test description",
    tags: ["TinyMechanisms"] as string[],
    privacyStatus: "private",
    selfDeclaredMadeForKids: false,
    containsSyntheticMedia: true,
  },
} as const;

const youtubeSchedule = {
  id: "88888888-8888-4888-8888-888888888888",
  projectId: project.id,
  jobId: null,
  renderId: youtubeJob.input.renderId,
  outputAssetId: renderAsset.id,
  scheduledPublishAt: new Date("2026-05-19T02:00:00.000Z"),
  timezone: "Asia/Bangkok",
  status: "reserved",
  youtubeVideoId: null,
  errorMessage: null,
  createdAt: new Date("2026-05-18T00:00:00.000Z"),
  updatedAt: new Date("2026-05-18T00:00:00.000Z"),
} as const;

const fullFlowJob = {
  ...job,
  id: "99999999-9999-4999-8999-999999999999",
  type: "run_project_flow",
  input: { projectId: project.id },
} as const;

const activeFullFlowJob: JobRow = {
  ...fullFlowJob,
  status: "processing",
  attempts: 1,
  startedAt: new Date("2026-05-17T00:00:00.000Z"),
};

const failedFullFlowJob: JobRow = {
  ...fullFlowJob,
  status: "failed",
  attempts: 5,
  errorMessage: "flow failed",
  finishedAt: new Date("2026-05-17T00:10:00.000Z"),
};

const activeScriptJob: JobRow = {
  ...job,
  type: "generate_script",
  status: "processing",
  attempts: 1,
  startedAt: new Date("2026-05-17T00:00:00.000Z"),
};

const failedScriptJob: JobRow = {
  ...job,
  type: "generate_script",
  status: "failed",
  attempts: 5,
  errorMessage: "script failed",
  finishedAt: new Date("2026-05-17T00:10:00.000Z"),
};

const testDb = {
  execute: async () => [],
} as never;

function lockTrackingDb() {
  const result = {
    lockCalls: 0,
    db: {
      execute: async () => {
        result.lockCalls += 1;
        return [];
      },
    },
  };

  return {
    get lockCalls() {
      return result.lockCalls;
    },
    db: result.db,
  };
}

function apiJob(row: typeof job) {
  return {
    ...row,
    nextRetryAt: null,
    createdAt: row.createdAt.toISOString(),
    startedAt: null,
    finishedAt: null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function createServices(overrides: Partial<ProjectRouteServices> = {}): ProjectRouteServices {
  return {
    listProjects: async () => [{ ...project, latestFailure: null, youtubeUpload: null }],
    createProject: async () => project,
    getProjectDetail: async () => ({
      project,
      scenes: [],
      assets: [],
      renders: [],
      jobs: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    }),
    updateProject: async () => project,
    assertProjectCanDelete: async () => true,
    deleteProjectRows: async () => project,
    deleteProjectLocalFiles: async () => {},
    listProjectScenes: async () => [],
    listProjectAssets: async () => [],
    listProjectRenders: async () => [],
    listProjectJobs: async () => [],
    getJob: async () => null,
    getProject: async () => project,
    getScene: async () => null,
    updateScene: async () => scene,
    createJobIdempotent: async () => job,
    retryFailedJob: async () => job,
    acknowledgeRenderDisclosure: async () => null,
    buildRenderPreconditionReport: async () => ({
      projectHasNoScenes: false,
      scenesNotReady: [],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    }),
    buildYoutubeUploadJobInput: async () => youtubeJob.input,
    reserveNextYoutubeScheduleSlot: async () => youtubeSchedule,
    attachYoutubeScheduleJob: async () => ({ ...youtubeSchedule, jobId: youtubeJob.id }),
    getYoutubeScheduleForJob: async () => null,
    queueProjectFullFlow: async () => ({ status: "queued", job: fullFlowJob }),
    queueMissingProjectAssets: async () => ({
      jobs: [],
      queuedCount: 0,
      existingActiveCount: 0,
      skippedCurrentCount: 0,
    }),
    getYoutubeAuthStatus: async () => ({
      connected: true,
      hasRequiredScopes: true,
      reconnectRequired: false,
    }),
    ...overrides,
  };
}

describe("createApp", () => {
  test("allows CORS preflight from Vite 127.0.0.1 origin", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
    });

    const response = await app.handle(
      request("/projects", {
        method: "OPTIONS",
        headers: {
          "access-control-request-method": "GET",
          origin: "http://127.0.0.1:5173",
        },
      }),
    );

    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5173");
  });

  test("serves health without touching project services", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
    });

    const response = await app.handle(request("/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "short-workflow-api",
    });
  });

  test("returns YouTube auth status without exposing tokens", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
      youtubeServices: {
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: true,
          reconnectRequired: false,
        }),
        createYoutubeAuthUrl: async () => ({
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        }),
        handleYoutubeOAuthCallback: async () => {},
        disconnectYoutube: async () => ({ disconnected: true }),
      },
    });

    const response = await app.handle(request("/youtube/auth/status"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      connected: true,
      hasRequiredScopes: true,
      reconnectRequired: false,
    });
  });

  test("creates a YouTube auth URL", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
      youtubeServices: {
        getYoutubeAuthStatus: async () => ({
          connected: false,
          hasRequiredScopes: false,
          reconnectRequired: false,
        }),
        createYoutubeAuthUrl: async () => ({
          authUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
        }),
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

  test("creates a YouTube auth URL with upload, delete, Data readonly, and Analytics readonly scopes", async () => {
    const assetRoot = await mkdtemp(path.join(tmpdir(), "short-workflow-youtube-auth-"));
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousAssetRoot = process.env.LOCAL_ASSET_ROOT;
    const previousClientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    process.env.LOCAL_ASSET_ROOT = assetRoot;
    process.env.YOUTUBE_OAUTH_CLIENT_ID = "youtube-client-id";
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
    });

    try {
      const response = await app.handle(request("/youtube/auth/start", { method: "POST" }));

      expect(response.status).toBe(200);
      const body = (await response.json()) as { authUrl: string };
      const scope = new URL(body.authUrl).searchParams.get("scope");

      expect(scope).toContain("https://www.googleapis.com/auth/youtube.upload");
      expect(scope).toContain("https://www.googleapis.com/auth/youtube.readonly");
      expect(scope).toContain("https://www.googleapis.com/auth/youtube.force-ssl");
      expect(scope).toContain("https://www.googleapis.com/auth/yt-analytics.readonly");
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }

      if (previousAssetRoot === undefined) {
        delete process.env.LOCAL_ASSET_ROOT;
      } else {
        process.env.LOCAL_ASSET_ROOT = previousAssetRoot;
      }

      if (previousClientId === undefined) {
        delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
      } else {
        process.env.YOUTUBE_OAUTH_CLIENT_ID = previousClientId;
      }

      await rm(assetRoot, { force: true, recursive: true });
    }
  });

  test("validates required YouTube OAuth scopes", () => {
    expect(
      hasRequiredYoutubeScopes(
        [
          "https://www.googleapis.com/auth/youtube.upload",
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/youtube.force-ssl",
          "https://www.googleapis.com/auth/yt-analytics.readonly",
        ].join(" "),
      ),
    ).toBe(true);
    expect(hasRequiredYoutubeScopes("https://www.googleapis.com/auth/youtube.upload")).toBe(false);
  });

  test("refresh rejects reduced YouTube OAuth scopes", async () => {
    const assetRoot = await mkdtemp(path.join(tmpdir(), "short-workflow-youtube-refresh-"));
    const requiredScopes = [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ].join(" ");

    try {
      await expect(
        refreshYoutubeToken({
          env: {
            DATABASE_URL: "postgres://user:pass@localhost:5432/db",
            LOCAL_ASSET_ROOT: assetRoot,
            API_HOST: "127.0.0.1",
            API_PORT: 3001,
            YOUTUBE_OAUTH_CLIENT_ID: "youtube-client-id",
          },
          fetchFn: (async () =>
            new Response(
              JSON.stringify({
                access_token: "reduced-scope-access-token",
                expires_in: 3600,
                scope: "https://www.googleapis.com/auth/youtube.upload",
                token_type: "Bearer",
              }),
              {
                headers: { "content-type": "application/json" },
                status: 200,
              },
            )) as unknown as typeof fetch,
          now: Date.parse("2026-05-21T00:00:00.000Z"),
          token: {
            access_token: "complete-scope-access-token",
            expires_at: "2026-05-21T01:00:00.000Z",
            refresh_token: "youtube-refresh-token",
            scope: requiredScopes,
            token_type: "Bearer",
          },
        }),
      ).rejects.toThrow("youtube_reconnect_required");

      await expect(readFile(youtubeTokenPath(assetRoot), "utf8")).rejects.toThrow();
    } finally {
      await rm(assetRoot, { force: true, recursive: true });
    }
  });

  test("maps missing YouTube OAuth env to conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
      youtubeServices: {
        getYoutubeAuthStatus: async () => ({
          connected: false,
          hasRequiredScopes: false,
          reconnectRequired: false,
        }),
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

  test("maps YouTube OAuth callback failure to bad request", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
      youtubeServices: {
        getYoutubeAuthStatus: async () => ({
          connected: false,
          hasRequiredScopes: false,
          reconnectRequired: false,
        }),
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

  test("returns concise validation issues for invalid project creation", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
    });

    const response = await app.handle(
      request("/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "", topic: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "validation_failed",
      issues: [{ path: "title" }, { path: "topic" }],
    });
  });

  test("returns 404 when project detail is missing", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getProjectDetail: async () => null,
      }),
    });

    const response = await app.handle(request("/projects/11111111-1111-4111-8111-111111111111"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("serves ready asset files with their stored content type", async () => {
    const bytes = new TextEncoder().encode("png");
    const services = {
      ...createServices(),
      getAsset: async () => asset,
      readAssetFile: async () => ({
        bytes,
        mimeType: "image/png",
      }),
    } as ProjectRouteServices & {
      getAsset: () => Promise<typeof asset>;
      readAssetFile: () => Promise<{ bytes: Uint8Array; mimeType: string }>;
    };
    const app = createApp({
      db: testDb,
      projectServices: services,
    });

    const response = await app.handle(request(`/assets/${asset.id}/file`));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.text()).toBe("png");
  });

  test("reveals ready local render asset files through the project service", async () => {
    let receivedAsset: typeof renderAsset | undefined;
    const services = {
      ...createServices(),
      getAsset: async () => renderAsset,
      revealAssetFile: async (assetToReveal: typeof renderAsset) => {
        receivedAsset = assetToReveal;
      },
    } as ProjectRouteServices & {
      getAsset: () => Promise<typeof renderAsset>;
      revealAssetFile: (assetToReveal: typeof renderAsset) => Promise<void>;
    };
    const app = createApp({
      db: testDb,
      projectServices: services,
    });

    const response = await app.handle(
      request(`/assets/${renderAsset.id}/reveal`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revealed: true });
    expect(receivedAsset?.id).toBe(renderAsset.id);
  });

  test("does not reveal non-render asset files", async () => {
    let revealed = false;
    const services = {
      ...createServices(),
      getAsset: async () => asset,
      revealAssetFile: async () => {
        revealed = true;
      },
    } as ProjectRouteServices & {
      getAsset: () => Promise<typeof asset>;
      revealAssetFile: () => Promise<void>;
    };
    const app = createApp({
      db: testDb,
      projectServices: services,
    });

    const response = await app.handle(request(`/assets/${asset.id}/reveal`, { method: "POST" }));

    expect(response.status).toBe(404);
    expect(revealed).toBe(false);
  });

  test("returns active jobs conflict when deleting a busy project", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        assertProjectCanDelete: async () => false,
      }),
    });

    const response = await app.handle(
      request("/projects/11111111-1111-4111-8111-111111111111", {
        method: "DELETE",
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "project_has_active_jobs",
    });
  });

  test("passes active status filter to project jobs service", async () => {
    let receivedStatus: "active" | undefined;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        listProjectJobs: async (_db, _projectId, status) => {
          receivedStatus = status;
          return [];
        },
      }),
    });

    const response = await app.handle(
      request("/projects/11111111-1111-4111-8111-111111111111/jobs?status=active"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(receivedStatus).toBe("active");
  });

  test("queues a one-click project flow job", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "queued", job: fullFlowJob }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: fullFlowJob.id,
      type: "run_project_flow",
    });
  });

  test("maps active jobs to one-click flow conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "active_jobs" }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
  });

  test("maps already-started projects to one-click flow conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueProjectFullFlow: async () => ({ status: "already_started" }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/run-flow`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_flow_already_started" });
  });

  test("creates a project script generation job", async () => {
    let receivedInput: unknown;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        createJobIdempotent: async (_db, input) => {
          receivedInput = input;
          return job;
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/generate-script`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: job.id });
    expect(receivedInput).toEqual({
      projectId: project.id,
      sceneId: null,
      type: "generate_script",
      input: { projectId: project.id },
    });
  });

  test("blocks manual project jobs while a project flow is active", async () => {
    const paths = [
      `/projects/${project.id}/generate-script`,
      `/projects/${project.id}/generate-assets`,
      `/projects/${project.id}/render`,
    ];

    for (const path of paths) {
      const lockTracker = lockTrackingDb();
      let createdJob = false;
      let queuedAssets = false;
      let checkedRenderPreconditions = false;
      let receivedStatus: "active" | undefined;
      const app = createApp({
        db: lockTracker.db as never,
        projectServices: createServices({
          listProjectJobs: async (_db, _projectId, status) => {
            receivedStatus = status;
            return [activeFullFlowJob];
          },
          createJobIdempotent: async () => {
            createdJob = true;
            return job;
          },
          queueMissingProjectAssets: async () => {
            queuedAssets = true;
            return {
              jobs: [],
              queuedCount: 0,
              existingActiveCount: 0,
              skippedCurrentCount: 0,
            };
          },
          buildRenderPreconditionReport: async () => {
            checkedRenderPreconditions = true;
            return {
              projectHasNoScenes: false,
              scenesNotReady: [],
              scenesMissingImage: [],
              scenesMissingAudio: [],
              scenesStaleImage: [],
              scenesStaleAudio: [],
            };
          },
        }),
      });

      const response = await app.handle(request(path, { method: "POST" }));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
      expect(receivedStatus).toBe("active");
      expect(lockTracker.lockCalls).toBe(1);
      expect(createdJob).toBe(false);
      expect(queuedAssets).toBe(false);
      expect(checkedRenderPreconditions).toBe(false);
    }
  });

  test("queues missing project assets", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueMissingProjectAssets: async () => ({
          jobs: [apiJob(job)],
          queuedCount: 1,
          existingActiveCount: 0,
          skippedCurrentCount: 3,
        }),
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/generate-assets`, { method: "POST" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      jobs: [{ id: job.id }],
      queuedCount: 1,
      existingActiveCount: 0,
      skippedCurrentCount: 3,
    });
  });

  test("returns no-scenes error for project asset queue", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        queueMissingProjectAssets: async () => {
          throw new Error("project_has_no_scenes");
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/generate-assets`, { method: "POST" }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "project_has_no_scenes" });
  });

  test("returns render precondition failures instead of creating render job", async () => {
    let createdJob = false;
    const report = {
      projectHasNoScenes: false,
      scenesNotReady: ["33333333-3333-4333-8333-333333333333"],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    };
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        buildRenderPreconditionReport: async () => report,
        createJobIdempotent: async () => {
          createdJob = true;
          return job;
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/render`, { method: "POST" }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "render_preconditions_failed",
      details: report,
    });
    expect(createdJob).toBe(false);
  });

  test("returns render precondition failure for projects with no scenes", async () => {
    let createdJob = false;
    const report = {
      projectHasNoScenes: true,
      scenesNotReady: [],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    };
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        buildRenderPreconditionReport: async () => report,
        createJobIdempotent: async () => {
          createdJob = true;
          return job;
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/render`, { method: "POST" }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "render_preconditions_failed",
      details: report,
    });
    expect(createdJob).toBe(false);
  });

  test("returns conflict when YouTube is not connected", async () => {
    let createdJob = false;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: false,
          hasRequiredScopes: false,
          reconnectRequired: false,
        }),
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

  test("returns reconnect required when YouTube token is missing required scopes", async () => {
    let createdJob = false;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: false,
          reconnectRequired: true,
        }),
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
    expect(await response.json()).toEqual({ error: "youtube_reconnect_required" });
    expect(createdJob).toBe(false);
  });

  test("returns an existing active YouTube upload before auth and precondition checks", async () => {
    let checkedAuth = false;
    let builtInput = false;
    let createdJob = false;
    let lookedUpScheduleForJob: string | undefined;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        listProjectJobs: async () => [youtubeJob],
        getYoutubeScheduleForJob: async (_db, jobId) => {
          lookedUpScheduleForJob = jobId;
          return null;
        },
        getYoutubeAuthStatus: async () => {
          checkedAuth = true;
          return {
            connected: false,
            hasRequiredScopes: false,
            reconnectRequired: false,
          };
        },
        buildYoutubeUploadJobInput: async () => {
          builtInput = true;
          return youtubeJob.input;
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

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      job: {
        id: youtubeJob.id,
        type: "upload_youtube",
      },
      schedule: null,
    });
    expect(lookedUpScheduleForJob).toBe(youtubeJob.id);
    expect(checkedAuth).toBe(false);
    expect(builtInput).toBe(false);
    expect(createdJob).toBe(false);
  });

  test("queues a private YouTube upload job", async () => {
    let receivedInput: unknown;
    const uploadInput = youtubeJob.input;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: true,
          reconnectRequired: false,
        }),
        buildYoutubeUploadJobInput: async () => uploadInput,
        createJobIdempotent: async (_db, input) => {
          receivedInput = input;
          return youtubeJob;
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/youtube-upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "private" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      job: {
        id: youtubeJob.id,
        type: "upload_youtube",
      },
      schedule: null,
    });
    expect(receivedInput).toEqual({
      projectId: project.id,
      sceneId: null,
      type: "upload_youtube",
      input: uploadInput,
      maxAttempts: 1,
    });
  });

  test("queues a scheduled public YouTube upload job", async () => {
    let receivedInput: unknown;
    let reservedProjectId: string | undefined;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: true,
          reconnectRequired: false,
        }),
        reserveNextYoutubeScheduleSlot: async (_db, input) => {
          reservedProjectId = input.projectId;
          return youtubeSchedule;
        },
        createJobIdempotent: async (_db, input) => {
          receivedInput = input;
          return youtubeJob;
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/youtube-upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "scheduled_public" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      job: { id: youtubeJob.id, type: "upload_youtube" },
      schedule: {
        id: youtubeSchedule.id,
        scheduledPublishAt: youtubeSchedule.scheduledPublishAt.toISOString(),
        timezone: "Asia/Bangkok",
        status: "reserved",
      },
    });
    expect(reservedProjectId).toBe(project.id);
    expect(receivedInput).toMatchObject({
      projectId: project.id,
      sceneId: null,
      type: "upload_youtube",
      input: {
        mode: "scheduled_public",
        scheduleId: youtubeSchedule.id,
        publishAt: youtubeSchedule.scheduledPublishAt.toISOString(),
        privacyStatus: "private",
      },
      maxAttempts: 1,
    });
  });

  test("maps full YouTube schedule to conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: true,
          reconnectRequired: false,
        }),
        reserveNextYoutubeScheduleSlot: async () => {
          throw new Error("youtube_schedule_full");
        },
      }),
    });

    const response = await app.handle(
      request(`/projects/${project.id}/youtube-upload`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "scheduled_public" }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "youtube_schedule_full" });
  });

  test("returns upload precondition errors before queueing YouTube upload", async () => {
    let createdJob = false;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        getYoutubeAuthStatus: async () => ({
          connected: true,
          hasRequiredScopes: true,
          reconnectRequired: false,
        }),
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

  test("updates a scene with normalized editable fields", async () => {
    let receivedSceneId: string | undefined;
    let receivedInput: unknown;
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        updateScene: async (_db, sceneId, input) => {
          receivedSceneId = sceneId;
          receivedInput = input;
          return scene;
        },
      }),
    });

    const response = await app.handle(
      request(`/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          narration: "  Updated narration  ",
          caption: "Updated caption",
          imagePrompt: "Updated image prompt",
          ssml: "<speak>Updated narration</speak>",
          ignored: "field",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(receivedInput).toBeUndefined();

    const validResponse = await app.handle(
      request(`/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          narration: "  Updated narration  ",
          caption: "Updated caption",
          imagePrompt: "Updated image prompt",
          ssml: "<speak>Updated narration</speak>",
        }),
      }),
    );

    expect(validResponse.status).toBe(200);
    expect(await validResponse.json()).toMatchObject({ id: scene.id });
    expect(receivedSceneId).toBe(scene.id);
    expect(receivedInput).toEqual({
      narration: "Updated narration",
      caption: "Updated caption",
      imagePrompt: "Updated image prompt",
      ssml: "<speak>Updated narration</speak>",
    });
  });

  test("blocks manual scene jobs while a project flow is active", async () => {
    const paths = [`/scenes/${scene.id}/generate-image`, `/scenes/${scene.id}/generate-audio`];

    for (const path of paths) {
      const lockTracker = lockTrackingDb();
      let createdJob = false;
      let receivedProjectId: string | undefined;
      let receivedStatus: "active" | undefined;
      const app = createApp({
        db: lockTracker.db as never,
        projectServices: createServices({
          getScene: async () => scene,
          listProjectJobs: async (_db, projectId, status) => {
            receivedProjectId = projectId;
            receivedStatus = status;
            return [activeFullFlowJob];
          },
          createJobIdempotent: async () => {
            createdJob = true;
            return job;
          },
        }),
      });

      const response = await app.handle(request(path, { method: "POST" }));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
      expect(receivedProjectId).toBe(project.id);
      expect(receivedStatus).toBe("active");
      expect(lockTracker.lockCalls).toBe(1);
      expect(createdJob).toBe(false);
    }
  });

  test("returns 400 for invalid scene update input", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices(),
    });

    const response = await app.handle(
      request(`/scenes/${scene.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ durationSeconds: 0 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "validation_failed",
      issues: [{ path: "durationSeconds" }],
    });
  });

  test("maps retry_requires_failed_job to conflict", async () => {
    const app = createApp({
      db: testDb,
      projectServices: createServices({
        retryFailedJob: async () => {
          throw new Error("retry_requires_failed_job");
        },
      }),
    });

    const response = await app.handle(request(`/jobs/${job.id}/retry`, { method: "POST" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "retry_requires_failed_job",
    });
  });

  test("blocks retrying full flow while another project job is active", async () => {
    const lockTracker = lockTrackingDb();
    let retried = false;
    let receivedProjectId: string | undefined;
    let receivedStatus: "active" | undefined;
    const app = createApp({
      db: lockTracker.db as never,
      projectServices: createServices({
        getJob: async () => failedFullFlowJob,
        listProjectJobs: async (_db, projectId, status) => {
          receivedProjectId = projectId;
          receivedStatus = status;
          return [activeScriptJob];
        },
        retryFailedJob: async () => {
          retried = true;
          return fullFlowJob;
        },
      }),
    });

    const response = await app.handle(request(`/jobs/${fullFlowJob.id}/retry`, { method: "POST" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
    expect(receivedProjectId).toBe(project.id);
    expect(receivedStatus).toBe("active");
    expect(lockTracker.lockCalls).toBe(1);
    expect(retried).toBe(false);
  });

  test("blocks retrying manual workflow jobs while project flow is active", async () => {
    const lockTracker = lockTrackingDb();
    let retried = false;
    const app = createApp({
      db: lockTracker.db as never,
      projectServices: createServices({
        getJob: async () => failedScriptJob,
        listProjectJobs: async () => [activeFullFlowJob],
        retryFailedJob: async () => {
          retried = true;
          return job;
        },
      }),
    });

    const response = await app.handle(
      request(`/jobs/${failedScriptJob.id}/retry`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "project_has_active_jobs" });
    expect(lockTracker.lockCalls).toBe(1);
    expect(retried).toBe(false);
  });
});
