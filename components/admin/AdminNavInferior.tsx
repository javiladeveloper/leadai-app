"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SECCIONES_ADMIN } from "@/components/admin/AdminSidebar";

/**
 * LA NAVEGACIÓN DEL PANEL DE PLATAFORMA EN EL CELULAR (2026-09-09).
 *
 * EL CASO REAL (Jonathan): "tengo un panel plataforma que solo funciona en
 * web... cuando abro en web mobile se pierde por el responsive". No era una
 * exageración: `AdminSidebar` es `hidden lg:flex`, así que por debajo de
 * 1024px la ÚNICA navegación del panel desaparecía y no había reemplazo —
 * ni hamburguesa, ni tabs, ni drawer. Desde el celular solo se podía cambiar
 * de sección escribiendo la URL a mano.
 *
 * Se resuelve con el MISMO patrón que el panel de negocio (`NavInferior`):
 * barra fija abajo, respetando el notch. La diferencia es que acá no hace
 * falta el botón "Más" — admin tiene cinco secciones y entran todas.
 *
 * Comparte `SECCIONES_ADMIN` con el sidebar a propósito: dos listas paralelas
 * es exactamente cómo el panel de negocio se desincronizó antes.
 */
export function AdminNavInferior() {
  const path = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-linea bg-carta/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[460px]">
        {SECCIONES_ADMIN.map(({ href, label, corto, Icono }) => {
          // /admin es exacto; el resto por prefijo (mismo criterio que el sidebar).
          const activo = href === "/admin" ? path === "/admin" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] text-[0.68rem] font-bold transition-colors ${
                activo ? "text-brasa-texto" : "text-frio"
              }`}
              aria-current={activo ? "page" : undefined}
            >
              <Icono className="h-6 w-6" />
              {corto ?? label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
