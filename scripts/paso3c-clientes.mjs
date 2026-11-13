/**
 * Paso 3c: Importar clientes (25)
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV } from "./csvUtils.mjs";

const ARCHIVO = "datos/2025/importar/clientes.csv";
const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} clientes de ${ARCHIVO}...`);

const db = openDB();
let ins = 0, upd = 0, err = 0;

for (const r of rows) {
  const cuit = (r.cuit || "").trim();
  const razon_social = (r.razon_social || "").trim();
  if (!cuit || !razon_social) continue;

  try {
    const ex = await db.execute("SELECT id FROM clientes WHERE cuit = ?", [cuit]);
    if (ex.rows.length > 0) {
      await db.execute(
        "UPDATE clientes SET razon_social=?, activo=1 WHERE cuit=?",
        [razon_social, cuit]
      );
      upd++;
    } else {
      await db.execute(
        "INSERT INTO clientes (cuit, razon_social, condicion_iva, activo) VALUES (?,?,?,1)",
        [cuit, razon_social, "Responsable Inscripto"]
      );
      ins++;
    }
  } catch (e) {
    console.error(`  ERROR ${cuit}: ${e.message}`);
    err++;
  }
}

const total = await db.execute("SELECT COUNT(*) n FROM clientes");
console.log(`\n✅ Clientes: ${ins} insertados, ${upd} actualizados, ${err} errores`);
console.log(`   Total en DB: ${total.rows[0].n}`);
db.close();
