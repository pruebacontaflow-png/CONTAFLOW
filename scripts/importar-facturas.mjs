/**
 * Importa facturas recibidas (compras) desde CSV.
 *
 * Formato mínimo del CSV:
 *   cuit_emisor, razon_social_emisor, tipo_comprobante, punto_venta, numero,
 *   fecha_emision, fecha_vencimiento, neto_gravado, iva_21, iva_10_5, iva_27,
 *   percepcion_iva, percepcion_iibb, percepcion_otras, total, cae, concepto
 *
 * Uso: node scripts/importar-facturas.mjs datos/2025/facturas-recibidas.csv
 *   o: node scripts/importar-facturas.mjs --ejemplo
 *
 * Notas:
 * - Si el CUIT del emisor no existe en proveedores, se crea automáticamente.
 * - Duplicados detectados por: cuit_emisor + tipo_comprobante + punto_venta + numero.
 * - Fechas en formato YYYY-MM-DD.
 */
import { createClient } from "@libsql/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, "../contaflow.db");
const db = createClient({ url: `file:/${dbFile.replace(/\\/g, "/")}` });

const EJEMPLO = `cuit_emisor,razon_social_emisor,tipo_comprobante,punto_venta,numero,fecha_emision,fecha_vencimiento,neto_gravado,iva_21,iva_10_5,iva_27,percepcion_iva,percepcion_iibb,percepcion_otras,total,cae,concepto
30-71234567-8,PROVEEDORES EJEMPLO SA,Factura A,1,00001234,2025-01-15,2025-02-15,100000,21000,0,0,0,3500,0,124500,12345678901234,,Servicios enero
20-45678901-2,SERVICIOS SRL,Factura B,1,00000567,2025-02-01,2025-03-01,5000,0,525,0,0,0,0,5525,98765432109876,,Honorarios`;

if (process.argv[2] === "--ejemplo") {
  console.log("Formato CSV para facturas recibidas:\n");
  console.log(EJEMPLO);
  process.exit(0);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Uso: node scripts/importar-facturas.mjs <archivo.csv>");
  process.exit(1);
}

function parseFecha(s) {
  if (!s) return "";
  s = s.trim();
  // Acepta DD/MM/YYYY o YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m}-${d}`;
  }
  return s;
}

function n(val) { return parseFloat(String(val).replace(",", ".") || "0") || 0; }

let headers = null;
let insertados = 0, duplicados = 0, errores = 0;
let linea = 0;

const rl = createInterface({ input: createReadStream(csvPath) });

for await (const line of rl) {
  linea++;
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) continue;

  const cols = raw.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
  if (!headers) {
    headers = cols.map(h => h.toLowerCase().replace(/\s+/g, "_"));
    console.log(`Columnas: ${headers.join(", ")}`);
    continue;
  }

  const row = {};
  headers.forEach((h, i) => { row[h] = cols[i] || ""; });

  const cuit = (row.cuit_emisor || "").replace(/[-\s]/g, "");
  const tipo = row.tipo_comprobante || "";
  const pv   = row.punto_venta || "";
  const num  = row.numero || "";

  if (!cuit || !tipo || !num) {
    console.error(`Línea ${linea}: datos incompletos — omitida`);
    errores++;
    continue;
  }

  try {
    // Verificar duplicado
    const dup = await db.execute(
      `SELECT id FROM facturas_recibidas
       WHERE replace(cuit_emisor,'-','') = ? AND tipo_comprobante = ? AND punto_venta = ? AND numero = ?`,
      [cuit, tipo, pv, num]
    );
    if (dup.rows.length > 0) {
      duplicados++;
      console.log(`  ⊘ ${cuit} ${tipo} ${pv}-${num} (duplicado)`);
      continue;
    }

    // Buscar o crear proveedor
    let proveedorId = null;
    const prov = await db.execute(
      `SELECT id FROM proveedores WHERE replace(cuit,'-','') = ?`, [cuit]
    );
    if (prov.rows.length > 0) {
      proveedorId = Number(prov.rows[0].id);
    } else {
      // Auto-crear proveedor mínimo
      const ins = await db.execute(
        `INSERT INTO proveedores (cuit, razon_social, condicion_iva)
         VALUES (?, ?, 'Responsable Inscripto')`,
        [row.cuit_emisor || cuit, row.razon_social_emisor || cuit]
      );
      proveedorId = Number(ins.lastInsertRowid);
      console.log(`  + Proveedor creado: ${row.cuit_emisor} ${row.razon_social_emisor}`);
    }

    const iva21   = n(row.iva_21);
    const iva105  = n(row.iva_10_5);
    const iva27   = n(row.iva_27);
    const ivaTotal = iva21 + iva105 + iva27;
    const neto    = n(row.neto_gravado);
    const total   = n(row.total);

    const ins = await db.execute(
      `INSERT INTO facturas_recibidas (
         proveedor_id, tipo_comprobante, punto_venta, numero,
         fecha_emision, fecha_vencimiento,
         importe_neto, importe_iva, importe_total,
         neto_gravado, neto_no_gravado, exento,
         percepcion_iva, percepcion_iibb, percepcion_otras,
         moneda, tipo_cambio, cuit_emisor,
         cae, vencimiento_cae,
         concepto, estado, origen
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        proveedorId, tipo, pv, num,
        parseFecha(row.fecha_emision), parseFecha(row.fecha_vencimiento || row.fecha_emision),
        neto, ivaTotal, total,
        neto, n(row.neto_no_gravado), n(row.exento),
        n(row.percepcion_iva), n(row.percepcion_iibb), n(row.percepcion_otras),
        row.moneda || "ARS", n(row.tipo_cambio) || 1,
        row.cuit_emisor || cuit,
        row.cae || "", parseFecha(row.vencimiento_cae),
        row.concepto || "", "pendiente_pago", "importacion_csv",
      ]
    );

    const factId = Number(ins.lastInsertRowid);

    // IVA detalle
    for (const [alicuota, importe, netoItem] of [
      ["21%",   iva21,  neto],
      ["10.5%", iva105, 0],
      ["27%",   iva27,  0],
    ]) {
      if (importe > 0) {
        await db.execute(
          `INSERT INTO facturas_iva_detalle (factura_id, tipo_factura, alicuota, neto, iva)
           VALUES (?,?,?,?,?)`,
          [factId, "recibida", alicuota, netoItem, importe]
        );
      }
    }

    insertados++;
    console.log(`  ✓ ${row.cuit_emisor} ${tipo} ${pv}-${num} $${total.toLocaleString("es-AR")}`);
  } catch (err) {
    console.error(`  Línea ${linea}: ERROR — ${err.message}`);
    errores++;
  }
}

console.log(`\nResultado: ${insertados} insertadas, ${duplicados} duplicadas, ${errores} errores`);
db.close();
