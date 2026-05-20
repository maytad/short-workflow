import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";
import { BarChart3, FileJson, Lightbulb, MessageSquareText, Video } from "lucide-react";

import { formatDateTime, formatMetric, formatPercent, statusLabel } from "./analyticsFormat";

type AnalyticsDetailPanelProps = {
  video: YoutubeAnalyticsVideoSummary | null;
};

export function AnalyticsDetailPanel({ video }: AnalyticsDetailPanelProps) {
  if (!video) {
    return (
      <aside className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Video className="size-4 text-muted-foreground" aria-hidden="true" />
          Select a video
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose a table row to inspect metrics and diagnosis details.
        </p>
      </aside>
    );
  }

  const snapshot = video.latestSnapshot;
  const creativeContext = video.creativeContext;
  const aiDiagnosis = video.latestAiDiagnosis;
  const ruleDiagnosis = video.latestRuleDiagnosis;

  return (
    <aside className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
            Selected video
          </p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold tracking-normal">
            {video.link.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">{statusLabel(video.link.linkStatus)}</span>
            <span className="rounded bg-muted px-2 py-1">
              {formatDateTime(video.link.publishedAt)}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Metric label="Views" value={formatMetric(snapshot?.views)} />
          <Metric label="Views/hour" value={formatMetric(snapshot?.viewsPerHour)} />
          <Metric label="Avg viewed" value={formatPercent(snapshot?.averageViewPercentage)} />
          <Metric label="Likes" value={formatMetric(snapshot?.likes)} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />
          Rule diagnosis
        </div>
        {ruleDiagnosis ? (
          <DiagnosisBlock
            summary={ruleDiagnosis.summaryTh}
            metadata={ruleDiagnosis.suggestionsEn}
            timestamp={ruleDiagnosis.createdAt}
          />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No rule diagnosis is available.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" />
          AI diagnosis
        </div>
        {aiDiagnosis ? (
          <DiagnosisBlock
            summary={aiDiagnosis.summaryTh}
            metadata={aiDiagnosis.suggestionsEn}
            timestamp={aiDiagnosis.createdAt}
          />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No AI diagnosis has been created.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />
          Creative context
        </div>
        {creativeContext ? (
          <dl className="mt-3 space-y-3 text-sm">
            <DetailItem label="Project" value={creativeContext.projectTitle} />
            <DetailItem label="Topic" value={creativeContext.topic} />
            <DetailItem label="Appeal tier" value={creativeContext.appealTier} />
            <DetailItem label="Mechanism" value={creativeContext.mechanismFamily} />
            <DetailItem label="Visual hook" value={creativeContext.visualHookArchetype} />
            <DetailItem label="Hook caption" value={creativeContext.hookCaption} />
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No linked project context is available.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
          JSON metadata
        </div>
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-muted/55 p-3 text-xs leading-5 text-foreground">
          {JSON.stringify(
            {
              aiSuggestions: aiDiagnosis?.suggestionsEn ?? null,
              ruleSuggestions: ruleDiagnosis?.suggestionsEn ?? null,
              snapshot,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 leading-6 text-foreground">{value ?? "-"}</dd>
    </div>
  );
}

function DiagnosisBlock({
  metadata,
  summary,
  timestamp,
}: {
  metadata: Record<string, unknown>;
  summary: string;
  timestamp: string;
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm leading-6 text-foreground">{summary}</p>
      <p className="text-xs text-muted-foreground">Created {formatDateTime(timestamp)}</p>
      <pre className="max-h-48 overflow-auto rounded-md border border-border bg-muted/55 p-3 text-xs leading-5 text-foreground">
        {JSON.stringify(metadata, null, 2)}
      </pre>
    </div>
  );
}
