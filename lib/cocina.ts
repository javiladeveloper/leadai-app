// LA COCINA EN LA WEB (2026-08-19).
//
// Hasta hoy la cocina —ver los pedidos y despacharlos— SOLO existía en la app
// móvil. Un dueño con la computadora en el mostrador tenía que agarrar el
// celular para marcar un pedido como listo, con las manos ocupadas.
//
// La máquina de estados es la MISMA del backend y de la app. No se reinventa
// acá: si los dos clientes discreparan, uno de los dos mandaría un estado que
// el backend rechaza y el dueño vería un error sin entender por qué.

import { api } from "./api";

/**
 * Lo que quedó registrado de la captura de pago (2026-08-21).
 *
 * `capturaUrl` puede venir null: si Storage estaba caído cuando llegó la
 * imagen, igual se guardó lo que el modelo leyó y qué se decidió — perder el
 * registro entero por no poder guardar una foto sería peor.
 *
 * Todo opcional: un backend viejo no manda `validaciones` y la Cocina tiene
 * que seguir andando igual.
 */
export interface ValidacionPago {
  id: string;
  capturaUrl: string | null;
  montoCentavos: number | null;
  nroOperacion: string | null;
  metodo: string | null;
  /** validado | rechazado | ilegible */
  resultado: string;
  /** monto | receptor | fecha | sin_operacion | metodo */
  motivo: string | null;
  /** 'ia' o 'humano' */
  decidioPor: string;
  revisadoPor: string | null;
  revisadoEn: string | null;
  revisionOk: boolean | null;
  creadoEn: string;
}

export interface PedidoCocina {
  id: string;
  estado: string;
  modalidad: string;
  totalCentavos: number;
  creadoEn: string;
  direccion: string | null;
  /** "Casa del fondo", "portón verde": lo que el pin no dice (2026-08-20). */
  referencia?: string | null;
  notas: string | null;
  items: { nombre: string; cantidad: number; precioCentavos?: number; subtotalCentavos?: number }[] | null;
  etaMinutos: number | null;
  /** La última validación de pago. El backend manda solo una. */
  validaciones?: ValidacionPago[];
  /** pendiente | por_confirmar | validado | rechazado */
  pago?: string | null;
  pagoMetodo?: string | null;
}

/** La validación que decidió el estado actual del pedido, si hay alguna. */
export function validacionDe(p: PedidoCocina): ValidacionPago | null {
  return p.validaciones?.[0] ?? null;
}

/**
 * Cómo se lee un motivo de rechazo, en palabras del dueño.
 *
 * Los códigos del backend son para el log; acá tiene que decir qué mirar en
 * la captura. "receptor" no le dice nada a nadie a las ocho de la noche.
 */
export function motivoLegible(motivo: string | null): string {
  switch (motivo) {
    case 'monto': return 'El monto no coincide con el pedido';
    case 'receptor': return 'El número o el nombre no son los tuyos';
    case 'fecha': return 'La fecha no es de hoy';
    case 'sin_operacion': return 'No se ve el número de operación';
    case 'metodo': return 'Pagó por una billetera que no aceptás';
    default: return 'No se pudo validar';
  }
}

/**
 * Las columnas de la cocina, en el orden en que avanza un pedido.
 *
 * `pagado` va primero: es lo que ENTRÓ y nadie tocó todavía, y es donde el
 * dueño mira cuando suena el teléfono.
 */
export const COLUMNAS = [
  // `vacia`: qué dice la columna cuando no tiene nada. Cuatro "Nada acá"
  // iguales no informan; cada columna vacía significa una cosa distinta.
  { estado: "pagado", titulo: "Por preparar", emoji: "🧾", vacia: "Sin pedidos nuevos" },
  { estado: "preparando", titulo: "En cocina", emoji: "🍳", vacia: "Nada en el fuego" },
  { estado: "listo", titulo: "Listos", emoji: "🛎️", vacia: "Nada esperando salir" },
  { estado: "en_camino", titulo: "En camino", emoji: "🛵", vacia: "Sin entregas en curso" },
] as const;

