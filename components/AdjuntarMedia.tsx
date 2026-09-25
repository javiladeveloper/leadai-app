"use client";
import { useEffect, useRef, useState } from "react";
import { enviarMediaLead } from "@/lib/api";
import { pesoLegible, revisarAdjunto } from "@/lib/media-chat";

/**
 * EL 📎 DEL CHAT (2026-09-25, Jonathan: "quiero enviar videos demos y no me
 * deja… aplica algún conversor para que el video se comprima").
 *
 * Elegís una foto o un video, se ve antes de mandarlo, y lo que escribiste en
 * el cuadro de abajo va como pie. El servidor lo convierte y comprime para
 * WhatsApp, así que un video grande tarda unos segundos: la espera se ve
 * animada y dice qué está pasando.
 *
 * Solo WhatsApp por ahora: Instagram y Messenger todavía mandan solo texto.
 */
export function AdjuntarMedia({
  leadId, tenant, canal, caption, alEnviar, bloqueado,
}: {
  leadId: string;
  tenant?: string;
  canal: string;
  /** Por qué no se puede adjuntar ahora (p. ej. la ventana de 24 h cerrada). */
  bloqueado?: string;
  /** Lo escrito en el cuadro: va como pie de la foto o el video. */
  caption: string;
  /** Tras enviar: limpiar el cuadro y recargar la conversación. */
  alEnviar: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const soloWhatsApp = canal !== "whatsapp";
  const motivoBloqueo = soloWhatsApp ? "Por ahora las fotos y los videos se envían solo por WhatsApp" : bloqueado;

  useEffect(() => () => { if (vista) URL.revokeObjectURL(vista); }, [vista]);

  function elegir(f: File | undefined) {
    if (!f) return;
    const problema = revisarAdjunto(f);
    if (problema) { setError(problema); return; }
    setError(null);
    setArchivo(f);
    setVista(URL.createObjectURL(f));
  }

  function quitar() {
    setArchivo(null);
    setVista(null);
    setError(null);
  }

  async function enviar() {
    if (!archivo || enviando) return;
    setEnviando(true);
    setError(null);
    const dataUrl = await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(new Error("No se pudo leer el archivo."));
      r.readAsDataURL(archivo);
    }).catch(() => null);
    const r = dataUrl ? await enviarMediaLead(leadId, dataUrl, caption, tenant) : { ok: false, error: "No se pudo leer el archivo." };
    setEnviando(false);
    if (r.ok) {
      quitar();
      alEnviar();
    } else {
      setError(r.error ?? "No se pudo enviar el archivo.");
    }
  }

  const esVideo = archivo?.type.startsWith("video/");

  return (
    <div className="relative shrink-0">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={Boolean(motivoBloqueo) || enviando}
        aria-label="Adjuntar foto o video"
        title={motivoBloqueo ?? "Adjuntar foto o video"}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-arena text-[1.3rem] text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2 disabled:opacity-40"
      >
        📎
      </button>

      {(archivo || error) && (
        <div className="absolute bottom-14 left-0 z-20 w-72 rounded-tarjeta bg-carta p-3 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          {archivo && vista && (
            <>
              {esVideo ? (
                <video src={vista} controls muted className="max-h-44 w-full rounded-xl bg-black/20" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- vista local del archivo elegido.
                <img src={vista} alt="Vista previa" className="max-h-44 w-full rounded-xl object-cover" />
              )}
              <p className="mt-2 truncate text-[0.78rem] text-tinta-2">
                {archivo.name} · {pesoLegible(archivo.size)}
              </p>
              <p className="mt-0.5 text-[0.72rem] text-frio">
                {caption.trim() ? "Lo que escribiste abajo va como pie." : "Si escribes algo abajo, va como pie."}
                {esVideo && " Lo dejamos listo para WhatsApp (menos de 16 MB)."}
              </p>
              {enviando ? (
                <div className="mt-2.5" role="status" aria-live="polite">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brasa/30 border-t-brasa" />
                    <span className="text-[0.8rem] font-semibold text-tinta-2">
                      {esVideo ? "Comprimiendo y enviando el video…" : "Enviando la foto…"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-arena">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-brasa" />
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void enviar()}
                    className="flex-1 rounded-chip bg-brasa px-3 py-2 text-[0.82rem] font-bold text-sobre-brasa transition active:scale-[0.98]"
                  >
                    Enviar {esVideo ? "video" : "foto"}
                  </button>
                  <button
                    type="button"
                    onClick={quitar}
                    className="rounded-chip px-3 py-2 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="mt-2 text-[0.78rem] font-semibold text-alerta-hondo" role="alert">
              {error}
              {!archivo && (
                <button type="button" onClick={quitar} className="ml-2 underline">Cerrar</button>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
