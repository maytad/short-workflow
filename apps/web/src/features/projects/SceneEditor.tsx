import { zodResolver } from "@hookform/resolvers/zod";
import type { Scene, UpdateSceneRequest } from "@short-workflow/shared";
import { updateSceneRequestSchema } from "@short-workflow/shared";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { z } from "zod";

import { useUpdateSceneMutation } from "./hooks";

type SceneEditorProps = {
  projectId: string;
  selectedScene: Scene | null;
};

type SceneEditorFormValues = z.input<typeof updateSceneRequestSchema>;

function sceneDefaults(scene: Scene): SceneEditorFormValues {
  return {
    caption: scene.caption,
    imagePrompt: scene.imagePrompt,
    narration: scene.narration,
    ssml: scene.ssml,
  };
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }

  return <span className="text-xs text-accent-foreground">{message}</span>;
}

function TextAreaField({
  error,
  label,
  registration,
  rows = 3,
}: {
  error: string | undefined;
  label: string;
  registration: UseFormRegisterReturn;
  rows?: number;
}) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <textarea
        className="min-h-10 resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors focus:border-primary"
        rows={rows}
        {...registration}
      />
      <FieldError message={error} />
    </label>
  );
}

export function SceneEditor({ projectId, selectedScene }: SceneEditorProps) {
  const updateScene = useUpdateSceneMutation(projectId, selectedScene?.id ?? "");
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
    reset,
  } = useForm<SceneEditorFormValues, unknown, UpdateSceneRequest>({
    defaultValues: selectedScene ? sceneDefaults(selectedScene) : {},
    resolver: zodResolver(updateSceneRequestSchema),
  });

  useEffect(() => {
    if (selectedScene) {
      reset(sceneDefaults(selectedScene));
    }
  }, [reset, selectedScene]);

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
    <form
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={handleSubmit(async (values) => {
        const updatedScene = await updateScene.mutateAsync(values);
        reset(sceneDefaults(updatedScene));
      })}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">
            Scene {selectedScene.position}: {selectedScene.role}
          </h2>
          <p className="text-sm text-muted-foreground">Status: {selectedScene.status}</p>
        </div>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!isDirty || updateScene.isPending}
          type="submit"
        >
          {updateScene.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Save
        </button>
      </div>

      {updateScene.error ? (
        <p className="mt-3 flex items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-accent-foreground">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Scene changes could not be saved.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3">
        <TextAreaField
          error={errors.narration?.message}
          label="Narration"
          registration={register("narration")}
          rows={4}
        />
        <TextAreaField
          error={errors.caption?.message}
          label="Caption"
          registration={register("caption")}
          rows={2}
        />
        <TextAreaField
          error={errors.imagePrompt?.message}
          label="Image prompt"
          registration={register("imagePrompt")}
          rows={4}
        />
        <TextAreaField
          error={errors.ssml?.message}
          label="SSML"
          registration={register("ssml")}
          rows={4}
        />
        <label className="grid gap-1 text-sm font-medium">
          Duration seconds
          <input
            className="h-10 rounded-md border border-border bg-muted/50 px-3 text-sm outline-none"
            readOnly
            value={selectedScene.durationSeconds}
          />
        </label>
      </div>
    </form>
  );
}
