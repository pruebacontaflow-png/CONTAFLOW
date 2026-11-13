# Prompt para Claude Code — ContaFlow etapa 6 (reunión con Maricel del 13/11/2026)

Pegá todo lo que está debajo de la línea en Claude Code, parado en `C:\Users\rocio\Documents\contaflow`.

---

Seguimos con ContaFlow. Reglas de siempre:
- Cero datos inventados. Si falta un dato, el campo queda vacío y se informa.
- Backup de `contaflow.db` en `backups/` antes de tocar la base.
- No ajustar importes para que cierren.
- Interfaz en español, formato argentino ($ 1.234,56 y fechas dd/mm/aaaa).
- Al terminar cada bloque: `npx tsc --noEmit` sin errores, mostrame qué cambió y cómo probarlo, y frená.

## Ya está hecho, no rehacer
- Barra lateral en acordeón. Inicio tiene solo Dashboard. Vencimientos y Cash Flow están en Administración. Ya están renombrados "Tratamiento cheques", "Rendiciones" e "Impuestos (DDJJ, SICORE, IIBB)".
- PDF de OP y de retención provisorio en `/api/ordenes-pago/[id]/pdf` (y `?tipo=retencion`), con `src/lib/pdf-simple.ts` sin dependencias. Hoy copia el formato de Tango: se rediseña en el Bloque 0. Con `?original=1` se ve el PDF que emitió Tango (respaldo de las OPs de sep–dic 2025, en `tango_pdf_path` / `tango_ret_paths`).
- 164 OPs de Tango (sep–dic 2025) asociadas a las OPs de ContaFlow: `op_nro_tango`, PDF original y certificados de retención en `facturas-pdf/ops-tango/`.
- Impuestos: tabla `declaraciones_juradas` con DDJJ (PDF en `archivo_path`) y pagos del extracto.
- Facturas recibidas anuladas por NC: estado `anulada` y la NC queda `nc_aplicada`. El detalle va en `comentario_admin`.
- Lotes: pestañas Vigentes y Ejecutados. El lote se crea con "Fecha de pago" y se llama "Lote dd.mm.aaaa".
- Login sin usuarios de prueba a la vista. Script `npm run cambiar-clave`.
- `/api/archivo?path=datos/...` sirve archivos de respaldo con sesión iniciada.
- Diferencias con ARCA en `/conciliacion/diferencias`.

## BLOQUE 0 — PDFs con diseño propio de ContaFlow
Todo PDF que genere el sistema tiene que tener diseño propio de ContaFlow, no el de Tango. Esto incluye la orden de pago, el comprobante de retención, la orden de pago en efectivo, los datos bancarios y cualquier otro que se agregue.

- Crear un módulo único de PDFs (`src/lib/pdf/`) con un encabezado y un pie comunes:
  - Encabezado: razón social, CUIT, domicilio y logo de la empresa (tomados de la configuración de la empresa en `parametros`, editables, no escritos en el código).
  - Pie: "Generado por ContaFlow", fecha y hora, número de página.
- Tipografía y colores del sistema: tablas con bordes suaves, importes alineados a la derecha en formato argentino ($ 1.234,56) y fechas dd/mm/aaaa. Se puede usar una librería (`pdf-lib` o `@react-pdf/renderer`). Instalarla con `npm install` en la PC de Rocío, no copiando archivos.
- **Orden de pago:**
  - Número de OP de ContaFlow, y el N° de OP de Tango si tiene.
  - Fecha, proveedor (código, razón social, CUIT, CBU).
  - Comprobantes imputados (tipo, número, fecha, vencimiento, importe).
  - Retenciones (impuesto, régimen, base, importe, N° de certificado).
  - Bruto, retenciones y neto a transferir; cuenta bancaria de salida y fecha de la transferencia.
  - Neto en letras y espacio de firma.
- **Comprobante de retención:**
  - Agente de retención, sujeto retenido (con domicilio), impuesto, régimen, comprobante que origina la retención, base, alícuota, importe retenido y número de certificado.
  - Original y duplicado, y firma de Lucas Jinkis, Presidente (tomada de `parametros`).
  - Los datos tienen que cubrir lo que exige el certificado SICORE: comparalo con los certificados de `facturas-pdf/ops-tango/*_G*.pdf`.
