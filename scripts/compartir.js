#!/usr/bin/env node
/**
 * npm run compartir
 *
 * 1. Compila la app (npm run build)
 * 2. Inicia el túnel Cloudflare (cloudflared tunnel --url http://localhost:3000)
 * 3. Lee la URL pública del túnel en cuanto aparece en la salida de cloudflared
 * 4. Actualiza NEXTAUTH_URL en .env.local con esa URL (sin editar nada a mano)
 * 5. Arranca el servidor (npm start)
 * 6. Muestra el link en grande
 *
 * Para cerrar: Ctrl+C
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const LINEA = "=".repeat(64);

// ── utilidades ────────────────────────────────────────────────────────────────

function leerEnv() {
  try {
    return fs.readFileSync(ENV_PATH, "utf8");
  } catch {
    return "";
  }
}

function actualizarNextauthUrl(nuevaUrl) {
  let contenido = leerEnv();
  if (/^NEXTAUTH_URL=/m.test(contenido)) {
    contenido = contenido.replace(/^NEXTAUTH_URL=.*/m, `NEXTAUTH_URL=${nuevaUrl}`);
  } else {
    contenido = `NEXTAUTH_URL=${nuevaUrl}\n` + contenido;
  }
  fs.writeFileSync(ENV_PATH, contenido, "utf8");
  console.log(`  💾  .env.local actualizado: NEXTAUTH_URL=${nuevaUrl}`);
}

function parsearUrl(texto) {
  const m = texto.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  return m ? m[0] : null;
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log("\n" + LINEA);
console.log("  ContaFlow — modo compartir");
console.log(LINEA + "\n");

// 1. Build ────────────────────────────────────────────────────────────────────
console.log("📦  Compilando (puede tardar ~1 min)...\n");
try {
  execSync("npm run build", { stdio: "inherit", cwd: ROOT });
} catch {
  console.error("\n❌  El build falló. Revisá los errores de arriba.\n");
  process.exit(1);
}

// 2. Túnel ────────────────────────────────────────────────────────────────────
console.log("\n🌐  Iniciando túnel Cloudflare...\n");

const tunnel = spawn("cloudflared", ["tunnel", "--url", "http://localhost:3000"], {
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
  cwd: ROOT,
});

let servidorIniciado = false;
let servidor = null;

function iniciarServidor(url) {
  if (servidorIniciado) return;
  servidorIniciado = true;

  // 3. Actualizar .env.local ──────────────────────────────────────────────────
  actualizarNextauthUrl(url);

  // 4. Servidor ───────────────────────────────────────────────────────────────
  console.log("\n🚀  Iniciando servidor ContaFlow...\n");
  servidor = spawn("npm", ["start"], {
    shell: true,
    stdio: "inherit",
    cwd: ROOT,
  });

  servidor.on("close", (code) => {
    console.log(`\n⚠️  El servidor se cerró (código ${code}). Cerrando túnel...\n`);
    tunnel.kill();
    process.exit(code ?? 0);
  });

  // 5. Mostrar link ───────────────────────────────────────────────────────────
  setTimeout(() => {
    console.log("\n" + LINEA);
    console.log("  ✅  ContaFlow está disponible en:");
    console.log("");
    console.log(`      ${url}`);
    console.log("");
    console.log("  Compartí este link con quien necesite acceder.");
    console.log("  Caduca cuando cerrás este proceso (Ctrl+C).");
    console.log(LINEA + "\n");
  }, 4000);
}

// captura stdout y stderr de cloudflared buscando la URL ─────────────────────
function procesarSalida(data) {
  const texto = data.toString();
  process.stdout.write(texto);
  const url = parsearUrl(texto);
  if (url) iniciarServidor(url);
}

tunnel.stdout.on("data", procesarSalida);
tunnel.stderr.on("data", procesarSalida);

tunnel.on("close", (code) => {
  console.log(`\n⚠️  El túnel se cerró (código ${code}). Deteniendo servidor...\n`);
  if (servidor) servidor.kill();
  process.exit(code ?? 0);
});

// Ctrl+C ──────────────────────────────────────────────────────────────────────
process.on("SIGINT", () => {
  console.log("\n\n👋  Cerrando ContaFlow...\n");
  if (tunnel) tunnel.kill();
  if (servidor) servidor.kill();
  setTimeout(() => process.exit(0), 500);
});

// Timeout de seguridad ────────────────────────────────────────────────────────
setTimeout(() => {
  if (!servidorIniciado) {
    console.error(
      "\n⏰  No se pudo obtener la URL del túnel en 60 segundos.\n" +
      "    Verificá que cloudflared esté instalado y tenga conectividad.\n"
    );
    if (tunnel) tunnel.kill();
    process.exit(1);
  }
}, 60_000);
