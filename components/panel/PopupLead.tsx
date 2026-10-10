"use client";

import { useEffect, useRef, useState } from "react";
import {
  obtenerLead,
  accionLead,
  type Lead,
  type LeadDetalle,
} from "@/lib/api";
import { BadgeCanal } from "@/components/BadgeCanal";
import { AccionesContacto } from "@/components/AccionesContacto";
import { useAbrirLead } from "@/components/LinkLead";
import { puedeAbrirConversacion } from "@/lib/auth";
import { OrigenLead } from "@/components/panel/OrigenLead";
import { ProximaCita } from "@/components/panel/ProximaCita";
import { CierreLead } from "@/components/panel/CierreLead";
import { VentaLead } from "@/components/panel/VentaLead";

const NIVEL_ETIQUETA: Record<Lead["nivelInteres"], { texto: string; clase: string }> = {
  caliente: { texto: "🔴 Caliente", clase: "bg-calor-suave text-calor-hondo" },
  tibio: { texto: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "⚪ Frío", clase: "bg-arena text-frio" },
};

interface Props {
  lead: Lead;
  onCerrar: () => void;
  /** Avisa al tablero que el lead se cerró, para mover la tarjeta (la acción ya la hizo el popup). */
  onCambio: (estado: "ganado" | "perdido") => void;
  // Modo global: el lead puede ser de un negocio distinto a la empresa activa;
  // el tablero pasa su tenantId para que el detalle/responder vayan al negocio
  // correcto. Sin él, se usa la empresa activa (comportamiento de siempre).
  tenant?: string;
}

/**
 * VISTA RÁPIDA DE UN LEAD DESDE SEGUIMIENTO: resumen + conversación +
 * responder, sin salir del tablero.
 *
 * 2026-10-09 (tanda "consistencia"):
 *  · Se cierra con Escape, como cualquier ventana.
 *  · Muestra lo que antes había que ir a buscar a la ficha: la próxima
 *    reunión (con "Unirse"), de dónde vino y la nota privada.
 *  · Cerrar el lead es el MISMO flujo que la ficha de Conversaciones
 *    (CierreLead: "Ganado" con monto opcional y "Descartar"), y "Pagó" está
 *    acá también.
 *  · Al enviar una respuesta se vuelve a pedir la conversación: antes quedaba
 *    el mensaje provisional y la respuesta del bot no aparecía nunca.
 */
