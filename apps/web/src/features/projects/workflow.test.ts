import { describe, expect, test } from "bun:test";
import type {
  Asset,
  BulkAssetQueueResponse,
  Job,
  ProjectDetailResponse,
  Render,
  Scene,
} from "@short-workflow/shared";

import { assetPreviewUrl, assetRevealUrl, youtubeStudioUrl } from "./assetUrls";
import {
  assetQueueFeedbackMessage,
  getLatestSceneAsset,
  isAssetCurrentForScene,
} from "./AssetPanel";
import { applyOptimisticSceneUpdate, hasActiveProjectFlowJob, mergeActiveJobCache } from "./hooks";
import { isGenerateScriptStartable, isProjectFlowStartable } from "./ProjectWorkflow";
import {
  canUploadYoutube,
  formatYoutubePublishTime,
  getRenderPreconditionMessages,
} from "./RenderPanel";

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    caption: "Caption",
    contentUpdatedAt: "2026-05-16T10:00:00.000Z",
    createdAt: "2026-05-16T09:00:00.000Z",
    durationSeconds: 10,
    id: "11111111-1111-4111-8111-111111111111",
    imagePrompt: "Image prompt",
    narration: "Narration",
    position: 1,
    projectId: "22222222-2222-4222-8222-222222222222",
    role: "hook",
    ssml: "<speak>Narration</speak>",
    status: "ready",
    updatedAt: "2026-05-16T10:00:00.000Z",
    ...overrides,
  };
}

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    checksum: null,
    createdAt: "2026-05-16T10:05:00.000Z",
    id: "33333333-3333-4333-8333-333333333333",
    kind: "image",
    mimeType: "image/png",
    model: null,
    path: "projects/demo/image.png",
    projectId: "22222222-2222-4222-8222-222222222222",
    provider: "local",
    sceneId: "11111111-1111-4111-8111-111111111111",
    sizeBytes: null,
    status: "ready",
    storageDriver: "local",
    updatedAt: "2026-05-16T10:05:00.000Z",
    ...overrides,
  };
}

function render(overrides: Partial<Render> = {}): Render {
  return {
    aiDisclosureAcknowledgedAt: "2026-05-16T10:15:00.000Z",
    createdAt: "2026-05-16T10:15:00.000Z",
    durationSeconds: 45,
    errorMessage: null,
    fps: 30,
    height: 1920,
    id: "55555555-5555-4555-8555-555555555555",
    inputAssetId: null,
    outputAssetId: "66666666-6666-4666-8666-666666666666",
    projectId: "22222222-2222-4222-8222-222222222222",
    status: "succeeded",
    updatedAt: "2026-05-16T10:15:00.000Z",
    width: 1080,
    ...overrides,
  };
}

function job(overrides: Partial<Job> = {}): Job {
  return {
    attempts: 0,
    createdAt: "2026-05-16T10:20:00.000Z",
    errorMessage: null,
    finishedAt: null,
    id: "77777777-7777-4777-8777-777777777777",
    input: {},
    maxAttempts: 5,
    nextRetryAt: null,
    output: null,
    parentJobId: null,
    projectId: "22222222-2222-4222-8222-222222222222",
    sceneId: null,
    startedAt: null,
    status: "pending",
    type: "upload_youtube",
    updatedAt: "2026-05-16T10:20:00.000Z",
    ...overrides,
  };
}

function bulkAssetQueueResponse(
  overrides: Partial<BulkAssetQueueResponse> = {},
): BulkAssetQueueResponse {
  return {
    existingActiveCount: 0,
    jobs: [],
    queuedCount: 0,
    skippedCurrentCount: 0,
    ...overrides,
  };
}

