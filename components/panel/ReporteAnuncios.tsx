"use client";

import { useCallback, useState } from "react";
import { obtenerReporteAnuncios, type ReporteAnuncios as ReporteDTO } from "@/lib/api";
import { ErrorMarketing, useLecturaMarketing } from "./marketing-lectura";

export function ReporteAnuncios({ tenant, dias = 30 }: { tenant?: string; dias?: number } = {}) {
  return <ReporteContenido key={`${tenant ?? "activa"}:${dias}`} tenant={tenant} dias={dias} />;
}

function ReporteContenido({ tenant, dias }: { tenant?: string; dias: number }) {
  const [limite, setLimite] = useState(20);
  const cargar = useCallback(() => obtenerReporteAnuncios(dias, tenant), [dias, tenant]);
  const { datos: r, cargando, error, reintentar } = useLecturaMarketing<ReporteDTO | null>(`${tenant}:${dias}`, cargar);
  if (error) return <ErrorMarketing mensaje={error} reintentar={reintentar} />;
  if (cargando) return <div role="status" aria-label="Cargando reporte" className="h-48 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!r) return <ErrorMarketing mensaje="El reporte no está disponible. Comprueba tu conexión y acceso e inténtalo de nuevo." reintentar={reintentar} />;
  const periodoCorrecto = r.periodo?.dias === dias;
  const ventasMedidas = r.ventasMedidas === true;
  const resultado = r.resultado;
  const interesados = r.filas.every((f) => Number.isFinite(f.interesados)) ? r.filas.reduce((total, f) => total + f.interesados!, 0) : null;
  return <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 className="text-[1.05rem] font-bold text-tinta">Rendimiento de tus anuncios</h3>
      <span className="text-sm text-frio">Últimos {dias} días</span>
    </div>
    {!periodoCorrecto ? <p role="status" className="mt-3 text-sm text-tibio">No se pudo confirmar el periodo del reporte. Sus cifras no se comparan hasta que el servidor informe las fechas correspondientes.</p> : <>
      <p className="mt-1 text-sm text-frio">{fecha(r.periodo!.desde)} — {fecha(r.periodo!.hasta)}</p>
      <p className="mt-2 text-sm text-tinta-2">Gasto total: <strong>{r.sinGasto ? "No medido" : importe(r.gastoTotalCentavos, r.moneda)}</strong> · <strong>{interesados === null ? "Interesados no medidos" : `${interesados.toLocaleString("es-PE")} interesados registrados`}</strong>.</p>
      {ventasMedidas ? <p className="mt-2 text-sm text-frio">El retorno registrado relaciona ventas registradas con gasto publicitario. No representa beneficio: no descuenta costos del producto ni otros gastos.</p> : <p className="mt-2 text-sm text-frio">Captación: interesados registrados por anuncio. Las ventas no están medidas y estos contactos no acreditan citas agendadas ni atendidas.</p>}
      {r.moneda !== "PEN" && ventasMedidas && <p className="mt-2 text-sm text-frio">Las compras están registradas en PEN y el gasto de Meta {r.moneda ? `en ${r.moneda}` : "no tiene moneda informada"}. Se muestran por separado, sin conversión de moneda ni retorno calculado.</p>}
      {r.sinGasto && <p className="mt-2 text-sm text-tibio">Gasto de Meta no disponible para este periodo. No equivale a gasto cero.</p>}
      {r.aviso && <p role="status" className="mt-2 text-sm text-tibio">{r.aviso}</p>}
      {r.filas.length === 0 ? <p className="mt-4 text-sm text-frio">No hay resultados registrados para anuncios en este periodo.</p> : <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{ventasMedidas ? "Gasto, resultados y retorno registrado por anuncio" : "Gasto e interesados registrados por anuncio"}</caption>
          <thead><tr className="border-b border-linea text-left text-frio">
            <th scope="col" className="pb-2 pr-3">Anuncio</th><th scope="col" className="pb-2 pr-3">Fechas</th><th scope="col" className="pb-2 pr-3 text-right">Gasto Meta{r.moneda ? ` (${r.moneda})` : ""}</th>
            {ventasMedidas && <th scope="col" className="pb-2 pr-3 text-right">Ventas registradas (PEN)</th>}
            <th scope="col" className="pb-2 pr-3 text-right">{resultado?.etiqueta ?? "Interesados registrados"}</th>
            {ventasMedidas && <th scope="col" className="pb-2 text-right">Retorno registrado</th>}
          </tr></thead>
          <tbody>{r.filas.slice(0, limite).map((f) => {
            const gastoConocido = f.gastoConocido === true && !r.sinGasto && Number.isFinite(f.gastoCentavos);
            const retornoMedido = gastoConocido && ventasMedidas && r.moneda === "PEN" && f.gastoCentavos > 0 && f.roas !== null && Number.isFinite(f.roas);
            return <tr key={f.origen} className="border-b border-linea/60 last:border-0">
              {/* CAMPAÑA, CONJUNTO Y FECHAS (2026-10-07, captura de Jonathan:
                  "¿cómo diferencio esto? son muy parecidos"). Las copias de un
                  anuncio se llaman igual; esto es lo que las separa. */}
              <th scope="row" className="max-w-[22rem] py-3 pr-3 text-left font-normal">
                <span className="block truncate font-semibold text-tinta">
                  {/^\d{6,}$/.test(f.nombre || f.origen) ? "Anuncio de otra cuenta" : f.nombre || f.origen}
                </span>
                {/^\d{6,}$/.test(f.nombre || f.origen) && (
                  <span className="mt-0.5 block truncate text-[0.76rem] text-frio">Sin nombre ni gasto en esta cuenta · id {f.origen}</span>
                )}
                {(f.campania || f.conjunto) && (
                  <span className="mt-0.5 block truncate text-[0.76rem] text-frio">
                    {[f.campania, f.conjunto && f.conjunto !== f.nombre ? f.conjunto : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </th>
              <td className="whitespace-nowrap py-3 pr-3 text-[0.8rem] text-tinta-2">
                {f.desde ? <>
                  <span className="tabular-nums">{fechaCorta(f.desde)} → {fechaCorta(f.hasta)}</span>
                  {f.activo !== undefined && (
                    <span className={`ml-1.5 rounded-chip px-1.5 py-px text-[0.68rem] font-bold ${f.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"}`}>
                      {f.activo ? "Activo" : "Detenido"}
                    </span>
                  )}
                </> : <span className="text-frio">—</span>}
              </td>
              <td className="py-3 pr-3 text-right tabular-nums text-tinta-2">{gastoConocido ? importe(f.gastoCentavos, r.moneda) : "No medido"}</td>
              {ventasMedidas && <td className="py-3 pr-3 text-right tabular-nums text-tinta-2">{importe(f.ventasCentavos, "PEN")}</td>}
              <td className="py-3 pr-3 text-right tabular-nums text-tinta-2">{ventasMedidas && resultado?.tipo === "pedidos" ? f.compradores : f.interesados ?? "No medidos"}</td>
              {ventasMedidas && <td className="py-3 text-right tabular-nums text-tinta-2">{retornoMedido ? `${f.roas!.toFixed(2)}x` : "No medido"}</td>}
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {r.filas.length > 20 && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-frio">
        <p role="status">Mostrando {Math.min(limite, r.filas.length)} de {r.filas.length} anuncios.</p>
        {limite < r.filas.length && <button type="button" onClick={() => setLimite((n) => n + 20)} className="rounded-chip bg-arena px-3 py-2 font-semibold text-tinta-2 focus-visible:outline-brasa">Ver más anuncios del reporte</button>}
      </div>}
      {r.organicos.leads > 0 && <p className="mt-3 border-t border-linea pt-3 text-sm text-frio">Sin atribución a anuncios: {r.organicos.leads} contactos registrados{ventasMedidas ? ` y ${importe(r.organicos.ventasCentavos, "PEN")} en ventas registradas` : ""}.</p>}
    </>}
    <p className="mt-3 text-sm text-frio">{r.actualizadoEn ? `Actualizado: ${fecha(r.actualizadoEn)}` : "Fecha de actualización no disponible."}</p>
  </div>;
}

function importe(centavos: number, moneda?: string | null) {
  if (!Number.isFinite(centavos)) return "No medido";
  const valor = (centavos / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${valor} ${moneda || "(moneda no informada)"}`;
}

function fecha(valor: string) {
  const d = new Date(valor.length === 10 ? `${valor}T12:00:00` : valor);
  return Number.isNaN(d.getTime()) ? "Fecha no disponible" : d.toLocaleDateString("es-PE");
}

function fechaCorta(valor?: string) {
  if (!valor) return "";
  const d = new Date(`${valor}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}
