"use client";
import Link from "next/link";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  obtenerComisiones, actualizarComision, type Comision,
  obtenerReporteNegocio, obtenerReporteGlobal, obtenerMiPlan,
  type ReporteNegocio, type ReporteGlobal,
} from "@/lib/api";
import { SkeletonReportes } from "@/components/Skeletons";
import { BloqueoPlan } from "@/components/panel/BloqueoPlan";

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
  caliente: { label: "🔥 Calientes", color: "text-brasa-hondo" },
  tibio: { label: "🌤 Tibios", color: "text-tibio" },
  frio: { label: "❄️ Fríos", color: "text-frio" },
};
// Nombre corto del mes desde "YYYY-MM".
const mesCorto = (ym: string) => {
  const m = Number(ym.split("-")[1]);
  return ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"][m - 1] ?? ym;
};

export default function ReportesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [rep, setRep] = useState<ReporteNegocio | null>(null);
  const [global, setGlobal] = useState<ReporteGlobal | null>(null);
  const [avanzados, setAvanzados] = useState<boolean | null>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
    obtenerMiPlan().then((p) => setAvanzados(p?.features?.reportesAvanzados ?? false));
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
    } catch (err) {
      setError("No pudimos cargar los reportes. Recargá.");
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
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tus ventas</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Reportes</h1>
      </header>

      {cargando ? (
        <SkeletonReportes />
      ) : error ? (
        <div className="rounded-tarjeta bg-brasa/10 px-4 py-3 text-center text-[0.9rem] font-semibold text-brasa">{error}</div>
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
              <Link href="/configuracion" className="mt-4 inline-flex rounded-tarjeta bg-brasa px-5 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo">
                Mejorá tu plan
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
              <div className="rounded-tarjeta bg-brasa p-5 text-carta shadow-[var(--sombra-tarjeta)]">
                <p className="text-[0.8rem] text-carta/70">Por cobrar</p>
                <p className="mt-1 text-[2rem] font-bold leading-none">{soles(rep.comisiones.porCobrar)}</p>
              </div>
              <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <p className="text-[0.8rem] text-frio">Tasa de cierre</p>
                <p className="mt-1 text-[2rem] font-bold leading-none text-tinta">{Math.round(rep.cierre.tasa * 100)}%</p>
                <p className="mt-1 text-[0.72rem] text-frio">{rep.cierre.ganados} ganados · {rep.cierre.perdidos} perdidos</p>
              </div>
              <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <p className="text-[0.8rem] text-frio">En juego</p>
                <p className="mt-1 text-[2rem] font-bold leading-none text-tinta">{rep.cierre.enJuego}</p>
                <p className="mt-1 text-[0.72rem] text-frio">leads sin cerrar</p>
              </div>
            </div>
          )}

          {/* Evolución mensual + leads por nivel */}
          {rep && (
            <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
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
              <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Leads por nivel</p>
                <div className="space-y-2.5">
                  {["caliente", "tibio", "frio"].map((k) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className={`text-[0.92rem] font-medium ${NIVEL[k].color}`}>{NIVEL[k].label}</span>
                      <span className="text-[1rem] font-bold text-tinta tabular-nums">{rep.leadsPorNivel[k] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* De dónde vienen los leads (origen: ads, comentarios, directo) */}
          {rep && rep.leadsPorOrigen && Object.keys(rep.leadsPorOrigen).length > 0 && (
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">De dónde vienen tus leads</p>
              <div className="space-y-2">
                {Object.entries(rep.leadsPorOrigen)
                  .sort((a, b) => b[1] - a[1])
                  .map(([origen, n]) => {
                    const esAd = origen.startsWith("ad:");
                    const label = esAd ? `📣 ${origen.slice(3)}` : origen === "comentario" ? "💬 Comentarios" : "💬 Mensaje directo";
                    return (
                      <div key={origen} className="flex items-center justify-between rounded-xl bg-arena/40 px-4 py-2.5">
                        <span className="text-[0.9rem] font-medium text-tinta-2">{label}</span>
                        <span className="text-[1rem] font-bold text-tinta tabular-nums">{n}</span>
                      </div>
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
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
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
                      {n.porCobrar > 0 && <p className="text-[0.72rem] text-brasa">+ {soles(n.porCobrar)} por cobrar</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabla de comisiones del negocio actual */}
          {comisiones.length === 0 ? (
            <div className="rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
              <p className="text-[1.1rem] font-semibold text-tinta">Aún no tenés ventas registradas</p>
              <p className="mt-2 text-[0.95rem] text-tinta-2">Cuando cierres tu primer lead, vas a ver tus comisiones acá.</p>
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
                        <td className="px-6 py-3.5 text-[0.95rem] font-semibold text-tinta">{c.lead?.nombre?.trim() || "Sin nombre"}</td>
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
