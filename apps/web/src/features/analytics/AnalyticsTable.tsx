import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";
import { Brain, CheckCircle2, Clock3, MousePointer2 } from "lucide-react";

import { cn } from "../../lib/utils";
import { formatAge, formatDateTime, formatMetric, formatPercent } from "./analyticsFormat";
import { nextAction, videoSignal } from "./analyticsInsights";

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
    <section className="min-w-0 rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Decision queue</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a row to inspect the likely cause and next prompt change.
        </p>
      </div>

      <div className="md:hidden">
        <div className="divide-y divide-border">
          {videos.map((video) => (
            <VideoCard
              analyzingVideoId={analyzingVideoId}
              key={video.link.youtubeVideoId}
              onAnalyze={onAnalyze}
              onSelectVideo={onSelectVideo}
              selectedVideoId={selectedVideoId}
              video={video}
            />
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="border-b border-border bg-muted/55 text-xs text-muted-foreground">
            <tr>
              <th className="w-[340px] px-4 py-3 font-semibold">Video</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Views</th>
              <th className="px-4 py-3 text-right font-semibold">Views/hour</th>
              <th className="px-4 py-3 text-right font-semibold">Avg viewed</th>
              <th className="w-[170px] px-4 py-3 font-semibold">Signal</th>
              <th className="w-[150px] px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {videos.map((video) => {
              const isSelected = video.link.youtubeVideoId === selectedVideoId;
              const signal = videoSignal(video);

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
                    <StatusStack video={video} />
                  </td>
                  <MetricCell value={formatMetric(video.latestSnapshot?.views)} />
                  <MetricCell value={formatMetric(video.latestSnapshot?.viewsPerHour)} />
                  <MetricCell value={formatPercent(video.latestSnapshot?.averageViewPercentage)} />
                  <td className="px-4 py-3 align-top">
                    <SignalBadge signal={signal} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <AnalyzeAction
                      analyzingVideoId={analyzingVideoId}
                      onAnalyze={onAnalyze}
                      video={video}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type VideoCardProps = {
  analyzingVideoId: string | null;
  onAnalyze: (youtubeVideoId: string) => void;
  onSelectVideo: (video: YoutubeAnalyticsVideoSummary) => void;
  selectedVideoId: string | null;
  video: YoutubeAnalyticsVideoSummary;
};

function VideoCard({
  analyzingVideoId,
  onAnalyze,
  onSelectVideo,
  selectedVideoId,
  video,
}: VideoCardProps) {
  const isSelected = video.link.youtubeVideoId === selectedVideoId;
  const signal = videoSignal(video);

  return (
    <article className={cn("p-4", isSelected && "bg-muted/45")}>
      <button
        aria-pressed={isSelected}
        className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={() => onSelectVideo(video)}
        type="button"
      >
        <span className="block line-clamp-2 font-medium text-foreground">{video.link.title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatDateTime(video.link.publishedAt)} / {formatAge(video.link.publishedAt)}
        </span>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <CompactMetric label="Views" value={formatMetric(video.latestSnapshot?.views)} />
        <CompactMetric label="VPH" value={formatMetric(video.latestSnapshot?.viewsPerHour)} />
        <CompactMetric
          label="Avg"
          value={formatPercent(video.latestSnapshot?.averageViewPercentage)}
        />
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <SignalBadge signal={signal} />
        <p className="text-xs leading-5 text-muted-foreground">{nextAction(video)}</p>
        <AnalyzeAction analyzingVideoId={analyzingVideoId} onAnalyze={onAnalyze} video={video} />
      </div>
    </article>
  );
}

function StatusStack({ video }: { video: YoutubeAnalyticsVideoSummary }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="capitalize text-foreground">{video.link.privacyStatus ?? "unknown"}</span>
      <span className="text-xs text-muted-foreground">{formatAge(video.link.publishedAt)} old</span>
    </div>
  );
}

function MetricCell({ value }: { value: string }) {
  return <td className="px-4 py-3 text-right align-top font-mono text-foreground">{value}</td>;
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SignalBadge({ signal }: { signal: ReturnType<typeof videoSignal> }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-md border px-2 py-1 text-xs font-medium",
        signal.tone === "attention" && "border-accent/25 bg-accent/10 text-accent-foreground",
        signal.tone === "winner" && "border-primary/25 bg-primary/10 text-primary",
        signal.tone === "new" && "border-border bg-muted text-muted-foreground",
        signal.tone === "neutral" && "border-border bg-background text-muted-foreground",
        signal.tone === "private" && "border-border bg-muted/70 text-muted-foreground",
      )}
      title={signal.description}
    >
      {signal.label}
    </span>
  );
}

function AnalyzeAction({
  analyzingVideoId,
  onAnalyze,
  video,
}: {
  analyzingVideoId: string | null;
  onAnalyze: (youtubeVideoId: string) => void;
  video: YoutubeAnalyticsVideoSummary;
}) {
  const isAnalyzing = analyzingVideoId === video.link.youtubeVideoId;
  const hasSnapshot = Boolean(video.latestSnapshot);
  const hasAiDiagnosis = Boolean(video.latestAiDiagnosis);
  const analyzeDisabled = !hasSnapshot || Boolean(analyzingVideoId) || hasAiDiagnosis;

  if (hasAiDiagnosis) {
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground">
        <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
        Diagnosed
      </span>
    );
  }

  return (
    <button
      aria-label={`Analyze ${video.link.title}`}
      className="inline-flex h-8 w-fit items-center justify-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      disabled={analyzeDisabled}
      onClick={() => onAnalyze(video.link.youtubeVideoId)}
      type="button"
    >
      {isAnalyzing ? (
        <Clock3 className="size-4" aria-hidden="true" />
      ) : (
        <Brain className="size-4" aria-hidden="true" />
      )}
      {isAnalyzing ? "Analyzing…" : hasSnapshot ? "Analyze" : "No snapshot"}
    </button>
  );
}
