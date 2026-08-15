# Bloque A — Contador de hits en el panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mostrar en el panel, siempre visible en el sidebar, un contador del saldo de "respuestas" (hits) del cliente — cuánto le queda, cuándo se renueva, y acceso a comprar más — con UI/UX pulida y copy sin jerga.

**Architecture:** El backend ya expone `GET /uso` con toda la data de la bolsa. Esta feature es solo frontend: una función `obtenerUso()` en `lib/api.ts` y un componente `<ContadorHits>` en el sidebar del panel, que se refresca al montar y al cambiar de empresa.

**Tech Stack:** Next.js 16, React 19, TS, Tailwind v4 (tokens Brasa). Sin backend nuevo. Validación por build + navegador.

## Global Constraints

- Tokens Brasa (bg-arena, bg-carta, text-tinta, text-frio, bg-brasa, text-ok, bg-tibio, ring-linea, text-arena, superficie-honda). En el sidebar (fondo `superficie-honda`, oscuro), usar texto claro (`text-arena`, `text-arena/70`) con buen contraste. NUNCA hex.
- Copy en español, sin jerga: decir "respuestas" (NO "hits"), "Se renueva en X días" (NO fechas frías).
- Color semántico de la barra: verde `bg-ok` (>40% restante), ámbar `bg-tibio` (15-40%), rojo `bg-brasa` (<15%).
- Producto = LeadAI. Client Component (`"use client"`).
- `lib/api.ts` tiene `api<T>(ruta, opts)` que manda Authorization + X-Tenant-Id.
- `GET /uso` devuelve: `{ plan: string, bolsa: { mensual: {total, usado, restante}, prepago: {total, restante}, totalDisponible: number, seResetea: string }, desglosePorCanal, recargas: [...] }`.

---

### Task 1: `obtenerUso()` en lib/api.ts

**Files:**
- Modify: `leadai-app/lib/api.ts`
- Test: build.

**Interfaces:**
- Produces: tipo `Uso` y `export async function obtenerUso(): Promise<Uso | null>`.

- [ ] **Step 1: Agregar tipo y función**

En `leadai-app/lib/api.ts`:

```ts
export interface Uso {
  plan: string;
  bolsa: {
    mensual: { total: number; usado: number; restante: number };
    prepago: { total: number; restante: number };
    totalDisponible: number;
    seResetea: string; // fecha ISO del reseteo
  };
}

// Consumo del plan: cuántas "respuestas" (hits) le quedan al tenant activo.
export async function obtenerUso(): Promise<Uso | null> {
  try {
    return await api<Uso>("/uso");
  } catch {
    return null;
  }
}
```

> Ajustar la llamada a la firma real de `api<T>`. El backend puede devolver más campos (desglosePorCanal, recargas); el tipo `Uso` solo declara lo que el contador usa (está bien, TS ignora extras en runtime).

- [ ] **Step 2: Build**

Run: `cd leadai-app && npm run build` → sin errores.

- [ ] **Step 3: Commit**

```bash
cd leadai-app
git add lib/api.ts
git commit -m "feat(app): obtenerUso() — saldo de respuestas del plan"
```

---

### Task 2: Componente `<ContadorHits>`

**Files:**
- Create: `leadai-app/components/panel/ContadorHits.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `obtenerUso()` (Task 1), `leerEmpresaActiva()` de `@/lib/auth`.
- Produces: `export function ContadorHits()`.

- [ ] **Step 1: Crear el componente**

Crear `leadai-app/components/panel/ContadorHits.tsx`. Requisitos de UI/UX:
- Carga `obtenerUso()` en `useEffect` al montar. Re-fetch cuando cambia la empresa activa (dependencia en `leerEmpresaActiva()`; como es localStorage, se puede releer al montar — el sidebar se re-monta al cambiar empresa por el `window.location.reload()` del HeaderPanel, así que un fetch al montar alcanza).
- **Estado cargando:** un skeleton chico (una barra `animate-pulse bg-arena/20 h-2 rounded` + texto tenue), no un salto.
- **Estado sin datos** (obtenerUso devolvió null): no romper — mostrar un texto tenue "—" o nada.
- **Con datos:** calcular `restante = bolsa.totalDisponible`, `total = bolsa.mensual.total + bolsa.prepago.total`, `pct = total>0 ? restante/total : 0`.
  - Título: "Respuestas del mes" (`text-arena/70`, chico, uppercase tracking).
  - Barra de progreso: fondo `bg-arena/15`, relleno con ancho `pct*100%` y color según pct: `>0.4` → `bg-ok`; `0.15–0.4` → `bg-tibio`; `<0.15` → `bg-brasa`. Transición suave.
  - Número: `{restante} / {total}` (`text-arena`, semibold). Usar `toLocaleString("es-PE")` para miles.
  - Debajo: "Se renueva en {N} días" donde N = días entre hoy y `bolsa.seResetea` (calcular con `new Date`). Si N<=0, "Se renueva hoy".
  - **"Comprar más"**: mostrar un link/botón discreto SIEMPRE, pero DESTACADO (color `bg-brasa text-carta`) solo cuando `pct < 0.15`; si no, tenue (`text-arena/60` subrayado). Por ahora el link puede ir a `/configuracion` (donde estará la compra en el Bloque B) o a `#` con un TODO — usar `/configuracion`.
