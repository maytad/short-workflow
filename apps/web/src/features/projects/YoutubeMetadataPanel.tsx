import type { YoutubeMetadata } from "@short-workflow/shared";
import { AlertCircle, Check, Copy, Youtube } from "lucide-react";
import { useState } from "react";

type YoutubeMetadataPanelProps = {
  metadata: YoutubeMetadata;
};

type CopyKey = "title" | "description" | "hashtags" | "disclosure";
type CopyState = {
  key: CopyKey;
  status: "copied" | "failed";
};

export function YoutubeMetadataPanel({ metadata }: YoutubeMetadataPanelProps) {
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const hashtags = metadata.hashtags.join(" ");

  async function copyValue(key: CopyKey, value: string) {
    const copied = await copyText(value);
    setCopyState({ key, status: copied ? "copied" : "failed" });
    window.setTimeout(() => setCopyState(null), 1_500);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Youtube className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-base font-semibold">YouTube Metadata</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Copy these generated upload details after reviewing the final video.
          </p>
        </div>
        <span className="shrink-0 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          Read-only
        </span>
      </div>

      <div className="mt-4 divide-y divide-border border-y border-border">
        <MetadataField
          copyStatus={copyState?.key === "title" ? copyState.status : null}
          label="Title"
          onCopy={() => void copyValue("title", metadata.youtubeTitle)}
          value={metadata.youtubeTitle}
        />
        <MetadataField
          copyStatus={copyState?.key === "description" ? copyState.status : null}
          label="Description"
          multiline
          onCopy={() => void copyValue("description", metadata.description)}
          value={metadata.description}
        />
        <MetadataField
          copyStatus={copyState?.key === "hashtags" ? copyState.status : null}
          label="Hashtags"
          onCopy={() => void copyValue("hashtags", hashtags)}
          value={hashtags}
        />
        <MetadataField
          copyStatus={copyState?.key === "disclosure" ? copyState.status : null}
          label="Disclosure hint"
          multiline
          onCopy={() => void copyValue("disclosure", metadata.disclosureHint)}
          value={metadata.disclosureHint}
        />
      </div>
    </section>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return fallbackCopyText(value);
  }
}

function fallbackCopyText(value: string) {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";

  document.body.append(textArea);
  textArea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textArea.remove();
  }
}

type MetadataFieldProps = {
  copyStatus: CopyState["status"] | null;
  label: string;
  multiline?: boolean;
  onCopy: () => void;
  value: string;
};

function MetadataField({
  copyStatus,
  label,
  multiline = false,
  onCopy,
  value,
}: MetadataFieldProps) {
  return (
    <div className="grid gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <button
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onCopy}
          type="button"
        >
          {copyStatus === "copied" ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : copyStatus === "failed" ? (
            <AlertCircle className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Failed" : "Copy"}
        </button>
      </div>
      <p
        className={
          multiline
            ? "whitespace-pre-wrap break-words text-sm leading-6 text-foreground"
            : "break-words text-sm leading-6 text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}
