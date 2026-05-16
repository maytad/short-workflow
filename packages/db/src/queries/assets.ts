import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { assets, scenes } from "../schema";
import type { AssetRow } from "../schema";

export type CreatePendingAssetInput = {
  projectId: string;
  sceneId: string | null;
  kind: AssetRow["kind"];
  path: string;
  provider: AssetRow["provider"];
  model?: string | null;
};

export type ReadyAssetInput = {
  path: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string | null;
  provider: AssetRow["provider"];
  model: string | null;
};

export async function createPendingAsset(
  db: DbClient,
  input: CreatePendingAssetInput,
) {
  const [asset] = await db
    .insert(assets)
    .values({
      ...input,
      model: input.model ?? null,
      status: "pending",
    })
    .returning();

  if (!asset) {
    throw new Error("asset_insert_failed");
  }

  return asset;
}

export async function markAssetReady(
  db: DbClient,
  assetId: string,
  input: ReadyAssetInput,
) {
  const [asset] = await db
    .update(assets)
    .set({
      path: input.path,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      checksum: input.checksum,
      provider: input.provider,
      model: input.model,
      status: "ready",
      updatedAt: sql`now()`,
    })
    .where(eq(assets.id, assetId))
    .returning();

  return asset ?? null;
}

export async function markAssetFailed(
  db: DbClient,
  assetId: string,
  _errorMessage: string,
) {
  const [asset] = await db
    .update(assets)
    .set({ status: "failed", updatedAt: sql`now()` })
    .where(eq(assets.id, assetId))
    .returning();

  return asset ?? null;
}

export async function listProjectAssets(db: DbClient, projectId: string) {
  return db
    .select()
    .from(assets)
    .where(eq(assets.projectId, projectId))
    .orderBy(desc(assets.createdAt));
}

export async function getCurrentReadySceneAsset(
  db: DbClient,
  input: { sceneId: string; kind: AssetRow["kind"] },
) {
  const [row] = await db
    .select({ asset: assets })
    .from(assets)
    .innerJoin(scenes, eq(assets.sceneId, scenes.id))
    .where(
      and(
        eq(assets.sceneId, input.sceneId),
        eq(assets.kind, input.kind),
        eq(assets.status, "ready"),
        gte(assets.createdAt, scenes.contentUpdatedAt),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return row?.asset ?? null;
}
