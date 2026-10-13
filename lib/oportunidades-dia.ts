// CRM FASE 3 (2026-10-13): LAS OPORTUNIDADES DEL DÍA, EN UN TOQUE.
//
// El servidor (`/hoy.oportunidades`) encuentra a los clientes que se están
// por perder: el que no llegó a la reunión, el caliente que dejó de escribir,
// la ventana de 24 h de WhatsApp que se cierra, lo que se le prometió y no se
// le mandó… Cada una trae UNA acción; esto decide a dónde lleva el botón y
// con qué palabras, para que la vendedora no tenga que pensar qué hacer.
//
// Helpers PUROS (sin React): los prueban los tests de node.

import type { Hoy, OportunidadDia } from "./api";
import { telefonoDe, urlAgenda, urlLead } from "./enlaces";

export type TipoOportunidad = OportunidadDia["tipo"];

/** AAAA-MM-DD en Lima (UTC-5, sin horario de verano): el día en que la Agenda abre la cita. */
function diaEnLima(iso: string): string {
  return new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

/** Los tipos que el servidor conoce: el único `motivo` que acepta para sugerir un mensaje. */
export const TIPOS_OPORTUNIDAD: TipoOportunidad[] = [
  "no_show", "caliente_callado", "ventana_24h", "promesa", "precio_sin_respuesta", "reunion_sin_resultado", "registrado",
];

export function esTipoOportunidad(v: string | null | undefined): v is TipoOportunidad {
  return !!v && (TIPOS_OPORTUNIDAD as string[]).includes(v);
}

const ICONOS: Record<TipoOportunidad, string> = {
  no_show: "⏰",
  reunion_sin_resultado: "📝",
  caliente_callado: "🔥",
  ventana_24h: "⏳",
  promesa: "🤝",
  precio_sin_respuesta: "💲",
  registrado: "🆕",
};

/** El ícono de cada tipo (uno que el servidor sume después no rompe: "💡"). */
export function iconoOportunidad(tipo: string): string {
  return esTipoOportunidad(tipo) ? ICONOS[tipo] : "💡";
}

export type AccionOportunidad =
  /** Abre la ficha con el compositor y un mensaje sugerido para ESTE motivo. */
  | { tipo: "whatsapp"; texto: string; href: string }
  | { tipo: "llamar"; texto: string; href: string }
  /** Abre el "Agendar reunión" de siempre, con el cliente ya elegido. */
  | { tipo: "agendar"; texto: string }
  /** La Agenda en esa cita, para anotar cómo le fue. */
  | { tipo: "resultado"; texto: string; href: string }
  /** Lo que no se puede hacer directo (llamar sin número): la ficha. */
  | { tipo: "ficha"; texto: string; href: string };

/**
 * La acción de un toque de una oportunidad.
 *  · whatsapp  → la ficha con el compositor y el mensaje sugerido (`sugerir`);
 *  · llamar    → `tel:` (sin número, la ficha);
 *  · agendar   → el modal de agendar;
 *  · resultado → la Agenda en esa cita (sin cita, la ficha).
 */
export function accionDeOportunidad(o: Pick<OportunidadDia, "tipo" | "accion" | "leadId" | "tenantId" | "telefono" | "citaId" | "citaInicio">): AccionOportunidad {
  const ficha = urlLead(o.leadId, { tenant: o.tenantId });
  switch (o.accion) {
    case "whatsapp":
      return {
        tipo: "whatsapp",
        texto: "Escribirle",
        href: urlLead(o.leadId, { tenant: o.tenantId, sugerir: esTipoOportunidad(o.tipo) ? o.tipo : null }),
      };
    case "llamar": {
      const tel = telefonoDe("whatsapp", o.telefono);
      return tel ? { tipo: "llamar", texto: "Llamar", href: `tel:+${tel}` } : { tipo: "ficha", texto: "Abrir ficha", href: ficha };
    }
    case "agendar":
      return { tipo: "agendar", texto: "Agendar" };
    case "resultado":
      return o.citaId
        ? { tipo: "resultado", texto: "Anotar cómo le fue", href: urlAgenda({ cita: o.citaId, ...(o.citaInicio ? { fecha: diaEnLima(o.citaInicio), vista: "dia" as const } : {}) }) }
        : { tipo: "ficha", texto: "Abrir ficha", href: ficha };
    default:
      return { tipo: "ficha", texto: "Abrir ficha", href: ficha };
  }
}

/**
 * "se cierra en 5 h" / "se cierra en 40 min" (la ventana de 24 h de
 * WhatsApp). `null` si no hay fecha o ya se cerró: entonces ya no es una
 * urgencia de esta ventana.
 */
export function cierraEn(venceEn: string | null | undefined, ahora: Date = new Date()): string | null {
  if (!venceEn) return null;
  const falta = new Date(venceEn).getTime() - ahora.getTime();
  if (Number.isNaN(falta) || falta <= 0) return null;
  const min = Math.floor(falta / 60_000);
  if (min < 60) return `se cierra en ${Math.max(1, min)} min`;
  return `se cierra en ${Math.floor(min / 60)} h`;
}

/** "Hoy" sin esa oportunidad (descartada o ya atendida): se ve al instante. */
export function sinOportunidad(hoy: Hoy, id: string): Hoy {
  return { ...hoy, oportunidades: hoy.oportunidades.filter((o) => o.id !== id) };
}
