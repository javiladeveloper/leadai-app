"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { haySesion, esModoGlobal, leerEmpresaActiva } from "@/lib/auth";
import {
  paginaLeadsFiltrada, cargarProgresivo, crearLeadManual, tieneCanalActivo,
  type Lead, type NivelInteres, type EstadoLead,
} from "@/lib/api";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { IconoRayo } from "@/components/Iconos";
import { SkeletonLista } from "@/components/Skeletons";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { HeroSeccion, LeadsIlustracion } from "@/components/panel/HeroSeccion";
import { agregarPaginaVieja } from "@/lib/bandeja-rapida";
import { guardarCache, leerCache } from "@/lib/cache-datos";
import { useDatos } from "@/lib/useDatos";
import {
  ESTADO_ABIERTOS, URL_CONECTAR_CANALES, cumpleEstado, cumpleOrigen, esCalienteSinAtender,
} from "@/lib/enlaces";

type Estado = "cargando" | "ok" | "error";
type FiltroNivel = "todos" | NivelInteres;
type FiltroEstado = "todos" | EstadoLead | typeof ESTADO_ABIERTOS;

const FILTROS_NIVEL: { id: FiltroNivel; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

// Los `id` son los valores reales del backend; los `label` son en lenguaje
// simple para el cliente (sin jerga tipo "nutriendo"/"escalado"). "Sin cerrar"
// no existe en el backend: es "ni ganado ni perdido", la regla de "calientes
// sin atender" (ver lib/enlaces.ts).
const FILTROS_ESTADO: { id: FiltroEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: ESTADO_ABIERTOS, label: "Sin cerrar" },
  { id: "nuevo", label: "Nuevos" },
  { id: "nutriendo", label: "En seguimiento" },
  { id: "escalado", label: "Para atender" },
  { id: "ganado", label: "Ganados" },
  { id: "perdido", label: "Perdidos" },
];

const esNivel = (v: string | null): v is FiltroNivel => !!v && FILTROS_NIVEL.some((f) => f.id === v);
const esEstado = (v: string | null): v is FiltroEstado => !!v && FILTROS_ESTADO.some((f) => f.id === v);

// Convierte un timestamp ISO en minutos transcurridos hasta ahora, para
// reusar el formato "hace X" de TarjetaLead.
function minutosDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

// Adapta el Lead real del backend (lib/api) al shape mínimo que TarjetaLead
// necesita para renderizarse (ver components/TarjetaLead.tsx).
function aTarjeta(lead: Lead): TarjetaLeadProps {
  return {
    id: lead.id,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    temperatura: lead.nivelInteres,
    urgente: lead.nivelInteres === "caliente" && lead.estado === "nuevo",
    resumenIA: lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead.",
    haceMinutos: minutosDesde(lead.actualizadoEn),
    origen: lead.origen,
    entro: new Date(lead.creadoEn).toLocaleDateString("es-PE", { day: "numeric", month: "short" }),
  };
}

/** El nombre legible de un filtro de origen (`ad:<id>` → el nombre del anuncio). */
function nombreDeOrigen(origen: string, leads: Lead[]): string {
  if (origen === "directo") return "Mensaje directo";
  if (origen === "comentario") return "Comentarios";
  const conNombre = leads.find((l) => cumpleOrigen(l, origen) && l.origen?.etiqueta);
  if (conNombre?.origen) return conNombre.origen.etiqueta;
  return origen.startsWith("ad:") ? "un anuncio" : origen;
}

