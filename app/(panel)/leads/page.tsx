"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import { listarLeads, crearLeadManual, type Lead, type NivelInteres, type EstadoLead } from "@/lib/api";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { IconoRayo } from "@/components/Iconos";
import { SkeletonLista } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";
type FiltroNivel = "todos" | NivelInteres;

const FILTROS_NIVEL: { id: FiltroNivel; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

// Los `id` son los valores reales del backend; los `label` son en lenguaje
// simple para el cliente (sin jerga tipo "nutriendo"/"escalado").
const FILTROS_ESTADO: { id: "todos" | EstadoLead; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "nuevo", label: "Nuevos" },
  { id: "nutriendo", label: "En seguimiento" },
  { id: "escalado", label: "Para atender" },
  { id: "ganado", label: "Ganados" },
  { id: "perdido", label: "Perdidos" },
];

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
  };
}

// Leads del panel de escritorio: misma lógica de filtros que la bandeja móvil
// (app/bandeja), pero en grilla ancha para aprovechar el espacio de escritorio.
// Datos reales desde el backend (GET /leads), con filtros por nivel de interés
// y por estado del lead.
export default function LeadsPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoLead>("todos");
  // Búsqueda (del buscador global del header vía ?buscar=, o del input local)
  const [busqueda, setBusqueda] = useState("");
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
    // Lee los parámetros de la URL una vez (sin useSearchParams para evitar el
    // requisito de Suspense en el prerender).
    const params = new URLSearchParams(window.location.search);
    const q = params.get("buscar");
    if (q) setBusqueda(q);
    if (params.get("nuevo") === "1") setNuevoAbierto(true);
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const r = await listarLeads({
        nivel: filtroNivel === "todos" ? undefined : filtroNivel,
        estado: filtroEstado === "todos" ? undefined : filtroEstado,
      });
      setLeads(r);
      setEstado("ok");
    } catch (e) {
      void e;
      setEstado("error");
    }
  }, [filtroNivel, filtroEstado]);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  const calientes = useMemo(
    () => leads.filter((l) => l.nivelInteres === "caliente" && l.estado === "nuevo").length,
    [leads],
  );

  // Filtro de búsqueda en cliente: por nombre, contacto o resumen de la IA.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        (l.nombre ?? "").toLowerCase().includes(q) ||
        l.contactoExterno.toLowerCase().includes(q) ||
        (l.resumenIA ?? "").toLowerCase().includes(q),
    );
  }, [leads, busqueda]);

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
          <p className="eyebrow">Tu bandeja</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Leads</h1>
        </div>
        <button
          onClick={() => setNuevoAbierto(true)}
          className="rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-carta transition hover:bg-brasa-hondo"
        >
          ＋ Nuevo lead
        </button>
      </header>

      {/* Búsqueda dentro de la bandeja */}
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="🔍 Buscar por nombre, contacto o lo que dijo…"
        className="w-full rounded-chip bg-carta px-4 py-2.5 text-sm text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-brasa/40 sm:max-w-md"
        aria-label="Buscar leads"
      />

      {/* Card destacada: calientes sin atender */}
      {estado === "ok" && calientes > 0 && (
        <button
          onClick={() => setFiltroNivel("caliente")}
          className="flex w-full items-center gap-3 rounded-tarjeta bg-calor px-5 py-4 text-left text-carta shadow-[0_8px_24px_rgba(240,112,79,0.3)] transition active:scale-[0.99]"
        >
          <IconoRayo className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-[1.1rem] font-bold leading-tight">
              {calientes} {calientes === 1 ? "lead caliente" : "leads calientes"} sin atender
            </p>
            <p className="text-[0.85rem] text-carta/85">Tocá para verlos — están listos para cerrar</p>
          </div>
        </button>
      )}

      {/* Filtros de nivel de interés */}
      <div className="flex flex-wrap gap-2">
        {FILTROS_NIVEL.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltroNivel(f.id)}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              filtroNivel === f.id
                ? "bg-tinta text-carta"
                : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtros de estado */}
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

      {/* Estados de carga */}
      {estado === "cargando" && <SkeletonLista filas={6} />}

      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar los leads. Recargá.</p>
        </div>
      )}

      {estado === "ok" && visibles.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Aún no tenés leads. Conectá WhatsApp para empezar
          </p>
          <Link
            href="/configuracion"
            className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition active:scale-[0.99]"
          >
            Conectar WhatsApp
          </Link>
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
            className="w-full max-w-sm rounded-tarjeta bg-carta p-5 shadow-[0_8px_24px_rgba(15,23,42,0.2)] ring-1 ring-linea"
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
            {errorNuevo && <p className="mt-2 text-[0.82rem] font-semibold text-calor-hondo">{errorNuevo}</p>}
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
                className="flex-1 rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
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
