"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion } from "@/lib/auth";
import { contarCalientesSinAtender, listarLeads } from "@/lib/leads";
import type { Temperatura } from "@/lib/tipos";
import { TarjetaLead } from "@/components/TarjetaLead";
import { NavInferior } from "@/components/NavInferior";
import { IconoRayo } from "@/components/Iconos";

type Filtro = "todos" | Temperatura;

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "caliente", label: "Calientes" },
  { id: "tibio", label: "Tibios" },
  { id: "frio", label: "Fríos" },
];

export default function Bandeja() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [empresa, setEmpresa] = useState<string>("todas");

  useEffect(() => {
    if (!haySesion()) router.replace("/");
    else setListo(true);
  }, [router]);

  const sesion = listo ? leerSesion() : null;
  const nombre = sesion?.usuario.nombre?.split(" ")[0] ?? "";
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
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <p className="eyebrow">Tu bandeja</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">
          Hola{nombre ? `, ${nombre}` : ""} 👋
        </h1>

        {/* Banner: estado del bot. En rojo cuando está desconectado. */}
        <div className="mt-4 flex items-center gap-2.5 rounded-tarjeta bg-superficie-honda px-4 py-3 text-carta">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          <p className="text-[0.9rem]">
            <span className="font-bold">IA activa</span> · respondiendo tus redes 24/7
          </p>
        </div>
      </header>

      <main className="flex-1 px-5 pb-6 pt-5">
        {/* Card destacada: calientes sin atender */}
        {calientes > 0 && (
          <button
            onClick={() => setFiltro("caliente")}
            className="mb-5 flex w-full items-center gap-3 rounded-tarjeta bg-brasa px-4 py-3.5 text-left text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
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
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 pb-1">
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
        <div className="mb-4 flex gap-2 overflow-x-auto -mx-5 px-5 pb-1">
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

        {/* Lista */}
        <div className="flex flex-col gap-3">
          {visibles.length === 0 ? (
            <p className="rounded-tarjeta bg-carta px-4 py-8 text-center text-frio ring-1 ring-linea">
              No hay leads con este filtro.
            </p>
          ) : (
            visibles.map((l) => <TarjetaLead key={l.id} lead={l} />)
          )}
        </div>
      </main>

      <NavInferior />
    </div>
  );
}