// Leads del panel de escritorio: misma lógica de filtros que la bandeja móvil
// (app/bandeja), pero en grilla ancha para aprovechar el espacio de escritorio.
// Datos reales desde el backend (GET /leads), con filtros por nivel de interés
// y por estado del lead.
//
// LOS FILTROS VIVEN EN LA URL (2026-10-09): `?nivel=`, `?estado=`, `?origen=`
// y `?buscar=`. Inicio, la campana y Reportes mandan acá con la lista ya
// filtrada ("7 calientes sin atender" abre ESOS siete), y el link se puede
// compartir o guardar.
function LeadsPanelInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<Lead[]>([]);
  // Mientras llegan las páginas que siguen a la primera.
  const [completando, setCompletando] = useState(false);
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>(() => {
    const v = searchParams.get("nivel");
    return esNivel(v) ? v : "todos";
  });
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>(() => {
    const v = searchParams.get("estado");
    return esEstado(v) ? v : "todos";
  });
  const [filtroOrigen, setFiltroOrigen] = useState<string>(() => searchParams.get("origen") ?? "");
  // Búsqueda (del buscador global del header vía ?buscar=, o del input local)
  const [busqueda, setBusqueda] = useState(() => searchParams.get("buscar") ?? "");
  // Alta manual de lead (?nuevo=1 desde el sidebar, o botón local)
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoContacto, setNuevoContacto] = useState("");
  const [nuevoNota, setNuevoNota] = useState("");
  const [creando, setCreando] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState("");

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // En modo global, la bandeja de leads ES el dashboard /global (todos los
    // negocios juntos con filtros) — esta pantalla queda para una empresa.
    // Los filtros de la URL viajan con la redirección (2026-10-09): "ver los
    // calientes" desde la campana tiene que abrir los calientes también ahí.
    if (esModoGlobal()) {
      router.replace(`/global${window.location.search}`);
      return;
    }
    setListo(true);
  }, [router]);

  // ¿HAY WHATSAPP CONECTADO? (2026-09-06, captura de Jonathan en J&V: canal
  // conectado y el vacío igual gritaba "Conecta WhatsApp"). Si falla la
  // consulta se asume que SÍ — ofrecerle conectar a quien ya conectó es
  // acusarlo de no haberlo hecho. Caché compartida con las demás secciones.
  const { datos: tieneCanal } = useDatos(
    listo ? `tiene-canal@${leerEmpresaActiva() || "-"}` : null,
    () => tieneCanalActivo(),
    { maxEdadMs: 60_000 },
  );

  // Reactivo a la URL: el buscador del header hace push a /leads?buscar=… y el
  // sidebar a /leads?nuevo=1; si ya estamos en /leads, Next no remonta la
  // página, así que hay que escuchar los cambios de searchParams (no leer la
  // URL una sola vez al montar). Lo mismo con los filtros que trae un link.
  useEffect(() => {
    const q = searchParams.get("buscar");
    if (q) setBusqueda(q);
    if (searchParams.get("nuevo") === "1") setNuevoAbierto(true);
    const n = searchParams.get("nivel");
    if (esNivel(n)) setFiltroNivel(n);
    const e = searchParams.get("estado");
    if (esEstado(e)) setFiltroEstado(e);
    const o = searchParams.get("origen");
    if (o) setFiltroOrigen(o);
  }, [searchParams]);

  /** Los filtros elegidos a mano también quedan en la URL (sin llenar el historial). */
  function escribirFiltros(cambios: { nivel?: FiltroNivel; estado?: FiltroEstado; origen?: string }) {
    const qs = new URLSearchParams(window.location.search);
    qs.delete("nuevo");
    const poner = (k: string, v: string | undefined, vacio: string) => {
      if (v === undefined) return;
      if (!v || v === vacio) qs.delete(k);
      else qs.set(k, v);
    };
    poner("nivel", cambios.nivel, "todos");
    poner("estado", cambios.estado, "todos");
    poner("origen", cambios.origen, "");
    const s = qs.toString();
    router.replace(`/leads${s ? `?${s}` : ""}`, { scroll: false });
  }
  function elegirNivel(n: FiltroNivel) { setFiltroNivel(n); escribirFiltros({ nivel: n }); }
  function elegirEstado(e: FiltroEstado) { setFiltroEstado(e); escribirFiltros({ estado: e }); }
  function quitarFiltros() {
    setFiltroNivel("todos");
    setFiltroEstado("todos");
    setFiltroOrigen("");
    setBusqueda("");
    router.replace("/leads", { scroll: false });
  }

  /**
   * LA PRIMERA PÁGINA AL INSTANTE (2026-10-09). `listarLeads` bajaba hasta 20
   * páginas EN SERIE antes de pintar nada, y otra vez en cada chip. Ahora se
   * pinta la primera y el resto se suma detrás. El backend filtra nivel y
   * estado; "Sin cerrar" y el origen se vuelven a filtrar acá (el backend
   * todavía puede no conocerlos).
   *
   * Y AL VOLVER, LO DE LA ÚLTIMA VEZ: se guarda la lista por filtro en la
   * caché en memoria, y al volver a esta sección se pinta al instante
   * mientras se actualiza por detrás.
   */
  const claveLista = `leads@${leerEmpresaActiva() || "-"}|${filtroNivel}|${filtroEstado}|${filtroOrigen}`;
  const cargaRef = useRef(0);
  const cargar = useCallback(async () => {
    const gen = ++cargaRef.current;
    const guardada = leerCache<Lead[]>(claveLista);
    if (guardada) {
      setLeads(guardada);
      setEstado("ok");
    } else {
      setEstado("cargando");
    }
    setCompletando(true);
    const filtros = {
      nivel: filtroNivel === "todos" ? undefined : filtroNivel,
      estado: filtroEstado === "todos" || filtroEstado === ESTADO_ABIERTOS ? undefined : filtroEstado,
      origen: filtroOrigen || undefined,
    };
    let acumulado: Lead[] = [];
    try {
      await cargarProgresivo<Lead, { items: Lead[]; siguienteCursor: string | null }>(
        (cursor) => paginaLeadsFiltrada(filtros, cursor),
        (items, { primera, ultima }) => {
          acumulado = primera ? items : agregarPaginaVieja(acumulado, items);
          // Con algo ya en pantalla (lo de la última vez) se espera al final
          // para no achicar la lista y volver a agrandarla.
          if (!guardada || ultima) {
            setLeads(acumulado);
            setEstado("ok");
          }
        },
        () => gen === cargaRef.current,
      );
      if (gen === cargaRef.current) {
        setLeads(acumulado);
        setEstado("ok");
        guardarCache(claveLista, acumulado);
      }
    } catch (e) {
      void e;
      if (gen === cargaRef.current) setEstado((prev) => (prev === "ok" ? "ok" : "error"));
    } finally {
      if (gen === cargaRef.current) setCompletando(false);
    }
  }, [claveLista, filtroNivel, filtroEstado, filtroOrigen]);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  // Lo que pasa los filtros que el backend puede no aplicar.
  const filtrados = useMemo(
    () => leads.filter((l) => cumpleEstado(l, filtroEstado) && cumpleOrigen(l, filtroOrigen)),
    [leads, filtroEstado, filtroOrigen],
  );

  // LA MISMA REGLA QUE INICIO Y LA CAMPANA (2026-10-09): caliente y ni ganado
  // ni perdido. Era "caliente y nuevo", y los tres números no cuadraban.
  const calientes = useMemo(() => leads.filter(esCalienteSinAtender).length, [leads]);

  // Filtro de búsqueda en cliente: por nombre, contacto o resumen de la IA.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return filtrados;
    return filtrados.filter(
      (l) =>
        (l.nombre ?? "").toLowerCase().includes(q) ||
        l.contactoExterno.toLowerCase().includes(q) ||
        (l.resumenIA ?? "").toLowerCase().includes(q),
    );
  }, [filtrados, busqueda]);

  const hayFiltros = filtroNivel !== "todos" || filtroEstado !== "todos" || !!filtroOrigen || !!busqueda.trim();

  async function crearNuevo() {
    if (creando || !nuevoNombre.trim() || nuevoContacto.trim().length < 3) return;
    setCreando(true);
    setErrorNuevo("");
    const r = await crearLeadManual({
      nombre: nuevoNombre.trim(),
      contacto: nuevoContacto.trim(),
      nota: nuevoNota.trim() || undefined,
    });
    setCreando(false);
    if (r.ok) {
      setNuevoAbierto(false);
      setNuevoNombre(""); setNuevoContacto(""); setNuevoNota("");
      cargar();
    } else {
      setErrorNuevo(r.error ?? "No se pudo crear el lead.");
    }
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {/* El eyebrow es el bloque del menú (2026-10-09): "Tu bandeja" era un
              tercer nombre para lo mismo que el menú llama Conversaciones. */}
          <p className="eyebrow">Ventas</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Leads</h1>
        </div>
        <button
          onClick={() => setNuevoAbierto(true)}
          className="rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
        >
          ＋ Nuevo lead
        </button>
      </header>

      {/* EL HERO (2026-08-27, Jonathan: "el mismo esfuerzo que metimos para
          marketing... deberíamos tenerlo para cada sección"). Un título de una
          palabra no le dice a nadie qué hace acá ni por dónde empezar.
          Debajo del h1 y plegable (2026-10-09): explica, no compite con el
          título, y quien ya lo leyó lo oculta. */}
      <HeroSeccion
        plegable="leads"
        titulo="Todos los que te escribieron, en un solo lugar"
        bajada={<>Cada persona que te contactó por WhatsApp queda acá, con lo que la IA entendió de su mensaje.</>}
        nota="Los marcados como calientes son a los que conviene escribirles hoy."
        dibujo={<LeadsIlustracion />}
      />

      {/* Búsqueda dentro de la bandeja — con su lupa de verdad, no un emoji
          de placeholder (pasada UX 2026-09-06). */}
      <label className="relative block sm:max-w-md">
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
          placeholder="Buscar por nombre, contacto o lo que dijo…"
          className="w-full rounded-chip bg-carta py-2.5 pl-10 pr-4 text-sm text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-brasa/40"
          aria-label="Buscar leads"
        />
      </label>

      {/* Card destacada: calientes sin atender */}
      {estado === "ok" && calientes > 0 && !(filtroNivel === "caliente" && filtroEstado === ESTADO_ABIERTOS) && (
        <button
          onClick={() => { setFiltroNivel("caliente"); setFiltroEstado(ESTADO_ABIERTOS); escribirFiltros({ nivel: "caliente", estado: ESTADO_ABIERTOS }); }}
          className="flex w-full items-center gap-3 rounded-tarjeta bg-calor px-5 py-4 text-left text-carta shadow-[0_8px_24px_rgba(179,92,0,0.3)] transition active:scale-[0.99]"
        >
          <IconoRayo className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-[1.1rem] font-bold leading-tight">
              {calientes} {calientes === 1 ? "lead caliente" : "leads calientes"} sin atender
            </p>
            <p className="text-[0.85rem] text-carta/85">Toca para verlos — están listos para cerrar</p>
          </div>
        </button>
      )}

      {/* LOS DOS EJES DE FILTRO, CON NOMBRE (pasada UX 2026-09-06): eran 10
          chips sueltos en dos filas sin decir qué filtraba cada una — ahora
          cada fila lleva su micro-etiqueta y el activo usa UNA convención. */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-[0.72rem] font-semibold uppercase tracking-wide text-frio">
            Temperatura
          </span>
          {FILTROS_NIVEL.map((f) => (
            <button
              key={f.id}
              onClick={() => elegirNivel(f.id)}
              className={`shrink-0 rounded-chip px-4 py-2 text-[0.88rem] font-bold transition ${
                filtroNivel === f.id
                  ? "bg-brasa text-sobre-brasa"
                  : "bg-carta text-tinta-2 ring-1 ring-linea hover:ring-brasa/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-[0.72rem] font-semibold uppercase tracking-wide text-frio">
            Etapa
          </span>
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.id}
              onClick={() => elegirEstado(f.id)}
              className={`shrink-0 rounded-chip px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${
                filtroEstado === f.id
                  ? "bg-brasa text-sobre-brasa"
                  : "bg-carta text-frio ring-1 ring-linea hover:ring-brasa/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {/* DE DÓNDE VINO (2026-10-09): Reportes y Anuncios mandan acá "los
            leads de este anuncio". El chip dice cuál y se quita con la ×. */}
        {filtroOrigen && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 shrink-0 text-[0.72rem] font-semibold uppercase tracking-wide text-frio">
              Origen
            </span>
            <span className="inline-flex items-center gap-2 rounded-chip bg-brasa px-3.5 py-1.5 text-[0.82rem] font-semibold text-sobre-brasa">
              {nombreDeOrigen(filtroOrigen, leads)}
              <button
                type="button"
                onClick={() => { setFiltroOrigen(""); escribirFiltros({ origen: "" }); }}
                aria-label="Quitar el filtro de origen"
                className="text-[1rem] leading-none text-carta/80 hover:text-carta"
              >
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {completando && estado === "ok" && (
        <p className="text-[0.78rem] text-frio" role="status">Cargando más leads…</p>
      )}

      {/* Estados de carga */}
      {estado === "cargando" && <SkeletonLista filas={6} />}

      {estado === "error" && <ErrorConReintento mensaje="No pudimos cargar los leads." reintentar={cargar} />}

      {/* SIN RESULTADOS CON FILTROS NO ES "AÚN NO TIENES LEADS" (2026-10-09):
          a quien filtró por "Perdidos" y no tiene ninguno se le decía que no
          tenía leads y se le ofrecía conectar WhatsApp. */}
      {estado === "ok" && visibles.length === 0 && hayFiltros && !completando && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Ningún lead con estos filtros</p>
          <button
            type="button"
            onClick={quitarFiltros}
            className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-carta px-5 py-2.5 text-[0.9rem] font-semibold text-brasa-texto ring-1 ring-linea transition hover:bg-arena"
          >
            Quitar filtros
          </button>
        </div>
      )}

      {estado === "ok" && visibles.length === 0 && !hayFiltros && !completando && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            {tieneCanal === false
              ? "Aún no tienes leads. Conecta WhatsApp para empezar"
              : "Aún no tienes leads."}
          </p>
          {tieneCanal === true && (
            <p className="mt-1 text-[0.9rem] text-frio">
              Tu WhatsApp está conectado: cuando alguien te escriba, su lead aparece acá solito.
            </p>
          )}
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

      {estado === "ok" && visibles.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((l) => (
            <TarjetaLead key={l.id} lead={aTarjeta(l)} />
          ))}
        </div>
      )}

      {/* Modal: alta manual de lead (contacto de la calle / referido) */}
      {nuevoAbierto && (
        <div
          onClick={() => setNuevoAbierto(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-flotante)] ring-1 ring-linea"
          >
            <h3 className="text-[1.1rem] font-bold text-tinta">Nuevo lead</h3>
            <p className="mt-0.5 text-[0.82rem] text-frio">
              Para ese contacto que conociste fuera de las redes.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[0.82rem] font-bold text-tinta">Nombre</label>
                <input
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: María Torres"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              </div>
              <div>
                <label className="text-[0.82rem] font-bold text-tinta">Teléfono / contacto</label>
                <input
                  value={nuevoContacto}
                  onChange={(e) => setNuevoContacto(e.target.value)}
                  placeholder="Ej: 987 654 321"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              </div>
              <div>
                <label className="text-[0.82rem] font-bold text-tinta">Nota <span className="font-normal text-frio">(opcional)</span></label>
                <input
                  value={nuevoNota}
                  onChange={(e) => setNuevoNota(e.target.value)}
                  placeholder="Ej: interesada en contabilidad mensual"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              </div>
            </div>
            {errorNuevo && <p className="mt-2 text-[0.82rem] font-semibold text-alerta-hondo">{errorNuevo}</p>}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setNuevoAbierto(false)}
                className="flex-1 rounded-chip bg-arena px-4 py-2.5 text-sm font-semibold text-tinta-2 transition hover:bg-linea"
              >
                Cancelar
              </button>
              <button
                onClick={crearNuevo}
                disabled={creando || !nuevoNombre.trim() || nuevoContacto.trim().length < 3}
                className="flex-1 rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                {creando ? "Creando…" : "Crear lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// useSearchParams exige Suspense en el prerender de Next (App Router).
export default function LeadsPanel() {
  return (
    <Suspense fallback={null}>
      <LeadsPanelInner />
    </Suspense>
  );
}
