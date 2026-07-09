# Bloque B — Plan y consumo (recarga Culqi + límites) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Sección "Tu plan y consumo" en Configuración: ver saldo en detalle, comprar más hits (recarga dinámica con checkout de Culqi en modo test), y configurar límites propios (tope diario + pausar el bot al llegar).

**Architecture:** Backend expone el catálogo de precios y endpoints de plan/límites; el motor de cuota respeta el límite diario del cliente. Frontend agrega la sección con el detalle del saldo, el selector de recarga + checkout de Culqi (Culqi.js), y los controles de límite.

**Tech Stack:** Backend: Fastify, Prisma, Zod, Vitest, Redis. Frontend: Next.js 16, React 19, TS, Tailwind (Brasa), Culqi.js.

## Global Constraints

- Backend ESM `.js`; tests Vitest sin red (mock prisma/redis con `vi.hoisted`). Endpoints bajo `autenticarTenant`.
- Precio SIEMPRE calculado en backend (`precioRecargaCentavos`), nunca del cliente. Hits acreditados SOLO por webhook Culqi (ya existe).
- Frontend: tokens Brasa (no hex), copy sin jerga ("respuestas" en lo visible). Culqi public key en `NEXT_PUBLIC_CULQI_PUBLIC_KEY` (ya seteada, test). Client Components.
- Tramos recarga: <1000 hits → 12 centavos/hit; 1000-4999 → 10; ≥5000 → 8.5. Mínimo 100 hits. (De `core/catalogo.ts`, no hardcodear en front — traer de `GET /catalogo`.)
- Enum plan: free/light/pro/business.
- `lib/api.ts` tiene `api<T>(ruta, opts)` (Authorization + X-Tenant-Id) y `ApiError.status`.

---

### Task 1: Backend — `GET /catalogo`

**Files:**
- Create: `leadia/src/routes/catalogo.ts` + registrar en `server.ts`
- Test: `leadia/tests/catalogo-ruta.test.ts`

**Interfaces:**
- Produces: `GET /catalogo` → `{ planes, recargaDinamica: { minHits, tramos } }` (de `CATALOGO`). Público (no necesita tenant — es info de precios).

- [ ] **Step 1: Test** — Fastify inject, sin auth, espera 200 con `recargaDinamica.minHits` y `tramos` array.

```ts
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { rutasCatalogo } from '../src/routes/catalogo.js';

describe('GET /catalogo', () => {
  it('devuelve planes y tramos de recarga', async () => {
    const a = Fastify(); await a.register(rutasCatalogo); await a.ready();
    const res = await a.inject({ method: 'GET', url: '/catalogo' });
    expect(res.statusCode).toBe(200);
    const j = res.json();
    expect(j.recargaDinamica.minHits).toBeGreaterThan(0);
    expect(Array.isArray(j.recargaDinamica.tramos)).toBe(true);
    expect(j.planes.pro).toBeTruthy();
    await a.close();
  });
});
```

- [ ] **Step 2: Correr (falla).** `cd leadia && npx vitest run tests/catalogo-ruta.test.ts`

- [ ] **Step 3: Implementar** — `src/routes/catalogo.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { CATALOGO } from '../core/catalogo.js';

// Catálogo de precios (planes + tramos de recarga). Público: el panel lo usa
// para mostrar precios y calcular montos de recarga. El precio real de cada
// compra lo calcula el backend en /recargas, no el cliente.
export async function rutasCatalogo(app: FastifyInstance): Promise<void> {
  app.get('/catalogo', async () => ({
    planes: CATALOGO.planes,
    recargaDinamica: CATALOGO.recargaDinamica,
  }));
}
```

Registrar en `src/server.ts`: importar `rutasCatalogo` y `await app.register(rutasCatalogo);` (junto a las otras rutas).

- [ ] **Step 4: Correr (pasa) + suite completa + tsc.**

- [ ] **Step 5: Commit** `feat(catalogo): GET /catalogo con planes y tramos de recarga`

---

### Task 2: Backend — límites del cliente (schema + endpoint + cuota)

**Files:**
- Modify: `leadia/prisma/schema.prisma` (+ migración) — campos en Tenant
- Modify: `leadia/src/routes/uso.ts` (o nuevo `mi-plan.ts`) — GET/PATCH
- Modify: `leadia/src/core/bolsa.ts` (`consumirHit`) — respetar límite diario
- Test: `leadia/tests/mi-plan.test.ts`, y extender test de consumo si existe

**Interfaces:**
- Produces: `Tenant.limiteRespuestasDia Int?`, `Tenant.pausarAlLimite Boolean @default(false)`; `GET /mi-plan` → `{ plan, limiteRespuestasDia, pausarAlLimite }`; `PATCH /mi-plan { limiteRespuestasDia?, pausarAlLimite? }`.

- [ ] **Step 1: Migración de schema (NO destructiva)** — agregar a `model Tenant`:

```prisma
  limiteRespuestasDia Int?
  pausarAlLimite      Boolean @default(false)
```

