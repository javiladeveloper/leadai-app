// LAS ETAPAS DEL EMBUDO, PURAS (2026-10-09, tanda "consistencia").
//
// Vivían dentro de lib/api.ts. Salen acá para que las prueben los tests de
// node y para que Seguimiento y Conversaciones usen EXACTAMENTE la misma regla
// para decidir en qué columna cae cada lead (antes Seguimiento usaba cinco
// estados fijos y Conversaciones las etapas del negocio: el mismo lead podía
// estar en "Agendó demo" en un lado y en "Para atender" en el otro).

// Etapas PERSONALIZADAS del embudo (capa CRM visible; el motor no cambia).
export interface EtapaEmbudo {
  id: string;
  nombre: string;
  color: "brasa" | "tibio" | "calor" | "ok" | "frio";
  motor: "nuevo" | "nutriendo" | "escalado" | "ganado" | "perdido";
}

/** Los estados del motor que CIERRAN un lead: no se trabajan más. */
export const MOTORES_CERRADOS = new Set<EtapaEmbudo["motor"]>(["ganado", "perdido"]);

/**
 * "PARA ATENDER" ES EL NOMBRE DE `escalado` EN TODA LA WEB (2026-10-09). Leads,
 * Inicio y Seguimiento decían "Para atender"; el embudo por defecto del
 * backend decía "Escalados" y el reporte de marketing "Pasado al equipo": tres
 * nombres para el mismo lead que espera a una persona.
 */
export const NOMBRE_ESCALADO = "Para atender";

export const ETAPAS_DEFAULT: EtapaEmbudo[] = [
  { id: "nuevo", nombre: "Nuevos", color: "brasa", motor: "nuevo" },
  { id: "nutriendo", nombre: "En seguimiento", color: "tibio", motor: "nutriendo" },
  { id: "escalado", nombre: NOMBRE_ESCALADO, color: "calor", motor: "escalado" },
  { id: "ganado", nombre: "Ganados", color: "ok", motor: "ganado" },
  { id: "perdido", nombre: "Perdidos", color: "frio", motor: "perdido" },
];

/**
 * LOS NOMBRES POR DEFECTO DEL BACKEND, EN EL IDIOMA DE LA WEB (2026-10-09).
 *
 * Solo se tocan los nombres que el negocio NO cambió (los que vienen tal cual
 * del default del backend). Lo que el dueño escribió a mano se respeta.
 *
 *  · "Escalados" → "Para atender" (ver `NOMBRE_ESCALADO`).
 *  · "Ganados (pagó)" → "Ganados". "Ganado" y "Pagó" son DOS cosas en la web
 *    (ver components/panel/CierreLead.tsx): el bot marca ganado cuando el
 *    cliente agenda, y la venta real se marca aparte con "Pagó". Una columna
 *    que dice "(pagó)" llena de gente que solo agendó es justo la confusión
 *    que se quería evitar.
 */
const RENOMBRES_DEFAULT: Record<string, { de: string; a: string }> = {
  escalado: { de: "Escalados", a: NOMBRE_ESCALADO },
  ganado: { de: "Ganados (pagó)", a: "Ganados" },
};

export function normalizarEtapas(etapas: EtapaEmbudo[]): EtapaEmbudo[] {
  return etapas.map((e) => {
    const r = RENOMBRES_DEFAULT[e.id];
    return r && e.nombre === r.de ? { ...e, nombre: r.a } : e;
  });
}

/**
 * Etapa visible de un lead: su etapa propia (si existe) o la del motor.
 *
 * LA ETAPA PROPIA SOLO VALE SI COINCIDE CON EL MOTOR (2026-10-09). El bot y
 * las acciones de cierre ("Ganado", "Descartar") cambian el ESTADO del lead
 * sin tocar su etapa propia: alguien en "Demo hecha" que se marcó ganado
 * seguía en la columna "Demo hecha". Si la etapa guardada ya no corresponde
 * al estado, manda el estado.
 */
export function etapaVisibleDe(
  lead: { etapaEmbudo?: string | null; estado: string },
  etapas: EtapaEmbudo[],
): EtapaEmbudo {
  const porId = lead.etapaEmbudo ? etapas.find((e) => e.id === lead.etapaEmbudo) : undefined;
  if (porId && porId.motor === lead.estado) return porId;
  return etapas.find((e) => e.motor === lead.estado) ?? porId ?? etapas[0];
}

/** Clase del punto de color de cada etapa (tokens curados del design system). */
export const PUNTO_ETAPA: Record<EtapaEmbudo["color"], string> = {
  brasa: "bg-brasa",
  tibio: "bg-tibio",
  calor: "bg-calor",
  ok: "bg-ok",
  frio: "bg-frio",
};
