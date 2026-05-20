import type {
  YoutubeAnalyticsDashboardResponse,
  YoutubeAnalyticsVideoSummary,
} from "@short-workflow/shared";
import { AlertCircle, Loader2, RefreshCw, ShieldAlert, VideoOff } from "lucide-react";
import { useMemo, useState } from "react";

import { ApiError } from "../../api/client";
import { useStartYoutubeAuthMutation } from "../projects/hooks";
import { formatMetric } from "./analyticsFormat";
import { AnalyticsDetailPanel } from "./AnalyticsDetailPanel";
import { AnalyticsTable } from "./AnalyticsTable";
import {
  useAnalyzeYoutubeVideoMutation,
  useRefreshYoutubeAnalyticsMutation,
  useYoutubeAnalyticsQuery,
} from "./hooks";

const ANALYTICS_WINDOW_DAYS = 30;
const RECONNECT_ERROR_CODES = new Set([
  "youtube_reconnect_required",
  "youtube_analytics_scope_missing",
  "youtube_token_missing",
  "youtube_token_invalid",
]);
const SUMMARY_SKELETON_KEYS = ["total", "median", "linked", "unlinked"];
const TABLE_SKELETON_KEYS = ["one", "two", "three", "four", "five", "six"];
const PANEL_SKELETON_KEYS = ["views", "hour", "average", "likes"];

export function AnalyticsDashboard() {
  const analyticsQuery = useYoutubeAnalyticsQuery(ANALYTICS_WINDOW_DAYS);
  const refreshMutation = useRefreshYoutubeAnalyticsMutation(ANALYTICS_WINDOW_DAYS);
  const analyzeMutation = useAnalyzeYoutubeVideoMutation(ANALYTICS_WINDOW_DAYS);
  const startYoutubeAuthMutation = useStartYoutubeAuthMutation();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const dashboard = analyticsQuery.data;
  const selectedVideo = useMemo(
    () => selectVideo(dashboard, selectedVideoId),
    [dashboard, selectedVideoId],
  );
  const metrics = useMemo(() => summarizeDashboard(dashboard), [dashboard]);
  const reconnectRequired =
    reconnectCodeFromError(analyticsQuery.error) !== null ||
    Boolean(dashboard?.auth.reconnectRequired) ||
    Boolean(dashboard && (!dashboard.auth.connected || !dashboard.auth.hasRequiredScopes));

  function handleSelectVideo(video: YoutubeAnalyticsVideoSummary) {
    setSelectedVideoId(video.link.youtubeVideoId);
  }

  function handleAnalyze(youtubeVideoId: string) {
    analyzeMutation.mutate(youtubeVideoId);
  }

  function handleReconnect() {
    startYoutubeAuthMutation.mutate(undefined, {
      onSuccess: (response) => {
        window.open(response.authUrl, "_blank", "noopener,noreferrer");
      },
    });
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">YouTube analytics</p>
          <h1 className="text-2xl font-semibold tracking-normal">Shorts performance</h1>
        </div>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          disabled={refreshMutation.isPending}
          onClick={() => refreshMutation.mutate({ windowDays: ANALYTICS_WINDOW_DAYS })}
          type="button"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          Refresh
        </button>
      </div>

      {reconnectRequired ? (
        <ReconnectBanner
          isPending={startYoutubeAuthMutation.isPending}
          onReconnect={handleReconnect}
        />
      ) : null}
      {refreshMutation.error ? (
        <InlineError message="Analytics refresh failed. Check the API logs and retry." />
      ) : null}
      {analyzeMutation.error ? (
        <InlineError message="AI diagnosis could not be started for this video." />
      ) : null}
      {startYoutubeAuthMutation.error ? (
        <InlineError message="YouTube reconnect could not be started." />
      ) : null}

      {analyticsQuery.isLoading ? (
        <AnalyticsSkeleton />
      ) : analyticsQuery.error && !dashboard ? (
        <InlineError message="Analytics could not be loaded. Check the API connection and YouTube access." />
      ) : !dashboard || dashboard.videos.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryStrip metrics={metrics} />
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <AnalyticsTable
              analyzingVideoId={
                analyzeMutation.isPending ? (analyzeMutation.variables ?? null) : null
              }
              onAnalyze={handleAnalyze}
              onSelectVideo={handleSelectVideo}
              selectedVideoId={selectedVideo?.link.youtubeVideoId ?? null}
              videos={dashboard.videos}
            />
            <AnalyticsDetailPanel video={selectedVideo} />
          </div>
        </>
      )}
    </section>
  );
}

