"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { contarCalientesSinAtender, listarLeads } from "@/lib/leads";
import type { Temperatura } from "@/lib/tipos";
import { TarjetaLead } from "@/components/TarjetaLead";
import { IconoRayo } from "@/components/Iconos";

type Filtro = "todos" | Temperatura;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

// Leads del panel de escritorio: misma lógica de filtros que la bandeja móvil
// (app/bandeja), pero en grilla ancha para aprovechar el espacio de escritorio.
export default function LeadsPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [empresa, setEmpresa] = useState<string>("todas");

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  const leads = listarLeads();
  const calientes = contarCalientesSinAtender();

  const empresas = useMemo(
    () => Array.from(new Set(leads.map((l) => l.empresa))),
    [leads],
  );

  const visibles = leads.filter(
    (l) =>
      (filtro === "todos" || l.temperatura === filtro) &&
      (empresa === "todas" || l.empresa === empresa),
  );

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu bandeja</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Leads</h1>
      </header>

      {/* Aviso de datos de ejemplo */}
      <div className="rounded-tarjeta bg-tibio-suave px-4 py-2.5 text-center text-[0.82rem] font-semibold text-tinta-2">
        Estás viendo datos de ejemplo — cuando conectes tu canal, acá verás tus leads reales.
      </div>

      {/* Card destacada: calientes sin atender */}
      {calientes > 0 && (
        <button
          onClick={() => setFiltro("caliente")}
          className="flex w-full items-center gap-3 rounded-tarjeta bg-brasa px-5 py-4 text-left text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
        >
          <IconoRayo className="h-7 w-7 shrink-0" />
          <div>
            <p className="text-[1.1rem] font-bold leading-tight">
              {calientes} {calientes === 1 ? "lead caliente" : "leads calientes"} sin atender
            </p>
            <p className="text-[0.85rem] text-carta/85">Tocá para verlos — están listos para cerrar</p>
          </div>
        </button>
      )}

      {/* Filtros de temperatura */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              filtro === f.id
                ? "bg-tinta text-carta"
                : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filtro de empresa */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEmpresa("todas")}
          className={`shrink-0 rounded-chip px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${
            empresa === "todas" ? "bg-tibio-suave text-tibio" : "bg-carta text-frio ring-1 ring-linea"
          }`}
        >
          Todas las marcas
        </button>
        {empresas.map((e) => (
          <button
            key={e}
            onClick={() => setEmpresa(e)}
            className={`shrink-0 rounded-chip px-3.5 py-1.5 text-[0.82rem] font-semibold transition ${
              empresa === e ? "bg-tibio-suave text-tibio" : "bg-carta text-frio ring-1 ring-linea"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {/* Lista en grilla ancha */}
      {visibles.length === 0 ? (
        <p className="rounded-tarjeta bg-carta px-4 py-8 text-center text-frio ring-1 ring-linea">
          No hay leads con este filtro.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((l) => (
            <TarjetaLead key={l.id} lead={l} />
          ))}
        </div>
      )}
    </div>
  );
}
