"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  listarOportunidades, tomarOportunidad, soltarOportunidad,
  type Oportunidad,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { useNegociosGlobal } from "@/components/panel/GlobalNegocios";
import { HeroSeccion, OportunidadesIlustracion } from "@/components/panel/HeroSeccion";

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

  // Las oportunidades son GLOBALES (decisión 2026-07-22): la misma lista para
  // el usuario, SIN filtro por negocio. Las "tomas" se anclan siempre al
  // PRIMER negocio de captación (invisible y estable — así "tomada" no cambia
  // según qué negocio esté activo por debajo). Pendiente backend: migrar
  // TomaOportunidad a nivel usuario (hoy la tabla es por tenant).
  const { negocios, cargando: cargandoNegocios } = useNegociosGlobal();
  const tenantToma = negocios[0]?.tenantId;

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try { setOps(await listarOportunidades(rubro || undefined, tenantToma)); setEstado("ok"); }
    catch { setEstado("error"); }
  }, [rubro, tenantToma]);

  useEffect(() => { if (listo && !cargandoNegocios) cargar(); }, [listo, cargandoNegocios, cargar]);

  async function alternarToma(o: Oportunidad) {
    setOcupado(o.id);
    if (o.tomada) await soltarOportunidad(o.id, tenantToma);
    else await tomarOportunidad(o.id, tenantToma);
    setOcupado(null);
    // Actualización local (no recargar todo).
    setOps((prev) => prev.map((x) => (x.id === o.id ? { ...x, tomada: !x.tomada } : x)));
  }

  const visibles = soloMias ? ops.filter((o) => o.tomada) : ops;

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <HeroSeccion
        titulo="Vende para otros negocios y cobra comisión"
        bajada={<>Empresas que buscan vendedores publican acá lo que pagan por cada cliente. Tomas la que te interesa y trabajas con tu red.</>}
        nota="Tú pones los contactos; la IA atiende los chats por ti."
        dibujo={<OportunidadesIlustracion />}
      />

      {/* Solo eyebrow + h1: la bajada vivía repetida — el hero de arriba ya
          lo dice todo (pasada UX 2026-09-06). */}
      <header>
        <p className="eyebrow">Red LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Oportunidades</h1>
      </header>

      {/* Filtro de rubro y el toggle "mías" SEPARADOS: uno es categoría, el
          otro es un interruptor — mezclados en una fila se leían como parte
          del mismo filtro. El toggle ahora dice siempre lo mismo y marca su
          estado con la estrella, no cambiando de texto. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        </div>
        <button
          onClick={() => setSoloMias((v) => !v)}
          aria-pressed={soloMias}
          className={`shrink-0 rounded-chip px-4 py-2 text-[0.85rem] font-bold transition ${
            soloMias ? "bg-brasa text-carta" : "bg-carta text-frio ring-1 ring-linea hover:ring-brasa/50"
          }`}
        >
          {soloMias ? "★ Solo las mías" : "☆ Solo las mías"}
        </button>
      </div>

      {estado === "cargando" && <SkeletonLista filas={4} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar las oportunidades. Recarga.</p>
        </div>
      )}
      {estado === "ok" && visibles.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
          <span aria-hidden className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-arena text-3xl">
            {soloMias ? "⭐" : "🔎"}
          </span>
          <p className="mt-3 text-[1.05rem] font-bold text-tinta">
            {soloMias ? "Todavía no tomaste ninguna oportunidad" : "No hay oportunidades en este rubro por ahora"}
          </p>
          <p className="mt-1 text-[0.9rem] text-frio">
            {soloMias
              ? "Cuando tomes una, aparece acá con el contacto del negocio."
              : "Se publican nuevas seguido — prueba con otro rubro o vuelve pronto."}
          </p>
          {soloMias && (
            <button
              onClick={() => setSoloMias(false)}
              className="mt-4 rounded-tarjeta bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition active:scale-[0.99]"
            >
              Ver todas las oportunidades
            </button>
          )}
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

              {/* LA COMISIÓN ES EL PRODUCTO (pasada UX 2026-09-06): es lo
                  que decide si la tomas, y pesaba lo mismo que la zona. Ahora
                  es un chip verde que se ve desde lejos. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ok/10 px-3 py-1 text-[0.88rem] font-bold text-ok ring-1 ring-ok/25">
                  💰 {o.comision}
                </span>
                <span className="rounded-full bg-arena px-3 py-1 text-[0.82rem] text-tinta-2 ring-1 ring-linea">
                  📍 {o.zona}
                </span>
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
