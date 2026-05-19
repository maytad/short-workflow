import type {
  BulkAssetQueueResponse,
  CreateProjectRequest,
  CreateTinyMechanismsProjectRequest,
  Job,
  Project,
  ProjectDetailResponse,
  Scene,
  UpdateSceneRequest,
  YoutubeAuthStartResponse,
  YoutubeAuthStatus,
  YoutubeUploadRequest,
  YoutubeUploadResponse,
} from "@short-workflow/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { apiFetch } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";

const ACTIVE_JOB_STATUSES = new Set<Job["status"]>(["pending", "processing"]);

export function isActiveJob(job: Job) {
  return ACTIVE_JOB_STATUSES.has(job.status);
}

export function hasActiveProjectFlowJob(activeJobs: Job[]) {
  return activeJobs.some((job) => job.type === "run_project_flow" && isActiveJob(job));
}

function invalidateProjectWorkflow(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.detail(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.scenes(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.assets(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.projects.renders(projectId),
    }),
    queryClient.invalidateQueries({
      queryKey: [...queryKeys.projects.detail(projectId), "jobs"],
    }),
  ]);
}

const SCENE_CONTENT_FIELDS = [
  "narration",
  "caption",
  "imagePrompt",
  "ssml",
  "durationSeconds",
] as const;

function hasSceneContentChange(scene: Scene, input: UpdateSceneRequest) {
  return SCENE_CONTENT_FIELDS.some(
    (field) => input[field] !== undefined && input[field] !== scene[field],
  );
}

export function applyOptimisticSceneUpdate(
  detail: ProjectDetailResponse,
  sceneId: string,
  input: UpdateSceneRequest,
  timestamp: string,
): ProjectDetailResponse {
  return {
    ...detail,
    scenes: detail.scenes.map((scene) => {
      if (scene.id !== sceneId) {
        return scene;
      }

      const contentChanged = hasSceneContentChange(scene, input);
      const updatedScene: Scene = {
        ...scene,
        ...(contentChanged
          ? {
              contentUpdatedAt: timestamp,
              updatedAt: timestamp,
            }
          : {}),
      };

      if (input.narration !== undefined) {
        updatedScene.narration = input.narration;
      }

      if (input.caption !== undefined) {
        updatedScene.caption = input.caption;
      }

      if (input.imagePrompt !== undefined) {
        updatedScene.imagePrompt = input.imagePrompt;
      }

      if (input.ssml !== undefined) {
        updatedScene.ssml = input.ssml;
      }

      if (input.durationSeconds !== undefined) {
        updatedScene.durationSeconds = input.durationSeconds;
      }

      return updatedScene;
    }),
  };
}

function replaceScene(detail: ProjectDetailResponse, updatedScene: Scene): ProjectDetailResponse {
  return {
    ...detail,
    scenes: detail.scenes.map((scene) => (scene.id === updatedScene.id ? updatedScene : scene)),
  };
}

export function mergeActiveJobCache(currentJobs: Job[] | undefined, returnedJob: Job): Job[] {
  const jobs = currentJobs ?? [];

  if (jobs.some((job) => job.id === returnedJob.id)) {
    return jobs.map((job) => (job.id === returnedJob.id ? returnedJob : job));
  }

  return [...jobs, returnedJob];
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

export function useProjectJobsQuery(projectId: string, status?: "active") {
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

export function useYoutubeAuthStatusQuery(enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => apiFetch<YoutubeAuthStatus>("/youtube/auth/status"),
    queryKey: queryKeys.youtube.authStatus,
  });
}

export function useStartYoutubeAuthMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<YoutubeAuthStartResponse>("/youtube/auth/start", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.youtube.authStatus });
    },
  });
}

export function useDisconnectYoutubeMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<{ disconnected: true }>("/youtube/auth/disconnect", {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.youtube.authStatus });
    },
  });
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

export function useCreateTinyMechanismsProjectMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTinyMechanismsProjectRequest) =>
      apiFetch<Project>("/projects/tiny-mechanisms", {
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

export function useRunProjectFlowMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/projects/${projectId}/run-flow`, {
        method: "POST",
      }),
    onSuccess: async (job) => {
      queryClient.setQueryData<Job[]>(queryKeys.projects.jobs(projectId, "active"), (jobs) =>
        mergeActiveJobCache(jobs, job),
      );
      await invalidateProjectWorkflow(queryClient, projectId);
    },
  });
}

export function useGenerateSceneImageMutation(projectId: string, sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/scenes/${sceneId}/generate-image`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useGenerateSceneAudioMutation(projectId: string, sceneId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<Job>(`/scenes/${sceneId}/generate-audio`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useGenerateProjectAssetsMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<BulkAssetQueueResponse>(`/projects/${projectId}/generate-assets`, {
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useUpdateSceneMutation(projectId: string, sceneId: string) {
  const queryClient = useQueryClient();
  const detailQueryKey = queryKeys.projects.detail(projectId);

  return useMutation({
    mutationFn: (input: UpdateSceneRequest) =>
      apiFetch<Scene>(`/scenes/${sceneId}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: detailQueryKey });
      const previousDetail = queryClient.getQueryData<ProjectDetailResponse>(detailQueryKey);

      if (previousDetail) {
        queryClient.setQueryData<ProjectDetailResponse>(
          detailQueryKey,
          applyOptimisticSceneUpdate(previousDetail, sceneId, input, new Date().toISOString()),
        );
      }

      return { previousDetail };
    },
    onError: (_error, _input, context) => {
      if (context?.previousDetail) {
        queryClient.setQueryData(detailQueryKey, context.previousDetail);
      }
    },
    onSuccess: (updatedScene) => {
      queryClient.setQueryData<ProjectDetailResponse>(detailQueryKey, (detail) =>
        detail ? replaceScene(detail, updatedScene) : detail,
      );
      invalidateProjectWorkflow(queryClient, projectId);
    },
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

export function useUploadYoutubeMutation(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: YoutubeUploadRequest) =>
      apiFetch<YoutubeUploadResponse>(`/projects/${projectId}/youtube-upload`, {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => invalidateProjectWorkflow(queryClient, projectId),
  });
}

export function useRevealAssetMutation() {
  return useMutation({
    mutationFn: (assetId: string) =>
      apiFetch<{ revealed: true }>(`/assets/${assetId}/reveal`, {
        method: "POST",
      }),
  });
}
