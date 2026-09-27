"use client";

// DETALLE DE CITAS de la Agenda (2026-09-27). Se abre al tocar una cita (o un
// día en Mes): panel lateral en escritorio, hoja desde abajo en el celular.
// `TarjetaCita` es la ficha completa de una reunión; la usa también la vista
// Lista, que es la agenda de antes.

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { CitaAgenda } from "@/lib/api";
import { horaLima, tipoDeCita } from "@/lib/agenda";
import { colorDe } from "./colores";

const chip =
  "inline-flex min-h-9! items-center rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-linea focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa";

export function IconoTipo({ cita }: { cita: CitaAgenda }) {
  const demo = tipoDeCita(cita) === "demo";
  return (
    <span role="img" aria-label={demo ? "Demo" : "Llamada"} title={demo ? "Demo" : "Llamada"}>
      {demo ? "🎥" : "📞"}
    </span>
  );
}

export function TarjetaCita({
  cita: c,
  colores,
  onConversacion,
}: {
  cita: CitaAgenda;
  colores: Map<string, number>;
  onConversacion: (c: CitaAgenda) => void;
}) {
  const cancelada = c.estado === "cancelada";
  const color = colorDe(colores, c.tenantId);
  const telefono = c.telefono?.replace(/\D/g, "") ?? "";
  return (
    <article className={`rounded-tarjeta bg-carta p-4 ring-1 ring-linea ${cancelada ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className={`min-w-0 break-words font-semibold text-tinta ${cancelada ? "line-through" : ""}`}>
          <IconoTipo cita={c} /> {horaLima(c.inicio)}–{horaLima(c.fin)} · {c.cliente || "Cliente"}
        </p>
        <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-frio">
          <span className={`h-2 w-2 shrink-0 rounded-full ${color.punto}`} aria-hidden />
          {c.negocio}
          {c.atiende ? ` · atiende ${c.atiende}` : ""}
          {cancelada && <span className="font-semibold text-alerta"> · cancelada</span>}
        </span>
      </div>
      {c.resumen && <p className="mt-1 break-words text-[0.88rem] text-tinta-2">{c.resumen}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {c.meetLink && !cancelada && (
          <a
            href={c.meetLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-9 items-center rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
          >
            {/meet\.google\.com/.test(c.meetLink) ? "Entrar a Meet" : "Entrar a la videollamada"}
          </a>
        )}
        {telefono && (
          <a href={`https://wa.me/${telefono}`} target="_blank" rel="noreferrer" className={chip} aria-label={`WhatsApp +${telefono}`}>
            WhatsApp +{telefono}
          </a>
        )}
        {c.correo && (
          <a href={`mailto:${c.correo}`} className={`${chip} max-w-full break-all`}>
            {c.correo}
          </a>
        )}
        <button type="button" onClick={() => onConversacion(c)} className={chip}>
          Ver conversación
        </button>
      </div>
    </article>
  );
}

export function DetalleCitas({
  titulo,
  citas,
  colores,
  onCerrar,
  onConversacion,
  accion,
}: {
  titulo: string;
  citas: CitaAgenda[];
  colores: Map<string, number>;
  onCerrar: () => void;
  onConversacion: (c: CitaAgenda) => void;
  /** Un botón extra bajo el título (ej. "Ver el día"). */
  accion?: React.ReactNode;
}) {
  const idTitulo = useId();
  const panel = useRef<HTMLDivElement>(null);
  const cerrar = useRef<HTMLButtonElement>(null);
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  });

  // Foco al abrir, Escape para cerrar, Tab encerrado en el panel y, al
  // cerrar, el foco vuelve a lo que abrió el detalle.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    cerrar.current?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrarRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const focos = panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end bg-tinta/40 sm:items-stretch sm:justify-end" onClick={onCerrar}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onClick={(e) => e.stopPropagation()}
        className="surge flex max-h-[85dvh] w-full flex-col rounded-t-tarjeta bg-arena shadow-xl sm:h-full sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-tarjeta"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-linea bg-carta px-4 py-3 sm:rounded-tl-tarjeta">
          <div className="min-w-0">
            <h2 id={idTitulo} className="text-[1.05rem] font-bold text-tinta first-letter:uppercase">
              {titulo}
            </h2>
            <p className="text-[0.8rem] text-frio">
              {citas.length === 0 ? "Sin reuniones" : citas.length === 1 ? "1 reunión" : `${citas.length} reuniones`}
            </p>
            {accion}
          </div>
          <button
            ref={cerrar}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="grid h-11 min-h-11! w-11 shrink-0 place-items-center rounded-chip text-[1.4rem] leading-none text-tinta-2 hover:bg-arena focus-visible:outline-2 focus-visible:outline-brasa"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pb-8">
          {citas.length === 0 && <p className="text-[0.9rem] text-frio">No hay reuniones este día.</p>}
          {citas.map((c) => (
            <TarjetaCita key={c.id} cita={c} colores={colores} onConversacion={onConversacion} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
