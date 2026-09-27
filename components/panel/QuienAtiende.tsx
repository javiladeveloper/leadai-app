"use client";

// "QUIÉN ATIENDE LAS REUNIONES" (2026-09-26): en el Google Calendar de qué
// persona del equipo agenda el bot de ESTE negocio. Solo lo monta Equipo para
// dueño/admin (el backend igual rechaza el PUT a los demás). En un negocio
// exportado es fijo: atiende la vendedora, y el backend responde 409.

import { useEffect, useState } from "react";
import { obtenerQuienAtiende, guardarQuienAtiende, type QuienAtiende as Datos } from "@/lib/api";

export function QuienAtiende() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    obtenerQuienAtiende().then(setDatos).catch(() => setDatos(null));
  }, []);

  if (!datos) return null;
  const actual = datos.miembros.find((m) => m.usuarioId === datos.usuarioId);

  async function elegir(usuarioId: string) {
    if (!datos || !usuarioId) return;
    const anterior = datos.usuarioId;
    setDatos({ ...datos, usuarioId });
    setGuardando(true);
    setAviso(null);
    try {
      await guardarQuienAtiende(usuarioId);
      setAviso({ tipo: "ok", texto: "Guardado." });
    } catch (e) {
      setDatos({ ...datos, usuarioId: anterior });
      setAviso({ tipo: "error", texto: (e as Error).message });
    }
    setGuardando(false);
  }

  return (
    <section className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
      <p className="mb-1 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Quién atiende las reuniones</p>
      <p className="mb-3 text-[0.82rem] text-frio">El bot agenda las reuniones de este negocio en el Google Calendar de esta persona.</p>
      {datos.fijo ? (
        <p className="text-[0.92rem] text-tinta">
          Atiende <b>{actual?.nombre || actual?.email || "la vendedora"}</b> (vendedora de este negocio exportado).
        </p>
      ) : (
        <select
          value={datos.usuarioId ?? ""}
          disabled={guardando}
          onChange={(e) => void elegir(e.target.value)}
          className="w-full rounded-tarjeta border border-linea bg-arena/30 px-3 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa disabled:opacity-60 sm:w-auto"
        >
          {!datos.usuarioId && <option value="">Elige quién atiende…</option>}
          {datos.miembros.map((m) => (
            <option key={m.usuarioId} value={m.usuarioId}>
              {(m.nombre || m.email) + (m.conCalendario ? "" : " — sin calendario conectado")}
            </option>
          ))}
        </select>
      )}
      {actual && !actual.conCalendario && (
        <p className="mt-2 text-[0.82rem] text-brasa-hondo">
          Esta persona aún no conectó su Google Calendar (Configuración → Mi calendario): mientras tanto el bot anota la hora y te avisa.
        </p>
      )}
      {aviso && (
        <p className={`mt-2 text-[0.82rem] font-semibold ${aviso.tipo === "ok" ? "text-ok" : "text-brasa-hondo"}`}>{aviso.texto}</p>
      )}
    </section>
  );
}
