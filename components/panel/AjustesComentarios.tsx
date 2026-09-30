"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlanComentarios, guardarMiPlan } from "@/lib/api";

// Ajustes simples de la respuesta automática a comentarios: activar/desactivar
// y personalizar el mensaje de invitación al privado. Le da control al negocio
// sin un editor de flujo complejo.
export function AjustesComentarios({ tenant }: { tenant?: string }) {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerMiPlanComentarios(tenant).then((p) => {
      if (!vigente) return;
      setActivo(p.comentariosActivo);
      setMensaje(p.comentariosMensaje ?? "");
      setError("");
    }).catch((e: unknown) => {
      if (vigente) setError(e instanceof Error ? e.message : "No pudimos cargar los ajustes.");
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [tenant, intento]);

  async function toggle(nuevo: boolean) {
    const anterior = activo;
    setActivo(nuevo); // optimista
    setError("");
    setGuardando(true);
    const r = await guardarMiPlan({ comentariosActivo: nuevo }, tenant);
    setGuardando(false);
    if (!r.ok) { setActivo(anterior); setError(r.error ?? "No pudimos cambiar este ajuste."); }
  }

  async function guardarMensaje() {
    setGuardando(true);
    setOk(false);
    setError("");
    const r = await guardarMiPlan({ comentariosMensaje: mensaje.trim() }, tenant);
    setGuardando(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 2000); }
    else setError(r.error ?? "No pudimos guardar el mensaje.");
  }

  if (cargando) return <div className="rounded-tarjeta bg-carta p-5 text-sm text-frio ring-1 ring-linea">Cargando ajustes de comentarios…</div>;
  if (activo === null) return <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea"><p role="alert" className="text-sm text-calor-hondo">{error || "No pudimos cargar los ajustes."}</p><button onClick={() => { setCargando(true); setIntento((n) => n + 1); }} className="mt-2 font-semibold text-brasa-texto">Reintentar</button></div>;

  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-bold text-tinta">Respuesta automática</h2>
          <p className="mt-0.5 text-[0.82rem] text-frio">
            Cuando está activa, la IA responde preguntas y consultas de compra; agradece los halagos.
          </p>
        </div>
        {/* Switch simple */}
        <button
          onClick={() => toggle(!activo)}
          disabled={guardando}
          role="switch"
          aria-checked={activo}
          aria-label="Respuesta automática a comentarios"
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? "bg-brasa" : "bg-linea"}`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-carta transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`}
          />
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-[0.82rem] text-calor-hondo">{error}</p>}

      {activo && (
        <div className="mt-4 border-t border-linea pt-4">
          <label className="text-[0.88rem] font-bold text-tinta">
            Mensaje al invitar al privado <span className="font-normal text-frio">(opcional)</span>
          </label>
          <p className="mt-0.5 text-[0.8rem] text-frio">
            Déjalo vacío para que la IA lo redacte sola, o escribe uno fijo.
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
              className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
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
