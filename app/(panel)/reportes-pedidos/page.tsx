"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { ReportesRestaurante } from "@/components/panel/ReportesRestaurante";

/**
 * REPORTES DE UN RESTAURANTE (2026-09-01).
 *
 * Ruta aparte de `/reportes`, que es la de captación —leads, embudo de ventas,
 * comisiones— y pide `calificaLeads`. Son dos pantallas distintas con datos
 * distintos: mezclarlas en una con ifs es exactamente lo que las capacidades
 * vinieron a evitar.
 */
export default function ReportesPedidosPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu negocio</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Reportes</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Cuánto vendiste, qué se vende más y dónde se caen los pedidos.
        </p>
      </header>

      <ReportesRestaurante />
    </div>
  );
}
