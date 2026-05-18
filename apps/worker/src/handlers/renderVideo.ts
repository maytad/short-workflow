import { mkdir, access } from "node:fs/promises";
import path from "node:path";

import {
  RENDER_FPS,
  RENDER_HEIGHT,
  RENDER_WIDTH,
  renderInputSchema,
  type RenderInput,
} from "@short-workflow/shared";
import {
  createPendingAsset,
  createRenderAttempt,
  getCurrentReadySceneAsset,
  getProject,
  getReadyAssetByPath,
  listProjectScenes,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  markRenderFailed,
  markRenderSucceeded,
  setProjectStatus,
  type AssetRow,
  type DbClient,
  type JobRow,
  type RenderRow,
} from "@short-workflow/db";

import {
  absoluteAssetPath,
  renderInputPath,
  renderOutputPath,
  sceneCaptionTimingPath,
  statAssetFile,
  writeAssetFile,
} from "../assets";
import { resolveHandlerEnv, type HandlerEnv } from "./types";

type RenderProject = {
  id: string;
  title: string;
};

type RenderScene = {
  id: string;
  position: number;
  role: RenderInput["scenes"][number]["role"];
  durationSeconds: number;
  narration: string;
  caption: string;
  status: string;
};

type RenderSceneAsset = Pick<AssetRow, "id" | "path" | "createdAt">;

type SceneAssetPair = {
  image: RenderSceneAsset | null;
  audio: RenderSceneAsset | null;
  captionTiming: RenderSceneAsset | null;
};

export function buildRenderInput(input: {
  assetRoot: string;
  project: RenderProject;
  scenes: RenderScene[];
  sceneAssets: Map<string, SceneAssetPair>;
}): RenderInput {
  if (input.scenes.length === 0) {
    throw new Error("render_preconditions_failed:no_scenes");
  }

  const durationSeconds = input.scenes.reduce((total, scene) => total + scene.durationSeconds, 0);

  return renderInputSchema.parse({
    projectId: input.project.id,
    title: input.project.title,
    format: {
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      fps: RENDER_FPS,
      durationSeconds,
    },
    scenes: input.scenes.map((scene) => {
      if (scene.status !== "ready") {
        throw new Error(`render_preconditions_failed:scene_not_ready:${scene.id}`);
      }

      const assets = input.sceneAssets.get(scene.id);

      if (!assets?.image || !assets.audio) {
        throw new Error(`render_preconditions_failed:missing_scene_asset:${scene.id}`);
      }

      return {
        id: scene.id,
        position: scene.position,
        role: scene.role,
        durationSeconds: scene.durationSeconds,
        narration: scene.narration,
        caption: scene.caption,
        imagePath: absoluteAssetPath(input.assetRoot, assets.image.path),
        audioPath: absoluteAssetPath(input.assetRoot, assets.audio.path),
        ...(assets.captionTiming
          ? { captionTimingPath: absoluteAssetPath(input.assetRoot, assets.captionTiming.path) }
          : {}),
      };
    }),
  });
}

