"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { haySesion, esModoGlobal, filtroInicialDeBandeja, leerEmpresaActiva, puedeAbrirConversacion } from "@/lib/auth";
import {
  paginaLeadsFiltrada,
  paginaBandejaGlobalFiltrada,
  cargarProgresivo,
  tieneCanalActivo,
  accionLead,
  obtenerEtapas,
  type Lead,
} from "@/lib/api";
import { ETAPAS_DEFAULT, MOTORES_CERRADOS, PUNTO_ETAPA, etapaVisibleDe, type EtapaEmbudo } from "@/lib/etapas";
import { CierreLead } from "@/components/panel/CierreLead";
import { useAbrirLead } from "@/components/LinkLead";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { agregarPaginaVieja } from "@/lib/bandeja-rapida";
import { useDatos } from "@/lib/useDatos";
import { guardarCache, leerCache } from "@/lib/cache-datos";
import { URL_CONECTAR_CANALES } from "@/lib/enlaces";
import { SkeletonLista } from "@/components/Skeletons";
import { BadgeCanal } from "@/components/BadgeCanal";
import { OrigenLead } from "@/components/panel/OrigenLead";
import PopupLead from "@/components/panel/PopupLead";
import { BarraNegociosGlobal } from "@/components/panel/GlobalNegocios";
import type { NegocioBandeja } from "@/lib/api";
import { HeroSeccion, SeguimientoIlustracion } from "@/components/panel/HeroSeccion";

type Estado = "cargando" | "ok" | "error";

// En modo global el lead trae de qué negocio viene; en modo empresa esos
// campos no existen (van `undefined` y nada cambia).
type LeadTablero = Lead & { tenantId?: string; negocioNombre?: string };

/**
 * LAS ETAPAS SON LAS DEL NEGOCIO (2026-10-09). El tablero tenía cinco
 * columnas fijas mientras Conversaciones usaba las etapas que el dueño
 * configuró ("Agendó demo", "Demo hecha"…): el mismo lead estaba en una
 * columna acá y en otra allá. Ahora las dos usan `obtenerEtapas` y la misma
 * regla (`etapaVisibleDe`, lib/etapas.ts). En "Todos mis negocios" se usan
 * las de siempre: cada negocio tiene las suyas y no se pueden mezclar.
 */
const AYUDA_MOTOR: Record<EtapaEmbudo["motor"], string> = {
  nuevo: "Recién llegaron",
  nutriendo: "El bot los está trabajando",
  escalado: "Listos para que entres tú",
  ganado: "Lograron lo que buscabas",
  perdido: "No avanzaron",
};

const NIVEL_ETIQUETA: Record<Lead["nivelInteres"], { texto: string; clase: string }> = {
  caliente: { texto: "🔴 Caliente", clase: "bg-calor-suave text-calor-hondo" },
  tibio: { texto: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "⚪ Frío", clase: "bg-arena text-frio" },
};

// Cuántas tarjetas se muestran por columna de arranque y cuántas suma cada
// "ver más". La columna tiene scroll interno, así que nunca crece infinito.
const PAGINA_ETAPA = 12;

// Seguimiento: tablero por etapas de venta. Cada columna es una etapa del
// negocio; las tarjetas se marcan "Ganado" o se descartan sin salir de la vista
// (el mismo CierreLead de la ficha de Conversaciones).
//
// `?etapa=<id o estado>` (2026-10-09): Reportes ("dónde se te caen las ventas")
// lleva acá con el escalón que tocaste; esa columna se resalta y se trae a la
// vista.
export default function SeguimientoPanel() {
  return (
    <Suspense fallback={null}>
      <SeguimientoInner />
    </Suspense>
  );
}

function SeguimientoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const abrirLead = useAbrirLead();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<LeadTablero[]>([]);
  // Mientras llegan las páginas que siguen a la primera (ver `cargar`).
  const [completando, setCompletando] = useState(false);
  const [etapaDestacada, setEtapaDestacada] = useState<string | null>(() => params.get("etapa"));
  const columnaDestacada = useRef<HTMLElement | null>(null);
  // Modo global: chips por negocio para bajar el ruido visual — "" = todos
  // (vista general, default). El filtro es en cliente: ya tenemos todos los
  // leads con su tenantId, así que cambiar de chip es instantáneo.
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [filtroNegocio, setFiltroNegocio] = useState("");
  // Arranca en el predeterminado del dueño si fijó uno (2026-09-22); si no,
  // en "Todos mis negocios" como siempre. Una sola vez.
  const filtroInicializado = useRef(false);
  useEffect(() => {
    if (filtroInicializado.current || negocios.length === 0) return;
    filtroInicializado.current = true;
    setFiltroNegocio(filtroInicialDeBandeja(negocios, ""));
  }, [negocios]);
  // Buscador del tablero: por nombre, contacto o resumen de la IA (cliente).
  const [busqueda, setBusqueda] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Lead abierto en el popup de vista rápida.
  //
  // UN CLIC ABRE AL INSTANTE (2026-10-09). Antes el clic esperaba 220 ms por si
  // venía un segundo clic —el doble clic, escondido, abría el chat—: el popup
  // se sentía lento y nadie sabía del doble clic. Ahora el clic abre ya, y
  // "Abrir chat" es un botón visible en cada tarjeta.
  const [leadAbierto, setLeadAbierto] = useState<LeadTablero | null>(null);
  // Cuántas tarjetas mostrar por etapa (paginación en cliente con "ver más").
  // Cada columna arranca mostrando PAGINA_ETAPA y crece de a tandas.
  const [visiblePorEtapa, setVisiblePorEtapa] = useState<Record<string, number>>({});
  // Las etapas del negocio que se mira (ver AYUDA_MOTOR arriba).
  const [etapas, setEtapas] = useState<EtapaEmbudo[]>(ETAPAS_DEFAULT);
  // ¿Son las del negocio (se mueve por id) o las de siempre ("Todos")?
  const [etapasPropias, setEtapasPropias] = useState(false);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  /**
   * LA PRIMERA PÁGINA AL INSTANTE (2026-10-09). Antes se bajaban hasta 20
   * páginas EN SERIE antes de pintar una sola tarjeta; con miles de leads el
   * tablero tardaba varios segundos en blanco. Ahora se pinta lo primero y el
   * resto se suma detrás (mismo patrón que Conversaciones).
   *
   * Modo global: el pipeline cruza TODOS los negocios de captación (cada
   * tarjeta dice de cuál viene). Modo empresa: solo la activa, como siempre.
   */
  const cargaRef = useRef(0);
  const cargar = useCallback(async () => {
    const gen = ++cargaRef.current;
    const global = esModoGlobal();
    // AL VOLVER, EL TABLERO DE LA ÚLTIMA VEZ (2026-10-09): se pinta al
    // instante y se reemplaza cuando termina de llegar el nuevo.
    const clave = `seguimiento@${global ? "global" : leerEmpresaActiva() || "-"}`;
    const guardado = leerCache<{ leads: LeadTablero[]; negocios: NegocioBandeja[] }>(clave);
    if (guardado) {
      setLeads(guardado.leads);
      setNegocios(guardado.negocios);
      setEstado("ok");
    } else {
      setEstado((e) => (e === "ok" ? "ok" : "cargando"));
    }
    setCompletando(true);
    let acumulado: LeadTablero[] = [];
    let negociosVistos: NegocioBandeja[] = [];
    try {
      await cargarProgresivo<LeadTablero, { items: LeadTablero[]; siguienteCursor: string | null; negocios?: NegocioBandeja[] }>(
        (cursor) => (global ? paginaBandejaGlobalFiltrada({}, cursor) : paginaLeadsFiltrada({}, cursor)),
        (items, { primera, ultima, respuesta }) => {
          if (respuesta.negocios) { negociosVistos = respuesta.negocios; setNegocios(respuesta.negocios); }
          acumulado = primera ? items : agregarPaginaVieja(acumulado, items);
          // Con el tablero guardado en pantalla se espera al final: no se
          // achica la lista para volver a agrandarla.
          if (!guardado || ultima) {
            setLeads(acumulado);
            setEstado("ok");
          }
        },
        () => gen === cargaRef.current,
      );
      if (gen === cargaRef.current) {
        setLeads(acumulado);
        setEstado("ok");
        guardarCache(clave, { leads: acumulado, negocios: negociosVistos });
      }
    } catch {
      if (gen === cargaRef.current) setEstado((e) => (e === "ok" ? "ok" : "error"));
    } finally {
      if (gen === cargaRef.current) setCompletando(false);
    }
  }, []);

  // ¿Hay canal? El vacío ofrecía "Conectar WhatsApp" SIEMPRE, aunque ya
  // estuviera conectado (2026-10-09): ahora solo si de verdad falta.
  const { datos: tieneCanal } = useDatos(
    listo ? `tiene-canal@${leerEmpresaActiva() || "-"}` : null,
    () => tieneCanalActivo(),
    { maxEdadMs: 60_000 },
  );

  // Las etapas del negocio que se mira: con un negocio enfocado (o uno solo),
  // las suyas; en "Todos mis negocios", las de siempre.
  useEffect(() => {
    if (!listo) return;
    if (esModoGlobal() && !filtroNegocio) {
      setEtapas(ETAPAS_DEFAULT);
      setEtapasPropias(false);
      return;
    }
    let vivo = true;
    obtenerEtapas(filtroNegocio || undefined).then((e) => {
      if (!vivo) return;
      setEtapas(e);
      setEtapasPropias(true);
    });
    return () => { vivo = false; };
  }, [listo, filtroNegocio]);

  // `?etapa=` puede traer el id de una etapa o un estado del motor (Reportes
  // manda el estado: "escalado"). Se resalta esa columna, o la primera de ese
  // estado.
  const idDestacado = etapaDestacada
    ? (etapas.find((e) => e.id === etapaDestacada) ?? etapas.find((e) => e.motor === etapaDestacada))?.id ?? null
    : null;

  // La columna pedida por la URL se trae a la vista una vez que hay datos.
  useEffect(() => {
    if (estado === "ok" && idDestacado) {
      columnaDestacada.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [estado, idDestacado]);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  // Agrupa los leads por etapa y, dentro de cada una, ordena por temperatura:
  // los calientes arriba (lo más urgente), luego tibios, luego fríos.
  const porEtapa = useMemo(() => {
    const ORDEN_NIVEL: Record<Lead["nivelInteres"], number> = { caliente: 0, tibio: 1, frio: 2 };
    const mapa = new Map<string, LeadTablero[]>();
    for (const et of etapas) mapa.set(et.id, []);
    const q = busqueda.trim().toLowerCase();
    const visibles = leads
      .filter((l) => !filtroNegocio || l.tenantId === filtroNegocio)
      .filter(
        (l) =>
          !q ||
          (l.nombre ?? "").toLowerCase().includes(q) ||
          l.contactoExterno.toLowerCase().includes(q) ||
          (l.resumenIA ?? "").toLowerCase().includes(q),
      );
    for (const l of visibles) mapa.get(etapaVisibleDe(l, etapas).id)?.push(l);
    for (const lista of mapa.values()) {
      lista.sort((a, b) => ORDEN_NIVEL[a.nivelInteres] - ORDEN_NIVEL[b.nivelInteres]);
    }
    return mapa;
  }, [leads, filtroNegocio, busqueda, etapas]);

  // CierreLead (tarjeta o popup) ya hizo la acción: acá solo se mueve la
  // tarjeta. La etapa propia se suelta: manda el estado nuevo.
  function alCerrar(lead: LeadTablero, nuevo: "ganado" | "perdido") {
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, estado: nuevo, etapaEmbudo: null } : l)));
  }

  /**
   * Mover A MANO a otra etapa (o reabrir un cerrado) — contrato mover_etapa
   * (pedido de Jonathan: "debería poder dejarme mover entre los niveles del
   * CRM a un prospecto"). Optimista.
   *
   * Con las etapas del negocio se mueve por id (el backend sincroniza el
   * estado). En "Todos mis negocios" las etapas son las de siempre y cada
   * lead es de un negocio con las suyas: se mueve por estado del motor, y los
   * cierres van por "Ganado"/"Descartar" como siempre.
   */
  async function moverA(lead: LeadTablero, et: EtapaEmbudo) {
    setOcupado(lead.id);
    setLeads((prev) => prev.map((l) => (l.id === lead.id
      ? { ...l, estado: et.motor, etapaEmbudo: etapasPropias ? et.id : null }
      : l)));
    const accion = etapasPropias
      ? { tipo: "mover_etapa" as const, etapaId: et.id }
      : et.motor === "ganado"
        ? { tipo: "marcar_ganado" as const }
        : et.motor === "perdido"
          ? { tipo: "descartar" as const }
          : { tipo: "mover_etapa" as const, etapa: et.motor as "nuevo" | "nutriendo" | "escalado" };
    const r = await accionLead(lead.id, accion, lead.tenantId);
    setOcupado(null);
    if (!r.ok) cargar();
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
      {/* El título PRIMERO y el hero debajo, plegable (2026-10-09): antes el
          hero iba arriba con su propio titular grande y el h1 "Seguimiento"
          quedaba como un segundo título. El buscador vive en la cabecera. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ventas</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Seguimiento</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {completando && estado === "ok" && (
            <span className="text-[0.78rem] text-frio" role="status">Cargando más leads…</span>
          )}
          <label className="relative block w-full sm:w-72">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-frio">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o lo que dijo…"
              className="w-full rounded-chip bg-carta py-2.5 pl-10 pr-4 text-sm text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-brasa/40"
              aria-label="Buscar en Seguimiento"
            />
          </label>
          <button
            onClick={cargar}
            className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
          >
            Actualizar
          </button>
        </div>
      </header>

      <HeroSeccion
        plegable="seguimiento"
        titulo="En qué va cada venta, sin anotarlo aparte"
        bajada={<>Cada cliente avanza por las etapas de tu negocio y lo mueves con un toque: «Ganado» cuando logra lo que buscabas, «Pagó» cuando entra la plata.</>}
        nota="La IA lo va moviendo sola según lo que responde el cliente."
        dibujo={<SeguimientoIlustracion />}
      />

      {negocios.length > 1 && (
        <BarraNegociosGlobal
          negocios={negocios}
          enfocado={filtroNegocio}
          onElegir={setFiltroNegocio}
          todosLabel="Todos mis negocios"
        />
      )}

      {estado === "cargando" && <SkeletonLista filas={5} />}

      {estado === "error" && <ErrorConReintento mensaje="No pudimos cargar Seguimiento." reintentar={cargar} />}

      {etapaDestacada && estado === "ok" && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="inline-flex items-center gap-2 rounded-chip bg-brasa-suave px-3 py-1.5 text-[0.82rem] font-semibold text-brasa-texto">
            Mirando: {etapas.find((e) => e.id === idDestacado)?.nombre ?? etapaDestacada}
            <button
              type="button"
              onClick={() => { setEtapaDestacada(null); router.replace("/seguimiento", { scroll: false }); }}
              aria-label="Dejar de resaltar la etapa"
              className="min-h-0 text-[1rem] leading-none"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {estado === "ok" && leads.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Todavía no hay ventas en Seguimiento
          </p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Cuando lleguen leads por WhatsApp, van a ir apareciendo aquí por etapa.
          </p>
          {/* Solo si NO hay canal (2026-10-09): antes se ofrecía siempre. */}
          {tieneCanal === false && (
            <Link
              href={URL_CONECTAR_CANALES}
              className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-sobre-brasa transition active:scale-[0.99]"
            >
              Conectar WhatsApp
            </Link>
          )}
        </div>
      )}

      {estado === "ok" && leads.length > 0 && (
        // Con las etapas del negocio puede haber de 2 a 12 columnas: en
        // escritorio van en fila con scroll horizontal, cada una de ancho fijo.
        <div className="grid gap-4 md:grid-cols-2 xl:flex xl:overflow-x-auto xl:pb-2">
          {etapas.map((et) => {
            const items = porEtapa.get(et.id) ?? [];
            const cerrable = !MOTORES_CERRADOS.has(et.motor);
            const visible = visiblePorEtapa[et.id] ?? PAGINA_ETAPA;
            const mostrados = items.slice(0, visible);
            const restantes = items.length - mostrados.length;
            const destacada = idDestacado === et.id;
            return (
              <section
                key={et.id}
                ref={destacada ? columnaDestacada : undefined}
                aria-label={et.nombre}
                className={`flex min-w-0 flex-col xl:w-64 xl:shrink-0 ${destacada ? "rounded-tarjeta bg-brasa-suave/40 p-2 ring-2 ring-brasa" : ""}`}
              >
                {/* Encabezado de columna */}
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PUNTO_ETAPA[et.color]}`} />
                  <h2 className="truncate text-[0.95rem] font-bold text-tinta">{et.nombre}</h2>
                  <span className="ml-auto rounded-full bg-arena px-2 py-0.5 text-xs font-bold tabular-nums text-tinta-2">
                    {items.length}
                  </span>
                </div>

                {/* Columna con altura máxima y scroll interno: nunca crece
                    infinito por más leads que tenga la etapa. */}
                <div className="flex max-h-[calc(100vh-13rem)] flex-col gap-2.5 overflow-y-auto pr-0.5">
                  {items.length === 0 && (
                    <div className="rounded-tarjeta border border-dashed border-linea px-3 py-6 text-center">
                      <span aria-hidden className={`mx-auto block h-2.5 w-2.5 rounded-full ${PUNTO_ETAPA[et.color]} opacity-40`} />
                      <p className="mt-2 text-[0.8rem] text-frio">{AYUDA_MOTOR[et.motor]}</p>
                    </div>
                  )}

                  {mostrados.map((lead) => {
                    const nivel = NIVEL_ETIQUETA[lead.nivelInteres];
                    const trabajando = ocupado === lead.id;
                    return (
                      <article
                        key={lead.id}
                        onClick={() => setLeadAbierto(lead)}
                        className="cursor-pointer rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          {/* El nombre es el botón de "ver detalle": así se llega
                              también con el teclado (la tarjeta entera es para
                              el mouse). */}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setLeadAbierto(lead); }}
                            className="block min-h-0 min-w-0 flex-1 truncate text-left font-semibold text-tinta hover:underline"
                          >
                            {lead.nombre ?? lead.contactoExterno}
                          </button>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${nivel.clase}`}
                          >
                            {nivel.texto}
                          </span>
                        </div>

                        {lead.resumenIA && (
                          <p className="mt-1.5 line-clamp-2 text-[0.82rem] text-tinta-2">
                            {lead.resumenIA}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <BadgeCanal canal={lead.canalOrigen} tamano="chico" />
                          {lead.negocioNombre && !filtroNegocio && negocios.length > 1 && (
                            <span className="max-w-full truncate rounded-full bg-arena px-2 py-0.5 text-[0.66rem] font-bold text-tinta-2">
                              🏢 {lead.negocioNombre}
                            </span>
                          )}
                          {lead.ventaEn && (
                            <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[0.66rem] font-bold text-ok">💰 Pagó</span>
                          )}
                          {lead.origenEtiqueta === "comentario" && (
                            <span className="rounded-full bg-tibio-suave px-2 py-0.5 text-[0.66rem] font-bold text-tibio">
                              💬 vino de un comentario
                            </span>
                          )}
                          {/* De dónde vino, igual que en Conversaciones (2026-10-06): antes
                              acá salía el id crudo del anuncio ("📣 120256…"). */}
                          {lead.origenEtiqueta !== "comentario" && <OrigenLead lead={lead} compacto />}
                        </div>

                        {/* Cerrar: el mismo flujo que la ficha (CierreLead). */}
                        {cerrable && (
                          <div className="mt-3">
                            <CierreLead
                              leadId={lead.id}
                              estado={lead.estado}
                              tenant={lead.tenantId}
                              compacto
                              onCambio={(nuevo) => alCerrar(lead, nuevo)}
                            />
                          </div>
                        )}

                        <div className="mt-2 flex gap-2">
                          {/* Mover a otra etapa del negocio — y "Reabrir" en
                              las cerradas (contrato mover_etapa). */}
                          <select
                            value=""
                            disabled={trabajando}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const destino = etapas.find((x) => x.id === e.target.value);
                              if (destino) void moverA(lead, destino);
                            }}
                            aria-label="Mover el lead a otra etapa"
                            className="min-w-0 flex-1 cursor-pointer rounded-chip border border-linea bg-carta px-2.5 py-2 text-[0.8rem] font-semibold text-tinta-2 transition hover:border-brasa/50 hover:text-tinta"
                          >
                            <option value="">{cerrable ? "↔ Mover a…" : "↩ Reabrir en…"}</option>
                            {etapas
                              .filter((e2) => e2.id !== et.id && (cerrable || !MOTORES_CERRADOS.has(e2.motor)))
                              .map((e2) => (
                                <option key={e2.id} value={e2.id}>{e2.nombre}</option>
                              ))}
                          </select>
                          {/* EL CHAT, A LA VISTA (2026-10-09): era el doble clic. */}
                          {puedeAbrirConversacion() && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); abrirLead(lead.id, lead.tenantId); }}
                              className="shrink-0 rounded-chip bg-arena px-3 py-2 text-[0.78rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-linea"
                            >
                              Abrir chat
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}

                  {/* Ver más: carga otra tanda de esta etapa (sin recargar). */}
                  {restantes > 0 && (
                    <button
                      onClick={() =>
                        setVisiblePorEtapa((prev) => ({
                          ...prev,
                          [et.id]: visible + PAGINA_ETAPA,
                        }))
                      }
                      className="rounded-chip bg-arena px-3 py-2 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-linea"
                    >
                      Ver más ({restantes})
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Popup de vista rápida (un clic sobre una tarjeta): resumen,
          conversación, responder, cerrar y "Pagó", sin salir del tablero. */}
      {leadAbierto && (
        <PopupLead
          key={leadAbierto.id}
          lead={leadAbierto}
          tenant={leadAbierto.tenantId}
          onCerrar={() => setLeadAbierto(null)}
          onCambio={(nuevo) => alCerrar(leadAbierto, nuevo)}
        />
      )}
    </div>
  );
}
