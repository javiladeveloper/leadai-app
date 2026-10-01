/**
 * EL LINK DE UNA PUBLICACIÓN (2026-10-01, Jonathan: "deberíamos poder agregar
 * links, actualmente no deja"). Vacío = sin link. "www.algo.com" o
 * "algo.com/promo" se completan con https://; lo que no es una URL http(s)
 * vuelve con un error para el dueño, antes de llegar a ninguna red.
 */
export function normalizarLink(entrada: string): { link?: string; error?: string } {
  const t = entrada.trim();
  if (!t) return {};
  const conEsquema = /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(conEsquema);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) throw new Error();
    return { link: u.toString() };
  } catch {
    return { error: "Ese link no se ve bien. Ejemplo: https://tu-web.com/promo" };
  }
}

