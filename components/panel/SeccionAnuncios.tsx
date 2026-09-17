"use client";

import { useState } from "react";
import { ReporteAnuncios } from "@/components/panel/ReporteAnuncios";
import { MetricasAnuncios } from "@/components/panel/MetricasAnuncios";
import { RendimientoAnuncios } from "@/components/panel/RendimientoAnuncios";
import AnunciosPanel from "@/components/panel/AnunciosPanel";
import { PublicosMeta } from "@/components/panel/PublicosMeta";

/**
 * ANUNCIOS, ORDENADO POR PREGUNTA (2026-09-17, pedido de Jonathan: "organiza
 * bien lo que tenemos que no se vea desordenado").
 *
 * La pestaña había crecido hasta cuatro bloques apilados —ROAS, cada anuncio,
 * el ranking, y el formulario para crear— que hacían scrollear tres pantallas
 * sin saber qué venía después. Todos útiles, ninguno jerarquizado.
 *
 * Se agrupan por la PREGUNTA que responde cada uno, no por el dato que
 * muestran:
 *
 *   Resumen  → ¿me conviene lo que estoy gastando?   (ROAS)
 *   Detalle  → ¿qué pasó con cada anuncio?           (métricas + segmentación)
 *   Análisis → ¿qué funcionó y a qué hora/público?   (ranking + desgloses)
 *   Públicos → ¿a quién quiero que le llegue?        (contactos propios)
 *   Crear    → quiero lanzar uno nuevo
 *
 * "Resumen" entra primero porque quien abre esta pestaña casi siempre viene a
 * decidir presupuesto, y eso se responde con el ROAS. El formulario de crear va
 * último: es lo que menos se hace y lo que más espacio ocupaba arriba.
 */

const SOLAPAS = [
  { id: "resumen", etiqueta: "Resumen", ayuda: "¿Me conviene lo que gasto?" },
  { id: "detalle", etiqueta: "Cada anuncio", ayuda: "¿Qué pasó con cada uno?" },
  { id: "analisis", etiqueta: "Qué funcionó", ayuda: "¿Cuál rinde y a qué hora?" },
  { id: "publicos", etiqueta: "A quién le llega", ayuda: "Subir tus propios contactos" },
  { id: "crear", etiqueta: "Crear anuncio", ayuda: "Lanzar uno nuevo" },
] as const;

type Solapa = (typeof SOLAPAS)[number]["id"];

export function SeccionAnuncios({ tenant }: { tenant?: string } = {}) {
  const [solapa, setSolapa] = useState<Solapa>("resumen");

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {SOLAPAS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSolapa(s.id)}
            title={s.ayuda}
            className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
              solapa === s.id
                ? "bg-brasa text-sobre-brasa"
                : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta hover:text-tinta"
            }`}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>

      {/* Cada solapa se desmonta al cambiar: el formulario de crear tiene
          estado propio, y dejarlo vivo escondido haría que un borrador a
          medias reapareciera sin que nadie lo pidiera. */}
      <div className="mt-4">
        {solapa === "resumen" && <ReporteAnuncios tenant={tenant} />}
        {solapa === "detalle" && <MetricasAnuncios tenant={tenant} />}
        {solapa === "analisis" && <RendimientoAnuncios tenant={tenant} />}
        {solapa === "publicos" && <PublicosMeta tenant={tenant} />}
        {solapa === "crear" && <AnunciosPanel embebido />}
      </div>
    </div>
  );
}
