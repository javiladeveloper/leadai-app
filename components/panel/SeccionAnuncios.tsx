"use client";

import { useEffect, useState } from "react";
import { ReporteAnuncios } from "@/components/panel/ReporteAnuncios";
import { MetricasAnuncios } from "@/components/panel/MetricasAnuncios";
import { RendimientoAnuncios } from "@/components/panel/RendimientoAnuncios";
import AnunciosPanel from "@/components/panel/AnunciosPanel";
import { PublicosMeta } from "@/components/panel/PublicosMeta";
import { OrigenDeLeads } from "@/components/panel/OrigenDeLeads";
import { EmbudoAnuncios } from "@/components/panel/EmbudoAnuncios";
import { AnunciosSinConectar } from "@/components/panel/AnunciosSinConectar";
import { estadoAnuncios } from "@/lib/api";

/**
 * ANUNCIOS, ORDENADO POR PREGUNTA (2026-09-17, pedido de Jonathan: "organiza
 * bien lo que tenemos que no se vea desordenado"; revisado 2026-09-18).
 *
 * TRES PROBLEMAS QUE TENÍA LA VERSIÓN ANTERIOR, y qué se hizo con cada uno:
 *
 *  1. QUIEN NO CONECTÓ META VEÍA CINCO PESTAÑAS VACÍAS. Son 34 de los 36
 *     negocios —verificado en la base—, así que era la primera impresión de la
 *     sección para casi todos: parecía que el producto no funciona, cuando lo
 *     que falta es un paso de configuración. Ahora, sin cuenta conectada, se
 *     muestra una sola pantalla que explica qué se puede hacer y cómo empezar.
 *
 *  2. "CADA ANUNCIO" Y "QUÉ FUNCIONÓ" MOSTRABAN CASI LO MISMO: las dos traían
 *     gasto, clics, CTR e impresiones, y solo cambiaba que una agregaba
 *     tendencia y desgloses. Eran dos lugares para el mismo anuncio, con
 *     títulos que no ayudaban a elegir. Se juntan en "Tus anuncios".
 *
 *  3. "RESUMEN" TENÍA TRES BLOQUES APILADOS —ROAS, de dónde escriben y el
 *     embudo completo—, tres pantallas de scroll. El embudo es detalle de
 *     análisis y se movió; Resumen vuelve a responder una sola pregunta.
 *
 * El orden sigue siendo por PREGUNTA, no por dato:
 *
 *   Resumen      → ¿me conviene lo que gasto?
 *   Tus anuncios → ¿qué pasó con cada uno y cuál rinde?
 *   Públicos     → ¿a quién quiero que le llegue?
 *   Crear        → quiero lanzar uno nuevo
 */

const SOLAPAS = [
  { id: "resumen", etiqueta: "Resumen", ayuda: "¿Me conviene lo que gasto?" },
  { id: "anuncios", etiqueta: "Tus anuncios", ayuda: "Qué pasó con cada uno y cuál rinde" },
  { id: "publicos", etiqueta: "A quién le llega", ayuda: "Subir tus propios contactos" },
  { id: "crear", etiqueta: "Crear anuncio", ayuda: "Lanzar uno nuevo" },
] as const;

type Solapa = (typeof SOLAPAS)[number]["id"];

export function SeccionAnuncios({ tenant }: { tenant?: string } = {}) {
  const [solapa, setSolapa] = useState<Solapa>("resumen");
  // `null` mientras carga: sin esto parpadea la pantalla de "conectá tu cuenta"
  // antes de saber si ya está conectada, que se ve peor que esperar un instante.
  const [conectada, setConectada] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    setConectada(null);
    void estadoAnuncios(tenant).then((e) => {
      // Si la consulta falla se asume CONECTADA: dejar ver pestañas vacías es
      // menos grave que esconderle la sección a quien sí tiene cuenta.
      if (vivo) setConectada(e === null ? true : e.conectada);
    });
    return () => { vivo = false; };
  }, [tenant]);

  if (conectada === null) {
    return <div className="h-48 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  }
  // Sin cuenta NO se pintan las pestañas: mostrar navegación que no lleva a
  // ningún lado es lo que hace que alguien toque cinco veces antes de entender.
  if (!conectada) return <AnunciosSinConectar />;

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
        {solapa === "resumen" && (
          <div className="space-y-4">
            <ReporteAnuncios tenant={tenant} />
            {/* DE DÓNDE TE ESCRIBEN. Se queda en Resumen porque mide gente que
                escribió —no clics— y es lo que responde si conviene el gasto.
                El embudo, en cambio, explica el PORQUÉ: eso es análisis. */}
            <OrigenDeLeads tenant={tenant} />
          </div>
        )}
        {solapa === "anuncios" && (
          <div className="space-y-4">
            <MetricasAnuncios tenant={tenant} />
            {/* El embudo va ACÁ y no en Resumen: responde "en qué paso se cae
                la gente de este anuncio", que es una pregunta de análisis. */}
            <EmbudoAnuncios tenant={tenant} />
            <RendimientoAnuncios tenant={tenant} />
          </div>
        )}
        {solapa === "publicos" && <PublicosMeta tenant={tenant} />}
        {solapa === "crear" && <AnunciosPanel embebido />}
      </div>
    </div>
  );
}
