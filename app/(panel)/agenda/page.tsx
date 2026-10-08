"use client";

// AGENDA (2026-09-26): las reuniones que el bot agendó para ESTA persona en
// todos sus negocios. Es de la persona, no de un negocio: sin chips de negocio
// arriba; si tiene varios, un filtro local.
//
// CALENDARIO NAVEGABLE (2026-09-27, pedido de Jonathan): vistas Día · Semana
// · Mes · Lista, con flechas y "Hoy". Todo en hora de Lima (UTC-5 fija), sea
// cual sea el huso del navegador; la semana empieza el lunes. Cada periodo le
// pide a `listarAgenda` SOLO su rango (Mes = 42 días; el backend corta en 92).
//
// AGENDAR DESDE LA AGENDA (2026-10-08, Jonathan: "si selecciono un espacio de
// tiempo... anexar un lead y listo"): tocar un espacio libre en Semana/Día, el
// botón "Agendar reunión" o "Agendar en este día" (detalle del día en Mes)
// abre `AgendarReunion`. La cita nueva entra a la lista sin volver a pedirla.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listarAgenda, type CitaAgenda } from "@/lib/api";
import {
  agruparPorDia, coloresDeNegocios, diaLima, esVista, horaLima, hoyLima, moverPeriodo, nombreDelDia, rangoDeVista,
  tituloDePeriodo, type VistaAgenda,
} from "@/lib/agenda";
import { empresasVisibles, guardarEmpresaActiva } from "@/lib/auth";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraAgenda } from "@/components/agenda/BarraAgenda";
import { VistaMes } from "@/components/agenda/VistaMes";
import { VistaSemana } from "@/components/agenda/VistaSemana";
import { VistaLista } from "@/components/agenda/VistaLista";
import { DetalleCitas } from "@/components/agenda/DetalleCitas";
import { AgendarReunion } from "@/components/agenda/AgendarReunion";
import { colorDe } from "@/components/agenda/colores";

const CLAVE_VISTA = "agenda.vista";

function vistaGuardada(): VistaAgenda {
  try {
    const v = typeof window !== "undefined" ? window.localStorage.getItem(CLAVE_VISTA) : null;
    return esVista(v) ? v : "mes";
  } catch {
    return "mes";
  }
}

const VACIO: Record<VistaAgenda, string> = {
  mes: "No hay reuniones este mes.",
  semana: "No hay reuniones esta semana.",
  dia: "No hay reuniones este día.",
  lista: "No hay reuniones en estos 30 días.",
};

type Detalle = { tipo: "dia"; dia: string } | { tipo: "cita"; id: string } | null;