- El botón "OP" y el botón "Ret." de Órdenes de pago generan siempre el PDF de ContaFlow. Agregar un botón chico "Original Tango" solo en las OPs que lo tienen.
- Mostrame un PDF de ejemplo de cada tipo antes de seguir.

## BLOQUE 0.1 — GitHub
Rocío va a crear la cuenta de GitHub y un repositorio **privado**. Cuando te pase el link:

1. Hacer `git init` en la carpeta del proyecto y revisar que `.gitignore` deje afuera:
   - la base y sus backups (`*.db`, `*.db.*`, `contaflow_*.db`);
   - `.env.local`;
   - `datos/`, `facturas-pdf/` y `backups/`;
   - `node_modules/` y `.next/`;
   - certificados (`*.pem`, `*.key`, `*.crt`).

   Antes del primer commit, listame los archivos que se van a subir y buscá contraseñas, tokens o CUIT/CBU reales escritos en el código. Las contraseñas de prueba de `init-db.js`, `init-db.mjs` y `README.md` se reemplazan por variables o se eliminan.
2. Primer commit y push al repositorio. Explicale a Rocío cómo autenticarse (GitHub CLI `gh auth login` o token), paso a paso, sin que el token quede guardado en ningún archivo del proyecto.
3. De acá en adelante, al terminar cada bloque: commit con un mensaje claro en español y push.

## BLOQUE 0.2 — Un solo circuito y controles de cuadre (va antes que todo lo demás)
ContaFlow va a ser el 90% de la administración de la empresa. Todo tiene que salir de un solo circuito y las cuentas tienen que coincidir siempre.

1. **Revisión de consistencia del código.** Hoy hay módulos hechos por separado que usan estados y columnas distintos para lo mismo (ya pasó con `pagado`/`pagada` y con el dashboard comercial, que consultaba columnas que no existen).
   - Definí en `src/lib/estados.ts` los estados válidos de cada entidad (facturas recibidas y emitidas, OPs, lotes, DDJJ, rendiciones) y usalos en todo el código y en la base.
   - Revisá que ninguna consulta use columnas que no existen (ejecutá cada API con datos reales y listá errores).
2. **Circuito único.** Cada hecho se registra una sola vez y lo demás se calcula:
   - factura → OP → movimiento bancario → asiento;
   - retención → certificado → DDJJ SICORE → VEP pagado;
   - venta → cobro → IVA débito;
   - rendición → OP (transferencia o efectivo) → caja chica.

   Los saldos (proveedor, cliente, banco, caja) nunca se guardan a mano: se calculan desde los movimientos.
3. **Pantalla "Controles de cuadre"** (en Contabilidad), con semáforo verde o rojo y el detalle de cada diferencia. Se recalcula al abrirla y por mes:
   - saldo del banco en el sistema = último saldo del extracto;
   - suma de OPs pagadas = débitos a proveedores del extracto;
   - facturas recibidas y emitidas = ARCA (Mis Comprobantes), en cantidad e importe;
   - libro IVA = DDJJ de IVA presentada (débito y crédito);
   - retenciones de las OPs = DDJJ SICORE del mes;
   - saldo de caja chica = ingresos − egresos;
   - total de rendiciones pagadas = OPs de rendición;
   - asientos: debe = haber en cada asiento y en el total;
   - mayor de cada cuenta = movimientos que la originan;
   - pendiente de proveedores y clientes a una fecha = lo que sale de la cuenta corriente y del resumen (mismo cálculo).
4. Ningún cambio de otro bloque se da por terminado si rompe un control que antes daba verde.

## BLOQUE A — Dashboard (Inicio)
1. Período: reemplazar "1er/2do semestre" por un selector de meses con selección múltiple (enero solo, enero + febrero, etc.). Atajos: "Mes vigente", "Mes anterior", "Año vigente". El año se elige aparte.
2. Tarjetas del período:
   - **Ventas del período:** facturado sin IVA (neto gravado + no gravado + exento de facturas emitidas, las NC restan).
   - **Ingresos por banco:** créditos del extracto en el período.
   - **Egresos por banco:** débitos del extracto en el período.
   - **Cobros por vencer a 7 días:** facturas emitidas pendientes con vencimiento entre hoy y hoy + 7.
   - **Saldo total bancario** (reemplaza "Saldo Total ARS").