describe("workflow asset helpers", () => {
  test("builds browser-safe preview URLs from asset ids", () => {
    expect(assetPreviewUrl(asset())).toBe(
      "http://localhost:3001/assets/33333333-3333-4333-8333-333333333333/file",
    );
  });

  test("builds browser-safe reveal URLs from asset ids", () => {
    expect(assetRevealUrl(asset())).toBe(
      "http://localhost:3001/assets/33333333-3333-4333-8333-333333333333/reveal",
    );
  });

  test("builds YouTube Studio URLs with encoded video ids", () => {
    expect(youtubeStudioUrl("video id/with?chars")).toBe(
      "https://studio.youtube.com/video/video%20id%2Fwith%3Fchars/edit",
    );
  });

  test("treats ready assets created after scene content as current", () => {
    expect(isAssetCurrentForScene(asset(), scene())).toBe(true);
    expect(isAssetCurrentForScene(asset({ createdAt: "2026-05-16T09:59:59.000Z" }), scene())).toBe(
      false,
    );
  });

  test("selects the newest ready asset for a scene and kind", () => {
    const newest = asset({
      createdAt: "2026-05-16T10:06:00.000Z",
      id: "44444444-4444-4444-8444-444444444444",
    });

    expect(
      getLatestSceneAsset({
        assets: [
          asset({ createdAt: "2026-05-16T10:03:00.000Z" }),
          asset({ kind: "audio" }),
          newest,
          asset({ status: "failed" }),
        ],
        kind: "image",
        sceneId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual(newest);
  });

  test("reports queued project asset jobs when new or active jobs exist", () => {
    expect(assetQueueFeedbackMessage(bulkAssetQueueResponse({ queuedCount: 2 }))).toBe(
      "Queued 2 asset jobs.",
    );
    expect(assetQueueFeedbackMessage(bulkAssetQueueResponse({ existingActiveCount: 1 }))).toBe(
      "Queued 1 asset job.",
    );
  });

  test("reports current project assets when no jobs were queued or already active", () => {
    expect(assetQueueFeedbackMessage(bulkAssetQueueResponse({ skippedCurrentCount: 4 }))).toBe(
      "All assets are current.",
    );
  });
});

describe("scene update helpers", () => {
  test("optimistically updates changed scene content timestamps", () => {
    const detail: ProjectDetailResponse = {
      assets: [asset()],
      jobs: [],
      project: {
        createdAt: "2026-05-16T09:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-16T09:00:00.000Z",
      },
      renders: [],
      scenes: [scene()],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    const updated = applyOptimisticSceneUpdate(
      detail,
      "11111111-1111-4111-8111-111111111111",
      { narration: "New narration" },
      "2026-05-16T10:10:00.000Z",
    );

    expect(updated.scenes[0]).toMatchObject({
      contentUpdatedAt: "2026-05-16T10:10:00.000Z",
      narration: "New narration",
      updatedAt: "2026-05-16T10:10:00.000Z",
    });

    const updatedScene = updated.scenes[0];
    expect(updatedScene).toBeDefined();
    if (!updatedScene) {
      throw new Error("Expected updated scene");
    }

    expect(isAssetCurrentForScene(asset(), updatedScene)).toBe(false);
  });
});

describe("project full-flow helpers", () => {
  test("allows a fresh project to start full flow", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(isProjectFlowStartable(detail, [])).toBe(true);
  });

  test("blocks full flow after generation has started", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [job({ status: "succeeded", type: "generate_script" })],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(isProjectFlowStartable(detail, [])).toBe(false);
  });

  test("blocks full flow while any job is active", () => {
    const detail: ProjectDetailResponse = {
      assets: [],
      jobs: [],
      project: {
        createdAt: "2026-05-19T00:00:00.000Z",
        format: "vertical_9_16",
        id: "22222222-2222-4222-8222-222222222222",
        language: "en",
        status: "draft",
        targetDurationSeconds: 45,
        title: "Project",
        topic: "Topic",
        updatedAt: "2026-05-19T00:00:00.000Z",
      },
      renders: [],
      scenes: [],
      youtubeMetadata: null,
      youtubeUpload: null,
    };

    expect(
      isProjectFlowStartable(detail, [job({ status: "pending", type: "run_project_flow" })]),
    ).toBe(false);
  });

  test("blocks manual script generation while full flow is active", () => {
    expect(isGenerateScriptStartable([])).toBe(true);
    expect(isGenerateScriptStartable([job({ status: "pending", type: "run_project_flow" })])).toBe(
      false,
    );
  });

  test("detects active project flow jobs for manual action blocking", () => {
    expect(hasActiveProjectFlowJob([])).toBe(false);
    expect(hasActiveProjectFlowJob([job({ status: "processing", type: "run_project_flow" })])).toBe(
      true,
    );
    expect(hasActiveProjectFlowJob([job({ status: "succeeded", type: "run_project_flow" })])).toBe(
      false,
    );
  });

  test("merges returned full-flow job into active job cache without duplicates", () => {
    const existingJob = job({ id: "88888888-8888-4888-8888-888888888888" });
    const returnedJob = job({
      id: "99999999-9999-4999-8999-999999999999",
      status: "pending",
      type: "run_project_flow",
    });
    const updatedReturnedJob = job({
      id: "99999999-9999-4999-8999-999999999999",
      status: "processing",
      type: "run_project_flow",
    });

    expect(mergeActiveJobCache(undefined, returnedJob)).toEqual([returnedJob]);
    expect(mergeActiveJobCache([existingJob, returnedJob], updatedReturnedJob)).toEqual([
      existingJob,
      updatedReturnedJob,
    ]);
  });
});

describe("render precondition helpers", () => {
  test("formats scene ids and failing asset kinds", () => {
    expect(
      getRenderPreconditionMessages({
        details: {
          projectHasNoScenes: true,
          scenesMissingAudio: ["scene-a"],
          scenesMissingImage: ["scene-b"],
          scenesNotReady: ["scene-c"],
          scenesStaleAudio: ["scene-d"],
          scenesStaleImage: ["scene-e"],
        },
        error: "render_preconditions_failed",
      }),
    ).toEqual([
      "Add at least one scene before rendering.",
      "Scene scene-c is not ready.",
      "Scene scene-b is missing image.",
      "Scene scene-a is missing audio.",
      "Scene scene-e has stale image.",
      "Scene scene-d has stale audio.",
    ]);
  });
});

describe("YouTube upload helpers", () => {
  const metadata = {
    description: "Description",
    disclosureHint: "AI generated.",
    hashtags: ["#shorts"],
    youtubeTitle: "Title",
  };
  const outputAsset = asset({
    id: "66666666-6666-4666-8666-666666666666",
    kind: "render",
    path: "projects/demo/render.mp4",
    provider: "remotion",
  });

  test("allows upload when render output and metadata are ready", () => {
    expect(
      canUploadYoutube({
        activeUploadJob: null,
        latestRender: render(),
        outputAsset,
        youtubeMetadata: metadata,
      }),
    ).toBe(true);
  });

  test("blocks upload without succeeded render, output asset, metadata, or while upload is active", () => {
    expect(
      canUploadYoutube({
        activeUploadJob: null,
        latestRender: render({ status: "failed" }),
        outputAsset,
        youtubeMetadata: metadata,
      }),
    ).toBe(false);
    expect(
      canUploadYoutube({
        activeUploadJob: null,
        latestRender: render(),
        outputAsset: null,
        youtubeMetadata: metadata,
      }),
    ).toBe(false);
    expect(
      canUploadYoutube({
        activeUploadJob: null,
        latestRender: render(),
        outputAsset,
        youtubeMetadata: null,
      }),
    ).toBe(false);
    expect(
      canUploadYoutube({
        activeUploadJob: job(),
        latestRender: render(),
        outputAsset,
        youtubeMetadata: metadata,
      }),
    ).toBe(false);
  });
});

describe("YouTube schedule helpers", () => {
  test("formats scheduled publish time in Bangkok time", () => {
    expect(formatYoutubePublishTime("2026-05-19T02:00:00.000Z", "Asia/Bangkok")).toContain(
      "May 19, 2026",
    );
    expect(formatYoutubePublishTime("2026-05-19T02:00:00.000Z", "Asia/Bangkok")).toContain("09:00");
  });
});
