// EL HORARIO DEL RESTAURANTE (2026-08-19).
//
// Hasta acá esto SOLO se editaba desde la app móvil, así que un dueño sentado
// en su computadora no podía cerrar su cocina ni cambiar su horario — tenía
// que buscar el celular. Y los días de cierre no existían en ninguna parte:
// un local que descansa los lunes igual recibía pedidos, y alguien los
// cancelaba a mano.

import { api } from "./api";

export interface ConfigHorario {
  cocinaAbierta: boolean;
  /** Hora entera 0–23. `null` = sin horario fijo, atiende siempre. */
  horaAbre: number | null;
  horaCierra: number | null;
  /** Días que cierra: 0 = domingo, igual que `Date.getDay()`. */
  diasCerrado: number[];
  /**
   * Pedido mínimo para DELIVERY, en céntimos. 0 = sin mínimo.
   *
   * Solo delivery: quien pasa a recoger no le cuesta un viaje al local.
   */
  minimoDeliveryCentavos: number;
}

/** Los días como los ve el dueño, en el orden de la semana peruana. */
export const DIAS_SEMANA = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mié" },
  { n: 4, label: "Jue" },
  { n: 5, label: "Vie" },
  { n: 6, label: "Sáb" },
  { n: 0, label: "Dom" },
];

export async function obtenerHorario(tenant?: string): Promise<ConfigHorario | null> {
  try {
    const r = await api<{ config: ConfigHorario | null }>("/pedidos-config", { tenant });
    if (!r.config) return null;
    return {
      cocinaAbierta: r.config.cocinaAbierta ?? true,
      horaAbre: r.config.horaAbre ?? null,
      horaCierra: r.config.horaCierra ?? null,
      // `?? []`: un backend viejo no manda el campo, y sin esto el editor
      // pintaría "cerrado todos los días" sobre un negocio que abre siempre.
      diasCerrado: r.config.diasCerrado ?? [],
      minimoDeliveryCentavos: r.config.minimoDeliveryCentavos ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Guarda SOLO lo que cambió.
 *
 * El PATCH es parcial a propósito (ver `configSchema` en el backend): una
 * clave ausente significa "no tocar". Mandar el objeto entero pisaría campos
 * que esta pantalla ni edita —Yape, capacidad, motorizados— con lo que hubiera
 * leído hace un rato.
 */
export async function guardarHorario(
  cambios: Partial<ConfigHorario>,
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/pedidos-config", { method: "PATCH", body: cambios, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

/** "Lun a Sáb · 17:00–23:00" — el resumen para la tarjeta. */
export function resumenHorario(c: ConfigHorario): string {
  const partes: string[] = [];

  if (c.diasCerrado.length === 0) partes.push("Todos los días");
  else if (c.diasCerrado.length >= 7) partes.push("Cerrado toda la semana");
  else {
    const abiertos = DIAS_SEMANA.filter((d) => !c.diasCerrado.includes(d.n));
    partes.push(abiertos.map((d) => d.label).join(", "));
  }

  partes.push(
    c.horaAbre != null && c.horaCierra != null
      ? `${String(c.horaAbre).padStart(2, "0")}:00–${String(c.horaCierra).padStart(2, "0")}:00`
      : "sin horario fijo",
  );

  return partes.join(" · ");
}