Generar migración con `prisma migrate diff` (from schema-datasource → to schema-datamodel) → aplicar con `migrate deploy`. NUNCA `migrate reset` (Supabase). Regenerar cliente.

- [ ] **Step 2: Test del endpoint** — `tests/mi-plan.test.ts` (patrón ruta autenticada, mock prisma): `GET /mi-plan` devuelve los campos; `PATCH` con `{limiteRespuestasDia: 200, pausarAlLimite: true}` llama a `prisma.tenant.update` con esos datos y devuelve 200.

- [ ] **Step 3: Implementar endpoints** en `src/routes/uso.ts` (mismo dominio) dentro del scope autenticado:

```ts
  const patchSchema = z.object({
    limiteRespuestasDia: z.number().int().positive().nullable().optional(),
    pausarAlLimite: z.boolean().optional(),
  });
  app.get('/mi-plan', async (req) => {
    const t = await prisma.tenant.findUnique({
      where: { id: req.tenantId! },
      select: { plan: true, limiteRespuestasDia: true, pausarAlLimite: true },
    });
    return t;
  });
  app.patch('/mi-plan', async (req) => {
    const b = patchSchema.parse(req.body);
    return prisma.tenant.update({
      where: { id: req.tenantId! },
      data: b,
      select: { plan: true, limiteRespuestasDia: true, pausarAlLimite: true },
    });
  });
```

(Importar `z`, `prisma` si no están. Confirmar que `uso.ts` ya usa `autenticarTenant`; si no, envolver estas rutas.)

- [ ] **Step 4: Límite diario en `consumirHit`** (`src/core/bolsa.ts`): antes de consumir, si el tenant tiene `limiteRespuestasDia` y `pausarAlLimite=true`, contar el consumo del día (contador Redis `cuota:dia:<tenant>:<YYYY-MM-DD>`); si alcanzó el límite, lanzar el error de cuota excedida (mismo patrón que el corte por plan). Si `pausarAlLimite=false`, no cortar (solo el contador sube). Incrementar el contador diario al consumir. Test: extender el test de consumo o crear uno que verifique que con límite+pausar se corta al alcanzar el tope.

- [ ] **Step 5: Suite + tsc + commit** `feat(cuota): límite diario configurable por el cliente (tope + pausar)`

---

### Task 3: Frontend — funciones de API (catálogo, plan, recarga)

**Files:**
- Modify: `leadai-app/lib/api.ts`
- Test: build

**Interfaces:**
- Produces: `obtenerCatalogo()`, `obtenerMiPlan()`, `guardarMiPlan(cfg)`, `iniciarRecarga(hits, email, sourceId)`.

- [ ] **Step 1: Agregar** (ajustar a firma real de `api<T>`):

```ts
export interface Catalogo {
  planes: Record<string, { hitsMes: number; maxCanales: number; precioCentavos: number }>;
  recargaDinamica: { minHits: number; tramos: { hastaHits: number; centavosPorHit: number }[] };
}
export interface MiPlan { plan: string; limiteRespuestasDia: number | null; pausarAlLimite: boolean; }

export async function obtenerCatalogo(): Promise<Catalogo | null> {
  try { return await api<Catalogo>("/catalogo"); } catch { return null; }
}
export async function obtenerMiPlan(): Promise<MiPlan | null> {
  try { return await api<MiPlan>("/mi-plan"); } catch { return null; }
}
export async function guardarMiPlan(cfg: { limiteRespuestasDia?: number | null; pausarAlLimite?: boolean }): Promise<{ ok: boolean; error?: string }> {
  try { await api("/mi-plan", { method: "PATCH", body: cfg }); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" }; }
}
// Inicia la recarga: manda hits + email + el sourceId (token de Culqi). El backend
// calcula el precio y crea el cargo. Devuelve la referencia o error.
export async function iniciarRecarga(hits: number, email: string, sourceId: string): Promise<{ ok: boolean; error?: string }> {
  try { await api("/recargas", { method: "POST", body: { hits, email, sourceId } }); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el pago" }; }
}
```

- [ ] **Step 2: Build + commit** `feat(app): API de catálogo, mi-plan y recarga`

---

### Task 4: Frontend — utilidad de precio + checkout de Culqi

**Files:**
- Create: `leadai-app/lib/precio.ts` (calcula el precio local para mostrar, con los tramos del catálogo)
- Create: `leadai-app/components/panel/CheckoutCulqi.tsx`
- Test: build

**Interfaces:**
- Produces: `precioRecarga(hits, tramos): number` (centavos, misma lógica que backend); `<CheckoutCulqi hits, montoCentavos, onExito />`.

- [ ] **Step 1: `lib/precio.ts`** — replica de `precioRecargaCentavos` para MOSTRAR (el real lo valida el backend):

```ts
export function precioRecargaCentavos(hits: number, tramos: { hastaHits: number; centavosPorHit: number }[]): number {
  const tramo = tramos.find((t) => hits < t.hastaHits) ?? tramos[tramos.length - 1];
  return Math.round(hits * (tramo?.centavosPorHit ?? 0));
}
export const soles = (centavos: number) => `S/${(centavos / 100).toFixed(2)}`;
```

