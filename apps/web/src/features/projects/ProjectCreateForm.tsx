import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";

import { cn } from "../../lib/utils";
import { useCreateTinyMechanismsProjectMutation } from "./hooks";

const DURATION_OPTIONS = [30, 45, 60] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

export function ProjectCreateForm() {
  const navigate = useNavigate();
  const createProject = useCreateTinyMechanismsProjectMutation();
  const [selectedDuration, setSelectedDuration] = useState<DurationOption>(45);

  return (
    <form
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();

        const project = await createProject.mutateAsync({
          targetDurationSeconds: selectedDuration,
        });

        await navigate({
          params: { projectId: project.id },
          to: "/projects/$projectId",
        });
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
              Fixed preset
            </p>
            <h2 className="mt-1 text-base font-semibold">Tiny Mechanisms</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Create an English short about a small mechanical system, then generate the script,
              scenes, images, voice, and render.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <span className="text-sm font-medium">Target duration</span>
          <div className="grid grid-cols-3 rounded-md border border-border bg-background p-1">
            {DURATION_OPTIONS.map((duration) => {
              const isSelected = selectedDuration === duration;

              return (
                <button
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60",
                    isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  )}
                  disabled={createProject.isPending}
                  key={duration}
                  onClick={() => setSelectedDuration(duration)}
                  type="button"
                >
                  {isSelected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  {duration}s
                </button>
              );
            })}
          </div>
        </div>

        {createProject.error ? (
          <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm leading-6 text-accent-foreground">
            Project creation failed. Check the API connection and try again.
          </p>
        ) : null}

        <button
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createProject.isPending}
          type="submit"
        >
          {createProject.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {createProject.isPending ? "Creating" : "Create Tiny Mechanisms project"}
        </button>
      </div>
    </form>
  );
}