/**
 * A qué estado pasa este pedido, y qué dice el botón.
 *
 * Espejo de `EstadoPedido.kt` en la app. `listo` bifurca por modalidad: un
 * delivery sale con el motorizado, uno de recojo lo retira el cliente — y
 * mandarle "Ya salió 🛵" a quien viene a buscar su comida no tiene sentido.
 */
export function siguientePaso(p: PedidoCocina): { estado: string; etiqueta: string } | null {
  switch (p.estado) {
    case "pagado":
      return { estado: "preparando", etiqueta: "Empezar a preparar" };
    case "preparando":
      return { estado: "listo", etiqueta: "Marcar listo" };
    case "listo":
      return p.modalidad === "delivery"
        ? { estado: "en_camino", etiqueta: "Ya salió 🛵" }
        : { estado: "entregado", etiqueta: "Entregado ✓" };
    case "en_camino":
      return { estado: "entregado", etiqueta: "Entregado ✓" };
    default:
      return null;
  }
}

/** Cuántos minutos lleva esperando. Es el dato que decide a qué se atiende. */
export function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

/**
 * ¿Este pedido lleva demasiado tiempo?
 *
 * 25 minutos sin salir de la cocina. No es el ETA prometido: es el punto donde
 * un pedido dejó de ser "en curso" y pasó a ser "se nos está pasando".
 */
export function esUrgente(p: PedidoCocina): boolean {
  return p.estado !== "en_camino" && minutosDesde(p.creadoEn) >= 25;
}

/** Recién entrado: la tarjeta destella una vez para que no pase de largo. */
export const MINUTOS_RECIEN_LLEGADO = 3;

export function esRecienLlegado(p: PedidoCocina): boolean {
  return p.estado === "pagado" && minutosDesde(p.creadoEn) <= MINUTOS_RECIEN_LLEGADO;
}

/**
 * EL SEMÁFORO DE ESPERA (2026-08-21).
 *
 * Antes solo había dos estados: normal, y urgente a los 25 minutos. El salto
 * era de golpe — un pedido de 24 minutos se veía igual que uno de 2, y al
 * minuto siguiente gritaba. Con un escalón intermedio el dueño ve venir el
 * problema antes de tenerlo encima.
 *
 * `en_camino` nunca marca: ya salió, los minutos ahí son del motorizado y no
 * hay nada que la cocina pueda hacer.
 */
export type NivelEspera = "fresco" | "atencion" | "urgente";

export function nivelEspera(p: PedidoCocina): NivelEspera {
  if (p.estado === "en_camino") return "fresco";
  const m = minutosDesde(p.creadoEn);
  if (m >= 25) return "urgente";
  if (m >= 15) return "atencion";
  return "fresco";
}

/**
 * Los minutos, escritos como los diría una persona.
 *
 * A los 707 minutos (un pedido real que quedó colgado 11 horas) "707′" no se
 * lee: hay que dividir mentalmente. Pasada la hora se muestra "11 h 47".
 */
export function esperaLegible(minutos: number): string {
  if (minutos < 60) return `${minutos}′`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  // Los minutos con cero adelante: "12 h 2" se lee ambiguo, "12 h 02" no.
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export async function listarPedidos(): Promise<PedidoCocina[]> {
  try {
    const r = await api<{ items: PedidoCocina[] }>("/pedidos");
    return r.items ?? [];
  } catch {
    // Una cocina que se queda en blanco por un error de red es peor que una
    // que muestra lo último que sabía: quien llama lo hace en un intervalo.
    return [];
  }
}

export async function avanzarPedido(id: string, estado: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/pedidos/${id}/estado`, { method: "PATCH", body: { estado } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar" };
  }
}
