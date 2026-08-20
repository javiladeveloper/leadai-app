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
}

/**
 * Las columnas de la cocina, en el orden en que avanza un pedido.
 *
 * `pagado` va primero: es lo que ENTRÓ y nadie tocó todavía, y es donde el
 * dueño mira cuando suena el teléfono.
 */
export const COLUMNAS = [
  { estado: "pagado", titulo: "Por preparar", emoji: "🧾" },
  { estado: "preparando", titulo: "En cocina", emoji: "🍳" },
  { estado: "listo", titulo: "Listos", emoji: "🛎️" },
  { estado: "en_camino", titulo: "En camino", emoji: "🛵" },
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
