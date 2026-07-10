"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import { listarLeads, type Lead, type NivelInteres, type EstadoLead } from "@/lib/api";
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

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
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

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu bandeja</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Leads</h1>
      </header>

      {/* Card destacada: calientes sin atender */}
      {estado === "ok" && calientes > 0 && (
        <button
          onClick={() => setFiltroNivel("caliente")}
          className="flex w-full items-center gap-3 rounded-tarjeta bg-brasa px-5 py-4 text-left text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
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

      {estado === "ok" && leads.length === 0 && (
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

      {estado === "ok" && leads.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {leads.map((l) => (
            <TarjetaLead key={l.id} lead={aTarjeta(l)} />
          ))}
        </div>
      )}
    </div>
  );
}
