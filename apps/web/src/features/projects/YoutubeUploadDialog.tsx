import type { Asset, YoutubeMetadata } from "@short-workflow/shared";
import { AlertCircle, Loader2, Upload, X, Youtube } from "lucide-react";

import { assetPreviewUrl } from "./assetUrls";
import {
  useStartYoutubeAuthMutation,
  useUploadYoutubeMutation,
  useYoutubeAuthStatusQuery,
} from "./hooks";

type YoutubeUploadDialogProps = {
  metadata: YoutubeMetadata;
  onClose: () => void;
  outputAsset: Asset;
  projectId: string;
};

export function YoutubeUploadDialog({
  metadata,
  onClose,
  outputAsset,
  projectId,
}: YoutubeUploadDialogProps) {
  const authStatus = useYoutubeAuthStatusQuery();
  const startAuth = useStartYoutubeAuthMutation();
  const uploadYoutube = useUploadYoutubeMutation(projectId);
  const hashtags = metadata.hashtags.join(" ");
  const connected = authStatus.data?.connected === true;

  async function connectYoutube() {
    const response = await startAuth.mutateAsync();
    window.open(response.authUrl, "_blank", "noopener,noreferrer");
  }

  async function confirmUpload() {
    await uploadYoutube.mutateAsync();
    onClose();
  }

  const actionPending = startAuth.isPending || uploadYoutube.isPending;
  const errorMessage = startAuth.error
    ? "YouTube connection could not be started."
    : uploadYoutube.error
      ? "YouTube upload could not be queued."
      : null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-3 backdrop-blur-sm">
      <div
        className="max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-upload-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Youtube className="size-4 text-muted-foreground" aria-hidden="true" />
              <h2 id="youtube-upload-title" className="text-base font-semibold">
                Upload to YouTube
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Private video, not made for kids.
            </p>
          </div>
          <button
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid max-h-[calc(100vh-8.5rem)] gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-md border border-border bg-muted">
              <video
                className="aspect-[9/16] max-h-[460px] w-full bg-muted object-contain"
                controls
                preload="metadata"
                src={assetPreviewUrl(outputAsset)}
              />
            </div>
          </div>

          <div className="grid min-w-0 content-start gap-3">
            <MetadataRow label="Title" value={metadata.youtubeTitle} />
            <MetadataRow label="Description" multiline value={metadata.description} />
            <MetadataRow label="Hashtags" value={hashtags} />
            <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Privacy</span>
                <span className="font-medium">Private</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Audience</span>
                <span className="font-medium">Not made for kids</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Disclosure</span>
                <span className="font-medium">Synthetic media enabled</span>
              </div>
            </div>

            {authStatus.error ? (
              <p className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                YouTube connection status could not be loaded.
              </p>
            ) : null}

            {errorMessage ? (
              <p className="flex items-start gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <button
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionPending}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          {connected ? (
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={actionPending}
              onClick={() => void confirmUpload()}
              type="button"
            >
              {uploadYoutube.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-4" aria-hidden="true" />
              )}
              Confirm private upload
            </button>
          ) : (
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={actionPending || authStatus.isLoading}
              onClick={() => void connectYoutube()}
              type="button"
            >
              {startAuth.isPending || authStatus.isLoading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Youtube className="size-4" aria-hidden="true" />
              )}
              Connect YouTube
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type MetadataRowProps = {
  label: string;
  multiline?: boolean;
  value: string;
};

function MetadataRow({ label, multiline = false, value }: MetadataRowProps) {
  return (
    <div className="grid min-w-0 gap-1 rounded-md border border-border bg-background p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <p
        className={
          multiline
            ? "max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6"
            : "break-words text-sm leading-6"
        }
      >
        {value}
      </p>
    </div>
  );
}
