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

export interface ComentarioConEstado {
  id: string;
  creadoEn: string;
  respondido: boolean;
  dmAbierto: boolean;
  estadoPublico?: string;
  estadoPrivado?: string;
  errorPublico?: string | null;
  errorPrivado?: string | null;
  esPrueba?: boolean;
}

/** El refresco de la primera página no borra las páginas antiguas. */
export function fusionarComentarios<T extends { id: string; creadoEn: string }>(actuales: T[], recientes: T[]): T[] {
  const porId = new Map(actuales.map((c) => [c.id, c]));
  for (const c of recientes) porId.set(c.id, c);
  return [...porId.values()].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id.localeCompare(a.id));
}

export function describirEnvio(c: ComentarioConEstado): { publico: string; privado: string; requiereRevision: boolean } {
  if (c.esPrueba) return { publico: "Vista previa", privado: "Vista previa", requiereRevision: false };
  const describir = (estado: string | undefined, legado: boolean) => {
    const e = estado ?? (legado ? "enviado" : "omitido");
    return ({ enviado: "Enviado", fallido: "Falló", incierto: "Revisar en Meta", enviando: "Enviando", pendiente: "Pendiente", omitido: "No enviado" } as Record<string, string>)[e] ?? "No enviado";
  };
  return {
    publico: describir(c.estadoPublico, c.respondido),
    privado: describir(c.estadoPrivado, c.dmAbierto),
    requiereRevision: c.estadoPublico === "incierto" || c.estadoPrivado === "incierto",
  };
}
