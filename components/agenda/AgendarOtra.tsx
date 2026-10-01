"use client";

// AGENDAR OTRA LLAMADA (2026-10-01, Jonathan: "si agendamos para otro día…
// no puedo generar ese registro en mi agenda para que se sincronice con
// google"). Día y hora en hora de Lima; el backend la crea en el Google
// Calendar de quien la agenda, con Meet, como cuando agenda el bot. Mismo
// flujo que la app (ReagendarUi.kt).

import { useId, useState } from "react";
import { agendarCita, type CitaAgenda } from "@/lib/api";
import { hoyLima } from "@/lib/agenda";

/** De 07:00 a 21:30, cada media hora. */
const HORAS = Array.from({ length: 30 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export function AgendarOtra({ cita: c, onAgendada }: { cita: CitaAgenda; onAgendada: (nueva: CitaAgenda) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [invitar, setInvitar] = useState(Boolean(c.correo));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const idDia = useId();
  const idHora = useId();

  if (!c.leadId) return null;

  async function agendar() {
    if (!dia || !hora) return;
    setGuardando(true);
    setError(null);
    try {
      const nueva = await agendarCita({
        tenantId: c.tenantId,
        leadId: c.leadId,
        // Perú es UTC-5 todo el año: la hora elegida es hora de Lima.
        inicio: `${dia}T${hora}:00-05:00`,
        invitarCliente: invitar && Boolean(c.correo),
        desdeCitaId: c.id,
      });
      setListo(`Agendado el ${dia.split("-").reverse().join("/")} a las ${hora}. Ya está en tu Google Calendar.`);
      setAbierto(false);
      onAgendada(nueva);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo agendar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <div className="mt-2">
        {listo && <p className="mb-1 text-[0.82rem] font-semibold text-brasa-texto" role="status">{listo}</p>}
        <button
          type="button"
          onClick={() => { setAbierto(true); setListo(null); }}
          className="inline-flex min-h-10! items-center rounded-chip px-1 text-[0.85rem] font-semibold text-brasa-texto underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brasa"
        >
          Agendar otra llamada
        </button>
      </div>
    );
  }

  const campo = "mt-1 w-full rounded-tarjeta border border-linea bg-carta px-3 py-2 text-[0.9rem] text-tinta outline-none focus:border-brasa";
  return (
    <div className="mt-3 rounded-tarjeta bg-arena p-3">
      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-frio">Agendar otra llamada</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label htmlFor={idDia} className="text-[0.8rem] font-semibold text-tinta-2">
          Día
          <input id={idDia} type="date" min={hoyLima()} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
        </label>
        <label htmlFor={idHora} className="text-[0.8rem] font-semibold text-tinta-2">
          Hora
          <select id={idHora} value={hora} onChange={(e) => setHora(e.target.value)} className={campo}>
            <option value="">Elige</option>
            {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
      </div>
      {c.correo && (
        <label className="mt-2 flex items-center gap-2 text-[0.85rem] text-tinta-2">
          <input type="checkbox" checked={invitar} onChange={(e) => setInvitar(e.target.checked)} className="h-4 w-4 accent-brasa" />
          Invitar al cliente ({c.correo})
        </label>
      )}
      {error && <p className="mt-2 text-[0.8rem] font-semibold text-alerta" role="alert">{error}</p>}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="inline-flex min-h-10! items-center rounded-chip px-3 text-[0.85rem] font-semibold text-tinta-2 hover:bg-linea focus-visible:outline-2 focus-visible:outline-brasa"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={agendar}
          disabled={!dia || !hora || guardando}
          className="inline-flex min-h-10! items-center rounded-chip bg-brasa px-4 text-[0.85rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
        >
          {guardando ? "Agendando…" : "Agendar"}
        </button>
      </div>
      <p className="mt-1 text-[0.75rem] text-frio">Se crea en tu Google Calendar con su videollamada, igual que cuando agenda el bot.</p>
    </div>
  );
}
