/**
 * QUÉ REDES CUENTAN PARA LOS COMENTARIOS (2026-09-18).
 *
 * La página de Comentarios abría con un aviso fijo de "conecta tus redes"
 * aunque el negocio ya las tuviera conectadas (Jonathan lo vio en Sania con
 * Instagram y Facebook activos). Los comentarios llegan solo por Instagram y
 * por la página de Facebook: WhatsApp y TikTok no entran acá.
 */
export interface CanalMinimo {
  tipo: string;
  activo: boolean;
}

const NOMBRE: Record<string, string> = { instagram: "Instagram", messenger: "Facebook" };
const ORDEN = ["Instagram", "Facebook"];

/** Las redes de comentarios conectadas y activas, en orden fijo. */
export function redesDeComentarios(canales: CanalMinimo[]): string[] {
  const vistas = new Set<string>();
  for (const c of canales) {
    const nombre = NOMBRE[c.tipo];
    if (c.activo && nombre) vistas.add(nombre);
  }
  return ORDEN.filter((n) => vistas.has(n));
}

/** "Instagram y Facebook", "Instagram", o vacío. */
export function textoRedes(redes: string[]): string {
  return redes.join(" y ");
}
