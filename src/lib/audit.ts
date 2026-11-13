import db from "./db";

export async function audit(
  usuario: string,
  accion: string,
  entidad_tipo: string,
  entidad_id: number | null,
  valor_anterior: unknown = null,
  valor_nuevo: unknown = null
): Promise<void> {
  try {
    await db.run(
      `INSERT INTO auditoria (usuario,accion,entidad_tipo,entidad_id,valor_anterior,valor_nuevo)
       VALUES (?,?,?,?,?,?)`,
      [
        usuario,
        accion,
        entidad_tipo,
        entidad_id ?? null,
        valor_anterior ? JSON.stringify(valor_anterior) : "",
        valor_nuevo    ? JSON.stringify(valor_nuevo)    : "",
      ]
    );
  } catch (e) {
    console.warn("[audit] Error registrando auditoría:", e);
  }
}