export default function PopupLead({ lead, onCerrar, onCambio, tenant }: Props) {
  const abrirLead = useAbrirLead();
  const [detalle, setDetalle] = useState<LeadDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // El estado vive acá también: al marcar "Ganado" el popup sigue abierto y
  // tiene que dejar de ofrecer cerrar lo que ya se cerró.
  const [estado, setEstado] = useState(lead.estado);
  const finRef = useRef<HTMLDivElement | null>(null);

  const nivel = NIVEL_ETIQUETA[lead.nivelInteres];
  const activo = estado !== "ganado" && estado !== "perdido";
  const nota = (detalle?.nota ?? lead.nota)?.trim();

  // Carga la conversación al abrir.
  useEffect(() => {
    let vivo = true;
    obtenerLead(lead.id, tenant)
      .then((d) => { if (vivo) setDetalle(d); })
      .catch(() => undefined)
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [lead.id, tenant]);

  // Escape cierra (2026-10-09): un popup que solo se cierra con el mouse
  // atrapa a quien usa el teclado.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  // Baja al último mensaje cuando llega la conversación o se envía uno nuevo.
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [detalle?.mensajes.length]);

  async function responder() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError("");
    // Se ve apenas se manda; se reemplaza por lo que diga el servidor.
    setDetalle((prev) =>
      prev
        ? {
            ...prev,
            mensajes: [
              ...prev.mensajes,
              { id: `tmp-${Date.now()}`, direccion: "saliente", contenido: t, canal: lead.canalOrigen, creadoEn: new Date().toISOString(), estado: "enviando" },
            ],
          }
        : prev,
    );
    setTexto("");
    const r = await accionLead(lead.id, { tipo: "responder", texto: t }, tenant);
    if (r.ok) {
      // LA CONVERSACIÓN DE VERDAD (2026-10-09): el estado real del envío
      // (fallido fuera de las 24 h, por ejemplo) y lo que haya llegado mientras.
      const fresco = await obtenerLead(lead.id, tenant).catch(() => null);
      if (fresco) setDetalle(fresco);
    } else {
      setDetalle((prev) => (prev ? { ...prev, mensajes: prev.mensajes.filter((m) => !m.id.startsWith("tmp-")) } : prev));
      setTexto(t);
      setError(r.error ?? "No se pudo enviar. Prueba de nuevo.");
    }
    setEnviando(false);
  }

  return (
    <div
      onClick={onCerrar}
      className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-lead-titulo"
        className="flex max-h-[88vh] w-full max-w-md flex-col rounded-tarjeta bg-carta shadow-[var(--sombra-flotante)] ring-1 ring-linea"
      >
        {/* Encabezado */}
        <div className="border-b border-linea p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <h3 id="popup-lead-titulo" className="min-w-0 flex-1 truncate text-[1.1rem] font-bold text-tinta">
              {lead.nombre ?? lead.contactoExterno}
            </h3>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.72rem] font-bold ${nivel.clase}`}>
              {nivel.texto}
            </span>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar (Esc)"
              className="-mr-2 -mt-1 grid h-8 min-h-0 w-8 shrink-0 place-items-center rounded-full text-frio transition hover:bg-arena hover:text-tinta"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BadgeCanal canal={lead.canalOrigen} tamano="chico" />
            <span className="text-[0.78rem] text-frio">{lead.contactoExterno}</span>
            {/* Llamar o abrir su WhatsApp sin salir del tablero (2026-10-09). */}
            <span className="ml-auto"><AccionesContacto canal={lead.canalOrigen} contacto={lead.contactoExterno} compacto /></span>
          </div>
          {/* De dónde vino, con nombre y costo — el mismo chip de la ficha. */}
          <div className="mt-2">
            <OrigenLead lead={detalle ?? lead} compacto />
          </div>
          {detalle?.proximaCita && (
            <div className="mt-3 rounded-tarjeta bg-brasa-suave/60 px-3 py-2">
              <ProximaCita cita={detalle.proximaCita} compacta />
            </div>
          )}
          {lead.resumenIA && (
            <p className="mt-3 rounded-chip bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2">
              {lead.resumenIA}
            </p>
          )}
          {nota && (
            <p className="mt-2 rounded-lg bg-tibio-suave px-3 py-2 text-[0.82rem] text-tinta">
              <span className="font-bold">Nota: </span>{nota}
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
                    ? "bg-brasa text-sobre-brasa"
                    : "bg-arena text-tinta"
                } ${m.estado === "enviando" ? "opacity-70" : ""}`}
              >
                {m.contenido}
                {m.direccion === "saliente" && m.estado === "fallido" && (
                  <span className="mt-1 block text-[0.72rem] font-semibold text-alerta-hondo">
                    No se entregó{m.motivoFallo ? `: ${m.motivoFallo}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={finRef} />
        </div>

        {/* Responder + acciones */}
        <div className="space-y-3 border-t border-linea p-4">
          {activo && (
            <div className="flex items-end gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); responder(); }
                }}
                rows={1}
                placeholder="Escribe una respuesta…"
                aria-label="Respuesta"
                className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
              />
              <button
                onClick={responder}
                disabled={enviando || !texto.trim()}
                className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          )}
          {error && <p className="text-[0.8rem] text-alerta-hondo">{error}</p>}

          {/* Cerrar el lead: el mismo flujo que la ficha de Conversaciones. */}
          <CierreLead
            leadId={lead.id}
            estado={estado}
            tenant={tenant}
            onCambio={(nuevo) => { setEstado(nuevo); onCambio(nuevo); }}
          />
          {/* "Pagó": la venta real, en todas las fichas (2026-10-09). */}
          <VentaLead
            key={detalle ? "con-detalle" : "sin-detalle"}
            leadId={lead.id}
            ventaEn={detalle?.ventaEn ?? lead.ventaEn}
            ventaCentavos={detalle?.ventaCentavos ?? lead.ventaCentavos}
            tenant={tenant}
            compacto
          />

          {/* A la ficha completa del lead, con su negocio (2026-10-09). */}
          {puedeAbrirConversacion() && (
            <button
              onClick={() => abrirLead(lead.id, tenant)}
              className="w-full rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Abrir chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
