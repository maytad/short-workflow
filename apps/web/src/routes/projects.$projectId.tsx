import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { ProjectWorkflow } from "../features/projects/ProjectWorkflow";
import { useProjectQuery } from "../features/projects/hooks";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
  const { projectId } = Route.useParams();
  const projectQuery = useProjectQuery(projectId);

  if (projectQuery.isLoading) {
    return (
      <section className="flex min-h-72 items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading project
      </section>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm font-medium text-accent-foreground">
          Project could not be loaded.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Check that the project exists and the API is reachable.
        </p>
      </section>
    );
  }

  return <ProjectWorkflow detail={projectQuery.data} projectId={projectId} />;
}
