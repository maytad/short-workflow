import { desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { renders } from "../schema";
import type { RenderRow } from "../schema";

export type CreateRenderAttemptInput = {
  projectId: string;
  status?: Extract<RenderRow["status"], "pending" | "processing">;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
};

export async function createRenderAttempt(db: DbClient, input: CreateRenderAttemptInput) {
  const [render] = await db
    .insert(renders)
    .values({
      ...input,
      status: input.status ?? "pending",
    })
    .returning();

  if (!render) {
    throw new Error("render_insert_failed");
  }

  return render;
}

export async function markRenderSucceeded(
  db: DbClient,
  renderId: string,
  inputAssetId: string,
  outputAssetId: string,
) {
  const [render] = await db
    .update(renders)
    .set({
      status: "succeeded",
      inputAssetId,
      outputAssetId,
      errorMessage: null,
      updatedAt: sql`now()`,
    })
    .where(eq(renders.id, renderId))
    .returning();

  return render ?? null;
}

export async function markRenderFailed(db: DbClient, renderId: string, errorMessage: string) {
  const [render] = await db
    .update(renders)
    .set({ status: "failed", errorMessage, updatedAt: sql`now()` })
    .where(eq(renders.id, renderId))
    .returning();

  return render ?? null;
}

export async function acknowledgeRenderDisclosure(db: DbClient, renderId: string) {
  const [render] = await db
    .update(renders)
    .set({
      aiDisclosureAcknowledgedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(renders.id, renderId))
    .returning();

  return render ?? null;
}

export async function listProjectRenders(db: DbClient, projectId: string) {
  return db
    .select()
    .from(renders)
    .where(eq(renders.projectId, projectId))
    .orderBy(desc(renders.createdAt));
}
