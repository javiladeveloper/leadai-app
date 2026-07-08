# Diseño: Panel web de escritorio LeadAI

**Fecha:** 2026-07-08
**Estado:** Aprobado, listo para plan de implementación
**Repo:** `leadai-app` (frontend). Depende de endpoints de `leadia` (backend) para las capas 2-3.

---

## 1. Problema y objetivo

La app hoy es **mobile-first** (columna angosta centrada). En escritorio se ve como
"una app de celular estirada", desaprovechando el ancho. La decisión de producto es
**priorizar la versión WEB de escritorio**: un panel de trabajo completo (estilo CRM)
donde el vendedor gestiona todo. La app nativa de celular es un proyecto posterior.

**Objetivo:** convertir la app en un **panel web de escritorio responsive** con
sidebar fijo, aprovechando el ancho, manteniendo el sistema de diseño Brasa. Un solo
código que en pantallas anchas muestra el layout desktop y en chicas colapsa a mobile.

## 2. Visión de producto (los 4 pilares) y estrategia por capas

El panel es el centro de trabajo. Crece en 4 pilares, construidos **por capas** (no
todo de una) según qué está listo en el backend:

**Capa 1 — El marco + lo que YA funciona (esta primera pasada):**
- Shell desktop: sidebar fijo + header (empresa activa + usuario), responsive.
- **Configuración con el Playbook editable REAL** (conectado a `PUT /perfil` del backend)
  + sección Canales (Conectar WhatsApp, ya existe).
- Las demás pantallas (Inicio, Conversaciones, Leads, Reportes) rediseñadas a layout
  desktop, con **datos demo** por ahora (marcados visualmente como ejemplo).
- Conversaciones ya con el layout de **3 columnas** (aunque con demo).

**Capa 2 — Datos reales (siguiente):** endpoints de lectura en `leadia`
(leads, conversaciones, métricas) → conectar Conversaciones + Inicio (dashboard) +
Leads + Reportes a datos reales.

**Capa 3 — Seguimiento (feature nueva):** modelar etapas de venta + tablero
arrastrable + su endpoint.

Esta spec cubre en detalle la **Capa 1**; las capas 2-3 se especifican al abordarlas.

## 3. No-objetivos (fuera de alcance de la Capa 1)

- Endpoints de lectura reales (leads/conversaciones/métricas) — Capa 2.
- La pantalla Seguimiento (tablero de etapas) — Capa 3.
- La app nativa de celular — proyecto posterior.
- El botón "Ingresar" en la landing → se hace aparte (tarea corta en `leadai-landing`).

## 4. Nomenclatura del menú (lenguaje claro, no jerga)

Regla: nombrar por lo que la persona reconoce. Decisiones tomadas:
- **Inicio** (no "Dashboard")
- **Conversaciones** (o "Chats")
- **Seguimiento** (NO "Pipeline" — jerga; "Seguimiento" es natural para un vendedor)
- **Leads** (se mantiene: coherencia con la marca LeadAI + ya difundido en ventas LATAM)
- **Reportes**
- **Configuración**

## 5. Arquitectura del layout

```
┌────────────┬──────────────────────────────────────────┐
│ ⚡ LeadAI   │ [Muebles Roble ▾]          [Guisella ▾]  │  ← header
├────────────┼──────────────────────────────────────────┤
│ 📊 Inicio   │                                          │
│ 💬 Convers. │        CONTENIDO (ancho completo)         │
│ 📈 Seguim.  │        según la sección activa            │
│ 📥 Leads    │                                          │
│ 📊 Reportes │                                          │
│ ⚙️ Config   │                                          │
│            │                                          │
│ [Guisella] │  ← perfil + empresa activa abajo          │
└────────────┴──────────────────────────────────────────┘
   sidebar
   ~240px
```

- **Sidebar izquierdo fijo (~240px):** logo LeadAI arriba, navegación (6 secciones con
  ícono + label), perfil del usuario abajo.
- **Header superior:** selector de empresa activa (Guisella maneja varias marcas) +
  menú de usuario (nombre, cerrar sesión).
- **Contenido:** ocupa el ancho restante.
- **Responsive:** en `≥1024px` (lg) se ve el layout desktop; por debajo, el sidebar
  colapsa (drawer o se oculta) y reaparece la `NavInferior` mobile que ya existe.
  Un solo código, breakpoints de Tailwind.

## 6. Componentes

### 6.1 Shell / Layout (`app/(panel)/layout.tsx` — nuevo route group)
- Envuelve las pantallas del panel con Sidebar + Header.
- Client Component (usa la sesión, la empresa activa de `lib/auth`).
- Responsive: sidebar visible en `lg+`, drawer/oculto abajo.

