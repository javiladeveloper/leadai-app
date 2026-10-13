"use client";

import { useId, useState } from "react";
import { ApiError, actualizarLead, etiquetaIA, type EtiquetasDelLead } from "@/lib/api";
import { etiquetasDe } from "@/lib/crm-filtros";
import { useEtiquetasDisponibles } from "@/lib/useFiltrosCrm";
import { ChipEtiqueta } from "@/components/panel/ChipEtiqueta";

/** Las del vendedor: hasta 10, de hasta 20 letras (las mismas reglas del servidor). */
const MAX_ETIQUETAS = 10;
const LARGO_ETIQUETA = 20;

/**
 * LAS ETIQUETAS EN LA FICHA (CRM fases 2 y 3, 2026-10-13).
 *
 *  · Las del vendedor: tocarlas filtra la lista por esa etiqueta; la × la
 *    quita. Al escribir una nueva se ofrecen las que ya se usan (así no nacen
 *    "vip", "VIP " y "Vip" por separado).
 *  · Las de la IA (🤖, más tenues): lo que el cliente contó de sí mismo
 *    ("Odontología", "3 profesionales", "Objeción: precio"). "Fijar" la pasa
 *    a las del vendedor; "Quitar" la descarta y la IA no la vuelve a poner.
 */
export function EtiquetasLead({
  leadId, tenant, etiquetas, etiquetasIA, onCambio, onElegir, activas = [],
}: {
  leadId: string;
  tenant?: string;
  etiquetas: string[];
  etiquetasIA: string[];
  /** Cómo quedaron (para pintarlas al instante y refrescar la lista). */
  onCambio: (c: Partial<EtiquetasDelLead>) => void;
  /** Tocar una etiqueta: filtrar la lista por ella. */
  onElegir?: (nombre: string) => void;
  activas?: string[];
}) {
  const idLista = useId();
  const [nueva, setNueva] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const disponibles = useEtiquetasDisponibles(tenant ?? null);
  const vista = etiquetasDe({ etiquetas, etiquetasIA });
  const deIA = vista.filter((e) => e.ia);
  const activasMin = new Set(activas.map((a) => a.toLowerCase()));

  async function guardar(lista: string[]) {
    setOcupada("manuales");
    setError(null);
    const r = await actualizarLead(leadId, { etiquetas: lista }, tenant);
    setOcupada(null);
    if (r.ok) onCambio({ etiquetas: lista });
    else setError(r.error ?? "No se pudieron guardar las etiquetas.");
  }

  function agregar(texto: string) {
    const e = texto.replace(/\s+/g, " ").trim().slice(0, LARGO_ETIQUETA);
    setNueva("");
    if (!e || etiquetas.some((x) => x.toLowerCase() === e.toLowerCase())) return;
    void guardar([...etiquetas, e]);
  }

  async function deLaIA(nombre: string, accion: "fijar" | "descartar") {
    setOcupada(nombre);
    setError(null);
    try {
      onCambio(await etiquetaIA(leadId, accion, nombre, tenant));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? "Esto todavía no está disponible. Prueba en un rato."
          : e instanceof Error ? e.message : "No se pudo guardar.",
      );
    } finally {
      setOcupada(null);
    }
  }

  const sugeridas = disponibles
    .filter((d) => !etiquetas.some((x) => x.toLowerCase() === d.nombre.toLowerCase()))
    .slice(0, 40);

  return (
    <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-frio">Etiquetas</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {etiquetas.map((et) => (
          <span key={et} className="inline-flex items-center gap-0.5">
            <ChipEtiqueta nombre={et} onElegir={onElegir} activo={activasMin.has(et.toLowerCase())} />
            <button
              type="button"
              onClick={() => void guardar(etiquetas.filter((x) => x !== et))}
              disabled={!!ocupada}
              aria-label={`Quitar ${et}`}
              className="min-h-0 px-0.5 text-[0.85rem] leading-none text-brasa-texto/60 hover:text-brasa-texto disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
        {etiquetas.length < MAX_ETIQUETAS && (
          <>
            <input
              value={nueva}
              list={idLista}
              disabled={ocupada === "manuales"}
              onChange={(e) => {
                const v = e.target.value;
                if (sugeridas.some((s) => s.nombre === v)) agregar(v);
                else setNueva(v.slice(0, LARGO_ETIQUETA));
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(nueva); } }}
              placeholder="＋ agregar y Enter"
              aria-label="Agregar una etiqueta"
              className="w-32 rounded-chip bg-arena px-2 py-0.5 text-[0.75rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
            />
            <datalist id={idLista}>
              {sugeridas.map((s) => <option key={s.nombre} value={s.nombre.slice(0, LARGO_ETIQUETA)} />)}
            </datalist>
          </>
        )}
      </div>

      {/* LAS DE LA IA (fase 3): lo que el cliente contó, para confirmar o descartar. */}
      {deIA.length > 0 && (
        <div className="mt-3 border-t border-linea pt-2.5">
          <p className="mb-1.5 text-[0.72rem] text-frio">La IA las sacó de lo que contó el cliente:</p>
          <ul className="flex flex-col gap-1.5">
            {deIA.map((e) => (
              <li key={e.nombre} className="flex flex-wrap items-center gap-1.5">
                <ChipEtiqueta nombre={e.nombre} ia onElegir={onElegir} activo={activasMin.has(e.nombre.toLowerCase())} />
                <span className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => void deLaIA(e.nombre, "fijar")}
                    disabled={!!ocupada || etiquetas.length >= MAX_ETIQUETAS}
                    title={etiquetas.length >= MAX_ETIQUETAS ? "Ya tiene 10 etiquetas: quita una para fijar esta" : "Pasarla a tus etiquetas"}
                    className="min-h-0 rounded-chip px-2 py-0.5 text-[0.72rem] font-bold text-brasa-texto ring-1 ring-brasa/30 transition hover:bg-brasa/10 disabled:opacity-50"
                  >
                    {ocupada === e.nombre ? "…" : "Fijar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deLaIA(e.nombre, "descartar")}
                    disabled={!!ocupada}
                    title="No es así: quitarla (la IA no la vuelve a poner)"
                    className="min-h-0 rounded-chip px-2 py-0.5 text-[0.72rem] font-semibold text-frio ring-1 ring-linea transition hover:text-alerta disabled:opacity-50"
                  >
                    Quitar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[0.78rem] font-semibold text-alerta">{error}</p>}
    </div>
  );
}
