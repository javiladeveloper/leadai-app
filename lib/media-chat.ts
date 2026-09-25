/**
 * FOTOS Y VIDEOS EN EL CHAT (2026-09-25, Jonathan: "quiero enviar videos
 * demos y no me deja").
 *
 * El backend los convierte y comprime para WhatsApp (MP4 H.264 bajo 16 MB,
 * fotos JPG bajo 5 MB), así que acá solo se frena lo que no tiene arreglo:
 * algo que no es foto ni video, o un archivo más grande que lo que se puede
 * subir.
 *
 * En el historial el mensaje queda como "🎥 Video: pie\n<link>": es lo que
 * lee `mediaDelTexto` para mostrar el video dentro de la burbuja.
 */

/** Lo más grande que se puede subir; el servidor lo comprime después. */
export const MAX_ADJUNTO_MB = 50;

export function revisarAdjunto(a: { type: string; size: number }): string | null {
  const esMedia = a.type.startsWith("video/") || a.type.startsWith("image/");
  if (!esMedia) return "Solo se pueden enviar fotos o videos.";
  if (a.size > MAX_ADJUNTO_MB * 1024 * 1024) {
    return `Pesa ${Math.round(a.size / 1048576)} MB y el máximo es ${MAX_ADJUNTO_MB} MB. Córtalo antes de enviarlo.`;
  }
  return null;
}

export interface MediaEnChat {
  tipo: "video" | "imagen";
  url: string;
  caption?: string;
}

/** Si el mensaje es una foto o un video enviado desde el chat, sus datos. */
export function mediaDelTexto(texto: string): MediaEnChat | null {
  const m = texto.match(/^(🎥 Video|📷 Foto)(?:: ([\s\S]*?))?\n(https?:\/\/\S+)\s*$/u);
  if (!m) return null;
  return { tipo: m[1].startsWith("🎥") ? "video" : "imagen", url: m[3], ...(m[2]?.trim() ? { caption: m[2].trim() } : {}) };
}

/** "12.4 MB", para decir cuánto pesa lo elegido. */
export function pesoLegible(bytes: number): string {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
