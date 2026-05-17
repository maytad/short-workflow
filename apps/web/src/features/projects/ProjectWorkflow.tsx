import type { Job, ProjectDetailResponse, Scene } from "@short-workflow/shared";
import {
  AlertCircle,
  Clapperboard,
  FileText,
  Loader2,
  Play,
} from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import { AssetPanel } from "./AssetPanel";
import {
  useGenerateScriptMutation,
  useProjectJobsQuery,
} from "./hooks";
import { RenderPanel } from "./RenderPanel";
import { SceneEditor } from "./SceneEditor";

type ProjectWorkflowProps = {
  detail: ProjectDetailResponse;
  projectId: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function activeJobLabel(job: Job) {
  return job.type.replaceAll("_", " ");
}

export function ProjectWorkflow({ detail, projectId }: ProjectWorkflowProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    detail.scenes[0]?.id ?? null,
  );
  const activeJobsQuery = useProjectJobsQuery(projectId, "active");
  const generateScript = useGenerateScriptMutation(projectId);
  const activeJobs = activeJobsQuery.data ?? detail.jobs;
  const activeWorkflowJobs = activeJobs.filter(
    (job) => job.status === "pending" || job.status === "processing",
  );
  const selectedScene = useMemo<Scene | null>(() => {
    if (detail.scenes.length === 0) {
      return null;
    }

    return (
      detail.scenes.find((scene) => scene.id === selectedSceneId) ??
      detail.scenes[0] ??
      null
    );
  }, [detail.scenes, selectedSceneId]);
  const scriptJobActive = activeWorkflowJobs.some(
    (job) => job.type === "generate_script",
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
      <aside className="space-y-4">
        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Project</p>
          <h1 className="mt-1 break-words text-xl font-semibold">
            {detail.project.title}
          </h1>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{detail.project.status}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Duration</dt>
              <dd className="font-medium">
                {detail.project.targetDurationSeconds}s
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Updated</dt>
              <dd className="font-medium">
                {formatDateTime(detail.project.updatedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Workflow</h2>
            <Clapperboard className="size-4 text-muted-foreground" />
          </div>
          <ol className="mt-3 space-y-2 text-sm">
            <li className="flex items-center justify-between gap-2">
              <span>Script</span>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {detail.scenes.length > 0 ? "ready" : "needed"}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Assets</span>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {detail.assets.length}
              </span>
            </li>
            <li className="flex items-center justify-between gap-2">
              <span>Render</span>
              <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                {detail.project.hasSuccessfulRender ? "done" : "open"}
              </span>
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Active jobs</h2>
          <div className="mt-3 grid gap-2">
            {activeWorkflowJobs.length > 0 ? (
              activeWorkflowJobs.map((job) => (
                <div
                  className="rounded-md border border-border bg-background p-2 text-xs"
                  key={job.id}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate capitalize">
                      {activeJobLabel(job)}
                    </span>
                    <span className="shrink-0 capitalize text-muted-foreground">
                      {job.status}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className={cn(
                        "h-full rounded bg-primary",
                        job.status === "processing" ? "w-2/3" : "w-1/3",
                      )}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active jobs.</p>
            )}
          </div>
        </section>
      </aside>

      <main className="min-w-0 space-y-4">
        {detail.scenes.length === 0 ? (
          <section className="rounded-lg border border-dashed border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-base font-semibold">
                  <FileText className="size-5 text-muted-foreground" />
                  Generate script
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create the first scene list from this project topic.
                </p>
              </div>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={generateScript.isPending || scriptJobActive}
                onClick={() => generateScript.mutate()}
                type="button"
              >
                {generateScript.isPending || scriptJobActive ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                {scriptJobActive ? "Generating" : "Generate script"}
              </button>
            </div>
            {generateScript.error ? (
              <p className="mt-3 flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
                <AlertCircle className="size-4" />
                Script generation could not be queued.
              </p>
            ) : null}
          </section>
        ) : (
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Scenes</h2>
              <span className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {detail.scenes.length} total
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {detail.scenes.map((scene) => (
                <button
                  className={cn(
                    "grid gap-1 rounded-md border border-border bg-background p-3 text-left transition-colors hover:border-primary",
                    selectedScene?.id === scene.id && "border-primary bg-muted",
                  )}
                  key={scene.id}
                  onClick={() => setSelectedSceneId(scene.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-sm font-semibold">
                      {scene.position}. {scene.role}
                    </span>
                    <span className="shrink-0 rounded bg-card px-2 py-1 text-xs capitalize text-muted-foreground">
                      {scene.status}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {scene.caption || scene.narration}
                  </p>
                </button>
              ))}
            </div>
          </section>
        )}

        <SceneEditor projectId={projectId} selectedScene={selectedScene} />
      </main>

      <aside className="space-y-4">
        <AssetPanel
          activeJobs={activeWorkflowJobs}
          assets={detail.assets}
          projectId={projectId}
          selectedScene={selectedScene}
        />
        <RenderPanel
          activeJobs={activeWorkflowJobs}
          assets={detail.assets}
          projectId={projectId}
          renders={detail.renders}
        />
      </aside>
    </div>
  );
}
