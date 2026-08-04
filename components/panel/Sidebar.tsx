"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { leerSesion, esSuperAdmin } from "@/lib/auth";
import { ContadorHits } from "@/components/panel/ContadorHits";
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

// Sidebar del panel de escritorio, RETRÁCTIL (pedido 2026-08-04): colapsado es
// un riel de íconos de 68px; al pasar el mouse se expande a 240px con los
// rótulos. Así el contenido (sobre todo Conversaciones) gana todo ese ancho.
// En superficie honda (marrón) para separarlo del contenido arena.
export function Sidebar() {
  const path = usePathname();
  const sesion = leerSesion();
  const superAdmin = esSuperAdmin();
  const nombre = sesion?.usuario?.nombre ?? sesion?.usuario?.email ?? "Mi cuenta";
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";
  return (
    <aside className="group hidden overflow-hidden bg-superficie-honda text-arena transition-[width] duration-200 ease-out lg:flex lg:w-[68px] lg:shrink-0 lg:flex-col lg:hover:w-60">
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brasa text-carta">
          <IconoRayo className="h-5 w-5" />
        </span>
        <span className="whitespace-nowrap text-lg font-bold opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          Lead<span className="text-brasa">AI</span>
        </span>
      </div>
      {/* Alta manual de lead: colapsado es un botón cuadrado con ＋; expandido,
          el chip completo. */}
      <div className="px-3 pb-3">
        <Link
          href="/leads?nuevo=1"
          title="Nuevo lead"
          className="flex h-10 items-center justify-center gap-1.5 rounded-chip bg-brasa text-sm font-bold text-carta transition hover:bg-brasa-hondo"
        >
          <span className="shrink-0">＋</span>
          <span className="hidden whitespace-nowrap group-hover:inline">Nuevo lead</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 [scrollbar-width:none]">
        {SECCIONES.map(({ href, label, Icono }) => {
          const activo = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-semibold transition-colors ${
                activo ? "bg-brasa text-carta" : "text-arena/80 hover:bg-white/5 hover:text-arena"
              }`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {label}
              </span>
            </Link>
          );
        })}
        {/* Acceso al panel de plataforma, solo para super admins. */}
        {superAdmin && (
          <Link
            href="/admin"
            title="Panel de plataforma"
            className="mt-2 flex items-center gap-3 rounded-xl border border-brasa/30 px-2.5 py-2.5 text-sm font-semibold text-brasa transition-colors hover:bg-brasa/10"
          >
            <IconoRayo className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              Panel de plataforma
            </span>
          </Link>
        )}
      </nav>
      {/* Cuota del mes: solo tiene sentido expandido (números y barra). */}
      <div className="hidden group-hover:block">
        <ContadorHits />
      </div>
      <div className="border-t border-white/10 px-4 py-4 text-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[0.85rem] font-bold text-arena">
            {inicial}
          </span>
          <div className="min-w-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <p className="truncate font-semibold text-arena">{nombre}</p>
            <p className="truncate text-xs text-arena/60">{sesion?.usuario?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
