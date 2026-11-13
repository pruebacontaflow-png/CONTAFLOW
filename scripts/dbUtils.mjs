import { createClient } from "@libsql/client";
import { copyFileSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../contaflow.db");
const BACKUPS_DIR = path.resolve(__dirname, "../backups");

export function openDB() {
  return createClient({ url: `file:/${DB_PATH.replace(/\\/g, "/")}` });
}

export function backupDB(tag = "pre-carga") {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(BACKUPS_DIR, `contaflow-${tag}-${ts}.db`);
  copyFileSync(DB_PATH, dest);
  console.log("✅ Backup:", dest);
  return dest;
}

export async function tryAlter(db, table, colDef) {
  const colName = colDef.trim().split(/\s+/)[0];
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    console.log(`  + ${table}.${colName}`);
  } catch {
    // column already exists — OK
  }
}

export function log(msg) { console.log(msg); }
