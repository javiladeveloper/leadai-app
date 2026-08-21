"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCapacidades } from "@/lib/modo-negocio";
import { SECCIONES } from "@/components/panel/Sidebar";
import { rolEnEmpresaActiva } from "@/lib/auth";
import { seccionesDe, rapidosDe } from "@/lib/secciones";
import { esSuperAdmin } from "@/lib/auth";
import {
  IconoInicio, IconoConversaciones, IconoSeguimiento, IconoFlujos,
  IconoBandeja, IconoReportes, IconoConfig, IconoRayo, IconoOportunidades,
} from "./Iconos";

/**
 * La barra de móvil usa LA MISMA lista que el Sidebar (2026-08-19).
 *
 * Antes acá había cuatro listas propias —accesos rápidos, accesos rápidos de
 * restaurante, qué ve un restaurante en "Más", y qué NO ve el que no lo es—
 * duplicando lo que el Sidebar ya decía. Agregar una sección obligaba a
 * acordarse de las dos pantallas, y ya se había desincronizado.
 */

// Barra de navegación inferior (móvil). Antes tenía 5 destinos fijos y dejaba
// 6 pantallas del panel inaccesibles (Seguimiento, Flujos, Probar bot,
// Oportunidades, Mi perfil, Equipo). Ahora: 4 accesos rápidos + botón "Más"
// que abre un menú con TODAS las secciones (igual que el Sidebar de escritorio).
export function NavInferior() {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const superAdmin = esSuperAdmin();
  // Mientras no se sabe (`null`) se muestra el menú completo: acortarlo de
  // entrada y alargarlo después es el parpadeo más molesto de los dos.
  const negocio = useCapacidades();
  const caps = negocio?.capacidades ?? null;
  // El rol filtra encima de las capacidades: un mozo no ve Inicio ni Ajustes.
  const rol = rolEnEmpresaActiva();
  const rapidos = caps ? rapidosDe(SECCIONES, caps, rol) : SECCIONES.filter((s) => s.rapido !== undefined).slice(0, 4);
  const todas = caps ? seccionesDe(SECCIONES, caps, rol) : SECCIONES;

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
              {todas.map(({ href, label, Icono }) => {
                const activo = path.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setAbierto(false)}
                    className={`flex flex-col items-center gap-1.5 rounded-tarjeta px-2 py-3 text-center text-[0.74rem] font-semibold transition ${
                      activo ? "bg-brasa text-sobre-brasa" : "bg-arena/60 text-tinta-2 hover:bg-arena"
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
                  className="flex flex-col items-center gap-1.5 rounded-tarjeta border border-brasa/30 px-2 py-3 text-center text-[0.74rem] font-semibold text-brasa-texto transition hover:bg-brasa/10"
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
          {/* `corto` cuando existe: en la barra angosta "Conversaciones" y
              "Configuración" no entran — van como "Chats" y "Ajustes". */}
          {rapidos.map(({ href, label, corto, Icono }) => {
            const activo = path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-[0.72rem] font-bold transition-colors ${
                  activo ? "text-brasa-texto" : "text-frio"
                }`}
                aria-current={activo ? "page" : undefined}
              >
                <Icono className="h-6 w-6" />
                {corto ?? label}
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
