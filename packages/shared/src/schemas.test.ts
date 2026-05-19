import { describe, expect, test } from "bun:test";

import { createProjectRequestSchema, renderPreconditionErrorSchema } from "./api";
import { jobSchema } from "./schemas";

describe("shared API schemas", () => {
  test("defaults project target duration to 45 seconds", () => {
    const result = createProjectRequestSchema.parse({
      title: "A short idea",
      topic: "Explain a useful workflow.",
    });

    expect(result.targetDurationSeconds).toBe(45);
  });

  test("rejects unsupported project target durations", () => {
    expect(() =>
      createProjectRequestSchema.parse({
        title: "A short idea",
        topic: "Explain a useful workflow.",
        targetDurationSeconds: 50,
      }),
    ).toThrow();
  });

  test("accepts render precondition errors with empty detail arrays", () => {
    const result = renderPreconditionErrorSchema.parse({
      error: "render_preconditions_failed",
      details: {
        projectHasNoScenes: false,
        scenesNotReady: [],
        scenesMissingImage: [],
        scenesMissingAudio: [],
        scenesStaleImage: [],
        scenesStaleAudio: [],
      },
    });

    expect(result.details.scenesNotReady).toEqual([]);
  });

  test("accepts one-click project flow jobs", () => {
    const result = jobSchema.parse({
      attempts: 0,
      createdAt: "2026-05-19T00:00:00.000Z",
      errorMessage: null,
      finishedAt: null,
      id: "11111111-1111-4111-8111-111111111111",
      input: { projectId: "22222222-2222-4222-8222-222222222222" },
      maxAttempts: 5,
      nextRetryAt: null,
      output: null,
      parentJobId: null,
      projectId: "22222222-2222-4222-8222-222222222222",
      sceneId: null,
      startedAt: null,
      status: "pending",
      type: "run_project_flow",
      updatedAt: "2026-05-19T00:00:00.000Z",
    });

    expect(result.type).toBe("run_project_flow");
  });
});