function selectVideo(
  dashboard: YoutubeAnalyticsDashboardResponse | undefined,
  selectedVideoId: string | null,
): YoutubeAnalyticsVideoSummary | null {
  if (!dashboard || dashboard.videos.length === 0) {
    return null;
  }

  const fallbackVideo = dashboard.videos[0];

  return (
    dashboard.videos.find((video) => video.link.youtubeVideoId === selectedVideoId) ??
    fallbackVideo ??
    null
  );
}

function summarizeDashboard(dashboard: YoutubeAnalyticsDashboardResponse | undefined) {
  const videos = dashboard?.videos ?? [];
  const linkedVideos = videos.filter((video) => video.link.linkStatus === "linked");
  const views = videos
    .map((video) => video.latestSnapshot?.views)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const totalViews = views.reduce((sum, value) => sum + value, 0);
  const medianViews = medianFromSortedViews(views);

  return {
    linkedCount: linkedVideos.length,
    medianViews,
    notLinkedCount: videos.length - linkedVideos.length,
    totalViews,
  };
}

function medianFromSortedViews(views: number[]) {
  if (views.length === 0) {
    return null;
  }

  const middleIndex = Math.floor(views.length / 2);
  const upper = views[middleIndex];

  if (upper === undefined) {
    return null;
  }

  if (views.length % 2 === 1) {
    return upper;
  }

  const lower = views[middleIndex - 1];

  return lower === undefined ? null : (lower + upper) / 2;
}

function reconnectCodeFromError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return null;
  }

  if (
    typeof error.payload === "object" &&
    error.payload !== null &&
    "error" in error.payload &&
    typeof error.payload.error === "string" &&
    RECONNECT_ERROR_CODES.has(error.payload.error)
  ) {
    return error.payload.error;
  }

  return null;
}

function SummaryStrip({ metrics }: { metrics: ReturnType<typeof summarizeDashboard> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryMetric label="Total views" value={formatMetric(metrics.totalViews)} />
      <SummaryMetric label="Median views" value={formatMetric(metrics.medianViews)} />
      <SummaryMetric label="Linked videos" value={formatMetric(metrics.linkedCount)} />
      <SummaryMetric label="Not linked" value={formatMetric(metrics.notLinkedCount)} />
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function ReconnectBanner({
  isPending,
  onReconnect,
}: {
  isPending: boolean;
  onReconnect: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/30 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">YouTube connection needs attention.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reconnect YouTube with analytics access to refresh this dashboard.
          </p>
        </div>
      </div>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={onReconnect}
        type="button"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        Reconnect
      </button>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-sm">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-accent-foreground" aria-hidden="true" />
      <p className="text-foreground">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <VideoOff className="size-4 text-muted-foreground" aria-hidden="true" />
        No YouTube videos found
      </div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Upload or discover YouTube Shorts before reviewing analytics.
      </p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading analytics" role="status">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY_SKELETON_KEYS.map((key) => (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm" key={key}>
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {TABLE_SKELETON_KEYS.map((key) => (
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-4 p-4" key={key}>
                <div className="space-y-2">
                  <div className="h-4 w-56 max-w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 animate-pulse rounded bg-muted" />
                <div className="h-4 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {PANEL_SKELETON_KEYS.map((key) => (
              <div className="h-20 animate-pulse rounded-md bg-muted" key={key} />
            ))}
          </div>
          <div className="mt-5 h-32 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}
