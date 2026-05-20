import {
  createProjectRequestSchema,
  createTinyMechanismsProjectRequestSchema,
  TINY_MECHANISMS_PENDING_TITLE,
  TINY_MECHANISMS_PENDING_TOPIC,
  updateProjectRequestSchema,
  updateSceneRequestSchema,
  youtubeUploadRequestSchema,
} from "@short-workflow/shared";
import {
  acknowledgeRenderDisclosure,
  attachYoutubeScheduleJob,
  createJobIdempotent,
  createProject,
  getAsset,
  getProject,
  getYoutubeScheduleForJob,
  getScene,
  getJob,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  listProjects,
  parseDailyPublishTimes,
  reserveNextYoutubeScheduleSlot,
  retryFailedJob,
  updateProject,
  updateScene,
  type DbClient,
  type JobRow,
  withAdvisoryTransactionLock,
} from "@short-workflow/db";
import { Elysia } from "elysia";

import { parseYoutubeScheduleEnv } from "../env";
import { conflict, internalError, jsonError, notFound, validationFailed } from "../http";
import {
  assertProjectCanDelete,
  buildRenderPreconditionReport,
  buildYoutubeUploadJobInput,
  deleteProjectLocalFiles,
  deleteProjectRows,
  getProjectDetail,
  queueProjectFullFlow,
  queueMissingProjectAssets,
  readAssetFile,
  revealAssetFile,
} from "../services/projects";
import { listProjectJobs } from "../services/jobs";
import { createYoutubeAuthServices } from "../services/youtubeAuth";

type StatusSetter = {
  status?: number | string;
};

type RouteContext = {
  db: DbClient;
  set: StatusSetter;
  body: unknown;
  params: {
    projectId?: string;
    sceneId?: string;
    jobId?: string;
    renderId?: string;
    assetId?: string;
  };
  query: {
    status?: string;
  };
};

function withRouteContext(context: unknown) {
  return context as RouteContext;
}

