import { PROMPT_PURPOSES } from "@short-workflow/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { promptVersions } from "../schema";
import type { PromptVersionRow } from "../schema";

export type PromptPurpose = (typeof PROMPT_PURPOSES)[number];

export type PromptVersionScope = {
  projectId: string;
  sceneId: string | null;
  purpose: PromptPurpose;
};

export type InsertPromptVersionInput = PromptVersionScope & {
  provider: PromptVersionRow["provider"];
  model?: string | null;
  revision?: number;
  promptPayload: Record<string, unknown>;
  responseText?: string | null;
  responseMetadata?: Record<string, unknown>;
};

function promptVersionScopeWhere(scope: PromptVersionScope) {
  return and(
    eq(promptVersions.projectId, scope.projectId),
    scope.sceneId === null
      ? isNull(promptVersions.sceneId)
      : eq(promptVersions.sceneId, scope.sceneId),
    eq(promptVersions.purpose, scope.purpose),
  );
}

export async function nextPromptRevision(db: DbClient, scope: PromptVersionScope) {
  const [row] = await db
    .select({
      nextRevision: sql<number>`coalesce(max(${promptVersions.revision}), 0) + 1`,
    })
    .from(promptVersions)
    .where(promptVersionScopeWhere(scope));

  return row?.nextRevision ?? 1;
}

export async function insertPromptVersion(db: DbClient, input: InsertPromptVersionInput) {
  const revision =
    input.revision ??
    (await nextPromptRevision(db, {
      projectId: input.projectId,
      sceneId: input.sceneId,
      purpose: input.purpose,
    }));

  const [promptVersion] = await db
    .insert(promptVersions)
    .values({
      projectId: input.projectId,
      sceneId: input.sceneId,
      purpose: input.purpose,
      provider: input.provider,
      model: input.model ?? null,
      revision,
      promptPayload: input.promptPayload,
      responseText: input.responseText ?? null,
      responseMetadata: input.responseMetadata ?? {},
    })
    .returning();

  if (!promptVersion) {
    throw new Error("prompt_version_insert_failed");
  }

  return promptVersion;
}

export async function listPromptVersions(db: DbClient, projectId: string) {
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.createdAt));
}
