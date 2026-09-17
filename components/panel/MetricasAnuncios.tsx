"use client";

import { useEffect, useState } from "react";
import { metricasAds, type MetricasAds, type AnuncioMetricas } from "@/lib/api";

/**
 * TUS ANUNCIOS DE META, EXPLICADOS (2026-09-17, pedido de Jonathan: "alguien
 * que no conoce nada de Meta Ads, en vez de entrar ahí, en la app pueda ver
 * todo lo necesario").
 *
 * Meta muestra `reach`, `frequency`, `CPM` y `CTR` sin explicar ninguno, y
 * quien no vive en el Ads Manager no sabe cuál mirar ni qué número es bueno.
 * Acá cada dato viene con su significado en palabras y su veredicto.
 *
 * LO QUE CAMBIA RESPECTO DEL ADS MANAGER: el orden. Meta ordena por lo que
 * gastó; acá manda lo que le sirve al dueño — cuántas personas vieron el
 * anuncio y cuántas escribieron. El gasto va al lado, no al frente.
 *
 * Muestra TODO lo de la cuenta, venga del panel o del Ads Manager: la mayoría
 * de los negocios arman sus anuncios en Meta y no por acá.
 */
export function MetricasAnuncios({ tenant }: { tenant?: string } = {}) {
  const [m, setM] = useState<MetricasAds | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void metricasAds(tenant).then((r) => {
      if (!vivo) return;
      setM(r);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [tenant]);

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  // Sin cuenta conectada no se muestra una tabla vacía: se dice qué falta.
  if (!m) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios de Facebook e Instagram</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Conecta tu cuenta publicitaria y vas a ver acá cuánto gastaste, a
          cuánta gente llegaste y qué anuncio funciona — sin entrar al
          administrador de Meta.
        </p>
      </div>
    );
  }

  const anuncios = [...m.anuncios].sort((a, b) => b.personas - a.personas);
  if (anuncios.length === 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios de Facebook e Instagram</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Tu cuenta está conectada, pero ninguno de tus anuncios tuvo actividad
          en los últimos 30 días.
        </p>
      </div>
    );
  }

  const totalPersonas = anuncios.reduce((a, x) => a + x.personas, 0);

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios de Facebook e Instagram</h3>
        <span className="text-[0.8rem] text-frio">últimos 30 días</span>
      </div>

      {/* EL RESUMEN EN UNA FRASE, antes que la tabla. Es lo que el dueño
          quiere saber al entrar; el detalle lo mira quien se interesa. */}
      <p className="mt-1 text-[0.88rem] text-tinta-2">
        Gastaste <strong className="text-tinta">{soles(m.cuenta.gastoCentavos)}</strong> y
        tu publicidad la vieron <strong className="text-tinta">{totalPersonas.toLocaleString("es-PE")} personas</strong>.
      </p>

      <div className="mt-4 space-y-2">
        {anuncios.map((a) => {
          const v = veredicto(a);
          const abierta = abierto === a.adId;
          return (
            <div key={a.adId} className="rounded-lg bg-arena/40 ring-1 ring-linea">
              <button
                type="button"
                onClick={() => setAbierto(abierta ? null : a.adId)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[0.88rem] font-semibold text-tinta">{a.nombre}</span>
                  <span className="mt-0.5 block text-[0.78rem] text-frio">
                    {a.personas.toLocaleString("es-PE")} personas · {a.clics} tocaron · {soles(a.gastoCentavos)}
                  </span>
                </div>
                <span className={`shrink-0 rounded-chip px-2 py-0.5 text-[0.76rem] font-bold ${v.clase}`}>
                  {v.texto}
                </span>
                <span className="shrink-0 text-frio">{abierta ? "−" : "+"}</span>
              </button>

              {/* EL DETALLE, solo si lo pide. Mostrar seis métricas de entrada
                  a quien no sabe qué es un CPM es la razón por la que nadie
                  entra al Ads Manager dos veces. */}
              {abierta && (
                <div className="border-t border-linea px-3 py-3">
                  <dl className="space-y-2.5">
                    <Dato
                      titulo="Personas alcanzadas"
                      valor={a.personas.toLocaleString("es-PE")}
                      ayuda={`Se mostró ${a.impresiones.toLocaleString("es-PE")} veces en total: cada persona lo vio ${a.frecuencia.toFixed(1)} ${a.frecuencia < 1.5 ? "vez" : "veces"} en promedio.`}
                    />
                    <Dato
                      titulo="Cuántos lo tocaron"
                      valor={`${a.clics} de ${a.personas.toLocaleString("es-PE")}`}
                      ayuda={
                        a.ctr >= 1
                          ? `${a.ctr.toFixed(1)}% — está bien, el promedio ronda el 1%.`
                          : `${a.ctr.toFixed(1)}% — bajo. El promedio ronda el 1%: la imagen o el texto no están enganchando.`
                      }
                    />
                    {a.interacciones > 0 && (
                      <Dato
                        titulo="Reacciones y comentarios"
                        valor={String(a.interacciones)}
                        ayuda="Le gustó a la gente aunque no haya tocado el anuncio. Contenido que funciona."
                      />
                    )}
                    <Dato
                      titulo="Lo que costó"
                      valor={soles(a.gastoCentavos)}
                      ayuda={`${soles(a.cpmCentavos)} por cada mil veces que se mostró${a.clics > 0 ? ` · ${soles(Math.round(a.gastoCentavos / a.clics))} por cada persona que lo tocó` : ""}.`}
                    />
                    {a.frecuencia >= 3 && (
                      <p className="rounded-lg bg-tibio-suave px-3 py-2 text-[0.8rem] text-tibio">
                        <strong>Ojo:</strong> la misma gente ya lo vio {a.frecuencia.toFixed(1)} veces.
                        Cuando se repite tanto deja de funcionar y empieza a
                        molestar — conviene cambiar la imagen o ampliar el público.
                      </p>
                    )}
                    <p className="text-[0.76rem] text-frio">Campaña: {a.campania || "—"}</p>
                  </dl>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 border-t border-linea pt-3 text-[0.78rem] text-frio">
        Se actualiza cada hora. Incluye los anuncios que crees acá y los que
        hagas directo en Facebook.
      </p>
    </div>
  );
}

function Dato({ titulo, valor, ayuda }: { titulo: string; valor: string; ayuda: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[0.82rem] font-semibold text-tinta">{titulo}</dt>
        <dd className="shrink-0 text-[0.9rem] font-bold tabular-nums text-tinta">{valor}</dd>
      </div>
      <p className="mt-0.5 text-[0.78rem] text-frio">{ayuda}</p>
    </div>
  );
}

/** Céntimos → "S/12.34". */
function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

/**
 * El veredicto de un anuncio, en dos palabras.
 *
 * Mira el CTR —qué porcentaje de los que lo vieron lo tocaron— porque es la
 * única métrica que dice si el anuncio ENGANCHA, independiente del
 * presupuesto. Un anuncio de S/2 y uno de S/200 se comparan igual.
 *
 * El 1% no es un número inventado: es el promedio de Facebook para campañas de
 * tráfico y mensajes. Por debajo de 0.5% el problema casi siempre es la imagen
 * o el texto, no el público.
 */
function veredicto(a: AnuncioMetricas): { texto: string; clase: string } {
  if (a.impresiones === 0) return { texto: "sin mostrar", clase: "bg-arena text-frio" };
  if (a.ctr >= 1.5) return { texto: "engancha", clase: "bg-ok/12 text-ok" };
  if (a.ctr >= 0.8) return { texto: "normal", clase: "bg-arena text-tinta-2" };
  return { texto: "flojo", clase: "bg-tibio-suave text-tibio" };
}
