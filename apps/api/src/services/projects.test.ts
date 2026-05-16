import { describe, expect, test } from "bun:test";

import { buildRenderPreconditionReport } from "./projects";

const projectId = "11111111-1111-4111-8111-111111111111";
const currentSceneId = "22222222-2222-4222-8222-222222222222";
const staleSceneId = "33333333-3333-4333-8333-333333333333";
const draftSceneId = "44444444-4444-4444-8444-444444444444";

function scene(
  id: string,
  status: "draft" | "ready",
  contentUpdatedAt: string,
) {
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
    mimeType: kind === "image" ? "image/png" : "audio/mpeg",
    sizeBytes: 1,
    checksum: null,
    status,
    provider: kind === "image" ? "google_gemini" : "google_tts",
    model: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  } as const;
}

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
      scenesNotReady: [draftSceneId],
      scenesMissingImage: [draftSceneId],
      scenesMissingAudio: [staleSceneId, draftSceneId],
      scenesStaleImage: [staleSceneId],
      scenesStaleAudio: [],
    });
  });
});
