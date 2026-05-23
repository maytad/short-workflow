import {
  encodeTinyMechanismsAiTopic,
  encodeTinyMechanismsTopic,
  generateEpisodeResearch,
  generateScript,
  getTinyMechanismsSeed,
  parseTinyMechanismsAiTopicSlug,
  parseTinyMechanismsSeedId,
  slugifyTinyMechanismsAiTopic,
  TINY_MECHANISMS_PENDING_TOPIC,
  TINY_MECHANISMS_PRESET_ID,
  tinyMechanismsProjectTitle,
  type GenerateScriptInput,
} from "@short-workflow/ai";
import {
  getProject,
  insertPromptVersion,
  listRecentYoutubeCreativePromptContext,
  markJobSucceeded,
  replaceProjectScenes,
  setProjectStatus,
  updateProject,
  withDbTransaction,
  type DbClient,
  type JobRow,
  type ProjectRow,
} from "@short-workflow/db";

type ScriptSetup = {
  titleFallback: string;
  topic: string;
  input: GenerateScriptInput;
};

function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

function resolveExplicitTinyMechanismsSeed(project: ProjectRow) {
  const aiTopicSlug = parseTinyMechanismsAiTopicSlug(project.topic);
  if (aiTopicSlug) {
    return null;
  }

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

  if (project.topic === TINY_MECHANISMS_PENDING_TOPIC || parsedSeedId === "pending") {
    return null;
  }

  throw new Error("unsupported_project_prompt_preset");
}

function buildLegacyScriptInput(project: ProjectRow): ScriptSetup | null {
  const seed = resolveExplicitTinyMechanismsSeed(project);
  if (!seed) {
    return null;
  }

  return {
    titleFallback: tinyMechanismsProjectTitle(seed),
    topic: encodeTinyMechanismsTopic(seed.seedId),
    input: {
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: seed.seedId,
      targetDurationSeconds: targetDurationSeconds(project.targetDurationSeconds),
    },
  };
}

async function buildPendingAiScriptInput(db: DbClient, project: ProjectRow): Promise<ScriptSetup> {
  if (project.topic !== TINY_MECHANISMS_PENDING_TOPIC) {
    throw new Error("unsupported_project_prompt_preset");
  }

  const targetDuration = targetDurationSeconds(project.targetDurationSeconds);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentVideos = await listRecentYoutubeCreativePromptContext(db, {
    limit: 12,
    since,
  });
  const research = await generateEpisodeResearch({
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    targetDurationSeconds: targetDuration,
    recentVideos,
  });
  const slug = slugifyTinyMechanismsAiTopic(research.selectedCandidate.objectOrMechanism);

  return {
    titleFallback: `Tiny Mechanisms: ${research.selectedCandidate.centralQuestion}`,
    topic: encodeTinyMechanismsAiTopic(slug),
    input: {
      channelPresetId: TINY_MECHANISMS_PRESET_ID,
      seedId: `ai:${slug}`,
      targetDurationSeconds: targetDuration,
      episodeCandidate: research.selectedCandidate,
      episodeResearch: research.research,
      episodeResearchPromptPayload: research.promptPayload,
      episodeResearchResponseMetadata: research.responseMetadata,
    },
  };
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
  const project = await getProject(db, projectId);
  if (!project) {
    throw new Error("project_not_found");
  }

  const legacySetup = buildLegacyScriptInput(project);
  const scriptSetup = legacySetup ?? (await buildPendingAiScriptInput(db, project));
  const script = await generateScript(scriptSetup.input);

  return withDbTransaction(db, async (tx) => {
    const promptVersion = await insertPromptVersion(tx, {
      projectId,
      sceneId: null,
      purpose: "script",
      provider: "openai",
      promptPayload: script.promptPayload,
      responseText: script.responseText,
      responseMetadata: script.responseMetadata,
    });
    const scenes = await replaceProjectScenes(tx, projectId, script.scenes);

    await updateProject(tx, projectId, {
      title: script.title || scriptSetup.titleFallback,
      topic: scriptSetup.topic,
    });
    await setProjectStatus(tx, projectId, "ready");

    const result: GenerateProjectScriptResult = {
      sceneIds: scenes.map((scene) => scene.id),
      promptVersionId: promptVersion.id,
      seedId: scriptSetup.input.seedId,
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
