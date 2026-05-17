import type { Asset, Job, Render, RenderPreconditionError } from "@short-workflow/shared";
import { renderPreconditionErrorSchema } from "@short-workflow/shared";
import { AlertTriangle, Check, Film, Loader2 } from "lucide-react";
import { useState } from "react";

import { ApiError } from "../../api/client";
import { useRenderProjectMutation } from "./hooks";

type RenderPanelProps = {
  activeJobs: Job[];
  assets: Asset[];
  projectId: string;
  renders: Render[];
};

export function getRenderPreconditionMessages(
  error: RenderPreconditionError,
) {
  return [
    ...(error.details.projectHasNoScenes
      ? ["Add at least one scene before rendering."]
      : []),
    ...error.details.scenesNotReady.map((sceneId) => `Scene ${sceneId} is not ready.`),
    ...error.details.scenesMissingImage.map(
      (sceneId) => `Scene ${sceneId} is missing image.`,
    ),
    ...error.details.scenesMissingAudio.map(
      (sceneId) => `Scene ${sceneId} is missing audio.`,
    ),
    ...error.details.scenesStaleImage.map(
      (sceneId) => `Scene ${sceneId} has stale image.`,
    ),
    ...error.details.scenesStaleAudio.map(
      (sceneId) => `Scene ${sceneId} has stale audio.`,
    ),
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

function getRenderOutputPath(assets: Asset[], render: Render | undefined) {
  if (!render?.outputAssetId) {
    return null;
  }

  return assets.find((asset) => asset.id === render.outputAssetId)?.path ?? null;
}

export function RenderPanel({
  activeJobs,
  assets,
  projectId,
  renders,
}: RenderPanelProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const renderMutation = useRenderProjectMutation(projectId);
  const latestRender = getLatestRender(renders);
  const activeRenderJob = activeJobs.some(
    (job) =>
      job.type === "render_video" &&
      (job.status === "pending" || job.status === "processing"),
  );
  const preconditionError = parseRenderPrecondition(renderMutation.error);
  const outputPath = getRenderOutputPath(assets, latestRender);

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Render</h2>
          <p className="text-sm text-muted-foreground">
            {latestRender
              ? `Latest: ${latestRender.status}`
              : "No render requested yet"}
          </p>
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
          I acknowledge this video uses AI-generated script, image, audio, or
          render assets.
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

      {latestRender?.status === "succeeded" && outputPath ? (
        <p className="mt-3 break-words rounded-md border border-border bg-background px-3 py-2 text-sm">
          Output: <span className="font-medium">{outputPath}</span>
        </p>
      ) : null}
    </section>
  );
}
