"use client";

import { useEffect, useState } from "react";
import { obtenerReporteAnuncios, type ReporteAnuncios } from "@/lib/api";

/**
 * QUÉ ANUNCIO DA DE COMER Y CUÁL SOLO GASTA (2026-09-17, pedido de Jonathan:
 * "tenemos la info de todas las plataformas, deberíamos poder hacer más").
 *
 * Teníamos el gasto de Meta por un lado y las ventas por otro, y nadie los
 * cruzaba. Sin las dos cosas juntas no se decide nada: "este anuncio trajo 7
 * ventas por S/840" suena bien hasta que se sabe que costó S/900.
 *
 * LA TABLA RESPONDE UNA PREGUNTA SOLA: cuál subo y cuál apago. Por eso ordena
 * por ROAS y no por facturación —el que más factura puede ser el que menos
 * rinde— y por eso cada fila lleva su veredicto en palabras: un número como
 * "4.2x" no le dice nada a quien nunca vio esa métrica.
 */
export function ReporteAnuncios({ tenant }: { tenant?: string } = {}) {
  const [r, setR] = useState<ReporteAnuncios | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    void obtenerReporteAnuncios(90, tenant).then((d) => {
      if (!vivo) return;
      setR(d);
      setCargando(false);
    });
    return () => { vivo = false; };
  }, [tenant]);

  if (cargando) return <div className="h-48 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!r) return null;

  // Sin un solo anuncio no se muestra la tabla vacía: se explica qué falta.
  if (r.filas.length === 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Rendimiento de tus anuncios</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Todavía no llegó nadie desde un anuncio. Cuando alguien te escriba
          tocando un anuncio de Facebook o Instagram, acá vas a ver cuánto
          costó y cuánto te dejó.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.05rem] font-bold text-tinta">Rendimiento de tus anuncios</h3>
        <span className="text-[0.8rem] text-frio">últimos 90 días</span>
      </div>

      {/* DECIR QUE NO SE PUDO MEDIR, en vez de mostrar ceros que parecen datos.
          Un anuncio con "S/0 gastado" se lee como gratis, no como no medido. */}
      {r.sinGasto ? (
        <p className="mt-2 rounded-tarjeta bg-tibio-suave px-3 py-2 text-[0.82rem] text-tibio">
          No pudimos leer el gasto de Meta, así que falta la mitad de la cuenta:
          ves lo que vendiste pero no lo que costó. Conecta tu cuenta
          publicitaria en Anuncios para completarlo.
        </p>
      ) : (
        <p className="mt-1 text-[0.85rem] text-tinta-2">
          Gastaste <strong className="text-tinta">{soles(r.gastoTotalCentavos)}</strong> y
          vendiste <strong className="text-tinta">{soles(r.filas.reduce((a, f) => a + f.ventasCentavos, 0))}</strong> con
          lo que llegó desde anuncios.
        </p>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[0.85rem]">
          <thead>
            <tr className="border-b border-linea text-left text-[0.72rem] font-bold uppercase tracking-wide text-frio">
              <th className="pb-2 pr-3">Anuncio</th>
              <th className="pb-2 pr-3 text-right">Gastaste</th>
              <th className="pb-2 pr-3 text-right">Vendiste</th>
              <th className="pb-2 pr-3 text-right">Clientes</th>
              <th className="pb-2 text-right">Por cada S/1</th>
            </tr>
          </thead>
          <tbody>
            {r.filas.map((f) => {
              const v = veredicto(f.roas);
              return (
                <tr key={f.origen} className="border-b border-linea/60 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="font-semibold text-tinta">{f.nombre}</span>
                    <span className="mt-0.5 block text-[0.76rem] text-frio">
                      {f.leads} {f.leads === 1 ? "persona escribió" : "personas escribieron"}
                      {f.costoPorVentaCentavos !== null && ` · ${soles(f.costoPorVentaCentavos)} por cliente`}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-tinta-2">
                    {f.roas === null ? "—" : soles(f.gastoCentavos)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-tinta">
                    {soles(f.ventasCentavos)}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-tinta-2">{f.compradores}</td>
                  <td className="py-2.5 text-right">
                    <span className={`rounded-chip px-2 py-0.5 text-[0.78rem] font-bold ${v.clase}`}>
                      {v.texto}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lo que llegó SIN pagar, como vara de comparación: si lo orgánico
          rinde más que lo pagado, la plata está mejor puesta en contenido. */}
      {r.organicos.leads > 0 && (
        <p className="mt-3 border-t border-linea pt-3 text-[0.82rem] text-frio">
          Sin pagar publicidad te llegaron{" "}
          <strong className="text-tinta-2">{r.organicos.leads} personas</strong> y
          vendiste <strong className="text-tinta-2">{soles(r.organicos.ventasCentavos)}</strong>.
        </p>
      )}
    </div>
  );
}

/** Céntimos → "S/1,234.50". */
function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

/**
 * El ROAS en palabras.
 *
 * "4.2x" no le dice nada a quien nunca vio la métrica, y este panel lo usa
 * gente que no sabe qué es un píxel. El número igual va, porque el que sí
 * sabe lo busca — pero la decisión tiene que leerse sin saber nada.
 *
 * El corte en 1x no es arbitrario: por debajo de ahí el anuncio devuelve menos
 * de lo que cuesta. Entre 1 y 2 apenas empata considerando el costo del
 * producto, y por eso no se pinta de verde.
 */
function veredicto(roas: number | null): { texto: string; clase: string } {
  if (roas === null) return { texto: "sin medir", clase: "bg-arena text-frio" };
  const x = `${roas.toFixed(1)}x`;
  if (roas >= 2) return { texto: `${x} · rinde`, clase: "bg-ok/12 text-ok" };
  if (roas >= 1) return { texto: `${x} · justo`, clase: "bg-tibio-suave text-tibio" };
  return { texto: `${x} · pierde`, clase: "bg-calor-suave text-calor-hondo" };
}
