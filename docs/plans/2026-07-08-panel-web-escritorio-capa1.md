# Panel Web de Escritorio — Capa 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la app mobile-first en un panel web de escritorio responsive con sidebar fijo, header con selector de empresa, las 5 pantallas migradas a layout desktop (Conversaciones en 3 columnas), y el Playbook de Configuración conectado a datos reales del backend.

**Architecture:** Un route group `app/(panel)/` con un layout compartido (Sidebar + Header) que envuelve las pantallas. Responsive vía breakpoints Tailwind: `lg+` muestra sidebar desktop; `<lg` colapsa y reaparece la `NavInferior` mobile existente. Se reusan los componentes actuales (Burbuja, TarjetaLead, ChipTemp, ConectarWhatsApp) y los tokens Brasa. Playbook conectado a `GET/PUT /perfil` del backend en producción.

**Tech Stack:** Next.js 16 (App Router, route groups), React 19, TypeScript, Tailwind v4 (CSS-first `@theme`), Atkinson Hyperlegible. Sin Vitest (la app se valida con `npm run build` + navegador).

## Global Constraints

- Sistema de diseño **Brasa** — tokens ya en `app/globals.css`: `arena #eae1d0`, `carta #fffdf9`, `brasa #e25c43`, `brasa-hondo #c4472f`, `tibio #c98a1b`, `frio #8a8378`, `tinta #33281f`, `tinta-2 #5c4f42`, `linea #d8ccb6`, `superficie-honda #33281f`, `ok #4b7f52`. Usar clases Tailwind de estos tokens (`bg-arena`, `text-tinta`, `ring-linea`, etc.), NUNCA hex hardcodeado.
- Fuente: `--font-lee` (Atkinson Hyperlegible), ya aplicada en body.
- Producto se llama **LeadAI**. Copy en español, tono cercano peruano/rioplatense.
- Nomenclatura del menú (EXACTA): **Inicio**, **Conversaciones**, **Seguimiento**, **Leads**, **Reportes**, **Configuración**. NO usar "Pipeline" ni "Dashboard".
- Responsive: `lg` (≥1024px) = layout desktop; `<lg` = mobile con `NavInferior`. Sin scroll horizontal en el body.
- Auth: helpers de `lib/auth.ts` — `leerSesion(): Sesion|null` (`.token`, `.usuario`, `.empresas`), `leerEmpresaActiva(): string|null`, `guardarEmpresaActiva(id)`, `cerrarSesion()`, `haySesion()`. NO leer localStorage crudo.
- Datos: Configuración/Playbook = REAL (`/perfil`). Inicio/Conversaciones/Leads/Reportes = demo (`lib/leads.ts`), marcados como "ejemplo".
- Cada pantalla del panel es Client Component (`"use client"`), protege sesión: si `!haySesion()` → `router.replace("/")`.
- Íconos: usar el set `components/Iconos.tsx` (IconoRayo, IconoBandeja, IconoReportes, IconoConfig, IconoWhatsApp, IconoChevron, etc.). Si falta un ícono para una sección, agregarlo ahí siguiendo el estilo (stroke, currentColor).

---

### Task 1: Shell del panel (route group + layout + Sidebar + Header)

**Files:**
- Create: `app/(panel)/layout.tsx`
- Create: `components/panel/Sidebar.tsx`
- Create: `components/panel/HeaderPanel.tsx`
- Modify: `components/Iconos.tsx` (agregar íconos faltantes para las secciones)
- Test: build + navegador.

**Interfaces:**
- Consumes: `lib/auth` (`leerSesion`, `leerEmpresaActiva`, `guardarEmpresaActiva`, `cerrarSesion`, `haySesion`); `components/Iconos`.
- Produces: `PanelLayout` (default export de `app/(panel)/layout.tsx`); `<Sidebar />` y `<HeaderPanel />`. Rutas del panel: `/inicio`, `/conversaciones`, `/seguimiento`, `/leads`, `/reportes`, `/configuracion`.

- [ ] **Step 1: Agregar íconos faltantes**

