import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { stageRenderInputAssets } from "./render";
import type { RenderInput } from "./schema";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

const makeInput = (imagePath: string, audioPath: string): RenderInput => ({
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

    const staged = await stageRenderInputAssets(
      makeInput(imagePath, audioPath),
      publicDir,
    );

    expect(staged.scenes[0]!.imagePath).toBe(
      "assets/00000000-0000-4000-8000-000000000031-image.png",
    );
    expect(staged.scenes[0]!.audioPath).toBe(
      "assets/00000000-0000-4000-8000-000000000031-audio.wav",
    );
    await expect(
      readFile(path.join(publicDir, staged.scenes[0]!.imagePath), "utf8"),
    ).resolves.toBe("image");
    await expect(
      readFile(path.join(publicDir, staged.scenes[0]!.audioPath), "utf8"),
    ).resolves.toBe("audio");
  });
});
