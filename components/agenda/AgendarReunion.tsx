"use client";

// AGENDAR UNA REUNIÓN NUEVA DESDE LA AGENDA (2026-10-08, Jonathan: "desde la
// Agenda de LeadAI debe permitirme agendar si selecciono un espacio de
// tiempo... anexar un lead y listo"). Se abre al tocar un espacio libre de la
// grilla (con ese día y hora puestos) o con "Agendar reunión". Se elige al
// cliente entre los leads de los negocios donde la persona atiende; la cita
// queda en el negocio de ESE lead.
//
// Mismo backend que "Agendar otra llamada" (AgendarOtra.tsx): crea el evento
// con Meet en el Google Calendar de quien agenda y NO le escribe al cliente.
// Hoja desde abajo en el celular, ventana centrada en escritorio.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { agendarCita, buscarLeadsParaAgendar, type CitaAgenda, type LeadParaAgendar } from "@/lib/api";
import { HORAS_AGENDAR, hoyLima, inicioEnLima, nombreDelDia } from "@/lib/agenda";
import { colorDe } from "./colores";

const campo =
  "mt-1 w-full rounded-tarjeta border border-linea bg-carta px-3 py-2 text-[1rem] text-tinta outline-none focus:border-brasa sm:text-[0.9rem]";