- Márgenes/espaciado prolijos, coherente con el sidebar (px como el resto de items del sidebar).
- Copy exacto: "Respuestas del mes", "Se renueva en X días", "Comprar más".

Estructura de referencia (ajustar a los datos reales):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obtenerUso, type Uso } from "@/lib/api";

export function ContadorHits() {
  const [uso, setUso] = useState<Uso | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    obtenerUso().then((u) => { if (vivo) { setUso(u); setCargando(false); } });
    return () => { vivo = false; };
  }, []);

  if (cargando) {
    return (
      <div className="px-5 py-4">
        <div className="h-2 w-full animate-pulse rounded-full bg-arena/15" />
        <div className="mt-2 h-2 w-24 animate-pulse rounded bg-arena/10" />
      </div>
    );
  }
  if (!uso) return null;

  const { bolsa } = uso;
  const restante = bolsa.totalDisponible;
  const total = bolsa.mensual.total + bolsa.prepago.total;
  const pct = total > 0 ? restante / total : 0;
  const color = pct > 0.4 ? "bg-ok" : pct >= 0.15 ? "bg-tibio" : "bg-brasa";
  const dias = Math.max(0, Math.ceil((new Date(bolsa.seResetea).getTime() - Date.now()) / 86_400_000));
  const bajo = pct < 0.15;

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-arena/60">
        Respuestas del mes
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-arena/15">
        <div className={`h-full rounded-full ${color} transition-[width] duration-500`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-[0.9rem] font-semibold text-arena">
        {restante.toLocaleString("es-PE")} <span className="text-arena/50">/ {total.toLocaleString("es-PE")}</span>
      </p>
      <p className="text-[0.72rem] text-arena/50">
        {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
      </p>
      <Link
        href="/configuracion"
        className={`mt-2 inline-block rounded-chip px-3 py-1 text-[0.72rem] font-bold transition ${
          bajo ? "bg-brasa text-carta" : "text-arena/60 underline hover:text-arena"
        }`}
      >
        Comprar más
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `cd leadai-app && npm run build` → sin errores.

- [ ] **Step 3: Commit**

```bash
cd leadai-app
git add components/panel/ContadorHits.tsx
git commit -m "feat(panel): componente ContadorHits (saldo de respuestas, UI pulida)"
```

---

### Task 3: Montar el contador en el Sidebar

**Files:**
- Modify: `leadai-app/components/panel/Sidebar.tsx`
- Test: build + navegador.

**Interfaces:**
- Consumes: `<ContadorHits>` (Task 2).

- [ ] **Step 1: Insertar el contador**

En `leadai-app/components/panel/Sidebar.tsx`, importar `ContadorHits` y montarlo **entre la navegación y el bloque de perfil del usuario** (el que muestra nombre/email abajo). Debe quedar visualmente integrado: encima del perfil, con el separador que ya usa el sidebar. Leer el Sidebar primero para insertarlo en el lugar correcto sin romper el layout flex (el `nav` es `flex-1`, el perfil va abajo; el contador va justo antes del perfil).

- [ ] **Step 2: Build + navegador**

Run: `npm run build` + `npm run dev`. En el panel (con una empresa que tenga plan/bolsa): el contador aparece en el sidebar, con la barra de color y el saldo. Cambiar de empresa lo actualiza. Verificar contraste sobre el fondo oscuro.

- [ ] **Step 3: Commit**

```bash
cd leadai-app
git add components/panel/Sidebar.tsx
git commit -m "feat(panel): contador de respuestas en el sidebar"
```

---

### Task 4: Deploy y verificación

- [ ] **Step 1: Merge a master y deploy**

```bash
cd leadai-app
git checkout master && git merge --no-ff <rama> && git push origin master
npx vercel --prod --yes
```

- [ ] **Step 2: Verificar en app.leadai-pe.com**

Login → el sidebar muestra el contador de respuestas. Probar con una de las marcas demo (tienen plan `pro`). Confirmar color, copy y que "Comprar más" lleve a Configuración.

---

## Notas
- Todo frontend; el backend (`GET /uso`) ya existe y funciona.
- El link "Comprar más" apunta a /configuracion por ahora; la compra real es del Bloque B.
- Las marcas demo tienen plan `pro` → deberían mostrar una bolsa mensual. Si `/uso` devuelve bolsa en 0 para el plan free, el contador igual se ve (0 / 0 → maneja el caso `total===0`).
