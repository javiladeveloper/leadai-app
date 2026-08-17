"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { leerSesion, esSuperAdmin } from "@/lib/auth";
import { useModoPedidos } from "@/lib/modo-negocio";
import { ContadorHits } from "@/components/panel/ContadorHits";
import { LogoLeadAI } from "@/components/LogoLeadAI";
import {
  IconoInicio, IconoConversaciones, IconoSeguimiento, IconoFlujos,
  IconoBandeja, IconoReportes, IconoConfig, IconoRayo, IconoOportunidades,
} from "@/components/Iconos";

// Panel de NEGOCIO (dueño de un negocio). El panel de plataforma (Aprendizaje,
// Métricas, Negocios) vive aparte en /admin, solo para super admins.
const SECCIONES = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  { href: "/conversaciones", label: "Conversaciones", Icono: IconoConversaciones },
  { href: "/comentarios", label: "Comentarios", Icono: IconoConversaciones },
  { href: "/publicar", label: "Publicar", Icono: IconoOportunidades },
  { href: "/anuncios", label: "Anuncios", Icono: IconoRayo },
  { href: "/seguimiento", label: "Seguimiento", Icono: IconoSeguimiento },
  // La carta del restaurante: lo que ve el cliente en /c/<tenantId> y lo que
  // el bot lee para tomar pedidos. Se editaba en la app móvil hasta que se
  // movió acá (2026-08-17): 40 platos con el pulgar no los carga nadie.
  { href: "/carta", label: "Carta", Icono: IconoOportunidades },
  { href: "/flujos", label: "Flujos", Icono: IconoFlujos },
  { href: "/probar-bot", label: "Probar bot", Icono: IconoRayo },
  { href: "/oportunidades", label: "Oportunidades", Icono: IconoOportunidades },
  // "Mi perfil" vive dentro de Configuración (pestaña — es de la persona,
  // no de un negocio; decisión 2026-07-22).
  { href: "/leads", label: "Leads", Icono: IconoBandeja },
  { href: "/reportes", label: "Reportes", Icono: IconoReportes },
  { href: "/equipo", label: "Equipo", Icono: IconoConversaciones },
  { href: "/configuracion", label: "Configuración", Icono: IconoConfig },
];

/**
 * LO QUE VE UN RESTAURANTE (2026-08-17).
 *
 * Un negocio de comida no capta leads: no hace anuncios, no arma flujos, no
 * tiene un embudo de oportunidades. Mostrarle catorce secciones de las que usa
 * cuatro no es "más funciones", es un menú donde no encuentra su carta.
 *
 * Las demás se OCULTAN, no se muestran con candado: no hay un plan que ofrecer
 * todavía, y un candado que no lleva a ningún lado es peor que la ausencia.
 */
const SECCIONES_PEDIDOS = ["/inicio", "/conversaciones", "/carta", "/configuracion"];

const CLAVE_SIDEBAR = "leadai.sidebar"; // '1' expandido | '0' colapsado

// Sidebar del panel de escritorio, COLAPSABLE CON BOTÓN (feedback 2026-08-04:
// el hover mareaba). El botón «/» expande o retrae; la preferencia se recuerda.
// Colapsado, cada ícono explica qué es con su tooltip (title) al pasar el mouse.
export function Sidebar() {
  const path = usePathname();
  const sesion = leerSesion();
  const superAdmin = esSuperAdmin();
  // `null` mientras no se sabe: se muestra el menú completo hasta tener la
  // respuesta. Al revés (asumir restaurante) el menú aparecería corto y se
  // alargaría de golpe, que es el parpadeo más molesto de los dos.
  const modoPedidos = useModoPedidos();
  const secciones = modoPedidos
    ? SECCIONES.filter((s) => SECCIONES_PEDIDOS.includes(s.href))
    : SECCIONES;
  const nombre = sesion?.usuario?.nombre ?? sesion?.usuario?.email ?? "Mi cuenta";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  const [expandido, setExpandido] = useState(true);
  useEffect(() => {
    setExpandido(localStorage.getItem(CLAVE_SIDEBAR) !== "0");
  }, []);
  function alternar() {
    const nuevo = !expandido;
    setExpandido(nuevo);
    localStorage.setItem(CLAVE_SIDEBAR, nuevo ? "1" : "0");
  }

  return (
    <aside
      className={`hidden bg-superficie-honda text-arena transition-[width] duration-200 ease-out lg:flex lg:shrink-0 lg:flex-col ${
        expandido ? "lg:w-60" : "lg:w-[68px]"
      }`}
    >
      <div className={`flex items-center gap-2 py-5 ${expandido ? "px-5" : "justify-center px-2"}`}>
        <LogoLeadAI className="h-9 w-9 shrink-0" />
        {expandido && (
          <>
            <span className="whitespace-nowrap text-lg font-bold">
              Lead<span className="text-brasa">AI</span>
            </span>
            <button
              onClick={alternar}
              title="Retraer el menú"
              aria-label="Retraer el menú"
              className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-arena/60 transition hover:bg-white/10 hover:text-arena"
            >
              «
            </button>
          </>
        )}
      </div>
      {/* Colapsado: el botón de expandir va solo, bien visible bajo el logo. */}
      {!expandido && (
        <div className="flex justify-center pb-2">
          <button
            onClick={alternar}
            title="Expandir el menú"
            aria-label="Expandir el menú"
            className="grid h-7 w-7 place-items-center rounded-lg text-arena/60 transition hover:bg-white/10 hover:text-arena"
          >
            »
          </button>
        </div>
      )}
      {/* Alta manual de lead. */}
      <div className="px-3 pb-3">
        <Link
          href="/leads?nuevo=1"
          title="Nuevo lead"
          className="flex h-10 items-center justify-center gap-1.5 rounded-chip bg-brasa text-sm font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
        >
          <span className="shrink-0">＋</span>
          {expandido && <span className="whitespace-nowrap">Nuevo lead</span>}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
        {secciones.map(({ href, label, Icono }) => {
          const activo = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors ${
                activo ? "bg-brasa text-carta" : "text-arena/80 hover:bg-white/5 hover:text-arena"
              } ${expandido ? "" : "justify-center"}`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-5 w-5 shrink-0" />
              {expandido && <span className="whitespace-nowrap">{label}</span>}
            </Link>
          );
        })}
        {/* Acceso al panel de plataforma, solo para super admins. */}
        {superAdmin && (
          <Link
            href="/admin"
            title="Panel de plataforma"
            className={`mt-2 flex items-center gap-3 rounded-xl border border-brasa/30 px-2.5 py-2.5 text-sm font-semibold text-brasa transition-colors hover:bg-brasa/10 ${
              expandido ? "" : "justify-center"
            }`}
          >
            <IconoRayo className="h-5 w-5 shrink-0" />
            {expandido && <span className="whitespace-nowrap">Panel de plataforma</span>}
          </Link>
        )}
      </nav>
      {/* Cuota del mes: solo expandido (números y barra necesitan ancho). */}
      {expandido && <ContadorHits />}
      <div className={`border-t border-white/10 py-4 text-sm ${expandido ? "px-4" : "px-2"}`}>
        <div className={`flex items-center gap-2.5 ${expandido ? "" : "justify-center"}`}>
          <span
            title={expandido ? undefined : nombre}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[0.85rem] font-bold text-arena"
          >
            {inicial}
          </span>
          {expandido && (
            <div className="min-w-0">
              <p className="truncate font-semibold text-arena">{nombre}</p>
              <p className="truncate text-xs text-arena/60">{sesion?.usuario?.email}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
