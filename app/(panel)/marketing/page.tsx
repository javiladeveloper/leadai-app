"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, leerSesion, leerEmpresaActiva } from "@/lib/auth";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { useCapacidadesOptimista } from "@/lib/modo-negocio";
import AnunciosPanel from "@/app/(panel)/anuncios/page";
import CampaniasPanel from "@/app/(panel)/campanias/page";

/**
 * MARKETING: TRAER CLIENTES Y HACERLOS VOLVER (2026-08-24).
 *
 * Anuncios y Campañas eran dos ítems sueltos del menú que, sueltos, no se leen
 * como lo mismo: uno trae gente nueva y el otro le vuelve a escribir a la que
 * ya vino. El dueño buscaba "lo de traer clientes" y encontraba dos entradas
 * que no se explican solas.
 *
 * Ahora son una sección con dos pestañas. Las pantallas de adentro NO se
 * reescribieron: se montan tal cual, en modo `embebido` para que no repitan el
 * título ni la barra de negocios, que ahora viven acá arriba. Reescribirlas
 * habría puesto en riesgo dos flujos que ya funcionan —crear un anuncio con
 * presupuesto real y mandar una campaña— a cambio de nada visible.
 *
 * Las rutas viejas siguen existiendo y redirigen acá: un link guardado o un
 * historial del navegador no puede terminar en 404.
 */

type Pestania = "anuncios" | "campanias";

export default function MarketingPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const [listo, setListo] = useState(false);
  const g = useSeccionGlobal();
  // CADA PESTANIA RESPETA SU CAPACIDAD. La seccion existe si al menos una
  // aplica (`requiereAlguna` en el menu); aca se decide cual se muestra.
  // Optimista y no `useCapacidades()` a secas: mientras carga se dibujan las
  // dos y despues se acorta, en vez de una pantalla vacia que crece de golpe.
  const caps = useCapacidadesOptimista();

  // La pestaña viaja en la URL para que se pueda compartir y para que el botón
  // "atrás" del navegador vuelva a la que estaba, no a la sección anterior.
  const inicial: Pestania = params.get("t") === "campanias" ? "campanias" : "anuncios";
  const [pestania, setPestania] = useState<Pestania>(inicial);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  function elegir(p: Pestania) {
    setPestania(p);
    // `replace` y no `push`: cambiar de pestaña no es navegar a otro lado, y
    // llenar el historial obligaría a apretar "atrás" una vez por pestaña.
    router.replace(`/marketing?t=${p}`, { scroll: false });
  }

  // Cual se muestra de verdad: la elegida, salvo que este negocio no la tenga.
  const mostrar: Pestania =
    pestania === "anuncios" && !caps.tieneAnuncios ? "campanias"
    : pestania === "campanias" && !caps.tieneCampanias ? "anuncios"
    : pestania;

  if (!listo) return null;

  // A qué negocio le está hablando esta pantalla (2026-08-26: mismo criterio
  // que Publicar — que el usuario nunca dude sobre qué negocio va a operar).
  const nombreNegocio = g.modoGlobal
    ? g.negocios.find((n) => n.tenantId === g.enfocado)?.nombre ?? ""
    : (() => {
        const emp = leerSesion()?.empresas ?? [];
        const activa = leerEmpresaActiva();
        return (emp.find((e) => e.tenantId === activa) ?? emp[0])?.nombre ?? "";
      })();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu embudo</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Marketing</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Trae clientes nuevos con anuncios, y haz volver a los que ya te compraron.
        </p>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {nombreNegocio && g.modoGlobal && (
        <p className="rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2">
          📣 Estás haciendo marketing para <strong className="text-tinta">{nombreNegocio}</strong>.
        </p>
      )}

      {/* LAS PESTAÑAS. Mismo patrón que las de Campañas por dentro, para que
          quien ya usó esa pantalla no tenga que aprender otro control. */}
      <div className="flex gap-1.5" role="tablist">
        {([
          { id: "anuncios", label: "Anuncios", ayuda: "Traer clientes nuevos", cap: "tieneAnuncios" },
          { id: "campanias", label: "Campañas", ayuda: "Hacer volver a los que ya vinieron", cap: "tieneCampanias" },
        ] as const).filter((p) => caps[p.cap]).map((p) => {
          const activa = mostrar === p.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={activa}
              onClick={() => elegir(p.id)}
              title={p.ayuda}
              className={`rounded-chip px-4 py-2 text-sm font-semibold transition ${
                activa
                  ? "bg-brasa text-sobre-brasa"
                  : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Cada pestaña monta su pantalla completa. Se desmonta al cambiar: son
          dos flujos con formularios propios, y dejarlos vivos escondidos haría
          que un borrador a medias reapareciera sin que nadie lo pidiera. */}
      {/* Si la pestania de la URL no aplica a este negocio —un link viejo, o
          un rubro sin esa capacidad— se muestra la otra en vez de una pantalla
          en blanco. */}
      {mostrar === "anuncios" ? <AnunciosPanel embebido /> : <CampaniasPanel embebido />}
    </div>
  );
}
