# Panel Capa 2 — Datos reales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Conectar el panel a datos reales del tenant (leads, conversaciones, comisiones, métricas), reemplazando los datos demo. Incluye un endpoint `GET /resumen` nuevo en el backend y estados vacíos que guían.

**Architecture:** El backend ya expone `/leads`, `/leads/:id`, `/leads/:id/acciones`, `/comisiones`, `/uso`; se agrega `GET /resumen`. El frontend gana funciones reales en `lib/api.ts` y las 4 pantallas del panel dejan de usar `lib/leads.ts` (demo). Conversaciones hace polling cada 10s.

**Tech Stack:** Backend: Fastify, Prisma, Zod, Vitest. Frontend: Next.js 16, React 19, TS, Tailwind (tokens Brasa).

## Global Constraints

- Backend ESM: imports `.js`. Tests Vitest sin red (mock prisma con `vi.hoisted`+`vi.mock`, patrón de `tests/acreditar.test.ts`). Endpoint bajo `autenticarTenant`.
- Frontend: tokens Brasa (bg-arena, bg-carta, text-tinta, text-frio, bg-brasa, text-ok, ring-linea, bg-tibio-suave) — NUNCA hex. Copy español cercano. Producto = LeadAI.
- `lib/api.ts` ya tiene `api<T>(ruta, opts)` que manda Authorization (token de `leerSesion()`) + X-Tenant-Id (de `leerEmpresaActiva()`), y una clase `ApiError` con `.status`.
- Pantallas del panel: Client Component, protegen sesión (`if (!haySesion()) router.replace("/")`), estado de carga + error, estado vacío que guía.
- Estados terminales de un Lead: `ganado`, `perdido`, `descartado`. Nivel: `frio|tibio|caliente`.
- Modelo Lead (campos): `id, nombre, contactoExterno, canalOrigen, nivelInteres, estado, resumenIA, borradorIA, creadoEn, actualizadoEn`. Mensaje: `id, direccion ('entrante'|'saliente'), contenido, canal, creadoEn`.

---

### Task 1: Backend — `GET /resumen` (métricas del dashboard)

**Files:**
- Modify: `leadia/src/routes/leads.ts` (agregar la ruta) o crear `leadia/src/routes/resumen.ts` + registrarla en `server.ts`. Preferir agregarla en `leads.ts` (mismo dominio, evita registrar plugin nuevo).
- Test: `leadia/tests/resumen.test.ts`

**Interfaces:**
- Produces: `GET /resumen` → `{ leadsActivos: number, calientesSinAtender: number, ventasCerradas: number }`.
- Consumes: `prisma.lead.count`, `req.tenantId` (de `autenticarTenant`).

- [ ] **Step 1: Escribir el test**

Crear `leadia/tests/resumen.test.ts` (mock de prisma, patrón de otros tests de ruta con Fastify inject + mock de autenticarTenant):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { lead: { count: vi.fn() } },
}));
vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/middleware/auth.js', () => ({
  autenticarTenant: async (req: { tenantId?: string }) => { req.tenantId = 'tenant-1'; },
}));

import { rutasLeads } from '../src/routes/leads.js';

async function app() {
  const a = Fastify();
  await a.register(rutasLeads);
  await a.ready();
  return a;
}

