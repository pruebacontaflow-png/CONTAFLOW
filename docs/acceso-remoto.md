# Acceso remoto a ContaFlow

## Uso rápido

Desde la carpeta del proyecto:

```
npm run compartir
```

El script hace todo solo:

1. Compila la app (`npm run build`)
2. Levanta el túnel de Cloudflare (`cloudflared tunnel --url http://localhost:3000`)
3. Escribe la URL pública en `.env.local` (para que el login de next-auth funcione correctamente)
4. Arranca el servidor (`npm start`)
5. Muestra la URL en grande en la terminal

Cuando aparece el link, cualquier persona con acceso a internet puede entrar con sus credenciales de ContaFlow.

Para cerrar: **Ctrl+C** en la misma terminal.

---

## Requisitos

- **cloudflared** instalado en la PC. Verificar con `cloudflared --version`.
  - Descarga: https://github.com/cloudflare/cloudflared/releases
  - Instalación actual: `C:\Program Files (x86)\cloudflared\cloudflared.exe`
- Conexión a internet activa.
- La PC tiene que estar encendida y el proceso corriendo para que el acceso remoto funcione.

---

## Cómo funciona la URL

Cloudflare genera una URL aleatoria cada vez que iniciás el túnel (tipo `https://eggs-closure-acne-achieve.trycloudflare.com`). Esta URL cambia con cada reinicio.

El script la detecta automáticamente en la salida de cloudflared y actualiza `NEXTAUTH_URL` en `.env.local` antes de levantar el servidor Next.js, así el login funciona correctamente sin editar nada a mano.

---

## Acceso local (desarrollo)

Para trabajar solo en la PC de Rocío sin abrir acceso externo:

```
npm run dev
```

Abre `http://localhost:3000` en el navegador.

---

## Notas de seguridad

- El link es público: cualquiera con la URL puede intentar loguearse. Las credenciales de acceso son la única barrera.
- Usá contraseñas seguras (`npm run cambiar-clave`).
- Cerrá el proceso cuando no sea necesario el acceso remoto.
- La URL expira automáticamente al cerrar el proceso.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `cloudflared: not found` | cloudflared no está en PATH | Reinstalar desde el link de arriba |
| El build falla | Error de TypeScript o dependencia rota | Revisar los errores en la terminal |
| El link aparece pero el login da error 403 | URL del túnel no coincide con NEXTAUTH_URL | Reiniciar con `npm run compartir` (actualiza el .env.local automáticamente) |
| La URL no aparece en 60 segundos | Sin conectividad a Cloudflare | Verificar internet y reintentar |
