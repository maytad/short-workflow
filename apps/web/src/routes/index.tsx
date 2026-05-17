import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderPlus } from "lucide-react";

export const Route = createFileRoute("/")({
  component: ProjectsIndexRoute,
});

function ProjectsIndexRoute() {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Projects</p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Short video workflow
          </h1>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted">
          <FolderPlus className="size-4" aria-hidden="true" />
          New project
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <p className="text-sm font-medium text-foreground">
          Project list placeholder
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Task 12 can attach project queries, creation forms, active job status,
          and navigation into project detail from this route.
        </p>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-accent-foreground underline-offset-4 hover:underline"
          to="/projects/$projectId"
          params={{ projectId: "example-project-id" }}
        >
          Open placeholder project
        </Link>
      </div>
    </section>
  );
}
