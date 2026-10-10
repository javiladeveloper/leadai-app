"use client";

import { useEffect, useState } from "react";
import { accionLead, calcularComision, type EstadoLead } from "@/lib/api";
import { soles } from "@/lib/dinero";

/**
 * CERRAR UN LEAD: "GANADO" O "DESCARTAR", IGUAL EN TODA LA WEB (2026-10-09).
 *
 * Había tres botones para lo mismo y no hacían lo mismo:
 *  · Seguimiento y su popup: "Gané" → marcaba ganado SIN monto (nunca generaba
 *    comisión, aunque Reportes decía que sí).
 *  · Conversaciones: "Registrar venta" → ganado con monto OBLIGATORIO.
 *  · La ficha: "💰 Marcar que pagó" → la venta real, otra cosa.
 *
 * Quedan DOS conceptos con UN nombre cada uno:
 *  · GANADO: el lead logró lo que se buscaba —agendó, vino a la demo, compró—.
 *    Es el estado `ganado` del motor (el bot lo pone solo cuando el cliente
 *    agenda). El monto es OPCIONAL: si se pone, genera la comisión según la
 *    config del negocio, igual que antes "Registrar venta".
 *  · PAGÓ: entró la plata (components/panel/VentaLead.tsx). Es la venta real y
 *    de ahí salen el costo por cliente y el retorno de la publicidad.
 *
 * Por qué no se fundieron en uno: el backend los guarda en lugares distintos
 * (`estado` y `ventaEn`), el bot marca ganado sin saber si pagó, y en una
 * clínica "ganado" es la cita lograda. Juntarlos borraría una de las dos
 * mediciones. Lo menos destructivo es nombrarlos bien y ponerlos juntos.
 *
 * El mismo flujo en Seguimiento (tarjeta), su popup y la ficha de
 * Conversaciones: tocar "Ganado" abre el monto opcional y se confirma;
 * "Descartar" pide confirmación. Llama al backend acá mismo y avisa con
 * `onCambio` para que la pantalla mueva la tarjeta.
 */
export function CierreLead({
  leadId,
  estado,
  tenant,
  compacto = false,
  onCambio,
}: {
  leadId: string;
  estado: EstadoLead;
  /** El negocio del lead (con varios negocios puede no ser la empresa activa). */
  tenant?: string;
  /** En la tarjeta del tablero: botones chicos y sin el cartel de "ganado". */
  compacto?: boolean;
  onCambio?: (estado: "ganado" | "perdido") => void;
}) {
  const [modo, setModo] = useState<"" | "ganado" | "descartar">("");
  const [monto, setMonto] = useState("");
  const [comision, setComision] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // La comisión que le tocaría, según la config del negocio (debounce corto
  // para no llamar en cada tecla). Solo informativa: la calcula el backend.
  useEffect(() => {
    const n = Number(monto.replace(",", "."));
    if (modo !== "ganado" || !n || n <= 0) { setComision(null); return; }
    const t = setTimeout(() => { calcularComision(n, tenant).then(setComision); }, 350);
    return () => clearTimeout(t);
  }, [monto, modo, tenant]);

  if (estado === "ganado") {
    return compacto ? null : (
      <div className="rounded-tarjeta bg-ok/10 p-3 ring-1 ring-ok/30">
        <p className="text-[0.88rem] font-bold text-ok">✓ Ganado</p>
        <p className="text-[0.78rem] text-tinta-2">Cuando entre la plata, márcalo en «Pagó».</p>
      </div>
    );
  }
  if (estado === "perdido") {
    return compacto ? null : (
      <p className="rounded-tarjeta bg-arena px-3 py-2 text-[0.82rem] font-semibold text-frio">Descartado</p>
    );
  }

  async function confirmar(tipo: "marcar_ganado" | "descartar") {
    if (guardando) return;
    let valor: number | undefined;
    if (tipo === "marcar_ganado" && monto.trim()) {
      const n = Number(monto.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) { setError("El monto no es válido. Déjalo vacío si no lo sabes."); return; }
      valor = n;
    }
    setGuardando(true);
    setError("");
    const r = await accionLead(leadId, { tipo, ...(valor ? { monto: valor } : {}) }, tenant);
    setGuardando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo guardar. Inténtalo de nuevo."); return; }
    setModo("");
    setMonto("");
    onCambio?.(tipo === "marcar_ganado" ? "ganado" : "perdido");
  }

  const chico = compacto ? "px-2.5 py-1.5 text-[0.78rem]" : "px-3.5 py-2 text-[0.85rem]";

  return (
    // Dentro de una tarjeta que se abre con un clic: los toques acá no la abren.
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {modo === "" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setModo("ganado")}
            title="Logró lo que buscabas: agendó, vino o compró"
            className={`flex-1 rounded-chip bg-ok/12 font-bold text-ok transition hover:bg-ok/20 ${chico}`}
          >
            ✓ Ganado
          </button>
          <button
            type="button"
            onClick={() => setModo("descartar")}
            className={`flex-1 rounded-chip bg-arena font-bold text-frio transition hover:bg-linea hover:text-tinta-2 ${chico}`}
          >
            Descartar
          </button>
        </div>
      )}

      {modo === "ganado" && (
        <div className="space-y-2 rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
          <label className="flex flex-wrap items-center gap-2 text-[0.8rem] font-semibold text-tinta-2">
            Monto de la venta (opcional) S/
            <input
              inputMode="decimal"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void confirmar("marcar_ganado"); } }}
              autoFocus
              placeholder="0.00"
              aria-label="Monto de la venta en soles (opcional)"
              className="w-24 rounded-chip bg-arena px-2 py-1 text-right tabular-nums text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
            />
          </label>
          {comision !== null && (
            <p className="text-[0.78rem] text-tinta-2">
              Comisión: <b className="text-ok">{soles(comision)}</b> <span className="text-frio">(según tu config)</span>
            </p>
          )}
          {!compacto && (
            <p className="text-[0.74rem] text-frio">Ganado = logró lo que buscabas. Si además te pagó, márcalo en «Pagó».</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void confirmar("marcar_ganado")}
              disabled={guardando}
              className={`flex-1 rounded-chip bg-ok font-bold text-carta transition disabled:opacity-60 ${chico}`}
            >
              {guardando ? "Guardando…" : "Confirmar ganado"}
            </button>
            <button
              type="button"
              onClick={() => { setModo(""); setMonto(""); setError(""); }}
              className={`rounded-chip bg-arena font-bold text-tinta-2 transition hover:bg-linea ${chico}`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {modo === "descartar" && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void confirmar("descartar")}
            disabled={guardando}
            className={`flex-1 rounded-chip bg-alerta font-bold text-carta transition hover:bg-alerta-hondo disabled:opacity-60 ${chico}`}
          >
            {guardando ? "Guardando…" : "Sí, descartar"}
          </button>
          <button
            type="button"
            onClick={() => { setModo(""); setError(""); }}
            className={`flex-1 rounded-chip bg-arena font-bold text-tinta-2 transition hover:bg-linea ${chico}`}
          >
            No
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-[0.78rem] text-alerta-hondo">{error}</p>}
    </div>
  );
}
