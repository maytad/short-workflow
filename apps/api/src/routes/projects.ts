import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  updateSceneRequestSchema,
} from "@short-workflow/shared";
import {
  acknowledgeRenderDisclosure,
  createJobIdempotent,
  createProject,
  getProject,
  getScene,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  listProjects,
  retryFailedJob,
  updateProject,
  updateScene,
  type DbClient,
} from "@short-workflow/db";
import { Elysia } from "elysia";

import { conflict, internalError, jsonError, notFound, validationFailed } from "../http";
import {
  assertProjectCanDelete,
  buildRenderPreconditionReport,
  deleteProjectLocalFiles,
  deleteProjectRows,
  getProjectDetail,
} from "../services/projects";
import { listProjectJobs } from "../services/jobs";

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
  getProject: typeof getProject;
  getScene: typeof getScene;
  updateScene: typeof updateScene;
  createJobIdempotent: typeof createJobIdempotent;
  retryFailedJob: typeof retryFailedJob;
  acknowledgeRenderDisclosure: typeof acknowledgeRenderDisclosure;
  buildRenderPreconditionReport: typeof buildRenderPreconditionReport;
};

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
  getProject,
  getScene,
  updateScene,
  createJobIdempotent,
  retryFailedJob,
  acknowledgeRenderDisclosure,
  buildRenderPreconditionReport,
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
        .post("/:projectId/generate-script", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const project = await services.getProject(db, projectId);

          if (!project) {
            return notFound(set);
          }

          return services.createJobIdempotent(db, {
            projectId: project.id,
            sceneId: null,
            type: "generate_script",
            input: { projectId: project.id },
          });
        })
        .post("/:projectId/render", async (context) => {
          const { db, params, set } = withRouteContext(context);
          const projectId = requireRouteParam(params.projectId, "projectId");
          const project = await services.getProject(db, projectId);

          if (!project) {
            return notFound(set);
          }

          const report = await services.buildRenderPreconditionReport(db, project.id);

          if (hasRenderPreconditionFailures(report)) {
            return jsonError(set, 422, "render_preconditions_failed", {
              details: report,
            });
          }

          return services.createJobIdempotent(db, {
            projectId: project.id,
            sceneId: null,
            type: "render_video",
            input: { projectId: project.id },
          });
        }),
    )
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

      return services.createJobIdempotent(db, {
        projectId: scene.projectId,
        sceneId: scene.id,
        type: "generate_scene_image",
        input: { projectId: scene.projectId, sceneId: scene.id },
      });
    })
    .post("/scenes/:sceneId/generate-audio", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const sceneId = requireRouteParam(params.sceneId, "sceneId");
      const scene = await services.getScene(db, sceneId);

      if (!scene) {
        return notFound(set);
      }

      return services.createJobIdempotent(db, {
        projectId: scene.projectId,
        sceneId: scene.id,
        type: "generate_scene_audio",
        input: { projectId: scene.projectId, sceneId: scene.id },
      });
    })
    .post("/jobs/:jobId/retry", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const jobId = requireRouteParam(params.jobId, "jobId");

      try {
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
