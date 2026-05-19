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
  withAdvisoryTransactionLock,
  withDbTransaction,
  type DbClient,
  type JobRow,
  type ProjectRow,
} from "@short-workflow/db";

const TINY_MECHANISMS_SEED_LOCK_KEY = "short_workflow:tiny_mechanisms_seed";

function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

async function resolveTinyMechanismsSeed(db: DbClient, project: ProjectRow) {
  const parsedSeedId = parseTinyMechanismsSeedId(project.topic);

  if (parsedSeedId === "") {
    throw new Error("tiny_mechanisms_seed_not_found");
  }

  if (parsedSeedId !== null && parsedSeedId !== "pending") {
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

async function reserveTinyMechanismsSeed(db: DbClient, projectId: string) {
  return withAdvisoryTransactionLock(db, TINY_MECHANISMS_SEED_LOCK_KEY, async (tx) => {
    const project = await getProject(tx, projectId);

    if (!project) {
      throw new Error("project_not_found");
    }

    const seed = await resolveTinyMechanismsSeed(tx, project);
    const reservedTopic = encodeTinyMechanismsTopic(seed.seedId);

    const reservedProject =
      project.topic === reservedTopic
        ? project
        : await updateProject(tx, project.id, {
            topic: reservedTopic,
          });

    if (!reservedProject) {
      throw new Error("project_update_failed");
    }

    return { project: reservedProject, seed };
  });
}

export type GenerateProjectScriptResult = {
  sceneIds: string[];
  promptVersionId: string;
  seedId: string;
  channelPresetId: string;
  metadataDraft: unknown;
};

export async function generateProjectScript(
  db: DbClient,
  projectId: string,
  options: { jobId?: string } = {},
): Promise<GenerateProjectScriptResult> {
  const { project, seed } = await reserveTinyMechanismsSeed(db, projectId);
  const scriptInput = {
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    seedId: seed.seedId,
    targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
  };
  const script = await generateScript(scriptInput);

  return withDbTransaction(db, async (tx) => {
    const promptVersion = await insertPromptVersion(tx, {
      projectId: project.id,
      sceneId: null,
      purpose: "script",
      provider: "openai",
      promptPayload: script.promptPayload,
      responseText: script.responseText,
      responseMetadata: script.responseMetadata,
    });
    const scenes = await replaceProjectScenes(tx, project.id, script.scenes);

    await updateProject(tx, project.id, {
      title: script.title || tinyMechanismsProjectTitle(seed),
      topic: encodeTinyMechanismsTopic(seed.seedId),
    });
    await setProjectStatus(tx, project.id, "ready");

    const result: GenerateProjectScriptResult = {
      sceneIds: scenes.map((scene) => scene.id),
      promptVersionId: promptVersion.id,
      seedId: seed.seedId,
      channelPresetId: script.channelPresetId,
      metadataDraft: script.metadataDraft,
    };

    if (options.jobId) {
      await markJobSucceeded(tx, options.jobId, result);
    }

    return result;
  });
}

export async function handleGenerateScript(db: DbClient, job: JobRow) {
  await generateProjectScript(db, job.projectId, { jobId: job.id });
}
