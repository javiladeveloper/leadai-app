"use client";

import { useEffect, useState } from "react";
import { adminResumenNorac, type ResumenNorac } from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

/**
 * TORRE DE CONTROL NORAC (super admin, 2026-08-29).
 *
 * La vista de dueño de GRUPO: MRR real (suscripciones Culqi mensualizadas),
 * cuentas y altas del mes, placas NFC por marca (el canal físico de captación
 * de las 3 verticales) y qué integraciones del ecosistema están vivas.
 */

const NOMBRE_PLAN: Record<string, string> = {
  free: "Free", flujos: "Flujos", light: "Emprende", pro: "Pro", business: "Business",
  pedidos: "Pedidos", resto_gratis: "Resto (prueba)", arranque: "Arranque", crecer: "Crecer", full: "Full",
};

const NOMBRE_MARCA: Record<string, string> = {
  leadai: "LeadAI", sania: "Sania", fitcore: "FitCore",
};

function soles(centavos: number): string {
  return `S/ ${(centavos / 100).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
}

export default function AdminNorac() {
  const [r, setR] = useState<ResumenNorac | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setR(await adminResumenNorac());
      setCargando(false);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
      <header>
        <p className="eyebrow">Norac</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Torre de control</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Lo que entra, lo que crece y lo que está conectado — en una pantalla.
        </p>
      </header>

      {cargando && <SkeletonLista filas={3} />}

      {!cargando && !r && (
        <p className="text-[0.9rem] text-frio">No se pudieron cargar los números. Recarga la página.</p>
      )}

      {r && (
        <>
          {/* MRR + cuentas */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="text-[0.76rem] font-bold uppercase tracking-wide text-frio">MRR (LeadAI)</p>
              <p className="mt-1 text-[1.9rem] font-bold text-tinta">{soles(r.mrr.centavos)}</p>
              <p className="text-[0.82rem] text-tinta-2">
                {r.mrr.suscripciones} suscripciones
                {r.mrr.enGracia > 0 && (
                  <span className="ml-1.5 rounded-full bg-tibio-suave px-2 py-0.5 text-[0.72rem] font-bold text-tinta">
                    {r.mrr.enGracia} en gracia
                  </span>
                )}
              </p>
            </div>
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="text-[0.76rem] font-bold uppercase tracking-wide text-frio">Cuentas</p>
              <p className="mt-1 text-[1.9rem] font-bold text-tinta">{r.cuentas.total}</p>
              <p className="text-[0.82rem] text-tinta-2">+{r.cuentas.nuevas30d} en los últimos 30 días</p>
            </div>
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="text-[0.76rem] font-bold uppercase tracking-wide text-frio">Ecosistema</p>
              <p className="mt-1 text-[1.05rem] font-bold text-tinta">
                {r.ecosistema.conSania} con Sania · {r.ecosistema.conFitcore} con FitCore
              </p>
              <p className="text-[0.82rem] text-tinta-2">negocios conectados a otra vertical</p>
            </div>
          </div>

          {/* MRR por plan */}
          <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
            <h2 className="text-[1.05rem] font-bold text-tinta">Quién paga qué</h2>
            {Object.keys(r.mrr.porPlan).length === 0 ? (
              <p className="mt-2 text-[0.88rem] text-frio">Todavía no hay suscripciones activas.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[0.88rem]">
                  <thead>
                    <tr className="text-[0.74rem] font-bold uppercase tracking-wide text-frio">
                      <th className="pb-2">Plan</th>
                      <th className="pb-2">Cuentas</th>
                      <th className="pb-2">MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.mrr.porPlan)
                      .sort((a, b) => b[1].centavos - a[1].centavos)
                      .map(([plan, fila]) => (
                        <tr key={plan} className="border-t border-linea">
                          <td className="py-2 font-semibold text-tinta">{NOMBRE_PLAN[plan] ?? plan}</td>
                          <td className="py-2 text-tinta-2">{fila.cuentas}</td>
                          <td className="py-2 font-semibold text-tinta">{soles(fila.centavos)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Cuentas por plan (incluye las gratis: el embudo completo) */}
            <p className="mt-3 text-[0.8rem] text-frio">
              Todas las cuentas:{" "}
              {Object.entries(r.cuentas.porPlan)
                .sort((a, b) => b[1] - a[1])
                .map(([plan, n]) => `${NOMBRE_PLAN[plan] ?? plan} ${n}`)
                .join(" · ")}
            </p>
          </div>

          {/* Placas por marca */}
          <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
            <h2 className="text-[1.05rem] font-bold text-tinta">Placas NFC por marca</h2>
            {Object.keys(r.placas).length === 0 ? (
              <p className="mt-2 text-[0.88rem] text-frio">Todavía no hay placas registradas.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[0.88rem]">
                  <thead>
                    <tr className="text-[0.74rem] font-bold uppercase tracking-wide text-frio">
                      <th className="pb-2">Marca</th>
                      <th className="pb-2">Total</th>
                      <th className="pb-2">Activas</th>
                      <th className="pb-2">Libres</th>
                      <th className="pb-2">Activadas 30d</th>
                      <th className="pb-2">Toques 30d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(r.placas).map(([marca, m]) => (
                      <tr key={marca} className="border-t border-linea">
                        <td className="py-2 font-semibold text-tinta">{NOMBRE_MARCA[marca] ?? marca}</td>
                        <td className="py-2 text-tinta-2">{m.total}</td>
                        <td className="py-2 font-semibold text-ok">{m.activas}</td>
                        <td className="py-2 text-tinta-2">{m.libres}</td>
                        <td className="py-2 text-tinta-2">{m.activadas30d}</td>
                        <td className="py-2 text-tinta-2">{m.escaneos30d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
