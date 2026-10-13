"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, filtroInicialDeBandeja, leerSesion } from "@/lib/auth";
import {
  paginaBandejaGlobalFiltrada,
  cargarProgresivo,
  obtenerReporteGlobal,
  obtenerEquipo,
  type Lead,
  type LeadGlobal,
  type NegocioBandeja,
  type ReporteGlobal,
  type NivelInteres,
  type EstadoLead,
} from "@/lib/api";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { IconoRayo } from "@/components/Iconos";
import { SkeletonLista } from "@/components/Skeletons";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { BloqueHoy } from "@/components/panel/BloqueHoy";
import { agregarPaginaVieja } from "@/lib/bandeja-rapida";
import { soles as solesFmt } from "@/lib/dinero";
import { ESTADO_ABIERTOS, cumpleEstado, esCalienteSinAtender } from "@/lib/enlaces";
import { BarraFiltrosCrm } from "@/components/panel/BarraFiltrosCrm";
import { InfoFilaLead } from "@/components/panel/InfoFilaLead";
import { ListaEtiquetas } from "@/components/panel/ChipEtiqueta";
import { AccionesRapidasLead } from "@/components/panel/AccionesRapidasLead";
import { useDatos } from "@/lib/useDatos";
import { useBusquedaCrm, useEtiquetasDisponibles, useFiltrosCrm } from "@/lib/useFiltrosCrm";
import {
  alternarEtiqueta, claveFiltrosCrm, cumpleFiltrosCrm, etiquetasDe, hayFiltrosCrm, listaConCamposCrm,
  ordenarLista, origenesDeLista, paresServidor,
} from "@/lib/crm-filtros";

type Estado = "cargando" | "ok" | "error";
type FiltroNivel = "todos" | NivelInteres;
type FiltroEstado = "todos" | EstadoLead | typeof ESTADO_ABIERTOS;

// Un solo formato de dinero en la web (lib/dinero.ts, 2026-10-09). Acá los montos vienen en soles.
const soles = solesFmt;

const FILTROS_NIVEL: { id: FiltroNivel; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

const FILTROS_ESTADO: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  // "Sin cerrar" = ni ganado ni perdido: la regla de "calientes sin atender".
  { id: ESTADO_ABIERTOS, label: "Sin cerrar" },
  { id: "nuevo", label: "Nuevos" },
  { id: "nutriendo", label: "En seguimiento" },
  { id: "escalado", label: "Para atender" },
  { id: "ganado", label: "Ganados" },
  { id: "perdido", label: "Perdidos" },
];

function minutosDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

// En la vista global la etiqueta del negocio va SIEMPRE — es el dato que
// distingue esta pantalla de la bandeja por empresa.
function aTarjeta(lead: LeadGlobal, conEtiqueta: boolean, crm: Pick<TarjetaLeadProps, "extra" | "pie"> = {}): TarjetaLeadProps {
  return {
    ...crm,
    id: lead.id,
    // La ficha abre con el negocio del lead (antes se fijaba con un
    // onClickCapture alrededor de la tarjeta).
    tenant: lead.tenantId,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    empresa: conEtiqueta ? lead.negocioNombre : undefined,
    temperatura: lead.nivelInteres,
    urgente: lead.nivelInteres === "caliente" && lead.estado === "nuevo",
    resumenIA: lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead.",
    // Desde el último MENSAJE, no desde la última edición (`actualizadoEn` se
    // mueve al cambiarle la etapa o la nota y el lead "acababa de escribir").
    haceMinutos: minutosDesde(lead.ultimoMensajeEn ?? lead.creadoEn),
  };
}

