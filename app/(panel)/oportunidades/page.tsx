"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  listarOportunidades, tomarOportunidad, soltarOportunidad,
  type Oportunidad,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";

type Estado = "cargando" | "ok" | "error";

// Rubros para filtrar (mismos que la landing de captación).
const RUBROS: { id: string; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "arquitecto", label: "Construcción" },
  { id: "contador", label: "Contable" },
  { id: "software", label: "Software" },
  { id: "inmobiliaria", label: "Inmobiliaria" },
];

const EMOJI_RUBRO: Record<string, string> = {
  arquitecto: "🏗️", contador: "📊", software: "💻", inmobiliaria: "🏠",
};

export default function OportunidadesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ops, setOps] = useState<Oportunidad[]>([]);
  const [rubro, setRubro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [soloMias, setSoloMias] = useState(false);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  // Modo global: la barra de negocios elige desde cuál mirar/tomar (las
  // oportunidades son de la red, pero "tomada" depende del negocio que mira).
  const g = useSeccionGlobal();

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try { setOps(await listarOportunidades(rubro || undefined, g.tenantLista)); setEstado("ok"); }
    catch { setEstado("error"); }
  }, [rubro, g.tenantLista]);

  useEffect(() => { if (listo && g.listaLista) cargar(); }, [listo, g.listaLista, cargar]);

  async function alternarToma(o: Oportunidad) {
    setOcupado(o.id);
    if (o.tomada) await soltarOportunidad(o.id, g.tenantLista);
    else await tomarOportunidad(o.id, g.tenantLista);
    setOcupado(null);
    // Actualización local (no recargar todo).
    setOps((prev) => prev.map((x) => (x.id === o.id ? { ...x, tomada: !x.tomada } : x)));
  }

  const visibles = soloMias ? ops.filter((o) => o.tomada) : ops;

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Red LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Oportunidades</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Negocios que buscan vendedores. Tomá las que te interesen y traéles clientes con tu red + la IA.
        </p>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {/* Filtros por rubro */}
      <div className="flex flex-wrap gap-2">
        {RUBROS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRubro(r.id)}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.88rem] font-bold transition ${
              rubro === r.id ? "bg-tinta text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {r.label}
          </button>
        ))}
        <button
          onClick={() => setSoloMias((v) => !v)}
          className={`ml-auto shrink-0 rounded-chip px-4 py-2 text-[0.82rem] font-semibold transition ${
            soloMias ? "bg-brasa-suave text-brasa-hondo" : "bg-carta text-frio ring-1 ring-linea"
          }`}
        >
          {soloMias ? "★ Mis oportunidades" : "Ver solo las mías"}
        </button>
      </div>

      {estado === "cargando" && <SkeletonLista filas={4} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar las oportunidades. Recargá.</p>
        </div>
      )}
      {estado === "ok" && visibles.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            {soloMias ? "Todavía no tomaste ninguna oportunidad" : "No hay oportunidades por ahora"}
          </p>
          <p className="mt-1 text-[0.9rem] text-frio">Volvé pronto — se publican nuevas seguido.</p>
        </div>
      )}

      {estado === "ok" && visibles.length > 0 && (
        <div className="grid gap-3">
          {visibles.map((o) => (
            <div key={o.id} className={`rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 transition ${o.tomada ? "ring-2 ring-brasa/40" : "ring-linea"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{EMOJI_RUBRO[o.rubro] ?? "💼"}</span>
                    <h3 className="text-[1.05rem] font-bold text-tinta">{o.titulo}</h3>
                  </div>
                  <p className="mt-1 text-[0.9rem] text-tinta-2">{o.descripcion}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.82rem]">
                <span className="font-semibold text-ok">💰 {o.comision}</span>
                <span className="text-frio">📍 {o.zona}</span>
              </div>

              {/* Al tomarla, se muestra el contacto del negocio */}
              {o.tomada && (
                <div className="mt-3 rounded-lg bg-ok/8 px-3 py-2 text-[0.85rem]">
                  <span className="font-semibold text-tinta">Contacto del negocio: </span>
                  <span className="text-tinta-2">{o.contacto}</span>
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => alternarToma(o)}
                  disabled={ocupado === o.id}
                  className={`rounded-chip px-4 py-2 text-[0.85rem] font-bold transition disabled:opacity-50 ${
                    o.tomada
                      ? "bg-arena text-frio ring-1 ring-linea hover:bg-linea"
                      : "bg-brasa text-carta hover:bg-brasa-hondo"
                  }`}
                >
                  {o.tomada ? "Dejar de trabajarla" : "Tomar esta oportunidad"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
