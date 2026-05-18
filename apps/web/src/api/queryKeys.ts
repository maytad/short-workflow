import type { Job } from "@short-workflow/shared";

type JobStatusFilter = "active" | Job["status"] | undefined;

export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    assets: (projectId: string) => [...queryKeys.projects.detail(projectId), "assets"] as const,
    detail: (projectId: string) => [...queryKeys.projects.all, projectId] as const,
    jobs: (projectId: string, status?: JobStatusFilter) =>
      [...queryKeys.projects.detail(projectId), "jobs", { status }] as const,
    renders: (projectId: string) => [...queryKeys.projects.detail(projectId), "renders"] as const,
    scenes: (projectId: string) => [...queryKeys.projects.detail(projectId), "scenes"] as const,
  },
  youtube: {
    authStatus: ["youtube", "auth-status"] as const,
  },
};
