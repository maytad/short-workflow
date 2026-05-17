import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderInputSchema } from "./schema";
import type { RenderInput } from "./schema";

const parseArgs = (argv: string[]) => {
  const args = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) {
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    args.set(arg.slice(2), value);
    index += 1;
  }

  const input = args.get("input");
  const output = args.get("output");

  if (!input || !output) {
    throw new Error("Usage: render:project -- --input <path> --output <path>");
  }

  return { input, output };
};

const readRenderInput = async (inputPath: string) => {
  const raw = await readFile(inputPath, "utf8");
  return renderInputSchema.parse(JSON.parse(raw));
};

const isRemoteUrl = (assetPath: string) => /^https?:\/\//.test(assetPath);

const toLocalPath = (assetPath: string) => {
  if (assetPath.startsWith("file://")) {
    return fileURLToPath(assetPath);
  }

  return path.isAbsolute(assetPath) ? assetPath : null;
};

const stageAsset = async ({
  assetPath,
  kind,
  publicDir,
  sceneId,
}: {
  assetPath: string;
  kind: "audio" | "image";
  publicDir: string;
  sceneId: string;
}) => {
  if (isRemoteUrl(assetPath)) {
    return assetPath;
  }

  const localPath = toLocalPath(assetPath);
  if (!localPath) {
    return assetPath;
  }

  const extension = path.extname(localPath);
  const stagedPath = path.join("assets", `${sceneId}-${kind}${extension || ".asset"}`);
  const destinationPath = path.join(publicDir, stagedPath);

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(localPath, destinationPath);

  return stagedPath;
};

export const stageRenderInputAssets = async (
  renderInput: RenderInput,
  publicDir: string,
): Promise<RenderInput> => ({
  ...renderInput,
  scenes: await Promise.all(
    renderInput.scenes.map(async (scene) => ({
      ...scene,
      audioPath: await stageAsset({
        assetPath: scene.audioPath,
        kind: "audio",
        publicDir,
        sceneId: scene.id,
      }),
      imagePath: await stageAsset({
        assetPath: scene.imagePath,
        kind: "image",
        publicDir,
        sceneId: scene.id,
      }),
    })),
  ),
});

const renderProject = async () => {
  const { input, output } = parseArgs(process.argv.slice(2));
  const renderInput = await readRenderInput(input);
  const outputPath = path.resolve(output);
  const publicDir = await mkdtemp(path.join(os.tmpdir(), "short-render-"));
  const stagedRenderInput = await stageRenderInputAssets(renderInput, publicDir);
  const entryPoint = path.join(path.dirname(fileURLToPath(import.meta.url)), "Root.tsx");

  await mkdir(path.dirname(outputPath), { recursive: true });

  console.log(`Rendering ${renderInput.projectId} to ${outputPath}`);

  try {
    const serveUrl = await bundle({
      entryPoint,
      publicDir,
    });

    const composition = await selectComposition({
      id: "ShortVideo",
      inputProps: stagedRenderInput,
      serveUrl,
    });

    await renderMedia({
      codec: "h264",
      composition,
      inputProps: stagedRenderInput,
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100);
        process.stdout.write(`\rRendering ${percent}%`);
      },
      outputLocation: outputPath,
      serveUrl,
    });
  } finally {
    await rm(publicDir, { force: true, recursive: true });
  }

  process.stdout.write("\n");
  console.log(`Rendered ${outputPath}`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  renderProject().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
