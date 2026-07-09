"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obtenerUso, type Uso } from "@/lib/api";

// Saldo de "respuestas" (hits) del plan, siempre visible en el sidebar.
// Se carga al montar; el sidebar se re-monta al cambiar de empresa activa
// (HeaderPanel hace window.location.reload()), así que un solo fetch alcanza.
export function ContadorHits() {
  const [uso, setUso] = useState<Uso | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    obtenerUso().then((u) => {
      if (vivo) {
        setUso(u);
        setCargando(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (cargando) {
    return (
      <div className="border-t border-white/10 px-5 py-4">
        <div className="h-2 w-full animate-pulse rounded-full bg-arena/15" />
        <div className="mt-2 h-2 w-24 animate-pulse rounded bg-arena/10" />
      </div>
    );
  }
  if (!uso) return null;

  const { bolsa } = uso;
  const restante = bolsa.totalDisponible;
  const total = bolsa.mensual.total + bolsa.prepago.total;
  const pct = total > 0 ? restante / total : 0;
  const color = pct > 0.4 ? "bg-ok" : pct >= 0.15 ? "bg-tibio" : "bg-brasa";
  const dias = Math.max(
    0,
    Math.ceil((new Date(bolsa.seResetea).getTime() - Date.now()) / 86_400_000),
  );
  const bajo = pct < 0.15;

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-arena/60">
        Respuestas del mes
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-arena/15">
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500`}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[0.9rem] font-semibold text-arena">
        {restante.toLocaleString("es-PE")}{" "}
        <span className="text-arena/50">/ {total.toLocaleString("es-PE")}</span>
      </p>
      <p className="text-[0.72rem] text-arena/50">
        {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
      </p>
      <Link
        href="/configuracion"
        className={`mt-2 inline-block rounded-chip px-3 py-1 text-[0.72rem] font-bold transition ${
          bajo ? "bg-brasa text-carta" : "text-arena/60 underline hover:text-arena"
        }`}
      >
        Comprar más
      </Link>
    </div>
  );
}
