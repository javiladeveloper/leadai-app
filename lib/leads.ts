// Capa de datos de la app. Hoy devuelve los datos de demostración; cuando el
// backend exponga los endpoints de lectura para la app (GET /leads, etc.), acá
// se cambia por llamadas a `api()`. La UI consume solo estas funciones.

import { CONVERSACIONES, EMPRESAS, LEADS, REPORTE } from "./demo";
import type { Conversacion, EmpresaConfig, Lead, Reporte } from "./tipos";

export function listarLeads(): Lead[] {
  return LEADS;
}

export function contarCalientesSinAtender(): number {
  return LEADS.filter((l) => l.temperatura === "caliente" && l.estado === "sin_atender").length;
}

export function obtenerConversacion(id: string): Conversacion | null {
  return CONVERSACIONES[id] ?? null;
}

export function listarEmpresas(): EmpresaConfig[] {
  return EMPRESAS;
}

export function obtenerReporte(): Reporte {
  return REPORTE;
}

// "hace X" legible en español, a partir de minutos.
export function haceTexto(min: number): string {
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}
