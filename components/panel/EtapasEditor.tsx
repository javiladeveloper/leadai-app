"use client";

import { useEffect, useState } from "react";
import {
  obtenerEtapas, guardarEtapas,
  type EtapaEmbudo,
} from "@/lib/api";

// Editor de las ETAPAS PERSONALIZADAS del embudo (rediseño 2026-08-04, estilo
// Clinera): cada negocio define sus etapas (nombre, color) y a qué estado del
// MOTOR corresponde cada una — la IA/nutrición/reportes no cambian. Ejemplo de
// una clínica: "Confirma asistencia" (seguimiento), "Paciente" (ganado).
const COLORES: { id: EtapaEmbudo["color"]; clase: string }[] = [
  { id: "brasa", clase: "bg-brasa" },
  { id: "tibio", clase: "bg-tibio" },
  { id: "calor", clase: "bg-calor" },
  { id: "ok", clase: "bg-ok" },
  { id: "frio", clase: "bg-frio" },
];

const MOTORES: { id: EtapaEmbudo["motor"]; label: string }[] = [
  { id: "nuevo", label: "Lead nuevo (la IA lo atiende)" },
  { id: "nutriendo", label: "En seguimiento (la IA nutre)" },
  { id: "escalado", label: "Lo atiende un humano" },
  { id: "ganado", label: "Cierre ganado ✓" },
  { id: "perdido", label: "Cierre perdido ✕" },
];

function idDesde(nombre: string): string {
  const base = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `${base || "etapa"}-${Math.random().toString(36).slice(2, 6)}`;
}

export function EtapasEditor() {
  const [etapas, setEtapas] = useState<EtapaEmbudo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    obtenerEtapas().then((e) => {
      setEtapas(e);
      setCargando(false);
    });
  }, []);

  function cambiar(i: number, cambios: Partial<EtapaEmbudo>) {
    setEtapas(etapas.map((e, j) => (j === i ? { ...e, ...cambios } : e)));
    setMensaje(null);
  }

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= etapas.length) return;
    const copia = [...etapas];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setEtapas(copia);
  }

  function agregar() {
    if (etapas.length >= 12) return;
    setEtapas([
      ...etapas,
      { id: idDesde("etapa nueva"), nombre: "Etapa nueva", color: "tibio", motor: "nutriendo" },
    ]);
  }

  async function guardar() {
    setGuardando(true);
    setMensaje(null);
    const r = await guardarEtapas(etapas);
    setMensaje(
      r.ok
        ? { ok: true, texto: "Etapas guardadas. Tu bandeja ya las usa." }
        : { ok: false, texto: r.error ?? "No se pudieron guardar." },
    );
    setGuardando(false);
  }

  if (cargando) return null;

  return (
    <section className="mt-6 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <h3 className="text-[1rem] font-bold text-tinta">Etapas de tu embudo</h3>
      <p className="mb-4 mt-1 text-[0.82rem] text-frio">
        Ponéles los nombres de TU proceso de venta (ej. &quot;Visita agendada&quot;,
        &quot;Cotización enviada&quot;). Cada etapa se conecta a un comportamiento del bot —
        eso no cambia, solo cómo la ves en tu bandeja.
      </p>

      <div className="space-y-2">
        {etapas.map((e, i) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-arena/50 p-2 ring-1 ring-linea">
            <div className="flex flex-col">
              <button onClick={() => mover(i, -1)} disabled={i === 0} className="px-1 text-[0.7rem] text-frio disabled:opacity-30">▲</button>
              <button onClick={() => mover(i, 1)} disabled={i === etapas.length - 1} className="px-1 text-[0.7rem] text-frio disabled:opacity-30">▼</button>
            </div>
            <input
              value={e.nombre}
              onChange={(ev) => cambiar(i, { nombre: ev.target.value.slice(0, 30) })}
              className="w-44 flex-1 rounded-lg bg-carta px-2.5 py-1.5 text-[0.88rem] font-semibold text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
            />
            <div className="flex items-center gap-1">
              {COLORES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => cambiar(i, { color: c.id })}
                  aria-label={`Color ${c.id}`}
                  className={`h-5 w-5 rounded-full ${c.clase} ${e.color === c.id ? "ring-2 ring-tinta ring-offset-1" : "opacity-50"}`}
                />
              ))}
            </div>
            <select
              value={e.motor}
              onChange={(ev) => cambiar(i, { motor: ev.target.value as EtapaEmbudo["motor"] })}
              className="rounded-lg bg-carta px-2 py-1.5 text-[0.8rem] text-tinta-2 outline-none ring-1 ring-linea"
            >
              {MOTORES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={() => setEtapas(etapas.filter((_, j) => j !== i))}
              disabled={etapas.length <= 2}
              className="ml-auto rounded-chip px-2 py-1 text-[0.75rem] font-bold text-frio transition hover:text-calor disabled:opacity-30"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={agregar}
          disabled={etapas.length >= 12}
          className="rounded-chip px-3 py-1.5 text-[0.82rem] font-bold text-brasa-texto ring-1 ring-brasa/40 transition hover:bg-brasa/10 disabled:opacity-40"
        >
          ＋ Agregar etapa
        </button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="rounded-chip bg-brasa px-4 py-1.5 text-[0.82rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar etapas"}
        </button>
        {mensaje && (
          <p className={`text-[0.8rem] font-semibold ${mensaje.ok ? "text-ok" : "text-calor"}`}>
            {mensaje.texto}
          </p>
        )}
      </div>
    </section>
  );
}
