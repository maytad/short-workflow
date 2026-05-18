import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { stageRenderInputAssets } from "./render";
import type { RenderInput } from "./schema";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

const makeInput = (imagePath: string, audioPath: string, captionTimingPath?: string): RenderInput => ({
  projectId: "00000000-0000-4000-8000-000000000030",
  title: "Stage Test",
  format: {
    width: 1080,
    height: 1920,
    fps: 30,
    durationSeconds: 20,
  },
  scenes: [
    {
      id: "00000000-0000-4000-8000-000000000031",
      position: 1,
      role: "hook",
      durationSeconds: 1,
      narration: "Stage test",
      caption: "Stage test",
      imagePath,
      audioPath,
      ...(captionTimingPath !== undefined ? { captionTimingPath } : {}),
    },
  ],
});

describe("stageRenderInputAssets", () => {
  test("copies absolute scene assets into a public directory and rewrites paths", async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "render-source-"));
    const publicDir = await mkdtemp(path.join(os.tmpdir(), "render-public-"));
    tempDirs.push(sourceDir, publicDir);

    const imagePath = path.join(sourceDir, "scene.png");
    const audioPath = path.join(sourceDir, "scene.wav");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(imagePath, "image");
    await writeFile(audioPath, "audio");

    const staged = await stageRenderInputAssets(makeInput(imagePath, audioPath), publicDir);
    const stagedScene = staged.scenes[0];

    expect(stagedScene).toBeDefined();
    if (!stagedScene) {
      throw new Error("Expected staged scene");
    }

    expect(stagedScene.imagePath).toBe("assets/00000000-0000-4000-8000-000000000031-image.png");
    expect(stagedScene.audioPath).toBe("assets/00000000-0000-4000-8000-000000000031-audio.wav");
    await expect(readFile(path.join(publicDir, stagedScene.imagePath), "utf8")).resolves.toBe(
      "image",
    );
    await expect(readFile(path.join(publicDir, stagedScene.audioPath), "utf8")).resolves.toBe(
      "audio",
    );
  });

  test("stages caption timing JSON and rewrites captionTimingPath", async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "render-source-"));
    const publicDir = await mkdtemp(path.join(os.tmpdir(), "render-public-"));
    tempDirs.push(sourceDir, publicDir);

    const imagePath = path.join(sourceDir, "scene.png");
    const audioPath = path.join(sourceDir, "scene.mp3");
    const captionTimingPath = path.join(sourceDir, "scene.json");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(imagePath, "image");
    await writeFile(audioPath, "audio");
    await writeFile(captionTimingPath, '{"version":1}');

    const staged = await stageRenderInputAssets(
      makeInput(imagePath, audioPath, captionTimingPath),
      publicDir,
    );
    const stagedScene = staged.scenes[0];

    expect(stagedScene).toBeDefined();
    if (!stagedScene) {
      throw new Error("Expected staged scene");
    }

    expect(stagedScene.captionTimingPath).toBe(
      "assets/00000000-0000-4000-8000-000000000031-caption_timing.json",
    );
    const stagedCaptionTimingPath = stagedScene.captionTimingPath;
    if (!stagedCaptionTimingPath) {
      throw new Error("Expected captionTimingPath");
    }
    await expect(
      readFile(path.join(publicDir, stagedCaptionTimingPath), "utf8"),
    ).resolves.toBe('{"version":1}');
  });

  test("omits captionTimingPath when not provided", async () => {
    const sourceDir = await mkdtemp(path.join(os.tmpdir(), "render-source-"));
    const publicDir = await mkdtemp(path.join(os.tmpdir(), "render-public-"));
    tempDirs.push(sourceDir, publicDir);

    const imagePath = path.join(sourceDir, "scene.png");
    const audioPath = path.join(sourceDir, "scene.wav");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(imagePath, "image");
    await writeFile(audioPath, "audio");

    const staged = await stageRenderInputAssets(makeInput(imagePath, audioPath), publicDir);
    const stagedScene = staged.scenes[0];

    expect(stagedScene).toBeDefined();
    if (!stagedScene) {
      throw new Error("Expected staged scene");
    }

    expect(stagedScene.captionTimingPath).toBeUndefined();
  });
});
