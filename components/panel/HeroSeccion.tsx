"use client";

/**
 * EL HERO DE UNA SECCIÓN DE MARKETING (2026-08-27, pedido de Jonathan).
 *
 * "Me gustó mucho lo que hiciste con Presencia... lo mismo haz para campañas y
 * anuncios, imágenes, cosas vistosas".
 *
 * Anuncios y Campañas abrían con un título y una línea gris. Un dueño que
 * nunca hizo publicidad no sabe qué diferencia hay entre las dos —ni por qué
 * le conviene alguna— y un título no se lo dice.
 *
 * El hero contesta eso antes de que tenga que tocar nada: qué gana, en su
 * idioma, con un dibujo que lo hace evidente de un vistazo.
 *
 * Se comparte en vez de copiarse en cada pantalla: las tres secciones tienen
 * que verse hermanas, y tres copias divergen a la primera edición.
 */
export function HeroSeccion({
  titulo,
  bajada,
  nota,
  dibujo,
}: {
  titulo: string;
  bajada: React.ReactNode;
  /** Una línea más chica debajo: el detalle que saca la duda. */
  nota?: React.ReactNode;
  dibujo: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-tarjeta bg-superficie-honda text-arena">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-7">
        <div className="min-w-0 flex-1">
          <h2 className="text-[1.45rem] font-bold leading-tight sm:text-[1.7rem]">{titulo}</h2>
          <p className="mt-2.5 text-[0.95rem] text-arena/80">{bajada}</p>
          {nota && <p className="mt-2 text-[0.9rem] text-arena/70">{nota}</p>}
        </div>
        {dibujo}
      </div>
    </div>
  );
}

/**
 * EL ENCABEZADO DE UN FORMULARIO DE CREACIÓN (2026-08-27, pedido de Jonathan).
 *
 * "Hay un botón crear nueva campaña, nuevo anuncio, etc... ten el mismo
 * cuidado que tuviste en Presencia... están bien planos, aburridos y feos".
 *
 * Los formularios abrían con un título suelto —"Nueva campaña"— y campos
 * debajo. El dueño no sabe qué va a pasar cuando termine, ni cuánto le va a
 * tomar, ni si puede arrepentirse.
 *
 * Este encabezado contesta eso antes del primer campo: qué está por hacer, en
 * su idioma, con su icono para que se distinga de las otras secciones.
 */
export function CabeceraFormulario({
  icono,
  titulo,
  bajada,
  onCerrar,
}: {
  icono: React.ReactNode;
  titulo: string;
  bajada: React.ReactNode;
  /** Volver atrás sin crear nada. Poder salir es parte de animarse a entrar. */
  onCerrar?: () => void;
}) {
  return (
    <div className="flex items-start gap-3.5 border-b border-linea pb-4">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brasa/12 text-brasa-texto"
        aria-hidden
      >
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[1.1rem] font-bold text-tinta">{titulo}</h2>
        <p className="mt-1 text-[0.86rem] text-frio">{bajada}</p>
      </div>
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-frio transition hover:bg-arena hover:text-tinta"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── LAS ILUSTRACIONES ──
   SVG y no imágenes: pesan casi nada, se ven nítidas en cualquier pantalla y
   no hay que subir archivos. Son esquemáticas a propósito — muestran la IDEA
   (un anuncio que llega a gente nueva, un mensaje que vuelve), no una captura
   que quedaría vieja al primer rediseño de Meta. */

/** Un anuncio en el celular alcanzando gente nueva. */
export function AnuncioIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      {/* El teléfono con el anuncio */}
      <rect x="14" y="8" width="76" height="114" rx="11" fill="#fff" opacity=".95" />
      <rect x="21" y="17" width="30" height="4.5" rx="2.25" fill="#c8ccd0" />
      <rect x="21" y="28" width="62" height="42" rx="4" fill="#e8895f" />
      <circle cx="41" cy="45" r="9" fill="#fff" opacity=".55" />
      <path d="M38.5 40.5l7 4.5-7 4.5z" fill="#e8895f" />
      <rect x="21" y="76" width="44" height="4" rx="2" fill="#3c4043" />
      <rect x="21" y="85" width="54" height="3.5" rx="1.75" fill="#c8ccd0" />
      <rect x="21" y="98" width="62" height="14" rx="7" fill="#1877f2" />
      <text x="52" y="107.5" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="700">
        Ver la carta
      </text>
      {/* Las personas nuevas a las que llega */}
      <g fill="#f0c9a8">
        {[
          [112, 30], [136, 46], [110, 66], [134, 84], [114, 102],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="6.5" />
            <path d={`M${x - 9} ${y + 17}a9 9 0 0118 0z`} />
          </g>
        ))}
      </g>
      {/* Las flechas del anuncio hacia ellos */}
      <g stroke="#e8895f" strokeWidth="1.6" strokeDasharray="3 3" fill="none" opacity=".8">
        <path d="M92 50q12-14 22-16" />
        <path d="M92 58q14 4 20 6" />
        <path d="M92 66q12 18 22 30" />
      </g>
    </svg>
  );
}

