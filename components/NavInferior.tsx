"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { esSuperAdmin } from "@/lib/auth";
import {
  IconoInicio, IconoConversaciones, IconoSeguimiento, IconoFlujos,
  IconoBandeja, IconoReportes, IconoConfig, IconoRayo, IconoOportunidades,
} from "./Iconos";

// Accesos rápidos en la barra (4) — lo más usado día a día. El resto vive en
// el menú "Más" para que NADA quede inaccesible en móvil.
const RAPIDOS = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  { href: "/conversaciones", label: "Chats", Icono: IconoConversaciones },
  { href: "/seguimiento", label: "Pipeline", Icono: IconoSeguimiento },
  { href: "/leads", label: "Leads", Icono: IconoBandeja },
];

// Todas las secciones del panel (mismas que el Sidebar de escritorio). El menú
// "Más" las muestra completas para que en móvil se llegue a cualquier pantalla.
const TODAS = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  { href: "/conversaciones", label: "Conversaciones", Icono: IconoConversaciones },
  { href: "/comentarios", label: "Comentarios", Icono: IconoConversaciones },
  { href: "/publicar", label: "Publicar", Icono: IconoOportunidades },
  { href: "/anuncios", label: "Anuncios", Icono: IconoRayo },
  { href: "/seguimiento", label: "Seguimiento", Icono: IconoSeguimiento },
  { href: "/flujos", label: "Flujos", Icono: IconoFlujos },
  { href: "/probar-bot", label: "Probar bot", Icono: IconoRayo },
  { href: "/oportunidades", label: "Oportunidades", Icono: IconoOportunidades },
  { href: "/mi-perfil", label: "Mi perfil", Icono: IconoConfig },
  { href: "/leads", label: "Leads", Icono: IconoBandeja },
  { href: "/reportes", label: "Reportes", Icono: IconoReportes },
  { href: "/equipo", label: "Equipo", Icono: IconoConversaciones },
  { href: "/configuracion", label: "Configuración", Icono: IconoConfig },
];

// Barra de navegación inferior (móvil). Antes tenía 5 destinos fijos y dejaba
// 6 pantallas del panel inaccesibles (Seguimiento, Flujos, Probar bot,
// Oportunidades, Mi perfil, Equipo). Ahora: 4 accesos rápidos + botón "Más"
// que abre un menú con TODAS las secciones (igual que el Sidebar de escritorio).
export function NavInferior() {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const superAdmin = esSuperAdmin();

  return (
    <>
      {/* Menú "Más": hoja inferior con todas las secciones */}
      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          className="fixed inset-0 z-30 bg-tinta/40 backdrop-blur-sm lg:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-carta p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(51,40,31,0.15)]"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-linea" />
            <p className="mb-2 px-1 text-[0.78rem] font-bold uppercase tracking-wide text-frio">
              Todas las secciones
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TODAS.map(({ href, label, Icono }) => {
                const activo = path.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAbierto(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-tarjeta px-2 py-3 text-center text-[0.74rem] font-semibold transition ${
                      activo ? "bg-brasa-suave text-brasa-hondo" : "bg-arena/60 text-tinta-2 hover:bg-arena"
                    }`}
                  >
                    <Icono className="h-6 w-6" />
                    {label}
                  </Link>
                );
              })}
              {superAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setAbierto(false)}
                  className="flex flex-col items-center gap-1.5 rounded-tarjeta border border-brasa/30 px-2 py-3 text-center text-[0.74rem] font-semibold text-brasa transition hover:bg-brasa/10"
                >
                  <IconoRayo className="h-6 w-6" />
                  Plataforma
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="sticky bottom-0 z-20 border-t border-linea bg-carta/95 backdrop-blur">
        <div className="mx-auto flex max-w-[460px]">
          {RAPIDOS.map(({ href, label, Icono }) => {
            const activo = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-[0.72rem] font-bold transition-colors ${
                  activo ? "text-brasa" : "text-frio"
                }`}
                aria-current={activo ? "page" : undefined}
              >
                <Icono className="h-6 w-6" />
                {label}
              </Link>
            );
          })}
          {/* Botón "Más": abre el menú con el resto de secciones */}
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-[0.72rem] font-bold text-frio transition-colors"
            aria-label="Más secciones"
          >
            {/* Ícono "más" (tres puntos / menú) */}
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="12" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
            </svg>
            Más
          </button>
        </div>
      </nav>
    </>
  );
}
