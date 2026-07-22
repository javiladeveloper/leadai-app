"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { listarFlujos, crearFlujo, eliminarFlujo, actualizarFlujo, type Flujo, type CanalFlujo } from "@/lib/api";
import { PLANTILLA_FLUJO } from "@/lib/flujos";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";

export default function FlujosPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [flujos, setFlujos] = useState<Flujo[]>([]);
  const [creando, setCreando] = useState(false);
  const [errorCrear, setErrorCrear] = useState("");
  // Modo global: barra de negocios arriba, la lista se lee del negocio
  // enfocado; cualquier acción (crear/activar/borrar/editar) adopta ese
  // negocio como empresa activa (g.adoptar — "clavado").
  const g = useSeccionGlobal();

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  async function cargar() {
    setEstado("cargando");
    try { setFlujos(await listarFlujos(g.tenantLista)); setEstado("ok"); }
    catch { setEstado("error"); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (listo && g.listaLista) cargar(); }, [listo, g.listaLista, g.tenantLista]);

  async function nuevo() {
    setCreando(true);
    setErrorCrear("");
    const r = await crearFlujo("Flujo sin nombre", PLANTILLA_FLUJO, g.tenantLista);
    setCreando(false);
    // El editor (/flujos/[id]) es por empresa: al entrar se adopta el negocio
    // enfocado ("clavado" — sale del modo global).
    if (r.ok && r.flujo) { g.adoptar(); router.push(`/flujos/${r.flujo.id}`); }
    // Antes el error se tragaba en silencio (ej. límite de flujos del plan):
    // el botón "cargaba" y no pasaba nada.
    else setErrorCrear(r.error ?? "No se pudo crear el flujo.");
  }

  // Cambios OPTIMISTAS (2026-07-22, feedback: "demoró demasiado"): el estado
  // local cambia AL INSTANTE y el PATCH corre por detrás; si falla, se
  // recarga del servidor para volver a la verdad. Nada de skeleton por un
  // toggle.
  async function alternarActivo(f: Flujo) {
    setFlujos((prev) => prev.map((x) => (x.id === f.id ? { ...x, activo: !f.activo } : x)));
    const r = await actualizarFlujo(f.id, { activo: !f.activo }, g.tenantLista);
    if (!r.ok) cargar();
  }

  async function borrar(f: Flujo) {
    setFlujos((prev) => prev.filter((x) => x.id !== f.id));
    const r = await eliminarFlujo(f.id, g.tenantLista);
    if (!r.ok) cargar();
  }

  // En qué red corre el flujo. Al entrar un mensaje, el flujo específico del
  // canal GANA al general "Todas" (backend: core/flujo-motor.ts).
  async function cambiarCanal(f: Flujo, canal: CanalFlujo) {
    setFlujos((prev) => prev.map((x) => (x.id === f.id ? { ...x, canal } : x)));
    const r = await actualizarFlujo(f.id, { canal }, g.tenantLista);
    if (!r.ok) cargar();
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Automatización</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Flujos del bot</h1>
          <p className="mt-1 text-[0.92rem] text-frio">Armá cómo responde el bot paso a paso.</p>
        </div>
        <button onClick={nuevo} disabled={creando}
          className="rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition hover:bg-brasa-hondo active:scale-[0.99] disabled:opacity-60">
          {creando ? "Creando…" : "+ Nuevo flujo"}
        </button>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {errorCrear && (
        <div className="rounded-tarjeta bg-calor/10 px-4 py-3 text-[0.9rem] font-semibold text-calor ring-1 ring-calor/30">
          {errorCrear}
        </div>
      )}

      {estado === "cargando" && <SkeletonLista filas={3} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar los flujos. Recargá.</p>
        </div>
      )}
      {estado === "ok" && flujos.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Todavía no tenés flujos</p>
          <p className="mt-1 text-[0.9rem] text-frio">Creá uno para que el bot siga un guion.</p>
        </div>
      )}
      {estado === "ok" && flujos.length > 0 && (
        <div className="space-y-3">
          {flujos.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
              <button onClick={() => { g.adoptar(); router.push(`/flujos/${f.id}`); }} className="min-w-0 flex-1 text-left">
                <p className="font-semibold text-tinta hover:text-brasa">{f.nombre}</p>
                <p className="text-[0.8rem] text-frio">{f.grafo.nodos.length} pasos</p>
              </button>
              {/* ¿En qué red corre? El específico del canal gana al general. */}
              <select
                value={f.canal ?? ""}
                onChange={(e) => cambiarCanal(f, (e.target.value || null) as CanalFlujo)}
                aria-label="Red donde corre este flujo"
                className="rounded-lg border border-linea bg-arena/50 px-2 py-1.5 text-[0.8rem] font-semibold text-tinta-2"
              >
                <option value="">🌐 Todas las redes</option>
                <option value="whatsapp">💬 Solo WhatsApp</option>
                <option value="instagram">📸 Solo Instagram</option>
                <option value="messenger">💠 Solo Messenger</option>
                <option value="tiktok">🎵 Solo TikTok</option>
              </select>
              <span className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${f.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"}`}>
                {f.activo ? "Activo" : "Apagado"}
              </span>
              <button onClick={() => alternarActivo(f)} className="text-sm font-semibold text-tinta-2 hover:text-tinta">
                {f.activo ? "Apagar" : "Activar"}
              </button>
              <button onClick={() => borrar(f)} className="text-sm font-semibold text-frio hover:text-brasa-hondo">
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