### 6.2 Sidebar (`components/panel/Sidebar.tsx` — nuevo)
- Logo LeadAI, lista de secciones (usa `next/navigation` para marcar la activa),
  perfil del usuario abajo. Íconos del set `components/Iconos.tsx` existente.

### 6.3 Header (`components/panel/HeaderPanel.tsx` — nuevo)
- Selector de empresa activa (lee `empresas` de la sesión, setea con
  `guardarEmpresaActiva`). Menú de usuario (cerrar sesión con `cerrarSesion`).

### 6.4 Pantallas (migrar las 5 existentes al shell + layout desktop)
- **Inicio** (`app/(panel)/inicio`): dashboard con tarjetas de métricas (demo),
  "X calientes sin atender", accesos rápidos. Ancho, en grilla.
- **Conversaciones** (`app/(panel)/conversaciones`): **3 columnas** —
  (1) lista de chats/leads con semáforo, (2) conversación abierta (burbujas, notas de
  voz, borradores listos), (3) contexto IA (Quiere/Presupuesto/Urgencia) + acciones
  (registrar venta, tomar conversación). Reusa `Burbuja`, `ChipTemp`, `TarjetaLead`.
- **Leads** (`app/(panel)/leads`): tabla/lista ancha con filtros (estado, marca).
- **Reportes** (`app/(panel)/reportes`): métricas + funnel + por marca, en grilla ancha.
- **Configuración** (`app/(panel)/configuracion`): **Playbook editable REAL**
  (formulario conectado a `GET/PUT /perfil`) + sección Canales (Conectar WhatsApp) +
  resto de ajustes. Esta pantalla usa datos reales desde la Capa 1.

### 6.5 Playbook editable (`components/panel/PlaybookEditor.tsx` — nuevo, Capa 1 real)
- Formulario que carga `GET /perfil` y guarda con `PUT /perfil` (via `lib/api`).
- Campos del `perfilNegocioSchema`: nombreNegocio, rubro, tono, catálogo (con precios),
  preguntasClave, senalesCaliente, objeciones, politicas, llamadaAccion.
- Feedback de guardado (guardando/guardado/error).

## 7. Sistema de diseño

Mantener **Brasa** (el que ya tiene la app): fondo arena `#EAE1D0`, tarjetas
`#FFFDF9`, coral `#E25C43`, marrón tinta `#33281F`, gris frío `#8A8378`, fuente
Atkinson Hyperlegible. El sidebar puede usar una superficie más oscura del sistema
(`#33281F`) para separarlo visualmente del contenido. Tokens Tailwind ya existentes
(`bg-arena`, `bg-carta`, `text-tinta`, `text-frio`, `ring-linea`, etc.).

## 8. Responsive

- `lg` (≥1024px): layout desktop completo (sidebar + header + contenido ancho).
- `< lg`: sidebar colapsa; el contenido pasa a columna; reaparece `NavInferior`.
- Conversaciones: en desktop 3 columnas; en mobile vuelve al flujo lista→chat actual.
- Nada de scroll horizontal en el body; tablas/listas anchas con `overflow-x-auto`.

## 9. Datos demo vs reales (Capa 1)

- **Reales:** Configuración → Playbook (`/perfil`) y Canales (`/canales`).
- **Demo (marcado como ejemplo):** Inicio, Conversaciones, Leads, Reportes — siguen
  usando `lib/leads.ts` (datos demo) hasta la Capa 2. Mostrar un aviso sutil tipo
  "datos de ejemplo" para no confundir a Guisella en la demo.

## 10. Archivos afectados (Capa 1)

- `app/(panel)/layout.tsx` — nuevo shell.
- `components/panel/Sidebar.tsx`, `HeaderPanel.tsx`, `PlaybookEditor.tsx` — nuevos.
- `app/(panel)/inicio|conversaciones|leads|reportes|configuracion/page.tsx` — migrar
  las 5 pantallas actuales al route group con layout desktop.
- `lib/api.ts` — funciones `obtenerPerfil()` / `guardarPerfil()` para el playbook.
- Rutas viejas (`app/bandeja`, `app/conversacion/[id]`, etc.) → redirigen o se
  reemplazan por las nuevas del route group.

## 11. Dependencias externas / futuras

- Capa 2 necesita endpoints nuevos en `leadia`: lectura de leads, conversaciones y
  métricas por tenant. Se especifican en su propia spec.
- Capa 3 (Seguimiento) necesita modelar "etapas" en el backend.
