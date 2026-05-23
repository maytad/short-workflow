import type {
  YoutubeAnalyticsDashboardResponse,
  YoutubeAnalyticsVideoSummary,
} from "@short-workflow/shared";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  RefreshCw,
  ShieldAlert,
  VideoOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { useStartYoutubeAuthMutation } from "../projects/hooks";
import { AnalyticsDetailPanel } from "./AnalyticsDetailPanel";
import { AnalyticsTable } from "./AnalyticsTable";
import { analyticsErrorMessage, isReconnectError } from "./analyticsErrors";
import { formatDateTime, formatMetric, formatPercent } from "./analyticsFormat";
import { isNewVideo, isPublicVideo, isWinnerVideo, needsAction } from "./analyticsInsights";
import {
  useAnalyzeYoutubeVideoMutation,
  useRefreshYoutubeAnalyticsMutation,
  useYoutubeAnalyticsQuery,
} from "./hooks";

const ANALYTICS_WINDOW_DAYS = 30;
const SUMMARY_SKELETON_KEYS = ["public", "views", "median", "average"];
const TABLE_SKELETON_KEYS = ["one", "two", "three", "four", "five", "six"];
const PANEL_SKELETON_KEYS = ["views", "hour", "average", "likes"];

type AnalyticsView = "needs_action" | "winners" | "new" | "all_public" | "all_uploads";

type ViewOption = {
  description: string;
  id: AnalyticsView;
  label: string;
};

const VIEW_OPTIONS: ViewOption[] = [
  {
    description: "Public videos with weak hold, low exposure, or unclear scale.",
    id: "needs_action",
    label: "Needs action",
  },
  {
    description: "Public videos that beat the current baseline.",
    id: "winners",
    label: "Winners",
  },
  {
    description: "Public videos that are still too early to judge.",
    id: "new",
    label: "New",
  },
  {
    description: "Every public video in the analytics window.",
    id: "all_public",
    label: "All public",
  },
  {
    description: "Public, private, and scheduled rows discovered from the channel.",
    id: "all_uploads",
    label: "All uploads",
  },
];

