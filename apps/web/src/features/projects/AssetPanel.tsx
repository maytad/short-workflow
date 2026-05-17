import type { Asset, Job, Scene } from "@short-workflow/shared";
import { Image, Loader2, Music2, RefreshCw } from "lucide-react";

import {
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
  selectedScene: Scene | null;
};

const JOB_TYPE_BY_KIND: Record<AssetKind, Job["type"]> = {
  audio: "generate_scene_audio",
  image: "generate_scene_image",
};

export function isAssetCurrentForScene(asset: Asset | undefined, scene: Scene) {
  return (
    asset?.status === "ready" &&
    new Date(asset.createdAt).getTime() >=
      new Date(scene.contentUpdatedAt).getTime()
  );
}

export function getLatestSceneAsset({
  assets,
  kind,
  sceneId,
}: LatestSceneAssetInput) {
  return assets
    .filter(
      (asset) =>
        asset.sceneId === sceneId && asset.kind === kind && asset.status === "ready",
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
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
}: {
  activeJobs: Job[];
  asset: Asset | undefined;
  kind: AssetKind;
  onGenerate: () => void;
  pending: boolean;
  scene: Scene;
}) {
  const current = isAssetCurrentForScene(asset, scene);
  const jobActive = hasActiveJob(activeJobs, scene, kind);
  const disabled = pending || jobActive;
  const Icon = kind === "image" ? Image : Music2;

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold capitalize">
            <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            {kind}
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {asset?.path ?? "No ready asset yet"}
          </p>
        </div>
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
          {jobActive ? "queued" : current ? "current" : asset ? "stale" : "missing"}
        </span>
      </div>
      <button
        className="mt-3 inline-flex h-8 w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onGenerate}
        type="button"
      >
        {pending || jobActive ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
        {asset ? `Regenerate ${kind}` : `Generate ${kind}`}
      </button>
    </div>
  );
}

export function AssetPanel({
  activeJobs,
  assets,
  projectId,
  selectedScene,
}: AssetPanelProps) {
  const imageMutation = useGenerateSceneImageMutation(
    projectId,
    selectedScene?.id ?? "",
  );
  const audioMutation = useGenerateSceneAudioMutation(
    projectId,
    selectedScene?.id ?? "",
  );

  if (!selectedScene) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Assets</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a scene to review image and audio assets.
        </p>
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

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">Assets</h2>
        <p className="text-sm text-muted-foreground">
          Scene {selectedScene.position}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <AssetStatusRow
          activeJobs={activeJobs}
          asset={imageAsset}
          kind="image"
          onGenerate={() => imageMutation.mutate()}
          pending={imageMutation.isPending}
          scene={selectedScene}
        />
        <AssetStatusRow
          activeJobs={activeJobs}
          asset={audioAsset}
          kind="audio"
          onGenerate={() => audioMutation.mutate()}
          pending={audioMutation.isPending}
          scene={selectedScene}
        />
      </div>

      {imageMutation.error || audioMutation.error ? (
        <p className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
          Asset generation could not be queued.
        </p>
      ) : null}
    </section>
  );
}
