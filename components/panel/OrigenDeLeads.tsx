"use client";

import { useEffect, useState } from "react";
import { origenDeLeads, type FilaOrigenLeads } from "@/lib/api";

/**
 * QUÉ PUBLICIDAD TE TRAE CLIENTES (2026-09-17, pedido de Jonathan: "tampoco
 * las estadísticas me dicen nada, no sé de dónde vino ese y cuánto me costó").
 *
 * NO es lo mismo que "Qué funcionó", que está al lado y mide CLICS. Un anuncio
 * puede tener el mejor CTR de la cuenta y no traer una sola conversación: el
 * clic lo paga uno, la conversación la empieza el cliente. Acá se cuentan
 * personas que escribieron, y cuántas de ellas se calentaron.
 *
 * El costo por lead es el que decide presupuesto. "Gasté S/10.58" no dice si
 * conviene; "cada persona que me escribió me costó S/3.53" sí.
 */
export function OrigenDeLeads({ tenant }: { tenant?: string } = {}) {
  const [filas, setFilas] = useState<FilaOrigenLeads[] | null>(null);
  const [dias, setDias] = useState(30);

  useEffect(() => {
    let vivo = true;
    setFilas(null);
    void origenDeLeads(dias, tenant).then((f) => { if (vivo) setFilas(f); });
    return () => { vivo = false; };
  }, [tenant, dias]);

  if (filas === null) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  if (filas.length === 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">De dónde te escriben</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Cuando te escriba gente desde un anuncio vas a ver acá de cuál vino
          cada uno y cuánto te costó traerlo.
        </p>
      </div>
    );
  }

  const totalLeads = filas.reduce((a, f) => a + f.leads, 0);

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[1.05rem] font-bold text-tinta">De dónde te escriben</h3>
          <p className="mt-0.5 text-[0.8rem] text-frio">
            {totalLeads} {totalLeads === 1 ? "persona escribió" : "personas escribieron"} en{" "}
            {dias} días
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setDias(n)}
              className={`rounded-chip px-2.5 py-0.5 text-[0.76rem] font-semibold transition ${
                dias === n ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea"
              }`}
            >
              {n} días
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {filas.map((f) => (
          <Fila key={f.adId ?? f.etiqueta} f={f} maximo={filas[0].leads} />
        ))}
      </div>

      <p className="mt-4 text-[0.76rem] text-frio">
        El costo por persona es el gasto del anuncio dividido entre la gente que
        trajo. Lo que no vino de publicidad no tiene costo.
      </p>
    </div>
  );
}

/**
 * Una fila: de dónde, cuántos, cuántos se calentaron y a qué precio.
 *
 * CALIENTES aparte del total porque es donde está la diferencia entre dos
 * anuncios que traen lo mismo: veinte curiosos no valen lo que tres personas
 * que preguntaron el precio.
 */
function Fila({ f, maximo }: { f: FilaOrigenLeads; maximo: number }) {
  const ancho = Math.max(4, Math.round((f.leads / Math.max(maximo, 1)) * 100));
  const icono = f.tipo === "anuncio" ? "📣" : f.tipo === "link" ? "🔗" : f.tipo === "manual" ? "✍️" : "💬";

  return (
    <div className="rounded-lg bg-arena/40 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="shrink-0">{icono}</span>
          <span className="truncate text-[0.86rem] font-semibold text-tinta">{f.etiqueta}</span>
        </span>
        <span className="shrink-0 text-[0.86rem] font-bold tabular-nums text-tinta">
          {f.leads}
        </span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-arena">
        <div className="h-full rounded bg-brasa/70" style={{ width: `${ancho}%` }} />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[0.76rem] text-frio">
        {f.calientes > 0 && (
          <span className="font-semibold text-ok">🔥 {f.calientes} interesados</span>
        )}
        {f.costoPorLeadCentavos !== undefined && (
          <span>
            {soles(f.costoPorLeadCentavos)} por persona
            {f.gastoCentavos !== undefined && ` · ${soles(f.gastoCentavos)} gastados`}
          </span>
        )}
        {/* Un anuncio sin gasto todavía NO se pinta como "gratis": el cron del
            histórico corre una vez al día y el hueco es temporal. */}
        {f.tipo === "anuncio" && f.costoPorLeadCentavos === undefined && (
          <span>el costo aparece cuando Meta cierre el día</span>
        )}
        {f.campania && <span className="truncate">· {f.campania}</span>}
      </div>
    </div>
  );
}

function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}
