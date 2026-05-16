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
});
