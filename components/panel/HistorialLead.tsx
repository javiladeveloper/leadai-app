"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { agregarApunte, claveHistorial, historialLead, type ItemHistorial } from "@/lib/api";
import { guardarCache } from "@/lib/cache-datos";
import { useDatos } from "@/lib/useDatos";
import { guardarEmpresaActiva } from "@/lib/auth";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { describirItem, juntarHistorial } from "@/lib/crm";

const POR_PAGINA = 20;

type Pagina = { items: ItemHistorial[]; hayMas: boolean };

/**
 * EL HISTORIAL DEL LEAD (CRM fase 1, 2026-10-13).
 *
 * Todo lo que pasó con este cliente, en una lista: apuntes, llamadas,
 * cambios de etapa, quién lo tomó, reuniones (con su resultado), campañas que
 * le llegaron, comentarios en las redes, pagos y próximos pasos. Antes esto
 * estaba repartido en la Agenda, Marketing, la nota (que se pisaba) y la
 * memoria de cada vendedora.
 *
 * "AGREGAR APUNTE" ES DISTINTO DE LA NOTA FIJADA: un apunte queda con fecha y
 * autor y nunca pisa a otro ("llamé, dice que decide el lunes"); la nota
 * fijada es lo permanente ("quiere el plan de 3 doctores").
 *
 * UNA llamada por página (`/leads/:id/historial`): el servidor junta las
 * cuatro fuentes en paralelo. "Ver más" pide la siguiente con `antesDe`.
 * Sin la ruta en el backend (404) la sección no se pinta.
 */
export function HistorialLead({
  leadId, tenant, etapas, personas,
}: {
  leadId: string;
  tenant?: string;
  /** Las etapas del negocio, para decir "Pasó a Agendó demo" y no un id. */
  etapas?: { id: string; nombre: string }[];
  /** El equipo, para decir a quién se le asignó. */
  personas?: { usuarioId: string; nombre: string | null; email?: string }[];
}) {
  const clave = claveHistorial(leadId, tenant);
  const { datos, error, cargando, recargar } = useDatos<Pagina | null>(clave, () => historialLead(leadId, { limit: POR_PAGINA }, tenant));
  const [mas, setMas] = useState<Pagina | null>(null);
  const [trayendo, setTrayendo] = useState(false);
  const [errorMas, setErrorMas] = useState(false);
  const [apunte, setApunte] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorApunte, setErrorApunte] = useState<string | null>(null);

  const ctx = useMemo(() => ({
    etapas: new Map((etapas ?? []).map((e) => [e.id, e.nombre])),
    personas: new Map((personas ?? []).map((p) => [p.usuarioId, p.nombre ?? p.email ?? "alguien del equipo"])),
  }), [etapas, personas]);

  if (datos === null) return null;

  const items = datos ? juntarHistorial(datos.items, mas?.items ?? []) : [];
  const hayMas = mas ? mas.hayMas : !!datos?.hayMas;

  async function verMas() {
    const ultimo = items[items.length - 1];
    if (!ultimo || trayendo) return;
    setTrayendo(true);
    setErrorMas(false);
    try {
      const r = await historialLead(leadId, { antesDe: ultimo.fecha, limit: POR_PAGINA }, tenant);
      if (r) setMas((prev) => ({ items: [...(prev?.items ?? []), ...r.items], hayMas: r.hayMas }));
    } catch {
      setErrorMas(true);
    } finally {
      setTrayendo(false);
    }
  }

  async function guardarApunte() {
    const texto = apunte.trim();
    if (!texto || guardando) return;
    setGuardando(true);
    setErrorApunte(null);
    try {
      const item = await agregarApunte(leadId, texto, tenant);
      setApunte("");
      // Arriba de todo, al instante (sin volver a pedir la lista).
      if (datos) guardarCache<Pagina>(clave, { ...datos, items: [item, ...datos.items] });
      else void recargar();
    } catch (e) {
      setErrorApunte(e instanceof Error ? e.message : "No se pudo guardar el apunte.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-frio">Historial</p>

      {/* Agregar apunte */}
      <label className="mb-1 block text-[0.78rem] text-frio" htmlFor={`apunte-${leadId}`}>Agregar apunte</label>
      <textarea
        id={`apunte-${leadId}`}
        value={apunte}
        onChange={(e) => setApunte(e.target.value.slice(0, 2000))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void guardarApunte(); }
        }}
        rows={2}
        placeholder="Ej: lo llamé, decide el lunes con su socia."
        className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
      />
      {apunte.trim() && (
        <button
          type="button"
          onClick={() => void guardarApunte()}
          disabled={guardando}
          className="mt-1.5 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Guardar apunte"}
        </button>
      )}
      {errorApunte && <p role="alert" className="mt-1 text-[0.8rem] font-semibold text-alerta">{errorApunte}</p>}

      {/* La lista */}
      <div className="mt-3">
        {datos === undefined && cargando && <p className="py-2 text-[0.8rem] text-frio" aria-busy="true">Cargando el historial…</p>}
        {datos === undefined && !!error && (
          <ErrorConReintento compacto mensaje="No pudimos cargar el historial." reintentar={() => void recargar()} />
        )}
        {datos && items.length === 0 && (
          <p className="py-1 text-[0.82rem] text-frio">Todavía no hay nada anotado con este cliente.</p>
        )}
        {items.length > 0 && (
          <ol className="relative space-y-3 border-l border-linea pl-4">
            {items.map((it) => <Renglon key={it.id} item={it} ctx={ctx} tenant={tenant} />)}
          </ol>
        )}
        {hayMas && (
          <button
            type="button"
            onClick={() => void verMas()}
            disabled={trayendo}
            className="mt-3 w-full rounded-chip bg-arena py-1.5 text-[0.8rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2 disabled:opacity-60"
          >
            {trayendo ? "Cargando…" : "Ver más"}
          </button>
        )}
        {errorMas && <p role="alert" className="mt-1 text-[0.8rem] font-semibold text-alerta">No pudimos traer más. Intenta de nuevo.</p>}
      </div>
    </div>
  );
}

function Renglon({
  item, ctx, tenant,
}: {
  item: ItemHistorial;
  ctx: { etapas: Map<string, string>; personas: Map<string, string> };
  tenant?: string;
}) {
  const d = describirItem(item, ctx);
  const enlaceClase = "font-bold text-brasa-texto underline-offset-2 hover:underline";
  return (
    <li className="relative">
      <span className="absolute -left-[1.6rem] top-0 grid h-6 w-6 place-items-center rounded-full bg-carta text-[0.8rem] ring-1 ring-linea" aria-hidden>
        {d.icono}
      </span>
      <p className="text-[0.85rem] font-semibold leading-snug text-tinta">{d.titulo}</p>
      {d.detalle && <p className="mt-0.5 line-clamp-6 whitespace-pre-line text-[0.82rem] text-tinta-2">{d.detalle}</p>}
      <p className="mt-0.5 text-[0.72rem] text-frio">
        {[d.autor, d.fecha].filter(Boolean).join(" · ")}
        {d.enlace && (
          <>
            {" · "}
            {d.enlace.externo ? (
              <a href={d.enlace.href} target="_blank" rel="noopener noreferrer" className={enlaceClase}>{d.enlace.texto} ↗</a>
            ) : (
              <Link
                href={d.enlace.href}
                // La campaña es de un negocio: se abre en el del lead.
                onClick={() => { if (tenant) guardarEmpresaActiva(tenant); }}
                className={enlaceClase}
              >
                {d.enlace.texto} ›
              </Link>
            )}
          </>
        )}
      </p>
    </li>
  );
}
