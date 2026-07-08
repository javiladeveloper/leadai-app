# Diseño: Panel Capa 2 — Datos reales

**Fecha:** 2026-07-08
**Estado:** Aprobado, listo para plan
**Repos:** `leadai-app` (frontend, el grueso) + `leadia` (backend, 1 endpoint nuevo)

---

## 1. Objetivo

Que el panel muestre **datos reales** del tenant (leads, conversaciones, comisiones,
métricas) en vez de los datos demo de `lib/leads.ts`. El backend ya expone casi todo;
esta capa es mayormente conectar el frontend + un endpoint de resumen nuevo.

## 2. Endpoints del backend

**Ya existen (reusar):**
- `GET /leads?estado=&nivel=&limit=&cursor=` → `{ items: Lead[], siguienteCursor }`.
  Lead: `{ id, nombre, contactoExterno, canalOrigen, nivelInteres, estado, resumenIA, borradorIA, creadoEn, actualizadoEn }`.
- `GET /leads/:id` → Lead + `mensajes: { id, direccion, contenido, canal, creadoEn }[]` (orden asc).
- `POST /leads/:id/acciones` `{ tipo: 'aprobar_borrador'|'marcar_ganado'|'descartar'|'responder', texto?, monto? }`.
- `GET /comisiones?estado=` → `{ items, resumen }` (totales por estado).
- `GET /uso` → plan, límites y consumo del mes.

**Nuevo:**
- `GET /resumen` → `{ leadsActivos, calientesSinAtender, ventasCerradas }` para el dashboard de Inicio. Filtrado por tenant (del header X-Tenant-Id). Cuenta:
  - `leadsActivos`: leads con estado no terminal (no ganado/perdido/descartado).
  - `calientesSinAtender`: `nivelInteres='caliente'` y estado no terminal ni escalado-atendido.
  - `ventasCerradas`: leads con estado `ganado`.

Auth: todos bajo `autenticarTenant` (API key de tenant o token de usuario + X-Tenant-Id).

## 3. Frontend

`lib/api.ts` gana funciones reales (usan el helper `api<T>` que ya manda token + X-Tenant-Id):
- `listarLeads(filtros?): Promise<Lead[]>` (envuelve `GET /leads`, devuelve `items`).
- `obtenerLead(id): Promise<LeadDetalle | null>` (`GET /leads/:id`, 404 → null).
- `accionLead(id, accion): Promise<{ok, error?}>` (`POST /leads/:id/acciones`).
- `obtenerComisiones(): Promise<{ items, resumen }>` (`GET /comisiones`).
- `obtenerResumen(): Promise<{ leadsActivos, calientesSinAtender, ventasCerradas }>` (`GET /resumen`).

**Tipos** (nuevo `lib/tipos-api.ts` o dentro de `lib/api.ts`): `Lead`, `LeadDetalle` (Lead + mensajes), `Mensaje`, `Comision`, según el §2.

**Pantallas** (reemplazan el uso de `lib/leads.ts` demo):
- **Inicio**: `obtenerResumen()` → métricas reales. Estado vacío guía: "Aún no tenés
  leads. Conectá WhatsApp para empezar a recibirlos" + botón → /configuracion.
- **Conversaciones**: `listarLeads()` (col 1) + `obtenerLead(id)` (col 2/3). Responder
  y registrar venta → `accionLead`. **Polling cada 10s** (refresca lista + chat abierto).
- **Leads**: `listarLeads()` con filtros por estado/nivel.
- **Reportes**: `obtenerComisiones()` (items + resumen).

**Estados vacíos que guían** en las 4 pantallas (mensaje útil + acción, no cero frío).

**Manejo de error/carga:** cada pantalla muestra "cargando…" y, si el fetch falla,
un mensaje (no rompe). Se quita el banner "datos de ejemplo".

## 4. Detalles

- **Empresa activa:** `lib/api.ts` ya envía `X-Tenant-Id` de `leerEmpresaActiva()`.
  Al cambiar de empresa, las pantallas re-fetchean (dependencia en el efecto).
- **Polling:** hook con `setInterval(10000)` en Conversaciones; limpiar en unmount.
- **`lib/leads.ts`** (demo): se deja de usar; se puede borrar al final o mantener
  para el modo demo del login (si el login demo se conserva, dejarlo).

## 5. No-objetivos
- Tiempo real (WebSockets) — el polling alcanza.
- Pantalla Seguimiento (sigue placeholder — Capa 3).
- Paginación infinita en Leads (traer el primer page alcanza; cursor queda listo).

## 6. Archivos afectados
- `leadia`: `src/routes/` (nuevo `GET /resumen`, en leads.ts o un routes/resumen.ts) + core + test.
- `leadai-app`: `lib/api.ts` (+ tipos), `app/(panel)/{inicio,conversaciones,leads,reportes}/page.tsx`, quizás un hook `lib/usePolling.ts`.
