import {
  encodeTinyMechanismsTopic,
  generateScript,
  getTinyMechanismsSeed,
  parseTinyMechanismsSeedId,
  pickNextTinyMechanismsSeed,
  TINY_MECHANISMS_PENDING_TOPIC,
  TINY_MECHANISMS_PRESET_ID,
  tinyMechanismsProjectTitle,
} from "@short-workflow/ai";
import {
  getProject,
  insertPromptVersion,
  listProjects,
  markJobSucceeded,
  replaceProjectScenes,
  setProjectStatus,
  updateProject,
  type DbClient,
  type JobRow,
  type ProjectRow,
} from "@short-workflow/db";

function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

async function resolveTinyMechanismsSeed(db: DbClient, project: ProjectRow) {
  const parsedSeedId = parseTinyMechanismsSeedId(project.topic);

  if (parsedSeedId && parsedSeedId !== "pending") {
    const existingSeed = getTinyMechanismsSeed(parsedSeedId);
    if (!existingSeed) {
      throw new Error("tiny_mechanisms_seed_not_found");
    }

    return existingSeed;
  }

  if (project.topic !== TINY_MECHANISMS_PENDING_TOPIC && parsedSeedId === null) {
    throw new Error("unsupported_project_prompt_preset");
  }

  const projects = await listProjects(db);
  const usedSeedIds = projects
    .filter((candidate) => candidate.id !== project.id)
    .map((candidate) => parseTinyMechanismsSeedId(candidate.topic))
    .filter((seedId): seedId is string => Boolean(seedId && seedId !== "pending"));

  return pickNextTinyMechanismsSeed(usedSeedIds);
}

export async function handleGenerateScript(db: DbClient, job: JobRow) {
  const project = await getProject(db, job.projectId);

  if (!project) {
    throw new Error("project_not_found");
  }

  const seed = await resolveTinyMechanismsSeed(db, project);
  const scriptInput = {
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    seedId: seed.seedId,
    targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
  };
  const script = await generateScript(scriptInput);
  const promptVersion = await insertPromptVersion(db, {
    projectId: project.id,
    sceneId: null,
    purpose: "script",
    provider: "openai",
    promptPayload: script.promptPayload,
    responseText: script.responseText,
    responseMetadata: script.responseMetadata,
  });
  const scenes = await replaceProjectScenes(db, project.id, script.scenes);

  await updateProject(db, project.id, {
    title: script.title || tinyMechanismsProjectTitle(seed),
    topic: encodeTinyMechanismsTopic(seed.seedId),
  });
  await setProjectStatus(db, project.id, "ready");
  await markJobSucceeded(db, job.id, {
    sceneIds: scenes.map((scene) => scene.id),
    promptVersionId: promptVersion.id,
    seedId: seed.seedId,
    channelPresetId: script.channelPresetId,
    metadataDraft: script.metadataDraft,
  });
}
