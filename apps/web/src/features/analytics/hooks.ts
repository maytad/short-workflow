import type {
  YoutubeAiDiagnosisResponse,
  YoutubeAnalyticsDashboardResponse,
  YoutubeAnalyticsRefreshRequest,
} from "@short-workflow/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";

export function useYoutubeAnalyticsQuery(windowDays = 30) {
  return useQuery({
    queryFn: () =>
      apiFetch<YoutubeAnalyticsDashboardResponse>(
        `/analytics/youtube?windowDays=${windowDays}`,
      ),
    queryKey: queryKeys.analytics.youtube(windowDays),
  });
}

export function useRefreshYoutubeAnalyticsMutation(windowDays = 30) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: YoutubeAnalyticsRefreshRequest = { windowDays }) =>
      apiFetch<YoutubeAnalyticsDashboardResponse>("/analytics/youtube/refresh", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.analytics.youtube(data.windowDays), data);
    },
  });
}

export function useAnalyzeYoutubeVideoMutation(windowDays = 30) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (youtubeVideoId: string) =>
      apiFetch<YoutubeAiDiagnosisResponse>(
        `/analytics/youtube/videos/${encodeURIComponent(youtubeVideoId)}/analyze`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.youtube(windowDays),
      });
    },
  });
}
