/**
 * EL FORMATO DEL ENCABEZADO DE UNA PLANTILLA (2026-09-09).
 *
 * EL CASO REAL: Jonathan subió el logo de Norac Labs como imagen de encabezado
 * y el panel mostró "Invalid parameter". Nada más — ni qué estaba mal, ni qué
 * hacer. Reproducido contra Meta: el archivo era WebP y Meta solo acepta JPG y
 * PNG en encabezados de plantilla (error subcode 2388084, "File Type Not
 * Supported"). Los logos modernos suelen venir justo en WebP.
 *
 * Se valida en el NAVEGADOR además del backend: el archivo puede pesar megas
 * y subirlo para que lo rechacen es hacer esperar por una respuesta que ya
 * sabíamos.
 */

/** Lo que Meta acepta en un encabezado de plantilla. Nada de WebP, GIF ni SVG. */
const EXTENSIONES = /\.(jpe?g|png)$/i;

export function formatoEncabezadoOk(nombreArchivo: string): boolean {
  return EXTENSIONES.test(nombreArchivo);
}

/**
 * El `accept` del input. Explícito y NO `image/*`: con el comodín el dueño
 * podía elegir un WebP y recién enterarse al fallar la subida.
 */
export const ACEPTA_ENCABEZADO = "image/jpeg,image/png";

/** Dice qué usar, no solo que está mal. */
export const MENSAJE_FORMATO =
  "Esa imagen no sirve para el encabezado. WhatsApp solo acepta JPG o PNG.";

/** El pie que se muestra siempre, para que el formato se sepa ANTES de elegir. */
export const AYUDA_FORMATO = "Solo JPG o PNG · hasta 5 MB";
