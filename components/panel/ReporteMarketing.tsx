"use client";

import Link from "next/link";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  descargarReporteMarketingExcel, reporteMarketing, type AnuncioReporte, type GrupoReporte, type LeadReporte,
  type ReporteMarketing as Reporte,
} from "@/lib/api";
import { puedeAbrirConversacion } from "@/lib/auth";
import { LinkLead } from "@/components/LinkLead";
import { AccionesContacto } from "@/components/AccionesContacto";
import { urlGestionarAnuncio } from "@/lib/enlaces";
import { ErrorMarketing, useLecturaMarketing } from "./marketing-lectura";
import { ChipPlataforma } from "./OrigenLead";
import {
  Bitacora, Cambio, ChipCansancio, CrearPublico, FrenosYTemas, GraficoDiario, MetasYAvisos, PorHora, PuntoSemaforo,
  TarjetaAtencion, tiempoRespuesta,
} from "./ReporteMarketingExtras";

/**
 * EL REPORTE DEL MARKETERO (2026-10-07, pedido de su equipo de marketing:
 * "una sección de reportes para ver cada lead, el resumen, de qué publicidad
 * vino, cuánto costó aprox., lo invertido"; y de Jonathan: "imagínate que tú
 * eres de marketing, qué te gustaría ver").
 *
 * Se lee de arriba a abajo en el orden en que un marketero decide:
 *  1. La escalera del costo: cuánto sale cada lead, cada interesado, cada demo
 *     y cada venta. El costo por lead solo engaña.
 *  2. Lo que dicen los números, en frases.
 *  3. Cada anuncio con campaña, conjunto y fechas (las copias se llaman igual)
 *     y, al tocarlo, los leads que trajo.
 *  4. Especialidad, ciudad y día: a quién y cuándo apuntar.
 *  5. Cada lead, con filtros. Todo se baja en Excel (lo arma el servidor).
 */

const PERIODOS = [7, 30, 90] as const;
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

const NIVEL: Record<string, { label: string; clase: string }> = {
  caliente: { label: "Caliente", clase: "bg-calor/15 text-calor-hondo" },
  tibio: { label: "Tibio", clase: "bg-tibio-suave text-tinta-2" },
  frio: { label: "Frío", clase: "bg-arena text-frio" },
};
const ESTADO: Record<string, string> = {
  nuevo: "Nuevo", nutriendo: "En seguimiento", escalado: "Pasado al equipo", ganado: "Ganado", perdido: "Perdido",
};

