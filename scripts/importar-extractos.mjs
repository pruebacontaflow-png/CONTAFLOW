/**
 * Importa extractos bancarios desde CSV del banco.
 *
 * Formato genérico (el script autodetecta columnas comunes):
 *   fecha, descripcion, debito, credito, saldo
 *   fecha, descripcion, importe, saldo         (importe negativo = débito)
 *
 * Uso:
 *   node scripts/importar-extractos.mjs <cuenta_id> <archivo.csv>
 *   node scripts/importar-extractos.mjs --cuentas          (lista cuentas disponibles)
 *   node scripts/importar-extractos.mjs --ejemplo
 *
 * Ejemplo:
 *   node scripts/importar-extractos.mjs 1 datos/2025/extracto-enero-2025.csv
 */
import { createClient } from "@libsql/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, "../contaflow.db");
const db = createClient({ url: `file:/${dbFile.replace(/\\/g, "/")}` });

const EJEMPLO = `fecha,descripcion,debito,credito,saldo
2025-01-02,Saldo inicial,,,500000
2025-01-05,TRANSF RECIBIDA CLIENTE SA,0,120000,620000
2025-01-10,PAGO PROVEEDORES SRL,45000,0,575000
2025-01-15,COMISIONES BANCO,-850,0,574150`;

if (process.argv[2] === "--ejemplo") {
  console.log("Formato CSV para extractos bancarios:\n\n" + EJEMPLO);
  process.exit(0);
}

if (process.argv[2] === "--cuentas") {
  const cuentas = await db.execute(`SELECT id, banco, tipo, moneda FROM cuentas_bancarias ORDER BY id`);
  if (cuentas.rows.length === 0) {
    console.log("No hay cuentas bancarias registradas. Creá una desde la UI en /bancos.");
  } else {
    console.log("Cuentas bancarias disponibles:");
    cuentas.rows.forEach(c => console.log(`  ${c.id}  ${c.banco}  ${c.tipo}  ${c.moneda}`));
  }
  db.close();
  process.exit(0);
}

const cuentaId = parseInt(process.argv[2]);
const csvPath  = process.argv[3];

if (isNaN(cuentaId) || !csvPath) {
  console.error("Uso: node scripts/importar-extractos.mjs <cuenta_id> <archivo.csv>");
  process.exit(1);
}

// Verificar que la cuenta existe
const cuenta = await db.execute(`SELECT id, banco, tipo FROM cuentas_bancarias WHERE id=?`, [cuentaId]);
if (cuenta.rows.length === 0) {
  console.error(`Cuenta ${cuentaId} no encontrada. Usá --cuentas para ver las disponibles.`);
  process.exit(1);
}
console.log(`Cuenta: ${cuenta.rows[0].banco} — ${cuenta.rows[0].tipo}`);

// Hash del archivo para evitar duplicados
const fileBuffer = fs.readFileSync(csvPath);
const hashArchivo = crypto.createHash("sha256").update(fileBuffer).digest("hex");
const existing = await db.execute(
  `SELECT id FROM extractos_bancarios WHERE hash_archivo = ?`, [hashArchivo]
);
if (existing.rows.length > 0) {
  console.error("Este archivo ya fue importado anteriormente (mismo hash). Omitiendo.");
  db.close();
  process.exit(0);
}

function parseFecha(s) {
  s = (s || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y]=s.split("/"); return `${y}-${m}-${d}`; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}
function n(val) { return parseFloat(String(val || "0").replace(",", ".").replace(/[^0-9.-]/g, "")) || 0; }

let headers = null;
const lineas = [];
let linea = 0;

const rl = createInterface({ input: createReadStream(csvPath) });
for await (const line of rl) {
  linea++;
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) continue;
  const cols = raw.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
  if (!headers) {
    headers = cols.map(h => h.toLowerCase().replace(/\s+/g, "_")
      .replace("débito", "debito").replace("crédito", "credito"));
    console.log(`Columnas detectadas: ${headers.join(", ")}`);
    continue;
  }
  const row = {};
  headers.forEach((h, i) => { row[h] = cols[i] || ""; });
  lineas.push(row);
}

console.log(`\n${lineas.length} movimientos a importar...`);

// Crear registro de extracto
const extractoIns = await db.execute(
  `INSERT INTO extractos_bancarios (cuenta_id, nombre_archivo, fecha_subida, total_movimientos, hash_archivo)
   VALUES (?,?,datetime('now'),?,?)`,
  [cuentaId, path.basename(csvPath), lineas.length, hashArchivo]
);
const extractoId = Number(extractoIns.lastInsertRowid);

let insertados = 0, omitidos = 0;

for (const row of lineas) {
  const fecha = parseFecha(row.fecha);
  if (!fecha || fecha === "") { omitidos++; continue; }

  let importe = 0;
  if (headers.includes("debito") && headers.includes("credito")) {
    importe = n(row.credito) - n(row.debito);
  } else if (headers.includes("importe")) {
    importe = n(row.importe);
  } else if (headers.includes("monto")) {
    importe = n(row.monto);
  }

  const saldo = n(row.saldo || row.saldo_final || "0");
  const descripcion = row.descripcion || row.concepto || row.detalle || "";

  try {
    const debito  = importe < 0 ? Math.abs(importe) : 0;
    const credito = importe >= 0 ? importe : 0;
    await db.execute(
      `INSERT INTO extractos_lineas (extracto_id, fecha, descripcion, debito, credito, saldo, conciliado)
       VALUES (?,?,?,?,?,?,0)`,
      [extractoId, fecha, descripcion, debito, credito, saldo]
    );
    insertados++;
  } catch (err) {
    console.error(`  Error en línea: ${err.message}`);
    omitidos++;
  }
}

// Actualizar saldo de la cuenta con el último saldo del extracto
if (lineas.length > 0) {
  const ultimo = lineas[lineas.length - 1];
  const saldoFinal = n(ultimo.saldo || ultimo.saldo_final || "0");
  if (saldoFinal !== 0) {
    await db.execute(
      `UPDATE cuentas_bancarias SET saldo_actual=?, updated_at=datetime('now') WHERE id=?`,
      [saldoFinal, cuentaId]
    );
    console.log(`  Saldo actualizado: $${saldoFinal.toLocaleString("es-AR")}`);
  }
}

console.log(`\nResultado: ${insertados} movimientos importados, ${omitidos} omitidos`);
console.log(`Extracto ID: ${extractoId}`);
db.close();
