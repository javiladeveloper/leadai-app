"use client";

import { useEffect, useState } from "react";
import { Cargando } from "@/components/Cargando";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { haySesion, leerEmpresaActiva, empresasVisibles } from "@/lib/auth";
import { obtenerMiPlan } from "@/lib/api";
import { MarketingBloqueado } from "@/components/panel/MarketingBloqueado";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { useCapacidadesOptimista } from "@/lib/modo-negocio";
import CampaniasPanel from "@/components/panel/CampaniasPanel";
import { PresenciaEditor } from "@/components/panel/PresenciaEditor";
import { SeccionAnuncios } from "@/components/panel/SeccionAnuncios";
import { AjustesMarketing } from "@/components/panel/AjustesMarketing";
import PublicarPanel from "@/components/panel/PublicarPanel";
import { GoogleAdsPanel } from "@/components/panel/GoogleAdsPanel";

/**
 * Marketing reúne las tareas de captación y retención en un espacio de trabajo.
 * Las áreas conservan sus propios flujos; esta página sólo coordina navegación,
 * negocio enfocado y montaje de los editores para no perder borradores.
 */

type Pestania = "anuncios" | "google" | "campanias" | "presencia" | "publicar" | "automatico";

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
    : t === "automatico" ? "automatico"
    : t === "google" ? "google"
    : "anuncios";
  const [pestania, setPestania] = useState<Pestania>(inicial);
  const [menuVertical, setMenuVertical] = useState(false);
  // Atrás/Adelante cambia la URL sin remontar la página: la URL vuelve a ser
  // la fuente de verdad cuando el navegador navega por el historial.
  useEffect(() => { setPestania(inicial); }, [t]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const medio = window.matchMedia("(min-width: 1280px)");
    const actualizar = () => setMenuVertical(medio.matches);
    actualizar();
    medio.addEventListener("change", actualizar);
    return () => medio.removeEventListener("change", actualizar);
  }, []);

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
  }, [router]);

  /**
   * EL CANDADO ES DEL NEGOCIO ENFOCADO, NO DE LA EMPRESA ACTIVA (2026-09-22,
   * bug de Jonathan: "a veces me sale error al entrar a Marketing como si no
   * tuviera plan, tengo que cambiar varias veces el negocio para que agarre").
   *
   * `obtenerMiPlan()` sin tenant preguntaba por la EMPRESA ACTIVA: la que
   * quedó del último chip que tocó en cualquier otra sección. Si esa era un
   * negocio sin plan Full, Marketing entero mostraba el candado aunque los
   * chips de acá apuntaran a Sania. Y "cambiar varias veces de negocio" era
   * exactamente lo que movía la activa hasta que caía en uno con plan.
   *
   * Ahora se pregunta por el negocio enfocado, se vuelve a preguntar al
   * cambiarlo, y no se pregunta hasta saber cuál es (`resuelto`).
   */
  const tenantPlan = g.tenantLista ?? (g.resuelto ? leerEmpresaActiva() ?? empresasVisibles()[0]?.tenantId : undefined);
  const [tenantPublicarVisitado, setTenantPublicarVisitado] = useState<string>();
  const [tenantCampaniasVisitado, setTenantCampaniasVisitado] = useState<string>();
  useEffect(() => {
    if (pestania === "publicar" && tenantPlan) setTenantPublicarVisitado(tenantPlan);
  }, [pestania, tenantPlan]);

  useEffect(() => {
    if (!g.resuelto || !g.listaLista || !tenantPlan) return;
    let vivo = true;
    setTieneMarketing(null);
    obtenerMiPlan(tenantPlan || undefined)
      .then((p) => { if (vivo) setTieneMarketing(p?.features?.marketing ?? true); })
      .catch(() => { if (vivo) setTieneMarketing(true); });
    return () => { vivo = false; };
  }, [g.resuelto, g.listaLista, tenantPlan]);

  function elegir(p: Pestania) {
    setPestania(p);
    // Cada elección tiene URL compartible y se puede deshacer con Atrás.
    router.push(`/marketing?t=${p}`, { scroll: false });
  }

  // Cual se muestra de verdad: la elegida, salvo que este negocio no la tenga.
  // `presencia` no tiene capacidad: Google Maps le sirve a cualquier negocio
  // con dirección, sea restaurante o consultorio. Por eso nunca cae de ella.
  const mostrar: Pestania =
    (pestania === "anuncios" || pestania === "google") && !caps.tieneAnuncios ? (caps.tieneCampanias ? "campanias" : "presencia")
    : pestania === "campanias" && !caps.tieneCampanias ? (caps.tieneAnuncios ? "anuncios" : "presencia")
    : pestania;

  useEffect(() => {
    if (mostrar === "campanias" && tenantPlan) setTenantCampaniasVisitado(tenantPlan);
  }, [mostrar, tenantPlan]);

  useEffect(() => {
    if (mostrar === pestania) return;
    setPestania(mostrar);
    router.replace(`/marketing?t=${mostrar}`, { scroll: false });
  }, [mostrar, pestania, router]);

  useEffect(() => {
    if (tieneMarketing !== true || menuVertical || typeof document === "undefined") return;
    const lista = document.getElementById("marketing-tablist");
    if (lista && lista.scrollWidth > lista.clientWidth) {
      document.getElementById(`marketing-tab-${mostrar}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [mostrar, tieneMarketing, menuVertical]);

  function moverConTeclado(evento: React.KeyboardEvent<HTMLButtonElement>, actual: Pestania) {
    const disponibles: Pestania[] = [
      ...(caps.tieneAnuncios ? ["anuncios" as const, "google" as const] : []),
      ...(caps.tieneCampanias ? ["campanias" as const] : []),
      "publicar", "presencia", "automatico",
    ];
    const indice = disponibles.indexOf(actual);
    const destino = evento.key === (menuVertical ? "ArrowDown" : "ArrowRight") ? disponibles[(indice + 1) % disponibles.length]
      : evento.key === (menuVertical ? "ArrowUp" : "ArrowLeft") ? disponibles[(indice - 1 + disponibles.length) % disponibles.length]
      : evento.key === "Home" ? disponibles[0]
      : evento.key === "End" ? disponibles[disponibles.length - 1]
      : null;
    if (!destino) return;
    evento.preventDefault();
    elegir(destino);
    if (typeof document !== "undefined") document.getElementById(`marketing-tab-${destino}`)?.focus();
  }

  if (!listo || !g.resuelto) return null;
  if (g.listaLista && !tenantPlan) return <p role="status" className="p-5">Selecciona un negocio para ver Marketing.</p>;

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
      <p role="status" className="p-5 text-frio">Cargando Marketing…</p>
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
    //
    // LOS CHIPS SE QUEDAN (2026-09-22): el candado es de ESTE negocio; con
    // varios, el dueño tiene que poder pasar al que sí tiene plan sin salir
    // de la sección.
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6 lg:px-8">
        {g.modoGlobal && (
          <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
        )}
        <MarketingBloqueado nombreNegocio={nombreNegocio} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <header className="overflow-hidden rounded-2xl bg-superficie-honda px-6 py-7 text-carta sm:px-8 lg:flex lg:items-end lg:justify-between lg:gap-12 lg:px-10 lg:py-9">
        <div className="max-w-2xl">
          <h1 className="text-[2rem] font-bold tracking-[-0.025em] sm:text-[2.6rem]">Marketing</h1>
          <p className="mt-2 text-base font-semibold text-carta">Que te conozcan, que vuelvan.</p>
          <p className="mt-2 max-w-[65ch] text-[0.9rem] leading-relaxed text-carta/75">
            Anuncios para atraer personas, campañas para volver a conversar y comentarios para detectar oportunidades.
          </p>
        </div>
        <Link href="/comentarios" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-orbita px-5 text-sm font-bold text-sobre-orbita transition hover:bg-orbita-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carta lg:mt-0">
          Ver comentarios <span aria-hidden className="ml-2">↗</span>
        </Link>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {nombreNegocio && (
        <p className="text-[0.82rem] text-tinta-2">Espacio de trabajo de <strong className="text-tinta">{nombreNegocio}</strong></p>
      )}

      <div className="grid gap-6 xl:grid-cols-[245px_minmax(0,1fr)] xl:items-start xl:gap-8">
      <nav className="min-w-0 xl:sticky xl:top-5" aria-label="Áreas de Marketing">
        <p className="mb-2 hidden px-3 text-xs font-bold uppercase tracking-[0.08em] text-frio xl:block">Trabaja por objetivo</p>
        <div id="marketing-tablist" className="flex gap-2 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible xl:rounded-2xl xl:bg-carta xl:p-2 xl:shadow-[var(--sombra-tarjeta)]" role="tablist" aria-label="Áreas de Marketing" aria-orientation={menuVertical ? "vertical" : "horizontal"}>
        {([
          { id: "anuncios", label: "Anuncios", ayuda: "Traer gente nueva", icono: <IconoMegafono />, cap: "tieneAnuncios" },
          // GOOGLE ADS (2026-10-05): solo lectura de la cuenta del negocio,
          // con los contactos que esos anuncios trajeron a LeadAI.
          { id: "google", label: "Google Ads", ayuda: "Quién te busca en Google", icono: <IconoLupa />, cap: "tieneAnuncios" },
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
          // Lo que el sistema hace solo: rescate, seguimiento, alertas, tope.
          // Sin `cap`: son automatizaciones de leads/ads que le sirven a cualquiera.
          { id: "automatico", label: "Automático", ayuda: "Que trabaje por ti", icono: <IconoRayo />, cap: null },
        ] as const).filter((p) => p.cap === null || caps[p.cap]).map((p) => {
          const activa = mostrar === p.id;
          return (
            <button
              key={p.id}
              type="button"
              id={`marketing-tab-${p.id}`}
              role="tab"
              aria-selected={activa}
              aria-controls="marketing-panel"
              tabIndex={activa ? 0 : -1}
              onClick={() => elegir(p.id)}
              onKeyDown={(e) => moverConTeclado(e, p.id)}
              className={`flex min-w-[150px] shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left transition xl:w-full xl:min-w-0 ${
                activa
                  ? "bg-superficie-honda text-carta"
                  : "bg-carta text-tinta-2 ring-1 ring-linea hover:bg-arena xl:ring-0"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                  activa ? "bg-carta/15 text-carta" : "bg-brasa-suave text-brasa-texto"
                }`}
                aria-hidden
              >
                {p.icono}
              </span>
              <span className="min-w-0">
                <span className={`block text-[0.86rem] font-bold ${activa ? "text-carta" : "text-tinta"}`}>
                  {p.label}
                </span>
                <span className={`mt-0.5 hidden text-[0.7rem] leading-snug xl:block ${activa ? "text-carta/70" : "text-frio"}`}>
                  {p.ayuda}
                </span>
              </span>
            </button>
          );
        })}
        </div>
        <Link href="/comentarios" className="mt-3 hidden min-h-12 items-center justify-between rounded-xl px-3 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-carta hover:text-tinta xl:flex">
          Comentarios <span aria-hidden>↗</span>
        </Link>
      </nav>
      <div id="marketing-panel" role="tabpanel" aria-labelledby={`marketing-tab-${mostrar}`} tabIndex={0} className="min-w-0 space-y-5">
      {/* Publicar permanece montado tras visitarlo para conservar el trabajo
          al cambiar de pestaña. El tenant identifica y aísla su instancia;
          no se persiste el borrador fuera de esta pantalla. */}
      {tenantPlan && (mostrar === "publicar" || tenantPublicarVisitado === tenantPlan) && (
        <div key={tenantPlan} hidden={mostrar !== "publicar"}>
          <PublicarPanel embebido key={tenantPlan} tenant={tenantPlan} />
        </div>
      )}
      {/* La campaña en preparación también permanece montada al consultar
          Plantillas, Presencia u otra pestaña del mismo negocio. */}
      {tenantPlan && (mostrar === "campanias" || tenantCampaniasVisitado === tenantPlan) && (
        <div key={tenantPlan} hidden={mostrar !== "campanias"}>
          <CampaniasPanel embebido tenant={tenantPlan} />
        </div>
      )}
      {/* Si la pestania de la URL no aplica a este negocio —un link viejo, o
          un rubro sin esa capacidad— se muestra la otra en vez de una pantalla
          en blanco. */}
      {mostrar === "presencia" ? (
        /**
         * EL NEGOCIO ENFOCADO, NO LA EMPRESA ACTIVA (2026-09-16).
         *
         * Presencia se montaba sin `tenant`, asi que leia y escribia siempre
         * en la empresa activa aunque la barra de arriba mostrara otra. Con
         * varios negocios eso es peor que un filtro que no anda: el dueno
         * cambia a Sania, pega el pixel de Sania, y termina guardandolo en
         * Norac Labs sin que nada se lo diga.
         *
         * `key` fuerza el remonte al cambiar de negocio: sin eso los campos
         * conservan el texto del anterior, que es la misma confusion.
         */
        <PresenciaEditor key={tenantPlan} tenant={tenantPlan} />
      ) : mostrar === "publicar" ? null
      : mostrar === "anuncios" ? (
        <SeccionAnuncios tenant={tenantPlan} nombreNegocio={nombreNegocio} />
      ) : mostrar === "google" ? (
        <GoogleAdsPanel key={tenantPlan} tenant={tenantPlan} />
      ) : mostrar === "automatico" ? (
        <AjustesMarketing key={tenantPlan} tenant={tenantPlan} />
      ) : null}
      </div>
      </div>
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

function IconoLupa() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

function IconoRayo() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L4.5 13.5H11l-1 8.5L18.5 10.5H12l1-8.5z" />
    </svg>
  );
}
