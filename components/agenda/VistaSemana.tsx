"use client";

// Vistas SEMANA y DÍA de la Agenda (2026-09-27): columnas por día × filas por
// hora. Cada cita es un bloque ubicado por su hora de inicio y alto según su
// duración; las que se pisan van lado a lado. Día = la misma grilla con una
// sola columna ancha, y el bloque muestra también negocio y teléfono.
//
// La grilla scrollea DENTRO de su caja (en X en el celular, en Y si es alta):
// la página nunca scrollea de costado, y la cabecera de días y la columna de
// horas quedan fijas.

import { useEffect, useRef } from "react";
import type { CitaAgenda } from "@/lib/api";
import {
  DIAS_SEMANA_CORTOS, diaDeSemana, horaLima, minutosLima, nombreDelDia, posicionarEnDia, rangoDeHoras, diaLima,
} from "@/lib/agenda";
import { colorDe } from "./colores";
import { IconoTipo } from "./DetalleCitas";
import { MarcaNota, textoMarca } from "./ResultadoLlamada";

export function VistaSemana({
  dias,
  hoy,
  ahora,
  citasPorDia,
  colores,
  onCita,
  onDia,
}: {
  dias: string[];
  hoy: string;
  ahora: Date;
  citasPorDia: Map<string, CitaAgenda[]>;
  colores: Map<string, number>;
  onCita: (c: CitaAgenda) => void;
  /** Tocar la cabecera de un día (solo en Semana) lleva a la vista Día. */
  onDia?: (dia: string) => void;
}) {
  const detallado = dias.length === 1;
  const pxHora = detallado ? 64 : 52;
  const todas = dias.flatMap((d) => citasPorDia.get(d) ?? []);
  const horas = rangoDeHoras(todas);
  const totalMin = (horas.hasta - horas.desde) * 60;
  const alto = (totalMin / 60) * pxHora;
  const caja = useRef<HTMLDivElement>(null);

  // Al cambiar de periodo, arrancar mirando la primera cita (o "ahora" si es
  // hoy y no hay citas), con una hora de aire arriba.
  const ahoraMin = minutosLima(ahora) - horas.desde * 60;
  const hoyVisible = dias.includes(hoy) && diaLima(ahora) === hoy && ahoraMin >= 0 && ahoraMin <= totalMin;
  const primeraMin = todas.length
    ? Math.min(...todas.map((c) => minutosLima(c.inicio))) - horas.desde * 60
    : hoyVisible ? ahoraMin : 0;
  const clave = dias[0];
  useEffect(() => {
    // "Una hora de aire arriba" cae justo en una línea de hora, y esa línea
    // queda tapada por la cabecera de días (sticky, encima): el rótulo se ve
    // cortado a la mitad (2026-09-27, hallazgo del audit responsive). Con
    // 8px menos no se llega exacto al borde y el rótulo queda debajo, entero.
    if (caja.current) caja.current.scrollTop = Math.max(0, ((primeraMin - 60) / 60) * pxHora - 8);
    // Solo al cambiar de periodo: recargar datos no debe mover al usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const columnas = `3.25rem repeat(${dias.length}, minmax(0, 1fr))`;

  return (
    <div
      ref={caja}
      className="max-h-[calc(100dvh-15rem)] min-h-[22rem] overflow-auto rounded-tarjeta bg-carta ring-1 ring-linea"
    >
      <div className={detallado ? "" : "min-w-[42rem]"}>
        {/* Cabecera de días, fija arriba al scrollear. */}
        <div className="sticky top-0 z-20 grid border-b border-linea bg-carta" style={{ gridTemplateColumns: columnas }}>
          <div className="sticky left-0 z-10 bg-carta" />
          {dias.map((d) => {
            const esHoy = d === hoy;
            const contenido = (
              <>
                <span className="text-[0.7rem] font-bold uppercase tracking-wide text-frio">
                  {DIAS_SEMANA_CORTOS[diaDeSemana(d)]}
                </span>
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-[0.9rem] font-bold ${
                    esHoy ? "bg-brasa text-sobre-brasa" : "text-tinta"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
              </>
            );
            return onDia && !detallado ? (
              <button
                key={d}
                type="button"
                onClick={() => onDia(d)}
                aria-label={`Ver ${nombreDelDia(d)}${esHoy ? " (hoy)" : ""}`}
                className="flex min-h-0! flex-col items-center gap-0.5 py-1.5 hover:bg-arena focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brasa"
              >
                {contenido}
              </button>
            ) : (
              <div key={d} className="flex flex-col items-center gap-0.5 py-1.5">
                {contenido}
              </div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columnas }}>
          {/* Columna de horas, fija a la izquierda al scrollear en X. */}
          <div className="sticky left-0 z-10 bg-carta" style={{ height: alto }} aria-hidden>
            {Array.from({ length: horas.hasta - horas.desde }, (_, i) => (
              <div
                key={i}
                className="absolute right-1.5 -translate-y-1/2 text-[0.68rem] text-frio first:translate-y-0"
                style={{ top: i * pxHora }}
              >
                {String(horas.desde + i).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {dias.map((d) => {
            const pos = posicionarEnDia(citasPorDia.get(d) ?? [], d, horas.desde);
            const lineaAhora = d === hoy && hoyVisible;
            return (
              <div
                key={d}
                role="list"
                aria-label={`Reuniones del ${nombreDelDia(d)}`}
                className="relative border-l border-linea"
                style={{
                  height: alto,
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--color-linea) 0 1px, transparent 1px ${pxHora}px)`,
                }}
              >
                {pos.map(({ cita: c, desdeMin, hastaMin, columna, columnas: n }) => {
                  const cancelada = c.estado === "cancelada";
                  const altoBloque = ((hastaMin - desdeMin) / 60) * pxHora;
                  const compacto = altoBloque < 36;
                  return (
                    <div key={c.id} role="listitem">
                      <button
                        type="button"
                        onClick={() => onCita(c)}
                        aria-label={`${horaLima(c.inicio)} a ${horaLima(c.fin)}, ${c.cliente || "Cliente"}, ${c.negocio}${cancelada ? ", cancelada" : ""}${textoMarca(c) ? `, ${textoMarca(c)}` : ""}`}
                        className={`absolute min-h-0! overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-[0.72rem] leading-tight shadow-sm transition hover:z-10 hover:shadow-md focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brasa ${
                          colorDe(colores, c.tenantId).bloque
                        } ${cancelada ? "line-through opacity-50" : ""}`}
                        style={{
                          top: (desdeMin / 60) * pxHora + 1,
                          height: Math.max(altoBloque - 2, 14),
                          left: `calc(${(columna / n) * 100}% + 2px)`,
                          width: `calc(${100 / n}% - 4px)`,
                        }}
                      >
                        {/* Cada renglón se corta con "…": con dos citas lado a lado en
                            una semana, la columna queda angosta y el texto partido
                            en sílabas no se lee. */}
                        {compacto ? (
                          <span className="block truncate">
                            <MarcaNota cita={c} className="mr-1" />
                            <span className="font-semibold">{horaLima(c.inicio)}</span> <IconoTipo cita={c} />{" "}
                            {c.cliente || "Cliente"}
                          </span>
                        ) : (
                          <>
                            <span className="block truncate">
                              <MarcaNota cita={c} className="mr-1" />
                              <span className="font-semibold">{horaLima(c.inicio)}</span> <IconoTipo cita={c} />
                              {detallado && <span className="font-semibold"> {c.cliente || "Cliente"}</span>}
                            </span>
                            {!detallado && <span className="block truncate font-semibold">{c.cliente || "Cliente"}</span>}
                          </>
                        )}
                        {!compacto && (
                          <span className="block truncate opacity-80">
                            {detallado ? `${c.negocio}${c.telefono ? ` · +${c.telefono.replace(/\D/g, "")}` : ""}` : c.negocio}
                          </span>
                        )}
                        {!compacto && detallado && c.atiende && (
                          <span className="block truncate opacity-80">Atiende {c.atiende}</span>
                        )}
                        {/* En el Día hay espacio: la nota misma, para leerla sin abrir. */}
                        {!compacto && detallado && c.notaResultado?.trim() && (
                          <span className="block truncate italic">✎ {c.notaResultado}</span>
                        )}
                      </button>
                    </div>
                  );
                })}
                {lineaAhora && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-alerta"
                    style={{ top: (ahoraMin / 60) * pxHora }}
                    aria-hidden
                  >
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-alerta" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
