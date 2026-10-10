"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { haySesion, esModoGlobal, filtroInicialDeBandeja, leerEmpresaActiva } from "@/lib/auth";
import {
  paginaLeadsFiltrada,
  paginaBandejaGlobalFiltrada,
  cargarProgresivo,
  tieneCanalActivo,
  accionLead,
  type Lead,
  type EstadoLead,
} from "@/lib/api";
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
type LeadPipeline = Lead & { tenantId?: string; negocioNombre?: string };

// Las etapas del pipeline en orden de avance. Los `estado` son los valores
// reales del backend; los `titulo` son en lenguaje simple (mismos que en Leads).
const ETAPAS: {
  estado: EstadoLead;
  titulo: string;
  ayuda: string;
  acento: string; // clase de color para el punto/encabezado de la columna
}[] = [
  { estado: "nuevo", titulo: "Nuevos", ayuda: "Recién llegaron", acento: "bg-brasa" },
  { estado: "nutriendo", titulo: "En seguimiento", ayuda: "El bot los está trabajando", acento: "bg-tibio" },
  { estado: "escalado", titulo: "Para atender", ayuda: "Listos para que entres tú", acento: "bg-brasa-hondo" },
  { estado: "ganado", titulo: "Ganados", ayuda: "Cerraste la venta", acento: "bg-ok" },
  { estado: "perdido", titulo: "Perdidos", ayuda: "No avanzaron", acento: "bg-frio" },
];

const NIVEL_ETIQUETA: Record<Lead["nivelInteres"], { texto: string; clase: string }> = {
  caliente: { texto: "🔴 Caliente", clase: "bg-calor-suave text-calor-hondo" },
  tibio: { texto: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "⚪ Frío", clase: "bg-arena text-frio" },
};

// Cuántas tarjetas se muestran por columna de arranque y cuántas suma cada
// "ver más". La columna tiene scroll interno, así que nunca crece infinito.
const PAGINA_ETAPA = 12;

