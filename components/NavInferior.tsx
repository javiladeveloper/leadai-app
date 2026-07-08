"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconoInicio, IconoConversaciones, IconoBandeja, IconoReportes, IconoConfig } from "./Iconos";

const TABS = [
  { href: "/inicio", label: "Inicio", Icono: IconoInicio },
  { href: "/conversaciones", label: "Chats", Icono: IconoConversaciones },
  { href: "/leads", label: "Leads", Icono: IconoBandeja },
  { href: "/reportes", label: "Reportes", Icono: IconoReportes },
  { href: "/configuracion", label: "Ajustes", Icono: IconoConfig },
];

// Barra de navegación inferior — alcanzable con el pulgar. Fija al ancho del
// teléfono. Cada destino se distingue por ícono + texto (no solo color).
export function NavInferior() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-linea bg-carta/95 backdrop-blur">
      <div className="mx-auto flex max-w-[460px]">
        {TABS.map(({ href, label, Icono }) => {
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
      </div>
    </nav>
  );
}