function requireRouteParam(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing route parameter: ${name}`);
  }

  return value;
}

export type ProjectRouteServices = {
  listProjects: typeof listProjects;
  createProject: typeof createProject;
  getProjectDetail: typeof getProjectDetail;
  updateProject: typeof updateProject;
  assertProjectCanDelete: typeof assertProjectCanDelete;
  deleteProjectRows: typeof deleteProjectRows;
  deleteProjectLocalFiles: typeof deleteProjectLocalFiles;
  listProjectScenes: typeof listProjectScenes;
  listProjectAssets: typeof listProjectAssets;
  listProjectRenders: typeof listProjectRenders;
  listProjectJobs: typeof listProjectJobs;
  getJob: typeof getJob;
  getProject: typeof getProject;
  getScene: typeof getScene;
  updateScene: typeof updateScene;
  createJobIdempotent: typeof createJobIdempotent;
  retryFailedJob: typeof retryFailedJob;
  acknowledgeRenderDisclosure: typeof acknowledgeRenderDisclosure;
  buildRenderPreconditionReport: typeof buildRenderPreconditionReport;
  buildYoutubeUploadJobInput: typeof buildYoutubeUploadJobInput;
  queueProjectFullFlow: typeof queueProjectFullFlow;
  queueMissingProjectAssets: typeof queueMissingProjectAssets;
  reserveNextYoutubeScheduleSlot: typeof reserveNextYoutubeScheduleSlot;
  attachYoutubeScheduleJob: typeof attachYoutubeScheduleJob;
  getYoutubeScheduleForJob: typeof getYoutubeScheduleForJob;
  getYoutubeAuthStatus?: ReturnType<typeof createYoutubeAuthServices>["getYoutubeAuthStatus"];
  getAsset?: typeof getAsset;
  readAssetFile?: typeof readAssetFile;
  revealAssetFile?: typeof revealAssetFile;
};

async function defaultYoutubeAuthStatus() {
  return createYoutubeAuthServices().getYoutubeAuthStatus();
}

const defaultServices: ProjectRouteServices = {
  listProjects,
  createProject,
  getProjectDetail,
  updateProject,
  assertProjectCanDelete,
  deleteProjectRows,
  deleteProjectLocalFiles,
  listProjectScenes,
  listProjectAssets,
  listProjectRenders,
  listProjectJobs,
  getJob,
  getProject,
  getScene,
  updateScene,
  createJobIdempotent,
  retryFailedJob,
  acknowledgeRenderDisclosure,
  buildRenderPreconditionReport,
  buildYoutubeUploadJobInput,
  queueProjectFullFlow,
  queueMissingProjectAssets,
  reserveNextYoutubeScheduleSlot,
  attachYoutubeScheduleJob,
  getYoutubeScheduleForJob,
  getYoutubeAuthStatus: defaultYoutubeAuthStatus,
  getAsset,
  readAssetFile,
  revealAssetFile,
};

function hasRenderPreconditionFailures(
  report: Awaited<ReturnType<typeof buildRenderPreconditionReport>>,
) {
  return (
    report.projectHasNoScenes ||
    report.scenesNotReady.length > 0 ||
    report.scenesMissingImage.length > 0 ||
    report.scenesMissingAudio.length > 0 ||
    report.scenesStaleImage.length > 0 ||
    report.scenesStaleAudio.length > 0
  );
}

async function hasActiveProjectFlowJob(
  db: DbClient,
  services: ProjectRouteServices,
  projectId: string,
) {
  const activeJobs = await services.listProjectJobs(db, projectId, "active");
  return activeJobs.some((job) => job.type === "run_project_flow");
}

const projectFlowRetryJobTypes = new Set<JobRow["type"]>([
  "run_project_flow",
  "generate_script",
  "generate_scene_image",
  "generate_scene_audio",
  "render_video",
]);

function retryWouldConflictWithActiveJobs(jobType: JobRow["type"], activeJobs: JobRow[]) {
  if (jobType === "run_project_flow") {
    return activeJobs.length > 0;
  }

  return activeJobs.some((activeJob) => activeJob.type === "run_project_flow");
}

function projectFlowLockKey(projectId: string) {
  return `project-flow:${projectId}`;
}

export function createProjectRoutes(services: ProjectRouteServices = defaultServices) {
  return new Elysia()
    .group("/projects", (projects) =>
      projects
        .get("/", (context) => {
          const { db } = withRouteContext(context);
          return services.listProjects(db);
        })
        .post("/", (context) => {
          const { body, db, set } = withRouteContext(context);
          const result = createProjectRequestSchema.safeParse(body);

          if (!result.success) {
            return validationFailed(set, result.error);
          }

          return services.createProject(db, result.data);
        })
        .post("/tiny-mechanisms", (context) => {
          const { body, db, set } = withRouteContext(context);
          const result = createTinyMechanismsProjectRequestSchema.safeParse(body ?? {});

          if (!result.success) {
            return validationFailed(set, result.error);
          }

          return services.createProject(db, {
            title: TINY_MECHANISMS_PENDING_TITLE,
            topic: TINY_MECHANISMS_PENDING_TOPIC,
            targetDurationSeconds: result.data.targetDurationSeconds,
          });
        })
        .get("/:projectId", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const detail = await services.getProjectDetail(db, projectId);

          if (!detail) {
            return notFound(set);
          }

          return detail;
        })
        .patch("/:projectId", (context) => {
          const { body, db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const result = updateProjectRequestSchema.safeParse(body);

          if (!result.success) {
            return validationFailed(set, result.error);
          }

          const input: Parameters<typeof updateProject>[2] = {};

          if (result.data.title !== undefined) {
            input.title = result.data.title;
          }

          if (result.data.topic !== undefined) {
            input.topic = result.data.topic;
          }

          return services
            .updateProject(db, projectId, input)
            .then((project) => project ?? notFound(set));
        })
        .delete("/:projectId", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const canDelete = await services.assertProjectCanDelete(db, projectId);

          if (!canDelete) {
            return conflict(set, "project_has_active_jobs");
          }

          const deletedProject = await services.deleteProjectRows(db, projectId);

          if (!deletedProject) {
            return notFound(set);
          }

          try {
            await services.deleteProjectLocalFiles(projectId);
          } catch {
            // Best-effort local cleanup must not mask successful DB deletion.
          }

          return { deleted: true };
        })
        .get("/:projectId/scenes", (context) => {
          const { db, params } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          return services.listProjectScenes(db, projectId);
        })
        .get("/:projectId/assets", (context) => {
          const { db, params } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          return services.listProjectAssets(db, projectId);
        })
        .get("/:projectId/renders", (context) => {
          const { db, params } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          return services.listProjectRenders(db, projectId);
        })
        .get("/:projectId/jobs", (context) => {
          const { db, params, query } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          return services.listProjectJobs(
            db,
            projectId,
            query.status === "active" ? "active" : undefined,
          );
        })
        .post("/:projectId/run-flow", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const result = await services.queueProjectFullFlow(db, projectId);

          switch (result.status) {
            case "queued":
              return result.job;
            case "not_found":
              return notFound(set);
            case "active_jobs":
              return conflict(set, "project_has_active_jobs");
            case "already_started":
              return conflict(set, "project_flow_already_started");
            default: {
              const exhaustiveResult: never = result;
              throw new Error(`unknown_project_flow_result:${exhaustiveResult}`);
            }
          }
        })
        .post("/:projectId/generate-script", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");

          return withAdvisoryTransactionLock(db, projectFlowLockKey(projectId), async (tx) => {
            const project = await services.getProject(tx, projectId);

            if (!project) {
              return notFound(set);
            }

            if (await hasActiveProjectFlowJob(tx, services, project.id)) {
              return conflict(set, "project_has_active_jobs");
            }

            return services.createJobIdempotent(tx, {
              projectId: project.id,
              sceneId: null,
              type: "generate_script",
              input: { projectId: project.id },
            });
          });
        })
        .post("/:projectId/generate-assets", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");

          return withAdvisoryTransactionLock(db, projectFlowLockKey(projectId), async (tx) => {
            const project = await services.getProject(tx, projectId);

            if (!project) {
              return notFound(set);
            }

            if (await hasActiveProjectFlowJob(tx, services, project.id)) {
              return conflict(set, "project_has_active_jobs");
            }

            try {
              return await services.queueMissingProjectAssets(tx, project.id);
            } catch (error) {
              if (error instanceof Error && error.message === "project_has_no_scenes") {
                return jsonError(set, 422, "project_has_no_scenes");
              }

              throw error;
            }
          });
        })
        .post("/:projectId/render", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");

          return withAdvisoryTransactionLock(db, projectFlowLockKey(projectId), async (tx) => {
            const project = await services.getProject(tx, projectId);

            if (!project) {
              return notFound(set);
            }

            if (await hasActiveProjectFlowJob(tx, services, project.id)) {
              return conflict(set, "project_has_active_jobs");
            }

            const report = await services.buildRenderPreconditionReport(tx, project.id);

            if (hasRenderPreconditionFailures(report)) {
              return jsonError(set, 422, "render_preconditions_failed", {
                details: report,
              });
            }

            return services.createJobIdempotent(tx, {
              projectId: project.id,
              sceneId: null,
              type: "render_video",
              input: { projectId: project.id },
            });
          });
        })
        .post("/:projectId/youtube-upload", async (context) => {
          const { body, db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const parsedBody = youtubeUploadRequestSchema.safeParse(body ?? {});

          if (!parsedBody.success) {
            return validationFailed(set, parsedBody.error);
          }

          const project = await services.getProject(db, projectId);

          if (!project) {
            return notFound(set);
          }

          try {
            return await withAdvisoryTransactionLock(
              db,
              `youtube-upload:${project.id}`,
              async (tx) => {
                const activeUploadJob = (
                  await services.listProjectJobs(tx, project.id, "active")
                ).find((job) => job.type === "upload_youtube");
                if (activeUploadJob) {
                  return {
                    job: activeUploadJob,
                    schedule: await services.getYoutubeScheduleForJob(tx, activeUploadJob.id),
                  };
                }

                const authStatus = await (
                  services.getYoutubeAuthStatus ?? defaultYoutubeAuthStatus
                )();
                if (!authStatus.connected) {
                  return conflict(set, "youtube_not_connected");
                }

                if (authStatus.reconnectRequired || !authStatus.hasRequiredScopes) {
                  return conflict(set, "youtube_reconnect_required");
                }

                const uploadInput = await services.buildYoutubeUploadJobInput(
                  tx,
                  project.id,
                  parsedBody.data.mode,
                );
                let schedule = null;
                let input: Record<string, unknown> = uploadInput;

                if (parsedBody.data.mode === "scheduled_public") {
                  const env = parseYoutubeScheduleEnv();
                  schedule = await services.reserveNextYoutubeScheduleSlot(tx, {
                    projectId: project.id,
                    renderId: uploadInput.renderId,
                    outputAssetId: uploadInput.outputAssetId,
                    now: new Date(),
                    timezone: env.YOUTUBE_SCHEDULE_TIMEZONE ?? "Asia/Bangkok",
                    dailyPublishTimes: parseDailyPublishTimes(
                      env.YOUTUBE_DAILY_PUBLISH_TIMES ?? "09:00,12:00,17:00,21:00",
                    ),
                    minLeadMinutes: env.YOUTUBE_SCHEDULE_MIN_LEAD_MINUTES ?? 30,
                  });
                  input = {
                    ...uploadInput,
                    mode: "scheduled_public",
                    scheduleId: schedule.id,
                    publishAt: schedule.scheduledPublishAt.toISOString(),
                  };
                }

                const job = await services.createJobIdempotent(tx, {
                  projectId: project.id,
                  sceneId: null,
                  type: "upload_youtube",
                  input,
                  maxAttempts: 1,
                });

                if (schedule) {
                  schedule = await services.attachYoutubeScheduleJob(tx, schedule.id, job.id);
                }

                return { job, schedule };
              },
            );
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.startsWith("youtube_upload_preconditions_failed")
            ) {
              return jsonError(set, 422, "youtube_upload_preconditions_failed");
            }

            if (error instanceof Error && error.message === "youtube_schedule_full") {
              return conflict(set, "youtube_schedule_full");
            }

            throw error;
          }
        }),
    )
    .get("/assets/:assetId/file", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const assetId = requireRouteParam(params.assetId, "assetId");
      const asset = await (services.getAsset ?? getAsset)(db, assetId);

      if (!asset || asset.status !== "ready" || asset.storageDriver !== "local") {
        return notFound(set);
      }

      try {
        const file = await (services.readAssetFile ?? readAssetFile)(asset);

        return new Response(file.bytes.slice().buffer, {
          headers: {
            "cache-control": "no-store",
            "content-type": file.mimeType,
          },
        });
      } catch {
        return notFound(set);
      }
    })
    .post("/assets/:assetId/reveal", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const assetId = requireRouteParam(params.assetId, "assetId");
      const asset = await (services.getAsset ?? getAsset)(db, assetId);

      if (
        !asset ||
        asset.kind !== "render" ||
        asset.status !== "ready" ||
        asset.storageDriver !== "local"
      ) {
        return notFound(set);
      }

      try {
        await (services.revealAssetFile ?? revealAssetFile)(asset);

        return { revealed: true };
      } catch (error) {
        if (error instanceof Error && error.message === "asset_reveal_unsupported_platform") {
          return conflict(set, "asset_reveal_unsupported_platform");
        }

        return notFound(set);
      }
    })
    .patch("/scenes/:sceneId", (context) => {
      const { body, db, params, set } = withRouteContext(context);
      const sceneId = requireRouteParam(params.sceneId, "sceneId");
      const result = updateSceneRequestSchema.safeParse(body);

      if (!result.success) {
        return validationFailed(set, result.error);
      }

      const input: Parameters<typeof updateScene>[2] = {};

      if (result.data.narration !== undefined) {
        input.narration = result.data.narration.trim();
      }

      if (result.data.caption !== undefined) {
        input.caption = result.data.caption.trim();
      }

      if (result.data.imagePrompt !== undefined) {
        input.imagePrompt = result.data.imagePrompt.trim();
      }

      if (result.data.ssml !== undefined) {
        input.ssml = result.data.ssml.trim();
      }

      if (result.data.durationSeconds !== undefined) {
        input.durationSeconds = result.data.durationSeconds;
      }

      return services.updateScene(db, sceneId, input).then((scene) => scene ?? notFound(set));
    })
    .post("/scenes/:sceneId/generate-image", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const sceneId = requireRouteParam(params.sceneId, "sceneId");
      const scene = await services.getScene(db, sceneId);

      if (!scene) {
        return notFound(set);
      }

      return withAdvisoryTransactionLock(db, projectFlowLockKey(scene.projectId), async (tx) => {
        const lockedScene = await services.getScene(tx, sceneId);

        if (!lockedScene) {
          return notFound(set);
        }

        if (await hasActiveProjectFlowJob(tx, services, lockedScene.projectId)) {
          return conflict(set, "project_has_active_jobs");
        }

        return services.createJobIdempotent(tx, {
          projectId: lockedScene.projectId,
          sceneId: lockedScene.id,
          type: "generate_scene_image",
          input: { projectId: lockedScene.projectId, sceneId: lockedScene.id },
        });
      });
    })
    .post("/scenes/:sceneId/generate-audio", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const sceneId = requireRouteParam(params.sceneId, "sceneId");
      const scene = await services.getScene(db, sceneId);

      if (!scene) {
        return notFound(set);
      }

      return withAdvisoryTransactionLock(db, projectFlowLockKey(scene.projectId), async (tx) => {
        const lockedScene = await services.getScene(tx, sceneId);

        if (!lockedScene) {
          return notFound(set);
        }

        if (await hasActiveProjectFlowJob(tx, services, lockedScene.projectId)) {
          return conflict(set, "project_has_active_jobs");
        }

        return services.createJobIdempotent(tx, {
          projectId: lockedScene.projectId,
          sceneId: lockedScene.id,
          type: "generate_scene_audio",
          input: { projectId: lockedScene.projectId, sceneId: lockedScene.id },
        });
      });
    })
    .post("/jobs/:jobId/retry", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const jobId = requireRouteParam(params.jobId, "jobId");

      try {
        const job = await services.getJob(db, jobId);

        if (job && projectFlowRetryJobTypes.has(job.type)) {
          return await withAdvisoryTransactionLock(
            db,
            projectFlowLockKey(job.projectId),
            async (tx) => {
              const lockedJob = await services.getJob(tx, jobId);

              if (!lockedJob || lockedJob.status !== "failed") {
                return await services.retryFailedJob(tx, jobId);
              }

              const activeJobs = await services.listProjectJobs(tx, lockedJob.projectId, "active");
              if (retryWouldConflictWithActiveJobs(lockedJob.type, activeJobs)) {
                return conflict(set, "project_has_active_jobs");
              }

              return await services.retryFailedJob(tx, jobId);
            },
          );
        }

        return await services.retryFailedJob(db, jobId);
      } catch (error) {
        if (error instanceof Error && error.message === "retry_requires_failed_job") {
          return conflict(set, "retry_requires_failed_job");
        }

        throw error;
      }
    })
    .post("/renders/:renderId/acknowledge", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const renderId = requireRouteParam(params.renderId, "renderId");
      const render = await services.acknowledgeRenderDisclosure(db, renderId);

      return render ?? notFound(set);
    })
    .onError(({ set }) => internalError(set));
}

export const projectRoutes = createProjectRoutes();
