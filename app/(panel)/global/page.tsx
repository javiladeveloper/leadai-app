"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerEmpresaActiva, guardarEmpresaActiva, esModoGlobal, EMPRESA_GLOBAL } from "@/lib/auth";
import {
  listarBandejaGlobal,
  obtenerReporteGlobal,
  type LeadGlobal,
  type NegocioBandeja,
  type ReporteGlobal,
  type NivelInteres,
  type EstadoLead,
} from "@/lib/api";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { IconoRayo } from "@/components/Iconos";
import { SkeletonLista } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";
type FiltroNivel = "todos" | NivelInteres;

const soles = (n: number) => `S/${n.toLocaleString("es-PE")}`;

const FILTROS_NIVEL: { id: FiltroNivel; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

const FILTROS_ESTADO: { id: "todos" | EstadoLead; label: string }[] = [
  { id: "todos", label: "Todos" },
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
function aTarjeta(lead: LeadGlobal): TarjetaLeadProps {
  return {
    id: lead.id,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    empresa: lead.negocioNombre,
    temperatura: lead.nivelInteres,
    urgente: lead.nivelInteres === "caliente" && lead.estado === "nuevo",
    resumenIA: lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead.",
    haceMinutos: minutosDesde(lead.actualizadoEn),
  };
}

// Dashboard GLOBAL: todos los negocios de captación del usuario en una sola
// pantalla (decisión 2026-07-22: la vista global es un LUGAR aparte — se entra
// con "🌐 Vista global" en el selector del header — y las pantallas por
// empresa siguen mostrando solo lo suyo, sin mezclar). Arriba el resumen de
// plata (GET /reportes/global); abajo la bandeja unificada
// (GET /bandeja-global) con filtros por negocio/nivel/estado. Los negocios
// restaurante/delivery no aparecen: sus pedidos viven en la app de Cocina.
export default function GlobalPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<LeadGlobal[]>([]);
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [reporte, setReporte] = useState<ReporteGlobal | null>(null);
  const [filtroNegocio, setFiltroNegocio] = useState<string>("todos");
  const [filtroNivel, setFiltroNivel] = useState<FiltroNivel>("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoLead>("todos");

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // Estar en /global ES estar en modo global: lo fija aunque se llegue por
    // URL directa — así el resto del sidebar también queda en vista global.
    if (!esModoGlobal()) guardarEmpresaActiva(EMPRESA_GLOBAL);
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const [bandeja, rep] = await Promise.all([
        listarBandejaGlobal({
          nivel: filtroNivel === "todos" ? undefined : filtroNivel,
          estado: filtroEstado === "todos" ? undefined : filtroEstado,
          tenantId: filtroNegocio === "todos" ? undefined : filtroNegocio,
        }),
        obtenerReporteGlobal(),
      ]);
      setLeads(bandeja.leads);
      setNegocios(bandeja.negocios);
      setReporte(rep);
      setEstado("ok");
    } catch (e) {
      void e;
      setEstado("error");
    }
  }, [filtroNivel, filtroEstado, filtroNegocio]);

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
        <p className="eyebrow">Todos tus negocios</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">🌐 Vista global</h1>
        <p className="mt-1 text-[0.9rem] text-frio">
          Tus leads y ventas de captación, todos juntos. Para configurar un negocio,
          elígelo arriba a la derecha.
        </p>
      </header>

      {/* Resumen de plata entre todos los negocios (mismo dato que Reportes) */}
      {reporte && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Ganado</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-ok">{soles(reporte.totalGanada)}</p>
          </div>
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Por cobrar</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-brasa">{soles(reporte.totalPorCobrar)}</p>
          </div>
          <div className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Ventas cerradas</p>
            <p className="mt-1 text-[1.6rem] font-bold leading-none text-tinta">{reporte.totalVentas}</p>
          </div>
        </div>
      )}

      {/* Card destacada: calientes sin atender (entre TODOS los negocios) */}
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
              filtroNegocio === "todos" ? "bg-brasa text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            Todos mis negocios
          </button>
          {negocios.map((n) => (
            <button
              key={n.tenantId}
              onClick={() => setFiltroNegocio(n.tenantId)}
              className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
                filtroNegocio === n.tenantId ? "bg-brasa text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
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
              filtroNivel === f.id ? "bg-tinta text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
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

      {estado === "cargando" && <SkeletonLista filas={6} />}

      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar la vista global. Recargá.</p>
        </div>
      )}

      {estado === "ok" && leads.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Aún no hay leads en tus negocios de captación
          </p>
          <p className="mt-1 text-[0.88rem] text-frio">
            Cuando lleguen mensajes a cualquiera de tus negocios, aparecerán acá.
          </p>
        </div>
      )}

      {estado === "ok" && leads.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {leads.map((l) => (
            // onClickCapture corre antes de la navegación del Link interno de
            // TarjetaLead (/conversacion/[id]): deja como empresa activa la
            // del lead para que la conversación y sus acciones funcionen.
            <div
              key={l.id}
              onClickCapture={() => {
                if (l.tenantId !== leerEmpresaActiva()) guardarEmpresaActiva(l.tenantId);
              }}
            >
              <TarjetaLead lead={aTarjeta(l)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
