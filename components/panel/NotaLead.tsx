"use client";

import { useState } from "react";
import { actualizarLead } from "@/lib/api";

// Nombre editable + NOTA FIJADA de un lead. La vendedora puede corregir el
// nombre (leads entran como "+51 9xx…") y dejar una nota que el cliente no ve.
// `onGuardado` refresca el lead en la pantalla padre tras guardar.
//
// "NOTA FIJADA" (CRM fase 1, 2026-10-13): es la misma columna `Lead.nota` de
// siempre, pero ahora es SOLO lo permanente ("quiere el plan de 3
// doctores"). Lo que pasa día a día ("llamé, decide el lunes") va como
// apunte al historial, con fecha y autor, y nunca pisa a otro.
export function NotaLead({
  leadId, nombre, nota, onGuardado, tenant,
}: {
  leadId: string;
  nombre: string | null;
  nota: string | null;
  onGuardado?: () => void;
  /** El negocio del lead (2026-10-09): con varios, puede no ser la empresa activa. */
  tenant?: string;
}) {
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreBorrador, setNombreBorrador] = useState(nombre ?? "");
  const [notaBorrador, setNotaBorrador] = useState(nota ?? "");
  const [guardandoNota, setGuardandoNota] = useState(false);
  const [ok, setOk] = useState(false);

  async function guardarNombre() {
    const limpio = nombreBorrador.trim();
    setEditandoNombre(false);
    if (limpio === (nombre ?? "")) return;
    await actualizarLead(leadId, { nombre: limpio || null }, tenant);
    onGuardado?.();
  }

  async function guardarNota() {
    setGuardandoNota(true);
    const r = await actualizarLead(leadId, { nota: notaBorrador.trim() || null }, tenant);
    setGuardandoNota(false);
    if (r.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 1500);
      onGuardado?.();
    }
  }

  const notaCambiada = notaBorrador.trim() !== (nota ?? "").trim();

  return (
    <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
      <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Nombre y nota fijada</p>

      {/* Nombre editable */}
      <div className="mb-3">
        <span className="mb-1 block text-[0.78rem] text-frio">Nombre</span>
        {editandoNombre ? (
          <input
            autoFocus
            value={nombreBorrador}
            onChange={(e) => setNombreBorrador(e.target.value)}
            onBlur={guardarNombre}
            onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); }}
            placeholder="Nombre del contacto"
            className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
          />
        ) : (
          <button
            onClick={() => { setNombreBorrador(nombre ?? ""); setEditandoNombre(true); }}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-sm font-semibold text-tinta transition hover:bg-arena/40"
          >
            <span className="truncate">{nombre?.trim() || "Sin nombre — toca para poner uno"}</span>
            <span className="ml-2 shrink-0 text-[0.72rem] font-normal text-brasa-texto">Editar</span>
          </button>
        )}
      </div>

      {/* Nota fijada */}
      <span className="block text-[0.78rem] font-semibold text-tinta-2">📌 Nota fijada</span>
      <span className="mb-1 block text-[0.74rem] text-frio">Lo que siempre hay que saber de este cliente. Él no la ve.</span>
      <textarea
        value={notaBorrador}
        onChange={(e) => setNotaBorrador(e.target.value)}
        rows={3}
        placeholder="Ej: quiere el plan de 3 doctores; decide con su socia."
        className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
      />
      {notaCambiada && (
        <button
          onClick={guardarNota}
          disabled={guardandoNota}
          className="mt-2 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {guardandoNota ? "Guardando…" : "Guardar nota fijada"}
        </button>
      )}
      {ok && <span className="ml-2 text-[0.8rem] font-semibold text-ok">Guardado ✓</span>}
    </div>
  );
}
