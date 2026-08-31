"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { haySesion, leerSesion, esSuperAdmin, empresasVisibles } from "@/lib/auth";
import { refrescarSesion } from "@/lib/api";
import { Sidebar } from "@/components/panel/Sidebar";
import { HeaderPanel } from "@/components/panel/HeaderPanel";
import { NavInferior } from "@/components/NavInferior";
import { BarraSoporte } from "@/components/panel/BarraSoporte";

// Shell del panel de escritorio: Sidebar fijo (lg+) + Header, contenido ancho.
// En mobile el sidebar se oculta y reaparece la NavInferior.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  const router = useRouter();
  const [listo, setListo] = useState(false);
  // Bump para re-renderizar los menús cuando el refresco de sesión cambia algo
  // (ej. el usuario ahora es super admin y le aparece "Plataforma").
  const [, setRefresco] = useState(0);
  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    // En segundo plano: la sesión guardada puede estar vieja (la marca de
    // super admin y las empresas nacen en el login). Si cambió, re-render.
    refrescarSesion()
      .then((cambio) => { if (cambio) setRefresco((n) => n + 1); })
      .catch(() => {});
    // Red de seguridad: si el usuario no tiene ningún negocio, va al onboarding
    // — salvo que sea super admin, que va a su panel de plataforma.
    //
    // SE MIRA `empresasVisibles()`, NO `sesion.empresas` (2026-08-31, reporte
    // de Jonathan: "puse entrar modo soporte y me reboto").
    //
    // El super admin no tiene empresas PROPIAS, así que `sesion.empresas`
    // venía vacío y esta guarda lo devolvía a /admin apenas entraba al panel
    // del negocio ajeno: el modo soporte se activaba bien y moría en el
    // primer render. `empresasVisibles()` sí cuenta el negocio del soporte,
    // que es justo el que está mirando.
    if (leerSesion() && empresasVisibles().length === 0) {
      router.replace(esSuperAdmin() ? "/admin" : "/bienvenida");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="flex h-dvh bg-arena">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Arriba de TODO: si estás en el negocio de otro, tenés que verlo
            antes que cualquier dato de esa pantalla. */}
        <BarraSoporte />
        <HeaderPanel />
        {/* `key={ruta}`: sin esto React reusa el nodo entre pantallas y la
            animación de entrada no vuelve a correr — el cambio se veria tan
            seco como antes. */}
        <main
          key={ruta}
          className="pantalla-entra min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          {children}
        </main>
        <div className="lg:hidden">
          <NavInferior />
        </div>
      </div>
    </div>
  );
}