En `components/Iconos.tsx`, agregar (siguiendo el estilo de los existentes: `function IconoX({ className }: { className?: string })` con SVG `stroke="currentColor"`):
- `IconoInicio` (una casa o gráfico), `IconoConversaciones` (burbuja de chat), `IconoSeguimiento` (embudo o flechas de flujo). Si algún equivalente ya existe (IconoBandeja para Leads), reusarlo.

- [ ] **Step 2: Crear el Sidebar**

Crear `components/panel/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { leerSesion } from "@/lib/auth";
import {
  IconoInicio, IconoConversaciones, IconoSeguimiento,
  IconoBandeja, IconoReportes, IconoConfig, IconoRayo,
} from "@/components/Iconos";

const SECCIONES = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  { href: "/conversaciones", label: "Conversaciones", Icono: IconoConversaciones },
  { href: "/seguimiento", label: "Seguimiento", Icono: IconoSeguimiento },
  { href: "/leads", label: "Leads", Icono: IconoBandeja },
  { href: "/reportes", label: "Reportes", Icono: IconoReportes },
  { href: "/configuracion", label: "Configuración", Icono: IconoConfig },
];

// Sidebar del panel de escritorio. Fijo a la izquierda en lg+. En superficie
// honda (marrón) para separarlo del contenido arena.
export function Sidebar() {
  const path = usePathname();
  const sesion = leerSesion();
  const nombre = sesion?.usuario?.nombre ?? sesion?.usuario?.email ?? "Mi cuenta";
  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col bg-superficie-honda text-arena">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brasa text-carta">
          <IconoRayo className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold">Lead<span className="text-brasa">AI</span></span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {SECCIONES.map(({ href, label, Icono }) => {
          const activo = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                activo ? "bg-brasa text-carta" : "text-arena/80 hover:bg-white/5 hover:text-arena"
              }`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-5 py-4 text-sm">
        <p className="font-semibold text-arena">{nombre}</p>
        <p className="text-arena/60 text-xs">{sesion?.usuario?.email}</p>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Crear el HeaderPanel**

Crear `components/panel/HeaderPanel.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, cerrarSesion } from "@/lib/auth";
import { IconoChevron } from "@/components/Iconos";

// Header del panel: selector de empresa activa (Guisella maneja varias marcas)
// + menú de usuario (cerrar sesión).
export function HeaderPanel() {
  const router = useRouter();
  const sesion = leerSesion();
  const empresas = sesion?.empresas ?? [];
  const [activa, setActiva] = useState<string>("");

  useEffect(() => {
    const guardada = leerEmpresaActiva();
    setActiva(guardada ?? empresas[0]?.tenantId ?? "");
  }, [empresas]);

  function cambiarEmpresa(id: string) {
    setActiva(id);
    guardarEmpresaActiva(id);
    router.refresh();
  }

  function salir() {
    cerrarSesion();
    router.replace("/");
  }

  const nombreActiva = empresas.find((e) => e.tenantId === activa)?.nombre ?? "Elegí empresa";

  return (
    <header className="flex items-center justify-between border-b border-linea bg-carta px-5 py-3">
      <div className="relative">
        {empresas.length > 1 ? (
          <select
            value={activa}
            onChange={(e) => cambiarEmpresa(e.target.value)}
            className="rounded-lg border border-linea bg-arena/50 px-3 py-1.5 text-sm font-semibold text-tinta"
          >
            {empresas.map((e) => (
              <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold text-tinta">{nombreActiva}</span>
        )}
      </div>
      <button
        type="button"
        onClick={salir}
        className="flex items-center gap-1.5 text-sm font-medium text-frio hover:text-tinta"
      >
        Cerrar sesión <IconoChevron className="h-4 w-4" />
      </button>
    </header>
  );
}
```

- [ ] **Step 4: Crear el layout del panel**

