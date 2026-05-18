import { describe, expect, test } from "bun:test";
import type { Asset, ProjectDetailResponse, Scene } from "@short-workflow/shared";

import { assetPreviewUrl, assetRevealUrl } from "./assetUrls";
import { getLatestSceneAsset, isAssetCurrentForScene } from "./AssetPanel";
import { applyOptimisticSceneUpdate } from "./hooks";
import { getRenderPreconditionMessages } from "./RenderPanel";

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
