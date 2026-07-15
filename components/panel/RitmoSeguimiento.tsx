"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlan, guardarMiPlan, type RitmoSeguimiento as Ritmo } from "@/lib/api";

// Los 3 presets de ritmo de seguimiento. Cada uno explica CUÁNDO se manda cada
// uno de los 3 seguimientos (deben coincidir con RITMOS en el backend).
const OPCIONES: { id: Ritmo; titulo: string; tiempos: string; para: string }[] = [
  {
    id: "suave",
    titulo: "Suave",
    tiempos: "a las 8 horas → 3 días → 7 días",
    para: "Decisiones lentas (inmobiliaria, servicios caros).",
  },
  {
    id: "normal",
    titulo: "Normal",
    tiempos: "a las 4 horas → 1 día → 3 días",
    para: "Equilibrado. Sirve para la mayoría de negocios.",
  },
  {
    id: "insistente",
    titulo: "Insistente",
    tiempos: "a las 2 horas → 12 horas → 1 día",
    para: "Ofertas o promos con urgencia.",
  },
];

// Selector del ritmo con que el bot hace los seguimientos automáticos a los
// leads que quedaron interesados pero no cerraron.
export function RitmoSeguimiento() {
  const [ritmo, setRitmo] = useState<Ritmo | null>(null);
  const [guardando, setGuardando] = useState<Ritmo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerMiPlan().then((p) => setRitmo(p?.ritmoSeguimiento ?? "normal"));
  }, []);

  async function elegir(nuevo: Ritmo) {
    if (nuevo === ritmo || guardando) return;
    const previo = ritmo;
    setRitmo(nuevo); // optimista
    setGuardando(nuevo);
    setError("");
    const r = await guardarMiPlan({ ritmoSeguimiento: nuevo });
    setGuardando(null);
    if (!r.ok) {
      setRitmo(previo); // revertir
      setError(r.error ?? "No se pudo guardar. Probá de nuevo.");
    }
  }

  return (
    <div className="mt-6 border-t border-linea pt-6">
      <h3 className="text-[0.98rem] font-bold text-tinta">Ritmo de seguimiento</h3>
      <p className="mt-1 text-[0.82rem] text-frio">
        Cuando un cliente queda interesado pero no cierra, el bot le manda hasta 3
        recordatorios automáticos. Elegí cada cuánto.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {OPCIONES.map((o) => {
          const activo = ritmo === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => elegir(o.id)}
              disabled={ritmo === null}
              className={`flex flex-col rounded-tarjeta border p-3.5 text-left transition ${
                activo
                  ? "border-brasa bg-brasa-suave ring-1 ring-brasa"
                  : "border-linea bg-carta hover:border-brasa/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.92rem] font-bold text-tinta">{o.titulo}</span>
                {activo && <span className="text-[0.72rem] font-bold text-brasa-hondo">✓ Activo</span>}
                {guardando === o.id && <span className="text-[0.72rem] text-frio">Guardando…</span>}
              </div>
              <span className="mt-1.5 font-mono text-[0.76rem] text-tinta-2">{o.tiempos}</span>
              <span className="mt-1 text-[0.76rem] text-frio">{o.para}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-[0.8rem] text-brasa-hondo">{error}</p>}
    </div>
  );
}
