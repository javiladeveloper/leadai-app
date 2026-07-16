"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlan, guardarMiPlan } from "@/lib/api";

// Ajustes simples de la respuesta automática a comentarios: activar/desactivar
// y personalizar el mensaje de invitación al privado. Le da control al negocio
// sin un editor de flujo complejo.
export function AjustesComentarios() {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    obtenerMiPlan().then((p) => {
      if (p) {
        setActivo(p.comentariosActivo);
        setMensaje(p.comentariosMensaje ?? "");
      }
    });
  }, []);

  async function toggle(nuevo: boolean) {
    setActivo(nuevo); // optimista
    await guardarMiPlan({ comentariosActivo: nuevo });
  }

  async function guardarMensaje() {
    setGuardando(true);
    setOk(false);
    const r = await guardarMiPlan({ comentariosMensaje: mensaje.trim() });
    setGuardando(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  if (activo === null) return null; // cargando

  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-bold text-tinta">Respuesta automática</h2>
          <p className="mt-0.5 text-[0.82rem] text-frio">
            Cuando está activa, la IA responde los comentarios con intención de compra.
          </p>
        </div>
        {/* Switch simple */}
        <button
          onClick={() => toggle(!activo)}
          role="switch"
          aria-checked={activo}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? "bg-brasa" : "bg-linea"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-carta transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>

      {activo && (
        <div className="mt-4 border-t border-linea pt-4">
          <label className="text-[0.88rem] font-bold text-tinta">
            Mensaje al invitar al privado <span className="font-normal text-frio">(opcional)</span>
          </label>
          <p className="mt-0.5 text-[0.8rem] text-frio">
            Dejalo vacío para que la IA lo redacte sola, o escribí uno fijo.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              maxLength={300}
              placeholder="Ej: ¡Hola! Te escribo al DM con la info 📩"
              className="flex-1 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
            <button
              onClick={guardarMensaje}
              disabled={guardando}
              className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
            >
              {guardando ? "…" : "Guardar"}
            </button>
          </div>
          {ok && <p className="mt-1.5 text-[0.8rem] font-semibold text-ok">✓ Guardado</p>}
        </div>
      )}
    </div>
  );
}
