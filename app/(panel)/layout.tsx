"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion, esSuperAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/panel/Sidebar";
import { HeaderPanel } from "@/components/panel/HeaderPanel";
import { NavInferior } from "@/components/NavInferior";

// Shell del panel de escritorio: Sidebar fijo (lg+) + Header, contenido ancho.
// En mobile el sidebar se oculta y reaparece la NavInferior.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    // Red de seguridad: si el usuario no tiene ningún negocio, va al onboarding
    // — salvo que sea super admin, que va a su panel de plataforma.
    const sesion = leerSesion();
    if (sesion && sesion.empresas.length === 0) {
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
        <HeaderPanel />
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
        <div className="lg:hidden">
          <NavInferior />
        </div>
      </div>
    </div>
  );
}