export function AgendarReunion({
  dia: diaInicial,
  hora: horaInicial,
  tenantId,
  variosNegocios,
  colores,
  onCerrar,
  onAgendada,
  lead,
}: {
  dia: string;
  /** "HH:MM" o "" si se abrió sin espacio elegido. */
  hora: string;
  /** Con el filtro de negocio puesto, se busca solo en ese. */
  tenantId?: string;
  /** Con más de un negocio, cada lead dice de cuál es. */
  variosNegocios: boolean;
  colores: Map<string, number>;
  onCerrar: () => void;
  onAgendada: (cita: CitaAgenda) => void;
  /**
   * EL CLIENTE YA ELEGIDO (2026-10-09): desde la ficha del lead se agenda con
   * ESA persona; buscarla otra vez en la lista sería pedir lo que ya se sabe.
   * Se puede cambiar igual con "Cambiar".
   */
  lead?: LeadParaAgendar;
}) {
  const [dia, setDia] = useState(diaInicial);
  const [hora, setHora] = useState(horaInicial);
  const [texto, setTexto] = useState("");
  const [leads, setLeads] = useState<LeadParaAgendar[] | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [elegido, setElegido] = useState<LeadParaAgendar | null>(lead ?? null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idTitulo = useId();
  const idDia = useId();
  const idHora = useId();
  const idBuscar = useId();
  const panel = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  });

  // La hora tocada puede caer fuera de la lista (la grilla se estira si hay
  // citas de madrugada): se agrega para no perderla.
  const horas = hora && !HORAS_AGENDAR.includes(hora) ? [...HORAS_AGENDAR, hora].sort() : HORAS_AGENDAR;

  // Buscar con una pausa corta tras teclear; solo vale la última respuesta.
  useEffect(() => {
    if (elegido) return;
    let vivo = true;
    const t = window.setTimeout(() => {
      buscarLeadsParaAgendar(texto, tenantId).then(
        (r) => {
          if (!vivo) return;
          setLeads(r);
          setErrorBusqueda(null);
        },
        (e: unknown) => {
          if (!vivo) return;
          setLeads(null);
          setErrorBusqueda(e instanceof Error && e.message ? e.message : "No pudimos buscar. Intenta de nuevo.");
        },
      );
    }, texto ? 250 : 0);
    return () => {
      vivo = false;
      window.clearTimeout(t);
    };
  }, [texto, tenantId, elegido]);

  // Foco en el buscador al abrir, Escape para cerrar, Tab encerrado en la
  // ventana y, al cerrar, el foco vuelve a lo que la abrió.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    buscador.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focos = panel.current.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])",
      );
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      previo?.focus?.();
    };
  }, []);

  async function agendar() {
    if (!dia || !hora || !elegido) return;
    setGuardando(true);
    setError(null);
    try {
      const cita = await agendarCita({
        tenantId: elegido.tenantId,
        leadId: elegido.id,
        // Perú es UTC-5 todo el año: la hora elegida es hora de Lima.
        inicio: inicioEnLima(dia, hora),
        // No se sabe su correo desde acá: no se manda invitación de Google.
        invitarCliente: false,
      });
      onAgendada(cita);
    } catch (e) {
      // Los errores del backend ya vienen en español ("Esa hora ya pasó"…).
      setError(e instanceof Error && e.message ? e.message : "No se pudo agendar. Intenta de nuevo.");
      setGuardando(false);
    }
  }

  function cambiarLead() {
    setElegido(null);
    setError(null);
    window.setTimeout(() => buscador.current?.focus(), 0);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-tinta/40 sm:items-center sm:justify-center sm:p-4" onClick={onCerrar}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(e) => e.stopPropagation()}
        className="surge flex max-h-[90dvh] w-full flex-col rounded-t-tarjeta bg-arena shadow-xl sm:max-h-[85dvh] sm:max-w-md sm:rounded-tarjeta"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-linea bg-carta px-4 py-3 sm:rounded-t-tarjeta">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-[1.05rem] font-bold text-tinta">Agendar reunión</h2>
            <p className="text-[0.8rem] text-frio first-letter:uppercase">
              {dia ? `${nombreDelDia(dia)}${hora ? ` · ${hora}` : ""}` : "Elige el día y la hora"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-11 min-h-11! w-11 shrink-0 place-items-center rounded-chip text-[1.4rem] leading-none text-tinta-2 hover:bg-arena focus-visible:outline-2 focus-visible:outline-brasa"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <label htmlFor={idDia} className="text-[0.8rem] font-semibold text-tinta-2">
              Día
              <input id={idDia} type="date" min={hoyLima()} value={dia} onChange={(e) => setDia(e.target.value)} className={campo} />
            </label>
            <label htmlFor={idHora} className="text-[0.8rem] font-semibold text-tinta-2">
              Hora
              <select id={idHora} value={hora} onChange={(e) => setHora(e.target.value)} className={campo}>
                <option value="">Elige</option>
                {horas.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
          </div>

          <div>
            <p className="text-[0.8rem] font-semibold text-tinta-2">Cliente</p>
            {elegido ? (
              <div className="mt-1 flex items-center justify-between gap-3 rounded-tarjeta bg-carta p-3 ring-1 ring-brasa">
                <FichaLead lead={elegido} variosNegocios={variosNegocios} colores={colores} />
                <button
                  type="button"
                  onClick={cambiarLead}
                  className="inline-flex min-h-10! shrink-0 items-center rounded-chip px-2 text-[0.85rem] font-semibold text-brasa-texto underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brasa"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <label htmlFor={idBuscar} className="sr-only">Buscar cliente por nombre o teléfono</label>
                <input
                  ref={buscador}
                  id={idBuscar}
                  type="search"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Busca por nombre o teléfono"
                  autoComplete="off"
                  maxLength={80}
                  className={campo}
                />
                <ResultadosBusqueda
                  leads={leads}
                  error={errorBusqueda}
                  texto={texto.trim()}
                  variosNegocios={variosNegocios}
                  colores={colores}
                  onElegir={(l) => {
                    setElegido(l);
                    setError(null);
                  }}
                />
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-linea bg-carta px-4 py-3 sm:rounded-b-tarjeta">
          {error && <p className="mb-2 text-[0.85rem] font-semibold text-alerta" role="alert">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="inline-flex min-h-10! items-center rounded-chip px-3 text-[0.85rem] font-semibold text-tinta-2 hover:bg-linea focus-visible:outline-2 focus-visible:outline-brasa"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={agendar}
              disabled={!dia || !hora || !elegido || guardando}
              className="inline-flex min-h-10! items-center rounded-chip bg-brasa px-4 text-[0.85rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
            >
              {guardando ? "Agendando…" : "Agendar"}
            </button>
          </div>
          <p className="mt-1 text-[0.75rem] text-frio">
            Se crea en tu Google Calendar con su videollamada (30 min). No se le escribe al cliente.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FichaLead({
  lead: l,
  variosNegocios,
  colores,
}: {
  lead: LeadParaAgendar;
  variosNegocios: boolean;
  colores: Map<string, number>;
}) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-semibold text-tinta">{l.nombre || "Sin nombre"}</span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 text-[0.78rem] text-frio">
        {l.telefono ? <span>+{l.telefono}</span> : <span className="capitalize">{l.canal}</span>}
        {variosNegocios && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <span className={`h-2 w-2 shrink-0 rounded-full ${colorDe(colores, l.tenantId).punto}`} aria-hidden />
            <span className="truncate">{l.negocio}</span>
          </span>
        )}
      </span>
    </span>
  );
}

function ResultadosBusqueda({
  leads,
  error,
  texto,
  variosNegocios,
  colores,
  onElegir,
}: {
  leads: LeadParaAgendar[] | null;
  error: string | null;
  texto: string;
  variosNegocios: boolean;
  colores: Map<string, number>;
  onElegir: (l: LeadParaAgendar) => void;
}) {
  if (error) return <p className="mt-2 text-[0.85rem] font-semibold text-alerta" role="alert">{error}</p>;
  if (!leads) return <p className="mt-2 text-[0.85rem] text-frio" aria-busy="true">Buscando…</p>;
  if (leads.length === 0) {
    return (
      <p className="mt-2 text-[0.85rem] text-frio" role="status">
        {texto ? `No encontramos a nadie con «${texto}».` : "Todavía no tienes clientes en tus negocios."}
      </p>
    );
  }
  return (
    <>
      {!texto && <p className="mt-2 text-[0.75rem] font-semibold uppercase tracking-wide text-frio">Recientes</p>}
      <ul className="mt-1 divide-y divide-linea overflow-hidden rounded-tarjeta bg-carta ring-1 ring-linea" aria-label="Clientes encontrados">
        {leads.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              onClick={() => onElegir(l)}
              className="block min-h-12! w-full px-3 py-2 text-left hover:bg-arena focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brasa"
            >
              <FichaLead lead={l} variosNegocios={variosNegocios} colores={colores} />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
