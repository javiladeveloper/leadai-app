"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, leerEmpresaActiva, empresasVisibles } from "@/lib/auth";
import { obtenerMiPlan } from "@/lib/api";
import { MarketingBloqueado } from "@/components/panel/MarketingBloqueado";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { useCapacidadesOptimista } from "@/lib/modo-negocio";
import AnunciosPanel from "@/app/(panel)/anuncios/page";
import CampaniasPanel from "@/app/(panel)/campanias/page";
import { PresenciaEditor } from "@/components/panel/PresenciaEditor";
import PublicarPanel from "@/app/(panel)/publicar/page";

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

type Pestania = "anuncios" | "campanias" | "presencia" | "publicar";

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
  const t = params.get("t");
  const inicial: Pestania =
    t === "campanias" ? "campanias"
    : t === "presencia" ? "presencia"
    : t === "publicar" ? "publicar"
    : "anuncios";
  const [pestania, setPestania] = useState<Pestania>(inicial);

  /**
   * ¿SU PLAN INCLUYE MARKETING? (2026-08-31, plan Full.)
   *
   * `null` mientras carga y ante un error: se muestra todo. Esconderle la
   * sección a quien SÍ la paga por un error de red es peor que mostrarla de
   * más — el backend igual la corta con un 402, así que nadie se cuela.
   *
   * Va acá y NO en `capacidades`: ese es el eje RUBRO (qué hace el negocio) y
   * este es el eje PLAN (qué está pago). Mezclarlos es lo que hace que después
   * nadie sepa por qué una sección no aparece.
   */
  const [tieneMarketing, setTieneMarketing] = useState<boolean | null>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
    obtenerMiPlan()
      .then((p) => setTieneMarketing(p?.features?.marketing ?? true))
      .catch(() => setTieneMarketing(true));
  }, [router]);

  function elegir(p: Pestania) {
    setPestania(p);
    // `replace` y no `push`: cambiar de pestaña no es navegar a otro lado, y
    // llenar el historial obligaría a apretar "atrás" una vez por pestaña.
    router.replace(`/marketing?t=${p}`, { scroll: false });
  }

  // Cual se muestra de verdad: la elegida, salvo que este negocio no la tenga.
  // `presencia` no tiene capacidad: Google Maps le sirve a cualquier negocio
  // con dirección, sea restaurante o consultorio. Por eso nunca cae de ella.
  const mostrar: Pestania =
    pestania === "anuncios" && !caps.tieneAnuncios ? "campanias"
    : pestania === "campanias" && !caps.tieneCampanias ? "anuncios"
    : pestania;

  if (!listo) return null;

  /**
   * NO SE PINTA HASTA SABER QUÉ PINTAR (2026-09-01).
   *
   * Antes `setListo(true)` corría ANTES de conocer el plan, así que la pantalla
   * mostraba las pestañas de Marketing completas y un instante después las
   * reemplazaba por el candado. Ver algo y que te lo saquen se lee como que el
   * producto se rompió — y encima, a quien no lo tiene, le mostrábamos por un
   * segundo justo lo que no puede usar.
   *
   * Es el mismo criterio que ya usa el sidebar: esperar el dato en vez de
   * adivinar y corregir después.
   */
  if (tieneMarketing === null) {
    // MISMA ESPERA QUE MI PLAN: un spinner y nada más. Un esqueleto de cajas
    // grises muestra una estructura que todavía no se sabe si es la correcta —
    // acá ni siquiera se sabe si van las pestañas o el candado del plan.
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-linea border-t-brasa" />
          <p className="text-[0.86rem] text-frio">Cargando…</p>
        </div>
      </div>
    );
  }

  // A qué negocio le está hablando esta pantalla (2026-08-26: mismo criterio
  // que Publicar — que el usuario nunca dude sobre qué negocio va a operar).
  const nombreNegocio = g.modoGlobal
    ? g.negocios.find((n) => n.tenantId === g.enfocado)?.nombre ?? ""
    : (() => {
        // `empresasVisibles` y no la sesión: en soporte el negocio ajeno no
        // está en tus empresas, y el fallback a `[0]` pondría el nombre de TU
        // primer negocio encima de los datos del cliente.
        const emp = empresasVisibles();
        const activa = leerEmpresaActiva();
        return (emp.find((e) => e.tenantId === activa) ?? emp[0])?.nombre ?? "";
      })();

  /**
   * EL CANDADO SE VE, NO SE ESCONDE (2026-08-31).
   *
   * La sección sigue en el menú y esta pantalla sigue abriendo: lo que cambia
   * es que en vez de las pestañas se muestra QUÉ desbloquea el plan Full.
   *
   * Esconder el ítem sería peor de las dos maneras: el dueño no se entera de
   * que existe (y entonces nunca lo compra), y si alguna vez lo vio, la
   * desaparición se lee como que se rompió algo.
   */
  if (tieneMarketing === false) {
    // MÁS ANCHO QUE EL RESTO (max-w-4xl vs 3xl) porque las cuatro tarjetas van
    // en grilla de dos: con 3xl quedan angostas y el texto se parte feo.
    return (
      <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
        <MarketingBloqueado nombreNegocio={nombreNegocio} />
      </div>
    );
  }

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
      {/* LAS PESTAÑAS COMO TARJETAS (2026-08-27, Jonathan: "este diseño de la
          parte de los selectores, TRISTE Y POBRE").
          Eran cuatro chips de texto: "Anuncios", "Campañas"… nombres que no
          dicen qué hace cada uno. Ahora cada una lleva su icono y su frase, así
          se elige por lo que se quiere LOGRAR y no por adivinar el nombre. */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4" role="tablist">
        {([
          { id: "anuncios", label: "Anuncios", ayuda: "Traer gente nueva", icono: <IconoMegafono />, cap: "tieneAnuncios" },
          { id: "campanias", label: "Campañas", ayuda: "Hacer que vuelvan", icono: <IconoRepetir />, cap: "tieneCampanias" },
          // PUBLICAR entra a Marketing (2026-08-27, Jonathan: "lo que tenemos
          // en la aplicación que irá para Guisela, poder publicar videos e
          // imágenes en todas las plataformas... eso también les ayudaría").
          // Es marketing igual que anunciar: la diferencia es que esto es
          // orgánico y aquello se paga.
          { id: "publicar", label: "Publicar", ayuda: "Un post, todas tus redes", icono: <IconoCamara />, cap: null },
          // Sin `cap`: no depende del rubro. Un negocio con dirección quiere
          // que lo encuentren, venda comida o dé consultas.
          { id: "presencia", label: "Presencia", ayuda: "Que te encuentren", icono: <IconoUbicacion />, cap: null },
        ] as const).filter((p) => p.cap === null || caps[p.cap]).map((p) => {
          const activa = mostrar === p.id;
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={activa}
              onClick={() => elegir(p.id)}
              className={`flex flex-col items-start gap-2 rounded-tarjeta p-3.5 text-left transition ${
                activa
                  ? "bg-superficie-honda text-arena shadow-[var(--sombra-tarjeta)]"
                  : "bg-carta text-tinta-2 ring-1 ring-linea hover:bg-arena/60"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  activa ? "bg-arena/15 text-arena" : "bg-brasa/12 text-brasa-texto"
                }`}
                aria-hidden
              >
                {p.icono}
              </span>
              <span className="min-w-0">
                <span className={`block text-[0.92rem] font-bold ${activa ? "text-arena" : "text-tinta"}`}>
                  {p.label}
                </span>
                <span className={`mt-0.5 block text-[0.78rem] ${activa ? "text-arena/70" : "text-frio"}`}>
                  {p.ayuda}
                </span>
              </span>
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
      {mostrar === "presencia" ? (
        <PresenciaEditor />
      ) : mostrar === "publicar" ? (
        <PublicarPanel embebido />
      ) : mostrar === "anuncios" ? (
        <AnunciosPanel embebido />
      ) : (
        <CampaniasPanel embebido />
      )}
    </div>
  );
}

/* ── LOS ICONOS DE LAS PESTAÑAS ──
   En SVG y no emoji: los emoji se ven distinto en cada teléfono y no toman el
   color del tema. Estos heredan `currentColor`, así que cambian con la
   pestaña activa sin duplicar clases. */

function IconoMegafono() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" />
      <path d="M15 8a5 5 0 010 8" />
      <path d="M18.5 5a9 9 0 010 14" />
    </svg>
  );
}

function IconoRepetir() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0115-6.7L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 01-15 6.7L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
      <path d="M8.5 6l1.4-2.2h4.2L15.5 6" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

function IconoUbicacion() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}
