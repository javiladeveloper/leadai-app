"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { obtenerReporte } from "@/lib/leads";

const soles = (n: number) => `S/${n.toLocaleString("es-PE")}`;

// Reportes del panel de escritorio: comisiones, stats, funnel y por marca,
// migrado de app/reportes a layout ancho en grilla.
export default function ReportesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;
  const r = obtenerReporte();
  const maxFunnel = r.funnel[0]?.cantidad || 1;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Este mes</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Reportes</h1>
      </header>

      {/* Aviso de datos de ejemplo */}
      <div className="rounded-tarjeta bg-tibio-suave px-4 py-2.5 text-center text-[0.82rem] font-semibold text-tinta-2">
        Estás viendo datos de ejemplo — cuando conectes tu canal, acá verás tus resultados reales.
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal: comisiones + stats + funnel */}
        <div className="space-y-4 lg:col-span-2">
          {/* Comisiones — el dato que más importa */}
          <div className="rounded-tarjeta bg-superficie-honda p-6 text-carta shadow-[var(--sombra-tarjeta)]">
            <p className="text-[0.85rem] text-carta/70">Comisiones ganadas</p>
            <p className="mt-1 text-[2.8rem] font-bold leading-none">{soles(r.comisionesGanadas)}</p>
            <p className="mt-2 text-[0.9rem] text-carta/80">
              + {soles(r.comisionesPendientes)} por cobrar
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: r.leads, l: "Leads", c: "text-tinta" },
              { n: r.calientes, l: "Calientes", c: "text-brasa" },
              { n: r.ventas, l: "Ventas", c: "text-ok" },
            ].map((s) => (
              <div key={s.l} className="rounded-tarjeta bg-carta p-4 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className={`text-[1.9rem] font-bold leading-none ${s.c}`}>{s.n}</p>
                <p className="mt-1 text-[0.78rem] font-semibold text-frio">{s.l}</p>
              </div>
            ))}
          </div>

          {/* Funnel */}
          <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Del contacto a la venta</h2>
            <div className="space-y-2.5">
              {r.funnel.map((f, i) => {
                const pct = Math.round((f.cantidad / maxFunnel) * 100);
                return (
                  <div key={f.etapa}>
                    <div className="mb-1 flex justify-between text-[0.85rem]">
                      <span className="text-tinta-2">{f.etapa}</span>
                      <span className="font-bold text-tinta tabular-nums">{f.cantidad}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-arena">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: i === r.funnel.length - 1 ? "var(--color-ok)" : "var(--color-brasa)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Columna lateral: por empresa */}
        <div>
          <h2 className="mb-2 px-1 text-[1.05rem] font-bold text-tinta">Por marca</h2>
          <div className="space-y-3">
            {r.porEmpresa.map((e) => (
              <div key={e.empresa} className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-tinta">{e.empresa}</h3>
                    <p className="text-[0.82rem] text-frio">{e.ventas} ventas cerradas</p>
                  </div>
                  <p className="text-[1.3rem] font-bold text-tinta">{soles(e.comision)}</p>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {e.pagada ? (
                    <span className="rounded-chip bg-ok/15 px-3 py-1.5 text-[0.82rem] font-bold text-ok">
                      ✓ Pagada
                    </span>
                  ) : (
                    <button className="flex-1 rounded-chip bg-brasa py-2 text-[0.9rem] font-bold text-carta transition active:scale-[0.99]">
                      Marcar como cobrada
                    </button>
                  )}
                  <button className="rounded-chip bg-arena px-4 py-2 text-[0.88rem] font-bold text-tinta-2 ring-1 ring-linea">
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