export async function handleRenderVideo(db: DbClient, job: JobRow, env?: HandlerEnv) {
  const handlerEnv = resolveHandlerEnv(env);
  const project = await getProject(db, job.projectId);

  if (!project) {
    throw new Error("project_not_found");
  }

  const scenes = await listProjectScenes(db, project.id);
  const sceneAssets = new Map<string, SceneAssetPair>();

  for (const scene of scenes) {
    const [image, audio] = await Promise.all([
      getCurrentReadySceneAsset(db, { sceneId: scene.id, kind: "image" }),
      getCurrentReadySceneAsset(db, { sceneId: scene.id, kind: "audio" }),
    ]);

    let captionTiming: RenderSceneAsset | null = null;
    if (audio) {
      const captionPath = sceneCaptionTimingPath(project.id, scene.id, audio.id);
      captionTiming = await getReadyAssetByPath(db, {
        sceneId: scene.id,
        kind: "caption_timing",
        path: captionPath,
      });
    }

    sceneAssets.set(scene.id, { image, audio, captionTiming });
  }

  const renderInput = buildRenderInput({
    assetRoot: handlerEnv.LOCAL_ASSET_ROOT,
    project,
    scenes,
    sceneAssets,
  });

  let render: RenderRow | null = null;
  let inputAsset: AssetRow | null = null;
  let outputAsset: AssetRow | null = null;
  let inputAssetReady = false;
  let outputAssetReady = false;

  try {
    render = await createRenderAttempt(db, {
      projectId: project.id,
      status: "processing",
      durationSeconds: renderInput.format.durationSeconds,
      width: RENDER_WIDTH,
      height: RENDER_HEIGHT,
      fps: RENDER_FPS,
    });

    const inputPath = renderInputPath(project.id, render.id);
    inputAsset = await createPendingAsset(db, {
      projectId: project.id,
      sceneId: null,
      kind: "render_input",
      path: inputPath,
      provider: "local",
    });

    const inputFile = await writeAssetFile(
      handlerEnv.LOCAL_ASSET_ROOT,
      inputPath,
      new TextEncoder().encode(`${JSON.stringify(renderInput, null, 2)}\n`),
    );

    await markAssetReady(db, inputAsset.id, {
      path: inputPath,
      mimeType: "application/json",
      sizeBytes: inputFile.sizeBytes,
      checksum: inputFile.checksum,
      provider: "local",
      model: null,
    });
    inputAssetReady = true;

    const outputPath = renderOutputPath(project.id, render.id);
    const absoluteInputPath = inputFile.absolutePath;
    const absoluteOutputPath = absoluteAssetPath(handlerEnv.LOCAL_ASSET_ROOT, outputPath);

    await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await runRenderCommand({
      inputPath: absoluteInputPath,
      outputPath: absoluteOutputPath,
    });

    const outputFile = await statAssetFile(handlerEnv.LOCAL_ASSET_ROOT, outputPath);

    outputAsset = await createPendingAsset(db, {
      projectId: project.id,
      sceneId: null,
      kind: "render",
      path: outputPath,
      provider: "remotion",
    });

    await markAssetReady(db, outputAsset.id, {
      path: outputPath,
      mimeType: "video/mp4",
      sizeBytes: outputFile.sizeBytes,
      checksum: outputFile.checksum,
      provider: "remotion",
      model: null,
    });
    outputAssetReady = true;

    await markRenderSucceeded(db, render.id, inputAsset.id, outputAsset.id);
    await setProjectStatus(db, project.id, "done");
    await markJobSucceeded(db, job.id, {
      renderId: render.id,
      inputAssetId: inputAsset.id,
      outputAssetId: outputAsset.id,
    });
  } catch (error) {
    const message = errorMessage(error);

    if (outputAsset && !outputAssetReady) {
      await markAssetFailed(db, outputAsset.id, message);
    }

    if (inputAsset && !inputAssetReady) {
      await markAssetFailed(db, inputAsset.id, message);
    }

    if (render) {
      await markRenderFailed(db, render.id, message);
      await setProjectStatus(db, project.id, "failed");
    }

    throw error;
  }
}

async function runRenderCommand(input: { inputPath: string; outputPath: string }) {
  const repoRoot = await findWorkspaceRoot(process.cwd());
  const subprocess = Bun.spawn(
    [
      "bun",
      "run",
      "--cwd",
      "apps/render",
      "render:project",
      "--",
      "--input",
      input.inputPath,
      "--output",
      input.outputPath,
    ],
    {
      cwd: repoRoot,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      [
        `render_process_failed:${exitCode}`,
        truncateOutput("stdout", stdout),
        truncateOutput("stderr", stderr),
      ].join("\n"),
    );
  }
}

async function findWorkspaceRoot(start: string) {
  let current = start;

  while (true) {
    try {
      await access(path.join(current, "apps", "worker", "package.json"));
      await access(path.join(current, "apps", "render", "package.json"));
      return current;
    } catch {
      const parent = path.dirname(current);

      if (parent === current) {
        throw new Error("workspace_root_not_found");
      }

      current = parent;
    }
  }
}

function truncateOutput(label: string, output: string) {
  const trimmed = output.trim();

  if (!trimmed) {
    return `${label}:<empty>`;
  }

  return `${label}:${trimmed.slice(-4_000)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
