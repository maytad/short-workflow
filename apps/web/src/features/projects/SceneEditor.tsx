import type { Scene } from "@short-workflow/shared";
import { Lock } from "lucide-react";

type SceneEditorProps = {
  selectedScene: Scene | null;
};

function ReadOnlyField({
  label,
  value,
  rows = 3,
}: {
  label: string;
  rows?: number;
  value: string | number;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <textarea
        className="min-h-10 resize-y rounded-md border border-border bg-muted/50 px-3 py-2 text-sm leading-6 text-foreground outline-none"
        readOnly
        rows={rows}
        value={String(value)}
      />
    </label>
  );
}

export function SceneEditor({ selectedScene }: SceneEditorProps) {
  if (!selectedScene) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Scene editor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select a scene to inspect generated content.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            Scene {selectedScene.position}: {selectedScene.role}
          </h2>
          <p className="text-sm text-muted-foreground">
            Status: {selectedScene.status}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
          <Lock className="size-3" aria-hidden="true" />
          Read-only
        </span>
      </div>

      <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
        Scene editing will be enabled when the API adds a scene update endpoint.
      </p>

      <div className="mt-4 grid gap-3">
        <ReadOnlyField label="Narration" rows={4} value={selectedScene.narration} />
        <ReadOnlyField label="Caption" rows={2} value={selectedScene.caption} />
        <ReadOnlyField
          label="Image prompt"
          rows={4}
          value={selectedScene.imagePrompt}
        />
        <ReadOnlyField label="SSML" rows={4} value={selectedScene.ssml} />
        <label className="grid gap-1 text-sm font-medium">
          Duration seconds
          <input
            className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none"
            readOnly
            value={selectedScene.durationSeconds}
          />
        </label>
      </div>
    </section>
  );
}
