"use client";

import { useState } from "react";
import { marcarVentaLead, quitarVentaLead } from "@/lib/api";
import { solesDeCentavos } from "@/lib/dinero";

/**
 * "PAGÓ" (2026-10-07). Hasta hoy "ganado" se usaba para "agendó la demo", y
 * el reporte de marketing no podía saber quién PAGÓ: el costo por venta era
 * en realidad costo por demo. Esto marca la venta real —cuándo y, si se sabe,
 * cuánto— y de acá salen el costo por cliente y el retorno de la publicidad.
 *
 * El monto es opcional a propósito: a veces se sabe que pagó y no cuánto, y
 * pedirlo obligatorio haría que no se marque nada.
 *
 * EN TODAS LAS FICHAS (2026-10-09): estaba solo en Conversaciones; ahora
 * también en el popup de Seguimiento, que muestra leads de cualquier negocio
 * — por eso viaja `tenant`. Y se llama "Pagó" en todos lados: es el único
 * nombre de la venta real (ver CierreLead para "Ganado").
 */
export function VentaLead({
  leadId,
  ventaEn,
  ventaCentavos,
  tenant,
  compacto = false,
}: {
  leadId: string;
  ventaEn?: string | null;
  ventaCentavos?: number | null;
  tenant?: string;
  /** Sin la línea de ayuda: en el popup el espacio es poco. */
  compacto?: boolean;
}) {
  const [venta, setVenta] = useState<{ en: string; centavos: number | null } | null>(
    ventaEn ? { en: ventaEn, centavos: ventaCentavos ?? null } : null,
  );
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  const [estado, setEstado] = useState<"" | "guardando" | "error">("");

  async function marcar(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(monto.replace(",", "."));
    const centavos = monto.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
    setEstado("guardando");
    try {
      const r = await marcarVentaLead(leadId, centavos, undefined, tenant);
      setVenta({ en: r.ventaEn, centavos: r.ventaCentavos });
      setAbierto(false);
      setEstado("");
    } catch {
      setEstado("error");
    }
  }
  async function quitar() {
    setEstado("guardando");
    try {
      await quitarVentaLead(leadId, tenant);
      setVenta(null);
      setEstado("");
    } catch {
      setEstado("error");
    }
  }

  if (venta) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg bg-ok/10 px-3 py-2 text-[0.82rem]">
        <span className="font-semibold text-ok">
          ✓ Pagó{venta.centavos ? ` ${solesDeCentavos(venta.centavos)}` : ""} · {new Date(venta.en).toLocaleDateString("es-PE", { day: "numeric", month: "short" })}
        </span>
        <button type="button" onClick={quitar} disabled={estado === "guardando"} className="text-[0.74rem] text-frio hover:text-alerta-hondo">
          Quitar
        </button>
      </div>
    );
  }
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="w-full rounded-lg bg-arena/60 px-3 py-2 text-left text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena">
        💰 Pagó
        {!compacto && <span className="block text-[0.72rem] font-normal text-frio">Márcalo cuando entre la plata: así el reporte sabe cuánto costó cada cliente</span>}
      </button>
    );
  }
  return (
    <form onSubmit={marcar} className="space-y-2 rounded-lg bg-arena/60 px-3 py-2 ring-1 ring-linea">
      <label className="flex items-center gap-2 text-[0.82rem] text-tinta-2">
        Monto (opcional) S/
        <input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus aria-label="Monto que pagó, en soles"
          className="w-24 rounded-chip bg-carta px-2 py-1 text-right tabular-nums text-tinta ring-1 ring-linea focus:outline-none focus:ring-brasa" />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={estado === "guardando"} className="rounded-chip bg-ok px-3 py-1.5 text-[0.78rem] font-semibold text-carta disabled:opacity-50">
          {estado === "guardando" ? "Guardando…" : "Confirmar que pagó"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-[0.78rem] text-frio hover:text-tinta">Cancelar</button>
      </div>
      {estado === "error" && <p role="alert" className="text-[0.76rem] text-alerta-hondo">No se pudo guardar. Inténtalo de nuevo.</p>}
    </form>
  );
}
