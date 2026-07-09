"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { listarLeads, obtenerConversacion } from "@/lib/leads";
import { TarjetaLead } from "@/components/TarjetaLead";
import { Burbuja } from "@/components/Burbuja";
import { ChipTemp } from "@/components/ChipTemp";
import { IconoMic, IconoEnviar } from "@/components/Iconos";

// Pantalla principal del panel: bandeja + chat + contexto IA en 3 columnas
// (desktop). En mobile se muestra solo la lista de leads; tocar un lead
// navega a la conversación de la app (misma ruta que usa la fuerza de ventas
// en el teléfono), vía el propio <Link> de TarjetaLead.
export default function ConversacionesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [texto, setTexto] = useState("");
  const [ventaAbierta, setVentaAbierta] = useState(false);

  const leads = useMemo(() => listarLeads(), []);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  useEffect(() => {
    if (leads.length > 0 && !seleccionadoId) {
      setSeleccionadoId(leads[0].id);
    }
  }, [leads, seleccionadoId]);

  if (!listo) return null;

  const conv = seleccionadoId ? obtenerConversacion(seleccionadoId) : null;

  return (
    <div className="flex min-h-full flex-col">
      {/* Aviso de datos de ejemplo */}
      <div className="bg-tibio-suave px-4 py-2 text-center text-[0.8rem] font-semibold text-tinta-2">
        Estás viendo datos de ejemplo — cuando conectes tu canal, acá verás tus conversaciones reales.
      </div>

      {/* Mobile (<lg): solo la lista, a ancho completo. Tocar un lead navega
          a /conversacion/[id] (el TarjetaLead ya es un Link). */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:hidden">
        {leads.map((lead) => (
          <TarjetaLead
            key={lead.id}
            lead={{ ...lead, urgente: lead.temperatura === "caliente" && lead.estado === "sin_atender" }}
          />
        ))}
      </div>

      {/* Desktop (lg+): 3 columnas */}
      <div className="hidden flex-1 overflow-hidden lg:grid lg:grid-cols-[320px_1fr_300px]">
        {/* Columna 1: lista de leads. Acá el clic selecciona (no navega), por
            eso interceptamos el click del Link con preventDefault. */}
        <div className="flex flex-col gap-2.5 overflow-y-auto border-r border-linea p-3">
          {leads.map((lead) => {
            const activo = lead.id === seleccionadoId;
            return (
              <div
                key={lead.id}
                onClick={(e) => {
                  e.preventDefault();
                  setSeleccionadoId(lead.id);
                }}
                className={activo ? "rounded-tarjeta ring-2 ring-brasa" : ""}
              >
                <TarjetaLead
                  lead={{ ...lead, urgente: lead.temperatura === "caliente" && lead.estado === "sin_atender" }}
                />
              </div>
            );
          })}
        </div>

        {/* Columna 2: chat */}
        <div className="flex min-w-0 flex-col overflow-hidden bg-arena">
          {conv ? (
            <>
              {/* Resumen de la IA */}
              <section className="border-b border-linea bg-tibio-suave/60 px-4 py-3">
                <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-tibio">
                  Lo que la IA entendió
                </p>
                <dl className="grid gap-1.5 text-[0.88rem]">
                  {conv.lead.quiere && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 font-bold text-tinta-2">Quiere</dt>
                      <dd className="text-tinta">{conv.lead.quiere}</dd>
                    </div>
                  )}
                  {conv.lead.presupuesto && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 font-bold text-tinta-2">Presupuesto</dt>
                      <dd className="text-tinta">{conv.lead.presupuesto}</dd>
                    </div>
                  )}
                  {conv.lead.urgencia && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 font-bold text-tinta-2">Urgencia</dt>
                      <dd className="text-tinta">{conv.lead.urgencia}</dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* Burbujas del chat */}
              <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {conv.mensajes.map((m) => (
                  <Burbuja key={m.id} m={m} />
                ))}

                {/* Borradores listos para enviar */}
                {conv.borradores.length > 0 && (
                  <div className="mt-2 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-brasa">
                      ✦ Respuestas listas para enviar
                    </p>
                    <div className="flex flex-col gap-2">
                      {conv.borradores.map((b, i) => (
                        <button
                          key={i}
                          onClick={() => setTexto(b)}
                          className="rounded-xl bg-arena/70 px-3 py-2.5 text-left text-[0.92rem] leading-snug text-tinta-2 ring-1 ring-linea transition hover:bg-arena active:scale-[0.99]"
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[0.72rem] text-frio">Tocá una para editarla antes de enviar.</p>
                  </div>
                )}
              </main>

              {/* Campo de envío */}
              <div className="border-t border-linea bg-carta px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={1}
                    placeholder="Escribí o tocá el micrófono…"
                    className="max-h-28 flex-1 resize-none rounded-2xl bg-arena px-3.5 py-2.5 text-[0.98rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                  />
                  {texto.trim() ? (
                    <button
                      aria-label="Enviar"
                      onClick={() => setTexto("")}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brasa text-carta"
                    >
                      <IconoEnviar className="h-6 w-6" />
                    </button>
                  ) : (
                    <button
                      aria-label="Grabar nota de voz"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tinta text-carta"
                    >
                      <IconoMic className="h-6 w-6" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-frio">
              Elegí un lead de la lista para ver la conversación.
            </div>
          )}
        </div>

        {/* Columna 3: contexto IA + acciones */}
        <div className="flex flex-col overflow-y-auto border-l border-linea p-4">
          {conv ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[1.05rem] font-bold text-tinta">{conv.lead.nombre}</h2>
                <ChipTemp t={conv.lead.temperatura} />
              </div>
              <p className="mt-0.5 text-[0.8rem] text-frio">{conv.lead.empresa}</p>

              <div className="mt-4 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-tibio">
                  Contexto IA
                </p>
                <dl className="grid gap-2 text-[0.85rem]">
                  <div>
                    <dt className="font-bold text-tinta-2">Quiere</dt>
                    <dd className="text-tinta">{conv.lead.quiere ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-tinta-2">Presupuesto</dt>
                    <dd className="text-tinta">{conv.lead.presupuesto ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-tinta-2">Urgencia</dt>
                    <dd className="text-tinta">{conv.lead.urgencia ?? "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {ventaAbierta ? (
                  <div className="rounded-tarjeta bg-ok/10 p-3.5 ring-1 ring-ok/30">
                    <p className="text-[0.9rem] font-bold text-ok">✓ Venta registrada</p>
                    <p className="text-[0.8rem] text-tinta-2">
                      Se sumó a tus comisiones de {conv.lead.empresa}. La verás en Reportes.
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setVentaAbierta(true)}
                    className="rounded-chip border-2 border-ok/40 bg-carta py-2.5 text-[0.9rem] font-bold text-ok transition active:scale-[0.99]"
                  >
                    Registrar venta
                  </button>
                )}
                <button className="rounded-chip bg-tinta py-2.5 text-[0.9rem] font-bold text-carta transition active:scale-[0.99]">
                  Tomar conversación
                </button>
              </div>
            </>
          ) : (
            <p className="text-frio">Sin conversación seleccionada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
