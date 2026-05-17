import { describe, expect, test } from "bun:test";

import { createApp } from "./app";
import type { ProjectRouteServices } from "./routes/projects";

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

function request(path: string, init?: RequestInit) {
  return new Request(`http://localhost${path}`, init);
}

function createServices(
  overrides: Partial<ProjectRouteServices> = {},
): ProjectRouteServices {
  return {
    listProjects: async () => [project],
    createProject: async () => project,
    getProjectDetail: async () => ({
      project,
      scenes: [],
      assets: [],
      renders: [],
      jobs: [],
    }),
    updateProject: async () => project,
    assertProjectCanDelete: async () => true,
    deleteProjectRows: async () => project,
    deleteProjectLocalFiles: async () => {},
    listProjectScenes: async () => [],
    listProjectAssets: async () => [],
    listProjectRenders: async () => [],
    listProjectJobs: async () => [],
    getProject: async () => project,
    getScene: async () => null,
    updateScene: async () => scene,
    createJobIdempotent: async () => job,
    retryFailedJob: async () => job,
    acknowledgeRenderDisclosure: async () => null,
    buildRenderPreconditionReport: async () => ({
      scenesNotReady: [],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    }),
    ...overrides,
  };
}

describe("createApp", () => {
  test("serves health without touching project services", async () => {
    const app = createApp({
      db: {} as never,
      projectServices: createServices(),
    });

    const response = await app.handle(request("/health"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: "short-workflow-api",
    });
  });

  test("returns concise validation issues for invalid project creation", async () => {
    const app = createApp({
      db: {} as never,
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
      issues: [
        { path: "title" },
        { path: "topic" },
      ],
    });
  });

  test("returns 404 when project detail is missing", async () => {
    const app = createApp({
      db: {} as never,
      projectServices: createServices({
        getProjectDetail: async () => null,
      }),
    });

    const response = await app.handle(
      request("/projects/11111111-1111-4111-8111-111111111111"),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  test("returns active jobs conflict when deleting a busy project", async () => {
    const app = createApp({
      db: {} as never,
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
      db: {} as never,
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

  test("creates a project script generation job", async () => {
    let receivedInput: unknown;
    const app = createApp({
      db: {} as never,
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

  test("returns render precondition failures instead of creating render job", async () => {
    let createdJob = false;
    const report = {
      scenesNotReady: ["33333333-3333-4333-8333-333333333333"],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    };
    const app = createApp({
      db: {} as never,
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

  test("updates a scene with normalized editable fields", async () => {
    let receivedSceneId: string | undefined;
    let receivedInput: unknown;
    const app = createApp({
      db: {} as never,
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

  test("returns 400 for invalid scene update input", async () => {
    const app = createApp({
      db: {} as never,
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
      db: {} as never,
      projectServices: createServices({
        retryFailedJob: async () => {
          throw new Error("retry_requires_failed_job");
        },
      }),
    });

    const response = await app.handle(
      request(`/jobs/${job.id}/retry`, { method: "POST" }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "retry_requires_failed_job",
    });
  });
});
