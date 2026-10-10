// Íconos SVG inline — sin dependencias externas, heredan color con currentColor.

type P = { className?: string };

export function IconoRayo({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" fill="currentColor" />
    </svg>
  );
}

export function IconoBandeja({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 13h4l2 3h6l2-3h4M3 13 6 5h12l3 8v6H3v-6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function IconoReportes({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoConfig({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoMic({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconoEnviar({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12 20 4l-6 16-3-7-7-1Z" fill="currentColor" />
    </svg>
  );
}

export function IconoWhatsApp({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3-.8-2.5-1-4.1-3.6-4.2-3.8-.1-.2-1-1.3-1-2.5s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.5c-.1.2-.3.3-.1.6.1.3.6 1 1.3 1.6.9.8 1.6 1 1.9 1.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.2.1.7-.1 1.3Z" />
    </svg>
  );
}

export function IconoInstagram({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function IconoMessenger({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.3 2 2 6.2 2 11.7c0 2.9 1.2 5.4 3.1 7.1.2.1.3.3.3.6l.1 1.7c0 .5.6.9 1.1.7l1.9-.8c.2-.1.4-.1.6-.1 1 .3 2 .4 3.1.4 5.7 0 10-4.2 10-9.7C22 6.2 17.7 2 12 2Zm6 7.5-2.9 4.7c-.5.7-1.5.9-2.2.4l-2.3-1.7a.6.6 0 0 0-.7 0l-3.1 2.4c-.4.3-1-.2-.7-.6l2.9-4.7c.5-.7 1.5-.9 2.2-.4l2.3 1.7c.2.2.5.2.7 0l3.1-2.4c.4-.3 1 .2.7.6Z" />
    </svg>
  );
}

export function IconoTikTok({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.5 3c.3 2 1.5 3.6 3.5 3.9v2.6c-1.3.1-2.5-.3-3.6-1v5.9c0 3.4-2.5 5.6-5.6 5.6-3 0-5.3-2.3-5.3-5.2 0-3.1 2.6-5.4 6-5v2.7c-.4-.1-.8-.2-1.2-.2-1.3 0-2.3 1-2.3 2.4 0 1.4 1 2.4 2.4 2.4 1.4 0 2.4-1 2.4-2.6V3h3.3Z" />
    </svg>
  );
}

export function IconoChevron({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoGoogle({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-7.9Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3-3A11 11 0 0 0 2 7.1l3.7 2.8C6.6 7.4 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

export function IconoInicio({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 10 12 3l9 7v10h-4v-5h-10v5H3V10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function IconoConversaciones({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconoSeguimiento({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l3 3 6-6M4 20h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Maletín — para la sección Oportunidades (red de negocios).
export function IconoOportunidades({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Diagrama de nodos conectados — para la sección Flujos del bot.
export function IconoFlujos({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="3" y="16" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="14" y="16" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7.5 8v4m0 0h10v4m-10-4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── UN ÍCONO PROPIO POR SECCIÓN (2026-10-09) ──
   El menú repetía íconos: Seguimiento y Agenda eran el mismo check,
   Conversaciones, Comentarios y Equipo el mismo globo, Marketing y Placas el
   mismo rayo, Reportes y Mi plan las mismas barras, Inicio y Cocina la misma
   casa. Con el menú plegado (solo íconos) no había forma de distinguirlas.
   Mismo trazo que los de arriba: 24×24, línea de 2, puntas redondeadas. */

// Calendario — Agenda.
export function IconoAgenda({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 10h18M8 3v4M16 3v4M8 14h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Tablero de columnas — Seguimiento (las etapas de la venta).
export function IconoTablero({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="5" height="16" rx="1.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="10" y="4" width="5" height="11" rx="1.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <rect x="17" y="4" width="4" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// Megáfono — Marketing.
export function IconoMegafono({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10v4a1 1 0 0 0 1 1h3l8 5V4L8 9H5a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 15l1.5 5M19.5 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dos globos — Comentarios (lo que la gente escribe en tus posts).
export function IconoComentarios({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M15 9h4a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-3-3h-4a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8l-3 3v-3a2 2 0 0 1-2-2V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Dos personas — Equipo.
export function IconoEquipo({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.2A6.5 6.5 0 0 1 21.5 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Placa con ondas — Placas NFC de reseñas.
export function IconoPlaca({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M17.5 8.5a4 4 0 0 1 0 5M20 6a7.5 7.5 0 0 1 0 10M7 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Tarjeta de pago — Mi plan.
export function IconoPlan({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M2 10h20M6 15h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Olla humeante — Cocina (despachar pedidos).
export function IconoCocina({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 11h16v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6ZM2 11h20M9 7c0-1 1-1.5 1-2.5M14 7c0-1 1-1.5 1-2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Libro abierto — Carta (el menú del restaurante).
export function IconoCarta({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2Zm0 0v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