Crear `app/(panel)/layout.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { Sidebar } from "@/components/panel/Sidebar";
import { HeaderPanel } from "@/components/panel/HeaderPanel";
import { NavInferior } from "@/components/NavInferior";

// Shell del panel de escritorio: Sidebar fijo (lg+) + Header, contenido ancho.
// En mobile el sidebar se oculta y reaparece la NavInferior.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="flex min-h-dvh bg-arena">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderPanel />
        <main className="flex-1 overflow-x-hidden">{children}</main>
        <div className="lg:hidden">
          <NavInferior />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar el build**

Run (en `leadai-app`): `npm run build`
Expected: build sin errores. (Las rutas del panel aún no existen — se crean en las tareas siguientes; el layout compila solo.)

- [ ] **Step 6: Commit**

```bash
cd leadai-app
git add app/(panel)/layout.tsx components/panel/Sidebar.tsx components/panel/HeaderPanel.tsx components/Iconos.tsx
git commit -m "feat(panel): shell de escritorio (sidebar + header + layout responsive)"
```

---

### Task 2: Configuración con Playbook editable REAL

**Files:**
- Create: `app/(panel)/configuracion/page.tsx`
- Create: `components/panel/PlaybookEditor.tsx`
- Modify: `lib/api.ts` (funciones `obtenerPerfil` / `guardarPerfil`)
- Test: build + navegador (guardar y recargar el playbook).

**Interfaces:**
- Consumes: `lib/api` (`api<T>`), `lib/auth`; `components/ConectarWhatsApp` (ya existe).
- Produces: página `/configuracion` en el panel; `obtenerPerfil()`, `guardarPerfil(perfil)` en `lib/api`.

- [ ] **Step 1: Agregar las funciones de perfil a lib/api.ts**

En `leadai-app/lib/api.ts`, agregar (reusa el helper `api<T>` existente que ya manda token + X-Tenant-Id):

```ts
// Playbook del negocio (perfil que la IA usa). Lectura y guardado reales.
export interface PerfilNegocio {
  rubro: string;
  nombreNegocio: string;
  idioma: string;
  tono: string;
  propuestaValor: string;
  catalogo: { nombre: string; descripcion?: string; precio?: string }[];
  preguntasClave: string[];
  senalesCaliente: string[];
  senalesFrio: string[];
  objeciones: { objecion: string; respuesta: string }[];
  politicas: string;
  llamadaAccion: string;
}

export async function obtenerPerfil(): Promise<PerfilNegocio | null> {
  try {
    const r = await api<{ perfil: PerfilNegocio } | PerfilNegocio>("/perfil");
    // el backend devuelve { rubro, perfil, version } o similar — normalizamos
    return (r as { perfil?: PerfilNegocio }).perfil ?? (r as PerfilNegocio) ?? null;
  } catch {
    return null;
  }
}

