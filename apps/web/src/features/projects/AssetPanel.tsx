import type { Asset, BulkAssetQueueResponse, Job, Scene } from "@short-workflow/shared";
import { Image, Layers3, Loader2, Music2, RefreshCw } from "lucide-react";

import { assetPreviewUrl } from "./assetUrls";
import {
  hasActiveProjectFlowJob,
  useGenerateProjectAssetsMutation,
  useGenerateSceneAudioMutation,
  useGenerateSceneImageMutation,
} from "./hooks";

type AssetKind = Extract<Asset["kind"], "image" | "audio">;

type LatestSceneAssetInput = {
  assets: Asset[];
  kind: AssetKind;
  sceneId: string;
};

type AssetPanelProps = {
  activeJobs: Job[];
  assets: Asset[];
  projectId: string;
  sceneCount: number;
  selectedScene: Scene | null;
};

const JOB_TYPE_BY_KIND: Record<AssetKind, Job["type"]> = {
  audio: "generate_scene_audio",
  image: "generate_scene_image",
};

export function isAssetCurrentForScene(asset: Asset | undefined, scene: Scene) {
  return (
    asset?.status === "ready" &&
    new Date(asset.createdAt).getTime() >= new Date(scene.contentUpdatedAt).getTime()
  );
}

export function getLatestSceneAsset({ assets, kind, sceneId }: LatestSceneAssetInput) {
  return assets
    .filter((asset) => asset.sceneId === sceneId && asset.kind === kind && asset.status === "ready")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

export function assetQueueFeedbackMessage(result: BulkAssetQueueResponse) {
  const activeCount = result.queuedCount + result.existingActiveCount;

  if (activeCount > 0) {
    return `Queued ${activeCount} asset ${activeCount === 1 ? "job" : "jobs"}.`;
  }

  return "All assets are current.";
}

function currentSceneAsset(asset: Asset | undefined, scene: Scene) {
  return isAssetCurrentForScene(asset, scene) ? asset : undefined;
}

function hasActiveJob(activeJobs: Job[], scene: Scene, kind: AssetKind) {
  return activeJobs.some(
    (job) =>
      job.sceneId === scene.id &&
      job.type === JOB_TYPE_BY_KIND[kind] &&
      (job.status === "pending" || job.status === "processing"),
  );
}

function AssetStatusRow({
  activeJobs,
  asset,
  kind,
  onGenerate,
  scene,
  pending,
  projectFlowActive,
}: {
  activeJobs: Job[];
  asset: Asset | undefined;
  kind: AssetKind;
  onGenerate: () => void;
  pending: boolean;
  projectFlowActive: boolean;
  scene: Scene;
}) {
  const current = isAssetCurrentForScene(asset, scene);
  const jobActive = hasActiveJob(activeJobs, scene, kind);
  const busy = pending || jobActive || projectFlowActive;
  const Icon = kind === "image" ? Image : Music2;
  const actionLabel = asset ? `Regenerate ${kind}` : `Generate ${kind}`;

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-border bg-background p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold capitalize">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 truncate">{kind}</span>
          </div>
          <p className="mt-1 min-w-0 truncate text-xs text-muted-foreground" title={asset?.path}>
            {asset?.path ?? "No ready asset yet"}
          </p>
        </div>
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
          {jobActive || projectFlowActive
            ? "queued"
            : current
              ? "current"
              : asset
                ? "stale"
                : "missing"}
        </span>
      </div>
      <button
        className="mt-3 inline-flex h-8 w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        disabled={busy}
        onClick={onGenerate}
        type="button"
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">{actionLabel}</span>
      </button>
    </div>
  );
}

