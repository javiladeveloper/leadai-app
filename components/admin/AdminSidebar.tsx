"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoReportes, IconoBandeja, IconoRayo } from "@/components/Iconos";

const SECCIONES = [
  { href: "/admin", label: "Métricas", Icono: IconoReportes },
  { href: "/admin/negocios", label: "Negocios", Icono: IconoBandeja },
  { href: "/admin/aprendizaje", label: "Aprendizaje", Icono: IconoRayo },
];

// Sidebar del panel de super admin. Marca distinta (badge "ADMIN") para dejar
// claro que es el panel de plataforma, no el de un negocio.
export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col bg-superficie-honda text-arena">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brasa text-carta">
          <IconoRayo className="h-5 w-5" />
        </span>
        <span className="text-lg font-bold">
          Lead<span className="text-brasa">AI</span>
        </span>
        <span className="ml-1 rounded-chip bg-brasa/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-brasa">
          Admin
        </span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {SECCIONES.map(({ href, label, Icono }) => {
          // /admin es exacto; el resto por prefijo (para subrutas futuras).
          const activo = href === "/admin" ? path === "/admin" : path.startsWith(href);
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
      </nav>
      <div className="border-t border-white/10 px-5 py-4">
        <Link href="/inicio" className="text-xs font-semibold text-arena/60 hover:text-arena">
          ← Ir a mi panel de negocio
        </Link>
      </div>
    </aside>
  );
}
