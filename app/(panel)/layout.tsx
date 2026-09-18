"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { haySesion, leerSesion, esSuperAdmin, empresasVisibles } from "@/lib/auth";
import { refrescarSesion } from "@/lib/api";
import { Sidebar } from "@/components/panel/Sidebar";
import { HeaderPanel } from "@/components/panel/HeaderPanel";
import { NavInferior } from "@/components/NavInferior";
import { BarraSoporte } from "@/components/panel/BarraSoporte";
import { BotonSoporte } from "@/components/panel/BotonSoporte";

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
    /**
     * ANTES DE EXPULSAR, PREGUNTAR AL BACKEND (2026-09-18, bug que reporto
     * Jonathan: su marketero acepto la invitacion y seguia cayendo en el
     * onboarding aun despues de arreglarlo en la raiz y en /invitacion).
     *
     * Este era el TERCER lugar que decide con la lista guardada en
     * localStorage, y el que faltaba: quien entra directo a una URL del panel
     * -o vuelve a una pestaña abierta- no pasa por la raiz, asi que los otros
     * dos arreglos no lo alcanzaban.
     *
     * Solo se consulta cuando la lista esta VACIA: el resto de las cargas del
     * panel no paga un viaje mas al servidor.
     */
    if (leerSesion() && empresasVisibles().length === 0) {
      void refrescarSesion()
        .catch(() => undefined)
        .then(() => {
          // Si el backend confirma que no tiene ninguna, ahi si corresponde
          // el onboarding.
          if (empresasVisibles().length === 0) {
            router.replace(esSuperAdmin() ? "/admin" : "/bienvenida");
            return;
          }
          setListo(true);
        });
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
        {/* Acompañamiento de los primeros 30 dias (2026-09-17). Se decide
            solo: si el negocio ya cumplio el mes, no se pinta. */}
        <BotonSoporte />
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
