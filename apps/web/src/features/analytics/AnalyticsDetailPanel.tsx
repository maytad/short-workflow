import type { YoutubeAnalyticsVideoSummary } from "@short-workflow/shared";
import {
  BarChart3,
  Brain,
  CheckCircle2,
  FileJson,
  Lightbulb,
  MessageSquareText,
  Video,
} from "lucide-react";
import type { ReactNode } from "react";

import { formatDateTime, formatMetric, formatPercent, statusLabel } from "./analyticsFormat";
import { nextAction, stringArrayField, videoSignal } from "./analyticsInsights";

type AnalyticsDetailPanelProps = {
  isAnalyzing: boolean;
  onAnalyze: (youtubeVideoId: string) => void;
  video: YoutubeAnalyticsVideoSummary | null;
};

export function AnalyticsDetailPanel({ isAnalyzing, onAnalyze, video }: AnalyticsDetailPanelProps) {
  if (!video) {
    return (
      <aside className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Video className="size-4 text-muted-foreground" aria-hidden="true" />
          Select a video
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose a row to inspect metrics, diagnosis, and concrete prompt changes.
        </p>
      </aside>
    );
  }

  const snapshot = video.latestSnapshot;
  const creativeContext = video.creativeContext;
  const aiDiagnosis = video.latestAiDiagnosis;
  const ruleDiagnosis = video.latestRuleDiagnosis;
  const aiSuggestions = aiDiagnosis?.suggestionsEn ?? {};
  const signal = videoSignal(video);
  const nextActions = stringArrayField(aiSuggestions.nextActionsTh);
  const titles = stringArrayField(aiSuggestions.suggestedTitleEn);
  const hooks = stringArrayField(aiSuggestions.suggestedHookEn);
  const visualPrompts = stringArrayField(aiSuggestions.suggestedVisualPromptEn);
  const metadataNotes = stringArrayField(aiSuggestions.metadataNotesEn);
  const likelyCause =
    typeof aiSuggestions.likelyCauseTh === "string"
      ? aiSuggestions.likelyCauseTh
      : signal.description;
  const canAnalyze = Boolean(snapshot) && !aiDiagnosis;

  return (
    <aside className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">Selected video</p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold tracking-normal">
            {video.link.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-2 py-1">{statusLabel(video.link.linkStatus)}</span>
            <span className="rounded bg-muted px-2 py-1">
              {video.link.privacyStatus ?? "unknown"}
            </span>
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

      <InsightSection
        icon={<BarChart3 className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="What happened"
      >
        <p className="text-sm leading-6 text-foreground">
          {snapshot
            ? `${formatMetric(snapshot.views)} views, ${formatMetric(
                snapshot.viewsPerHour,
              )} views/hour, and ${formatPercent(snapshot.averageViewPercentage)} average viewed.`
            : "No analytics snapshot exists yet. Refresh analytics before judging this video."}
        </p>
      </InsightSection>

      <InsightSection
        icon={<Lightbulb className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="Likely cause"
      >
        <p className="text-sm leading-6 text-foreground">{likelyCause}</p>
        {ruleDiagnosis ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{ruleDiagnosis.summaryTh}</p>
        ) : null}
      </InsightSection>

      <InsightSection
        icon={<CheckCircle2 className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="Next action"
      >
        {nextActions.length > 0 ? (
          <ActionList items={nextActions} />
        ) : (
          <p className="text-sm leading-6 text-foreground">{nextAction(video)}</p>
        )}
      </InsightSection>

      <InsightSection
        icon={<MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="Prompt & title fixes"
      >
        {titles.length + hooks.length + visualPrompts.length + metadataNotes.length > 0 ? (
          <div className="flex flex-col gap-3">
            <SuggestionGroup items={titles} label="Titles" />
            <SuggestionGroup items={hooks} label="Hooks" />
            <SuggestionGroup items={visualPrompts} label="Visual prompts" />
            <SuggestionGroup items={metadataNotes} label="Metadata notes" />
          </div>
        ) : (
          <dl className="flex flex-col gap-3 text-sm">
            <DetailItem label="Topic" value={creativeContext?.topic ?? null} />
            <DetailItem label="Hook caption" value={creativeContext?.hookCaption ?? null} />
            <DetailItem label="Visual hook" value={creativeContext?.visualHookArchetype ?? null} />
          </dl>
        )}
      </InsightSection>

      {canAnalyze ? (
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isAnalyzing}
          onClick={() => onAnalyze(video.link.youtubeVideoId)}
          type="button"
        >
          <Brain className="size-4" aria-hidden="true" />
          {isAnalyzing ? "Analyzing…" : "Run AI diagnosis"}
        </button>
      ) : null}

      <details className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <FileJson className="size-4 text-muted-foreground" aria-hidden="true" />
          JSON metadata
        </summary>
        <pre className="mt-3 max-h-64 overflow-auto rounded-md border border-border bg-muted/55 p-3 text-xs leading-5 text-foreground">
          {JSON.stringify(
            {
              aiSuggestions: aiDiagnosis?.suggestionsEn ?? null,
              creativeContext,
              ruleSuggestions: ruleDiagnosis?.suggestionsEn ?? null,
              snapshot,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </aside>
  );
}

function InsightSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </section>
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
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words leading-6 text-foreground">{value ?? "-"}</dd>
    </div>
  );
}

function ActionList({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-6 text-foreground">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function SuggestionGroup({ items, label }: { items: string[]; label: string }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ActionList items={items} />
    </div>
  );
}
