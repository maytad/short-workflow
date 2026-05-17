import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export type WrittenAssetFile = {
  absolutePath: string;
  sizeBytes: number;
  checksum: string;
};

export function absoluteAssetPath(root: string, relativePath: string) {
  return path.join(root, relativePath);
}

export async function writeAssetFile(
  root: string,
  relativePath: string,
  bytes: Uint8Array,
): Promise<WrittenAssetFile> {
  const absolutePath = absoluteAssetPath(root, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);

  const info = await stat(absolutePath);
  const checksum = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

  return {
    absolutePath,
    sizeBytes: info.size,
    checksum,
  };
}

export async function statAssetFile(
  root: string,
  relativePath: string,
): Promise<WrittenAssetFile> {
  const absolutePath = absoluteAssetPath(root, relativePath);
  const [info, bytes] = await Promise.all([
    stat(absolutePath),
    readFile(absolutePath),
  ]);

  return {
    absolutePath,
    sizeBytes: info.size,
    checksum: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
  };
}

export function sceneImagePath(
  projectId: string,
  sceneId: string,
  assetId: string,
) {
  return path.join(
    "projects",
    projectId,
    "scenes",
    sceneId,
    "images",
    `${assetId}.png`,
  );
}

export function sceneAudioPath(
  projectId: string,
  sceneId: string,
  assetId: string,
) {
  return path.join(
    "projects",
    projectId,
    "scenes",
    sceneId,
    "audio",
    `${assetId}.mp3`,
  );
}

export function renderInputPath(projectId: string, renderId: string) {
  return path.join("projects", projectId, "input", `${renderId}.json`);
}

export function renderOutputPath(projectId: string, renderId: string) {
  return path.join("projects", projectId, "renders", `${renderId}.mp4`);
}
