import {
  EpisodeCandidateJudgeRejection,
  EpisodeCandidateRoleError,
  encodeTinyMechanismsAiTopic,
  encodeTinyMechanismsTopic,
  type GenerateScriptInput,
  generateEpisodeResearch,
  generateScript,
  getTinyMechanismsSeed,
  parseTinyMechanismsAiTopicSlug,
  parseTinyMechanismsSeedId,
  slugifyTinyMechanismsAiTopic,
  TINY_MECHANISMS_PENDING_TOPIC,
  TINY_MECHANISMS_PRESET_ID,
  TINY_MECHANISMS_TOPIC_PREFIX,
  tinyMechanismsProjectTitle,
} from "@short-workflow/ai";
import {
  type DbClient,
  getProject,
  insertPromptVersion,
  type JobRow,
  listProjects,
  markJobSucceeded,
  type ProjectRow,
  replaceProjectScenes,
  setProjectStatus,
  updateProject,
  withDbTransaction,
} from "@short-workflow/db";
import { TerminalWorkflowError } from "../errors";

type ScriptSetup = {
  titleFallback: string;
  topic: string;
  input: GenerateScriptInput;
};

type RecentTopicProject = Pick<ProjectRow, "id" | "title" | "topic" | "createdAt">;

const RECENT_LOCAL_TOPIC_LIMIT = 12;

function workflowFailureDetail(value: unknown, seen = new WeakSet<object>()): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    if (value instanceof Error) {
      const detail: Record<string, unknown> = {
        name: value.name,
        message: value.message,
      };
      if ("cause" in value) {
        detail.cause = workflowFailureDetail(value.cause, seen);
      }
      return detail;
    }

    if (Array.isArray(value)) {
      return value.map((item) => workflowFailureDetail(item, seen));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          workflowFailureDetail(item, seen),
        ]),
      );
    }
  }

  try {
    return String(value);
  } catch {
    return "[Unserializable]";
  }
}

function targetDurationSeconds(value: number): 30 | 45 | 60 {
  if (value === 30 || value === 45 || value === 60) {
    return value;
  }

  throw new Error("unsupported_target_duration");
}

function cleanRecentTopicPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildRecentLocalTopicLines(
  projects: readonly RecentTopicProject[],
  currentProjectId: string,
  limit = RECENT_LOCAL_TOPIC_LIMIT,
) {
  return [...projects]
    .filter((project) => project.id !== currentProjectId)
    .filter((project) => project.topic.startsWith(TINY_MECHANISMS_TOPIC_PREFIX))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, limit)
    .map((project) => {
      const title = cleanRecentTopicPart(project.title);
      const topic = cleanRecentTopicPart(project.topic);
      return `${title} - ${topic}`.slice(0, 220);
    });
}

async function listRecentLocalTopicLines(db: DbClient, currentProjectId: string) {
  const projects = await listProjects(db);
  return buildRecentLocalTopicLines(projects, currentProjectId);
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
  const recentLocalTopics = await listRecentLocalTopicLines(db, project.id);
  const research = await generateEpisodeResearch({
    channelPresetId: TINY_MECHANISMS_PRESET_ID,
    targetDurationSeconds: targetDuration,
    recentLocalTopics,
  }).catch((error: unknown) => {
    if (error instanceof EpisodeCandidateRoleError) {
      const reasonDetails = workflowFailureDetail(error.cause);

      throw new TerminalWorkflowError("candidate_generation_failed", {
        stage: "candidate_generation",
        failedRole: error.role,
        reason: "candidate role generation failed",
        reasonDetails,
      });
    }

    if (error instanceof EpisodeCandidateJudgeRejection) {
      throw new TerminalWorkflowError("candidate_judge_rejected", {
        stage: "candidate_judge",
        reason: error.judge.failureReason,
        thresholdSummary: error.judge.thresholdSummary,
        scoreTable: error.judge.scoreTable,
      });
    }

    throw error;
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
      refinedEpisodeBrief: research.refinedBrief,
      episodeResearch: {
        candidates: research.candidates,
        judge: research.judge,
      },
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