// Dashboard GLOBAL — la portada del panel unificado (decisión 2026-07-22):
// el resumen de plata (GET /reportes/global) + la bandeja de leads de TODOS
// los negocios de captación (GET /bandeja-global) con filtros por
// negocio/nivel/estado y búsqueda (recibe ?buscar= del buscador del header).
// Los negocios restaurante/delivery no aparecen: sus pedidos viven en la app
// de Cocina.
function GlobalPanelInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<LeadGlobal[]>([]);
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [reporte, setReporte] = useState<ReporteGlobal | null>(null);
  const [filtroNegocio, setFiltroNegocio] = useState<string>("todos");
  // Arranca en el predeterminado del dueño si fijó uno (2026-09-22). Una vez.
  // Si el link trae `?negocio=` (Reportes de un negocio, p. ej.), manda ese.
  const [filtroInicializado, setFiltroInicializado] = useState(false);
  useEffect(() => {
    if (filtroInicializado || negocios.length === 0) return;
    setFiltroInicializado(true);
    const delLink = searchParams.get("negocio");
    setFiltroNegocio(delLink && negocios.some((n) => n.tenantId === delLink) ? delLink : filtroInicialDeBandeja(negocios, "todos"));
  }, [negocios, filtroInicializado, searchParams]);
  // LOS FILTROS DEL LINK (2026-10-09): /leads redirige acá con varios
  // negocios, y "ver los calientes" de la campana o Inicio tiene que abrir
  // los calientes también acá.
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>(() => {
    const v = searchParams.get("nivel");
    return FILTROS_NIVEL.some((f) => f.id === v) ? (v as FiltroNivel) : "todos";
  });
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>(() => {
    const v = searchParams.get("estado");
    return FILTROS_ESTADO.some((f) => f.id === v) ? (v as FiltroEstado) : "todos";
  });
  // CRM FASE 2 (2026-10-13): etiqueta, asignado, sin respuesta, origen,
  // fecha, orden y la búsqueda EN EL SERVIDOR, todo en la URL (`?q=`; el
  // `?buscar=` del header también vale).
  const { filtros, cambiar: cambiarCrm } = useFiltrosCrm("/global");
  const [busqueda, setBusqueda] = useBusquedaCrm(filtros.q, (q) => cambiarCrm({ q }));
  const miUsuarioId = leerSesion()?.usuario?.id ?? null;
  const [completando, setCompletando] = useState(false);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  // LA PRIMERA PÁGINA AL INSTANTE (2026-10-09): antes se esperaban hasta 20
  // páginas en serie antes de pintar una tarjeta, y otra vez en cada chip.
  const claveCrm = claveFiltrosCrm(filtros);
  const cargaRef = useRef(0);
  const cargar = useCallback(async () => {
    const gen = ++cargaRef.current;
    setEstado("cargando");
    setCompletando(true);
    void obtenerReporteGlobal().then((rep) => { if (gen === cargaRef.current) setReporte(rep); });
    const pedido = {
      nivel: filtroNivel === "todos" ? undefined : filtroNivel,
      estado: filtroEstado === "todos" || filtroEstado === ESTADO_ABIERTOS ? undefined : filtroEstado,
      origen: filtros.origen || undefined,
      tenantId: filtroNegocio === "todos" ? undefined : filtroNegocio,
      crm: paresServidor(filtros),
    };
    try {
      await cargarProgresivo<LeadGlobal, { negocios: NegocioBandeja[]; items: LeadGlobal[]; siguienteCursor: string | null }>(
        (cursor) => paginaBandejaGlobalFiltrada(pedido, cursor),
        (items, { primera, respuesta }) => {
          setNegocios(respuesta.negocios);
          setLeads((prev) => (primera ? items : agregarPaginaVieja(prev, items)));
          if (primera) setEstado("ok");
        },
        () => gen === cargaRef.current,
      );
    } catch (e) {
      void e;
      if (gen === cargaRef.current) setEstado((prev) => (prev === "ok" ? "ok" : "error"));
    } finally {
      if (gen === cargaRef.current) setCompletando(false);
    }
    // `claveCrm` resume `filtros` (el objeto cambia con cada render de la URL).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroNivel, filtroEstado, claveCrm, filtroNegocio]);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  // La regla del backend (caliente y ni ganado ni perdido), la misma de
  // Inicio y la campana (2026-10-09).
  const calientes = useMemo(() => leads.filter(esCalienteSinAtender).length, [leads]);

  // Lo que el backend puede no filtrar ("Sin cerrar", el origen, lo que se
  // está escribiendo) se filtra acá, en el orden elegido.
  const visibles = useMemo(
    () => ordenarLista(
      leads.filter((l) => cumpleEstado(l, filtroEstado) && cumpleFiltrosCrm(l, { ...filtros, q: busqueda }, { miUsuarioId })),
      filtros.orden,
    ),
    [leads, filtroEstado, filtros, busqueda, miUsuarioId],
  );
  const hayFiltros = filtroNivel !== "todos" || filtroEstado !== "todos" || hayFiltrosCrm(filtros) || !!busqueda.trim();
  function quitarFiltros() {
    setFiltroNivel("todos");
    setFiltroEstado("todos");
    setBusqueda("");
    router.replace("/global", { scroll: false });
  }

  // Etiquetas para autocompletar, orígenes y el equipo del negocio enfocado
  // (con todos los negocios, "asignado" ofrece Míos / Sin asignar).
  const negocioEnfocado = filtroNegocio === "todos" ? null : filtroNegocio;
  const etiquetasDisponibles = useEtiquetasDisponibles(negocioEnfocado, leads);
  const origenes = useMemo(() => origenesDeLista(leads), [leads]);
  const conCamposCrm = useMemo(() => listaConCamposCrm(leads), [leads]);
  const { datos: equipo } = useDatos(
    listo && negocioEnfocado ? `equipo@${negocioEnfocado}` : null,
    () => obtenerEquipo(negocioEnfocado ?? undefined),
    { maxEdadMs: 60_000 },
  );
  function nombreDe(usuarioId: string | null | undefined): string | null {
    if (!usuarioId) return null;
    if (usuarioId === miUsuarioId) return "Tú";
    const m = equipo?.miembros.find((x) => x.usuarioId === usuarioId);
    return m ? (m.nombre ?? m.email) : null;
  }
  function actualizarLocal(id: string, cambios: Partial<Lead>) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...cambios } : l)));
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Todos tus negocios</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Tu operación</h1>
        <p className="mt-1 text-[0.9rem] text-frio">
          Tus leads y ventas, todos juntos. Filtra por negocio cuando quieras enfocarte.
        </p>
      </header>

      {/* "HOY" DE TODOS LOS NEGOCIOS (CRM fase 1, 2026-10-13): con varios
          negocios este es el Inicio, así que lo que toca hacer va acá arriba,
          cada renglón con el chip de su negocio. */}
      <BloqueHoy conNegocio />

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por nombre, teléfono, etiqueta, clínica o correo…"
        className="w-full rounded-chip bg-carta px-4 py-2.5 text-sm text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-brasa/40 sm:max-w-md"
        aria-label="Buscar leads"
      />

      {/* Resumen de plata entre todos los negocios (mismo dato que Reportes) */}
      {reporte && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Ganado</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-ok">{soles(reporte.totalGanada)}</p>
          </div>
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Por cobrar</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-brasa-texto">{soles(reporte.totalPorCobrar)}</p>
          </div>
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Ventas cerradas</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-tinta">{reporte.totalVentas}</p>
          </div>
        </div>
      )}

      {/* Card destacada: calientes sin atender (entre TODOS los negocios) */}
      {estado === "ok" && calientes > 0 && !(filtroNivel === "caliente" && filtroEstado === ESTADO_ABIERTOS) && (
        <button
          onClick={() => { setFiltroNivel("caliente"); setFiltroEstado(ESTADO_ABIERTOS); }}
          className="flex w-full items-center gap-3 rounded-tarjeta bg-calor px-5 py-4 text-left text-carta shadow-[0_8px_24px_rgba(179,92,0,0.3)] transition active:scale-[0.99]"
        >
          <IconoRayo className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-[1.1rem] font-bold leading-tight">
              {calientes} {calientes === 1 ? "lead caliente" : "leads calientes"} sin atender
            </p>
            <p className="text-[0.85rem] text-carta/85">En todos tus negocios — listos para cerrar</p>
          </div>
        </button>
      )}

      {/* Filtro por negocio */}
      {negocios.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroNegocio("todos")}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              filtroNegocio === "todos" ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            Todos mis negocios
          </button>
          {negocios.map((n) => (
            <button
              key={n.tenantId}
              onClick={() => setFiltroNegocio(n.tenantId)}
              className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
                filtroNegocio === n.tenantId ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea"
              }`}
            >
              {n.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Filtros de nivel y estado (los mismos de la bandeja por empresa) */}
      <div className="flex flex-wrap gap-2">
        {FILTROS_NIVEL.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroNivel(f.id)}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              filtroNivel === f.id ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTROS_ESTADO.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroEstado(f.id)}
            className={`shrink-0 rounded-chip px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${
              filtroEstado === f.id ? "bg-tibio-suave text-tibio" : "bg-carta text-frio ring-1 ring-linea"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ETIQUETA, ASIGNADO, SIN RESPUESTA, ORIGEN, FECHA Y ORDEN (CRM fase 2). */}
      <BarraFiltrosCrm
        filtros={filtros}
        cambiar={cambiarCrm}
        etiquetas={etiquetasDisponibles}
        miembros={equipo?.miembros}
        miUsuarioId={miUsuarioId}
        origenes={origenes}
        conEsperando={conCamposCrm}
      />

      {completando && estado === "ok" && <p className="text-[0.78rem] text-frio" role="status">Cargando más leads…</p>}

      {estado === "cargando" && <SkeletonLista filas={6} />}

      {estado === "error" && <ErrorConReintento mensaje="No pudimos cargar tus leads." reintentar={cargar} />}

      {estado === "ok" && !completando && hayFiltros && visibles.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-bold text-tinta">Ningún lead con estos filtros</p>
          <button
            type="button"
            onClick={quitarFiltros}
            className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-carta px-5 py-2.5 text-[0.9rem] font-semibold text-brasa-texto ring-1 ring-linea transition hover:bg-arena"
          >
            Quitar filtros
          </button>
        </div>
      )}

      {estado === "ok" && !completando && !hayFiltros && leads.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Aún no hay leads en tus negocios de captación
          </p>
          <p className="mt-1 text-[0.88rem] text-frio">
            Cuando lleguen mensajes a cualquiera de tus negocios, aparecerán aquí.
          </p>
        </div>
      )}

      {estado === "ok" && visibles.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((l) => (
            // TarjetaLead abre la ficha con el negocio del lead (LinkLead).
            <TarjetaLead
              key={l.id}
              lead={aTarjeta(l, negocios.length > 1, {
                extra: <InfoFilaLead lead={l} asignado={nombreDe(l.asignadoA)} />,
                pie: (
                  <div className="flex items-center justify-between gap-2">
                    <ListaEtiquetas
                      etiquetas={etiquetasDe(l)}
                      onElegir={(e) => cambiarCrm({ etiquetas: alternarEtiqueta(filtros, e).etiquetas })}
                      activas={filtros.etiquetas}
                    />
                    <span className="ml-auto">
                      <AccionesRapidasLead lead={l} onCambio={(c) => actualizarLocal(l.id, c)} />
                    </span>
                  </div>
                ),
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// useSearchParams exige Suspense en el prerender de Next (App Router).
export default function GlobalPanel() {
  return (
    <Suspense fallback={null}>
      <GlobalPanelInner />
    </Suspense>
  );
}
