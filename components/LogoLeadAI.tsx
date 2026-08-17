/**
 * EL LOGO DE LEADAI (2026-08-17).
 *
 * Globo de chat menta, órbita naranja, rayo blanco al centro, sobre el verde
 * muy oscuro de la marca. Hasta ahora el panel dibujaba un rayo genérico en un
 * cuadrado menta — parecido de lejos, pero no era el logo.
 *
 * Los cuatro colores salen del arte original (leadai-mobile/design/icono-frente.png)
 * y están escritos a mano y no como tokens: es el LOGO, y tiene que verse igual
 * en el sidebar oscuro, en el login claro y donde sea que lo pongamos. Un logo
 * que cambia de color con el tema deja de ser un logo.
 *
 * DOS COSAS QUE EL ARTE ORIGINAL DEFINE Y HAY QUE RESPETAR (feedback 2026-08-17):
 *
 * 1. EL RAYO VA ADELANTE. Es lo primero que se lee; la órbita pasa por detrás.
 *    Dibujarlo antes que la elipse lo dejaba tapado y el logo se leía como una
 *    mancha naranja.
 * 2. EL RAYO ES GRANDE. En el original cruza el ícono casi de punta a punta,
 *    no es un detalle adentro del globo.
 *
 * El original tiene tres aros concéntricos; acá va uno solo. A 36–56px los tres
 * se funden, y lo que sostiene la identidad a este tamaño son los colores y la
 * silueta, no el detalle. Misma reducción que el favicon de la landing
 * (leadai-landing/app/icon.svg).
 */
export function LogoLeadAI({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-label="LeadAI">
      <rect width="32" height="32" rx="7.5" fill="#141a18" />

      {/* 1. El globo, al fondo: aro menta con su colita abajo a la derecha. */}
      <path
        d="M16 7.6a8 8 0 1 1-5.1 14.2l-.5 3.2 3-1.7A8 8 0 0 1 16 7.6Z"
        fill="none"
        stroke="#0fb68b"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 2. La órbita, en el medio: cruza el globo y pasa DETRÁS del rayo. */}
      <ellipse
        cx="16"
        cy="16"
        rx="10.6"
        ry="4.5"
        fill="none"
        stroke="#fc8a05"
        strokeWidth="1.9"
        strokeLinecap="round"
        transform="rotate(-27 16 16)"
      />

      {/* 3. El rayo, ADELANTE de todo y grande: es lo que se lee primero.
             El contorno oscuro lo despega de la órbita donde se cruzan. */}
      <path
        d="M18.6 5.6 10.2 17.6h4.4l-1 8.8 8.4-12.4h-4.4l1-8.4Z"
        fill="#ffffff"
        stroke="#141a18"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
