/**
 * LOS TELÉFONOS DE UN ARCHIVO, ANTES DE MANDARLOS (2026-09-22).
 *
 * LO QUE PASÓ: Jonathan subió su CSV de clínicas y el panel dijo "No pudimos
 * conectar con el servidor". El archivo viene de Google Places: trae nombre,
 * dirección, coordenadas, IDs y el celular. La extracción anterior tomaba
 * CUALQUIER celda con seis dígitos —"-12.0464, -77.0428", el place id, la
 * dirección con numeración— y mandaba todo eso en un solo POST de varios
 * megas. El backend corta en 2 MB y, con un cuerpo enorme a medio subir, el
 * navegador ve la conexión cortada en vez de un error legible.
 *
 * Ahora se queda solo con lo que PARECE un teléfono, se deduplica acá mismo
 * y viaja una lista corta de dígitos: una fila = un contacto, no una fila =
 * seis celdas. El backend vuelve a normalizar y hashear; esto no reemplaza
 * esa validación, la alivia.
 */

/** Cuántos dígitos tiene un teléfono peruano escrito de cualquier forma: 8 (fijo) a 13 (0051 + 9). */
const MIN_DIGITOS = 8;
const MAX_DIGITOS = 13;

/** Tope del backend (`TELEFONOS` en routes/anuncios.ts). */
export const MAX_TELEFONOS = 50_000;

function pareceTelefono(celda: string): string | null {
  const limpio = celda.trim();
  if (!limpio) return null;
  // Un decimal con punto ("-12.0464") es una coordenada o un importe; un
  // teléfono no lleva punto entre dígitos.
  if (/\d\.\d/.test(limpio)) return null;
  const digitos = limpio.replace(/\D/g, "");
  if (digitos.length < MIN_DIGITOS || digitos.length > MAX_DIGITOS) return null;
  // Si la celda es mucho más que dígitos, separadores y un "+", es una
  // dirección o un id ("Av. Larco 1234 Miraflores", "0x9105c8:0x1234").
  const ruido = limpio.replace(/[\d\s+\-().]/g, "");
  if (ruido.length > 2) return null;
  return digitos;
}

/**
 * De un CSV/TXT, los teléfonos únicos como dígitos. Se toma cualquier columna:
 * un archivo exportado de otra herramienta rara vez tiene la columna donde
 * uno espera, y pedirle al dueño que la acomode es pedirle que edite un CSV.
 */
export function extraerTelefonos(texto: string): string[] {
  const vistos = new Set<string>();
  for (const linea of texto.split(/\r?\n/)) {
    for (const celda of linea.split(/[,;\t|]/)) {
      const d = pareceTelefono(celda.replace(/^"|"$/g, ""));
      if (d) vistos.add(d);
      if (vistos.size >= MAX_TELEFONOS) return [...vistos];
    }
  }
  return [...vistos];
}
