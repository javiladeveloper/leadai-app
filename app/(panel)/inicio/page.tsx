"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, leerSesion } from "@/lib/auth";
import { contarCalientesSinAtender, listarLeads } from "@/lib/leads";
import { IconoRayo, IconoConversaciones, IconoBandeja } from "@/components/Iconos";

// Inicio del panel de escritorio: saludo, aviso de calientes sin atender,
// métricas rápidas (demo) y accesos directos a las secciones más usadas.
export default function InicioPanel() {
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

  const sesion = leerSesion();
  const nombre = sesion?.usuario.nombre?.split(" ")[0] ?? "";
  const leads = listarLeads();
  const calientes = contarCalientesSinAtender();
  const ventas = leads.filter((l) => l.estado === "ganado").length;

  const metricas = [
    { n: leads.length, l: "Leads activos", c: "text-tinta" },
    { n: calientes, l: "Calientes sin atender", c: "text-brasa" },
    { n: ventas, l: "Ventas cerradas", c: "text-ok" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu panel</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">
          Hola{nombre ? `, ${nombre}` : ""} 👋
        </h1>
      </header>

      {/* Aviso de datos de ejemplo */}
      <div className="rounded-tarjeta bg-tibio-suave px-4 py-2.5 text-center text-[0.82rem] font-semibold text-tinta-2">
        Estás viendo datos de ejemplo — cuando conectes tu canal, acá verás tu actividad real.
      </div>

      {/* Card destacada: calientes sin atender */}
      {calientes > 0 && (
        <Link
          href="/leads"
          className="flex items-center gap-3 rounded-tarjeta bg-brasa px-5 py-4 text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
        >
          <IconoRayo className="h-8 w-8 shrink-0" />
          <div>
            <p className="text-[1.15rem] font-bold leading-tight">
              {calientes} {calientes === 1 ? "lead caliente" : "leads calientes"} sin atender
            </p>
            <p className="text-[0.88rem] text-carta/85">Tocá para verlos — están listos para cerrar</p>
          </div>
        </Link>
      )}

      {/* Métricas rápidas */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {metricas.map((m) => (
          <div
            key={m.l}
            className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
          >
            <p className={`text-[2.2rem] font-bold leading-none ${m.c}`}>{m.n}</p>
            <p className="mt-2 text-[0.85rem] font-semibold text-frio">{m.l}</p>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Accesos rápidos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/conversaciones"
            className="flex items-center gap-3 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tibio-suave text-tinta">
              <IconoConversaciones className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-tinta">Conversaciones</p>
              <p className="text-[0.82rem] text-frio">Chateá con tus leads en vivo</p>
            </div>
          </Link>

          <Link
            href="/leads"
            className="flex items-center gap-3 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tibio-suave text-tinta">
              <IconoBandeja className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-tinta">Leads</p>
              <p className="text-[0.82rem] text-frio">Revisá y filtrá toda tu bandeja</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
