import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus, Sparkles } from "lucide-react";

import { useCreateTinyMechanismsProjectMutation } from "./hooks";

export function ProjectCreateForm() {
  const navigate = useNavigate();
  const createProject = useCreateTinyMechanismsProjectMutation();

  return (
    <form
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();

        createProject.mutate(undefined, {
          onSuccess: (project) => {
            void navigate({
              params: { projectId: project.id },
              to: "/projects/$projectId",
            });
          },
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
              Create a backend-optimized English short about a small physical mechanism, then
              generate the script, scenes, images, voice, and render.
            </p>
          </div>
        </div>

        {createProject.error ? (
          <p
            aria-live="polite"
            className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm leading-6 text-accent-foreground"
            role="status"
          >
            Project creation failed. Check the API connection and try again.
          </p>
        ) : null}

        <button
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
