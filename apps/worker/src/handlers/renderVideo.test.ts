import { describe, expect, test } from "bun:test";

import { buildRenderInput } from "./renderVideo";

const createdAt = new Date("2026-05-17T00:00:00.000Z");

const project = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  title: "Kitchen science",
};

const scene = {
  id: "123e4567-e89b-12d3-a456-426614174001",
  position: 1,
  role: "hook",
  durationSeconds: 30,
  narration: "A quick opener",
  caption: "Science in the kitchen",
  status: "ready",
} as const;

describe("buildRenderInput", () => {
  test("uses absolute image and audio paths for ready scenes", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [scene],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.wav",
              createdAt,
            },
            captionTiming: null,
            captionTimingAudioDurationSeconds: null,
          },
        ],
      ]),
    });

    expect(input).toEqual({
      projectId: project.id,
      title: project.title,
      format: {
        width: 1080,
        height: 1920,
        fps: 30,
        durationSeconds: 30,
      },
      scenes: [
        {
          id: scene.id,
          position: scene.position,
          role: scene.role,
          durationSeconds: scene.durationSeconds,
          narration: scene.narration,
          caption: scene.caption,
          imagePath: "/tmp/asset-root/projects/project-1/scenes/scene-1/images/image.png",
          audioPath: "/tmp/asset-root/projects/project-1/scenes/scene-1/audio/audio.wav",
        },
      ],
    });
  });

  test("includes captionTimingPath when caption timing asset is present", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [scene],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
              createdAt,
            },
            captionTiming: {
              id: "caption-asset-1",
              path: "projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
              createdAt,
            },
            captionTimingAudioDurationSeconds: null,
          },
        ],
      ]),
    });

    expect(input.scenes[0]?.captionTimingPath).toBe(
      "/tmp/asset-root/projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
    );
  });

  test("omits captionTimingPath when caption timing asset is absent", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [scene],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.wav",
              createdAt,
            },
            captionTiming: null,
            captionTimingAudioDurationSeconds: null,
          },
        ],
      ]),
    });

    expect(input.scenes[0]?.captionTimingPath).toBeUndefined();
  });

  test("trims scene duration to caption timing audio duration plus tail buffer", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [scene],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
              createdAt,
            },
            captionTiming: {
              id: "caption-asset-1",
              path: "projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
              createdAt,
            },
            captionTimingAudioDurationSeconds: 2.1,
          },
        ],
      ]),
    });

    const expectedDuration = Math.ceil((2.1 + 0.25) * 30) / 30;
    expect(input.scenes[0]?.durationSeconds).toBe(expectedDuration);
    expect(input.format.durationSeconds).toBe(expectedDuration);
  });

  test("falls back to planned scene duration when caption timing duration is absent", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [scene],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
              createdAt,
            },
            captionTiming: null,
            captionTimingAudioDurationSeconds: null,
          },
        ],
      ]),
    });

    expect(input.scenes[0]?.durationSeconds).toBe(scene.durationSeconds);
    expect(input.format.durationSeconds).toBe(scene.durationSeconds);
  });

  test("extends scene duration when caption timing audio slightly exceeds the planned scene", () => {
    const input = buildRenderInput({
      assetRoot: "/tmp/asset-root",
      project,
      scenes: [{ ...scene, durationSeconds: 3 }],
      sceneAssets: new Map([
        [
          scene.id,
          {
            image: {
              id: "img-asset-1",
              path: "projects/project-1/scenes/scene-1/images/image.png",
              createdAt,
            },
            audio: {
              id: "audio-asset-1",
              path: "projects/project-1/scenes/scene-1/audio/audio.mp3",
              createdAt,
            },
            captionTiming: {
              id: "caption-asset-1",
              path: "projects/project-1/scenes/scene-1/caption-timing/asset-1.json",
              createdAt,
            },
            captionTimingAudioDurationSeconds: 3.248,
          },
        ],
      ]),
    });

    const expectedDuration = Math.ceil((3.248 + 0.25) * 30) / 30;
    expect(input.scenes[0]?.durationSeconds).toBe(expectedDuration);
    expect(input.format.durationSeconds).toBe(expectedDuration);
  });

  test("throws a render precondition error when a scene is not ready", () => {
    expect(() =>
      buildRenderInput({
        assetRoot: "/tmp/asset-root",
        project,
        scenes: [{ ...scene, status: "draft" }],
        sceneAssets: new Map(),
      }),
    ).toThrow("render_preconditions_failed:scene_not_ready");
  });

  test("throws a render precondition error when scene assets are missing", () => {
    expect(() =>
      buildRenderInput({
        assetRoot: "/tmp/asset-root",
        project,
        scenes: [scene],
        sceneAssets: new Map(),
      }),
    ).toThrow("render_preconditions_failed:missing_scene_asset");
  });
});
