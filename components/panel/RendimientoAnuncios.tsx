"use client";

import { useEffect, useState } from "react";
import { rendimientoAds, type RendimientoAds, type Desglose } from "@/lib/api";

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
export function RendimientoAnuncios({ tenant }: { tenant?: string } = {}) {
  const [r, setR] = useState<RendimientoAds | null>(null);
  const [cargando, setCargando] = useState(true);
  const [dias, setDias] = useState(30);
  const [vista, setVista] = useState<"hora" | "edad" | "red" | "zona">("hora");

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void rendimientoAds(dias, tenant).then((d) => {
      if (!vivo) return;
      setR(d);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [tenant, dias]);

  if (cargando) return <div className="h-52 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!r) return null;

  const hayTop = r.ranking.length > 0;
  const d = r.desgloses;
  const listas: Record<typeof vista, Desglose[]> = {
    hora: d?.porHora ?? [],
    edad: d?.porEdad ?? [],
    red: d?.porRed ?? [],
    zona: d?.porZona ?? [],
  };
  const actual = listas[vista];
  const hayDesglose = Object.values(listas).some((l) => l.length > 0);

  if (!hayTop && !hayDesglose) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Qué publicidad funcionó</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Cuando tus anuncios lleven unos días corriendo vas a ver acá cuál
          rinde más, a qué hora conviene mostrarlos y a qué público le pegan.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.05rem] font-bold text-tinta">Qué publicidad funcionó</h3>
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

      {/* EL TOP. La tendencia es la mitad del valor: sin ella el dueño sube el
          presupuesto de algo que venía cayendo. */}
      {hayTop && (
        <div className="mt-4">
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Tus mejores anuncios
          </p>
          <div className="mt-2 space-y-1.5">
            {r.ranking.slice(0, 5).map((a, i) => {
              const t = tendencia(a.tendencia);
              return (
                <div key={a.anuncioId} className="flex items-center gap-3 rounded-lg bg-arena/40 px-3 py-2">
                  <span className="w-5 shrink-0 text-[0.9rem] font-bold text-frio">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[0.86rem] font-semibold text-tinta">{a.nombre}</span>
                    <span className="mt-0.5 block text-[0.76rem] text-frio">
                      {a.ctr.toFixed(1)}% lo tocó · {a.clics} {a.clics === 1 ? "clic" : "clics"} · {soles(a.gastoCentavos)}
                      {a.dias > 0 && ` · ${a.dias} ${a.dias === 1 ? "día" : "días"}`}
                    </span>
                  </div>
                  {t && (
                    <span className={`shrink-0 rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${t.clase}`}>
                      {t.texto}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LOS DESGLOSES. Una pestaña por pregunta, porque mostrar las cuatro
          listas juntas son cuarenta filas que nadie lee. */}
      {hayDesglose && (
        <div className="mt-5 border-t border-linea pt-4">
          <div className="flex flex-wrap gap-1.5">
            {([
              ["hora", "Por hora"],
              ["edad", "Por edad"],
              ["red", "Por red"],
              ["zona", "Por zona"],
            ] as const).map(([k, etiqueta]) => (
              <button
                key={k}
                type="button"
                onClick={() => setVista(k)}
                disabled={listas[k].length === 0}
                className={`rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold transition disabled:opacity-40 ${
                  vista === k ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <p className="mt-2 text-[0.8rem] text-frio">{ayuda(vista)}</p>

          <div className="mt-2 space-y-1">
            {actual.slice(0, 12).map((x) => (
              <Barra key={x.etiqueta} d={x} maximo={Math.max(...actual.map((y) => y.ctr), 0.01)} />
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
 * Una fila del desglose, con barra proporcional.
 *
 * La barra mide CTR y no gasto: la pregunta es dónde FUNCIONA la publicidad, no
 * dónde se gastó más — eso último lo decide el presupuesto, no el público.
 */
function Barra({ d, maximo }: { d: Desglose; maximo: number }) {
  const ancho = Math.max(2, Math.round((d.ctr / maximo) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 truncate text-[0.8rem] text-tinta-2">{d.etiqueta}</span>
      <div className="h-4 flex-1 overflow-hidden rounded bg-arena">
        <div className="h-full rounded bg-brasa/70" style={{ width: `${ancho}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-[0.76rem] tabular-nums text-frio">
        {d.ctr.toFixed(1)}% · {soles(d.gastoCentavos)}
      </span>
    </div>
  );
}

function ayuda(v: "hora" | "edad" | "red" | "zona"): string {
  switch (v) {
    case "hora": return "A qué hora la gente toca más tus anuncios. Conviene concentrar el presupuesto ahí.";
    case "edad": return "Qué edad y género responde mejor. Si uno destaca, vale ajustar la segmentación.";
    case "red": return "Dónde rinde más tu publicidad. Facebook e Instagram suelen dar resultados distintos.";
    case "zona": return "De qué zonas te tocan más el anuncio.";
  }
}

function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
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
