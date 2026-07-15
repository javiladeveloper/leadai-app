"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  obtenerLead,
  accionLead,
  type Lead,
  type LeadDetalle,
} from "@/lib/api";
import { BadgeCanal } from "@/components/BadgeCanal";

const NIVEL_ETIQUETA: Record<Lead["nivelInteres"], { texto: string; clase: string }> = {
  caliente: { texto: "🔴 Caliente", clase: "bg-brasa-suave text-brasa-hondo" },
  tibio: { texto: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "⚪ Frío", clase: "bg-arena text-frio" },
};

interface Props {
  lead: Lead;
  onCerrar: () => void;
  onCambio: (accion: "marcar_ganado" | "descartar") => void; // avisa al tablero para mover la tarjeta
}

// Vista rápida de un lead desde el pipeline: resumen + conversación completa +
// responder, sin salir del tablero. Carga los mensajes al abrir.
export default function PopupLead({ lead, onCerrar, onCambio }: Props) {
  const router = useRouter();
  const [detalle, setDetalle] = useState<LeadDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const finRef = useRef<HTMLDivElement | null>(null);

  const nivel = NIVEL_ETIQUETA[lead.nivelInteres];
  const activo = lead.estado !== "ganado" && lead.estado !== "perdido";

  // Carga la conversación al abrir.
  useEffect(() => {
    let vivo = true;
    obtenerLead(lead.id)
      .then((d) => { if (vivo) setDetalle(d); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [lead.id]);

  // Baja al último mensaje cuando llega la conversación o se envía uno nuevo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [detalle?.mensajes.length]);

  async function responder() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError("");
    const r = await accionLead(lead.id, { tipo: "responder", texto: t });
    setEnviando(false);
    if (r.ok) {
      // Optimista: agregamos el mensaje saliente a la conversación mostrada.
      setDetalle((prev) =>
        prev
          ? {
              ...prev,
              mensajes: [
                ...prev.mensajes,
                { id: `tmp-${Date.now()}`, direccion: "saliente", contenido: t, canal: lead.canalOrigen, creadoEn: new Date().toISOString() },
              ],
            }
          : prev,
      );
      setTexto("");
    } else {
      setError(r.error ?? "No se pudo enviar. Probá de nuevo.");
    }
  }

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-tarjeta bg-carta shadow-[0_8px_24px_rgba(51,40,31,0.2)] ring-1 ring-linea"
      >
        {/* Encabezado */}
        <div className="border-b border-linea p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 truncate text-[1.1rem] font-bold text-tinta">
              {lead.nombre ?? lead.contactoExterno}
            </h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold ${nivel.clase}`}>
              {nivel.texto}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <BadgeCanal canal={lead.canalOrigen} tamano="chico" />
            <span className="text-[0.78rem] text-frio">{lead.contactoExterno}</span>
          </div>
          {lead.resumenIA && (
            <p className="mt-3 rounded-chip bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2">
              {lead.resumenIA}
            </p>
          )}
        </div>

        {/* Conversación */}
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {cargando && <p className="text-center text-[0.82rem] text-frio">Cargando conversación…</p>}
          {!cargando && (!detalle || detalle.mensajes.length === 0) && (
            <p className="text-center text-[0.82rem] text-frio">Todavía no hay mensajes.</p>
          )}
          {detalle?.mensajes.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direccion === "saliente" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-tarjeta px-3 py-2 text-[0.85rem] ${
                  m.direccion === "saliente"
                    ? "bg-brasa text-carta"
                    : "bg-arena text-tinta"
                }`}
              >
                {m.contenido}
              </div>
            </div>
          ))}
          <div ref={finRef} />
        </div>

        {/* Responder + acciones */}
        <div className="border-t border-linea p-4">
          {activo && (
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); responder(); }
                }}
                rows={1}
                placeholder="Escribí una respuesta…"
                className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
              />
              <button
                onClick={responder}
                disabled={enviando || !texto.trim()}
                className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          )}
          {error && <p className="mt-2 text-[0.8rem] text-brasa-hondo">{error}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => router.push(`/conversacion/${lead.id}`)}
              className="flex-1 rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Abrir conversación
            </button>
            {activo && (
              <>
                <button
                  onClick={() => { onCambio("marcar_ganado"); onCerrar(); }}
                  className="rounded-chip bg-ok/12 px-3.5 py-2 text-sm font-bold text-ok transition hover:bg-ok/20"
                >
                  Gané
                </button>
                <button
                  onClick={() => { onCambio("descartar"); onCerrar(); }}
                  className="rounded-chip bg-arena px-3.5 py-2 text-sm font-bold text-frio transition hover:bg-linea"
                >
                  Descartar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
