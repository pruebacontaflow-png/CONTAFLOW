import db from "./db";

/** Retorna un mensaje de error si el período está cerrado, o null si está abierto. */
export async function checkPeriodoCerrado(fecha: string): Promise<string | null> {
  const d = new Date(fecha);
  const anio = d.getFullYear();
  const mes  = d.getMonth() + 1;
  const periodo = await db.get(
    `SELECT cerrado FROM periodos_contables WHERE anio=? AND mes=?`,
    [anio, mes]
  );
  if (periodo?.cerrado) {
    return `El período ${mes.toString().padStart(2, "0")}/${anio} está cerrado. No se pueden registrar operaciones en él.`;
  }
  return null;
}
