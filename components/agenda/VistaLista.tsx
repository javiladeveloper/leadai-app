"use client";

// Vista LISTA de la Agenda (2026-09-27): la agenda de siempre, agrupada por
// día de Lima, para los 30 días del periodo visible.

import type { CitaAgenda } from "@/lib/api";
import { agruparPorDia, nombreDelDia } from "@/lib/agenda";
import { TarjetaCita } from "./DetalleCitas";

export function VistaLista({
  citas,
  hoy,
  colores,
  onConversacion,
  onActualizada,
}: {
  citas: CitaAgenda[];
  hoy: string;
  colores: Map<string, number>;
  onConversacion: (c: CitaAgenda) => void;
  onActualizada: (c: CitaAgenda) => void;
}) {
  return (
    <div className="space-y-5">
      {agruparPorDia(citas).map((d) => (
        <section key={d.dia} className="space-y-2" aria-label={nombreDelDia(d.dia)}>
          <h3 className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">
            {nombreDelDia(d.dia)}
            {d.dia === hoy && <span className="ml-2 rounded-chip bg-brasa-suave px-2 py-0.5 text-brasa-texto">hoy</span>}
          </h3>
          {d.citas.map((c) => (
            <TarjetaCita key={c.id} cita={c} colores={colores} onConversacion={onConversacion} onActualizada={onActualizada} />
          ))}
        </section>
      ))}
    </div>
  );
}
