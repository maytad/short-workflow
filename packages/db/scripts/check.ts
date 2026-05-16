import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const migrationsDir = path.join(import.meta.dir, "..", "migrations");
const entries = await readdir(migrationsDir, { withFileTypes: true });
const folders = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const folder of folders) {
  const migrationPath = path.join(migrationsDir, folder, "migration.sql");
  const downPath = path.join(migrationsDir, folder, "down.sql");
  const migration = await readFile(migrationPath, "utf8");
  const down = await readFile(downPath, "utf8");

  if (!migration.trim()) throw new Error(`${folder}/migration.sql is empty`);
  if (!down.trim()) throw new Error(`${folder}/down.sql is empty`);
}

console.log(`Checked ${folders.length} migration folders`);
