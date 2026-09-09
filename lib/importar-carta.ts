/**
 * IMPORTAR LA CARTA DESDE UN ARCHIVO — la parte que se puede probar sola
 * (2026-09-09).
 *
 * Jonathan: "en carta puede haber una sección extraer de pdf carta?". Subir
 * foto/PDF/Excel existía SOLO en el onboarding (`/bienvenida`, paso 3): el
 * dueño que se lo saltó, o que cambió su carta y quiere volver a subirla, no
 * tenía cómo — le quedaba cargar plato por plato.
 *
 * El trabajo pesado ya estaba hecho y no se toca: el backend renderiza el PDF
 * a imágenes (`core/pdf.ts`, hasta 20 páginas), lee cada una con visión y en
 * modo "agregar" SALTEA por nombre los platos que ya existen — así reimportar
 * no pisa precios ni fotos que el dueño ajustó a mano. Acá vive solo lo que
 * la pantalla necesita decidir y contar.
 */

/** Lo que devuelve `POST /carta/importar`. */
export interface ResultadoImportacion {
  creados: number;
  salteados: number;
  secciones: number;
}

/**
 * Qué pasó, en el idioma del dueño. "creados 12, salteados 39" no le dice
 * nada a nadie, y con cero platos nuevos un "¡Listo!" a secas sería mentira.
 */
export function resumenImportacion(r: ResultadoImportacion): string {
  const platos = (n: number) => `${n} ${n === 1 ? "plato" : "platos"}`;

  // Nada entró: la carta ya estaba completa. NO es un error — es la
  // protección contra duplicados haciendo su trabajo — pero tampoco se
  // celebra como si hubiera importado algo.
  if (r.creados === 0) {
    return r.salteados > 0
      ? `Tu carta ya estaba al día: los ${r.salteados} platos del archivo ya existían.`
      : "No encontramos platos nuevos en ese archivo.";
  }

  const secciones = r.secciones > 0
    ? ` en ${r.secciones} ${r.secciones === 1 ? "sección" : "secciones"}`
    : "";
  const nuevos = `${platos(r.creados)} ${r.creados === 1 ? "nuevo" : "nuevos"}${secciones}.`;

  if (r.salteados === 0) return nuevos;
  // Reimportar la carta entera es lo NORMAL cuando el dueño la actualizó, así
  // que los repetidos se cuentan sin tono de reproche.
  const repetidos = r.salteados === 1
    ? "Otro más ya estaba en tu carta."
    : `Otros ${r.salteados} ya estaban en tu carta.`;
  return `${nuevos} ${repetidos}`;
}

/** Extensiones que el backend sabe leer (visión para imagen/PDF, parser para Excel). */
const EXTENSIONES = /\.(pdf|jpe?g|png|webp|xlsx|xls)$/i;

/**
 * ¿Vale la pena mandar este archivo? Se filtra ANTES de subirlo: una llamada
 * de visión es la operación más cara del producto, y un .docx solo devolvería
 * una lista vacía después de hacerlo esperar.
 */
export function esArchivoDeCarta(nombre: string): boolean {
  return EXTENSIONES.test(nombre);
}

/** Los `accept` del input, en el mismo orden que las extensiones de arriba. */
export const ACEPTA_CARTA =
  "image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls";
