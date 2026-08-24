# leadai-app — reglas del repo

Panel web de LeadAI (Next.js). Deploy: push a `master` → Vercel → https://app.leadai-pe.com. Español en código, comentarios y UI.

## 🎯 FOCO VIGENTE (decisión de Jonathan, 2026-08-24)

**Features NUEVAS de captación: CONGELADAS** hasta validar uso real con Guisella. Fixes, deuda y pedidos directos de ella: sí. Pantallas/módulos nuevos de captación: no. Detalle en `leadia/docs/captacion-foco-y-canales.md`.

## Reglas del repo

- **Checkout COMPARTIDO entre agentes**: `git add` solo TUS archivos, nunca `git add -A`. `git status` antes de commitear. PUSHEAR al terminar.
- **Secciones del panel**: viven en `components/panel/Sidebar.tsx` (SECCIONES) con capacidades por rubro resueltas en el backend (`leadia/src/core/capacidades-rubro.ts`). El menú va AGRUPADO en bloques (Ventas / Marketing / Tu negocio) — una sección nueva entra a un bloque existente, no suelta.
- **Precios/planes**: el panel NUNCA calcula precios — los manda el backend (`GET /suscripcion`, `/campanias/paquetes`). La llave pública de Culqi es `NEXT_PUBLIC_CULQI_PUBLIC_KEY` en Vercel (live desde 2026-08-24; cambia = rebuild).
- **Design system**: "Brand Harmony" — teal para acción (brasa), coral para calor, Plus Jakarta Sans. Tokens en `globals.css`; no inventar colores.
- Compilar con `npx tsc --noEmit` antes de commitear.
