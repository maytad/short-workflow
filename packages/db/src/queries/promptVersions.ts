import type { PROMPT_PURPOSES } from "@short-workflow/shared";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { promptVersions } from "../schema";
import type { PromptVersionRow } from "../schema";
import { withAdvisoryTransactionLock } from "../transaction";

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
  if (input.revision !== undefined) {
    return insertPromptVersionRow(db, input, input.revision);
  }

  return withAdvisoryTransactionLock(db, promptVersionRevisionLockKey(input), async (tx) => {
    const revision = await nextPromptRevision(tx, {
      projectId: input.projectId,
      sceneId: input.sceneId,
      purpose: input.purpose,
    });

    return insertPromptVersionRow(tx, input, revision);
  });
}

async function insertPromptVersionRow(
  db: DbClient,
  input: InsertPromptVersionInput,
  revision: number,
) {
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

function promptVersionRevisionLockKey(scope: PromptVersionScope) {
  return ["prompt_version_revision", scope.projectId, scope.sceneId ?? "project", scope.purpose].join(
    ":",
  );
}

export async function listPromptVersions(db: DbClient, projectId: string) {
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.projectId, projectId))
    .orderBy(desc(promptVersions.createdAt));
}

export async function getLatestPromptVersion(db: DbClient, scope: PromptVersionScope) {
  const [promptVersion] = await db
    .select()
    .from(promptVersions)
    .where(promptVersionScopeWhere(scope))
    .orderBy(desc(promptVersions.revision), desc(promptVersions.createdAt))
    .limit(1);

  return promptVersion ?? null;
}
