// Precio de una recarga de hits, para MOSTRAR en vivo mientras el usuario
// elige cuántos comprar. Misma lógica que el backend (core/catalogo.ts), pero
// el precio real SIEMPRE lo calcula y valida el backend al procesar el pago
// (ver /recargas) — esto es solo para la UI.

export interface TramoRecarga {
  hastaHits: number;
  centavosPorHit: number;
}

export function precioRecargaCentavos(hits: number, tramos: TramoRecarga[]): number {
  const tramo = tramos.find((t) => hits < t.hastaHits) ?? tramos[tramos.length - 1];
  return Math.round(hits * (tramo?.centavosPorHit ?? 0));
}

export const soles = (centavos: number): string => `S/${(centavos / 100).toFixed(2)}`;
