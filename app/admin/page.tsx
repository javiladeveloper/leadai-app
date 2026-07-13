"use client";

import { useEffect, useState } from "react";
import { obtenerMetricasPlataforma, type MetricasPlataforma } from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

const NIVEL_LABEL: Record<string, string> = { caliente: "🔥 Calientes", tibio: "🌤 Tibios", frio: "❄️ Fríos" };
const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevos", nutriendo: "Nutriendo", escalado: "Escalados", ganado: "Ganados", perdido: "Perdidos",
};

function Tarjeta({ valor, label }: { valor: number | string; label: string }) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-3xl font-bold text-tinta">{typeof valor === "number" ? valor.toLocaleString("es-PE") : valor}</p>
      <p className="mt-1 text-[0.85rem] text-frio">{label}</p>
    </div>
  );
}

function Desglose({ titulo, datos, labels }: { titulo: string; datos: Record<string, number>; labels: Record<string, string> }) {
  const entradas = Object.entries(datos).sort((a, b) => b[1] - a[1]);
  if (entradas.length === 0) return null;
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="mb-3 text-[0.85rem] font-bold uppercase tracking-wide text-frio">{titulo}</p>
      <div className="space-y-2">
        {entradas.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-[0.92rem]">
            <span className="text-tinta-2">{labels[k] ?? k}</span>
            <span className="font-bold text-tinta">{v.toLocaleString("es-PE")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminMetricas() {
  const [m, setM] = useState<MetricasPlataforma | null>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");

  useEffect(() => {
    obtenerMetricasPlataforma()
      .then((r) => { if (r) { setM(r); setEstado("ok"); } else setEstado("error"); })
      .catch(() => setEstado("error"));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Plataforma LeadAI</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Métricas globales</h1>
        <p className="mt-1 text-[0.92rem] text-frio">La foto de todo el ecosistema: negocios, leads y consumo.</p>
      </header>

      {estado === "cargando" && <SkeletonLista filas={3} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar las métricas. Recargá.</p>
        </div>
      )}

      {estado === "ok" && m && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta valor={m.negocios} label="Negocios" />
            <Tarjeta valor={m.leads.total} label="Leads totales" />
            <Tarjeta valor={m.mensajes} label="Mensajes procesados" />
            <Tarjeta valor={m.ejemplosEntrenamiento} label="Ejemplos de entrenamiento" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Desglose titulo="Negocios por plan" datos={m.negociosPorPlan} labels={{}} />
            <Desglose titulo="Leads por nivel" datos={m.leads.porNivel} labels={NIVEL_LABEL} />
            <Desglose titulo="Leads por estado" datos={m.leads.porEstado} labels={ESTADO_LABEL} />
          </div>
        </>
      )}
    </div>
  );
}
