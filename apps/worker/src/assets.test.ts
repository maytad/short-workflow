import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { absoluteAssetPath, renderInputPath, sceneAudioPath, sceneCaptionTimingPath, writeAssetFile } from "./assets";

describe("asset utilities", () => {
  test("joins the asset root and relative path", () => {
    expect(absoluteAssetPath("/asset-root", "projects/project-1/file.txt")).toBe(
      path.join("/asset-root", "projects/project-1/file.txt"),
    );
  });

  test("rejects paths that escape the asset root", () => {
    expect(() => absoluteAssetPath("/asset-root", "../escape.png")).toThrow(
      "asset_path_escapes_root",
    );
    expect(() => absoluteAssetPath("/asset-root", "/tmp/outside-root.png")).toThrow(
      "asset_path_escapes_root",
    );
  });

  test("writes bytes and returns file metadata", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "short-workflow-assets-"));

    try {
      const bytes = new TextEncoder().encode("worker asset payload");
      const result = await writeAssetFile(
        root,
        "projects/project-1/scenes/scene-1/images/asset-1.png",
        bytes,
      );

      expect(result).toEqual({
        absolutePath: path.join(root, "projects/project-1/scenes/scene-1/images/asset-1.png"),
        sizeBytes: bytes.byteLength,
        checksum: "sha256:4678f89204f4480245b8b9c6c0f9728da3fcd5c7485d85fb16c9819093fb5c63",
      });
      expect(await readFile(result.absolutePath)).toEqual(Buffer.from(bytes));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("builds render input paths under the project input directory", () => {
    expect(renderInputPath("project-1", "render-1")).toBe(
      path.join("projects", "project-1", "input", "render-1.json"),
    );
  });

  test("builds scene audio paths as wav files by default", () => {
    expect(sceneAudioPath("project-1", "scene-1", "asset-1")).toBe(
      path.join("projects", "project-1", "scenes", "scene-1", "audio", "asset-1.wav"),
    );
  });

  test("builds scene audio paths with a custom extension", () => {
    expect(sceneAudioPath("project-1", "scene-1", "asset-1", "mp3")).toBe(
      path.join("projects", "project-1", "scenes", "scene-1", "audio", "asset-1.mp3"),
    );
  });

  test("builds scene caption timing paths as json files", () => {
    expect(sceneCaptionTimingPath("project-1", "scene-1", "asset-1")).toBe(
      path.join(
        "projects",
        "project-1",
        "scenes",
        "scene-1",
        "caption-timing",
        "asset-1.json",
      ),
    );
  });
});
