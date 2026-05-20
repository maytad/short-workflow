import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";
import { AlertTriangle, Brain, CheckCircle2, Clock3, MousePointer2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { formatDateTime, formatMetric, formatPercent } from "./analyticsFormat";

type AnalyticsTableProps = {
  analyzingVideoId: string | null;
  onAnalyze: (youtubeVideoId: string) => void;
  onSelectVideo: (video: YoutubeAnalyticsVideoSummary) => void;
  selectedVideoId: string | null;
  videos: YoutubeAnalyticsVideoSummary[];
};

export function AnalyticsTable({
  analyzingVideoId,
  onAnalyze,
  onSelectVideo,
  selectedVideoId,
  videos,
}: AnalyticsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/55 text-xs uppercase tracking-normal text-muted-foreground">
            <tr>
              <th className="w-[300px] px-4 py-3 font-semibold">Video</th>
              <th className="px-4 py-3 font-semibold">Published</th>
              <th className="px-4 py-3 text-right font-semibold">Views</th>
              <th className="px-4 py-3 text-right font-semibold">Views/hour</th>
              <th className="px-4 py-3 text-right font-semibold">Avg viewed %</th>
              <th className="px-4 py-3 text-right font-semibold">Likes</th>
              <th className="w-[220px] px-4 py-3 font-semibold">Rule diagnosis</th>
              <th className="w-[190px] px-4 py-3 font-semibold">AI status/action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {videos.map((video) => {
              const isSelected = video.link.youtubeVideoId === selectedVideoId;
              const isAnalyzing = analyzingVideoId === video.link.youtubeVideoId;
              const hasSnapshot = Boolean(video.latestSnapshot);
              const hasAiDiagnosis = Boolean(video.latestAiDiagnosis);
              const analyzeDisabled = !hasSnapshot || Boolean(analyzingVideoId) || hasAiDiagnosis;

              return (
                <tr
                  className={cn(
                    "transition-colors",
                    isSelected ? "bg-muted/45" : "hover:bg-muted/30",
                  )}
                  key={video.link.youtubeVideoId}
                >
                  <td className="px-4 py-3 align-top">
                    <button
                      aria-pressed={isSelected}
                      className="group flex w-full min-w-0 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => onSelectVideo(video)}
                      type="button"
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground",
                          isSelected && "border-primary/30 bg-primary/10 text-primary",
                        )}
                      >
                        <MousePointer2 className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground group-hover:text-primary">
                          {video.link.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {video.link.youtubeVideoId}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top text-muted-foreground">
                    {formatDateTime(video.link.publishedAt)}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-mono text-foreground">
                    {formatMetric(video.latestSnapshot?.views)}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-mono text-foreground">
                    {formatMetric(video.latestSnapshot?.viewsPerHour)}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-mono text-foreground">
                    {formatPercent(video.latestSnapshot?.averageViewPercentage)}
                  </td>
                  <td className="px-4 py-3 text-right align-top font-mono text-foreground">
                    {formatMetric(video.latestSnapshot?.likes)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {video.latestRuleDiagnosis ? (
                      <div className="flex items-start gap-2 text-sm">
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-accent-foreground"
                          aria-hidden="true"
                        />
                        <span className="line-clamp-2 text-foreground">
                          {video.latestRuleDiagnosis.summaryTh}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No rule result</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {hasAiDiagnosis ? (
                      <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground">
                        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                        Diagnosed
                      </span>
                    ) : (
                      <button
                        aria-label={`Analyze ${video.link.title}`}
                        className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={analyzeDisabled}
                        onClick={() => onAnalyze(video.link.youtubeVideoId)}
                        type="button"
                      >
                        {isAnalyzing ? (
                          <Clock3 className="size-4" aria-hidden="true" />
                        ) : (
                          <Brain className="size-4" aria-hidden="true" />
                        )}
                        {isAnalyzing ? "Analyzing" : hasSnapshot ? "Analyze" : "No snapshot"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
