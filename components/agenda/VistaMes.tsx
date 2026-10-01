"use client";

// Vista MES de la Agenda (2026-09-27): 6 filas × lunes–domingo. En cada día,
// hasta 3 citas ("10:00 Henry") y "+N más"; en el celular, un punto de color
// por cita. Tocar el día abre su detalle; tocar una cita (sm+), la cita.
//
// Cada casilla tiene un botón que la cubre entera (el día) y, encima, los
// botones de las citas: así no hay botones anidados.

import type { CitaAgenda } from "@/lib/api";
import { DIAS_SEMANA_CORTOS, nombreDelDia, horaLima, resumenDelDia } from "@/lib/agenda";
import { colorDe } from "./colores";
import { MarcaNota, textoMarca } from "./ResultadoLlamada";

export function VistaMes({
  dias,
  mes,
  hoy,
  citasPorDia,
  colores,
  onDia,
  onCita,
}: {
  dias: string[];
  /** "AAAA-MM" del mes que se está viendo (los demás días van atenuados). */
  mes: string;
  hoy: string;
  citasPorDia: Map<string, CitaAgenda[]>;
  colores: Map<string, number>;
  onDia: (dia: string) => void;
  onCita: (c: CitaAgenda) => void;
}) {
  const filas = Array.from({ length: dias.length / 7 }, (_, i) => dias.slice(i * 7, i * 7 + 7));
  return (
    <div role="table" aria-label="Calendario del mes" className="overflow-hidden rounded-tarjeta bg-carta ring-1 ring-linea">
      <div role="row" className="grid grid-cols-7 border-b border-linea bg-arena/60">
        {DIAS_SEMANA_CORTOS.map((d) => (
          <div
            key={d}
            role="columnheader"
            className="py-2 text-center text-[0.7rem] font-bold uppercase tracking-wide text-frio sm:text-[0.75rem]"
          >
            <span className="sm:hidden" aria-hidden>{d.slice(0, 1).toUpperCase()}</span>
            <span className="sr-only sm:not-sr-only">{d}</span>
          </div>
        ))}
      </div>
      {filas.map((fila) => (
        <div role="row" key={fila[0]} className="grid grid-cols-7 border-b border-linea last:border-b-0">
          {fila.map((dia) => {
            const citas = citasPorDia.get(dia) ?? [];
            const delMes = dia.startsWith(mes);
            const esHoy = dia === hoy;
            const { mostradas, resto } = resumenDelDia(citas, 3);
            const cuantas = citas.length === 0 ? "sin reuniones" : citas.length === 1 ? "1 reunión" : `${citas.length} reuniones`;
            return (
              <div
                role="cell"
                key={dia}
                className={`relative h-16 min-w-0 border-r border-linea last:border-r-0 sm:h-auto sm:min-h-[7rem] ${
                  delMes ? "" : "bg-arena/70"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onDia(dia)}
                  aria-label={`${nombreDelDia(dia)}${esHoy ? " (hoy)" : ""}: ${cuantas}`}
                  className="absolute inset-0 min-h-0! w-full hover:bg-brasa-suave/40 focus-visible:z-20 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brasa"
                />
                <div className="pointer-events-none relative flex flex-col items-center gap-1 p-1 sm:items-stretch sm:p-1.5">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[0.75rem] font-semibold sm:self-end ${
                      esHoy ? "bg-brasa text-sobre-brasa" : delMes ? "text-tinta" : "text-frio/70"
                    }`}
                    aria-hidden
                  >
                    {Number(dia.slice(8))}
                  </span>
                  {/* Móvil: un punto por cita (hasta 4 y "+"). */}
                  {citas.length > 0 && (
                    <span className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                      {citas.slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className={`h-1.5 w-1.5 rounded-full ${colorDe(colores, c.tenantId).punto} ${c.estado === "cancelada" ? "opacity-30" : ""}`}
                        />
                      ))}
                      {citas.length > 4 && <span className="text-[0.6rem] leading-[0.4rem] text-frio">+</span>}
                    </span>
                  )}
                  {/* sm+: hasta 3 citas con hora y cliente. */}
                  <div className="hidden space-y-0.5 sm:block">
                    {mostradas.map((c) => {
                      const cancelada = c.estado === "cancelada";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onCita(c)}
                          aria-label={`${horaLima(c.inicio)} ${c.cliente || "Cliente"}, ${c.negocio}${cancelada ? ", cancelada" : ""}${textoMarca(c) ? `, ${textoMarca(c)}` : ""}`}
                          className={`pointer-events-auto relative z-10 block min-h-0! w-full truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[0.72rem] leading-tight focus-visible:outline-2 focus-visible:outline-brasa ${
                            colorDe(colores, c.tenantId).bloque
                          } ${cancelada ? "line-through opacity-50" : ""}`}
                        >
                          <MarcaNota cita={c} className="mr-1" />
                          <span className="font-semibold">{horaLima(c.inicio)}</span> {c.cliente || "Cliente"}
                        </button>
                      );
                    })}
                    {resto > 0 && (
                      <span className="block px-1.5 text-[0.7rem] font-semibold text-frio">+{resto} más</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
