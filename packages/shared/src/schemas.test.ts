import { describe, expect, test } from "bun:test";

import {
  createProjectRequestSchema,
  renderPreconditionErrorSchema,
} from "./api";

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
});
