import { and, asc, eq, inArray, not, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { scenes } from "../schema";
import type { SceneRow } from "../schema";

type SceneContentFields = Pick<SceneRow, "narration" | "caption" | "imagePrompt" | "ssml">;

export type SceneStatusInput = {
  narration?: string | null;
  caption?: string | null;
  imagePrompt?: string | null;
  ssml?: string | null;
};

export type UpdateSceneInput = Partial<
  Pick<SceneRow, "durationSeconds" | "narration" | "caption" | "imagePrompt" | "ssml">
>;

export type ReplaceProjectSceneInput = Pick<
  SceneRow,
  "position" | "role" | "durationSeconds" | "narration" | "caption" | "imagePrompt" | "ssml"
>;

type NormalizableSceneInput = Partial<SceneContentFields>;

const contentFieldNames = ["narration", "caption", "imagePrompt", "ssml"] as const;

export function computeSceneStatus(input: SceneStatusInput) {
  return contentFieldNames.every((field) => input[field]?.trim()) ? "ready" : "draft";
}

export function normalizeSceneContent<T extends NormalizableSceneInput>(input: T) {
  const normalized = { ...input };

  for (const field of contentFieldNames) {
    if (normalized[field] !== undefined) {
      normalized[field] = normalized[field]?.trim() ?? "";
    }
  }

  return normalized;
}

export async function listProjectScenes(db: DbClient, projectId: string) {
  return db
    .select()
    .from(scenes)
    .where(eq(scenes.projectId, projectId))
    .orderBy(asc(scenes.position));
}

export async function getScene(db: DbClient, sceneId: string) {
  const [scene] = await db.select().from(scenes).where(eq(scenes.id, sceneId)).limit(1);

  return scene ?? null;
}

export async function updateScene(db: DbClient, sceneId: string, input: UpdateSceneInput) {
  const existing = await getScene(db, sceneId);

  if (!existing) {
    return null;
  }

  const normalized = normalizeSceneContent(input);
  const next: Pick<
    SceneRow,
    "durationSeconds" | "narration" | "caption" | "imagePrompt" | "ssml" | "status"
  > = {
    durationSeconds: normalized.durationSeconds ?? existing.durationSeconds,
    narration: normalized.narration ?? existing.narration,
    caption: normalized.caption ?? existing.caption,
    imagePrompt: normalized.imagePrompt ?? existing.imagePrompt,
    ssml: normalized.ssml ?? existing.ssml,
    status: computeSceneStatus({
      narration: normalized.narration ?? existing.narration,
      caption: normalized.caption ?? existing.caption,
      imagePrompt: normalized.imagePrompt ?? existing.imagePrompt,
      ssml: normalized.ssml ?? existing.ssml,
    }),
  };

  const changes: Partial<typeof scenes.$inferInsert> = {};
  let contentChanged = false;
  let hasChanges = next.status !== existing.status;

  for (const field of contentFieldNames) {
    if (normalized[field] !== undefined && next[field] !== existing[field]) {
      changes[field] = next[field];
      contentChanged = true;
      hasChanges = true;
    }
  }

  if (
    normalized.durationSeconds !== undefined &&
    next.durationSeconds !== existing.durationSeconds
  ) {
    changes.durationSeconds = next.durationSeconds;
    contentChanged = true;
    hasChanges = true;
  }

  if (!hasChanges) {
    return existing;
  }

  const [scene] = await db
    .update(scenes)
    .set({
      ...changes,
      status: next.status,
      ...(contentChanged ? { contentUpdatedAt: sql`now()` } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(scenes.id, sceneId))
    .returning();

  return scene ?? null;
}

export async function replaceProjectScenes(
  db: DbClient,
  projectId: string,
  replacementScenes: ReplaceProjectSceneInput[],
) {
  const dbWithTransaction = db as DbClient & {
    transaction?: (callback: (tx: DbClient) => Promise<SceneRow[]>) => Promise<SceneRow[]>;
  };

  if (typeof dbWithTransaction.transaction === "function") {
    return dbWithTransaction.transaction((tx) =>
      replaceProjectScenesInTransaction(tx as unknown as DbClient, projectId, replacementScenes),
    );
  }

  return replaceProjectScenesInTransaction(db, projectId, replacementScenes);
}

async function replaceProjectScenesInTransaction(
  db: DbClient,
  projectId: string,
  replacementScenes: ReplaceProjectSceneInput[],
) {
  const existingScenes = await listProjectScenes(db, projectId);
  const existingByPosition = new Map(existingScenes.map((scene) => [scene.position, scene]));
  const result: SceneRow[] = [];
  const positions = replacementScenes.map((scene) => scene.position);

  if (positions.length > 0) {
    await db
      .delete(scenes)
      .where(and(eq(scenes.projectId, projectId), not(inArray(scenes.position, positions))));
  } else {
    await db.delete(scenes).where(eq(scenes.projectId, projectId));
  }

  for (const replacement of replacementScenes) {
    const normalized = normalizeSceneContent(replacement);
    const status = computeSceneStatus(normalized);
    const existing = existingByPosition.get(replacement.position);

    if (!existing) {
      const [inserted] = await db
        .insert(scenes)
        .values({
          ...normalized,
          projectId,
          status,
        })
        .returning();

      if (!inserted) {
        throw new Error("scene_insert_failed");
      }

      result.push(inserted);
      continue;
    }

    const contentChanged =
      existing.role !== normalized.role ||
      existing.durationSeconds !== normalized.durationSeconds ||
      contentFieldNames.some((field) => existing[field] !== normalized[field]);
    const hasChanges = contentChanged || existing.status !== status;

    if (!hasChanges) {
      result.push(existing);
      continue;
    }

    const [updated] = await db
      .update(scenes)
      .set({
        role: normalized.role,
        durationSeconds: normalized.durationSeconds,
        narration: normalized.narration,
        caption: normalized.caption,
        imagePrompt: normalized.imagePrompt,
        ssml: normalized.ssml,
        status,
        ...(contentChanged ? { contentUpdatedAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(scenes.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("scene_update_failed");
    }

    result.push(updated);
  }

  return result.sort((a, b) => a.position - b.position);
}
