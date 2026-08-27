"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ventasAdmin, type VentasNegocioAdmin, type SenalesNegocio } from "@/lib/api";
import { soles } from "@/lib/precio";
import { SkeletonLista } from "@/components/Skeletons";

/**
 * NEGOCIOS CON SU PLATA A LA VISTA (2026-08-24, Jonathan: "un super usuario
 * para ver los movimientos de cada restaurante o ventas").
 *
 * La tabla vieja mostraba plan y leads — datos de captación. Lo que el dueño
 * de la plataforma mira todos los días es OTRO número: quién está vendiendo
 * y cuánto. Por eso la tabla ahora es de VENTAS (hoy / 7 días / 30 días),
 * ordenada por quién más vende, y cada fila abre el detalle de movimientos.
 */

const PLAN_LABEL: Record<string, string> = {
  free: "Free", flujos: "Flujos", light: "Emprende", pro: "Pro", business: "Business",
  pedidos: "Arranque", arranque: "Arranque", crecer: "Crecer", full: "Full",
  resto_gratis: "Gratis",
};

// La puesta en marcha en UNA celda: cada señal es un emoji que se apaga
// (gris) si falta. Seis negocios se comparan de un vistazo sin leer nada;
// el detalle de qué falta exactamente vive en la página del negocio.
function Senales({ s }: { s: SenalesNegocio }) {
  const items: { on: boolean; emoji: string; title: string }[] = [
    { on: s.whatsapp, emoji: "📲", title: s.whatsapp ? "WhatsApp conectado" : "Sin WhatsApp" },
    { on: s.platos > 0, emoji: "🧾", title: s.platos > 0 ? `Carta: ${s.platos} platos` : "Sin carta" },
    { on: s.cartaWeb, emoji: "🌐", title: s.cartaWeb ? "Carta web con link" : "Sin carta web" },
    { on: s.pagos, emoji: "💳", title: s.pagos ? "Cobros configurados" : "Sin forma de cobro" },
    { on: s.mesas > 0, emoji: "🪑", title: s.mesas > 0 ? `${s.mesas} mesas (QR)` : "Sin mesas" },
    { on: s.redes, emoji: "📣", title: s.redes ? "Redes en la carta" : "Sin redes" },
  ];
  return (
    <span className="whitespace-nowrap text-[0.95rem]">
      {items.map((i) => (
        <span key={i.emoji} title={i.title} className={i.on ? "" : "opacity-20 grayscale"}>
          {i.emoji}
        </span>
      ))}
    </span>
  );
}

function Tramo({ t }: { t: { pedidos: number; solesCentavos: number } }) {
  if (t.pedidos === 0) return <span className="text-frio/50">—</span>;
  return (
    <span className="tabular-nums">
      <b className="text-tinta">{soles(t.solesCentavos)}</b>
      <span className="ml-1 text-[0.75rem] text-frio">({t.pedidos})</span>
    </span>
  );
}

export default function AdminNegocios() {
  const [negocios, setNegocios] = useState<VentasNegocioAdmin[]>([]);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");

  useEffect(() => {
    ventasAdmin()
      .then((r) => { setNegocios(r); setEstado("ok"); })
      .catch(() => setEstado("error"));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Plataforma LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Negocios y ventas</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Cuánto vende cada negocio{estado === "ok" ? ` · ${negocios.length} negocios` : ""}. Toca
          uno para ver sus movimientos.
        </p>
      </header>

      {estado === "cargando" && <SkeletonLista filas={4} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar los negocios. Recarga.</p>
        </div>
      )}

      {estado === "ok" && (
        <div className="overflow-x-auto rounded-tarjeta bg-carta ring-1 ring-linea">
          <table className="w-full text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-linea text-[0.75rem] uppercase tracking-wide text-frio">
                <th className="px-4 py-3 font-bold">Negocio</th>
                <th className="px-4 py-3 font-bold">Plan</th>
                <th className="px-4 py-3 font-bold">Hoy</th>
                <th className="px-4 py-3 font-bold">7 días</th>
                <th className="px-4 py-3 font-bold">30 días</th>
                <th className="px-4 py-3 font-bold">Puesta en marcha</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map((n) => (
                <tr key={n.tenantId} className="border-b border-linea/60 transition last:border-0 hover:bg-arena/40">
                  <td className="px-4 py-3">
                    {/* El nombre ES el link: toda la fila invita, el nombre lleva. */}
                    <Link href={`/admin/negocios/${n.tenantId}`} className="font-semibold text-tinta hover:text-brasa-texto">
                      {n.nombre}
                    </Link>
                    <p className="text-[0.72rem] text-frio">{n.tenantId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-tinta-2">
                      {PLAN_LABEL[n.plan] ?? n.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3"><Tramo t={n.hoy} /></td>
                  <td className="px-4 py-3"><Tramo t={n.dias7} /></td>
                  <td className="px-4 py-3"><Tramo t={n.dias30} /></td>
                  <td className="px-4 py-3"><Senales s={n.senales} /></td>
                </tr>
              ))}
              {negocios.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-frio">Todavía no hay negocios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
