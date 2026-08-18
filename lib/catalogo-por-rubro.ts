/**
 * QUÉ CATÁLOGO VE CADA RUBRO (2026-08-18).
 *
 * Un restaurante tiene una "carta"; una veterinaria, un "catálogo"; una tienda,
 * "productos". La cosa es la misma —cosas con precio y foto que el cliente
 * pide— pero la palabra que cada dueño usa todos los días no.
 *
 * HOY SOLO ESTÁ GASTRONOMÍA. Es por donde arrancamos y es donde el producto
 * está terminado: cocina, extras, combos, tiempos de preparación. Los demás
 * rubros se van sumando de a uno, cuando su caso esté pensado de verdad —
 * mostrarles una "Carta" a medias es peor que no mostrarles nada.
 *
 * Para sumar uno: agregá su entrada acá. El menú, los títulos y el filtro
 * salen todos de esta tabla, así que no hay nada más que tocar.
 */

export interface CatalogoRubro {
  /** Cómo lo llama el dueño de ese rubro. */
  nombre: string;
  /** El título de la pantalla. */
  titulo: string;
  /** Lo que se lee bajo el título. */
  bajada: string;
  /** Cómo se llama una cosa del catálogo, en singular. */
  cosa: string;
  /** Y su sección ("sección" en una carta, "categoría" en una tienda). */
  agrupacion: string;
  /**
   * Si el rubro tiene COCINA: abrir/cerrar, tiempos de preparación,
   * motorizados. Una veterinaria vende alimento pero no lo cocina.
   */
  conCocina: boolean;
}

const CATALOGOS: Record<string, CatalogoRubro> = {
  gastronomia: {
    nombre: "Carta",
    titulo: "Carta y precios",
    bajada: "Lo que cargues acá es lo que ve tu cliente y lo que el bot usa para tomar pedidos.",
    cosa: "plato",
    agrupacion: "sección",
    conCocina: true,
  },
};

/**
 * El catálogo de un rubro, o `null` si ese rubro todavía no tiene uno.
 *
 * Devolver null y no un default genérico es a propósito: quien no está en la
 * tabla NO ve la sección, en vez de ver una pantalla con palabras que no son
 * las suyas.
 */
export function catalogoDe(rubro: string | null | undefined): CatalogoRubro | null {
  if (!rubro) return null;
  return CATALOGOS[rubro.trim().toLowerCase()] ?? null;
}

/** ¿Este rubro tiene catálogo? Para decidir si la sección va en el menú. */
export function tieneCatalogo(rubro: string | null | undefined): boolean {
  return catalogoDe(rubro) != null;
}
