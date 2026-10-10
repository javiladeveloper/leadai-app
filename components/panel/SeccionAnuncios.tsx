"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ReporteAnuncios } from "@/components/panel/ReporteAnuncios";
import { MetricasAnuncios } from "@/components/panel/MetricasAnuncios";
import { RendimientoAnuncios } from "@/components/panel/RendimientoAnuncios";
import AnunciosPanel from "@/components/panel/AnunciosPanel";
import { PublicosMeta } from "@/components/panel/PublicosMeta";
import { OrigenDeLeads } from "@/components/panel/OrigenDeLeads";
import { EmbudoAnuncios } from "@/components/panel/EmbudoAnuncios";
import { AnunciosSinConectar } from "@/components/panel/AnunciosSinConectar";
import { estadoAnuncios } from "@/lib/api";
import { rolEnEmpresaActiva } from "@/lib/auth";

const sinSuscripcion = () => () => {};

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

/**
 * `solapa` y `anuncio` (2026-10-09): Marketing los lee de la URL (`?s=` y
 * `?ad=`) y los pasa acá, así "Gestionar anuncio" desde Reportes abre "Tus
 * anuncios" con ese anuncio desplegado. Se pasan por props y no se leen de la
 * URL acá adentro: esta sección también se monta sola en los tests.
 */
export function SeccionAnuncios(props: { tenant?: string; nombreNegocio?: string; solapa?: string; anuncio?: string; alCambiarSolapa?: (s: string) => void } = {}) {
  return <ContenidoAnuncios key={props.tenant ?? "activa"} {...props} />;
}

const esSolapa = (v: string | undefined): v is Solapa => SOLAPAS.some((s) => s.id === v);

