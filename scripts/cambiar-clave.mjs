// Cambia la contraseña de un usuario de ContaFlow (o crea el usuario si no existe).
// Uso: node scripts/cambiar-clave.mjs            -> pregunta usuario y contraseña
// La contraseña no se muestra en pantalla ni se guarda en ningún archivo (solo su hash).
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import path from "path";
import readline from "readline";

const dbPath = path.join(process.cwd(), "contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: dbPath.startsWith("/") ? `file:${dbPath}` : `file:/${dbPath}` });

function preguntar(texto, oculto = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(texto); else rl.output.write("*"); };
    }
    rl.question(texto, r => { rl.close(); if (oculto) process.stdout.write("\n"); resolve(r.trim()); });
  });
}

const actuales = await db.execute("SELECT username, rol, activo FROM usuarios ORDER BY id");
console.log("\nUsuarios actuales:");
for (const u of actuales.rows) console.log(`  - ${u.username} (${u.rol})${Number(u.activo) ? "" : " [inactivo]"}`);
const usuario = await preguntar("\nUsuario a cambiar o crear: ");
if (!usuario) { console.log("Cancelado."); process.exit(0); }
const existe = actuales.rows.find(u => u.username === usuario);
let rol = existe?.rol;
if (!existe) {
  rol = (await preguntar("No existe. Rol del usuario nuevo (admin / contador): ")) || "admin";
}
const p1 = await preguntar("Contraseña nueva (mínimo 8 caracteres): ", true);
if (p1.length < 8) { console.log("La contraseña es muy corta. No se cambió nada."); process.exit(1); }
const p2 = await preguntar("Repetí la contraseña: ", true);
if (p1 !== p2) { console.log("Las contraseñas no coinciden. No se cambió nada."); process.exit(1); }
const hash = await bcrypt.hash(p1, 12);
if (existe) await db.execute({ sql: "UPDATE usuarios SET password_hash = ?, activo = 1 WHERE username = ?", args: [hash, usuario] });
else await db.execute({ sql: "INSERT INTO usuarios (username, password_hash, rol, activo) VALUES (?, ?, ?, 1)", args: [usuario, hash, rol] });
console.log(`Listo: contraseña ${existe ? "cambiada" : "creada"} para "${usuario}".`);
