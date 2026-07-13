"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, esSuperAdmin } from "@/lib/auth";
import { obtenerProgresoEntrenamiento, type ProgresoRubro } from "@/lib/api";
import { RUBROS, etiquetaRubro } from "@/lib/rubros";
import { SkeletonLista } from "@/components/Skeletons";

// Umbral orientativo de ejemplos "ganados" para que un rubro tenga datos
// suficientes para pensar en un fine-tuning. Es una guía visual, no una regla.
const META_ENTRENAMIENTO = 500;

// Etiqueta y emoji del rubro salen de la lista canónica (lib/rubros).
const emojiRubro = (id: string) => RUBROS.find((r) => r.id === id)?.emoji ?? "💼";

export default function EntrenamientoPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [rubros, setRubros] = useState<ProgresoRubro[]>([]);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    // Panel de plataforma (datos globales): solo super admin. Un socio que
    // llegue por URL directa se va a su inicio. El backend igual bloquea (403).
    if (!esSuperAdmin()) { router.replace("/inicio"); return; }
    setListo(true);
  }, [router]);

  useEffect(() => {
    if (!listo) return;
    obtenerProgresoEntrenamiento()
      .then((r) => { setRubros(r); setEstado("ok"); })
      .catch(() => setEstado("error"));
  }, [listo]);

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Inteligencia de LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Aprendizaje por rubro</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Cada venta cerrada alimenta un dataset por rubro. Con suficientes datos, entrenamos un
          modelo especializado que hace que el bot venda mejor en ese rubro — para todos los
          negocios de ese rubro.
        </p>
      </header>

      {estado === "cargando" && <SkeletonLista filas={3} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar el progreso. Recargá.</p>
        </div>
      )}
      {estado === "ok" && rubros.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Todavía no hay datos de aprendizaje</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            A medida que se cierren ventas, cada rubro va juntando ejemplos acá.
          </p>
        </div>
      )}

      {estado === "ok" && rubros.length > 0 && (
        <div className="space-y-3">
          {rubros.map((r) => {
            const pct = Math.min(100, Math.round((r.ganados / META_ENTRENAMIENTO) * 100));
            const listo = r.ganados >= META_ENTRENAMIENTO;
            return (
              <div key={r.rubro} className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{emojiRubro(r.rubro)}</span>
                    <h3 className="text-[1.05rem] font-bold text-tinta">{etiquetaRubro(r.rubro)}</h3>
                  </div>
                  {listo && (
                    <span className="rounded-chip bg-ok/12 px-2.5 py-1 text-[0.72rem] font-bold text-ok">
                      Listo para entrenar
                    </span>
                  )}
                </div>

                {/* Barra de progreso hacia la meta */}
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-arena">
                  <div className={`h-full rounded-full transition-all ${listo ? "bg-ok" : "bg-brasa"}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.8rem]">
                  <span className="font-semibold text-ok">✓ {r.ganados.toLocaleString("es-PE")} cerradas</span>
                  <span className="text-frio">✕ {r.perdidos.toLocaleString("es-PE")} perdidas</span>
                  <span className="ml-auto text-frio">
                    {r.ganados.toLocaleString("es-PE")} / {META_ENTRENAMIENTO.toLocaleString("es-PE")} para entrenar
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-[0.78rem] text-frio">
        Los datos se guardan anonimizados y agrupados por rubro. Ningún negocio ve las
        conversaciones de otro.
      </p>
    </div>
  );
}