export default function AgendaPanel() {
  const router = useRouter();
  const [vista, setVista] = useState<VistaAgenda>(vistaGuardada);
  const [ahora, setAhora] = useState(() => new Date());
  const [fecha, setFecha] = useState(() => hoyLima());
  const [negocio, setNegocio] = useState("todos");
  const [detalle, setDetalle] = useState<Detalle>(null);
  // Los datos llevan la clave del rango que pidieron: si llega tarde la
  // respuesta de un periodo que ya no se mira, no se pinta.
  const [datos, setDatos] = useState<{ clave: string; citas: CitaAgenda[] } | null>(null);
  const [intento, setIntento] = useState(0);
  const [fallo, setFallo] = useState<string | null>(null);
  /** El espacio elegido para una reunión nueva (hora "" = sin elegir). */
  const [nueva, setNueva] = useState<{ dia: string; hora: string } | null>(null);
  const [agendada, setAgendada] = useState<CitaAgenda | null>(null);

  const hoy = hoyLima(ahora);
  const rango = useMemo(() => rangoDeVista(vista, fecha), [vista, fecha]);
  const clave = `${rango.desde.toISOString()}|${rango.hasta.toISOString()}`;
  const claveCarga = `${clave}#${intento}`;

  useEffect(() => {
    let vivo = true;
    listarAgenda(rango.desde, rango.hasta).then(
      (citas) => {
        if (vivo) setDatos({ clave, citas });
      },
      () => {
        if (vivo) setFallo(claveCarga);
      },
    );
    return () => {
      vivo = false;
    };
    // `claveCarga` resume el rango y los reintentos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveCarga]);

  // La línea de "ahora" y el "hoy" se mueven solos.
  useEffect(() => {
    const t = window.setInterval(() => setAhora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  function elegirVista(v: VistaAgenda) {
    setVista(v);
    try {
      window.localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      /* sin storage: la vista vale solo por esta visita */
    }
  }

  const citas = datos?.clave === clave ? datos.citas : null;
  const error = fallo === claveCarga;
  const cargando = !citas && !error;

  // Los negocios de la persona (de la sesión) + los que traigan las citas:
  // el color se calcula sobre TODOS, así no cambia al navegar ni al filtrar.
  const [empresas] = useState(() => empresasVisibles());
  const negocios = useMemo(() => {
    const m = new Map<string, string>(empresas.map((e) => [e.tenantId, e.nombre]));
    for (const c of datos?.citas ?? []) if (!m.has(c.tenantId)) m.set(c.tenantId, c.negocio);
    return m;
  }, [empresas, datos]);
  const colores = useMemo(() => coloresDeNegocios([...negocios.keys()]), [negocios]);

  const visibles = (citas ?? []).filter((c) => negocio === "todos" || c.tenantId === negocio);
  const citasPorDia = new Map(agruparPorDia(visibles).map((d) => [d.dia, d.citas]));
  const enLeyenda = Array.from(new Map(visibles.map((c) => [c.tenantId, c.negocio])).entries());

  function abrirConversacion(c: CitaAgenda) {
    guardarEmpresaActiva(c.tenantId);
    router.push(`/conversacion/${c.leadId}`);
  }

  /** Otra llamada recién agendada: se vuelve a pedir el periodo (lo que se ve se queda). */
  function recargar() {
    setIntento((n) => n + 1);
  }

  /** La cita con su resultado recién anotado reemplaza a la de la lista. */
  function actualizarCita(c: CitaAgenda) {
    setDatos((d) => (d ? { ...d, citas: d.citas.map((x) => (x.id === c.id ? c : x)) } : d));
  }

  function verDia(dia: string) {
    setFecha(dia);
    elegirVista("dia");
    setDetalle(null);
  }

  function abrirNueva(dia: string, hora = "") {
    setDetalle(null);
    setNueva({ dia: dia < hoy ? hoy : dia, hora });
  }

  /** La reunión recién agendada entra a lo que se ve, sin volver a pedir el periodo. */
  function alAgendar(c: CitaAgenda) {
    setNueva(null);
    setAgendada(c);
    setDatos((d) => (d && !d.citas.some((x) => x.id === c.id) ? { ...d, citas: [...d.citas, c] } : d));
    // Si se agendó en otro periodo, se va a verla (ese periodo se pide entero).
    if (!rango.dias.includes(diaLima(c.inicio))) setFecha(diaLima(c.inicio));
  }

  const citaAbierta = detalle?.tipo === "cita" ? visibles.find((c) => c.id === detalle.id) : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-5 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ventas</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Agenda</h1>
          <p className="mt-1 text-[0.92rem] text-frio">
            Las reuniones que el bot agendó para ti. Para agendar una, toca un espacio libre.
          </p>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          {negocios.size > 1 && (
            <select
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
              aria-label="Filtrar por negocio"
              className="max-w-full rounded-tarjeta border border-linea bg-carta px-3 py-2.5 text-[0.9rem] text-tinta outline-none focus:border-brasa"
            >
              <option value="todos">Todos los negocios</option>
              {[...negocios.entries()].map(([id, n]) => (
                <option key={id} value={id}>{n}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => abrirNueva(vista === "dia" ? fecha : hoy)}
            className="inline-flex min-h-11! items-center rounded-tarjeta bg-brasa px-4 text-[0.9rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
          >
            + Agendar reunión
          </button>
        </div>
      </header>

      <BarraAgenda
        vista={vista}
        titulo={tituloDePeriodo(vista, fecha)}
        cargando={cargando}
        onVista={elegirVista}
        onMover={(d) => setFecha((f) => moverPeriodo(vista, f, d))}
        onHoy={() => setFecha(hoy)}
      />

      {agendada && (
        <div
          className="flex items-start justify-between gap-3 rounded-tarjeta bg-brasa-suave p-3 ring-1 ring-brasa/30"
          role="status"
        >
          <div className="min-w-0 text-[0.9rem] text-tinta">
            <p className="font-semibold">
              Listo: reunión con {agendada.cliente || "el cliente"} el {nombreDelDia(diaLima(agendada.inicio))} a las{" "}
              {horaLima(agendada.inicio)}. Ya está en tu Google Calendar.
            </p>
            {agendada.meetLink && (
              <a
                href={agendada.meetLink}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-block max-w-full break-all font-semibold text-brasa-texto underline"
              >
                {agendada.meetLink}
              </a>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAgendada(null)}
            aria-label="Cerrar aviso"
            className="grid h-10 min-h-10! w-10 shrink-0 place-items-center rounded-chip text-[1.3rem] leading-none text-tinta-2 hover:bg-carta/60 focus-visible:outline-2 focus-visible:outline-brasa"
          >
            ×
          </button>
        </div>
      )}

      {enLeyenda.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Colores por negocio">
          {enLeyenda.map(([id, n]) => (
            <li key={id} className="inline-flex items-center gap-1.5 text-[0.78rem] text-tinta-2">
              <span className={`h-2.5 w-2.5 rounded-full ${colorDe(colores, id).punto}`} aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea" role="alert">
          <p className="font-semibold text-tinta">No pudimos cargar tu agenda.</p>
          <button
            type="button"
            onClick={() => setIntento((n) => n + 1)}
            className="mt-3 rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.9rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
          >
            Reintentar
          </button>
        </div>
      )}

      {cargando && <SkeletonAgenda vista={vista} />}

      {citas && visibles.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <p className="font-semibold text-tinta">{VACIO[vista]}</p>
          <p className="mt-1 text-[0.86rem] text-frio">
            Cuando el bot agende una, aparece aquí. Para que agende en tu Google Calendar, conéctalo en{" "}
            <Link href="/configuracion?tab=calendario" className="font-semibold text-brasa-hondo underline">
              Configuración → Mi calendario
            </Link>
            .
          </p>
        </div>
      )}

      {citas && vista === "mes" && (
        <VistaMes
          dias={rango.dias}
          mes={fecha.slice(0, 7)}
          hoy={hoy}
          citasPorDia={citasPorDia}
          colores={colores}
          onDia={(dia) => setDetalle({ tipo: "dia", dia })}
          onCita={(c) => setDetalle({ tipo: "cita", id: c.id })}
        />
      )}
      {citas && (vista === "semana" || vista === "dia") && (
        <VistaSemana
          dias={rango.dias}
          hoy={hoy}
          ahora={ahora}
          citasPorDia={citasPorDia}
          colores={colores}
          onCita={(c) => setDetalle({ tipo: "cita", id: c.id })}
          onDia={verDia}
          onEspacio={abrirNueva}
        />
      )}
      {citas && vista === "lista" && (
        <VistaLista
          citas={visibles}
          hoy={hoy}
          colores={colores}
          onConversacion={abrirConversacion}
          onActualizada={actualizarCita}
          onAgendada={recargar}
        />
      )}

      {detalle?.tipo === "dia" && (
        <DetalleCitas
          titulo={nombreDelDia(detalle.dia)}
          citas={citasPorDia.get(detalle.dia) ?? []}
          colores={colores}
          onCerrar={() => setDetalle(null)}
          onConversacion={abrirConversacion}
          onActualizada={actualizarCita}
          onAgendada={recargar}
          accion={
            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => verDia(detalle.dia)}
                className="min-h-0! text-[0.8rem] font-semibold text-brasa-texto underline focus-visible:outline-2 focus-visible:outline-brasa"
              >
                Ver el día por horas
              </button>
              {detalle.dia >= hoy && (
                <button
                  type="button"
                  onClick={() => abrirNueva(detalle.dia)}
                  className="min-h-0! text-[0.8rem] font-semibold text-brasa-texto underline focus-visible:outline-2 focus-visible:outline-brasa"
                >
                  Agendar en este día
                </button>
              )}
            </span>
          }
        />
      )}
      {citaAbierta && (
        <DetalleCitas
          titulo={nombreDelDia(diaLima(citaAbierta.inicio))}
          citas={[citaAbierta]}
          colores={colores}
          onCerrar={() => setDetalle(null)}
          onConversacion={abrirConversacion}
          onActualizada={actualizarCita}
          onAgendada={recargar}
        />
      )}
      {nueva && (
        <AgendarReunion
          dia={nueva.dia}
          hora={nueva.hora}
          tenantId={negocio === "todos" ? undefined : negocio}
          variosNegocios={negocios.size > 1}
          colores={colores}
          onCerrar={() => setNueva(null)}
          onAgendada={alAgendar}
        />
      )}
    </div>
  );
}

function SkeletonAgenda({ vista }: { vista: VistaAgenda }) {
  if (vista === "lista") return <SkeletonLista filas={3} />;
  if (vista === "mes") {
    return (
      <div className="grid grid-cols-7 gap-1" aria-busy="true" aria-label="Cargando agenda">
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-arena-2/70 sm:h-28" />
        ))}
      </div>
    );
  }
  return <div className="h-[28rem] animate-pulse rounded-tarjeta bg-arena-2/70" aria-busy="true" aria-label="Cargando agenda" />;
}
