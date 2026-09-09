/**
 * LOS ERRORES AL CREAR UNA PLANTILLA, EN CASTELLANO (2026-09-09).
 *
 * Hermano de `errores-meta.ts` (que traduce los de la conexión), con el mismo
 * criterio: decir QUÉ PASÓ y QUÉ HACER, nunca dejar el texto de Meta crudo.
 *
 * EL CASO REAL: Jonathan tocó "Enviar a revisión de Meta", el botón no cambió
 * en varios segundos, creyó que se había colgado y tocó de nuevo. La primera
 * petición SÍ había funcionado, así que la segunda chocó y Meta respondió
 * "Content in This Language Already Exists: There is already Spanish content
 * for this template". Leyendo eso no se entiende ni que su plantilla ya está
 * creada ni qué hacer — parece que falló todo.
 *
 * Lo que NO se sabe traducir se devuelve tal cual: un mensaje raro en inglés
 * es peor que uno claro, pero mucho mejor que el silencio.
 */

const TRADUCCIONES: { patron: RegExp; texto: string }[] = [
  {
    // La plantilla ya existe con ese nombre en ese idioma.
    patron: /already exists|already .* content for this template/i,
    texto:
      "Ya tienes una plantilla con ese nombre. Si acabas de enviarla, búscala en la lista de abajo: " +
      "seguramente ya está en revisión. Para crear otra distinta, ponle un nombre diferente.",
  },
  {
    // El archivo del encabezado no es JPG ni PNG.
    patron: /file type not supported|type of file is not supported/i,
    texto: "Esa imagen no sirve para el encabezado. WhatsApp solo acepta JPG o PNG.",
  },
  {
    // El nombre no cumple el formato de Meta.
    patron: /invalid.*name|name.*invalid/i,
    texto: "Ese nombre no le sirve a Meta. Usa solo letras, números y espacios (los convertimos a guiones bajos).",
  },
  {
    // Falta el ejemplo de alguna variable del cuerpo.
    patron: /example|sample/i,
    texto:
      "Meta necesita un ejemplo para cada variable del mensaje. Revisa que las variables sean {{1}}, {{2}}… en orden.",
  },
];

/** Traduce el error de Meta a algo accionable. Sin coincidencia, lo devuelve tal cual. */
export function traducirErrorPlantilla(error: string): string {
  const crudo = (error ?? "").trim();
  if (!crudo) return "No se pudo crear la plantilla. Intenta de nuevo.";
  for (const { patron, texto } of TRADUCCIONES) {
    if (patron.test(crudo)) return texto;
  }
  return crudo;
}
