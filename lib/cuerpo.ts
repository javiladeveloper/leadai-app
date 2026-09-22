/**
 * EL CUERPO DE UNA LLAMADA, SERIALIZADO UNA SOLA VEZ (2026-09-22).
 *
 * Siete funciones de `lib/api.ts` pasaban `body: JSON.stringify({...})` y
 * `api()` lo serializaba otra vez: al backend le llegaba un string JSON y zod
 * contestaba "Expected object, received string". Los públicos de Meta, el
 * retargeting y prender/apagar anuncios nunca habían funcionado desde el
 * panel. Vive aparte, sin imports, para poder probarlo con `node --test`
 * (que no resuelve los imports sin extensión de `api.ts`).
 */
export function cuerpoParaFetch(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return typeof body === "string" ? body : JSON.stringify(body);
}
