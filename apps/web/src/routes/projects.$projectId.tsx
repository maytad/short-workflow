import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
  const { projectId } = Route.useParams();

  return (
    <section className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Project</p>
        <h1 className="break-words text-2xl font-semibold tracking-normal">
          {projectId}
        </h1>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {["Scenes", "Assets", "Renders"].map((label) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={label}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clapperboard className="size-4 text-muted-foreground" />
              {label}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Placeholder area for Task 12 workflow data.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
