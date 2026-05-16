import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const direction = process.argv[2];
const stepsArgIndex = process.argv.indexOf("--steps");
const steps = stepsArgIndex === -1 ? 1 : Number(process.argv[stepsArgIndex + 1]);

if (direction !== "up" && direction !== "down") {
  throw new Error("Usage: bun scripts/migrate.ts <up|down> [--steps N]");
}

if (!Number.isInteger(steps) || steps < 1) {
  throw new Error("--steps must be a positive integer");
}

if (!process.env.DATABASE_DIRECT_URL) {
  throw new Error("DATABASE_DIRECT_URL is required for migrations");
}

const sql = postgres(process.env.DATABASE_DIRECT_URL, { max: 1 });
const migrationsDir = path.join(import.meta.dir, "..", "migrations");

function checksum(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

async function ensureMigrationsTable() {
  await sql`
    create table if not exists app_migrations (
      id bigserial primary key,
      name text not null unique,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `;
}

async function migrationFolders() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function applyUp() {
  await ensureMigrationsTable();
  const applied =
    await sql<{ name: string; checksum: string }[]>`select name, checksum from app_migrations`;
  const appliedByName = new Map(
    applied.map((row) => [row.name, row.checksum]),
  );

  for (const name of await migrationFolders()) {
    const filePath = path.join(migrationsDir, name, "migration.sql");
    const content = await readFile(filePath, "utf8");
    const hash = checksum(content);
    const existing = appliedByName.get(name);
    if (existing && existing !== hash) {
      throw new Error(`Applied migration checksum mismatch for ${name}`);
    }
    if (existing) continue;

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`insert into app_migrations (name, checksum) values (${name}, ${hash})`;
    });
  }
}

async function applyDown() {
  await ensureMigrationsTable();
  const applied = await sql<{ name: string }[]>`
    select name from app_migrations order by applied_at desc, id desc limit ${steps}
  `;

  for (const row of applied) {
    const filePath = path.join(migrationsDir, row.name, "down.sql");
    const content = await readFile(filePath, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`
        create table if not exists app_migrations (
          id bigserial primary key,
          name text not null unique,
          checksum text not null,
          applied_at timestamptz not null default now()
        )
      `;
      await tx`delete from app_migrations where name = ${row.name}`;
    });
  }
}

try {
  if (direction === "up") await applyUp();
  if (direction === "down") await applyDown();
} finally {
  await sql.end();
}
