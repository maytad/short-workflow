import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
} from "@short-workflow/shared";
import {
  createProject,
  listProjectAssets,
  listProjectRenders,
  listProjectScenes,
  listProjects,
  updateProject,
  type DbClient,
} from "@short-workflow/db";
import { Elysia } from "elysia";

import { conflict, internalError, notFound, validationFailed } from "../http";
import {
  assertProjectCanDelete,
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
    projectId: string;
  };
  query: {
    status?: string;
  };
};

function withRouteContext(context: unknown) {
  return context as RouteContext;
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
};

export function createProjectRoutes(
  services: ProjectRouteServices = defaultServices,
) {
  return new Elysia({ prefix: "/projects" })
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
      const detail = await services.getProjectDetail(db, params.projectId);

      if (!detail) {
        return notFound(set);
      }

      return detail;
    })
    .patch("/:projectId", (context) => {
      const { body, db, params, set } = withRouteContext(context);
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
        .updateProject(db, params.projectId, input)
        .then((project) => project ?? notFound(set));
    })
    .delete("/:projectId", async (context) => {
      const { db, params, set } = withRouteContext(context);
      const canDelete = await services.assertProjectCanDelete(
        db,
        params.projectId,
      );

      if (!canDelete) {
        return conflict(set, "project_has_active_jobs");
      }

      const deletedProject = await services.deleteProjectRows(
        db,
        params.projectId,
      );

      if (!deletedProject) {
        return notFound(set);
      }

      try {
        await services.deleteProjectLocalFiles(params.projectId);
      } catch {
        // Best-effort local cleanup must not mask successful DB deletion.
      }

      return { deleted: true };
    })
    .get("/:projectId/scenes", (context) => {
      const { db, params } = withRouteContext(context);
      return services.listProjectScenes(db, params.projectId);
    })
    .get("/:projectId/assets", (context) => {
      const { db, params } = withRouteContext(context);
      return services.listProjectAssets(db, params.projectId);
    })
    .get("/:projectId/renders", (context) => {
      const { db, params } = withRouteContext(context);
      return services.listProjectRenders(db, params.projectId);
    })
    .get("/:projectId/jobs", (context) => {
      const { db, params, query } = withRouteContext(context);
      return services.listProjectJobs(
        db,
        params.projectId,
        query.status === "active" ? "active" : undefined,
      );
    })
    .onError(({ set }) => internalError(set));
}

export const projectRoutes = createProjectRoutes();