/** Un mensaje que vuelve a un cliente que ya compró. */
export function CampaniaIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      {/* La lista de clientes que ya compraron */}
      <rect x="8" y="16" width="62" height="98" rx="8" fill="#fff" opacity=".95" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle cx={22} cy={32 + i * 23} r="7" fill="#f0c9a8" />
          <rect x={33} y={28 + i * 23} width="28" height="4" rx="2" fill="#3c4043" />
          <rect x={33} y={36 + i * 23} width="20" height="3.5" rx="1.75" fill="#c8ccd0" />
        </g>
      ))}
      {/* El mensaje que sale hacia ellos */}
      <path d="M74 62q10-10 18-10" stroke="#25d366" strokeWidth="1.8" fill="none" strokeDasharray="3 3" />
      <rect x="90" y="34" width="52" height="40" rx="9" fill="#25d366" />
      <path d="M99 74l1 8 8-8z" fill="#25d366" />
      <rect x="98" y="45" width="34" height="4" rx="2" fill="#fff" opacity=".95" />
      <rect x="98" y="54" width="26" height="4" rx="2" fill="#fff" opacity=".7" />
      <rect x="98" y="63" width="30" height="4" rx="2" fill="#fff" opacity=".7" />
      {/* Vuelve: el pedido nuevo */}
      <circle cx="116" cy="99" r="15" fill="#fff" opacity=".95" />
      <path
        d="M110 94h12l-1.5 11h-9z"
        fill="none"
        stroke="#e8895f"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M113 94a3 3 0 016 0" fill="none" stroke="#e8895f" strokeWidth="2" />
    </svg>
  );
}

/** Un post que sale a varias redes a la vez. */
export function PublicarIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      {/* El post que se crea una vez */}
      <rect x="10" y="34" width="62" height="62" rx="9" fill="#fff" opacity=".95" />
      <rect x="18" y="42" width="46" height="30" rx="4" fill="#c4a882" />
      <circle cx="30" cy="53" r="4.5" fill="#fff" opacity=".8" />
      <path d="M18 66l11-9 9 7 6-4 20 12v0H18z" fill="#8d6e4e" opacity=".85" />
      <rect x="18" y="78" width="38" height="4" rx="2" fill="#3c4043" />
      <rect x="18" y="86" width="28" height="3.5" rx="1.75" fill="#c8ccd0" />
      {/* Las flechas hacia cada red */}
      <g stroke="#fff" strokeWidth="1.6" strokeDasharray="3 3" fill="none" opacity=".5">
        <path d="M74 52q14-12 24-14" />
        <path d="M74 65h24" />
        <path d="M74 78q14 12 24 14" />
      </g>
      {/* Instagram, Facebook y TikTok */}
      <rect x="102" y="24" width="30" height="30" rx="9" fill="#e1306c" />
      <rect x="110" y="32" width="14" height="14" rx="4.5" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="117" cy="39" r="3.4" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="102" y="50" width="30" height="30" rx="9" fill="#1877f2" />
      <path
        d="M120 59h-3v-2.2c0-.9.6-1.1 1-1.1h2v-3.4h-2.8c-3.1 0-3.8 2.3-3.8 3.8V59H111v3.5h2.4V72h3.6v-9.5h2.6z"
        fill="#fff"
      />
      <rect x="102" y="76" width="30" height="30" rx="9" fill="#111" />
      <path
        d="M121.5 84.5c-1.9 0-3.4-1.5-3.4-3.4h-2.9v10.6a2.4 2.4 0 11-2.4-2.4v-2.9a5.3 5.3 0 105.3 5.3v-5.6c1 .6 2.2.9 3.4.9z"
        fill="#fff"
      />
    </svg>
  );
}


