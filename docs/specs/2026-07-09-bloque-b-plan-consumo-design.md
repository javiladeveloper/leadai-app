# Diseño: Bloque B — Plan y consumo (recarga de hits + límites)

**Fecha:** 2026-07-09
**Estado:** Aprobado, listo para plan
**Repos:** `leadia` (backend) + `leadai-app` (frontend)

---

## 1. Objetivo

Dar al cliente, desde el panel, control y visibilidad de su consumo:
1. **Ver su saldo** de respuestas en detalle (mensual + prepago + reseteo).
2. **Comprar más hits** (recarga dinámica, Cargo Único con Culqi) — precio con
   descuento por volumen, calculado por el backend.
3. **Configurar sus límites**: un tope propio de respuestas + toggle "pausar el bot
   al llegar" (respeta el tope o solo avisa) + alertas.

## 2. Qué ya existe (backend)

- `GET /uso` → saldo (mensual/prepago/total/reseteo). Usado por el contador (Bloque A).
- `POST /recargas { hits, email, sourceId }` → `iniciarRecarga`: el backend calcula el
  precio con `precioRecargaCentavos(hits)`, crea el cargo en Culqi, y devuelve
  `{ referenciaPago, amountCentavos }`. El webhook de Culqi acredita los hits al pagar.
- Catálogo de tramos de recarga: hasta 1000 hits → 12 centavos/hit; 1000-5000 → 10;
  +5000 → 8.5. Mínimo 100 hits. (En `core/catalogo.ts`.)

## 3. Qué falta

### Backend (`leadia`)
1. **`GET /catalogo`** (nuevo, público o autenticado): expone los tramos de recarga y
   el mínimo, para que el frontend muestre precios y calcule el monto sin hardcodear.
   Devuelve `{ minHits, tramos: [{ hastaHits, centavosPorHit }] }` + los planes.
2. **Campos de límite del cliente** en el Tenant (migración Prisma):
   - `limiteRespuestasDia Int?` — tope propio del cliente (respuestas/día). Null = sin tope.
   - `pausarAlLimite Boolean @default(false)` — si true, al llegar al tope el bot se
     pausa; si false, solo se registra/avisa y sigue.
   - (Alertas al 80/100% ya se cubren con `alertaWebhookUrl` existente; para v1 el
     toggle + tope alcanzan. Alertas visuales in-app quedan para después.)
3. **`GET /mi-plan`** y **`PATCH /mi-plan`** (autenticado por tenant): leer y guardar
   `limiteRespuestasDia` + `pausarAlLimite`. (O extender un endpoint existente.)
4. **Lógica en `consumirHit`/cuota**: si `limiteRespuestasDia` está seteado y el
   consumo del día lo alcanza → si `pausarAlLimite` true, cortar (como cuota excedida);
   si false, permitir pero marcar (para futura alerta). Contador diario en Redis.

### Frontend (`leadai-app`) — sección "Tu plan y consumo" en Configuración
- **Detalle del saldo:** tarjeta con mensual (usado/total), prepago, total disponible,
  "se renueva en N días". Reusa `obtenerUso()`.
- **Comprar más hits:** selector de cantidad (input o slider) que, con el catálogo
  (`GET /catalogo`), muestra en vivo "X respuestas = S/Y" y el ahorro por volumen.
  Botón "Comprar" → abre el **checkout de Culqi** (widget oficial con la public key),
  obtiene el `token`/`sourceId`, y llama a `POST /recargas`. Muestra éxito/error.
- **Tus límites:** input del tope diario + toggle "Pausar el bot al llegar al tope"
  con copy claro, guardado con `PATCH /mi-plan`.

## 4. Integración de Culqi (frontend)

- La public key va en `NEXT_PUBLIC_CULQI_PUBLIC_KEY` (YA configurada con la llave de
  TEST `pk_test_...`; el backend tiene `CULQI_SECRET_KEY=sk_test_...`). Se prueba con
  las tarjetas de test de Culqi (sin cobro real). Si la key faltara, el botón
  "Comprar" muestra "Pagos aún no disponibles" en vez de romper.
- Se usa el checkout de Culqi (Culqi.js v4 / CulqiCheckout). Cargar el script inline.
- Flujo: cliente elige hits → abre Culqi → ingresa tarjeta/Yape → Culqi devuelve un
  `token.id` (sourceId) → el frontend llama `POST /recargas { hits, email, sourceId }`
  → el backend crea el cargo y responde. El precio NUNCA se manda desde el cliente
  (lo calcula el backend) — ya está así.

## 5. UI/UX (enfatizado)

- Selector de hits con feedback inmediato del precio y del descuento ("a este volumen
  ahorrás S/Z"). Presets rápidos (500 / 1000 / 5000) + input libre.
- Checkout de Culqi prolijo (su widget), con estados claros (procesando/éxito/error).
- Límites en lenguaje humano: "Pausá el bot cuando llegue a X respuestas por día" con
  el toggle bien explicado (qué pasa si está on/off).
- Todo con tokens Brasa, copy sin jerga ("respuestas", no "hits" en lo visible).

## 6. Seguridad

- Precio calculado SIEMPRE en el backend (`precioRecargaCentavos`), nunca del cliente.
- Hits acreditados SOLO por el webhook firmado de Culqi (ya implementado, atómico,
  idempotente). El `POST /recargas` solo inicia el cargo.
- Endpoints `/mi-plan` bajo `autenticarTenant`.
- La public key de Culqi es pública (va al front); la secret key SOLO en el backend.

## 7. No-objetivos
- Suscripciones/cobro mensual automático de planes — bloque aparte futuro.
- One Click (guardar tarjeta) — futuro.
- Alertas in-app al 80/100% — futuro (el toggle de pausa cubre el control v1).

## 8. Archivos afectados
- `leadia`: `src/routes/` (GET /catalogo, GET/PATCH /mi-plan), `src/core/cuota.ts`
  (límite diario), `prisma/schema.prisma` + migración, tests.
- `leadai-app`: `lib/api.ts` (obtenerCatalogo, obtenerMiPlan, guardarMiPlan,
  iniciarRecarga), sección Plan y consumo en `app/(panel)/configuracion`, componente
  de checkout Culqi, `.env` (NEXT_PUBLIC_CULQI_PUBLIC_KEY).
