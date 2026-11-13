#!/usr/bin/env node
/**
 * Backup de contaflow.db
 * Uso: node scripts/backup.js
 * Crea una copia en backups/contaflow-YYYY-MM-DD-HHMMSS.db
 * Mantiene los últimos 30 backups (elimina los más viejos).
 */
const fs   = require("fs");
const path = require("path");

const ROOT    = path.resolve(__dirname, "..");
const DB_SRC  = path.join(ROOT, "contaflow.db");
const BKDIR   = path.join(ROOT, "backups");
const MAX_KEEP = 30;

if (!fs.existsSync(DB_SRC)) {
  console.error(`ERROR: No se encontró ${DB_SRC}`);
  process.exit(1);
}

fs.mkdirSync(BKDIR, { recursive: true });

const now  = new Date();
const ts   = now.toISOString().replace(/[:T]/g, "-").replace(/\..+/, "");
const dest = path.join(BKDIR, `contaflow-${ts}.db`);

fs.copyFileSync(DB_SRC, dest);
console.log(`✓ Backup creado: ${dest}`);

// Rotar: eliminar los más viejos si hay más de MAX_KEEP
const archivos = fs.readdirSync(BKDIR)
  .filter(f => f.startsWith("contaflow-") && f.endsWith(".db"))
  .sort();

if (archivos.length > MAX_KEEP) {
  const aEliminar = archivos.slice(0, archivos.length - MAX_KEEP);
  for (const f of aEliminar) {
    fs.unlinkSync(path.join(BKDIR, f));
    console.log(`  eliminado backup viejo: ${f}`);
  }
}

console.log(`  Total backups: ${Math.min(archivos.length, MAX_KEEP)}`);
