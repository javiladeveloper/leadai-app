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

// Sidebar del panel de escritorio. Fijo a la izquierda en lg+. En superficie
// honda (marrón) para separarlo del contenido arena.
export function Sidebar() {
  const path = usePathname();
  const sesion = leerSesion();
  const superAdmin = esSuperAdmin();
  const nombre = sesion?.usuario?.nombre ?? sesion?.usuario?.email ?? "Mi cuenta";
  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col bg-superficie-honda text-arena">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brasa text-carta">
          <IconoRayo className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold">Lead<span className="text-brasa">AI</span></span>
      </div>
      {/* Alta manual de lead (diseño Stitch): para el contacto que la vendedora
          conoció en la calle o le refirieron. */}
      <div className="px-3 pb-3">
        <Link
          href="/leads?nuevo=1"
          className="flex items-center justify-center gap-1.5 rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-carta transition hover:bg-brasa-hondo"
        >
          ＋ Nuevo lead
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {SECCIONES.map(({ href, label, Icono }) => {
          const activo = path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                activo ? "bg-brasa text-carta" : "text-arena/80 hover:bg-white/5 hover:text-arena"
              }`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
        {/* Acceso al panel de plataforma, solo para super admins. */}
        {superAdmin && (
          <Link
            href="/admin"
            className="mt-2 flex items-center gap-3 rounded-xl border border-brasa/30 px-3 py-2.5 text-sm font-semibold text-brasa transition-colors hover:bg-brasa/10"
          >
            <IconoRayo className="h-5 w-5" />
            Panel de plataforma
          </Link>
        )}
      </nav>
      <ContadorHits />
      <div className="border-t border-white/10 px-5 py-4 text-sm">
        <p className="font-semibold text-arena">{nombre}</p>
        <p className="text-arena/60 text-xs">{sesion?.usuario?.email}</p>
      </div>
    </aside>
  );
}
