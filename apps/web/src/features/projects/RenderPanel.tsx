import type {
  Asset,
  Job,
  Render,
  RenderPreconditionError,
  YoutubeMetadata,
  YoutubeUploadSummary,
} from "@short-workflow/shared";
import { renderPreconditionErrorSchema } from "@short-workflow/shared";
import { AlertTriangle, Check, ExternalLink, Film, FolderOpen, Loader2, Youtube } from "lucide-react";
import { useState } from "react";

import { ApiError } from "../../api/client";
import { assetPreviewUrl } from "./assetUrls";
import { useRenderProjectMutation, useRevealAssetMutation } from "./hooks";
import { YoutubeUploadDialog } from "./YoutubeUploadDialog";

type RenderPanelProps = {
  activeJobs: Job[];
  assets: Asset[];
  projectId: string;
  renders: Render[];
  youtubeMetadata: YoutubeMetadata | null;
  youtubeUpload: YoutubeUploadSummary | null;
};

type CanUploadYoutubeInput = {
  activeUploadJob: Job | null | undefined;
  latestRender: Render | null | undefined;
  outputAsset: Asset | null | undefined;
  youtubeMetadata: YoutubeMetadata | null | undefined;
};

export function getRenderPreconditionMessages(error: RenderPreconditionError) {
  return [
    ...(error.details.projectHasNoScenes ? ["Add at least one scene before rendering."] : []),
    ...error.details.scenesNotReady.map((sceneId) => `Scene ${sceneId} is not ready.`),
    ...error.details.scenesMissingImage.map((sceneId) => `Scene ${sceneId} is missing image.`),
    ...error.details.scenesMissingAudio.map((sceneId) => `Scene ${sceneId} is missing audio.`),
    ...error.details.scenesStaleImage.map((sceneId) => `Scene ${sceneId} has stale image.`),
    ...error.details.scenesStaleAudio.map((sceneId) => `Scene ${sceneId} has stale audio.`),
  ];
}

function parseRenderPrecondition(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 422) {
    return null;
  }

  const parsed = renderPreconditionErrorSchema.safeParse(error.payload);
  return parsed.success ? parsed.data : null;
}

function getLatestRender(renders: Render[]) {
  return [...renders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
}

function getRenderOutputAsset(assets: Asset[], render: Render | undefined) {
  if (!render?.outputAssetId) {
    return null;
  }

  return (
    assets.find(
      (asset) =>
        asset.id === render.outputAssetId &&
        asset.kind === "render" &&
        asset.status === "ready" &&
        asset.storageDriver === "local",
    ) ?? null
  );
}

export function canUploadYoutube({
  activeUploadJob,
  latestRender,
  outputAsset,
  youtubeMetadata,
}: CanUploadYoutubeInput) {
  return (
    latestRender?.status === "succeeded" &&
    outputAsset !== null &&
    outputAsset !== undefined &&
    youtubeMetadata !== null &&
    youtubeMetadata !== undefined &&
    !activeUploadJob
  );
}

export function formatYoutubePublishTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "short",
    timeZone: timezone,
    year: "numeric",
  }).format(new Date(value));
}

