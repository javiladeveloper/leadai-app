"use client";

import { useEffect, useState } from "react";
import { obtenerNegociosAdmin, type NegocioAdmin } from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

const PLAN_LABEL: Record<string, string> = {
  free: "Free", flujos: "Flujos", light: "Emprende", pro: "Pro", business: "Business",
};

export default function AdminNegocios() {
  const [negocios, setNegocios] = useState<NegocioAdmin[]>([]);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");

  useEffect(() => {
    obtenerNegociosAdmin()
      .then((r) => { setNegocios(r); setEstado("ok"); })
      .catch(() => setEstado("error"));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Plataforma LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Negocios</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Todos los negocios de la plataforma{estado === "ok" ? ` · ${negocios.length}` : ""}.
        </p>
      </header>

      {estado === "cargando" && <SkeletonLista filas={4} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar los negocios. Recargá.</p>
        </div>
      )}

      {estado === "ok" && (
        <div className="overflow-x-auto rounded-tarjeta bg-carta ring-1 ring-linea">
          <table className="w-full text-left text-[0.9rem]">
            <thead>
              <tr className="border-b border-linea text-[0.75rem] uppercase tracking-wide text-frio">
                <th className="px-4 py-3 font-bold">Negocio</th>
                <th className="px-4 py-3 font-bold">Plan</th>
                <th className="px-4 py-3 font-bold">Leads</th>
                <th className="px-4 py-3 font-bold">Prepago</th>
              </tr>
            </thead>
            <tbody>
              {negocios.map((n) => (
                <tr key={n.id} className="border-b border-linea/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-tinta">{n.nombre}</p>
                    <p className="text-[0.72rem] text-frio">{n.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-tinta-2">
                      {PLAN_LABEL[n.plan] ?? n.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-tinta tabular-nums">{n.leads.toLocaleString("es-PE")}</td>
                  <td className="px-4 py-3 text-tinta-2 tabular-nums">{n.saldoPrepagoHits.toLocaleString("es-PE")}</td>
                </tr>
              ))}
              {negocios.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-frio">Todavía no hay negocios.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
