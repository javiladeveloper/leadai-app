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

  // ── Cómo le pagan (2026-08-19) ──────────────────────────────────────
  //
  // Esto SOLO se editaba desde la app móvil, así que un dueño en su
  // computadora no podía cargar su Yape. Y sin número el bot no tiene a
  // dónde mandar al cliente: el pedido llega hasta el pago y muere ahí.

  /** A qué número le yapean/plinean. Vacío = el bot pide coordinar por chat. */
  yapeNumero: string;
  /** El titular de esa cuenta, para que el cliente sepa a quién le paga. */
  yapeNombre: string;
  aceptaYape: boolean;
  aceptaPlin: boolean;
  /** ¿Cobra en efectivo al entregar? Enciende el botón 💵 del chat (2026-08-22). */
  aceptaEfectivo: boolean;

  // ── Presencia en Google (2026-08-27) ────────────────────────────────
  /** Identidad del local en Google. Vacío = no lo conectó. */
  googlePlaceId: string;
  /**
   * Link DIRECTO a dejar reseña. Vacío = el bot no la pide.
   *
   * Se lo manda solo a quien calificó con 4 o 5 estrellas: llevar a Google a
   * un cliente enojado es regalarle una reseña mala al negocio, y eso queda
   * público para siempre.
   */
  googleReviewUrl: string;
  /** Píxel de Meta: solo el número. Vacío = la carta no lo carga. */
  metaPixelId: string;
  /** GA4: "G-XXXXXXX". */
  googleAnalyticsId: string;
  // Para el diagnóstico de presencia: qué tiene ya y qué le falta.
  direccion?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  /** El link corto de su carta. Sin esto no tiene qué promocionar. */
  slug?: string | null;

  // ── Cuánto puede la cocina ──────────────────────────────────────────
  //
  // Alimentan el tiempo de espera que ve el cliente ("listo en 35-50 min").

  /** Pedidos que la cocina saca a la vez. */
  capacidadSimultanea: number;
  /** Cuánto tarda cada pedido. */
  minutosPorPedido: number;
  /** ¿Toma reservas de mesa? Local físico vs solo delivery. */
  aceptaReservas: boolean;
  /** ¿Tiene local físico? Sin local no hay mesas que reservar (2026-08-20). */
  tieneLocal: boolean;
  /**
   * Las mesas del local (2026-08-21): [{ sala, mesas: [] }].
   *
   * Vacío = solo mostrador. El pedido en local se puede tomar igual; lo que
   * no aparece es el selector de mesa, que sin mesas cargadas solo confunde.
   */
  salas: { sala: string; mesas: string[] }[];
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
      // `?? ''`: un backend viejo no los manda. Vacío = sin conectar, que es
      // el estado correcto — el bot no pide reseña sin link a dónde mandarla.
      googlePlaceId: r.config.googlePlaceId ?? "",
      googleReviewUrl: r.config.googleReviewUrl ?? "",
      metaPixelId: r.config.metaPixelId ?? "",
      googleAnalyticsId: r.config.googleAnalyticsId ?? "",
      direccion: r.config.direccion ?? null,
      instagramUrl: r.config.instagramUrl ?? null,
      facebookUrl: r.config.facebookUrl ?? null,
      slug: r.config.slug ?? null,
      yapeNumero: r.config.yapeNumero ?? "",
      yapeNombre: r.config.yapeNombre ?? "",
      // `?? true`: es lo que el backend devuelve para los negocios ya
      // existentes, y apagarlos por un campo ausente les cortaría el cobro.
      aceptaYape: r.config.aceptaYape ?? true,
      aceptaPlin: r.config.aceptaPlin ?? true,
      // `?? false`: cobrar en la puerta es una decisión del dueño, no un default.
      aceptaEfectivo: r.config.aceptaEfectivo ?? false,
      capacidadSimultanea: r.config.capacidadSimultanea ?? 3,
      minutosPorPedido: r.config.minutosPorPedido ?? 20,
      aceptaReservas: r.config.aceptaReservas ?? true,
      tieneLocal: r.config.tieneLocal ?? true,
      // Un backend viejo no manda `salas`: se cae a vacío, que es "solo
      // mostrador" — el estado correcto para quien nunca las configuró.
      salas: r.config.salas ?? [],
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

/**
 * CÓMO TRABAJA EL NEGOCIO (2026-08-25).
 *
 * Local o solo delivery, si toma reservas, a dónde le pagan y si cobra antes
 * o al entregar. Son las decisiones que definen qué puede hacer el bot, y
 * hasta hoy el alta no preguntaba ninguna: quedaban escondidas en Ajustes y
 * el dueño se enteraba cuando un cliente no podía pagarle.
 */
export interface FormaDeTrabajo {
  tieneLocal: boolean;
  aceptaReservas: boolean;
  yapeNumero: string;
  yapeNombre: string;
  aceptaYape: boolean;
  aceptaPlin: boolean;
  /** Cobra al entregar, además de (o en vez de) por adelantado. */
  aceptaEfectivo: boolean;
  /**
   * Desde y hasta qué hora atiende la cocina (2026-08-31).
   *
   * Faltaban acá, y el alta los preguntaba sin poder guardarlos:
   * `/carta/negocio` no acepta esos campos —viven en `/pedidos-config`, que es
   * esta ruta— así que el dueño terminaba el onboarding con un "Horario ✓" y
   * la base en NULL. El bot le tomaba pedidos a las 4 de la mañana.
   */
  horaAbre: number;
  horaCierra: number;
}

export async function guardarFormaDeTrabajo(
  cambios: Partial<FormaDeTrabajo>,
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/pedidos-config", { method: "PATCH", body: cambios, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}