export function AnalyticsDashboard() {
  const analyticsQuery = useYoutubeAnalyticsQuery(ANALYTICS_WINDOW_DAYS);
  const refreshMutation = useRefreshYoutubeAnalyticsMutation(ANALYTICS_WINDOW_DAYS);
  const analyzeMutation = useAnalyzeYoutubeVideoMutation(ANALYTICS_WINDOW_DAYS);
  const startYoutubeAuthMutation = useStartYoutubeAuthMutation();
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<AnalyticsView | null>(null);

  const dashboard = analyticsQuery.data;
  const model = useMemo(() => buildDashboardModel(dashboard), [dashboard]);
  const activeView = selectedView ?? model.defaultView;
  const visibleVideos = model.videosByView[activeView];
  const selectedVideo = useMemo(
    () => selectVideo(visibleVideos, selectedVideoId),
    [selectedVideoId, visibleVideos],
  );
  const reconnectRequired =
    isReconnectError(analyticsQuery.error) ||
    isReconnectError(refreshMutation.error) ||
    Boolean(dashboard?.auth.reconnectRequired) ||
    Boolean(dashboard && (!dashboard.auth.connected || !dashboard.auth.hasRequiredScopes));

  function handleSelectVideo(video: YoutubeAnalyticsVideoSummary) {
    setSelectedVideoId(video.link.youtubeVideoId);
  }

  function handleAnalyze(youtubeVideoId: string) {
    analyzeMutation.mutate(youtubeVideoId);
  }

  function handleReconnect() {
    const authWindow = window.open("", "_blank");

    startYoutubeAuthMutation.mutate(undefined, {
      onError: () => {
        authWindow?.close();
      },
      onSuccess: (response) => {
        if (authWindow && !authWindow.closed) {
          authWindow.opener = null;
          authWindow.location.assign(response.authUrl);
          return;
        }

        window.location.assign(response.authUrl);
      },
    });
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">YouTube analytics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-balance">
            Shorts analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Public videos drive the main decisions. Private and scheduled uploads stay available in
            All uploads for troubleshooting.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <StatusPill
            connected={Boolean(
              dashboard?.auth.connected && dashboard.auth.hasRequiredScopes && !reconnectRequired,
            )}
            lastRefresh={model.lastRefresh}
          />
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            disabled={refreshMutation.isPending}
            onClick={() => refreshMutation.mutate({ windowDays: ANALYTICS_WINDOW_DAYS })}
            type="button"
          >
            {refreshMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            {refreshMutation.isPending ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {reconnectRequired ? (
        <ReconnectBanner
          isPending={startYoutubeAuthMutation.isPending}
          onReconnect={handleReconnect}
        />
      ) : null}
      {refreshMutation.error ? (
        <InlineError message={analyticsErrorMessage("Refresh", refreshMutation.error)} />
      ) : null}
      {analyzeMutation.error ? (
        <InlineError message={analyticsErrorMessage("AI diagnosis", analyzeMutation.error)} />
      ) : null}
      {startYoutubeAuthMutation.error ? (
        <InlineError
          message={analyticsErrorMessage("YouTube reconnect", startYoutubeAuthMutation.error)}
        />
      ) : null}

      {analyticsQuery.isLoading ? (
        <AnalyticsSkeleton />
      ) : analyticsQuery.error && !dashboard ? (
        <InlineError message={analyticsErrorMessage("Load analytics", analyticsQuery.error)} />
      ) : !dashboard || dashboard.videos.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryStrip metrics={model.metrics} />
          <StudioMetricsNotice />
          <ViewControls
            activeView={activeView}
            counts={model.countsByView}
            onChange={setSelectedView}
          />
          {visibleVideos.length === 0 ? (
            <FilteredEmptyState
              activeView={activeView}
              onShowAll={() => setSelectedView("all_public")}
            />
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
              <AnalyticsTable
                analyzingVideoId={
                  analyzeMutation.isPending ? (analyzeMutation.variables ?? null) : null
                }
                onAnalyze={handleAnalyze}
                onSelectVideo={handleSelectVideo}
                selectedVideoId={selectedVideo?.link.youtubeVideoId ?? null}
                videos={visibleVideos}
              />
              <AnalyticsDetailPanel
                isAnalyzing={
                  analyzeMutation.isPending &&
                  analyzeMutation.variables === selectedVideo?.link.youtubeVideoId
                }
                onAnalyze={handleAnalyze}
                video={selectedVideo}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

function buildDashboardModel(dashboard: YoutubeAnalyticsDashboardResponse | undefined) {
  const videos = dashboard?.videos ?? [];
  const publicVideos = sortVideos(videos.filter(isPublicVideo));
  const allUploads = sortVideos(videos);
  const actionVideos = publicVideos.filter(needsAction);
  const winnerVideos = publicVideos.filter(isWinnerVideo);
  const newVideos = publicVideos.filter(isNewVideo);
  const videosByView: Record<AnalyticsView, YoutubeAnalyticsVideoSummary[]> = {
    needs_action: actionVideos,
    winners: winnerVideos,
    new: newVideos,
    all_public: publicVideos,
    all_uploads: allUploads,
  };
  const metrics = summarizeVideos(publicVideos, videos);

  return {
    countsByView: {
      needs_action: actionVideos.length,
      winners: winnerVideos.length,
      new: newVideos.length,
      all_public: publicVideos.length,
      all_uploads: allUploads.length,
    },
    defaultView: actionVideos.length > 0 ? ("needs_action" as const) : ("all_public" as const),
    lastRefresh: metrics.lastRefresh,
    metrics,
    videosByView,
  };
}

function sortVideos(videos: YoutubeAnalyticsVideoSummary[]) {
  return [...videos].sort((left, right) => {
    const rightTime = right.link.publishedAt ? new Date(right.link.publishedAt).getTime() : 0;
    const leftTime = left.link.publishedAt ? new Date(left.link.publishedAt).getTime() : 0;

    return rightTime - leftTime;
  });
}

function selectVideo(
  videos: YoutubeAnalyticsVideoSummary[],
  selectedVideoId: string | null,
): YoutubeAnalyticsVideoSummary | null {
  if (videos.length === 0) {
    return null;
  }

  return videos.find((video) => video.link.youtubeVideoId === selectedVideoId) ?? videos[0] ?? null;
}

function summarizeVideos(
  publicVideos: YoutubeAnalyticsVideoSummary[],
  allVideos: YoutubeAnalyticsVideoSummary[],
) {
  const views = publicVideos
    .map((video) => video.latestSnapshot?.views)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const averageViewed = publicVideos
    .map((video) => video.latestSnapshot?.averageViewPercentage)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const refreshTimes = allVideos
    .map((video) => video.link.lastSyncedAt)
    .filter((value): value is string => typeof value === "string")
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  return {
    allUploadCount: allVideos.length,
    lastRefresh: refreshTimes.length > 0 ? new Date(Math.max(...refreshTimes)).toISOString() : null,
    medianAverageViewPercentage: medianFromSortedNumbers(averageViewed),
    medianViews: medianFromSortedNumbers(views),
    privateOrScheduledCount: allVideos.length - publicVideos.length,
    publicCount: publicVideos.length,
    totalViews: views.reduce((sum, value) => sum + value, 0),
  };
}

function medianFromSortedNumbers(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const middleIndex = Math.floor(values.length / 2);
  const upper = values[middleIndex];

  if (upper === undefined) {
    return null;
  }

  if (values.length % 2 === 1) {
    return upper;
  }

  const lower = values[middleIndex - 1];

  return lower === undefined ? null : (lower + upper) / 2;
}

function SummaryStrip({ metrics }: { metrics: ReturnType<typeof summarizeVideos> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryMetric
        description={`${formatMetric(metrics.privateOrScheduledCount)} private or scheduled rows excluded`}
        icon={<Eye className="size-4" aria-hidden="true" />}
        label="Public videos"
        value={formatMetric(metrics.publicCount)}
      />
      <SummaryMetric
        description="Sum of public video views in this window"
        icon={<BarChart3 className="size-4" aria-hidden="true" />}
        label="Total views"
        value={formatMetric(metrics.totalViews)}
      />
      <SummaryMetric
        description="Public baseline for judging new uploads"
        icon={<Filter className="size-4" aria-hidden="true" />}
        label="Median views"
        value={formatMetric(metrics.medianViews)}
      />
      <SummaryMetric
        description="Retention proxy from YouTube Analytics API"
        icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
        label="Median avg viewed"
        value={formatPercent(metrics.medianAverageViewPercentage)}
      />
    </div>
  );
}

function SummaryMetric({
  description,
  icon,
  label,
  value,
}: {
  description: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <p>{label}</p>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold tracking-normal text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function ViewControls({
  activeView,
  counts,
  onChange,
}: {
  activeView: AnalyticsView;
  counts: Record<AnalyticsView, number>;
  onChange: (view: AnalyticsView) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
        Review queue
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {VIEW_OPTIONS.map((option) => {
          const selected = option.id === activeView;

          return (
            <button
              aria-pressed={selected}
              className={cn(
                "min-w-0 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px",
                selected
                  ? "border-primary/35 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              key={option.id}
              onClick={() => onChange(option.id)}
              type="button"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium">{option.label}</span>
                <span className="font-mono text-xs">{formatMetric(counts[option.id])}</span>
              </span>
              <span className="mt-1 block line-clamp-2 text-xs leading-5">
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({
  connected,
  lastRefresh,
}: {
  connected: boolean;
  lastRefresh: string | null;
}) {
  return (
    <div className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
      {connected ? (
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
      ) : (
        <EyeOff className="size-4 text-accent-foreground" aria-hidden="true" />
      )}
      <span>{connected ? "Connected" : "Needs reconnect"}</span>
      <span className="hidden text-muted-foreground sm:inline">
        {lastRefresh ? `Updated ${formatDateTime(lastRefresh)}` : "No refresh yet"}
      </span>
    </div>
  );
}

function StudioMetricsNotice() {
  return (
    <div className="rounded-lg border border-border bg-muted/45 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Studio-only Shorts metrics</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Shown in feed and How many chose to view are not imported yet. Keep using this page for
            public-only API metrics, then add those Studio values later through the planned manual
            or CSV import.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground">
          CSV import noted
        </span>
      </div>
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
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
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
    <div
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm shadow-sm"
      role="alert"
    >
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

function FilteredEmptyState({
  activeView,
  onShowAll,
}: {
  activeView: AnalyticsView;
  onShowAll: () => void;
}) {
  const option = VIEW_OPTIONS.find((item) => item.id === activeView);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <VideoOff className="size-4 text-muted-foreground" aria-hidden="true" />
        No videos in {option?.label ?? "this view"}
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
        This filter has no public rows right now. Switch back to All public to review the full
        decision set.
      </p>
      <button
        className="mt-4 inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px"
        onClick={onShowAll}
        type="button"
      >
        Show all public
      </button>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-label="Loading analytics…" role="status">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_SKELETON_KEYS.map((key) => (
          <div className="rounded-lg border border-border bg-card p-4 shadow-sm" key={key}>
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="mt-3 h-8 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="divide-y divide-border">
            {TABLE_SKELETON_KEYS.map((key) => (
              <div className="grid grid-cols-[minmax(0,1fr)_120px_120px] gap-4 p-4" key={key}>
                <div className="flex flex-col gap-2">
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