describe('GET /resumen', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve las 3 métricas contando por tenant', async () => {
    // 3 count() en orden: leadsActivos, calientesSinAtender, ventasCerradas
    prismaMock.lead.count
      .mockResolvedValueOnce(12)  // activos
      .mockResolvedValueOnce(3)   // calientes sin atender
      .mockResolvedValueOnce(5);  // ventas
    const a = await app();
    const res = await a.inject({ method: 'GET', url: '/resumen' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ leadsActivos: 12, calientesSinAtender: 3, ventasCerradas: 5 });
    // filtró por tenant
    expect(prismaMock.lead.count.mock.calls[0][0].where.tenantId).toBe('tenant-1');
    await a.close();
  });
});
```

- [ ] **Step 2: Correr el test (falla)**

Run: `cd leadia && npx vitest run tests/resumen.test.ts`
Expected: FAIL (ruta no existe).

- [ ] **Step 3: Implementar la ruta**

En `leadia/src/routes/leads.ts`, dentro de `rutasLeads`, agregar (usa `prisma` y el mismo patrón autenticado que las otras rutas del archivo):

```ts
  // GET /resumen — métricas del dashboard (Inicio del panel).
  app.get('/resumen', async (req) => {
    const tenantId = req.tenantId!;
    const TERMINALES = ['ganado', 'perdido', 'descartado'];
    const [leadsActivos, calientesSinAtender, ventasCerradas] = await Promise.all([
      prisma.lead.count({ where: { tenantId, estado: { notIn: TERMINALES } } }),
      prisma.lead.count({
        where: { tenantId, nivelInteres: 'caliente', estado: { notIn: TERMINALES } },
      }),
      prisma.lead.count({ where: { tenantId, estado: 'ganado' } }),
    ]);
    return { leadsActivos, calientesSinAtender, ventasCerradas };
  });
```

> Confirmar que la ruta queda DENTRO del scope donde `autenticarTenant` corre (mirar cómo están las otras rutas de `leads.ts` — si usan `app.addHook('preHandler', autenticarTenant)` al inicio de `rutasLeads`, la nueva queda cubierta automáticamente).

- [ ] **Step 4: Correr el test (pasa) + suite**

Run: `cd leadia && npx vitest run tests/resumen.test.ts` → PASS. Luego `npx vitest run` completo (sin regresiones) y `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
cd leadia
git add src/routes/leads.ts tests/resumen.test.ts
git commit -m "feat(leads): GET /resumen con métricas del dashboard"
```

---

### Task 2: Frontend — funciones reales + tipos en lib/api.ts

**Files:**
- Modify: `leadai-app/lib/api.ts`
- Test: build.

**Interfaces:**
- Consumes: `api<T>(ruta, opts)` existente.
- Produces: `Lead`, `LeadDetalle`, `Mensaje`, `Comision` (tipos); `listarLeads()`, `obtenerLead(id)`, `accionLead(id, accion)`, `obtenerComisiones()`, `obtenerResumen()`.

- [ ] **Step 1: Leer lib/api.ts**

Leer `leadai-app/lib/api.ts` para la firma exacta de `api<T>` y `ApiError`.

- [ ] **Step 2: Agregar tipos y funciones**

En `leadai-app/lib/api.ts`, agregar:

```ts
export type NivelInteres = "frio" | "tibio" | "caliente";
export type EstadoLead = "nuevo" | "en_conversacion" | "escalado" | "nutriendo" | "ganado" | "perdido" | "descartado";

export interface Lead {
  id: string;
  nombre: string | null;
  contactoExterno: string;
  canalOrigen: string;
  nivelInteres: NivelInteres;
  estado: EstadoLead;
  resumenIA: string | null;
  borradorIA: string | null;
  creadoEn: string;
  actualizadoEn: string;
}
export interface Mensaje {
  id: string;
  direccion: "entrante" | "saliente";
  contenido: string;
  canal: string;
  creadoEn: string;
}
export interface LeadDetalle extends Lead { mensajes: Mensaje[]; }
export interface Comision { id: string; estado: string; monto: number; leadId: string; creadoEn: string; }
export interface Resumen { leadsActivos: number; calientesSinAtender: number; ventasCerradas: number; }

export async function listarLeads(filtros?: { estado?: string; nivel?: string }): Promise<Lead[]> {
  const qs = new URLSearchParams();
  if (filtros?.estado) qs.set("estado", filtros.estado);
  if (filtros?.nivel) qs.set("nivel", filtros.nivel);
  const q = qs.toString();
  const r = await api<{ items: Lead[]; siguienteCursor: string | null }>(`/leads${q ? `?${q}` : ""}`);
  return r.items;
}

