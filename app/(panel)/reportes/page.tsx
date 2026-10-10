"use client";
import Link from "next/link";

import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, rolEnEmpresaActiva, leerEmpresaActiva, tieneVariosNegocios } from "@/lib/auth";
import {
  obtenerComisiones, actualizarComision, type Comision,
  obtenerReporteNegocio, obtenerReporteGlobal, miPlanCacheado, origenDeLeads,
  type ReporteNegocio, type ReporteGlobal, type FilaOrigenLeads,
} from "@/lib/api";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { LinkLead } from "@/components/LinkLead";
import { ChipPlataforma } from "@/components/panel/OrigenLead";
import {
  ESTADO_ABIERTOS, TEXTO_MEJORAR_PLAN, URL_MI_PLAN, urlLeads, urlSeguimiento,
} from "@/lib/enlaces";
import { SkeletonReportes } from "@/components/Skeletons";
import { SeccionPorNegocio } from "@/components/panel/GlobalNegocios";
import { HeroSeccion, ReportesIlustracion } from "@/components/panel/HeroSeccion";
import { ReporteMarketing } from "@/components/panel/ReporteMarketing";

const soles = (n: number) => `S/${n.toLocaleString("es-PE")}`;

const estadoColor: Record<string, string> = {
  pagada: "bg-ok/15 text-ok",
  pendiente: "bg-brasa/15 text-brasa",
  por_cobrar: "bg-tibio-suave text-tinta-2",
};
const estadoLabel: Record<string, string> = {
  pagada: "Pagada", pendiente: "Pendiente", por_cobrar: "Por cobrar",
};
const NIVEL: Record<string, { label: string; color: string }> = {
  caliente: { label: "🔥 Calientes", color: "text-calor-hondo" },
  tibio: { label: "🌤 Tibios", color: "text-tibio" },
  frio: { label: "❄️ Fríos", color: "text-frio" },
};
// Nombre corto del mes desde "YYYY-MM".
const mesCorto = (ym: string) => {
  const m = Number(ym.split("-")[1]);
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"][m - 1] ?? ym;
};

/**
 * CADA ESCALÓN DEL EMBUDO LLEVA A SUS LEADS EN SEGUIMIENTO (2026-10-09). El
 * embudo del reporte habla de "conversaron", "atendidos", "cerraron"; en
 * Seguimiento esas son las columnas En seguimiento, Para atender y Ganados.
 * "Escribieron" es todos: abre el tablero sin resaltar nada.
 */
const ETAPA_DEL_ESCALON: Record<string, string | undefined> = {
  escribieron: undefined,
  conversaron: "nutriendo",
  atendidos: "escalado",
  cerraron: "ganado",
};

/** Con varios negocios, la lista de leads abre en ESTE (Reportes es de uno). */
const negocioDeReportes = () => (tieneVariosNegocios() ? leerEmpresaActiva() : null);

function ReportesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [rep, setRep] = useState<ReporteNegocio | null>(null);
  const [global, setGlobal] = useState<ReporteGlobal | null>(null);
  const [avanzados, setAvanzados] = useState<boolean | null>(null);

  // Los nombres de los anuncios para "De dónde vienen tus leads": el reporte
  // de negocio trae la etiqueta cruda (`ad:1202559…`), ilegible.
  const [origenes, setOrigenes] = useState<FilaOrigenLeads[]>([]);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
    // El plan va por la caché compartida: Marketing y Equipo preguntan lo mismo.
    miPlanCacheado().then((p) => setAvanzados(p?.features?.reportesAvanzados ?? false)).catch(() => setAvanzados(false));
  }, [router]);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const [{ items }, r, g] = await Promise.all([
        obtenerComisiones(),
        obtenerReporteNegocio(),
        obtenerReporteGlobal(),
      ]);
      setComisiones(items);
      setRep(r);
      setGlobal(g);
      // Best-effort: sin nombres se muestra "Anuncio" en vez del id crudo.
      origenDeLeads(90).then(setOrigenes).catch(() => setOrigenes([]));
    } catch (err) {
      setError("No pudimos cargar los reportes.");
      console.error(err);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { if (listo) cargar(); }, [listo, cargar]);

  async function marcarCobrada(id: string) {
    const r = await actualizarComision(id, "pagada");
    if (r.ok) cargar();
  }

  if (!listo) return null;

  // Pico de la evolución (para escalar las barras).
  const maxEvo = rep ? Math.max(1, ...rep.evolucion.map((e) => e.comisiones)) : 1;
  // ¿Vale mostrar el resumen global? Solo si el usuario tiene más de un negocio.
  const mostrarGlobal = !!global && global.negocios.length > 1;

  return (
    <div className="space-y-6">
      {cargando ? (
        <SkeletonReportes />
      ) : error ? (
        <ErrorConReintento mensaje={error} reintentar={cargar} />
      ) : (
        <div className="space-y-6">
          {/* Reportes avanzados bloqueados por plan: candado compacto (las
              comisiones basicas de abajo siguen visibles para todos). */}
          {avanzados === false && (
            <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
              <span className="text-2xl">🔒</span>
              <p className="mt-2 text-[1rem] font-bold text-tinta">Reportes avanzados</p>
              <p className="mt-1 text-[0.88rem] text-frio">
                Tasa de cierre, evolución mensual y comisiones por negocio están desde el plan Emprende.
              </p>
              <Link href={URL_MI_PLAN} className="mt-4 inline-flex rounded-tarjeta bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo">
                {TEXTO_MEJORAR_PLAN}
              </Link>
            </div>
          )}

          {/* KPIs del negocio */}
          {rep && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-tarjeta bg-superficie-honda p-5 text-carta shadow-[var(--sombra-tarjeta)]">
                <p className="text-[0.8rem] text-carta/70">Comisiones ganadas</p>
                <p className="mt-1 text-[2rem] font-bold leading-none">{soles(rep.comisiones.ganada)}</p>
              </div>
              <div className="rounded-tarjeta bg-brasa p-5 text-sobre-brasa shadow-[var(--sombra-tarjeta)]">
                {/* text-sobre-brasa/75 y no text-carta/70: ese token es del
                    fondo verde hondo — acá sobre naranja quedaba sucio. */}
                <p className="text-[0.8rem] text-sobre-brasa/75">Por cobrar</p>
                <p className="mt-1 text-[2rem] font-bold leading-none">{soles(rep.comisiones.porCobrar)}</p>
              </div>
              {/* Los KPIs de leads abren su lista (2026-10-09). */}
              <Link
                href={urlLeads({ estado: "ganado", negocio: negocioDeReportes() })}
                className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea transition hover:ring-brasa/40"
              >
                <p className="text-[0.8rem] text-frio">Tasa de cierre</p>
                <p className="mt-1 text-[2rem] font-bold leading-none text-tinta">{Math.round(rep.cierre.tasa * 100)}%</p>
                <p className="mt-1 text-[0.72rem] text-frio">{rep.cierre.ganados} ganados · {rep.cierre.perdidos} perdidos ›</p>
              </Link>
              <Link
                href={urlLeads({ estado: ESTADO_ABIERTOS, negocio: negocioDeReportes() })}
                className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea transition hover:ring-brasa/40"
              >
                <p className="text-[0.8rem] text-frio">En juego</p>
                <p className="mt-1 text-[2rem] font-bold leading-none text-tinta">{rep.cierre.enJuego}</p>
                <p className="mt-1 text-[0.72rem] text-frio">leads sin cerrar ›</p>
              </Link>
            </div>
          )}

          {/* Embudo: DÓNDE se caen las ventas.
              Va antes de la evolución mensual a propósito — "cuánto gané" ya
              está arriba; esto responde "por qué no gané más", que es lo que
              el dueño puede accionar hoy. */}
          {rep && rep.embudo?.length > 0 && rep.embudo[0].quedan > 0 && (
            // ring-brasa/40 y no ring-linea: es el ÚNICO bloque accionable de
            // la página (el porqué no ganaste más) y pesaba igual que los
            // informativos (pasada UX 2026-09-06).
            <div className="entra rounded-tarjeta bg-carta p-5 ring-2 ring-brasa/40">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <p className="text-[0.85rem] font-bold uppercase tracking-wide text-brasa-texto">🎯 Dónde se te caen las ventas</p>
                {(() => {
                  // El escalón con la mayor caída ABSOLUTA — no el de peor
                  // porcentaje: perder 40 de 100 duele más que 2 de 3, aunque
                  // el porcentaje diga lo contrario.
                  const peor = rep.embudo.slice(1).reduce((a, b) => (b.seCayeron > a.seCayeron ? b : a));
                  return peor.seCayeron > 0 ? (
                    <span className="text-[0.78rem] font-semibold text-calor">
                      {peor.seCayeron} se pierden en &ldquo;{peor.titulo}&rdquo;
                    </span>
                  ) : null;
                })()}
              </div>
              <div className="mt-4 space-y-3">
                {rep.embudo.map((e, i) => {
                  // El ancho es contra la PRIMERA etapa, para que la barra se
                  // vea angostar; los porcentajes de al lado son contra la
                  // etapa anterior, que es lo accionable.
                  const total = rep.embudo[0].quedan || 1;
                  const ancho = Math.max(2, Math.round((e.quedan / total) * 100));
                  return (
                    <Link key={e.etapa} href={urlSeguimiento(ETAPA_DEL_ESCALON[e.etapa])} className="block rounded-lg transition hover:bg-arena/40">
                      <div className="mb-1 flex items-baseline justify-between gap-2">
                        <span className="text-[0.9rem] font-medium text-tinta">{e.titulo}</span>
                        <span className="text-[0.9rem] font-bold tabular-nums text-tinta">{e.quedan} ›</span>
                      </div>
                      <div className="h-7 w-full overflow-hidden rounded-lg bg-arena-2">
                        <div
                          className="flex h-full items-center rounded-lg bg-brasa px-2 transition-all"
                          style={{ width: `${ancho}%` }}
                        >
                          {i > 0 && ancho > 22 && (
                            <span className="text-[0.72rem] font-bold text-sobre-brasa tabular-nums">
                              {Math.round(e.pasaron * 100)}%
                            </span>
                          )}
                        </div>
                      </div>
                      {e.seCayeron > 0 && (
                        <p className="mt-1 text-[0.74rem] text-frio">
                          se fueron {e.seCayeron} en este paso
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
              <p className="mt-4 text-[0.76rem] leading-relaxed text-frio">
                Cada barra es cuántos llegaron hasta ahí. El porcentaje compara con el paso anterior.
              </p>
            </div>
          )}

          {/* Evolución mensual + leads por nivel */}
          {rep && (
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <div className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Comisiones por mes</p>
                <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
                  {rep.evolucion.map((e) => (
                    <div key={e.mes} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-[0.7rem] font-semibold text-tinta-2">{e.comisiones > 0 ? soles(e.comisiones) : ""}</span>
                      <div className="flex w-full items-end justify-center" style={{ height: 100 }}>
                        <div
                          className="w-full max-w-[2.2rem] rounded-t-lg bg-brasa transition-all"
                          style={{ height: `${Math.round((e.comisiones / maxEvo) * 100)}%`, minHeight: e.comisiones > 0 ? 4 : 0 }}
                        />
                      </div>
                      <span className="text-[0.72rem] text-frio">{mesCorto(e.mes)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Leads por nivel</p>
                <div className="space-y-2.5">
                  {["caliente", "tibio", "frio"].map((k) => (
                    <Link
                      key={k}
                      href={urlLeads({ nivel: k, negocio: negocioDeReportes() })}
                      className="flex items-center justify-between rounded-lg px-1 py-0.5 transition hover:bg-arena/50"
                    >
                      <span className={`text-[0.92rem] font-medium ${NIVEL[k].color}`}>{NIVEL[k].label}</span>
                      <span className="text-[1rem] font-bold text-tinta tabular-nums">{rep.leadsPorNivel[k] ?? 0} ›</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* De dónde vienen los leads (origen: ads, comentarios, directo) */}
          {rep && rep.leadsPorOrigen && Object.keys(rep.leadsPorOrigen).length > 0 && (
            <div className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">De dónde vienen tus leads</p>
              <div className="space-y-2">
                {Object.entries(rep.leadsPorOrigen)
                  .sort((a, b) => b[1] - a[1])
                  .map(([origen, n]) => {
                    // EL NOMBRE DEL ANUNCIO, NO SU ID (2026-10-09): se cruza con
                    // "de dónde te escriben"; sin cruce, "Anuncio" a secas.
                    const esAd = origen.startsWith("ad:");
                    const fila = esAd ? origenes.find((f) => f.adId === origen.slice(3)) : undefined;
                    return (
                      <Link
                        key={origen}
                        href={urlLeads({ origen, negocio: negocioDeReportes() })}
                        className="flex items-center justify-between gap-3 rounded-xl bg-arena/40 px-4 py-2.5 transition hover:bg-arena"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[0.9rem] font-medium text-tinta-2">
                          {esAd ? (
                            <>
                              {fila?.plataforma ? <ChipPlataforma plataforma={fila.plataforma} /> : <span aria-hidden>📣</span>}
                              <span className="truncate">{fila?.etiqueta ?? "Anuncio"}</span>
                            </>
                          ) : origen === "comentario" ? "💬 Comentarios" : "💬 Mensaje directo"}
                        </span>
                        <span className="shrink-0 text-[1rem] font-bold text-tinta tabular-nums">{n} ›</span>
                      </Link>
                    );
                  })}
              </div>
              <p className="mt-3 text-[0.76rem] text-frio">
                Los leads que llegan por tus anuncios aparecen con el nombre de la campaña 📣.
              </p>
            </div>
          )}

          {/* Resumen global: comisiones por negocio (solo si tiene varios) */}
          {mostrarGlobal && global && (
            <div className="entra rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Tus comisiones por negocio</p>
                <p className="text-right text-[0.8rem] text-frio">
                  Total: <b className="text-tinta">{soles(global.totalGanada)}</b> ganado · {soles(global.totalPorCobrar)} por cobrar
                </p>
              </div>
              <div className="space-y-2">
                {global.negocios.map((n) => (
                  <div key={n.tenantId} className="flex items-center justify-between rounded-xl bg-arena/40 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-tinta">{n.nombre}</p>
                      <p className="text-[0.72rem] text-frio">{n.ventas} {n.ventas === 1 ? "venta" : "ventas"}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold text-ok">{soles(n.ganada)}</p>
                      {n.porCobrar > 0 && <p className="text-[0.72rem] text-brasa-texto">+ {soles(n.porCobrar)} por cobrar</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de comisiones del negocio actual */}
          {comisiones.length === 0 ? (
            <div className="rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
              <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-arena text-3xl">📈</span>
              <p className="mt-3 text-[1.1rem] font-semibold text-tinta">Aún no tienes ventas registradas</p>
              <p className="mt-2 text-[0.95rem] text-tinta-2">
                Cuando marques un lead como ganado en Seguimiento, su comisión aparece acá.
              </p>
              <Link
                href="/seguimiento"
                className="mt-4 inline-flex rounded-tarjeta bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
              >
                Ir a mi pipeline
              </Link>
            </div>
          ) : (
            <div className="rounded-tarjeta bg-carta ring-1 ring-linea">
              <p className="border-b border-linea px-6 py-4 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Detalle de comisiones</p>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-linea">
                      <th className="px-6 py-3 text-left text-[0.82rem] font-bold text-tinta-2">Lead</th>
                      <th className="px-6 py-3 text-right text-[0.82rem] font-bold text-tinta-2">Monto</th>
                      <th className="px-6 py-3 text-center text-[0.82rem] font-bold text-tinta-2">Estado</th>
                      <th className="px-6 py-3 text-right text-[0.82rem] font-bold text-tinta-2">Fecha</th>
                      <th className="px-6 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comisiones.map((c) => (
                      <tr key={c.id} className="border-b border-arena last:border-b-0">
                        <td className="px-6 py-3.5 text-[0.95rem] font-semibold text-tinta">
                          {/* El nombre abre la ficha del lead (2026-10-09). */}
                          <LinkLead id={c.leadId} className="hover:text-brasa-texto hover:underline">
                            {c.lead?.nombre?.trim() || "Sin nombre"}
                          </LinkLead>
                        </td>
                        <td className="px-6 py-3.5 text-right text-[0.95rem] font-bold text-tinta">{soles(c.monto)}</td>
                        <td className="px-6 py-3.5 text-center">
                          <span className={`inline-block rounded-chip px-3 py-1.5 text-[0.78rem] font-bold ${estadoColor[c.estado] || "bg-arena text-tinta-2"}`}>
                            {estadoLabel[c.estado] || c.estado}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right text-[0.9rem] text-tinta-2">{new Date(c.creadoEn).toLocaleDateString("es-PE")}</td>
                        <td className="px-6 py-3.5 text-right">
                          {c.estado === "pendiente" && (
                            <button onClick={() => marcarCobrada(c.id)} className="rounded-chip bg-ok/12 px-3 py-1.5 text-[0.78rem] font-bold text-ok transition hover:bg-ok/20">
                              Marcar cobrada
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Pestana = "publicidad" | "ventas";
const sinSuscripcion = () => () => {};

/**
 * REPORTES CON PUBLICIDAD (2026-10-07, Jonathan: "tenemos sección reportes
 * pero está muy vacía"; su marketero: "quiero ver cada lead, de qué publicidad
 * vino y cuánto costó").
 *
 * Dos pestañas: "Publicidad" (el reporte del marketero) y "Ventas y
 * comisiones" (lo que ya había). El puesto de MARKETING ve solo la primera:
 * las rutas de comisiones y reporte de negocio le dan 403 en el backend, y
 * pedirlas igual pintaría un error en vez de un permiso que no tiene.
 */
function Reportes() {
  const router = useRouter();
  const params = useSearchParams();
  // El rol sale del almacenamiento local: en el servidor vale `null` y la
  // pantalla espera a montar, así el primer render coincide con el del server.
  const rol = useSyncExternalStore(sinSuscripcion, () => rolEnEmpresaActiva() ?? "", () => null);
  // LA PESTAÑA EN LA URL (2026-10-09): `?t=ventas` abre "Ventas y comisiones"
  // (el gráfico de Inicio lleva ahí) y el link se puede compartir.
  const [pestana, setPestanaEstado] = useState<Pestana>(() => (params.get("t") === "ventas" ? "ventas" : "publicidad"));
  function setPestana(p: Pestana) {
    setPestanaEstado(p);
    router.replace(`/reportes?t=${p}`, { scroll: false });
  }

  useEffect(() => {
    if (!haySesion()) router.replace("/");
  }, [router]);

  if (rol === null) return null;
  const soloPublicidad = rol === "marketing";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-8">
      <HeroSeccion
        titulo="Cómo te fue, en números"
        bajada={<>Cuánto invertiste, qué anuncio trae clientes de verdad, cuánto entró y dónde se caen las ventas. Sin planillas ni cuentas a mano.</>}
        dibujo={<ReportesIlustracion />}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{soloPublicidad ? "Tu publicidad" : "Tu negocio"}</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Reportes</h1>
        </div>
        {!soloPublicidad && (
          <div role="tablist" aria-label="Tipo de reporte" className="flex gap-1 rounded-chip bg-arena p-1">
            {([["publicidad", "Publicidad"], ["ventas", "Ventas y comisiones"]] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition focus-visible:outline-2 focus-visible:outline-brasa ${
                  pestana === id ? "bg-carta text-tinta shadow-sm" : "text-tinta-2 hover:text-tinta"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </header>

      {soloPublicidad || pestana === "publicidad" ? <ReporteMarketing /> : <ReportesPanel />}
    </div>
  );
}

// Pantalla por-negocio en el panel unificado: chips arriba para elegir el
// negocio (fija la empresa activa y remonta el contenido — ver
// SeccionPorNegocio).
export default function ReportesPanelPorNegocio() {
  // useSearchParams exige Suspense en el prerender de Next (App Router).
  return (
    <Suspense fallback={null}>
      <SeccionPorNegocio>
        <Reportes />
      </SeccionPorNegocio>
    </Suspense>
  );
}