export async function guardarPerfil(
  rubro: string, perfil: PerfilNegocio,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/perfil", { method: "PUT", body: { rubro, perfil } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}
```

> ANTES de escribir esto, leer `lib/api.ts` para confirmar la firma real de `api<T>(ruta, opts)` (cómo pasa `method` y `body`). Ajustar la llamada a esa firma. El backend `GET /perfil` puede devolver 404 si no hay perfil aún — tratarlo como `null`, no como error fatal.

- [ ] **Step 2: Crear el PlaybookEditor**

Crear `components/panel/PlaybookEditor.tsx`: un formulario que carga con `obtenerPerfil()` y guarda con `guardarPerfil()`. Campos: nombreNegocio, rubro, tono (textarea), propuestaValor, politicas, llamadaAccion (textareas), y listas simples para catalogo/preguntasClave/objeciones (inputs dinámicos: agregar/quitar filas). Estado de guardado (idle/guardando/ok/error). Usar tokens Brasa (bg-carta, ring-linea, text-tinta, botón bg-brasa). Si `obtenerPerfil` devuelve null, arrancar con un perfil vacío editable.

Estructura mínima (el implementador completa los campos siguiendo este patrón):

```tsx
"use client";

import { useEffect, useState } from "react";
import { obtenerPerfil, guardarPerfil, type PerfilNegocio } from "@/lib/api";

const PERFIL_VACIO: PerfilNegocio = {
  rubro: "", nombreNegocio: "", idioma: "es", tono: "", propuestaValor: "",
  catalogo: [], preguntasClave: [], senalesCaliente: [], senalesFrio: [],
  objeciones: [], politicas: "", llamadaAccion: "",
};

export function PlaybookEditor() {
  const [perfil, setPerfil] = useState<PerfilNegocio>(PERFIL_VACIO);
  const [estado, setEstado] = useState<"cargando" | "idle" | "guardando" | "ok" | "error">("cargando");
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerPerfil().then((p) => { if (p) setPerfil({ ...PERFIL_VACIO, ...p }); setEstado("idle"); });
  }, []);

  async function guardar() {
    setEstado("guardando"); setError("");
    const r = await guardarPerfil(perfil.rubro || "general", perfil);
    if (r.ok) setEstado("ok"); else { setEstado("error"); setError(r.error ?? ""); }
  }

  if (estado === "cargando") return <p className="text-frio">Cargando…</p>;

  return (
    <div className="space-y-4">
      <Campo label="Nombre del negocio" value={perfil.nombreNegocio}
        onChange={(v) => setPerfil({ ...perfil, nombreNegocio: v })} />
      <Campo label="Rubro" value={perfil.rubro}
        onChange={(v) => setPerfil({ ...perfil, rubro: v })} />
      <CampoArea label="Tono de la IA" value={perfil.tono}
        onChange={(v) => setPerfil({ ...perfil, tono: v })} />
      <CampoArea label="Propuesta de valor" value={perfil.propuestaValor}
        onChange={(v) => setPerfil({ ...perfil, propuestaValor: v })} />
      <CampoArea label="Políticas (envíos, horarios, pagos)" value={perfil.politicas}
        onChange={(v) => setPerfil({ ...perfil, politicas: v })} />
      <CampoArea label="Llamada a la acción" value={perfil.llamadaAccion}
        onChange={(v) => setPerfil({ ...perfil, llamadaAccion: v })} />
      {/* catalogo, preguntasClave, objeciones: listas editables (agregar/quitar filas) */}
      <button type="button" onClick={guardar} disabled={estado === "guardando"}
        className="rounded-full bg-brasa px-6 py-2.5 text-sm font-semibold text-carta hover:bg-brasa-hondo disabled:opacity-60">
        {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
      </button>
      {estado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
      {estado === "error" && <p className="text-sm text-brasa">{error}</p>}
    </div>
  );
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa" />
    </label>
  );
}
function CampoArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa" />
    </label>
  );
}
```

- [ ] **Step 3: Crear la página de Configuración**

Crear `app/(panel)/configuracion/page.tsx`: página que muestra secciones en tarjetas anchas (grilla en desktop): (a) "Tu negocio" con `<PlaybookEditor />`, (b) "Tus canales" con `<ConectarWhatsApp />` (reusar de la migración de la config vieja). Proteger sesión (`haySesion`). Usar tokens Brasa. Título de sección "Configuración".

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run build`, luego `npm run dev`. En `/configuracion`: cargar el playbook (con la sesión y empresa activa reales), editar un campo, Guardar, recargar → confirmar que persiste (viene del backend). Requiere estar logueado y con empresa activa.

- [ ] **Step 5: Commit**

```bash
cd leadai-app
git add "app/(panel)/configuracion/page.tsx" components/panel/PlaybookEditor.tsx lib/api.ts
git commit -m "feat(panel): Configuración con Playbook editable real (/perfil) + Canales"
```

---

### Task 3: Conversaciones en 3 columnas (demo)

