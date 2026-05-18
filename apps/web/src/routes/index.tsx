import {
  TINY_MECHANISMS_PROJECT_DESCRIPTION,
  TINY_MECHANISMS_TOPIC_PREFIX,
} from "@short-workflow/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, FolderOpen, Loader2 } from "lucide-react";

import { ProjectCreateForm } from "../features/projects/ProjectCreateForm";
import { useProjectsQuery } from "../features/projects/hooks";

export const Route = createFileRoute("/")({
  component: ProjectsIndexRoute,
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function projectDescription(topic: string) {
  return topic.startsWith(TINY_MECHANISMS_TOPIC_PREFIX)
    ? TINY_MECHANISMS_PROJECT_DESCRIPTION
    : topic;
}

function ProjectsIndexRoute() {
  const projectsQuery = useProjectsQuery();
  const projects = projectsQuery.data ?? [];

  return (
    <section className="grid items-start gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <ProjectCreateForm />

      <div className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Projects</p>
            <h1 className="text-2xl font-semibold tracking-normal">Short video workflow</h1>
          </div>
          {projectsQuery.isFetching ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Refreshing
            </span>
          ) : null}
        </div>

        <div className="rounded-lg border border-border bg-card shadow-sm">
          {projectsQuery.isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading projects
            </div>
          ) : projectsQuery.error ? (
            <div className="p-6">
              <p className="text-sm font-medium text-accent-foreground">
                Projects could not be loaded.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check the API connection and refresh.
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="p-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FolderOpen className="size-4 text-muted-foreground" aria-hidden="true" />
                No projects yet
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Create a project to start generating scenes and assets.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {projects.map((project) => (
                <article
                  className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                  key={project.id}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="min-w-0 truncate text-base font-semibold">{project.title}</h2>
                      <span className="rounded bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                        {project.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {projectDescription(project.topic)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{project.targetDurationSeconds}s</span>
                      <span>Updated {formatDateTime(project.updatedAt)}</span>
                    </div>
                  </div>
                  <Link
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    params={{ projectId: project.id }}
                    to="/projects/$projectId"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                    Open
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