// Seguimiento: tablero por etapas de venta. Cada columna es un estado del lead;
// las tarjetas se pueden marcar como ganado o descartar sin salir de la vista.
//
// `?etapa=<estado>` (2026-10-09): Reportes ("dónde se te caen las ventas")
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
  const [leads, setLeads] = useState<LeadPipeline[]>([]);
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
  // Lead abierto en el popup de vista rápida (1 click). El doble click entra a
  // la conversación directamente. Usamos un timer para distinguir 1 de 2 clicks.
  const [leadAbierto, setLeadAbierto] = useState<LeadPipeline | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cuántas tarjetas mostrar por etapa (paginación en cliente con "ver más").
  // Cada columna arranca mostrando PAGINA_ETAPA y crece de a tandas.
  const [visiblePorEtapa, setVisiblePorEtapa] = useState<Record<string, number>>({});

  // 1 click abre el popup; 2 clicks entran a la conversación (cancela el popup).
  const alHacerClick = useCallback(
    (lead: LeadPipeline) => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        setLeadAbierto(lead);
        clickTimer.current = null;
      }, 220);
    },
    [],
  );
  const alDobleClick = useCallback(
    (lead: LeadPipeline) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      // A la ficha única, con el negocio del lead.
      abrirLead(lead.id, lead.tenantId);
    },
    [abrirLead],
  );

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
    const guardado = leerCache<{ leads: LeadPipeline[]; negocios: NegocioBandeja[] }>(clave);
    if (guardado) {
      setLeads(guardado.leads);
      setNegocios(guardado.negocios);
      setEstado("ok");
    } else {
      setEstado((e) => (e === "ok" ? "ok" : "cargando"));
    }
    setCompletando(true);
    let acumulado: LeadPipeline[] = [];
    let negociosVistos: NegocioBandeja[] = [];
    try {
      await cargarProgresivo<LeadPipeline, { items: LeadPipeline[]; siguienteCursor: string | null; negocios?: NegocioBandeja[] }>(
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

  // La columna pedida por la URL se trae a la vista una vez que hay datos.
  useEffect(() => {
    if (estado === "ok" && etapaDestacada) {
      columnaDestacada.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [estado, etapaDestacada]);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  // Agrupa los leads por etapa y, dentro de cada una, ordena por temperatura:
  // los calientes arriba (lo más urgente), luego tibios, luego fríos.
  const porEtapa = useMemo(() => {
    const ORDEN_NIVEL: Record<Lead["nivelInteres"], number> = { caliente: 0, tibio: 1, frio: 2 };
    const mapa = new Map<EstadoLead, LeadPipeline[]>();
    for (const et of ETAPAS) mapa.set(et.estado, []);
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
    for (const l of visibles) mapa.get(l.estado)?.push(l);
    for (const lista of mapa.values()) {
      lista.sort((a, b) => ORDEN_NIVEL[a.nivelInteres] - ORDEN_NIVEL[b.nivelInteres]);
    }
    return mapa;
  }, [leads, filtroNegocio, busqueda]);

  async function mover(
    lead: LeadPipeline,
    accion: { tipo: "marcar_ganado" | "descartar" },
  ) {
    setOcupado(lead.id);
    // En modo global la acción viaja al negocio del lead (tenant explícito).
    const r = await accionLead(lead.id, accion, lead.tenantId);
    setOcupado(null);
    if (r.ok) {
      // Actualización optimista local: movemos el lead a la etapa destino
      // sin recargar toda la lista.
      const destino: EstadoLead = accion.tipo === "marcar_ganado" ? "ganado" : "perdido";
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, estado: destino } : l)),
      );
    } else {
      // Si falla, recargamos para volver al estado real del servidor.
      cargar();
    }
  }

  // Mover A MANO entre etapas abiertas (o reabrir un terminal) — contrato
  // mover_etapa del backend (pedido de Jonathan: "debería poder dejarme mover
  // entre los niveles del CRM a un prospecto"). Optimista, igual que mover().
  async function moverEtapa(lead: LeadPipeline, etapa: "nuevo" | "nutriendo" | "escalado") {
    setOcupado(lead.id);
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, estado: etapa } : l)));
    const r = await accionLead(lead.id, { tipo: "mover_etapa", etapa }, lead.tenantId);
    setOcupado(null);
    if (!r.ok) cargar();
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
      <HeroSeccion
        titulo="En qué va cada venta, sin anotarlo aparte"
        bajada={<>Cada cliente avanza por etapas —nuevo, en conversación, ganado— y lo mueves con un toque cuando cierras o descartas.</>}
        nota="La IA lo va moviendo sola según lo que responde el cliente."
        dibujo={<SeguimientoIlustracion />}
      />

      {/* Solo eyebrow + h1 (la bajada repetía el hero, pasada UX 2026-09-06)
          y el buscador SUBE a la cabecera con su lupa de verdad — flotaba
          suelto entre bloques con un emoji de placeholder. */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Tu pipeline</p>
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
              aria-label="Buscar en el pipeline"
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

      {negocios.length > 1 && (
        <BarraNegociosGlobal
          negocios={negocios}
          enfocado={filtroNegocio}
          onElegir={setFiltroNegocio}
          todosLabel="Todos mis negocios"
        />
      )}

      {estado === "cargando" && <SkeletonLista filas={5} />}

      {estado === "error" && <ErrorConReintento mensaje="No pudimos cargar tu pipeline." reintentar={cargar} />}

      {etapaDestacada && estado === "ok" && (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="inline-flex items-center gap-2 rounded-chip bg-brasa-suave px-3 py-1.5 text-[0.82rem] font-semibold text-brasa-texto">
            Mirando: {ETAPAS.find((e) => e.estado === etapaDestacada)?.titulo ?? etapaDestacada}
            <button
              type="button"
              onClick={() => { setEtapaDestacada(null); router.replace("/seguimiento", { scroll: false }); }}
              aria-label="Dejar de resaltar la etapa"
              className="text-[1rem] leading-none"
            >
              ×
            </button>
          </span>
        </div>
      )}

      {estado === "ok" && leads.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Todavía no hay ventas en tu pipeline
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {ETAPAS.map((et) => {
            const items = porEtapa.get(et.estado) ?? [];
            const cerrable = et.estado !== "ganado" && et.estado !== "perdido";
            const visible = visiblePorEtapa[et.estado] ?? PAGINA_ETAPA;
            const mostrados = items.slice(0, visible);
            const restantes = items.length - mostrados.length;
            const destacada = etapaDestacada === et.estado;
            return (
              <section
                key={et.estado}
                ref={destacada ? columnaDestacada : undefined}
                className={`flex min-w-0 flex-col ${destacada ? "rounded-tarjeta bg-brasa-suave/40 p-2 ring-2 ring-brasa" : ""}`}
              >
                {/* Encabezado de columna */}
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${et.acento}`} />
                  <h2 className="text-[0.95rem] font-bold text-tinta">{et.titulo}</h2>
                  <span className="ml-auto rounded-full bg-arena px-2 py-0.5 text-xs font-bold tabular-nums text-tinta-2">
                    {items.length}
                  </span>
                </div>

                {/* Columna con altura máxima y scroll interno: nunca crece
                    infinito por más leads que tenga la etapa. */}
                <div className="flex max-h-[calc(100vh-13rem)] flex-col gap-2.5 overflow-y-auto pr-0.5">
                  {items.length === 0 && (
                    <div className="rounded-tarjeta border border-dashed border-linea px-3 py-6 text-center">
                      <span aria-hidden className={`mx-auto block h-2.5 w-2.5 rounded-full ${et.acento} opacity-40`} />
                      <p className="mt-2 text-[0.8rem] text-frio">{et.ayuda}</p>
                    </div>
                  )}

                  {mostrados.map((lead) => {
                    const nivel = NIVEL_ETIQUETA[lead.nivelInteres];
                    const trabajando = ocupado === lead.id;
                    return (
                      <article
                        key={lead.id}
                        onClick={() => alHacerClick(lead)}
                        onDoubleClick={() => alDobleClick(lead)}
                        title="Un click: ver detalle · Doble click: abrir conversación"
                        className="cursor-pointer rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="block min-w-0 flex-1 truncate font-semibold text-tinta">
                            {lead.nombre ?? lead.contactoExterno}
                          </span>
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
                          {lead.origenEtiqueta === "comentario" && (
                            <span className="rounded-full bg-tibio-suave px-2 py-0.5 text-[0.66rem] font-bold text-tibio">
                              💬 vino de un comentario
                            </span>
                          )}
                          {/* De dónde vino, igual que en Conversaciones (2026-10-06): antes
                              acá salía el id crudo del anuncio ("📣 120256…"). */}
                          {lead.origenEtiqueta !== "comentario" && <OrigenLead lead={lead} compacto />}
                        </div>

                        {/* Acciones de cierre — solo en etapas activas.
                            stopPropagation: no abrir el popup al usar los botones. */}
                        {cerrable && (
                          <div className="mt-3 flex gap-2">
                            <button
                              disabled={trabajando}
                              onClick={(e) => { e.stopPropagation(); mover(lead, { tipo: "marcar_ganado" }); }}
                              className="flex-1 rounded-chip bg-ok/12 px-2.5 py-1.5 text-[0.78rem] font-bold text-ok transition hover:bg-ok/20 disabled:opacity-50"
                            >
                              Gané
                            </button>
                            <button
                              disabled={trabajando}
                              onClick={(e) => { e.stopPropagation(); mover(lead, { tipo: "descartar" }); }}
                              className="flex-1 rounded-chip bg-arena px-2.5 py-1.5 text-[0.78rem] font-bold text-frio transition hover:bg-linea disabled:opacity-50"
                            >
                              Descartar
                            </button>
                          </div>
                        )}

                        {/* Mover a mano entre etapas abiertas — y "Reabrir" en
                            Ganados/Perdidos (contrato mover_etapa). */}
                        <select
                          value=""
                          disabled={trabajando}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            const v = e.target.value as "" | "nuevo" | "nutriendo" | "escalado";
                            if (v) moverEtapa(lead, v);
                          }}
                          aria-label="Mover el lead a otra etapa"
                          className="mt-2 w-full cursor-pointer rounded-chip border border-linea bg-carta px-2.5 py-2 text-[0.8rem] font-semibold text-tinta-2 transition hover:border-brasa/50 hover:text-tinta"
                        >
                          <option value="">{cerrable ? "↔ Mover a…" : "↩ Reabrir en…"}</option>
                          {ETAPAS.filter(
                            (e2) => e2.estado !== lead.estado && e2.estado !== "ganado" && e2.estado !== "perdido",
                          ).map((e2) => (
                            <option key={e2.estado} value={e2.estado}>{e2.titulo}</option>
                          ))}
                        </select>
                      </article>
                    );
                  })}

                  {/* Ver más: carga otra tanda de esta etapa (sin recargar). */}
                  {restantes > 0 && (
                    <button
                      onClick={() =>
                        setVisiblePorEtapa((prev) => ({
                          ...prev,
                          [et.estado]: visible + PAGINA_ETAPA,
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

      {/* Popup de vista rápida (1 click sobre una tarjeta): resumen +
          conversación completa + responder, sin salir del tablero. Doble click
          en la tarjeta entra directo a la conversación. */}
      {leadAbierto && (
        <PopupLead
          lead={leadAbierto}
          tenant={leadAbierto.tenantId}
          onCerrar={() => setLeadAbierto(null)}
          onCambio={(tipo) => mover(leadAbierto, { tipo })}
        />
      )}
    </div>
  );
}