3. Sacar del dashboard las tarjetas de notas de crédito recibidas y emitidas, y el gráfico "por tipo de comprobante". Ese gráfico pasa a las pantallas de Clientes y de Proveedores.
4. Reemplazar "Evaluación mensual por período" por dos gráficos mensuales:
   - **Flujo de caja neto operativo:** créditos menos débitos del banco por mes. Excluye movimientos no operativos según `cuenta_tango`: préstamos (11475), cuenta particular LJ (11485), anticipos LJ (11404), y cualquier otra que se defina en una tabla de configuración editable.
   - **Flujo neto operativo contable:** ventas netas devengadas menos compras netas devengadas, por fecha de emisión (las NC restan).
   - Mostrá en pantalla, en una línea, cómo se calcula cada uno.
5. Próximos vencimientos agrupados por categoría: Proveedores, Impuestos, Seguros, Servicios, Sueldos y salarios. Cada grupo muestra total y cantidad. Con doble clic se abre el desglose. Proveedores sale de facturas recibidas pendientes (vencimiento = emisión + 30 días, ya cargado). Impuestos sale del calendario del Bloque E. Servicios y seguros salen de `servicios_recurrentes`. Sueldos sale de nóminas.

## BLOQUE B — Tesorería
6. **Dashboard bancos** como primer submódulo de Tesorería. Reemplaza "Saldos bancarios", que se elimina.
   - Una tarjeta por banco: saldo, último movimiento, movimientos sin conciliar.
   - Al entrar a un banco: datos de la cuenta (banco, titular IT CLICK VIDEO S.A., CUIT 30-71475972-4, tipo y número de cuenta, CBU, alias) y botón **"Descargar datos bancarios (PDF)"** para mandarle a un cliente.
   - Los datos que no estén cargados quedan vacíos y editables. No inventar el CBU.
7. **Conexión automática con el banco:** no implementar. Investigá y escribí en `docs/conexion-banco.md` las opciones reales para Credicoop: API del banco, agregadores, descarga programada del extracto. Para cada una: costo, requisitos y riesgos.
8. **Asiento al conciliar.** Al conciliar una línea del extracto (automático o manual) se genera el asiento contable de doble partida en `asientos` / `asientos_lineas`. Por ejemplo, comisión bancaria $100: Debe 42701 Comisiones Bancarias $100, Haber 11154 Banco Credicoop $100, total 0.
   - La contrapartida sale de la `cuenta_tango` de la línea o de la OP o cobro asociado: pago a proveedor → 21101, cobro → 11301, impuestos → la cuenta del impuesto.
   - Si la línea tiene dos cuentas o no tiene cuenta, no se genera asiento y queda en una lista de pendientes.
   - Cada asiento guarda la referencia interna (línea de extracto, OP o factura) y se ve desde la línea conciliada.
   - Los asientos quedan en estado "borrador — a validar con la contadora" hasta que se confirmen.
   - Agregá una tabla de reglas de asiento por tipo de movimiento, editable, para revisarla con Sole.
9. **Lote de pagos:**
   - Al crear el lote con su fecha de pago, traer todo lo vencido o por vencer hasta esa fecha para seleccionar y sumar: facturas de proveedores pendientes, impuestos (DDJJ pendientes del calendario), servicios recurrentes y sueldos. Mostrar el total seleccionado.
   - Vista de lote ejecutado con columnas: Proveedor, Nº factura, Descripción, Monto que salió por banco, Nº de OP (la genera el sistema al ejecutar el lote).
   - El nombre del lote es la fecha de pago. La "fecha" es el día en que se creó.
