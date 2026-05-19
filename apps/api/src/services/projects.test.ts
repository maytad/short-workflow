import { describe, expect, test } from "bun:test";

import type { DbClient, JobRow, RenderRow } from "@short-workflow/db";

import {
  buildRenderPreconditionReport,
  buildYoutubeUploadDescription,
  latestYoutubeMetadata,
  queueMissingProjectAssets,
  queueProjectFullFlow,
} from "./projects";

const projectId = "11111111-1111-4111-8111-111111111111";
const currentSceneId = "22222222-2222-4222-8222-222222222222";
const staleSceneId = "33333333-3333-4333-8333-333333333333";
const draftSceneId = "44444444-4444-4444-8444-444444444444";

function scene(id: string, status: "draft" | "ready", contentUpdatedAt: string) {
  return {
    id,
    projectId,
    position: 1,
    role: "hook",
    durationSeconds: 3,
    narration: "Narration",
    caption: "Caption",
    imagePrompt: "Prompt",
    ssml: "<speak>Narration</speak>",
    status,
    contentUpdatedAt: new Date(contentUpdatedAt),
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
  } as const;
}

function asset(
  sceneId: string,
  kind: "image" | "audio",
  createdAt: string,
  status: "pending" | "ready" | "failed" = "ready",
) {
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneId,
    kind,
    storageDriver: "local",
    path: `projects/${projectId}/${kind}`,
    mimeType: kind === "image" ? "image/png" : "audio/wav",
    sizeBytes: 1,
    checksum: null,
    status,
    provider: "google_gemini",
    model: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  } as const;
}

function job(
  sceneId: string,
  type: Extract<JobRow["type"], "generate_scene_image" | "generate_scene_audio">,
): JobRow {
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneId,
    type,
    status: "pending",
    attempts: 0,
    maxAttempts: 5,
    parentJobId: null,
    errorMessage: null,
    input: { projectId, sceneId },
    output: null,
    nextRetryAt: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    startedAt: null,
    finishedAt: null,
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
  };
}

type QueueDepsInput = {
  assets?: ReturnType<typeof asset>[];
  activeJobs?: JobRow[];
  scenes?: ReturnType<typeof scene>[];
};

function queueDeps(input: QueueDepsInput) {
  const createdInputs: {
    projectId: string;
    sceneId: string | null;
    type: JobRow["type"];
    input: Record<string, unknown>;
    maxAttempts?: number;
  }[] = [];

  return {
    createdInputs,
    deps: {
      createJobIdempotent: async (_db: DbClient, jobInput: (typeof createdInputs)[number]) => {
        createdInputs.push(jobInput);
        return job(
          jobInput.sceneId ?? currentSceneId,
          jobInput.type as Extract<
            JobRow["type"],
            "generate_scene_image" | "generate_scene_audio"
          >,
        );
      },
      listProjectAssets: async () => input.assets ?? [],
      listProjectJobs: async () => input.activeJobs ?? [],
      listProjectScenes: async () =>
        input.scenes ?? [scene(currentSceneId, "ready", "2026-05-17T01:00:00.000Z")],
    },
  };
}