/* ── ILUSTRACIONES DE LAS SECCIONES DEL EMBUDO (2026-08-27) ──
   Jonathan: "el mismo esfuerzo que metimos para marketing... deberíamos
   tenerlo para cada sección, para que se vea amigable, intuitivo".
   Mismo criterio que las de arriba: esquemáticas, en SVG, mostrando la IDEA
   de la sección y no una captura. */

/** Una lista de contactos con su temperatura: el que llega y hay que atender. */
export function LeadsIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      <rect x="16" y="12" width="118" height="106" rx="10" fill="#fff" opacity=".95" />
      {[
        { y: 30, c: "#e8895f", t: "🔥" },
        { y: 58, c: "#f0c9a8", t: "" },
        { y: 86, c: "#c8ddd4", t: "" },
      ].map((f, i) => (
        <g key={i}>
          <circle cx={36} cy={f.y} r="9" fill={f.c} />
          <rect x={52} y={f.y - 7} width="44" height="5" rx="2.5" fill="#3c4043" />
          <rect x={52} y={f.y + 2} width="30" height="4" rx="2" fill="#c8ccd0" />
          {/* La temperatura: lo que decide a quién llamar primero */}
          <rect x={104} y={f.y - 6} width="18" height="11" rx="5.5" fill={i === 0 ? "#e8895f" : "#eef2f5"} />
          {i === 0 && (
            <text x={113} y={f.y + 2} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700">
              ●
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

/** Un negocio ofreciendo trabajo a un vendedor: el marketplace. */
export function OportunidadesIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      {/* El maletín del negocio que busca */}
      <rect x="14" y="42" width="52" height="42" rx="7" fill="#fff" opacity=".95" />
      <path d="M32 42v-5a4 4 0 014-4h8a4 4 0 014 4v5" fill="none" stroke="#fff" strokeWidth="3" opacity=".95" />
      <rect x="24" y="56" width="32" height="4" rx="2" fill="#3c4043" />
      <rect x="24" y="65" width="22" height="3.5" rx="1.75" fill="#c8ccd0" />
      {/* El apretón: se toma la oportunidad */}
      <path d="M70 63h14" stroke="#fff" strokeWidth="2" strokeDasharray="3 3" opacity=".5" />
      <circle cx="112" cy="63" r="23" fill="#fff" opacity=".95" />
      <circle cx="112" cy="55" r="7.5" fill="#f0c9a8" />
      <path d="M100 79a12 12 0 0124 0z" fill="#f0c9a8" />
      <circle cx="130" cy="46" r="10" fill="#e8895f" />
      <path d="M126 46l3 3 6-6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** El embudo por etapas: dónde está cada venta. */
export function SeguimientoIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={12 + i * 44} y="20" width="38" height="92" rx="7" fill="#fff" opacity={0.95 - i * 0.18} />
          <rect x={18 + i * 44} y="28" width="20" height="4" rx="2" fill="#9aa0a6" />
          {Array.from({ length: 3 - i }).map((_, j) => (
            <g key={j}>
              <rect x={18 + i * 44} y={40 + j * 22} width="26" height="16" rx="4" fill="#eef2f5" />
              <rect x={22 + i * 44} y={45 + j * 22} width="18" height="3" rx="1.5" fill="#c8ccd0" />
            </g>
          ))}
        </g>
      ))}
      {/* La que se mueve a la siguiente etapa */}
      <path d="M46 48h14" stroke="#e8895f" strokeWidth="2" fill="none" markerEnd="url(#f)" />
      <defs>
        <marker id="f" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0 0l5 2.5L0 5z" fill="#e8895f" />
        </marker>
      </defs>
    </svg>
  );
}

/** Un gráfico que sube: cómo va el negocio. */
export function ReportesIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      <rect x="14" y="16" width="122" height="98" rx="10" fill="#fff" opacity=".95" />
      {/* Las barras */}
      {[
        { x: 30, h: 26 },
        { x: 52, h: 40 },
        { x: 74, h: 34 },
        { x: 96, h: 56 },
      ].map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={96 - b.h}
          width="14"
          height={b.h}
          rx="3.5"
          fill={i === 3 ? "#e8895f" : "#d8e3dd"}
        />
      ))}
      <path d="M26 96h100" stroke="#e8eaed" strokeWidth="2" />
      {/* La línea de tendencia, que es lo que se mira */}
      <path d="M37 74l22-12 22 6 22-20" stroke="#e8895f" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="103" cy="48" r="4.5" fill="#e8895f" />
      <rect x="30" y="26" width="34" height="5" rx="2.5" fill="#3c4043" />
    </svg>
  );
}

export default HeroSeccion;
