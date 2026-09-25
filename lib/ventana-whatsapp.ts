/**
 * LA VENTANA DE WHATSAPP DE CADA CHAT (2026-09-25).
 *
 * Caso Edith: se le mandó un saludo y dos videos y nada llegó. WhatsApp solo
 * entrega mensajes normales dentro de las 24 h desde el último mensaje del
 * cliente.
 *
 * EL ANUNCIO NO LA ALARGA (2026-09-25). Primero se mostraban 72 h para quien
 * llegó por un anuncio, y el chip de Edith decía "quedan 1 h" cuando lo que se
 * le mandó ya no le llegaba. Las 72 h de Meta son para que los mensajes salgan
 * sin costo, no para texto libre: la ventana es de 24 h para todos. De dónde
 * vino se sigue mostrando porque sirve para saber cómo llegó.
 *
 * Jonathan: "necesito ver en cada chat cuál es su ventana de tiempo… hay
 * algunos que nos escriben directamente, otros llegan por publicidad". Esto
 * calcula, para un chat, si está abierta, cuánto le queda y de qué tipo es.
 * La misma regla usa el backend para no programar seguimientos que no van a
 * llegar (ventana-meta.ts, nutricion.ts).
 */
export interface Ventana {
  abierta: boolean;
  /** Siempre 24: el anuncio no alarga la ventana del texto libre. */
  horas: number;
  /** "llegó por un anuncio" / "escribió directo". */
  origen: string;
  /** Abierta: "quedan 18 h". Cerrada: "se cerró hace 2 días". */
  cuando: string;
  /** Horas que le quedan (0 si está cerrada): para el color del aviso. */
  quedan: number;
}

export function ventanaWhatsApp(
  lead: { canalOrigen: string; origenEtiqueta?: string | null; adsClickId?: string | null },
  ultimoEntranteEn: string | null | undefined,
  ahora: number = Date.now(),
): Ventana | null {
  if (lead.canalOrigen !== "whatsapp") return null;
  const deAnuncio = Boolean(lead.adsClickId) || (lead.origenEtiqueta ?? "").startsWith("ad:");
  const horas = 24;
  const origen = deAnuncio ? "llegó por un anuncio" : "escribió directo";
  if (!ultimoEntranteEn) return { abierta: false, horas, origen, cuando: "nunca te escribió", quedan: 0 };
  const pasaron = (ahora - new Date(ultimoEntranteEn).getTime()) / 3_600_000;
  const quedan = horas - pasaron;
  if (quedan > 0) return { abierta: true, horas, origen, cuando: `quedan ${duracion(quedan)}`, quedan };
  return { abierta: false, horas, origen, cuando: `se cerró hace ${duracion(-quedan)}`, quedan: 0 };
}

function duracion(horas: number): string {
  if (horas < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 48) return `${Math.floor(horas)} h`;
  return `${Math.floor(horas / 24)} días`;
}
