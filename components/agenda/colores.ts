// Color por negocio en la Agenda (2026-09-27). Paleta FIJA de 8: el índice
// sale de `coloresDeNegocios` (orden estable de tenantId), así el mismo
// negocio se ve del mismo color en todas las vistas y al navegar.
//
// Las clases van escritas enteras (no armadas con plantillas) para que
// Tailwind las encuentre al compilar. El TEXTO siempre es el tono 900 sobre el
// fondo 50/100: pasa AA; el tono 500 queda para la barrita y los puntos.

export interface ColorNegocio {
  /** Bloque/chip: fondo suave + barrita izquierda + texto oscuro. */
  bloque: string;
  /** Punto de la leyenda y de la casilla del mes en móvil. */
  punto: string;
}

export const PALETA: ColorNegocio[] = [
  { bloque: "bg-teal-50 border-teal-500 text-teal-900", punto: "bg-teal-500" },
  { bloque: "bg-sky-50 border-sky-500 text-sky-900", punto: "bg-sky-500" },
  { bloque: "bg-violet-50 border-violet-500 text-violet-900", punto: "bg-violet-500" },
  { bloque: "bg-amber-50 border-amber-500 text-amber-900", punto: "bg-amber-500" },
  { bloque: "bg-rose-50 border-rose-500 text-rose-900", punto: "bg-rose-500" },
  { bloque: "bg-lime-50 border-lime-600 text-lime-900", punto: "bg-lime-600" },
  { bloque: "bg-indigo-50 border-indigo-500 text-indigo-900", punto: "bg-indigo-500" },
  { bloque: "bg-orange-50 border-orange-500 text-orange-900", punto: "bg-orange-500" },
];

export function colorDe(colores: Map<string, number>, tenantId: string): ColorNegocio {
  return PALETA[(colores.get(tenantId) ?? 0) % PALETA.length];
}