export async function obtenerLead(id: string): Promise<LeadDetalle | null> {
  try {
    return await api<LeadDetalle>(`/leads/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function accionLead(
  id: string,
  accion: { tipo: "aprobar_borrador" | "marcar_ganado" | "descartar" | "responder"; texto?: string; monto?: number },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/leads/${id}/acciones`, { method: "POST", body: accion });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo completar la acción" };
  }
}

export async function obtenerComisiones(): Promise<{ items: Comision[]; resumen: Record<string, number> }> {
  return api<{ items: Comision[]; resumen: Record<string, number> }>("/comisiones");
}

export async function obtenerResumen(): Promise<Resumen> {
  return api<Resumen>("/resumen");
}
```

> Ajustar la llamada a `api()` a la firma real (method/body). Confirmar los valores reales de `EstadoLead` en el enum del backend (`prisma/schema.prisma` → `enum EstadoLead`) y ajustar el union type si difiere.

- [ ] **Step 3: Build**

Run: `cd leadai-app && npm run build` → sin errores.

- [ ] **Step 4: Commit**

```bash
cd leadai-app
git add lib/api.ts
git commit -m "feat(app): funciones reales de leads/comisiones/resumen en lib/api"
```

---

### Task 3: Frontend — Inicio con datos reales + estado vacío

**Files:**
- Modify: `leadai-app/app/(panel)/inicio/page.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `obtenerResumen()`, `leerSesion()`.

- [ ] **Step 1: Reescribir Inicio**

Reemplazar el uso de `lib/leads.ts` por `obtenerResumen()`. Estados:
- **cargando**: "Cargando…".
- **error**: mensaje "No pudimos cargar tus datos. Recargá."
- **vacío** (leadsActivos===0 && ventasCerradas===0): estado que guía — "Aún no tenés leads. Conectá WhatsApp para empezar a recibirlos" + botón (Link) a `/configuracion`.
- **con datos**: las 3 tarjetas de métricas reales (Leads activos, Calientes sin atender, Ventas cerradas) + accesos rápidos a /conversaciones y /leads.
- Quitar el banner "datos de ejemplo". Saludo "Hola, {nombre de la sesión}". Tokens Brasa.

- [ ] **Step 2: Build + navegador**

Run: `npm run build` + `npm run dev`. En `/inicio` con sesión + empresa activa: ver métricas reales (o el estado vacío si no hay leads). Requiere backend prod + estar logueado.

- [ ] **Step 3: Commit**

```bash
cd leadai-app
git add "app/(panel)/inicio/page.tsx"
git commit -m "feat(app): Inicio con métricas reales (/resumen) y estado vacío que guía"
```

---

### Task 4: Frontend — Leads con datos reales + filtros

**Files:**
- Modify: `leadai-app/app/(panel)/leads/page.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `listarLeads(filtros)`, `TarjetaLead`.

- [ ] **Step 1: Leer TarjetaLead**

Leer `leadai-app/components/TarjetaLead.tsx` para ver qué shape de lead espera. Si espera el tipo demo (de `lib/tipos`), adaptarlo para aceptar el `Lead` real de `lib/api` (o mapear los campos: nombre, nivelInteres, resumenIA, etc.). Ajustar TarjetaLead si es necesario para el tipo real (o crear un adaptador).

- [ ] **Step 2: Reescribir Leads**

Reemplazar `lib/leads.ts` por `listarLeads()`. Filtros por estado/nivel (llaman a la API con el filtro, o filtran client-side sobre lo traído — preferir pasar el filtro a `listarLeads({estado})`). Estados: cargando/error/vacío-guía ("Aún no tenés leads…" + botón a /configuracion)/lista. Grilla ancha (`lg:grid-cols-2`). Quitar banner demo. Tokens Brasa.

- [ ] **Step 3: Build + navegador**

Run: `npm run build` + `npm run dev`. En `/leads`: lista real (o vacío guía), filtros funcionan.

- [ ] **Step 4: Commit**

```bash
cd leadai-app
git add "app/(panel)/leads/page.tsx" components/TarjetaLead.tsx
git commit -m "feat(app): Leads con datos reales y filtros"
```

---

### Task 5: Frontend — Conversaciones reales + acciones + polling

**Files:**
- Modify: `leadai-app/app/(panel)/conversaciones/page.tsx`
- Create: `leadai-app/lib/usePolling.ts` (hook simple)
- Test: build + navegador.

**Interfaces:**
- Consumes: `listarLeads()`, `obtenerLead(id)`, `accionLead(id, accion)`, `Burbuja`, `ChipTemp`.

- [ ] **Step 1: Crear el hook de polling**

Crear `leadai-app/lib/usePolling.ts`:

```ts
"use client";
import { useEffect, useRef } from "react";

