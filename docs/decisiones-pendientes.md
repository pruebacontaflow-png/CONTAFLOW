# Decisiones pendientes — ContaFlow

Generado: 22/11/2026. Actualizar con cada reunión con la contadora.

---

## 0. Retenciones Ganancias — verificación contra certificados Tango

### Regla implementada (confirmada por contadora 22/11/2026)
- Régimen 094 — Locaciones de obra y/o servicios
- Alícuota: 2% sobre importe neto sin IVA
- MNI: $67.170 acumulado por proveedor y por mes calendario
- Fórmula: `max(0, (acumulado_mes + base_nueva - 67170) × 0.02) - ya_retenido_en_mes`

### Certificados Tango — COINCIDEN (8)

| Proveedor | Período | Retenido Tango | Calculado | Diferencia |
|-----------|---------|---------------:|----------:|----------:|
| CIBEIRA | 2025-11 | $2.497,89 | $2.497,89 | $0,00 ✓ |
| Sosa Edgardo | 2025-11 | $5.256,60 | $5.256,60 | $0,00 ✓ |
| PILO | 2025-09 | $140.987,18 | $140.987,18 | $0,00 ✓ |
| Pilo | 2025-11 | $86.570,17 | $86.570,17 | $0,00 ✓ |
| Geo Media | 2025-10 | $347.980,20 | $347.980,20 | $0,00 ✓ |
| Geo Media | 2025-11 | $70.086,38 | $70.086,38 | $0,00 ✓ |
| FBR SA | 2025-11 | $130.888,00 | $130.888,00 | $0,00 ✓ |
| FBR SA | 2025-12 | $114.359,08 | $114.359,08 | $0,00 ✓ |

### Certificados Tango — NO COINCIDEN (6) — pendiente confirmar con contadora

| Proveedor | Período | Retenido Tango | Calculado por regla | Diferencia |
|-----------|---------|---------------:|--------------------:|-----------:|
| Pilo | 2025-10 | $445.989,29 | $114.940,44 | +$331.048,85 |
| Pilo | 2025-12 | $75.040,20 | $73.696,80 | +$1.343,40 |
| Kuarzo | 2025-11 | $180.366,60 | $92.546,96 | +$87.819,64 |
| Geo Media | 2025-09 | $702.692,66 | $646.989,51 | +$55.703,15 |
| Geo Media | 2025-12 | $295.566,28 | $288.954,71 | +$6.611,57 |
| FBR SA | 2025-09 | $81.790,63 | $81.301,23 | +$489,40 |

**Hipótesis:** Tango puede acumular distinto (distintas bases, distintos períodos, o incluye importes con IVA en la base).
**Acción:** Consultar a Soledad si tiene los certificados físicos o el criterio de base que usaba Tango.

---

## 1. Otros regímenes de Ganancias

La tabla `retenciones_config` tiene desactivados los regímenes 067, 217 y 001.
Los siguientes regímenes aparecen en `retenciones_aplicadas` importadas de Tango pero **no están configurados**:

| Código Tango | Descripción probable | Proveedor ejemplo |
|-------------|---------------------|-------------------|
| 116 | Honorarios | — |
| 30 | Alquiler | — |
| (en blanco) | Locaciones anteriores a sep 2025 | Varios |

**Acción:** Confirmar con Soledad si la empresa retiene por estos regímenes y cuál es la alícuota y MNI actual.

---

## 2. Alícuota para no inscriptos en Ganancias

No se conoce la alícuota aplicable a proveedores no inscriptos (ni en RG 830 ni en monotributo).

**Acción:** Consultar a Soledad la alícuota para no inscriptos (RG 830 art. 36).

---

## 3. Monotributistas

¿La empresa retiene Ganancias a monotributistas? ¿Hay MNI especial?

**Acción:** Confirmar con Soledad.

---

## 4. Certificados de exclusión de Ganancias

Se agregaron los campos en `proveedores`:
- `exclusion_ganancias_cert` — número de certificado
- `exclusion_ganancias_pct` — porcentaje de exclusión (0–100)
- `exclusion_ganancias_desde` / `exclusion_ganancias_hasta` — vigencia
- `exclusion_ganancias_pdf` — ruta al PDF

**Estado:** Columnas creadas en la DB. Faltan:
- UI en ficha del proveedor para cargar estos datos (punto 6 del prompt)
- Lógica en `calcular-retenciones` para aplicar la exclusión vigente

---

## 5. Formato TXT SICORE

La contadora pidió exportación TXT SICORE (punto 8.2 del prompt).
Formato oficial ARCA no verificado en detalle.

**Acción:** Pedirle a Soledad el último TXT de ejemplo para validar el formato antes de implementar.

---

## 6. IIBB — CM vigencia

Las DDJJ de IIBB 2025 cargadas son de contribuyente local (SICOL, CABA).
Desde qué mes rige el Convenio Multilateral: **dato a confirmar con Soledad**.

---

## 7. IIBB Buenos Aires — alícuota

Actividad: 591110 Producción de filmes y videocintas.
Alícuota CABA: 3% (confirmada).
Alícuota Buenos Aires: **pendiente confirmar con Soledad**.

---

*Próxima revisión: reunión con contadora.*
