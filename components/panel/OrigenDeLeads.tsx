"use client";

import { useCallback, useState } from "react";
import { LinkLead } from "@/components/LinkLead";
import { origenDeLeads, type FilaOrigenLeads } from "@/lib/api";
import { ErrorMarketing, importeMarketing, useLecturaMarketing } from "./marketing-lectura";
import { ChipPlataforma } from "./OrigenLead";

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
export function OrigenDeLeads({ tenant, dias = 30 }: { tenant?: string; dias?: number } = {}) {
  const cargar = useCallback(() => origenDeLeads(dias, tenant), [dias, tenant]);
  const { datos: filas, cargando, error, reintentar } = useLecturaMarketing<FilaOrigenLeads[]>(`${tenant}:${dias}`, cargar);
  if (error) return <ErrorMarketing mensaje={error} reintentar={reintentar} />;
  if (cargando || !filas) return <div role="status" aria-label="Cargando origen de leads" className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  if (filas.length === 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">De dónde te escriben</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          No hay contactos registrados en los últimos {dias} días.
        </p>
      </div>
    );
  }

  const totalLeads = filas.reduce((a, f) => a + f.leads, 0);
  const maximo = Math.max(...filas.map((x) => x.leads), 1);

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
      </div>

      <div className="mt-5 space-y-2">
        {filas.map((f) => (
          <Fila key={f.adId ?? f.etiqueta} f={f} maximo={maximo} dias={dias} tenant={tenant} />
        ))}
      </div>

      <p className="mt-4 text-[0.76rem] text-frio">
        Los contactos son registros del CRM. Un origen sin gasto informado no implica captación gratuita ni acredita citas o ventas.
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
function Fila({ f, maximo, dias, tenant }: { f: FilaOrigenLeads & { moneda?: string | null }; maximo: number; dias: number; tenant?: string }) {
  const [abierta, setAbierta] = useState(false);
  const ancho = Math.max(0, Math.min(100, Math.round((f.leads / Math.max(maximo, 1)) * 100)));
  const icono = f.tipo === "anuncio" ? "📣" : f.tipo === "link" ? "🔗" : f.tipo === "manual" ? "✍️" : "💬";
  // LO QUE DISTINGUE DOS FILAS CON EL MISMO NOMBRE (2026-10-07): las copias de
  // un anuncio se llaman igual; campaña, conjunto y fechas no.
  const subtitulo = [
    f.campania,
    f.conjunto && f.conjunto !== f.etiqueta ? f.conjunto : null,
    f.desde ? `${fechaCorta(f.desde)} → ${fechaCorta(f.hasta)}` : null,
  ].filter(Boolean).join(" · ");
  const desplegable = (f.detalle?.length ?? 0) > 0 || f.impresiones !== undefined;

  return (
    <div className={`rounded-lg px-4 py-3 transition ${abierta ? "bg-arena/70 ring-1 ring-linea" : "bg-arena/40"}`}>
      <button
        type="button"
        onClick={() => desplegable && setAbierta((v) => !v)}
        aria-expanded={desplegable ? abierta : undefined}
        disabled={!desplegable}
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-brasa disabled:cursor-default"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            {desplegable && <span aria-hidden className={`text-frio transition ${abierta ? "rotate-90" : ""}`}>›</span>}
            {f.plataforma ? <ChipPlataforma plataforma={f.plataforma} /> : <span aria-hidden className="shrink-0">{icono}</span>}
            <span className="truncate text-[0.86rem] font-semibold text-tinta">{f.etiqueta}</span>
            {f.activo !== undefined && (
              <span className={`shrink-0 rounded-chip px-1.5 py-px text-[0.66rem] font-bold ${f.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"}`}>
                {f.activo ? "Activo" : "Detenido"}
              </span>
            )}
          </span>
          <span className="shrink-0 text-[0.86rem] font-bold tabular-nums text-tinta">
            {f.leads}
          </span>
        </div>
        {subtitulo && <p className="mt-0.5 truncate text-[0.74rem] text-frio">{subtitulo}</p>}

        <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-arena">
          <div className="h-full rounded bg-brasa/70" style={{ width: `${ancho}%` }} />
        </div>

        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[0.76rem] text-frio">
          {f.calientes > 0 && (
            <span className="font-semibold text-ok">🔥 {f.calientes} interesados</span>
          )}
          {(f.demos ?? 0) > 0 && <span className="font-semibold text-ok">· {f.demos} {f.demos === 1 ? "demo" : "demos"}</span>}
          {f.costoPorLeadCentavos !== undefined && (
            <span>
              {importeMarketing(f.costoPorLeadCentavos, f.moneda)} por contacto
              {f.gastoCentavos !== undefined && ` · ${importeMarketing(f.gastoCentavos, f.moneda)} gastados en ${dias} días`}
            </span>
          )}
          {/* Un anuncio sin gasto todavía NO se pinta como "gratis": el cron del
              histórico corre una vez al día y el hueco es temporal. */}
          {f.tipo === "anuncio" && f.plataforma === "meta" && f.costoPorLeadCentavos === undefined && (
            <span>Costo no disponible</span>
          )}
        </div>
      </button>

      {abierta && <DetalleFila f={f} tenant={tenant} />}
    </div>
  );
}

