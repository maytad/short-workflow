import { describe, expect, test } from "bun:test";

import type { AssetRow, DbClient, JobRow, SceneRow } from "@short-workflow/db";

import { runProjectFlow } from "./runProjectFlow";

const projectId = "11111111-1111-4111-8111-111111111111";
const sceneAId = "22222222-2222-4222-8222-222222222222";
const sceneBId = "33333333-3333-4333-8333-333333333333";

const job: JobRow = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId,
  sceneId: null,
  type: "run_project_flow",
  status: "processing",
  attempts: 1,
  maxAttempts: 5,
  parentJobId: null,
  errorMessage: null,
  input: { projectId },
  output: null,
  nextRetryAt: null,
  createdAt: new Date("2026-05-19T00:00:00.000Z"),
  startedAt: new Date("2026-05-19T00:00:00.000Z"),
  finishedAt: null,
  updatedAt: new Date("2026-05-19T00:00:00.000Z"),
};

function scene(id: string, position: number): SceneRow {
  return {
    id,
    projectId,
    position,
    role: position === 1 ? "hook" : "context",
    durationSeconds: 3,
    narration: `Narration ${position}`,
    caption: `Caption ${position}`,
    imagePrompt: `Prompt ${position}`,
    ssml: `<speak>Narration ${position}</speak>`,
    status: "ready",
    contentUpdatedAt: new Date("2026-05-19T00:00:00.000Z"),
    createdAt: new Date("2026-05-19T00:00:00.000Z"),
    updatedAt: new Date("2026-05-19T00:00:00.000Z"),
  };
}

function asset(id: string, sceneId: string, kind: "image" | "audio"): AssetRow {
  return {
    id,
    projectId,
    sceneId,
    kind,
    storageDriver: "local",
    path: `projects/${projectId}/${sceneId}/${kind}`,
    mimeType: kind === "image" ? "image/png" : "audio/mpeg",
    sizeBytes: 1,
    checksum: null,
    status: "ready",
    provider: kind === "image" ? "openai" : "elevenlabs",
    model: null,
    createdAt: new Date("2026-05-19T00:01:00.000Z"),
    updatedAt: new Date("2026-05-19T00:01:00.000Z"),
  };
}

describe("runProjectFlow", () => {
  test("generates script, missing assets, and render in order", async () => {
    const calls: string[] = [];
    const scenes = [scene(sceneAId, 1), scene(sceneBId, 2)];

    await runProjectFlow({} as DbClient, job, {
      generateCurrentSceneAudio: async (_db, sceneId) => {
        calls.push(`audio:${sceneId}`);
        return {
          assetId: `audio-${sceneId}`,
          captionTimingAssetId: null,
          promptVersionId: `audio-prompt-${sceneId}`,
          reused: false,
        };
      },
      generateCurrentSceneImage: async (_db, sceneId) => {
        calls.push(`image:${sceneId}`);
        return {
          assetId: `image-${sceneId}`,
          promptVersionId: `image-prompt-${sceneId}`,
          reused: false,
        };
      },
      generateProjectScript: async () => {
        calls.push("script");
        return {
          sceneIds: scenes.map((candidate) => candidate.id),
          promptVersionId: "script-prompt",
          seedId: "seed-1",
          channelPresetId: "tiny_mechanisms",
          metadataDraft: null,
        };
      },
      getCurrentReadySceneAsset: async () => null,
      listProjectScenes: async () => {
        calls.push("list-scenes");
        return calls.includes("script") ? scenes : [];
      },
      markJobSucceeded: async (_db, jobId, output) => {
        calls.push(`succeeded:${jobId}`);
        expect(output).toMatchObject({
          imageAssetIds: [`image-${sceneAId}`, `image-${sceneBId}`],
          audioAssetIds: [`audio-${sceneAId}`, `audio-${sceneBId}`],
          renderId: "render-1",
          outputAssetId: "render-output-1",
        });
        return job;
      },
      renderProjectVideo: async () => {
        calls.push("render");
        return {
          renderId: "render-1",
          inputAssetId: "render-input-1",
          outputAssetId: "render-output-1",
          durationSeconds: 45,
        };
      },
    });

    expect(calls).toEqual([
      "list-scenes",
      "script",
      "list-scenes",
      `image:${sceneAId}`,
      `audio:${sceneAId}`,
      `image:${sceneBId}`,
      `audio:${sceneBId}`,
      "render",
      `succeeded:${job.id}`,
    ]);
  });

  test("skips current scene assets on retry", async () => {
    const calls: string[] = [];
    const scenes = [scene(sceneAId, 1)];

    await runProjectFlow({} as DbClient, job, {
      generateCurrentSceneAudio: async () => {
        throw new Error("audio_should_not_run");
      },
      generateCurrentSceneImage: async () => {
        throw new Error("image_should_not_run");
      },
      generateProjectScript: async () => {
        throw new Error("script_should_not_run");
      },
      getCurrentReadySceneAsset: async (_db, input) =>
        asset(`${input.kind}-asset`, input.sceneId, input.kind as "image" | "audio"),
      listProjectScenes: async () => scenes,
      markJobSucceeded: async (_db, _jobId, output) => {
        calls.push("succeeded");
        expect(output).toMatchObject({
          imageAssetIds: ["image-asset"],
          audioAssetIds: ["audio-asset"],
        });
        return job;
      },
      renderProjectVideo: async () => {
        calls.push("render");
        return {
          renderId: "render-1",
          inputAssetId: "render-input-1",
          outputAssetId: "render-output-1",
          durationSeconds: 45,
        };
      },
    });

    expect(calls).toEqual(["render", "succeeded"]);
  });
});
