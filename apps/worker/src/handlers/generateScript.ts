import { generateScript } from "@short-workflow/ai";
import {
  getProject,
  insertPromptVersion,
  markJobSucceeded,
  replaceProjectScenes,
  setProjectStatus,
  type DbClient,
  type JobRow,
} from "@short-workflow/db";

function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

export async function handleGenerateScript(db: DbClient, job: JobRow) {
  const project = await getProject(db, job.projectId);

  if (!project) {
    throw new Error("project_not_found");
  }

  const promptPayload = {
    topic: project.topic,
    targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
  };
  const script = await generateScript(promptPayload);
  const promptVersion = await insertPromptVersion(db, {
    projectId: project.id,
    sceneId: null,
    purpose: "script",
    provider: "openai",
    promptPayload,
    responseText: script.responseText,
    responseMetadata: script.responseMetadata,
  });
  const scenes = await replaceProjectScenes(db, project.id, script.scenes);

  await setProjectStatus(db, project.id, "ready");
  await markJobSucceeded(db, job.id, {
    sceneIds: scenes.map((scene) => scene.id),
    promptVersionId: promptVersion.id,
  });
}