- [ ] **Step 2: `components/panel/CheckoutCulqi.tsx`** — carga Culqi.js, abre el checkout, obtiene el token y llama `iniciarRecarga`. Requisitos:
  - Cargar `https://checkout.culqi.com/js/v4` (script inline). Usar `NEXT_PUBLIC_CULQI_PUBLIC_KEY`.
  - Si falta la key → botón deshabilitado con "Pagos aún no disponibles".
  - Configurar `Culqi.publicKey`, `Culqi.settings({ title:'LeadAI', currency:'PEN', amount: montoCentavos })`, `window.culqi = () => {...}` que lee `Culqi.token.id` y llama `iniciarRecarga(hits, email, token.id)`.
  - Estados: idle / procesando / ok / error. Mostrar mensajes claros.
  - El email: usar el de la sesión (`leerSesion()?.usuario.email`).
  - Tokens Brasa.

> Culqi.js v4 API: `Culqi.publicKey = pk`; `Culqi.settings({...})`; `Culqi.open()`; callback global `window.culqi`. Verificar contra la doc oficial (https://docs.culqi.com) al implementar; ajustar nombres si difieren.

- [ ] **Step 3: Build + commit** `feat(app): checkout de Culqi para recarga de hits`

---

### Task 5: Frontend — sección "Tu plan y consumo" en Configuración

**Files:**
- Modify: `leadai-app/app/(panel)/configuracion/page.tsx`
- Create (opcional): `leadai-app/components/panel/PlanConsumo.tsx`
- Test: build + navegador

**Interfaces:**
- Consumes: `obtenerUso`, `obtenerCatalogo`, `obtenerMiPlan`, `guardarMiPlan`, `precioRecargaCentavos`, `<CheckoutCulqi>`.

- [ ] **Step 1: Crear `PlanConsumo.tsx`** con 3 partes (tarjetas):
  1. **Saldo:** de `obtenerUso()` — plan actual, respuestas del mes (usado/total con barra), prepago si hay, "se renueva en N días".
  2. **Comprar más:** presets (500/1000/5000) + input libre de hits. Con `obtenerCatalogo()` calcular en vivo `precioRecargaCentavos(hits, tramos)` y mostrar "X respuestas = S/Y" + el ahorro por volumen vs el tramo más caro. Botón "Comprar" → `<CheckoutCulqi hits montoCentavos onExito={recargar} />`. Respetar `minHits`.
  3. **Tus límites:** input "Máximo de respuestas por día" (vacío = sin límite) + toggle "Pausar el bot cuando llegue al tope" con copy que explique on/off. Guardar con `guardarMiPlan`. Cargar valores actuales con `obtenerMiPlan()`. Feedback guardado.
  - UI/UX pulida, tokens Brasa, copy humano, estados de carga/error.
- [ ] **Step 2: Insertar `<PlanConsumo />`** en la pantalla de Configuración (como una sección/`Bloque` más, coherente con "Tu negocio" y "Tus canales").
- [ ] **Step 3: Build + navegador** — la sección aparece, el precio se calcula al cambiar hits, el checkout de Culqi abre (con tarjeta de test), los límites se guardan.
- [ ] **Step 4: Commit** `feat(panel): sección Plan y consumo (saldo, comprar hits, límites)`

---

### Task 6: Deploy y verificación (con tarjeta de test de Culqi)

- [ ] **Step 1: Backend** — merge a main + push (CD). Verificar `GET /catalogo` (200) y `GET /mi-plan` (401 sin auth) en prod. Confirmar que el `.env` del VPS tiene las CULQI keys (el .env versionado ya las lleva).
- [ ] **Step 2: Frontend** — merge a master + push + `vercel --prod`. Configurar `NEXT_PUBLIC_CULQI_PUBLIC_KEY` en Vercel (env var de producción) y re-deploy.
- [ ] **Step 3: Prueba end-to-end** en app.leadai-pe.com: Configuración → Plan y consumo → elegir 1000 hits → ver precio → Comprar → checkout Culqi con tarjeta de TEST (`4111 1111 1111 1111`, cualquier fecha futura, CVV 123) → confirmar. El webhook de Culqi acredita los hits → el contador del sidebar sube. Guardar un límite y verificar que persiste.

---

## Notas
- **Culqi en modo TEST:** las llaves `pk_test`/`sk_test` ya están. Se prueba con las tarjetas de test de Culqi, sin cobro real. Para producción se cambian por `pk_live`/`sk_live`.
- El webhook de Culqi (acreditación) ya está implementado y probado (bolsas). Requiere que el `CULQI_WEBHOOK_SECRET` esté configurado para validar la firma — verificar; en test puede diferir.
- **Task 1** backend (test real). **Task 2** backend + migración Supabase (cuidado, no destructiva). **Tasks 3-5** frontend (build + navegador). **Task 6** deploy + prueba con tarjeta test.
