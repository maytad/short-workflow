import { zodResolver } from "@hookform/resolvers/zod";
import type { CreateProjectRequest } from "@short-workflow/shared";
import { createProjectRequestSchema } from "@short-workflow/shared";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { cn } from "../../lib/utils";
import { useCreateProjectMutation } from "./hooks";

const DURATION_OPTIONS = [30, 45, 60] as const;
type CreateProjectFormValues = z.input<typeof createProjectRequestSchema>;

export function ProjectCreateForm() {
  const navigate = useNavigate();
  const createProject = useCreateProjectMutation();
  const {
    formState: { errors },
    handleSubmit,
    register,
    setValue,
    watch,
  } = useForm<CreateProjectFormValues, unknown, CreateProjectRequest>({
    defaultValues: {
      targetDurationSeconds: 45,
      title: "",
      topic: "",
    },
    resolver: zodResolver(createProjectRequestSchema),
  });
  const selectedDuration = watch("targetDurationSeconds");

  return (
    <form
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={handleSubmit(async (values) => {
        const project = await createProject.mutateAsync(values);
        await navigate({
          params: { projectId: project.id },
          to: "/projects/$projectId",
        });
      })}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Create project</h2>
          <p className="text-sm text-muted-foreground">
            Start a short-form video workflow.
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={createProject.isPending}
          type="submit"
        >
          {createProject.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Create
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Title
          <input
            className="min-h-10 rounded-md border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary"
            placeholder="Launch teaser"
            {...register("title")}
          />
          {errors.title ? (
            <span className="text-xs text-accent-foreground">
              {errors.title.message}
            </span>
          ) : null}
        </label>

        <label className="grid gap-1 text-sm font-medium">
          Topic
          <textarea
            className="min-h-24 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-primary"
            placeholder="Describe the product, audience, and key message."
            {...register("topic")}
          />
          {errors.topic ? (
            <span className="text-xs text-accent-foreground">
              {errors.topic.message}
            </span>
          ) : null}
        </label>

        <div className="grid gap-1">
          <span className="text-sm font-medium">Target duration</span>
          <div className="inline-grid grid-cols-3 rounded-md border border-border bg-background p-1">
            {DURATION_OPTIONS.map((duration) => (
              <button
                className={cn(
                  "h-8 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  selectedDuration === duration &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
                key={duration}
                onClick={() =>
                  setValue("targetDurationSeconds", duration, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                type="button"
              >
                {duration}s
              </button>
            ))}
          </div>
          {errors.targetDurationSeconds ? (
            <span className="text-xs text-accent-foreground">
              {errors.targetDurationSeconds.message}
            </span>
          ) : null}
        </div>

        {createProject.error ? (
          <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
            Project creation failed. Check the API and try again.
          </p>
        ) : null}
      </div>
    </form>
  );
}
