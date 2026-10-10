"use client";

import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";
import { urlLeadsDeAnuncio } from "@/lib/enlaces";
import { rendimientoAds, type RendimientoAds, type Desglose, type FilaRanking } from "@/lib/api";
import { ErrorMarketing, importeMarketing, periodoCoincide, type MetadatosMarketing, useLecturaMarketing } from "./marketing-lectura";

/**
 * QUÉ PUBLICIDAD FUNCIONÓ (2026-09-17, pedido de Jonathan: "un top para ver
 * cuáles son mejores, qué segmentación, qué hora, qué alcance").
 *
 * Dos preguntas distintas y las dos hacen falta:
 *
 *  · El TOP dice qué anuncio rinde, y su tendencia dice si sigue rindiendo. Un
 *    anuncio con buen promedio que cayó esta semana hay que cambiarlo, y el
 *    acumulado de Meta esconde justamente eso.
 *  · Los DESGLOSES dicen a qué hora, a qué edad y en qué red conviene gastar.
 *    Es lo que convierte "gasté S/22" en "gastá más los martes a las 8pm".
 *
 * Ordena por CTR y no por gasto: es lo único que compara un anuncio de S/2 con
 * uno de S/200 sin que el presupuesto decida quién gana.
 */
export function RendimientoAnuncios({ tenant, dias = 30 }: { tenant?: string; dias?: number } = {}) {
  const cargar = useCallback(() => rendimientoAds(dias, tenant), [dias, tenant]);
  const { datos: r, cargando, error, reintentar } = useLecturaMarketing<(RendimientoAds & MetadatosMarketing) | null>(`${tenant}:${dias}`, cargar);
  const id = useId();
  const tabs = useRef<Partial<Record<"hora" | "edad" | "red" | "zona", HTMLButtonElement | null>>>({});
  const [vista, setVista] = useState<"hora" | "edad" | "red" | "zona">("hora");
  if (error) return <ErrorMarketing mensaje={error} reintentar={reintentar} />;

  if (cargando) return <div className="h-52 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!r) return <ErrorMarketing mensaje="El rendimiento no está disponible. Inténtalo de nuevo." reintentar={reintentar} />;
  if (!periodoCoincide(r, dias)) return <ErrorMarketing mensaje="No se pudo confirmar el periodo del rendimiento. Vuelve a consultarlo para evitar comparar fechas distintas." reintentar={reintentar} />;

  const hayTop = r.ranking.length > 0;
  const d = r.desgloses;
  const listas: Record<typeof vista, Desglose[]> = {
    hora: d?.porHora ?? [],
    edad: d?.porEdad ?? [],
    red: d?.porRed ?? [],
    zona: d?.porZona ?? [],
  };
  const visibles = (["hora", "edad", "red", "zona"] as const).filter((k) => listas[k].length > 0);
  const seleccion = listas[vista].length ? vista : visibles[0] ?? "hora";
  const actual = listas[seleccion];
  const maximo = Math.max(...actual.map((y) => y.ctr), 0.01);
  const hayDesglose = Object.values(listas).some((l) => l.length > 0);

  if (!hayTop && !hayDesglose) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Qué publicidad funcionó</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          No hay datos de rendimiento para este periodo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[1.05rem] font-bold text-tinta">Qué publicidad funcionó</h3>
        <span className="text-sm text-frio">Últimos {dias} días</span>
      </div>

      {/* EL TOP. La tendencia es la mitad del valor: sin ella el dueño sube el
          presupuesto de algo que venía cayendo. */}
      {hayTop && (
        <div className="mt-6">
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Tus mejores anuncios
          </p>
          {/* QUE SIGNIFICA EL ORDEN (2026-09-18): antes ordenaba por CTR y eso
              premiaba al que llama la atencion, no al que trae clientes. Se
              dice explicito porque un ranking sin criterio visible se lee como
              arbitrario. */}
          <p className="mt-1 text-[0.8rem] text-frio">
            Ordenados por cuánta gente te escribió, no por cuántos lo miraron.
          </p>
          <div className="mt-3 space-y-2.5">
            {r.ranking.slice(0, 5).map((a, i) => (
              <FilaAnuncio key={a.anuncioId} a={a} puesto={i + 1} moneda={r.moneda} tenant={tenant} />
            ))}
          </div>
        </div>
      )}

      {/* LOS DESGLOSES. Una pestaña por pregunta, porque mostrar las cuatro
          listas juntas son cuarenta filas que nadie lee. */}
      {hayDesglose && (
        <div className="mt-7 border-t border-linea pt-5">
          <div role="tablist" aria-label="Desgloses de rendimiento" className="flex flex-wrap gap-1.5">
            {([
              ["hora", "Por hora"],
              ["edad", "Por edad"],
              ["red", "Por red"],
              ["zona", "Por zona"],
            ] as const).map(([k, etiqueta]) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`${id}-${k}`}
                aria-selected={seleccion === k}
                aria-controls={`${id}-panel`}
                tabIndex={seleccion === k ? 0 : -1}
                ref={(el) => { tabs.current[k] = el; }}
                onClick={() => setVista(k)}
                onKeyDown={(e) => {
                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
                  e.preventDefault();
                  const i = visibles.indexOf(k);
                  const siguiente = e.key === "Home" ? visibles[0] : e.key === "End" ? visibles[visibles.length - 1] : visibles[(i + (e.key === "ArrowRight" ? 1 : -1) + visibles.length) % visibles.length];
                  if (siguiente) { setVista(siguiente); tabs.current[siguiente]?.focus(); }
                }}
                disabled={listas[k].length === 0}
                className={`rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold transition disabled:opacity-40 ${
                  seleccion === k ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${seleccion}`} tabIndex={0} className="mt-3 space-y-1.5">
            <p className="mb-3 text-sm text-frio">{ayuda(seleccion)} Son hipótesis para investigar; el CTR por sí solo no demuestra ventas ni justifica cambiar presupuesto.</p>
            {actual.map((x) => (
              <Barra key={x.etiqueta} d={x} maximo={maximo} moneda={r.moneda} />
            ))}
            {actual.length === 0 && (
              <p className="py-3 text-center text-[0.82rem] text-frio">Sin datos todavía.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * UN ANUNCIO DEL RANKING (2026-09-18, pedido de Jonathan: "ordena bien, dale
 * espacio, que no se vea apretado").
 *
 * Antes eran cuatro datos seguidos en una sola linea de 0.76rem --"1.4% lo
 * toco · 8 clics · S/10.58 · 2 dias"-- donde nada pesaba mas que lo demas y
 * habia que leerla entera para encontrar lo que importaba.
 *
 * Ahora el dato que decide va PRIMERO y en grande: cuanta gente escribio. Lo
 * demas baja a una linea de contexto, que se mira solo si hace falta.
 */
function FilaAnuncio({ a, puesto, moneda, tenant }: { a: FilaRanking; puesto: number; moneda?: string | null; tenant?: string }) {
  const t = tendencia(a.tendencia);
  return (
    <div className="rounded-lg bg-arena/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 w-5 shrink-0 text-[0.95rem] font-bold text-frio">{puesto}</span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="truncate text-[0.92rem] font-semibold text-tinta">{a.nombre}</span>
            {t && (
              <span className={`rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${t.clase}`}>
                {t.texto}
              </span>
            )}
          </div>

          {/* LO QUE DECIDE, primero y legible. Un anuncio con muchos clics y
              cero conversaciones es el que hay que apagar, y eso no se veia. */}
          <p className="mt-1.5 text-[0.88rem] text-tinta-2">
            {a.leads > 0 ? (
              <>
                {/* El conteo lleva a ESAS personas (2026-10-09). */}
                <Link href={urlLeadsDeAnuncio(a.anuncioId, tenant)} className="font-bold text-tinta underline-offset-2 hover:text-brasa-texto hover:underline">
                  {a.leads} {a.leads === 1 ? "persona te escribió" : "personas te escribieron"}
                </Link>
                {a.costoPorLeadCentavos !== null && (
                  <span className="text-frio"> · {importeMarketing(a.costoPorLeadCentavos, moneda)} cada una</span>
                )}
              </>
            ) : (
              <span className="text-frio">Todavía no te escribió nadie por este anuncio</span>
            )}
          </p>

          {/* El detalle, en segundo plano: se mira cuando ya se decidio que
              este anuncio importa. */}
          <p className="mt-1 text-[0.78rem] text-frio">
            CTR {a.ctr.toFixed(1)}% · {a.clics} {a.clics === 1 ? "clic" : "clics"} · {importeMarketing(a.gastoCentavos, moneda)} gastados
            {a.dias > 0 && ` · ${a.dias} ${a.dias === 1 ? "día" : "días"}`}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Una fila del desglose, con barra proporcional.
 *
 * La barra mide CTR y no gasto: la pregunta es dónde FUNCIONA la publicidad, no
 * dónde se gastó más — eso último lo decide el presupuesto, no el público.
 */
function Barra({ d, maximo, moneda }: { d: Desglose; maximo: number; moneda?: string | null }) {
  const ancho = Math.max(0, Math.min(100, Math.round((d.ctr / maximo) * 100)));
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 truncate text-[0.82rem] text-tinta-2">{d.etiqueta}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-arena">
        <div className="h-full rounded bg-brasa/70" style={{ width: `${ancho}%` }} />
      </div>
      <span className="max-w-40 text-right text-[0.76rem] tabular-nums text-frio">
        {d.ctr.toFixed(1)}% · {importeMarketing(d.gastoCentavos, moneda)}
      </span>
    </div>
  );
}

function ayuda(v: "hora" | "edad" | "red" | "zona"): string {
  switch (v) {
    case "hora": return "Distribución de clics respecto a impresiones por hora.";
    case "edad": return "Clics respecto a impresiones por edad y género.";
    case "red": return "Clics respecto a impresiones por red.";
    case "zona": return "Clics respecto a impresiones por zona.";
  }
}

/**
 * La tendencia, en una palabra.
 *
 * `null` no se pinta: significa que no hay con qué comparar —el anuncio recién
 * arrancó, o tuvo muy pocas impresiones— y un "estable" inventado ahí se leería
 * como un dato cuando es una suposición.
 */
function tendencia(t: "subiendo" | "estable" | "cayendo" | null) {
  switch (t) {
    case "subiendo": return { texto: "↑ mejorando", clase: "bg-ok/12 text-ok" };
    case "cayendo": return { texto: "↓ cayendo", clase: "bg-tibio-suave text-tibio" };
    case "estable": return { texto: "estable", clase: "bg-arena text-frio" };
    default: return null;
  }
}
