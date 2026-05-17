import type {
  CreateProjectRequest,
  Job,
  Project,
  ProjectDetailResponse,
} from "@short-workflow/shared";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { apiFetch } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";

const ACTIVE_JOB_STATUSES = new Set<Job["status"]>(["pending", "processing"]);

function isActiveJob(job: Job) {
  return ACTIVE_JOB_STATUSES.has(job.status);
}

function invalidateProjectWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.projects.detail(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.projects.scenes(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.projects.assets(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.projects.renders(projectId),
  });
  void queryClient.invalidateQueries({
    queryKey: [...queryKeys.projects.detail(projectId), "jobs"],
  });
}

export function useProjectsQuery() {
  return useQuery({
    queryFn: () => apiFetch<Project[]>("/projects"),
    queryKey: queryKeys.projects.all,
  });
}

export function useProjectQuery(projectId: string) {
  return useQuery({
    enabled: projectId.length > 0,
    queryFn: () => apiFetch<ProjectDetailResponse>(`/projects/${projectId}`),
    queryKey: queryKeys.projects.detail(projectId),
  });
}

export function useProjectJobsQuery(
  projectId: string,
  status?: "active",
) {
  const queryClient = useQueryClient();
  const previousActiveCount = useRef<number | null>(null);
  const search = status === "active" ? "?status=active" : "";
  const query = useQuery({
    enabled: projectId.length > 0,
    queryFn: () => apiFetch<Job[]>(`/projects/${projectId}/jobs${search}`),
    queryKey: queryKeys.projects.jobs(projectId, status),
    refetchInterval: (queryState) => {
      const jobs = queryState.state.data;

      if (!jobs?.some(isActiveJob)) {
        return false;
      }

      return 2_000;
    },
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }

    const activeCount = query.data.filter(isActiveJob).length;

    if (
      previousActiveCount.current !== null &&
      previousActiveCount.current > 0 &&
      activeCount === 0
    ) {
      invalidateProjectWorkflow(queryClient, projectId);
    }

    previousActiveCount.current = activeCount;
  }, [projectId, query.data, queryClient]);

  return query;
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectRequest) =>
      apiFetch<Project>("/projects", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useGenerateScriptMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/${projectId}/generate-script`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useGenerateSceneImageMutation(
  projectId: string,
  sceneId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/scenes/${sceneId}/generate-image`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useGenerateSceneAudioMutation(
  projectId: string,
  sceneId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/scenes/${sceneId}/generate-audio`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useRenderProjectMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/${projectId}/render`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}
