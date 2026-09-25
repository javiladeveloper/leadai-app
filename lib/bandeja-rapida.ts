/**
 * LA BANDEJA SIN ESPERAR A BAJAR TODO (2026-09-25, Jonathan: "que pueda
 * cargar más rápido los mensajes y cuando entro a uno").
 *
 * La bandeja bajaba TODAS las conversaciones, 100 por página y en serie
 * (hasta 20 páginas), antes de mostrar nada — y repetía lo mismo cada 4 s.
 * Con un negocio grande (DALU, ~4.500 conversaciones) eran decenas de
 * segundos con la pantalla vacía. Mismo arreglo que la bandeja de Sania
 * (24-sep): el backend ordena por el ÚLTIMO MENSAJE, así que la primera página
 * siempre trae lo que se movió.
 *   - Se muestra la primera página apenas llega y el resto se suma detrás.
 *   - El sondeo pide SOLO la primera página y la mezcla con lo que ya hay.
 */

/** Lo fresco arriba (reemplaza su versión vieja); lo demás conserva su orden detrás. */
export function mezclarPaginaReciente<T extends { id: string }>(actuales: T[], recientes: T[]): T[] {
  const ids = new Set(recientes.map((l) => l.id));
  return [...recientes, ...actuales.filter((l) => !ids.has(l.id))];
}

/** Suma una página más vieja al final, sin duplicar (un lead pudo subir entre páginas). */
export function agregarPaginaVieja<T extends { id: string }>(actuales: T[], pagina: T[]): T[] {
  const ids = new Set(actuales.map((l) => l.id));
  return [...actuales, ...pagina.filter((l) => !ids.has(l.id))];
}

const ZONA = "America/Lima";
const diaDe = (d: Date) => d.toLocaleDateString("es-PE", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * EL DÍA ARRIBA DE LOS MENSAJES (2026-09-25): "Hoy", "Ayer" o "lunes 22 sep".
 * Devuelve el rótulo solo cuando el mensaje abre un día nuevo; `null` si es
 * del mismo día que el anterior. En hora de Lima.
 */
export function separadorDeDia(fecha: string, anterior: string | undefined, ahora: Date = new Date()): string | null {
  const d = new Date(fecha);
  if (anterior && diaDe(new Date(anterior)) === diaDe(d)) return null;
  if (diaDe(d) === diaDe(ahora)) return "Hoy";
  if (diaDe(d) === diaDe(new Date(ahora.getTime() - 86_400_000))) return "Ayer";
  const texto = d.toLocaleDateString("es-PE", { timeZone: ZONA, weekday: "long", day: "numeric", month: "short" });
  return texto.replace(/\.$/, "").replace(",", "");
}

/** "14:05", en hora de Lima: la hora de cada mensaje. */
export function horaDe(fecha: string): string {
  return new Date(fecha).toLocaleTimeString("es-PE", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false });
}