**Files:**
- Create: `app/(panel)/conversaciones/page.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `lib/leads` (`listarLeads`, `obtenerConversacion`), `components/TarjetaLead`, `components/Burbuja`, `components/ChipTemp`.
- Produces: página `/conversaciones` con 3 columnas.

- [ ] **Step 1: Leer los componentes reusables**

Leer `components/TarjetaLead.tsx`, `components/Burbuja.tsx`, `components/ChipTemp.tsx` y `app/conversacion/[id]/page.tsx` (la conversación mobile actual) para reusar su markup y props exactas.

- [ ] **Step 2: Crear la pantalla de 3 columnas**

Crear `app/(panel)/conversaciones/page.tsx` (Client Component, protege sesión). Layout desktop:
- **Columna 1 (lista, ~320px):** `listarLeads()` → lista de `TarjetaLead` (con semáforo). Al hacer clic, setea el lead seleccionado (estado local `seleccionadoId`).
- **Columna 2 (chat, flex-1):** `obtenerConversacion(seleccionadoId)` → burbujas (`Burbuja`), notas de voz, "respuestas listas para enviar" (borradores), campo de envío.
- **Columna 3 (contexto IA, ~300px):** resumen de la IA (Quiere / Presupuesto / Urgencia) + acciones (Registrar venta, Tomar conversación).
- Grilla: `hidden lg:grid lg:grid-cols-[320px_1fr_300px]` para desktop.
- **Mobile (`<lg`):** mostrar solo la columna 1 (lista); al tocar un lead, navegar a la conversación (flujo actual) — o mostrar chat a pantalla completa. Mantener usable.
- Aviso sutil "datos de ejemplo" arriba (banner tenue con `bg-tibio-suave text-tinta-2`).

- [ ] **Step 3: Verificar**

Run: `npm run build` + `npm run dev`. En `/conversaciones` (desktop): ver las 3 columnas, seleccionar un lead → aparece su chat + contexto. Responsive: achicar la ventana → colapsa a lista.

- [ ] **Step 4: Commit**

```bash
cd leadai-app
git add "app/(panel)/conversaciones/page.tsx"
git commit -m "feat(panel): Conversaciones en 3 columnas (lista + chat + contexto IA)"
```

---

### Task 4: Inicio, Leads y Reportes (layout desktop, demo)

**Files:**
- Create: `app/(panel)/inicio/page.tsx`
- Create: `app/(panel)/leads/page.tsx`
- Create: `app/(panel)/reportes/page.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `lib/leads` (`listarLeads`, `contarCalientesSinAtender`, `obtenerReporte`), `components/TarjetaLead`.
- Produces: páginas `/inicio`, `/leads`, `/reportes` en el panel.

- [ ] **Step 1: Crear Inicio (dashboard demo)**

Crear `app/(panel)/inicio/page.tsx`: saludo ("Hola, {nombre}"), banner "X calientes sin atender" (`contarCalientesSinAtender()`), grilla de tarjetas de métricas (leads/calientes/ventas — demo), accesos rápidos a Conversaciones. Ancho, en grilla (`lg:grid-cols-3`). Banner "datos de ejemplo". Tokens Brasa.

- [ ] **Step 2: Crear Leads (lista ancha demo)**

Crear `app/(panel)/leads/page.tsx`: la bandeja actual (`listarLeads()` + `TarjetaLead`) pero en layout ancho de escritorio (grilla de tarjetas `lg:grid-cols-2` o tabla), con los filtros por estado y marca que ya tiene `app/bandeja/page.tsx`. Reusar esa lógica de filtros. Banner "datos de ejemplo".

- [ ] **Step 3: Crear Reportes (demo)**

Crear `app/(panel)/reportes/page.tsx`: migrar `app/reportes/page.tsx` a layout ancho (grilla): comisiones, stats (leads/calientes/ventas), funnel, por marca con pagar/PDF. `obtenerReporte()`. Banner "datos de ejemplo".

- [ ] **Step 4: Verificar**

Run: `npm run build` + `npm run dev`. Navegar por `/inicio`, `/leads`, `/reportes` desde el sidebar → todas anchas y consistentes. Responsive OK.

- [ ] **Step 5: Commit**

```bash
cd leadai-app
git add "app/(panel)/inicio/page.tsx" "app/(panel)/leads/page.tsx" "app/(panel)/reportes/page.tsx"
git commit -m "feat(panel): Inicio, Leads y Reportes en layout desktop (demo)"
```

---

### Task 5: Seguimiento (placeholder) + redirecciones + limpieza

