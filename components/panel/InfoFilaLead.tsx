"use client";

import type { Lead } from "@/lib/api";
import { esperandoDeFila, textoProximaReunion, textoProximoPaso } from "@/lib/crm-filtros";

/**
 * LO QUE HAY QUE SABER DE UN CLIENTE SIN ABRIR EL CHAT (CRM fase 2, 2026-10-13).
 *
 * En cada fila / tarjeta: si te escribió y espera ("Te escribió hace 2 h ·
 * esperando"), su último mensaje, la próxima reunión o el próximo paso, y a
 * quién está asignado. Todo sale de la misma fila de la lista (sin consultas
 * extra). Lo que el backend todavía no manda simplemente no aparece.
 */
export function InfoFilaLead({
  lead, asignado, compacto = false, sinUltimoMensaje = false, ahora = new Date(),
}: {
  lead: Lead;
  /** El nombre de quien lo tiene asignado ("Tú", "Rosa"…); sin él no se muestra. */
  asignado?: string | null;
  compacto?: boolean;
  /** Donde el último mensaje ya se ve en otra parte (el resumen del chat). */
  sinUltimoMensaje?: boolean;
  ahora?: Date;
}) {
  const esperando = esperandoDeFila(lead, ahora);
  const reunion = textoProximaReunion(lead.proximaCitaEn, ahora);
  const paso = textoProximoPaso(lead.proximaTareaEn, ahora);
  const ultimo = !sinUltimoMensaje && lead.ultimoMensaje?.trim()
    ? `${lead.ultimoDireccion === "saliente" ? "Tú: " : ""}${lead.ultimoMensaje.trim()}`
    : null;
  if (!esperando && !reunion && !paso && !ultimo && !asignado) return null;
  const t = compacto ? "text-[0.7rem]" : "text-[0.78rem]";
  return (
    <span className={`mt-1 flex flex-col gap-0.5 ${t}`}>
      {esperando && (
        <span className={`font-semibold ${esperando.urgente ? "text-calor" : "text-brasa-texto"}`}>{esperando.texto}</span>
      )}
      {ultimo && <span className="line-clamp-1 italic text-tinta-2">“{ultimo}”</span>}
      {(reunion || paso || asignado) && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-frio">
          {reunion && <span className="font-semibold text-tinta-2">📅 {reunion}</span>}
          {paso && <span className={paso.atrasado ? "font-semibold text-alerta" : ""}>🗓️ {paso.texto}</span>}
          {asignado && <span>👤 {asignado}</span>}
        </span>
      )}
    </span>
  );
}