describe("queueMissingProjectAssets", () => {
  test("queues image and audio jobs for missing assets", async () => {
    const { createdInputs, deps } = queueDeps({});

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result.queuedCount).toBe(2);
    expect(result.existingActiveCount).toBe(0);
    expect(result.skippedCurrentCount).toBe(0);
    expect(result.jobs).toHaveLength(2);
    expect(createdInputs).toEqual([
      {
        projectId,
        sceneId: currentSceneId,
        type: "generate_scene_image",
        input: { projectId, sceneId: currentSceneId },
      },
      {
        projectId,
        sceneId: currentSceneId,
        type: "generate_scene_audio",
        input: { projectId, sceneId: currentSceneId },
      },
    ]);
  });

  test("skips current image and audio assets", async () => {
    const { createdInputs, deps } = queueDeps({
      assets: [
        asset(currentSceneId, "image", "2026-05-17T01:00:00.000Z"),
        asset(currentSceneId, "audio", "2026-05-17T01:00:00.000Z"),
      ],
    });

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result).toMatchObject({
      queuedCount: 0,
      existingActiveCount: 0,
      skippedCurrentCount: 2,
      jobs: [],
    });
    expect(createdInputs).toEqual([]);
  });

  test("queues stale assets and returns existing active jobs", async () => {
    const activeAudioJob = job(staleSceneId, "generate_scene_audio");
    const { createdInputs, deps } = queueDeps({
      activeJobs: [activeAudioJob],
      assets: [asset(staleSceneId, "image", "2026-05-17T01:59:59.000Z")],
      scenes: [scene(staleSceneId, "ready", "2026-05-17T02:00:00.000Z")],
    });

    const result = await queueMissingProjectAssets({} as never, projectId, deps);

    expect(result.queuedCount).toBe(1);
    expect(result.existingActiveCount).toBe(1);
    expect(result.skippedCurrentCount).toBe(0);
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.map((queuedJob) => queuedJob.id)).toContain(activeAudioJob.id);
    expect(createdInputs).toEqual([
      {
        projectId,
        sceneId: staleSceneId,
        type: "generate_scene_image",
        input: { projectId, sceneId: staleSceneId },
      },
    ]);
  });

  test("throws when the project has no scenes", async () => {
    const { deps } = queueDeps({ scenes: [] });

    await expect(queueMissingProjectAssets({} as never, projectId, deps)).rejects.toThrow(
      "project_has_no_scenes",
    );
  });
});

describe("buildRenderPreconditionReport", () => {
  test("reports missing, stale, and not-ready scene inputs", async () => {
    const report = await buildRenderPreconditionReport({} as never, projectId, {
      listProjectScenes: async () => [
        scene(currentSceneId, "ready", "2026-05-17T01:00:00.000Z"),
        scene(staleSceneId, "ready", "2026-05-17T02:00:00.000Z"),
        scene(draftSceneId, "draft", "2026-05-17T03:00:00.000Z"),
      ],
      listProjectAssets: async () => [
        asset(currentSceneId, "image", "2026-05-17T01:00:00.000Z"),
        asset(currentSceneId, "audio", "2026-05-17T01:01:00.000Z"),
        asset(staleSceneId, "image", "2026-05-17T01:59:59.000Z"),
        asset(draftSceneId, "image", "2026-05-17T03:00:00.000Z", "pending"),
      ],
    });

    expect(report).toEqual({
      projectHasNoScenes: false,
      scenesNotReady: [draftSceneId],
      scenesMissingImage: [draftSceneId],
      scenesMissingAudio: [staleSceneId, draftSceneId],
      scenesStaleImage: [staleSceneId],
      scenesStaleAudio: [],
    });
  });

  test("reports when a project has no scenes", async () => {
    const report = await buildRenderPreconditionReport({} as never, projectId, {
      listProjectScenes: async () => [],
      listProjectAssets: async () => [],
    });

    expect(report).toEqual({
      projectHasNoScenes: true,
      scenesNotReady: [],
      scenesMissingImage: [],
      scenesMissingAudio: [],
      scenesStaleImage: [],
      scenesStaleAudio: [],
    });
  });
});

describe("buildYoutubeUploadDescription", () => {
  test("appends visible hashtags to the YouTube description", () => {
    expect(
      buildYoutubeUploadDescription({
        description: "A compact explanation of the mechanism.",
        hashtags: ["#TinyMechanisms", "Engineering", "#Shorts"],
      }),
    ).toBe("A compact explanation of the mechanism.\n\n#TinyMechanisms #Engineering #Shorts");
  });
});

