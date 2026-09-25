/**
 * LA VENTANA DE 24 HORAS DE WHATSAPP (2026-09-25, caso Edith).
 *
 * Jonathan le mandó a Edith un saludo y dos videos; ninguno llegó. Ella había
 * escrito hacía tres días y WhatsApp solo entrega mensajes normales dentro de
 * las 24 h desde el último mensaje del cliente. Pasado eso, solo una
 * plantilla aprobada. El panel no lo decía: "debería avisarme".
 *
 * Quien vino por un anuncio de WhatsApp tiene 72 h (misma regla que usan los
 * seguimientos del bot, ver nutricion.ts en el backend).
 */
export interface Ventana {
  abierta: boolean;
  /** Para el aviso: "hace 3 días", "nunca te escribió". */
  desde: string;
  horas: number;
}

export function ventanaWhatsApp(
  lead: { canalOrigen: string; origenEtiqueta?: string | null; adsClickId?: string | null },
  ultimoEntranteEn: string | null | undefined,
  ahora: number = Date.now(),
): Ventana | null {
  if (lead.canalOrigen !== "whatsapp") return null;
  const horas = lead.adsClickId || (lead.origenEtiqueta ?? "").startsWith("ad:") ? 72 : 24;
  if (!ultimoEntranteEn) return { abierta: false, desde: "nunca te escribió", horas };
  const pasaron = (ahora - new Date(ultimoEntranteEn).getTime()) / 3_600_000;
  return { abierta: pasaron < horas, desde: haceCuanto(pasaron), horas };
}

function haceCuanto(horas: number): string {
  if (horas < 1) return "hace un momento";
  if (horas < 48) return `hace ${Math.floor(horas)} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

/** Cuántas variables {{n}} tiene el texto de una plantilla. */
export function variablesDe(cuerpo: string): number {
  return Math.max(0, ...[...cuerpo.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1])));
}

/** El texto de la plantilla con las variables puestas, como lo va a ver el cliente. */
export function rellenar(cuerpo: string, valores: string[]): string {
  return cuerpo.replace(/\{\{(\d+)\}\}/g, (_, n: string) => valores[Number(n) - 1]?.trim() || `{{${n}}}`);
}
