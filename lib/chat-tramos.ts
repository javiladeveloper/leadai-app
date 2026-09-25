/**
 * CONVERSACIONES LARGAS, POR TRAMOS (2026-09-25, pedido de Jonathan: "los
 * mensajes tengo que bajar mucho… acomódalos como lo hicimos con Sania").
 *
 * El chat bajaba TODO el historial en cada apertura —y otra vez en cada
 * sondeo de 4 s— y lo pintaba entero, empezando por el mensaje más viejo:
 * para ver lo último había que bajar la conversación completa.
 *
 * Mismo criterio que la bandeja de Sania (24/09): se piden los últimos
 * MENSAJES_A_PEDIR al backend (`/leads/:id?ultimos=N`), se pintan los últimos
 * MENSAJES_VISIBLES, y "Ver mensajes anteriores" suma de a TRAMO: primero de
 * lo que ya llegó y, cuando se acaba, pidiéndole más al backend.
 */

/** Los que se piden al abrir una conversación. */
export const MENSAJES_A_PEDIR = 150;
/** Los que se pintan al abrir: los más recientes. */
export const MENSAJES_VISIBLES = 60;
/** Cuántos más trae cada toque de "Ver mensajes anteriores". */
export const TRAMO = 100;
/** Tope del backend para `ultimos`. */
export const MAX_PEDIDO = 1000;

/** Los últimos `mostrar` mensajes, y cuántos quedan antes (los del backend incluidos). */
export function tramoVisible<T>(
  mensajes: T[],
  mostrar: number,
  total?: number,
): { visibles: T[]; anteriores: number } {
  const visibles = mensajes.slice(-mostrar);
  const hay = Math.max(total ?? mensajes.length, mensajes.length);
  return { visibles, anteriores: Math.max(0, hay - visibles.length) };
}

/**
 * Qué hacer al tocar "Ver mensajes anteriores": mostrar más de lo que ya
 * llegó, y pedir más al backend si lo cargado no alcanza.
 */
export function verAnteriores(e: {
  mostrar: number;
  cargados: number;
  pedidos: number;
  total?: number;
}): { mostrar: number; pedir: number | null } {
  const mostrar = e.mostrar + TRAMO;
  const faltanEnBackend = (e.total ?? e.cargados) > e.cargados;
  const pedir = mostrar > e.cargados && faltanEnBackend
    ? Math.min(Math.max(e.pedidos, e.cargados) + 3 * TRAMO, MAX_PEDIDO)
    : null;
  return { mostrar, pedir };
}

/** ¿El que lee está (casi) al final? Solo ahí un mensaje nuevo lo baja solo. */
export function cercaDelFinal(el: { scrollHeight: number; scrollTop: number; clientHeight: number }, margen = 150): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < margen;
}