function ContenidoAnuncios({
  tenant, nombreNegocio, solapa: solapaInicial, anuncio, alCambiarSolapa,
}: { tenant?: string; nombreNegocio?: string; solapa?: string; anuncio?: string; alCambiarSolapa?: (s: string) => void }) {
  const [solapa, setSolapaEstado] = useState<Solapa>(anuncio ? "anuncios" : esSolapa(solapaInicial) ? solapaInicial : "resumen");
  const setSolapa = (s: Solapa) => { setSolapaEstado(s); alCambiarSolapa?.(s); };
  const esMarketing = useSyncExternalStore(sinSuscripcion, () => rolEnEmpresaActiva() === "marketing", () => false);
  const [dias, setDias] = useState<7 | 30 | 90>(30);
  const [creadorVisitado, setCreadorVisitado] = useState(false);
  const [solicitudHistorial, setSolicitudHistorial] = useState(0);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  // `null` mientras carga: sin esto parpadea la pantalla de "conectá tu cuenta"
  // antes de saber si ya está conectada, que se ve peor que esperar un instante.
  const [conectada, setConectada] = useState<boolean | null>(null);

  // Sube al conectar la cuenta desde "Conectar mi cuenta de Meta": relee el
  // estado y aparecen las pestañas sin recargar la página.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vivo = true;
    setConectada(null);
    setError(false);
    void estadoAnuncios(tenant).then((e) => {
      if (!vivo) return;
      if (!e) setError(true);
      else setConectada(e.conectada);
    }).catch(() => { if (vivo) setError(true); });
    return () => { vivo = false; };
  }, [tenant, intento, version]);

  if (error) return <div role="alert" className="space-y-2 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
    <p>No pudimos comprobar la conexión de anuncios de este negocio.</p>
    <button type="button" onClick={() => setIntento(i => i + 1)} className="font-semibold text-brasa-texto">Reintentar</button>
  </div>;

  if (conectada === null) {
    return <div role="status" aria-label="Cargando conexión de anuncios" className="h-48 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  }
  // Sin cuenta NO se pintan las pestañas: mostrar navegación que no lleva a
  // ningún lado es lo que hace que alguien toque cinco veces antes de entender.
  if (!conectada) {
    return <AnunciosSinConectar tenant={tenant} onConectada={() => { setSolapa("crear"); setVersion((v) => v + 1); }} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-linea pb-5">
        <div>
          <h2 className="text-[1.55rem] font-bold tracking-[-0.02em] text-tinta">Anuncios</h2>
          <p className="mt-1 max-w-[65ch] text-[0.85rem] text-tinta-2">Consulta qué resultados están medidos y prepara el siguiente anuncio para este negocio.</p>
        </div>
        {solapa !== "crear" && <button type="button" onClick={() => { setCreadorVisitado(true); setSolapa("crear"); }} className="rounded-xl bg-orbita px-5 text-[0.8rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa-texto">Crear anuncio</button>}
      </div>
      <div className="mt-4 flex gap-5 overflow-x-auto border-b border-linea" aria-label="Vistas de anuncios">
        {SOLAPAS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={solapa === s.id}
            onClick={() => { setSolapa(s.id); if (s.id === "crear") setCreadorVisitado(true); }}
            title={s.ayuda}
            className={`min-h-12 shrink-0 border-b-2 px-1 py-2 text-[0.8rem] font-semibold transition ${
              solapa === s.id
                ? "border-brasa-texto text-tinta"
                : "border-transparent text-frio hover:text-tinta"
            }`}
          >
            {s.etiqueta}
          </button>
        ))}
      </div>

      {(solapa === "resumen" || solapa === "anuncios") && <label className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-tinta">
        Período del reporte
        <select aria-label="Período del reporte" value={dias} onChange={e => {
          const n = Number(e.target.value);
          if (n === 7 || n === 30 || n === 90) setDias(n);
        }} className="rounded-tarjeta bg-carta px-3 py-2 text-base ring-1 ring-linea focus:ring-brasa">
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </label>}
      {/* El creador conserva su instancia entre solapas; el borrador local
          permite retomar también después de salir de Marketing o recargar. */}
      <div className="mt-4">
        {solapa === "resumen" && (
          <div className="space-y-4">
            {/* EL MARKETERO NO PIDE /reportes/anuncios (2026-10-07): en negocios
                de pedidos trae las VENTAS, y ese puesto no ve la plata del
                negocio. Tiene la misma tabla —con campaña, conjunto, fechas y
                demos— en Reportes → Publicidad; se le manda allá en vez de
                pintarle un error. */}
            {esMarketing ? (
              <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
                <h3 className="text-[1.05rem] font-bold text-tinta">Rendimiento de tus anuncios</h3>
                <p className="mt-1 text-sm text-frio">
                  El detalle por anuncio —gasto, leads, demos, costo por lead y por demo, con campaña, conjunto y fechas— está en Reportes.
                </p>
                <Link href="/reportes" className="mt-3 inline-flex rounded-chip bg-brasa px-4 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo">
                  Ver en Reportes → Publicidad
                </Link>
              </div>
            ) : (
              <ReporteAnuncios tenant={tenant} dias={dias} />
            )}
            {/* DE DÓNDE TE ESCRIBEN. Se queda en Resumen porque mide gente que
                escribió —no clics— y es lo que responde si conviene el gasto.
                El embudo, en cambio, explica el PORQUÉ: eso es análisis. */}
            <OrigenDeLeads tenant={tenant} dias={dias} />
          </div>
        )}
        {solapa === "anuncios" && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setSolicitudHistorial(n => n + 1);
                setCreadorVisitado(true);
                setSolapa("crear");
              }}
              className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-brasa-texto ring-1 ring-linea transition hover:bg-arena focus-visible:outline-2 focus-visible:outline-brasa"
            >
              Ver borradores
            </button>
            <MetricasAnuncios tenant={tenant} dias={dias} abrir={anuncio} />
            {/* El embudo va ACÁ y no en Resumen: responde "en qué paso se cae
                la gente de este anuncio", que es una pregunta de análisis. */}
            <EmbudoAnuncios tenant={tenant} dias={dias} />
            <RendimientoAnuncios tenant={tenant} dias={dias} />
          </div>
        )}
        {solapa === "publicos" && <PublicosMeta tenant={tenant} />}
        {creadorVisitado && <div hidden={solapa !== "crear"}>
          <AnunciosPanel embebido tenant={tenant} nombreNegocio={nombreNegocio} solicitudHistorial={solicitudHistorial} />
        </div>}
      </div>
    </div>
  );
}