**Files:**
- Create: `app/(panel)/seguimiento/page.tsx` (placeholder "Próximamente")
- Modify: `app/page.tsx` (login → redirige a `/inicio` tras login, no a `/bandeja`)
- Modify/Delete: rutas viejas `app/bandeja`, `app/conversacion/[id]`, `app/reportes/page.tsx`, `app/configuracion/page.tsx` → redirigir a las nuevas del panel.
- Test: build + navegador (flujo completo).

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `/seguimiento` (placeholder), navegación coherente, login → `/inicio`.

- [ ] **Step 1: Crear Seguimiento placeholder**

Crear `app/(panel)/seguimiento/page.tsx`: pantalla simple con título "Seguimiento" y un estado vacío ("Muy pronto vas a poder ver tus ventas avanzar por etapas acá"). Tokens Brasa. Protege sesión.

- [ ] **Step 2: Redirigir el login a /inicio**

En `app/page.tsx`, donde tras login exitoso hace `router.push("/bandeja")` (o similar), cambiar a `router.replace("/inicio")`. Y el chequeo de sesión existente que redirige a la app, que apunte a `/inicio`.

- [ ] **Step 3: Redirigir rutas viejas**

Convertir las páginas viejas fuera del route group en redirects para no dejar rutas muertas ni duplicadas:
- `app/bandeja/page.tsx` → `redirect("/leads")` (o `/inicio`).
- `app/reportes/page.tsx` → `redirect("/reportes")` — OJO: colisiona con la nueva. Como la nueva está en `(panel)` que es un route group SIN segmento de URL, ambas resuelven a `/reportes`. **Eliminar la vieja** `app/reportes/page.tsx` y `app/configuracion/page.tsx` (las reemplazan las del panel). Mover/eliminar `app/bandeja` y `app/conversacion/[id]` (reemplazadas por `/leads` y `/conversaciones`).

> Verificar con `npm run build` que no haya conflicto de rutas (dos archivos resolviendo a la misma URL). El route group `(panel)` no agrega segmento, así que `app/(panel)/reportes/page.tsx` y `app/reportes/page.tsx` colisionan — debe quedar solo uno.

- [ ] **Step 4: Verificar el flujo completo**

Run: `npm run build` (sin conflictos de ruta) + `npm run dev`. Flujo: login → `/inicio` → navegar por todas las secciones del sidebar → cerrar sesión → vuelve al login. En mobile: NavInferior visible, sidebar oculto.

- [ ] **Step 5: Commit**

```bash
cd leadai-app
git add -A
git commit -m "feat(panel): Seguimiento (placeholder) + login a /inicio + limpieza de rutas viejas"
```

---

### Task 6: Deploy a producción y verificación

**Files:** ninguno (deploy).

- [ ] **Step 1: Merge a master y deploy**

```bash
cd leadai-app
git checkout master
git merge --no-ff <rama-de-esta-feature>
git push origin master
npx vercel --prod --yes
```

(El push a GitHub puede disparar el deploy automático de Vercel si está conectado; si no, `vercel --prod`.)

- [ ] **Step 2: Verificar en app.leadai-pe.com**

Abrir `https://app.leadai-pe.com` (desktop y celular): login → panel con sidebar → Configuración carga el playbook real → guardar funciona → navegar por las secciones. Confirmar responsive.

- [ ] **Step 3: Commit (si hubo ajustes)**

Si el deploy reveló algún ajuste, corregir, commitear y re-desplegar.

---

## Notas de ejecución

- **Sin Vitest**: cada tarea se valida con `npm run build` (sin errores de tipo/lint) + verificación en navegador.
- **Route group `(panel)`**: NO agrega segmento de URL. `app/(panel)/inicio/page.tsx` = `/inicio`. Cuidar colisiones con rutas viejas (Task 5).
- **Datos reales solo en Configuración/Playbook** (Capa 1). El resto es demo, marcado. Capa 2 conecta el resto.
- **Orden**: Task 1 (shell) es prerequisito de todas. Luego 2-4 en cualquier orden. Task 5 limpia y conecta. Task 6 despliega.
