"use client";

import Link from "next/link";
import { diaLima, hoyLima, horaLima, nombreDelDia } from "@/lib/agenda";
import { reunionUnible, urlAgenda } from "@/lib/enlaces";

/**
 * LA PRÓXIMA REUNIÓN CON UN LEAD, CON "UNIRSE" Y "VER EN AGENDA".
 *
 * Vivía dentro de Conversaciones (2026-10-09); sale acá para que el popup de
 * Seguimiento muestre la misma tarjeta, con los mismos botones, en vez de una
 * versión propia que se desacomoda con la primera edición.
 */
export function ProximaCita({
  cita,
  compacta = false,
}: {
  cita: { id: string; inicio: string; fin: string; meetLink: string | null; atiende: string | null };
  compacta?: boolean;
}) {
  const dia = diaLima(cita.inicio);
  const cuando = `${dia === hoyLima() ? "Hoy" : nombreDelDia(dia)} ${horaLima(cita.inicio)}`;
  const unible = !!cita.meetLink && reunionUnible(cita);
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compacta ? "text-[0.8rem]" : "text-[0.85rem]"}`}>
      <p className="min-w-0 flex-1 text-tinta">
        <span className="font-bold first-letter:uppercase">Próxima reunión: </span>
        <span className="first-letter:uppercase">{cuando}</span>
        {cita.atiende && !compacta && <span className="block text-[0.75rem] text-frio">Atiende {cita.atiende}</span>}
      </p>
      {unible && (
        <a
          href={cita.meetLink!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-chip bg-brasa px-3 py-1.5 text-[0.78rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
        >
          Unirse
        </a>
      )}
      <Link
        href={urlAgenda({ fecha: dia, cita: cita.id, vista: "dia" })}
        className="shrink-0 text-[0.78rem] font-bold text-brasa-texto underline-offset-2 hover:underline"
      >
        Ver en agenda
      </Link>
    </div>
  );
}
