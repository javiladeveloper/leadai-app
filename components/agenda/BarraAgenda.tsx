"use client";

// Barra de la Agenda (2026-09-27): vista (Día · Semana · Mes · Lista),
// flechas ‹ › para el periodo, "Hoy" y el título del periodo visible.

import type { VistaAgenda } from "@/lib/agenda";

const NOMBRES: { vista: VistaAgenda; nombre: string }[] = [
  { vista: "dia", nombre: "Día" },
  { vista: "semana", nombre: "Semana" },
  { vista: "mes", nombre: "Mes" },
  { vista: "lista", nombre: "Lista" },
];

const PERIODO: Record<VistaAgenda, { anterior: string; siguiente: string }> = {
  dia: { anterior: "Día anterior", siguiente: "Día siguiente" },
  semana: { anterior: "Semana anterior", siguiente: "Semana siguiente" },
  mes: { anterior: "Mes anterior", siguiente: "Mes siguiente" },
  lista: { anterior: "30 días antes", siguiente: "30 días después" },
};

const foco = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa";
const flecha = `grid h-10 min-h-10! w-10 place-items-center rounded-chip bg-carta text-[1.3rem] leading-none text-tinta ring-1 ring-linea transition hover:bg-arena ${foco}`;

export function BarraAgenda({
  vista,
  titulo,
  cargando,
  onVista,
  onMover,
  onHoy,
}: {
  vista: VistaAgenda;
  titulo: string;
  cargando: boolean;
  onVista: (v: VistaAgenda) => void;
  onMover: (delta: number) => void;
  onHoy: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" onClick={() => onMover(-1)} aria-label={PERIODO[vista].anterior} className={flecha}>
          ‹
        </button>
        <button type="button" onClick={() => onMover(1)} aria-label={PERIODO[vista].siguiente} className={flecha}>
          ›
        </button>
        <button
          type="button"
          onClick={onHoy}
          className={`h-10 min-h-10! rounded-chip bg-carta px-4 text-[0.85rem] font-semibold text-tinta ring-1 ring-linea transition hover:bg-arena ${foco}`}
        >
          Hoy
        </button>
        <h2
          className={`min-w-0 pl-1 text-[1.05rem] font-bold text-tinta first-letter:uppercase sm:text-[1.2rem] ${cargando ? "opacity-60" : ""}`}
          aria-live="polite"
        >
          {titulo}
        </h2>
      </div>
      <div role="group" aria-label="Vista de la agenda" className="flex w-full rounded-chip bg-arena-2 p-1 sm:w-auto">
        {NOMBRES.map(({ vista: v, nombre }) => {
          const activa = v === vista;
          return (
            <button
              key={v}
              type="button"
              aria-pressed={activa}
              onClick={() => onVista(v)}
              className={`h-9 min-h-9! flex-1 rounded-chip px-3.5 text-[0.84rem] font-semibold transition sm:flex-none ${foco} ${
                activa ? "bg-carta text-tinta shadow-sm" : "text-tinta-2 hover:text-tinta"
              }`}
            >
              {nombre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
