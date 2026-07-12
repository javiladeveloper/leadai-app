"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { listarFlujos, crearFlujo, eliminarFlujo, actualizarFlujo, type Flujo } from "@/lib/api";
import { PLANTILLA_FLUJO } from "@/lib/flujos";
import { SkeletonLista } from "@/components/Skeletons";

export default function FlujosPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [flujos, setFlujos] = useState<Flujo[]>([]);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  async function cargar() {
    setEstado("cargando");
    try { setFlujos(await listarFlujos()); setEstado("ok"); }
    catch { setEstado("error"); }
  }
  useEffect(() => { if (listo) cargar(); }, [listo]);

  async function nuevo() {
    setCreando(true);
    const r = await crearFlujo("Flujo sin nombre", PLANTILLA_FLUJO);
    setCreando(false);
    if (r.ok && r.flujo) router.push(`/flujos/${r.flujo.id}`);
  }

  async function alternarActivo(f: Flujo) {
    await actualizarFlujo(f.id, { activo: !f.activo });
    cargar();
  }

  async function borrar(f: Flujo) {
    await eliminarFlujo(f.id);
    cargar();
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
              <button onClick={() => router.push(`/flujos/${f.id}`)} className="min-w-0 flex-1 text-left">
                <p className="font-semibold text-tinta hover:text-brasa">{f.nombre}</p>
                <p className="text-[0.8rem] text-frio">{f.grafo.nodos.length} pasos</p>
              </button>
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
