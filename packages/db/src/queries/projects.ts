import { desc, eq, sql } from "drizzle-orm";

import type { DbClient } from "../client";
import { projects } from "../schema";
import type { ProjectRow } from "../schema";

export type CreateProjectInput = {
  title: string;
  topic: string;
  targetDurationSeconds: 30 | 45 | 60;
};

export type UpdateProjectInput = {
  title?: string;
  topic?: string;
};

export type ProjectStatus = ProjectRow["status"];

export async function createProject(db: DbClient, input: CreateProjectInput) {
  const [project] = await db.insert(projects).values(input).returning();

  if (!project) {
    throw new Error("project_insert_failed");
  }

  return project;
}

export async function getProject(db: DbClient, projectId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

  return project ?? null;
}

export async function listProjects(db: DbClient) {
  return db.select().from(projects).orderBy(desc(projects.updatedAt));
}

export async function updateProject(db: DbClient, projectId: string, input: UpdateProjectInput) {
  const values: Partial<Pick<ProjectRow, "title" | "topic">> = {};

  if (input.title !== undefined) {
    values.title = input.title;
  }

  if (input.topic !== undefined) {
    values.topic = input.topic;
  }

  const [project] = await db
    .update(projects)
    .set({ ...values, updatedAt: sql`now()` })
    .where(eq(projects.id, projectId))
    .returning();

  return project ?? null;
}

export async function deleteProjectRows(db: DbClient, projectId: string) {
  const [project] = await db.delete(projects).where(eq(projects.id, projectId)).returning();

  return project ?? null;
}

export async function setProjectStatus(db: DbClient, projectId: string, status: ProjectStatus) {
  const [project] = await db
    .update(projects)
    .set({ status, updatedAt: sql`now()` })
    .where(eq(projects.id, projectId))
    .returning();

  return project ?? null;
}