function AssetPreviewSection({
  audioAsset,
  imageAsset,
  scene,
}: {
  audioAsset: Asset | undefined;
  imageAsset: Asset | undefined;
  scene: Scene;
}) {
  if (!imageAsset && !audioAsset) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Preview</h3>
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          Scene {scene.position}
        </span>
      </div>

      <div className="mt-3 grid min-w-0 gap-3">
        {imageAsset ? (
          <figure className="min-w-0 overflow-hidden rounded-md border border-border bg-background">
            <div className="aspect-[9/16] max-h-[420px] bg-muted">
              <img
                alt={`Scene ${scene.position} generated preview`}
                className="h-full w-full object-cover"
                loading="lazy"
                src={assetPreviewUrl(imageAsset)}
              />
            </div>
            <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {scene.caption}
            </figcaption>
          </figure>
        ) : null}

        {audioAsset ? (
          <div className="min-w-0 rounded-md border border-border bg-background p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Music2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              Audio preview
            </div>
            {
              // biome-ignore lint/a11y/useMediaCaption: MVP generated audio previews do not have caption track assets.
              <audio
                aria-label={`Scene ${scene.position} generated audio preview`}
                className="w-full"
                controls
                preload="metadata"
                src={assetPreviewUrl(audioAsset)}
              />
            }
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProjectAssetQueueButton({
  disabled,
  onGenerate,
  pending,
}: {
  disabled: boolean;
  onGenerate: () => void;
  pending: boolean;
}) {
  return (
    <button
      className="mt-4 inline-flex h-9 w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={disabled}
      onClick={onGenerate}
      type="button"
    >
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      ) : (
        <Layers3 className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">
        {pending ? "Queueing assets" : "Generate missing assets"}
      </span>
    </button>
  );
}

export function AssetPanel({
  activeJobs,
  assets,
  projectId,
  sceneCount,
  selectedScene,
}: AssetPanelProps) {
  const imageMutation = useGenerateSceneImageMutation(projectId, selectedScene?.id ?? "");
  const audioMutation = useGenerateSceneAudioMutation(projectId, selectedScene?.id ?? "");
  const projectAssetsMutation = useGenerateProjectAssetsMutation(projectId);
  const projectAssetFeedback = projectAssetsMutation.data
    ? assetQueueFeedbackMessage(projectAssetsMutation.data)
    : null;
  const projectFlowActive = hasActiveProjectFlowJob(activeJobs);
  const projectAssetQueuePending = projectAssetsMutation.isPending || projectFlowActive;
  const queueProjectAssets = () => {
    projectAssetsMutation.reset();
    projectAssetsMutation.mutate();
  };

  if (!selectedScene) {
    return (
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Assets</h2>
        <ProjectAssetQueueButton
          disabled={sceneCount === 0 || projectAssetQueuePending}
          onGenerate={queueProjectAssets}
          pending={projectAssetQueuePending}
        />
        {projectAssetFeedback ? (
          <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
            {projectAssetFeedback}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          Select a scene to review image and audio assets.
        </p>
        {projectAssetsMutation.error ? (
          <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            Asset generation could not be queued.
          </p>
        ) : null}
      </section>
    );
  }

  const imageAsset = getLatestSceneAsset({
    assets,
    kind: "image",
    sceneId: selectedScene.id,
  });
  const audioAsset = getLatestSceneAsset({
    assets,
    kind: "audio",
    sceneId: selectedScene.id,
  });
  const currentImageAsset = currentSceneAsset(imageAsset, selectedScene);
  const currentAudioAsset = currentSceneAsset(audioAsset, selectedScene);

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Assets</h2>
        <p className="text-sm text-muted-foreground">Scene {selectedScene.position}</p>
      </div>

      <ProjectAssetQueueButton
        disabled={sceneCount === 0 || projectAssetQueuePending}
        onGenerate={queueProjectAssets}
        pending={projectAssetQueuePending}
      />
      {projectAssetFeedback ? (
        <p className="mt-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          {projectAssetFeedback}
        </p>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-3">
        <AssetStatusRow
          activeJobs={activeJobs}
          asset={imageAsset}
          kind="image"
          onGenerate={() => imageMutation.mutate()}
          pending={imageMutation.isPending}
          projectFlowActive={projectFlowActive}
          scene={selectedScene}
        />
        <AssetStatusRow
          activeJobs={activeJobs}
          asset={audioAsset}
          kind="audio"
          onGenerate={() => audioMutation.mutate()}
          pending={audioMutation.isPending}
          projectFlowActive={projectFlowActive}
          scene={selectedScene}
        />
      </div>

      <AssetPreviewSection
        audioAsset={currentAudioAsset}
        imageAsset={currentImageAsset}
        scene={selectedScene}
      />

      {imageMutation.error || audioMutation.error || projectAssetsMutation.error ? (
        <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
          Asset generation could not be queued.
        </p>
      ) : null}
    </section>
  );
}