export function RenderPanel({
  activeJobs,
  assets,
  projectId,
  renders,
  youtubeMetadata,
  youtubeUpload,
}: RenderPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const renderMutation = useRenderProjectMutation(projectId);
  const revealAsset = useRevealAssetMutation();
  const latestRender = getLatestRender(renders);
  const activeRenderJob = activeJobs.some(
    (job) =>
      job.type === "render_video" && (job.status === "pending" || job.status === "processing"),
  );
  const activeUploadJob =
    activeJobs.find(
      (job) =>
        job.type === "upload_youtube" && (job.status === "pending" || job.status === "processing"),
    ) ?? null;
  const preconditionError = parseRenderPrecondition(renderMutation.error);
  const outputAsset = getRenderOutputAsset(assets, latestRender);
  const uploadAllowed = canUploadYoutube({
    activeUploadJob,
    latestRender,
    outputAsset,
    youtubeMetadata,
  });
  const scheduledPublishLabel =
    youtubeUpload?.scheduledPublishAt && youtubeUpload.timezone
      ? formatYoutubePublishTime(youtubeUpload.scheduledPublishAt, youtubeUpload.timezone)
      : null;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Render</h2>
          <p className="text-sm text-muted-foreground">
            {latestRender ? `Latest: ${latestRender.status}` : "No render requested yet"}
          </p>
          {latestRender ? (
            <p className="text-xs text-muted-foreground">
              Rendered length: about {latestRender.durationSeconds}s
            </p>
          ) : null}
        </div>
        <Film className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-md border border-border bg-background p-3 text-sm">
        <input
          checked={acknowledged}
          className="mt-1 size-4"
          onChange={(event) => setAcknowledged(event.target.checked)}
          type="checkbox"
        />
        <span>
          I acknowledge this video uses AI-generated script, image, audio, or render assets.
        </span>
      </label>

      <button
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!acknowledged || renderMutation.isPending || activeRenderJob}
        onClick={() => renderMutation.mutate()}
        type="button"
      >
        {renderMutation.isPending || activeRenderJob ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
        {activeRenderJob ? "Rendering" : "Render video"}
      </button>

      {preconditionError ? (
        <div className="mt-3 rounded-md border border-accent/30 bg-accent/10 p-3 text-sm text-accent-foreground">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Resolve render requirements
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {getRenderPreconditionMessages(preconditionError).map((message) => (
              <li className="break-words" key={message}>
                {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {renderMutation.error && !preconditionError ? (
        <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
          Render could not be queued.
        </p>
      ) : null}

      {latestRender?.status === "succeeded" && outputAsset ? (
        <div className="mt-4 rounded-md border border-border bg-background p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Final preview</h3>
              <p className="text-xs text-muted-foreground">Rendered MP4 output</p>
            </div>
            <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              Ready
            </span>
          </div>

          <div className="mt-3 overflow-hidden rounded-md border border-border bg-muted">
            <video
              className="aspect-[9/16] max-h-[520px] w-full bg-muted object-contain"
              controls
              preload="metadata"
              src={assetPreviewUrl(outputAsset)}
            />
          </div>

          <div className="mt-3 grid gap-2">
            <p className="min-w-0 break-words text-xs text-muted-foreground">
              Output: <span className="font-medium text-foreground">{outputAsset.path}</span>
            </p>
            <div className="grid gap-2">
              <button
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                disabled={revealAsset.isPending}
                onClick={() => revealAsset.mutate(outputAsset.id)}
                type="button"
              >
                {revealAsset.isPending ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <FolderOpen className="size-4 shrink-0" aria-hidden="true" />
                )}
                <span className="whitespace-nowrap">Open folder</span>
              </button>

              {youtubeMetadata ? (
                <button
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!uploadAllowed}
                  onClick={() => setYoutubeDialogOpen(true)}
                  type="button"
                >
                  {activeUploadJob ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Youtube className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  <span className="whitespace-nowrap">
                    {activeUploadJob ? "Uploading to YouTube" : "Upload to YouTube"}
                  </span>
                </button>
              ) : null}
            </div>
          </div>

          {revealAsset.error ? (
            <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
              Folder could not be opened.
            </p>
          ) : null}

          {youtubeUpload ? (
            <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">
                  {youtubeUpload.mode === "scheduled_public"
                    ? "Scheduled public on YouTube"
                    : "Uploaded privately to YouTube"}
                </span>
                <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs capitalize text-muted-foreground">
                  {youtubeUpload.mode === "scheduled_public"
                    ? (youtubeUpload.scheduleStatus ?? "scheduled")
                    : (youtubeUpload.privacyStatus ?? "private")}
                </span>
              </div>
              {youtubeUpload.youtubeVideoId ? (
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  Video ID: {youtubeUpload.youtubeVideoId}
                </p>
              ) : null}
              {scheduledPublishLabel ? (
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  Publishes at {scheduledPublishLabel} {youtubeUpload.timezone}
                </p>
              ) : null}
              {youtubeUpload.youtubeStudioUrl ? (
                <a
                  className="mt-2 inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  href={youtubeUpload.youtubeStudioUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="truncate">Open in YouTube Studio</span>
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {youtubeDialogOpen && outputAsset && youtubeMetadata ? (
        <YoutubeUploadDialog
          metadata={youtubeMetadata}
          onClose={() => setYoutubeDialogOpen(false)}
          outputAsset={outputAsset}
          projectId={projectId}
        />
      ) : null}
    </section>
  );
}
