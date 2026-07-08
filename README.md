# LeadAI · App

La herramienta de la fuerza de ventas. Guisella (y cualquier vendedora) abre la
app en el celular para **ver sus leads, responder al instante y cerrar ventas** —
mientras la IA atiende sus redes 24/7 y le avisa justo cuándo entrar a cerrar.

Frontend de LeadAI. El backend vive en el repo `leadia`; la landing pública en
`leadai-landing`.

## Stack

- **Next.js 16** (App Router) · **React 19** · **Tailwind v4** (config CSS-first con `@theme`).
- Fuente **Atkinson Hyperlegible** (auto-hospedada con `next/font`, sin CDN).
- Diseño mobile-first, táctil ("con un toque, sin teclear"): objetivos ≥48px, base 20px.

## Pantallas

| Ruta | Pantalla |
|---|---|
| `/` | Login (Google + modo demo) |
| `/bandeja` | Bandeja de leads con semáforo (caliente/tibio/frío) y resumen de la IA |
| `/conversacion/[id]` | Conversación: resumen IA, chat, respuestas listas para enviar, registrar venta |
| `/configuracion` | Marcas y productos, tono del bot, avisos, seguimientos, equipo |
| `/reportes` | Comisiones, funnel y resultados por marca |

## Configuración

Copiá `.env.example` a `.env.local` y completá:

- `NEXT_PUBLIC_API_URL` — URL del backend (`leadia`). En dev: `http://localhost:3000`.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Client ID de Google (Google Cloud Console → OAuth 2.0, tipo Web).
  **Sin esto, la app entra en modo demostración** (botón "Continuar con Google" → sesión de demo con datos de ejemplo). Ideal para mostrarla antes de tener la credencial.

## Correr

```bash
npm install
npm run dev      # http://localhost:3000 (o el siguiente puerto libre)
npm run build    # build de producción
```

## Estado

- ✅ Las 5 pantallas construidas con el sistema de diseño Brasa.
- ✅ Login con Google integrado (Google Identity Services → `POST /auth/google` del backend).
- ✅ Modo demo con datos realistas para la reunión con Guisella.
- ⏳ **Pendiente de datos reales:** la capa `lib/leads.ts` devuelve datos de demostración.
  Cuando el backend exponga los endpoints de lectura para la app (leads, conversaciones,
  reportes), se cambia esa capa por llamadas a `api()` sin tocar la UI.
- ⏳ **Pendiente de credencial:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` para el login real.