describe("latestYoutubeMetadata", () => {
  test("reads metadata from a succeeded project flow job", () => {
    const metadataDraft = {
      youtubeTitle: "Why springs remember",
      description: "A compact explanation of stored mechanical energy.",
      hashtags: ["#TinyMechanisms"],
      disclosureHint: "AI-assisted script and visuals.",
    };
    const projectFlowJob: JobRow = {
      id: "55555555-5555-4555-8555-555555555555",
      projectId,
      sceneId: null,
      type: "run_project_flow",
      status: "succeeded",
      attempts: 1,
      maxAttempts: 5,
      parentJobId: null,
      errorMessage: null,
      input: { projectId },
      output: { metadataDraft },
      nextRetryAt: null,
      createdAt: new Date("2026-05-19T00:00:00.000Z"),
      startedAt: new Date("2026-05-19T00:00:00.000Z"),
      finishedAt: new Date("2026-05-19T00:01:00.000Z"),
      updatedAt: new Date("2026-05-19T00:01:00.000Z"),
    };

    expect(latestYoutubeMetadata([projectFlowJob])).toEqual(metadataDraft);
  });
});

const fullFlowProject = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Fresh project",
  topic: "A topic",
  status: "draft",
  targetDurationSeconds: 45,
  language: "en",
  format: "vertical_9_16",
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
} as const;

const fullFlowJob = {
  id: "66666666-6666-4666-8666-666666666666",
  projectId: fullFlowProject.id,
  sceneId: null,
  type: "run_project_flow",
  status: "pending",
  attempts: 0,
  maxAttempts: 5,
  parentJobId: null,
  errorMessage: null,
  input: { projectId: fullFlowProject.id },
  output: null,
  nextRetryAt: null,
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  startedAt: null,
  finishedAt: null,
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
} as const;

function fullFlowDeps(
  input: {
    activeJobs?: JobRow[];
    allJobs?: JobRow[];
    assets?: ReturnType<typeof asset>[];
    project?: typeof fullFlowProject | null;
    renders?: RenderRow[];
    scenes?: ReturnType<typeof scene>[];
  } = {},
) {
  const createdInputs: {
    projectId: string;
    sceneId: string | null;
    type: JobRow["type"];
    input: Record<string, unknown>;
    maxAttempts?: number;
  }[] = [];

  return {
    createdInputs,
    deps: {
      createJobIdempotent: async (_db: DbClient, jobInput: (typeof createdInputs)[number]) => {
        createdInputs.push(jobInput);
        return fullFlowJob;
      },
      getProject: async () => ("project" in input ? input.project : fullFlowProject),
      listProjectAssets: async () => input.assets ?? [],
      listProjectJobs: async (_db: DbClient, _projectId: string, status?: "active") =>
        status === "active" ? (input.activeJobs ?? []) : (input.allJobs ?? []),
      listProjectRenders: async () => input.renders ?? [],
      listProjectScenes: async () => input.scenes ?? [],
      withAdvisoryTransactionLock: async <T>(
        _db: DbClient,
        _key: string,
        callback: (tx: DbClient) => Promise<T>,
      ) => callback({} as DbClient),
    },
  };
}

describe("queueProjectFullFlow", () => {
  test("queues one-click flow for a fresh project", async () => {
    const { createdInputs, deps } = fullFlowDeps();

    const result = await queueProjectFullFlow({} as never, fullFlowProject.id, deps);

    expect(result).toEqual({ status: "queued", job: fullFlowJob });
    expect(createdInputs).toEqual([
      {
        projectId: fullFlowProject.id,
        sceneId: null,
        type: "run_project_flow",
        input: { projectId: fullFlowProject.id },
      },
    ]);
  });

  test("returns not_found when the project is missing", async () => {
    const { deps } = fullFlowDeps({ project: null });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "not_found",
    });
  });

  test("blocks while any project job is active", async () => {
    const { createdInputs, deps } = fullFlowDeps({ activeJobs: [fullFlowJob] });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "active_jobs",
    });
    expect(createdInputs).toEqual([]);
  });

  test("blocks when generation or render work already started", async () => {
    const { createdInputs, deps } = fullFlowDeps({
      allJobs: [{ ...fullFlowJob, status: "succeeded", type: "generate_script" }],
    });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "already_started",
    });
    expect(createdInputs).toEqual([]);
  });

  test("blocks when scenes already exist", async () => {
    const { deps } = fullFlowDeps({
      scenes: [scene(currentSceneId, "ready", "2026-05-19T00:00:00.000Z")],
    });

    await expect(queueProjectFullFlow({} as never, fullFlowProject.id, deps)).resolves.toEqual({
      status: "already_started",
    });
  });
});