// Ejecuta `fn` cada `ms` mientras el componente está montado. Limpia al desmontar.
export function usePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
```

- [ ] **Step 2: Reescribir Conversaciones con datos reales**

Reemplazar `lib/leads.ts` por: `listarLeads()` (col 1), `obtenerLead(seleccionadoId)` (col 2/3). 3 columnas en desktop (mantener el layout ya hecho). Responder → `accionLead(id, {tipo:'responder', texto})`; registrar venta → `accionLead(id, {tipo:'marcar_ganado', monto})`; aprobar borrador → `accionLead(id, {tipo:'aprobar_borrador'})`. Las burbujas vienen de `lead.mensajes` (mapear `direccion` a lado). El resumen IA de `lead.resumenIA`, el borrador de `lead.borradorIA`. **Polling con `usePolling`** cada 10000ms: refresca la lista y, si hay uno seleccionado, su detalle. Estados: cargando/error/vacío-guía. Quitar banner demo. Tokens Brasa.

- [ ] **Step 3: Build + navegador**

Run: `npm run build` + `npm run dev`. En `/conversaciones`: lista real, abrir un lead muestra su chat real; responder envía (POST /acciones); polling trae mensajes nuevos.

- [ ] **Step 4: Commit**

```bash
cd leadai-app
git add "app/(panel)/conversaciones/page.tsx" lib/usePolling.ts
git commit -m "feat(app): Conversaciones con datos reales, acciones y polling"
```

---

### Task 6: Frontend — Reportes reales + limpieza

**Files:**
- Modify: `leadai-app/app/(panel)/reportes/page.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `obtenerComisiones()`.

- [ ] **Step 1: Reescribir Reportes**

Reemplazar `lib/leads.ts` por `obtenerComisiones()` (items + resumen de totales por estado). Mostrar: comisiones ganadas/por cobrar (del resumen), y la lista por comisión. Estados: cargando/error/vacío-guía. Quitar banner demo. Tokens Brasa.

- [ ] **Step 2: Build + navegador**

Run: `npm run build` + `npm run dev`. En `/reportes`: comisiones reales (o vacío).

- [ ] **Step 3: Commit**

```bash
cd leadai-app
git add "app/(panel)/reportes/page.tsx"
git commit -m "feat(app): Reportes con comisiones reales"
```

---

### Task 7: Deploy y verificación

- [ ] **Step 1: Backend a producción**

```bash
cd leadia
git checkout main && git merge --no-ff <rama-backend> && git push origin main
```
(CD despliega solo. Verificar `GET /resumen` en prod responde tras el deploy.)

- [ ] **Step 2: Frontend a producción**

```bash
cd leadai-app
git checkout master && git merge --no-ff <rama-frontend> && git push origin master
npx vercel --prod --yes
```

- [ ] **Step 3: Verificar en app.leadai-pe.com**

Login → panel → las 4 pantallas muestran datos reales (o estados vacíos que guían, ya que la empresa nueva no tiene leads aún). Confirmar que el estado vacío de Inicio invita a conectar WhatsApp.

---

## Notas de ejecución

- **Task 1** es backend (repo `leadia`, con test Vitest). **Tasks 2-6** son frontend (repo `leadai-app`, validadas con build + navegador). **Task 7** despliega ambos.
- Task 2 es prerequisito de 3-6 (todas usan las funciones de `lib/api`).
- El estado vacío es esperado: la empresa de prueba no tiene leads hasta conectar WhatsApp (que depende del App Review). Por eso los estados vacíos que guían son clave.
