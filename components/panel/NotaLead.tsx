"use client";

import { useState } from "react";
import { actualizarLead } from "@/lib/api";

// Nombre editable + nota privada de un lead. La vendedora puede corregir el
// nombre (leads entran como "+51 9xx…") y dejar una nota que el cliente no ve.
// `onGuardado` refresca el lead en la pantalla padre tras guardar.
export function NotaLead({
  leadId, nombre, nota, onGuardado,
}: {
  leadId: string;
  nombre: string | null;
  nota: string | null;
  onGuardado?: () => void;
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
    await actualizarLead(leadId, { nombre: limpio || null });
    onGuardado?.();
  }

  async function guardarNota() {
    setGuardandoNota(true);
    const r = await actualizarLead(leadId, { nota: notaBorrador.trim() || null });
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
      <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Nota y nombre</p>

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
            <span className="truncate">{nombre?.trim() || "Sin nombre — tocá para poner uno"}</span>
            <span className="ml-2 shrink-0 text-[0.72rem] font-normal text-brasa-hondo">Editar</span>
          </button>
        )}
      </div>

      {/* Nota privada */}
      <span className="mb-1 block text-[0.78rem] text-frio">Nota privada (el cliente no la ve)</span>
      <textarea
        value={notaBorrador}
        onChange={(e) => setNotaBorrador(e.target.value)}
        rows={3}
        placeholder="Ej: llamó el martes, pidió descuento. Volver a contactar el lunes."
        className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
      />
      {notaCambiada && (
        <button
          onClick={guardarNota}
          disabled={guardandoNota}
          className="mt-2 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {guardandoNota ? "Guardando…" : "Guardar nota"}
        </button>
      )}
      {ok && <span className="ml-2 text-[0.8rem] font-semibold text-ok">Guardado ✓</span>}
    </div>
  );
}
