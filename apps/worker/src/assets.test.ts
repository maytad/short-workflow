import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { absoluteAssetPath, writeAssetFile } from "./assets";

describe("asset utilities", () => {
  test("joins the asset root and relative path", () => {
    expect(absoluteAssetPath("/asset-root", "projects/project-1/file.txt")).toBe(
      path.join("/asset-root", "projects/project-1/file.txt"),
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
        absolutePath: path.join(
          root,
          "projects/project-1/scenes/scene-1/images/asset-1.png",
        ),
        sizeBytes: bytes.byteLength,
        checksum:
          "sha256:4678f89204f4480245b8b9c6c0f9728da3fcd5c7485d85fb16c9819093fb5c63",
      });
      expect(await readFile(result.absolutePath)).toEqual(Buffer.from(bytes));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
