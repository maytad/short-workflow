import {
  type Project,
  TINY_MECHANISMS_PROJECT_DESCRIPTION,
  TINY_MECHANISMS_TOPIC_PREFIX,
} from "@short-workflow/shared";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  Loader2,
  Trash2,
  Youtube,
} from "lucide-react";
import { useEffect, useState } from "react";

import { ApiError } from "../api/client";
import { useDeleteProjectMutation, useProjectsQuery } from "../features/projects/hooks";
import { ProjectCreateForm } from "../features/projects/ProjectCreateForm";

export const Route = createFileRoute("/")({
  component: ProjectsIndexRoute,
});

const PROJECTS_PER_PAGE = 10;

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

function deleteProjectErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return "Project cannot be deleted while jobs are still running.";
  }

  return "Project deletion failed. Check the API connection and try again.";
}

function latestFailureText(failure: Project["latestFailure"]) {
  if (!failure) {
    return null;
  }

  const stage = failure.stage ?? failure.jobType;
  const role = failure.failedRole ? ` (${failure.failedRole})` : "";
  const reason = failure.reason ?? failure.errorMessage;

  return reason ? `${stage}${role}: ${reason}` : `${stage}${role}`;
}

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), totalPages);
}

function ProjectsIndexRoute() {
  const projectsQuery = useProjectsQuery();
  const deleteProject = useDeleteProjectMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const projects = projectsQuery.data ?? [];
  const totalPages = Math.max(1, Math.ceil(projects.length / PROJECTS_PER_PAGE));
  const safeCurrentPage = clampPage(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * PROJECTS_PER_PAGE;
  const paginatedProjects = projects.slice(pageStartIndex, pageStartIndex + PROJECTS_PER_PAGE);
  const pageStartLabel = projects.length === 0 ? 0 : pageStartIndex + 1;
  const pageEndLabel = Math.min(pageStartIndex + paginatedProjects.length, projects.length);

  useEffect(() => {
    setCurrentPage((page) => clampPage(page, totalPages));
  }, [totalPages]);

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

        {deleteError ? (
          <p
            aria-live="polite"
            className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm leading-6 text-accent-foreground"
            role="status"
          >
            {deleteError}
          </p>
        ) : null}

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
              {paginatedProjects.map((project) => {
                const failureText = latestFailureText(project.latestFailure);

                return (
                  <article
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                    key={project.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="min-w-0 truncate text-base font-semibold">
                          {project.title}
                        </h2>
                        <span className="rounded bg-muted px-2 py-1 text-xs font-medium capitalize text-muted-foreground">
                          {project.status}
                        </span>
                        {project.youtubeUpload ? (
                          <span
                            className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300"
                            title={`YouTube video ID: ${project.youtubeUpload.youtubeVideoId}`}
                          >
                            <Youtube className="size-3.5" aria-hidden="true" />
                            YouTube uploaded
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {projectDescription(project.topic)}
                      </p>
                      {failureText ? (
                        <p className="mt-2 flex min-w-0 items-start gap-2 rounded-md border border-accent/30 bg-accent/10 px-2 py-1.5 text-xs leading-5 text-accent-foreground">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 break-words">Error: {failureText}</span>
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{project.targetDurationSeconds}s</span>
                        <span>Updated {formatDateTime(project.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <Link
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        params={{ projectId: project.id }}
                        to="/projects/$projectId"
                      >
                        <ExternalLink className="size-4" aria-hidden="true" />
                        Open
                      </Link>
                      {project.status !== "done" ? (
                        <button
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-accent/30 bg-background px-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={deleteProject.isPending}
                          onClick={() => {
                            deleteProject.reset();
                            setDeleteError(null);

                            if (
                              !window.confirm(
                                `Delete "${project.title}"? This removes the project and local generated files.`,
                              )
                            ) {
                              return;
                            }

                            deleteProject.mutate(project.id, {
                              onError: (error) => {
                                setDeleteError(deleteProjectErrorMessage(error));
                              },
                              onSuccess: () => {
                                setDeleteError(null);
                              },
                            });
                          }}
                          type="button"
                        >
                          {deleteProject.isPending && deleteProject.variables === project.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="size-4" aria-hidden="true" />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {projects.length > PROJECTS_PER_PAGE ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {pageStartLabel}-{pageEndLabel} of {projects.length}
            </p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}
                type="button"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </button>
              <span className="text-sm font-medium text-muted-foreground">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}
                type="button"
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
