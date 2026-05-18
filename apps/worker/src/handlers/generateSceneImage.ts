import {
  generateImage,
  imagePromptTemplate,
  promptPayload,
  resolveImageProvider,
  sceneVisualBriefFromScriptResponseText,
  sceneVisualHookArchetypeFromScriptResponseText,
  styleContextFromScriptResponseText,
} from "@short-workflow/ai";
import {
  createPendingAsset,
  getLatestPromptVersion,
  getProject,
  getScene,
  insertPromptVersion,
  markAssetFailed,
  markAssetReady,
  markJobSucceeded,
  type AssetRow,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

import { sceneImagePath, writeAssetFile } from "../assets";
import { resolveHandlerEnv, type HandlerEnv } from "./types";

export async function handleGenerateSceneImage(db: DbClient, job: JobRow, env?: HandlerEnv) {
  if (!job.sceneId) {
    throw new Error("scene_id_required");
  }

  const handlerEnv = resolveHandlerEnv(env);
  const scene = await getScene(db, job.sceneId);

  if (!scene) {
    throw new Error("scene_not_found");
  }

  const project = await getProject(db, scene.projectId);
  if (!project) {
    throw new Error("project_not_found");
  }

  const latestScriptPrompt = await getLatestPromptVersion(db, {
    projectId: scene.projectId,
    sceneId: null,
    purpose: "script",
  });
  const styleContext = styleContextFromScriptResponseText(latestScriptPrompt?.responseText);
  const visualBrief = sceneVisualBriefFromScriptResponseText(
    latestScriptPrompt?.responseText,
    scene.position,
  );
  const visualHookArchetype = sceneVisualHookArchetypeFromScriptResponseText(
    latestScriptPrompt?.responseText,
    scene.position,
  );

  let asset: AssetRow | null = null;
  let assetReady = false;
  const provider = resolveImageProvider();

  try {
    asset = await createPendingAsset(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      kind: "image",
      path: sceneImagePath(scene.projectId, scene.id, "pending"),
      provider,
    });

    const compiledPrompt = imagePromptTemplate.compile({
      project,
      scene: {
        ...scene,
        ...(visualBrief ? { visualBrief } : {}),
        ...(visualHookArchetype ? { visualHookArchetype } : {}),
      },
      provider,
      ...(styleContext ? { styleContext } : {}),
    });
    const generated = await generateImage({
      prompt: compiledPrompt.prompt,
      provider,
      promptMetadata: {
        templateId: compiledPrompt.templateId,
        templateVersion: compiledPrompt.templateVersion,
      },
    });
    const finalPath = sceneImagePath(scene.projectId, scene.id, asset.id);
    const file = await writeAssetFile(handlerEnv.LOCAL_ASSET_ROOT, finalPath, generated.bytes);

    await markAssetReady(db, asset.id, {
      path: finalPath,
      mimeType: generated.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.checksum,
      provider: generated.provider,
      model: generated.model,
    });
    assetReady = true;

    const promptVersion = await insertPromptVersion(db, {
      projectId: scene.projectId,
      sceneId: scene.id,
      purpose: "image_prompt",
      provider: generated.provider,
      model: generated.model,
      promptPayload: promptPayload(compiledPrompt, {
        projectId: project.id,
        sceneId: scene.id,
        imagePrompt: scene.imagePrompt,
        visualBrief: visualBrief ?? null,
        visualHookArchetype: visualHookArchetype ?? null,
      }),
      responseMetadata: generated.responseMetadata,
    });

    await markJobSucceeded(db, job.id, {
      assetId: asset.id,
      promptVersionId: promptVersion.id,
    });
  } catch (error) {
    if (asset && !assetReady) {
      await markAssetFailed(db, asset.id, errorMessage(error));
    }

    throw error;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