/** Al tocar la fila: cómo le fue a ese origen y quiénes llegaron por él. */
function DetalleFila({ f, tenant }: { f: FilaOrigenLeads; tenant?: string }) {
  const datos = [
    f.respondieron !== undefined && `${f.respondieron} de ${f.leads} respondieron`,
    f.demos !== undefined && `${f.demos} ${f.demos === 1 ? "demo" : "demos"}`,
    (f.ventas ?? 0) > 0 && `${f.ventas} ${f.ventas === 1 ? "venta" : "ventas"}`,
    f.impresiones !== undefined && `${f.impresiones.toLocaleString("es-PE")} impresiones`,
    f.clics !== undefined && `${f.clics.toLocaleString("es-PE")} clics`,
    (f.conversacionesMeta ?? 0) > 0 && `Meta contó ${f.conversacionesMeta} conversaciones`,
  ].filter(Boolean);
  return (
    <div className="mt-3 space-y-2 border-t border-linea pt-3">
      {datos.length > 0 && <p className="text-[0.76rem] text-tinta-2">{datos.join(" · ")}</p>}
      {(f.detalle?.length ?? 0) > 0 && (
        <ul className="space-y-1">
          {f.detalle!.map((l) => {
            const cuerpo = (
              <>
                <span className="truncate font-medium text-tinta">{l.nombre?.trim() || "Sin nombre"}</span>
                <span className="flex shrink-0 items-center gap-1.5 text-[0.72rem] text-frio">
                  {l.demo && <span className="rounded-chip bg-ok/12 px-1.5 py-px font-bold text-ok">Demo</span>}
                  <span className={l.nivel === "caliente" ? "font-semibold text-calor-hondo" : ""}>{NIVEL[l.nivel] ?? l.nivel}</span>
                  <span>· {l.mensajes <= 1 ? "no respondió" : `${l.mensajes} msj`}</span>
                  <span>· {fechaCorta(l.creadoEn)}</span>
                </span>
              </>
            );
            const clase = "flex items-center justify-between gap-2 rounded-md bg-carta px-3 py-1.5 text-[0.8rem]";
            return (
              <li key={l.id}>
                {/* Con su negocio (2026-10-09): Marketing mira el negocio de los
                    chips, que puede no ser la empresa activa. */}
                <LinkLead id={l.id} tenant={tenant} className={`${clase} transition hover:ring-1 hover:ring-brasa/50`} claseSinPermiso={clase}>
                  {cuerpo}
                </LinkLead>
              </li>
            );
          })}
        </ul>
      )}
      {f.leads > (f.detalle?.length ?? 0) && (
        <p className="text-[0.72rem] text-frio">Se muestran los {f.detalle?.length ?? 0} más recientes. El detalle completo está en Reportes → Publicidad.</p>
      )}
    </div>
  );
}

const NIVEL: Record<string, string> = { caliente: "Caliente", tibio: "Tibio", frio: "Frío" };

function fechaCorta(v?: string | null) {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}