const soles = (c: number | null | undefined) =>
  typeof c === "number" && Number.isFinite(c)
    ? `S/${(c / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : "—");
const fechaCorta = (v: string | null) => {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
};
const fechaHora = (v: string) =>
  new Date(v).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });

export function ReporteMarketing({ tenant }: { tenant?: string } = {}) {
  const [dias, setDias] = useState<number>(30);
  const cargar = useCallback(() => reporteMarketing(dias, tenant), [dias, tenant]);
  const { datos: r, cargando, error, reintentar } = useLecturaMarketing<Reporte>(`${tenant}:${dias}`, cargar);
  const [bajando, setBajando] = useState<"no" | "si" | "error">("no");

  async function bajarExcel() {
    setBajando("si");
    const ok = await descargarReporteMarketingExcel(dias, tenant);
    setBajando(ok ? "no" : "error");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Publicidad</p>
          <h2 className="mt-1 text-[1.4rem] font-bold text-tinta">Qué trae clientes y cuánto cuesta</h2>
          {r && (
            <p className="mt-0.5 text-[0.82rem] text-frio">
              Del {fechaCorta(r.periodo.desde)} al {fechaCorta(r.periodo.hasta)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="flex gap-1 rounded-chip bg-arena p-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDias(p)}
              aria-pressed={dias === p}
              className={`rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-brasa ${
                dias === p ? "bg-carta text-tinta shadow-sm" : "text-tinta-2 hover:text-tinta"
              }`}
            >
              {p} días
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={bajarExcel}
          disabled={bajando === "si" || !r}
          className="rounded-chip bg-brasa px-4 py-2 text-[0.82rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo focus-visible:outline-2 focus-visible:outline-brasa disabled:opacity-60"
        >
          {bajando === "si" ? "Preparando Excel…" : "Descargar Excel"}
        </button>
        </div>
      </div>
      {bajando === "error" && (
        <p role="alert" className="text-[0.82rem] text-calor-hondo">No se pudo descargar el Excel. Inténtalo de nuevo en un momento.</p>
      )}

      {error ? (
        <ErrorMarketing mensaje={error} reintentar={reintentar} />
      ) : cargando || !r ? (
        <div role="status" aria-label="Cargando reporte de marketing" className="space-y-4">
          <div className="h-36 animate-pulse rounded-tarjeta bg-arena-2/70" />
          <div className="h-64 animate-pulse rounded-tarjeta bg-arena-2/70" />
        </div>
      ) : (
        <Contenido r={r} recargar={reintentar} tenant={tenant} />
      )}
    </div>
  );
}

function Contenido({ r, recargar, tenant }: { r: Reporte; recargar: () => void; tenant?: string }) {
  const t = r.totales;
  const porId = useMemo(() => new Map(r.leads.map((l) => [l.id, l])), [r.leads]);
  const ciudades = r.porCiudad.filter((c) => c.clave !== "Sin dato");

  return (
    <>
      <EscaleraCosto r={r} />

      {r.lectura.length > 0 && (
        <div className="rounded-tarjeta bg-carta p-5 ring-2 ring-brasa/40">
          <p className="text-[0.85rem] font-bold uppercase tracking-wide text-brasa-texto">Lo que dicen los números</p>
          <ul className="mt-3 space-y-2">
            {r.lectura.map((frase) => (
              <li key={frase} className="flex gap-2 text-[0.92rem] leading-snug text-tinta-2">
                <span aria-hidden className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brasa" />
                <span>{frase}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.porDia && r.porDia.length > 0 && <GraficoDiario dias={r.porDia} notas={r.notas ?? []} />}
      <Bitacora notas={r.notas ?? []} recargar={recargar} tenant={tenant} />

      {r.porPlataforma.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.porPlataforma.map((p) => (
            <div key={p.clave} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
              <div className="flex items-center justify-between gap-2">
                {p.clave === "directo"
                  ? <span className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Sin anuncio</span>
                  : <ChipPlataforma plataforma={p.clave} />}
                <span className="text-[1.3rem] font-bold tabular-nums text-tinta">{p.leads}</span>
              </div>
              <p className="mt-2 text-[0.78rem] text-frio">
                {p.calientes} calientes · {p.demos} {p.demos === 1 ? "demo" : "demos"}
                {p.ventas > 0 && ` · ${p.ventas} ${p.ventas === 1 ? "venta" : "ventas"}`}
              </p>
              {p.gastoCentavos !== null && p.gastoCentavos > 0 && (
                <p className="mt-1 text-[0.78rem] text-tinta-2">
                  {soles(p.gastoCentavos)} invertidos · <b className="text-tinta">{soles(p.costoPorLeadCentavos)}</b> por lead
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {r.atencion && <TarjetaAtencion a={r.atencion} />}

      <TablaAnuncios anuncios={r.anuncios} porId={porId} />

      <FrenosYTemas objeciones={r.objeciones ?? []} temas={r.temas ?? []} total={t.leads} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Grupos titulo="Por especialidad" grupos={r.porEspecialidad} />
        <PorDia dias={r.porDiaSemana} />
      </div>
      <div className={`grid gap-4 ${ciudades.length > 0 ? "lg:grid-cols-2" : ""}`}>
        {r.porHora && <PorHora horas={r.porHora} />}
        {ciudades.length > 0 && <Grupos titulo="Por ciudad" grupos={r.porCiudad} />}
      </div>

      <MetasYAvisos metas={r.metas ?? {}} semanal={r.reporteSemanalActivo ?? false} recargar={recargar} tenant={tenant} />

      <TablaLeads leads={r.leads} dias={r.periodo.dias} tenant={tenant} />

      <p className="text-[0.76rem] leading-relaxed text-frio">
        El costo por lead es el gasto del anuncio en el período repartido entre los leads que trajo en ese mismo
        período: es un promedio, no lo que costó cada persona. &ldquo;Respondió&rdquo; = escribió algo más que el
        mensaje automático del botón del anuncio. &ldquo;Demo&rdquo; = tiene una reunión agendada.
        {t.invertidoGoogleCentavos === null && " El gasto de Google Ads no está conectado: solo se suma Meta."}
      </p>
    </>
  );
}

/**
 * LA ESCALERA DEL COSTO. Cada peldaño es menos gente y más caro: ver juntos
 * "S/7.98 por lead" y "S/127.75 por demo" es lo que hace evidente dónde se
 * pierde la plata, cosa que el costo por lead solo nunca dice.
 */
function EscaleraCosto({ r }: { r: Reporte }) {
  const t = r.totales;
  const a = r.anterior ?? null;
  const peldanos = [
    { titulo: "Leads de anuncios", n: t.leadsDeAnuncios, nA: a?.leadsDeAnuncios, costo: t.costoPorLeadCentavos, costoA: a?.costoPorLeadCentavos, nota: `${t.leads} en total` },
    { titulo: "Respondieron", n: t.respondieron, nA: a?.respondieron, costo: null, costoA: null, nota: `${pct(t.respondieron, t.leads)} de los leads` },
    { titulo: "Interesados", n: t.interesados, nA: a?.interesados, costo: t.costoPorInteresadoCentavos, costoA: a?.costoPorInteresadoCentavos, nota: `${t.calientes} calientes` },
    { titulo: "Demos", n: t.demos, nA: a?.demos, costo: t.costoPorDemoCentavos, costoA: a?.costoPorDemoCentavos, nota: pct(t.demos, t.leads) + " de los leads" },
    // VENTA = PAGÓ (2026-10-07), no "ganado": se marca en la ficha del lead.
    { titulo: "Ventas pagadas", n: t.ventas, nA: a?.ventas, costo: t.costoPorVentaCentavos, costoA: a?.costoPorVentaCentavos,
      nota: t.ingresosCentavos ? `${soles(t.ingresosCentavos)} ingresos${t.retorno ? ` · ${t.retorno}x` : ""}` : "Se marcan en la ficha del lead" },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
      <div className="rounded-tarjeta bg-superficie-honda p-5 text-carta shadow-[var(--sombra-tarjeta)]">
        <p className="text-[0.8rem] text-carta/70">Invertido</p>
        <p className="mt-1 text-[2rem] font-bold leading-none tabular-nums">{soles(t.invertidoCentavos)}</p>
        <p className="mt-2 text-[0.76rem] text-carta/70">
          Meta {soles(t.invertidoMetaCentavos)}
          {t.invertidoGoogleCentavos !== null && ` · Google ${soles(t.invertidoGoogleCentavos)}`}
        </p>
        {a && (
          <p className="mt-2 text-[0.74rem] text-carta/70">
            Antes: {soles(a.invertidoCentavos)}
            {r.periodoAnterior && ` (${fechaCorta(r.periodoAnterior.desde)} – ${fechaCorta(r.periodoAnterior.hasta)})`}
          </p>
        )}
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Costo por etapa">
        {peldanos.map((p) => (
          <li key={p.titulo} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
            <p className="text-[0.76rem] font-semibold text-frio">{p.titulo}</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[1.6rem] font-bold leading-none tabular-nums text-tinta">{p.n}</span>
              <Cambio actual={p.n} previo={p.nA} />
            </p>
            {p.costo !== null && (
              <p className="mt-2 flex items-baseline gap-1.5 text-[0.8rem] tabular-nums text-tinta-2">
                <span><b className="text-brasa-texto">{soles(p.costo)}</b> c/u</span>
                <Cambio actual={p.costo} previo={p.costoA} menosEsMejor />
              </p>
            )}
            <p className="mt-1 text-[0.72rem] text-frio">{p.nota}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Anuncios con campaña, conjunto y fechas; al tocarlos, sus leads. */
function TablaAnuncios({ anuncios, porId }: { anuncios: AnuncioReporte[]; porId: Map<string, LeadReporte> }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (anuncios.length === 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios</h3>
        <p className="mt-1 text-[0.85rem] text-frio">No hubo anuncios con gasto ni leads en este período.</p>
      </div>
    );
  }
  return (
    <div className="rounded-tarjeta bg-carta ring-1 ring-linea">
      <div className="border-b border-linea px-5 py-4">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios</h3>
        <p className="mt-0.5 text-[0.8rem] text-frio">
          Ordenados por demos. Toca uno para ver quiénes llegaron por él.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[0.86rem]">
          <thead>
            <tr className="border-b border-linea text-left text-[0.76rem] text-frio">
              <th scope="col" className="px-5 py-2.5 font-semibold">Anuncio</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Gasto</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Conv. Meta</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Leads</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Respondieron</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Calientes</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Demos</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">S/ por lead</th>
              <th scope="col" className="px-5 py-2.5 text-right font-semibold">S/ por demo</th>
            </tr>
          </thead>
          <tbody>
            {anuncios.map((a) => {
              const abre = abierto === a.adId;
              const sinDemos = a.demos === 0 && a.gastoCentavos > 0 && a.leads >= 5;
              return (
                <Fragment key={a.adId}>
                  <tr
                    className={`cursor-pointer border-b border-linea/60 transition hover:bg-arena/40 ${abre ? "bg-arena/40" : ""}`}
                    onClick={() => setAbierto(abre ? null : a.adId)}
                  >
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <button
                        type="button"
                        aria-expanded={abre}
                        className="flex w-full min-w-0 items-start gap-2 text-left focus-visible:outline-2 focus-visible:outline-brasa"
                      >
                        <span aria-hidden className={`mt-0.5 text-frio transition ${abre ? "rotate-90" : ""}`}>›</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <PuntoSemaforo s={a.semaforo} />
                            <ChipPlataforma plataforma={a.plataforma} />
                            <span className="truncate font-semibold text-tinta">{a.nombre}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[0.76rem] text-frio">
                            {[a.campania, a.conjunto].filter(Boolean).join(" · ") || "Sin campaña registrada"}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[0.72rem] text-frio">
                            <span
                              className={`rounded-chip px-1.5 py-px font-bold ${a.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"}`}
                            >
                              {a.activo ? "Activo" : "Detenido"}
                            </span>
                            <ChipCansancio nivel={a.cansancio?.nivel} motivo={a.cansancio?.motivo} />
                            {a.desde && <span>{fechaCorta(a.desde)} → {fechaCorta(a.hasta)}</span>}
                          </span>
                        </span>
                      </button>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">{soles(a.gastoCentavos)}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">{a.conversacionesMeta || "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-tinta">{a.leads}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">
                      {a.respondieron} <span className="text-[0.72rem] text-frio">({pct(a.respondieron, a.leads)})</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">{a.calientes}</td>
                    <td className={`px-3 py-3 text-right font-bold tabular-nums ${a.demos > 0 ? "text-ok" : sinDemos ? "text-calor-hondo" : "text-tinta-2"}`}>
                      {a.demos}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">{soles(a.costoPorLeadCentavos)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-tinta">{soles(a.costoPorDemoCentavos)}</td>
                  </tr>
                  {abre && (
                    <tr className="border-b border-linea/60 bg-arena/25">
                      <td colSpan={9} className="px-5 py-3">
                        <DetalleAnuncio a={a} leads={a.leadIds.map((id) => porId.get(id)).filter((l): l is LeadReporte => !!l)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetalleAnuncio({ a, leads }: { a: AnuncioReporte; leads: LeadReporte[] }) {
  const ctr = a.impresiones > 0 ? ((a.clics / a.impresiones) * 100).toFixed(2) : null;
  return (
    <div className="space-y-3">
      <p className="text-[0.78rem] text-frio">
        {a.impresiones.toLocaleString("es-PE")} impresiones · {a.clics.toLocaleString("es-PE")} clics
        {ctr && ` (${ctr} % de clics)`}
        {a.conversacionesMeta > 0 && ` · Meta contó ${a.conversacionesMeta} conversaciones; aquí llegaron ${a.leads}`}
        {` · Id ${a.adId}`}
      </p>
      {/* DEL REPORTE AL ANUNCIO (2026-10-09): ver que un anuncio no rinde y
          tener que ir a buscarlo a Marketing era el paso que nadie daba.
          Solo Meta: Google y TikTok se gestionan en su propia plataforma. */}
      {(!a.plataforma || a.plataforma === "meta") && (
        <Link
          href={urlGestionarAnuncio(a.adId)}
          className="inline-flex rounded-chip bg-carta px-3 py-1.5 text-[0.78rem] font-bold text-brasa-texto ring-1 ring-linea transition hover:bg-arena"
        >
          Gestionar anuncio →
        </Link>
      )}
      {a.cansancio?.motivo && (
        <p className="text-[0.8rem] text-calor-hondo">Cansancio: {a.cansancio.motivo}</p>
      )}
      {a.atencion && a.atencion.alEquipo > 0 && (
        <p className="text-[0.8rem] text-tinta-2">
          Equipo: {a.atencion.alEquipo} pidieron a una persona · respuesta en {tiempoRespuesta(a.atencion.medianaRespuestaMin)} (mediana)
          {a.atencion.seEnfriaron > 0 && <b className="text-calor-hondo"> · {a.atencion.seEnfriaron} sin respuesta</b>}
        </p>
      )}
      {(a.objeciones ?? []).length > 0 && (
        <p className="text-[0.8rem] text-tinta-2">Lo que frena a sus leads: {a.objeciones!.map((o) => `${o.clave} (${o.leads})`).join(", ")}</p>
      )}
      {leads.length === 0 ? (
        <p className="text-[0.84rem] text-frio">Este anuncio gastó pero no trajo leads en el período.</p>
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {leads.map((l) => <MiniLead key={l.id} l={l} />)}
        </ul>
      )}
    </div>
  );
}

function MiniLead({ l }: { l: LeadReporte }) {
  const n = NIVEL[l.nivel] ?? NIVEL.frio;
  const cuerpo = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-semibold text-tinta">{l.nombre?.trim() || "Sin nombre"}</span>
        <span className="flex shrink-0 items-center gap-1">
          {l.demo && <span className="rounded-chip bg-ok/12 px-1.5 py-px text-[0.68rem] font-bold text-ok">Demo</span>}
          <span className={`rounded-chip px-1.5 py-px text-[0.68rem] font-bold ${n.clase}`}>{n.label}</span>
        </span>
      </span>
      <span className="mt-0.5 block text-[0.72rem] text-frio">
        {fechaHora(l.creadoEn)} · {l.mensajesDelCliente} {l.mensajesDelCliente === 1 ? "mensaje" : "mensajes"}
      </span>
      {l.resumen && <span className="mt-1 line-clamp-2 block text-[0.8rem] leading-snug text-tinta-2">{l.resumen}</span>}
    </>
  );
  const clase = "block rounded-lg bg-carta px-3 py-2 ring-1 ring-linea";
  return (
    <li>
      <LinkLead id={l.id} className={`${clase} transition hover:ring-brasa/50`} claseSinPermiso={clase}>{cuerpo}</LinkLead>
    </li>
  );
}

function Grupos({ titulo, grupos }: { titulo: string; grupos: GrupoReporte[] }) {
  const max = Math.max(1, ...grupos.map((g) => g.leads));
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">{titulo}</p>
      {grupos.length === 0 ? (
        <p className="mt-2 text-[0.85rem] text-frio">Sin datos en el período.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {grupos.slice(0, 10).map((g) => (
            <li key={g.clave}>
              <div className="flex items-baseline justify-between gap-2 text-[0.86rem]">
                <span className="truncate font-medium text-tinta">{g.clave}</span>
                <span className="shrink-0 tabular-nums text-frio">
                  <b className="text-tinta">{g.leads}</b> · {g.calientes} 🔥 · {g.demos} demos
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-arena">
                <div className="h-full rounded bg-brasa/70" style={{ width: `${Math.round((g.leads / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Qué días escriben: para concentrar presupuesto y gente que atienda. */
function PorDia({ dias }: { dias: Reporte["porDiaSemana"] }) {
  const max = Math.max(1, ...dias.map((d) => d.leads));
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Qué días escriben</p>
      <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 130 }}>
        {ORDEN_DIAS.map((i) => {
          const d = dias[i] ?? { dia: i, leads: 0, calientes: 0 };
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[0.72rem] font-semibold tabular-nums text-tinta-2">{d.leads || ""}</span>
              <div className="flex w-full items-end justify-center" style={{ height: 90 }}>
                <div
                  className="relative w-full max-w-[2rem] overflow-hidden rounded-t-md bg-brasa/60"
                  style={{ height: `${Math.round((d.leads / max) * 100)}%`, minHeight: d.leads > 0 ? 4 : 0 }}
                  title={`${d.leads} leads, ${d.calientes} calientes`}
                >
                  <div className="absolute inset-x-0 bottom-0 bg-calor" style={{ height: d.leads ? `${Math.round((d.calientes / d.leads) * 100)}%` : 0 }} />
                </div>
              </div>
              <span className="text-[0.72rem] text-frio">{DIAS[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-3 text-[0.72rem] text-frio">
        <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-brasa/60" /> Leads</span>
        <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-calor" /> Calientes</span>
      </p>
    </div>
  );
}

type FiltroOrigen = "todos" | "anuncios" | "directo";
type FiltroCalidad = "todos" | "interesados" | "demo" | "pagaron" | "sin_respuesta";

/** Cada lead, uno por fila: el caso concreto detrás de cada número. */
function TablaLeads({ leads, dias, tenant }: { leads: LeadReporte[]; dias: number; tenant?: string }) {
  const [origen, setOrigen] = useState<FiltroOrigen>("todos");
  const [calidad, setCalidad] = useState<FiltroCalidad>("todos");
  const [q, setQ] = useState("");
  const [limite, setLimite] = useState(50);
  const [abierto, setAbierto] = useState<string | null>(null);
  // El teléfono no lo ve el puesto de marketing: para medir anuncios no hace
  // falta, y las conversaciones las atiende ventas.
  const verTelefono = puedeAbrirConversacion();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (origen === "anuncios" && l.plataforma === "directo") return false;
      if (origen === "directo" && l.plataforma !== "directo") return false;
      if (calidad === "interesados" && l.nivel !== "tibio" && l.nivel !== "caliente") return false;
      if (calidad === "demo" && !l.demo) return false;
      if (calidad === "sin_respuesta" && l.mensajesDelCliente > 1) return false;
      if (calidad === "pagaron" && !l.venta) return false;
      if (t && ![l.nombre, l.origen, l.campania, l.conjunto, l.resumen, l.especialidad, l.ciudad]
        .some((x) => (x ?? "").toLowerCase().includes(t))) return false;
      return true;
    });
  }, [leads, origen, calidad, q]);

  const chip = (activo: boolean) =>
    `rounded-chip px-3 py-1.5 text-[0.78rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-brasa ${
      activo ? "bg-tinta text-carta" : "bg-arena text-tinta-2 hover:bg-arena-2"
    }`;

  return (
    <div className="rounded-tarjeta bg-carta ring-1 ring-linea">
      <div className="space-y-3 border-b border-linea px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-[1.05rem] font-bold text-tinta">Cada lead</h3>
            <p className="mt-0.5 text-[0.8rem] text-frio">{visibles.length} de {leads.length} en {dias} días</p>
          </div>
          <CrearPublico ids={visibles.map((l) => l.id)} puede={verTelefono} tenant={tenant} />
        </div>
        <div className="flex flex-wrap gap-2">
          {([["todos", "Todos"], ["anuncios", "De anuncios"], ["directo", "Sin anuncio"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={origen === id} onClick={() => setOrigen(id)} className={chip(origen === id)}>{label}</button>
          ))}
          <span aria-hidden className="mx-1 w-px self-stretch bg-linea" />
          {([["todos", "Cualquier nivel"], ["interesados", "Interesados"], ["demo", "Con demo"], ["pagaron", "Pagaron"], ["sin_respuesta", "No respondieron"]] as const).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={calidad === id} onClick={() => setCalidad(id)} className={chip(calidad === id)}>{label}</button>
          ))}
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar nombre, anuncio, especialidad…"
            aria-label="Buscar leads"
            className="min-w-[14rem] flex-1 rounded-chip bg-arena/60 px-3 py-1.5 text-[0.82rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="px-5 py-6 text-center text-[0.88rem] text-frio">Ningún lead coincide con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[0.84rem]">
            <thead>
              <tr className="border-b border-linea text-left text-[0.76rem] text-frio">
                <th scope="col" className="px-5 py-2.5 font-semibold">Lead</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">De dónde vino</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Costo aprox.</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Cómo va</th>
                <th scope="col" className="px-5 py-2.5 font-semibold">Resumen</th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(0, limite).map((l) => {
                const n = NIVEL[l.nivel] ?? NIVEL.frio;
                const abre = abierto === l.id;
                return (
                  <tr key={l.id} className="border-b border-linea/60 align-top last:border-0">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <LinkLead id={l.id} tenant={tenant} className="font-semibold text-tinta hover:text-brasa-texto" claseSinPermiso="font-semibold text-tinta">
                        {l.nombre?.trim() || "Sin nombre"}
                      </LinkLead>
                      <span className="mt-0.5 block text-[0.72rem] text-frio">{fechaHora(l.creadoEn)}</span>
                      {verTelefono && l.telefono && <span className="block text-[0.72rem] tabular-nums text-frio">{l.telefono}</span>}
                      {/* Llamar o escribirle sin copiar el número (2026-10-09). */}
                      {verTelefono && l.telefono && (
                        <span className="mt-1 block"><AccionesContacto telefono={l.telefono} compacto /></span>
                      )}
                      {(l.especialidad || l.ciudad) && (
                        <span className="block text-[0.72rem] text-frio">{[l.especialidad, l.ciudad].filter(Boolean).join(" · ")}</span>
                      )}
                    </th>
                    <td className="max-w-[16rem] px-3 py-3">
                      <span className="flex items-center gap-1.5">
                        {l.plataforma !== "directo" && <ChipPlataforma plataforma={l.plataforma} />}
                        <span className="truncate font-medium text-tinta">{l.origen}</span>
                      </span>
                      {(l.campania || l.conjunto) && (
                        <span className="mt-0.5 block truncate text-[0.72rem] text-frio">
                          {[l.campania, l.conjunto].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-tinta-2">
                      {l.costoCentavos !== null ? soles(l.costoCentavos) : l.plataforma === "directo" ? "Gratis" : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        <span className={`rounded-chip px-1.5 py-px text-[0.7rem] font-bold ${n.clase}`}>{n.label}</span>
                        {l.demo && <span className="rounded-chip bg-ok/12 px-1.5 py-px text-[0.7rem] font-bold text-ok">Demo {fechaCorta(l.demo)}</span>}
                        {l.venta && <span className="rounded-chip bg-ok px-1.5 py-px text-[0.7rem] font-bold text-carta">Pagó{l.ventaCentavos ? ` ${soles(l.ventaCentavos)}` : ""}</span>}
                        {l.atencion?.seEnfrio && <span className="rounded-chip bg-calor/15 px-1.5 py-px text-[0.7rem] font-bold text-calor-hondo">Sin respuesta del equipo</span>}
                      </span>
                      <span className="mt-1 block text-[0.72rem] text-frio">
                        {ESTADO[l.estado] ?? l.estado} · {l.mensajesDelCliente <= 1 ? "no respondió" : `${l.mensajesDelCliente} mensajes`}
                      </span>
                    </td>
                    <td className="max-w-[24rem] px-5 py-3">
                      {l.resumen ? (
                        <button
                          type="button"
                          onClick={() => setAbierto(abre ? null : l.id)}
                          aria-expanded={abre}
                          className={`text-left text-[0.8rem] leading-snug text-tinta-2 focus-visible:outline-2 focus-visible:outline-brasa ${abre ? "" : "line-clamp-2"}`}
                        >
                          {l.resumen}
                        </button>
                      ) : (
                        <span className="text-[0.78rem] text-frio">Sin resumen todavía</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {visibles.length > limite && (
        <div className="border-t border-linea px-5 py-3">
          <button type="button" onClick={() => setLimite((n) => n + 50)} className="rounded-chip bg-arena px-3 py-2 text-[0.8rem] font-semibold text-tinta-2">
            Ver 50 más ({visibles.length - limite} restantes)
          </button>
        </div>
      )}
    </div>
  );
}
