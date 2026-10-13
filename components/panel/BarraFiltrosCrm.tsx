"use client";

import { useId, useState } from "react";
import type { EtiquetaUso, MiembroEquipo } from "@/lib/api";
import { OPCIONES_FECHA, OPCIONES_ORDEN, alternarEtiqueta, type FiltrosCrm } from "@/lib/crm-filtros";

/**
 * LOS FILTROS DEL CRM, EN UN SOLO LUGAR (fase 2, 2026-10-13): etiqueta (con
 * autocompletar, también las de la IA), a quién está asignado, "sin
 * respuesta", de dónde vino, cuándo escribió y el orden. Los usan Leads, la
 * vista de todos los negocios y Conversaciones; todo queda en la URL
 * (`useFiltrosCrm`).
 *
 * `variante="fila"`: renglones con su rótulo (Leads). `"columna"`: apilado y
 * compacto (la columna del buzón de Conversaciones).
 */
export function BarraFiltrosCrm({
  filtros, cambiar, etiquetas, miembros, miUsuarioId, origenes = [], conAsignado = true,
  conEsperando = true, variante = "fila",
}: {
  filtros: FiltrosCrm;
  cambiar: (c: Partial<FiltrosCrm>) => void;
  /** Para autocompletar (las más usadas primero). */
  etiquetas: EtiquetaUso[];
  /** El equipo, para "Asignado a…". Sin él solo se ofrecen Míos / Sin asignar. */
  miembros?: MiembroEquipo[];
  miUsuarioId?: string | null;
  /** Los orígenes que tiene la lista ("Mensaje directo", el nombre de cada anuncio…). */
  origenes?: { id: string; etiqueta: string }[];
  /** Conversaciones lo maneja con su buzón (Todos / Míos / Sin asignar). */
  conAsignado?: boolean;
  /** ¿La lista trae quién escribió último? (un backend anterior no lo manda). */
  conEsperando?: boolean;
  variante?: "fila" | "columna";
}) {
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const columna = variante === "columna";

  function agregar(nombre: string) {
    const e = nombre.trim();
    if (!e) return;
    if (!filtros.etiquetas.some((x) => x.toLowerCase() === e.toLowerCase())) cambiar({ etiquetas: alternarEtiqueta(filtros, e).etiquetas });
    setTexto("");
  }

  const control = `rounded-chip bg-carta text-tinta-2 outline-none ring-1 ring-linea focus:ring-brasa/40 ${columna ? "w-full px-2.5 py-1.5 text-[0.78rem]" : "px-3 py-1.5 text-[0.82rem]"}`;
  const ofrecidas = etiquetas.filter((e) => !filtros.etiquetas.some((x) => x.toLowerCase() === e.nombre.toLowerCase())).slice(0, 60);

  const etiquetaCampo = (
    <span className={`flex flex-wrap items-center gap-1.5 ${columna ? "" : "min-w-0"}`}>
      {filtros.etiquetas.map((e) => (
        <span key={e} className="inline-flex items-center gap-1 rounded-chip bg-brasa px-2.5 py-1 text-[0.76rem] font-bold text-sobre-brasa">
          {e}
          <button
            type="button"
            onClick={() => cambiar({ etiquetas: filtros.etiquetas.filter((x) => x !== e) })}
            aria-label={`Quitar el filtro de la etiqueta ${e}`}
            className="min-h-0 text-[0.95rem] leading-none text-sobre-brasa/80 hover:text-sobre-brasa"
          >
            ×
          </button>
        </span>
      ))}
      {filtros.etiquetas.length < 10 && (
        <>
          <input
            value={texto}
            list={idLista}
            onChange={(e) => {
              const v = e.target.value;
              // Elegida de la lista: se aplica sin esperar el Enter.
              if (etiquetas.some((x) => x.nombre === v)) agregar(v);
              else setTexto(v.slice(0, 40));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); agregar(texto); }
            }}
            placeholder={filtros.etiquetas.length ? "＋ otra etiqueta" : "Filtrar por etiqueta…"}
            aria-label="Filtrar por etiqueta"
            className={`${control} ${columna ? "" : "w-44"}`}
          />
          <datalist id={idLista}>
            {ofrecidas.map((e) => (
              <option key={e.nombre} value={e.nombre}>{`${e.cuenta} ${e.cuenta === 1 ? "lead" : "leads"}`}</option>
            ))}
          </datalist>
        </>
      )}
    </span>
  );

  const sinRespuesta = (conEsperando || filtros.sinRespuesta) && (
    <button
      type="button"
      onClick={() => cambiar({ sinRespuesta: !filtros.sinRespuesta })}
      aria-pressed={filtros.sinRespuesta}
      title="Los que te escribieron último y siguen esperando que les respondan"
      className={`shrink-0 rounded-chip font-bold transition ${columna ? "w-full px-2.5 py-1.5 text-left text-[0.78rem]" : "px-3.5 py-1.5 text-[0.82rem]"} ${
        filtros.sinRespuesta ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea hover:ring-brasa/40"
      }`}
    >
      ⏳ Sin respuesta
    </button>
  );

  const asignado = conAsignado && (
    <select
      value={filtros.asignado}
      onChange={(e) => cambiar({ asignado: e.target.value })}
      aria-label="A quién está asignado"
      className={control}
    >
      <option value="">Todo el equipo</option>
      <option value="yo">Míos</option>
      <option value="sin">Sin asignar</option>
      {(miembros ?? []).filter((m) => m.usuarioId !== miUsuarioId).map((m) => (
        <option key={m.usuarioId} value={m.usuarioId}>{m.nombre ?? m.email}</option>
      ))}
      {filtros.asignado && !["yo", "sin"].includes(filtros.asignado) && !(miembros ?? []).some((m) => m.usuarioId === filtros.asignado) && (
        <option value={filtros.asignado}>Otra persona del equipo</option>
      )}
    </select>
  );

  const fecha = (
    <select value={filtros.fecha} onChange={(e) => cambiar({ fecha: e.target.value as FiltrosCrm["fecha"] })} aria-label="Cuándo escribió" className={control}>
      {OPCIONES_FECHA.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
    </select>
  );

  const ordenes = OPCIONES_ORDEN.filter((o) => o.id !== "esperando" || conEsperando || filtros.orden === "esperando");
  const orden = (
    <select value={filtros.orden} onChange={(e) => cambiar({ orden: e.target.value as FiltrosCrm["orden"] })} aria-label="Orden de la lista" className={control}>
      {ordenes.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
    </select>
  );

  const conOrigen = origenes.length > 0 || !!filtros.origen;
  const origen = conOrigen && (
    <select value={filtros.origen} onChange={(e) => cambiar({ origen: e.target.value })} aria-label="De dónde vino" className={control}>
      <option value="">Cualquier origen</option>
      {origenes.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
      {filtros.origen && !origenes.some((o) => o.id === filtros.origen) && <option value={filtros.origen}>El origen elegido</option>}
    </select>
  );

  if (columna) {
    return (
      <div className="flex flex-col gap-1.5">
        {sinRespuesta}
        {etiquetaCampo}
        {fecha}
        {origen}
        {orden}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <Fila rotulo="Etiqueta">{etiquetaCampo}</Fila>
      <Fila rotulo="Mostrar">
        {sinRespuesta}
        {asignado}
        {fecha}
        {origen}
      </Fila>
      <Fila rotulo="Orden">{orden}</Fila>
    </div>
  );
}

function Fila({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-[0.72rem] font-semibold uppercase tracking-wide text-frio">{rotulo}</span>
      {children}
    </div>
  );
}
