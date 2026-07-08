"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import { obtenerConversacion } from "@/lib/leads";
import { ChipTemp } from "@/components/ChipTemp";
import { Burbuja } from "@/components/Burbuja";
import { IconoChevron, IconoMic, IconoEnviar } from "@/components/Iconos";

export default function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [resumenAbierto, setResumenAbierto] = useState(true);
  const [texto, setTexto] = useState("");
  const [ventaAbierta, setVentaAbierta] = useState(false);

  useEffect(() => {
    if (!haySesion()) router.replace("/");
    else setListo(true);
  }, [router]);

  if (!listo) return null;

  const conv = obtenerConversacion(id);
  if (!conv) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-frio">No encontramos esta conversación.</p>
        <Link href="/leads" className="rounded-chip bg-tinta px-5 py-2.5 font-bold text-carta">
          Volver a leads
        </Link>
      </div>
    );
  }

  const { lead, mensajes, borradores } = conv;

  return (
    <div className="flex min-h-dvh flex-col bg-arena">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-linea bg-carta/95 px-3 py-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            href="/leads"
            aria-label="Volver"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tinta-2"
          >
            <IconoChevron className="h-6 w-6 rotate-90" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[1.1rem] font-bold text-tinta">{lead.nombre}</h1>
            <p className="truncate text-[0.78rem] text-frio">{lead.empresa}</p>
          </div>
          <ChipTemp t={lead.temperatura} />
        </div>
      </header>

      {/* Resumen de la IA, colapsable */}
      <section className="border-b border-linea bg-tibio-suave/60">
        <button
          onClick={() => setResumenAbierto((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5"
        >
          <span className="text-[0.8rem] font-bold uppercase tracking-wide text-tibio">
            Lo que la IA entendió
          </span>
          <IconoChevron
            className={`h-5 w-5 text-tibio transition-transform ${resumenAbierto ? "" : "-rotate-90"}`}
          />
        </button>
        {resumenAbierto && (
          <dl className="grid gap-2 px-4 pb-3.5 text-[0.92rem]">
            {lead.quiere && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-bold text-tinta-2">Quiere</dt>
                <dd className="text-tinta">{lead.quiere}</dd>
              </div>
            )}
            {lead.presupuesto && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-bold text-tinta-2">Presupuesto</dt>
                <dd className="text-tinta">{lead.presupuesto}</dd>
              </div>
            )}
            {lead.urgencia && (
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-bold text-tinta-2">Urgencia</dt>
                <dd className="text-tinta">{lead.urgencia}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      {/* Chat */}
      <main className="flex flex-1 flex-col gap-3 px-4 py-4">
        {mensajes.map((m) => (
          <Burbuja key={m.id} m={m} />
        ))}

        {/* Borradores listos para enviar */}
        {borradores.length > 0 && (
          <div className="mt-2 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-brasa">
              ✦ Respuestas listas para enviar
            </p>
            <div className="flex flex-col gap-2">
              {borradores.map((b, i) => (
                <button
                  key={i}
                  onClick={() => setTexto(b)}
                  className="rounded-xl bg-arena/70 px-3 py-2.5 text-left text-[0.92rem] leading-snug text-tinta-2 transition hover:bg-arena active:scale-[0.99] ring-1 ring-linea"
                >
                  {b}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[0.72rem] text-frio">Tocá una para editarla antes de enviar.</p>
          </div>
        )}
      </main>

      {/* Registrar venta */}
      {ventaAbierta ? (
        <div className="mx-4 mb-2 rounded-tarjeta bg-ok/10 p-3.5 ring-1 ring-ok/30">
          <p className="text-[0.95rem] font-bold text-ok">✓ Venta registrada</p>
          <p className="text-[0.85rem] text-tinta-2">
            Se sumó a tus comisiones de {lead.empresa}. La verás en Reportes.
          </p>
        </div>
      ) : (
        <button
          onClick={() => setVentaAbierta(true)}
          className="mx-4 mb-2 rounded-chip border-2 border-ok/40 bg-carta py-2.5 text-[0.95rem] font-bold text-ok transition active:scale-[0.99]"
        >
          Registrar venta de este lead
        </button>
      )}

      {/* Composición */}
      <div className="sticky bottom-0 border-t border-linea bg-carta px-3 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
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
    </div>
  );
}