10. **Tarjeta corporativa:** rediseño al estilo Clara (https://www.clara.com). Tarjetas por persona con límite y consumo del mes, gastos con comercio, categoría y comprobante adjunto, gastos sin comprobante marcados, filtro por tarjeta y por mes. Solo diseño y estructura: no cargar datos de ejemplo.
11. **Rendiciones** (antes "Viáticos y comidas"):
    - Una fila por rendición (persona + archivo de rendición) con el total. Con doble clic se abre el desglose renglón por renglón.
    - Descripción por categoría: "Viático comida", "Viático transporte", "Viático celular" (y "Otro"). Las de 2025 se clasifican por el texto de la descripción; las que no se puedan clasificar quedan como "Otro".
    - La columna "Pago" pasa a llamarse **"Medio de pago"**.
    - Cada rendición pagada genera una OP: por transferencia, OP normal; en efectivo, OP con numeración propia `OPE 2025-0001` (orden de pago en efectivo), con el mismo PDF de OP y la caja chica como cuenta.
12. **Fondo fijo:** rediseño completo.
    - Arriba, el efectivo disponible por moneda (ARS y USD), sin división por proyecto.
    - Debajo, ingresos y egresos de la caja con fecha, concepto, importe y saldo, filtrable por moneda y por mes.
    - Las cajas actuales (Time Out Pesos, Time Out USD, Glup! USD, Control Mari) se suman por moneda. El detalle de cada caja queda accesible.

## BLOQUE C — Proveedores
13. **Maestro de proveedores:** columnas CÓDIGO · RAZÓN SOCIAL · CUIT · SERVICIO · CBU · ESTADO, y una flecha que despliega mail, carpeta de Drive y teléfono. El código es `codigo_proveedor`, ya cargado desde Tango para los que tienen OP.
14. **Retenciones automáticas al dar de alta un proveedor.**
    - Consultar el padrón de ARCA (constancia de inscripción, web service `ws_sr_constancia_inscripcion` o `ws_sr_padron_a5` con el certificado de la empresa) para traer condición en IVA, Ganancias (inscripto / no inscripto / monotributo) e IIBB.
    - Con eso, sugerir si corresponde retener y con qué régimen (por ejemplo, Ganancias 94 locaciones de obra o servicios).
    - La regla queda en una tabla editable para validarla con Sole. Hasta que se valide, se muestra como "sugerida".
    - Si el certificado de ARCA no está configurado, dejarlo preparado y explicar en `docs/padron-arca.md` qué hace falta.
15. **Facturas recibidas:** las NC nuevas que se carguen tienen que imputarse a su factura (mismo proveedor e importe, o elegida a mano). La factura queda "Anulada (NC)" y en su detalle se ve la NC que la anula, igual que lo que ya está cargado. Ejemplo: Kuravsky FC A 3-820 anulada por NC A 3-23.
16. **Órdenes de pago:** hoy da error al crear una nueva. Flujo pedido:
    1. "Generar OP".
    2. Elegir proveedor. Se despliegan sus facturas pendientes, sin las anuladas.
    3. Seleccionar las facturas.
    4. El sistema calcula retenciones y el **neto a transferir**.
    5. Se guarda la OP con numeración correlativa.
    6. Se genera el PDF con el formato Tango ya existente.
    7. Se adjunta el comprobante de pago del banco.

    Probalo creando una OP de prueba y borrándola después.

## BLOQUE D — Impuestos
17. **Calendario de vencimientos.** Vencimientos de IVA, SICORE (Ganancias retenciones, 1ª quincena y mensual), IIBB CABA, anticipos de Ganancias, Bienes Personales acciones y participaciones, y cargas sociales, para CUIT terminado en 4.
    - Las fechas salen del calendario oficial de ARCA y AGIP del año. No inventar fechas: si no podés descargarlo, dejá la tabla lista para importarlo y decime qué archivo hace falta.
    - Vista mensual y lista. Cada vencimiento se vincula con la DDJJ y el pago cargados.
18. **Liquidación automática (borrador):**
    - **IVA:** débito fiscal del libro de ventas menos crédito fiscal del libro de compras, menos retenciones y percepciones, menos saldo a favor del período anterior (tomado de la última DDJJ cargada).
    - **SICORE:** retenciones de Ganancias de las OPs del período, por quincena y mes.
    - **IIBB CABA:** base imponible por ventas netas del mes × alícuota de la DDJJ (hoy 3%), menos retenciones, percepciones y SIRCREB.
    - Mostrar el cálculo paso a paso. Comparar contra la DDJJ presentada de los meses de 2025 que ya están cargados e informar diferencias.
    - Todo queda como "borrador a validar con la contadora".

## BLOQUE E — Acceso remoto
19. Crear `npm run compartir`: compila (`npm run build`), levanta `npm start` y el túnel `cloudflared tunnel --url http://localhost:3000`, y muestra el link en grande.
    - Configurar next-auth para que el login funcione desde el link sin editar `.env.local` cada vez (`trustHost` o tomar el host de la request).
    - Actualizar `docs/acceso-remoto.md`.

## Al terminar
Actualizá `docs/estado-actual.md` y `docs/decisiones-pendientes.md`. En decisiones pendientes, listá lo que hay que validar con Sole: reglas de asiento, reglas de retención y liquidaciones.
