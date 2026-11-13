/**
 * Importa proveedores desde un CSV con el siguiente formato:
 *
 *   cuit,razon_social,condicion_iva,direccion,telefono,email,contacto
 *   30-71234567-8,PROVEEDOR SA,Responsable Inscripto,Av. Corrientes 123,...
 *
 * El script actualiza si el CUIT ya existe, o inserta si es nuevo.
 * Uso: node scripts/importar-proveedores.mjs datos/2025/proveedores.csv
 *   o para ver un ejemplo: node scripts/importar-proveedores.mjs --ejemplo
 */
import { createClient } from "@libsql/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, "../contaflow.db");
const db = createClient({ url: `file:/${dbFile.replace(/\\/g, "/")}` });

const EJEMPLO = `cuit,razon_social,condicion_iva,direccion,telefono,email,contacto
30-71234567-8,PROVEEDORES EJEMPLO SA,Responsable Inscripto,Av. Corrientes 123 CABA,011-4555-1234,info@ejemplo.com,Juan Pérez
30-68901234-5,SERVICIOS SRL,Monotributista,Mendoza 456 Rosario,0341-555-5678,contacto@srl.com,María García`;

if (process.argv[2] === "--ejemplo") {
  console.log("Formato de CSV para proveedores:\n");
  console.log(EJEMPLO);
  process.exit(0);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Uso: node scripts/importar-proveedores.mjs <archivo.csv>");
  console.error("     node scripts/importar-proveedores.mjs --ejemplo");
  process.exit(1);
}

let headers = null;
let insertados = 0, actualizados = 0, errores = 0;
let linea = 0;

const rl = createInterface({ input: createReadStream(csvPath) });

for await (const line of rl) {
  linea++;
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) continue;

  const cols = raw.split(",").map(c => c.trim().replace(/^"|"$/g, ""));

  if (!headers) {
    headers = cols.map(h => h.toLowerCase().replace(/\s+/g, "_"));
    console.log(`Columnas detectadas: ${headers.join(", ")}`);
    continue;
  }

  const row = {};
  headers.forEach((h, i) => { row[h] = cols[i] || ""; });

  const cuit = (row.cuit || "").replace(/\s/g, "");
  if (!cuit || !row.razon_social) {
    console.error(`Línea ${linea}: falta cuit o razon_social — omitida`);
    errores++;
    continue;
  }

  try {
    const existing = await db.execute(
      `SELECT id FROM proveedores WHERE cuit = ?`, [cuit]
    );

    if (existing.rows.length > 0) {
      await db.execute(
        `UPDATE proveedores SET
           razon_social = ?,
           condicion_iva = ?,
           direccion = ?,
           telefono = ?,
           email = ?,
           contacto = ?
         WHERE cuit = ?`,
        [
          row.razon_social,
          row.condicion_iva || "Responsable Inscripto",
          row.direccion || "",
          row.telefono || "",
          row.email || "",
          row.contacto || "",
          cuit,
        ]
      );
      actualizados++;
      console.log(`  ↻ ${cuit} ${row.razon_social} (actualizado)`);
    } else {
      await db.execute(
        `INSERT INTO proveedores (cuit, razon_social, condicion_iva, direccion, telefono, email, contacto)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          cuit,
          row.razon_social,
          row.condicion_iva || "Responsable Inscripto",
          row.direccion || "",
          row.telefono || "",
          row.email || "",
          row.contacto || "",
        ]
      );
      insertados++;
      console.log(`  + ${cuit} ${row.razon_social} (nuevo)`);
    }
  } catch (err) {
    console.error(`  Línea ${linea}: ERROR — ${err.message}`);
    errores++;
  }
}

console.log(`\nResultado: ${insertados} nuevos, ${actualizados} actualizados, ${errores} errores`);
db.close();
