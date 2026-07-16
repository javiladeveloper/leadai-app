"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, leerSesion } from "@/lib/auth";
import { obtenerResumen, type Resumen } from "@/lib/api";
import { IconoRayo, IconoConversaciones, IconoBandeja, IconoSeguimiento, IconoReportes } from "@/components/Iconos";
import { SkeletonMetricas } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";

// Accesos rápidos del Inicio — las secciones más útiles del día a día. Antes
// solo había 2 (Conversaciones, Leads); sumamos Pipeline y Reportes para que
// el cliente descubra el producto completo desde la primera pantalla.
const ACCESOS = [
  { href: "/conversaciones", titulo: "Conversaciones", desc: "Chateá con tus leads en vivo", Icono: IconoConversaciones },
  { href: "/seguimiento", titulo: "Pipeline", desc: "Mirá en qué etapa está cada venta", Icono: IconoSeguimiento },
  { href: "/leads", titulo: "Leads", desc: "Revisá y filtrá toda tu bandeja", Icono: IconoBandeja },
  { href: "/reportes", titulo: "Reportes", desc: "Cómo viene tu negocio en números", Icono: IconoReportes },
];

// Inicio del panel de escritorio: saludo, métricas reales del tenant activo
// (GET /resumen) y accesos directos a las secciones más usadas. Si el tenant
// todavía no tiene actividad, guía al usuario a conectar WhatsApp.
export default function InicioPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const r = await obtenerResumen();
      setResumen(r);
      setEstado("ok");
    } catch (e) {
      void e;
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  if (!listo) return null;

  const sesion = leerSesion();
  const nombre = sesion?.usuario.nombre?.split(" ")[0] ?? "";

  const vacio =
    estado === "ok" &&
    !!resumen &&
    resumen.leadsActivos === 0 &&
    resumen.ventasCerradas === 0 &&
    resumen.calientesSinAtender === 0;

  const metricas = resumen
    ? [
        { n: resumen.leadsActivos, l: "Leads activos", c: "text-tinta" },
        { n: resumen.calientesSinAtender, l: "Calientes sin atender", c: "text-brasa" },
        { n: resumen.ventasCerradas, l: "Ventas cerradas", c: "text-ok" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu panel</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">
          Hola{nombre ? `, ${nombre}` : ""} 👋
        </h1>
      </header>

      {estado === "cargando" && <SkeletonMetricas />}

      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-semibold text-tinta">
            No pudimos cargar tus datos. Recargá.
          </p>
        </div>
      )}

      {estado === "ok" && vacio && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Aún no tenés leads. Conectá WhatsApp para empezar a recibirlos
          </p>
          <Link
            href="/configuracion"
            className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition active:scale-[0.99]"
          >
            Conectar WhatsApp
          </Link>
        </div>
      )}

      {estado === "ok" && resumen && !vacio && (
        <>
          {/* Card destacada: calientes sin atender */}
          {resumen.calientesSinAtender > 0 && (
            <Link
              href="/leads"
              className="flex items-center gap-3 rounded-tarjeta bg-brasa px-5 py-4 text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
            >
              <IconoRayo className="h-8 w-8 shrink-0" />
              <div>
                <p className="text-[1.15rem] font-bold leading-tight">
                  {resumen.calientesSinAtender}{" "}
                  {resumen.calientesSinAtender === 1 ? "lead caliente" : "leads calientes"} sin
                  atender
                </p>
                <p className="text-[0.88rem] text-carta/85">Tocá para verlos — están listos para cerrar</p>
              </div>
            </Link>
          )}

          {/* Métricas reales */}
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

          {/* Accesos rápidos — a las secciones más útiles del día a día */}
          <div>
            <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Accesos rápidos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {ACCESOS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center gap-3 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-tibio-suave text-tinta">
                    <a.Icono className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-bold text-tinta">{a.titulo}</p>
                    <p className="text-[0.82rem] text-frio">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
