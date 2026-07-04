import Database from "better-sqlite3";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const DB_PATH = (process.env.DATABASE_URL ?? "file:./dev.db").replace(/^file:/, "");
const BACKUP_DIR = path.join(process.cwd(), "backups");
const MAX_BACKUPS = 30; // keep the most recent 30, prune older ones

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function main() {
  if (!existsSync(DB_PATH)) {
    console.error(`Database file not found at ${DB_PATH}`);
    process.exit(1);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });

  const dest = path.join(BACKUP_DIR, `dcf-${timestamp()}.db`);

  // VACUUM INTO takes a safe, consistent snapshot even if another process has
  // the database open (WAL mode, concurrent writes) — a plain file copy could
  // grab a half-written file mid-write and produce a corrupt backup.
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
  db.close();
  console.log(`Backed up ${DB_PATH} -> ${dest}`);

  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((f) => ({ name: f, mtime: statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const old of backups.slice(MAX_BACKUPS)) {
    unlinkSync(path.join(BACKUP_DIR, old.name));
    console.log(`Pruned old backup: ${old.name}`);
  }
}

main();
