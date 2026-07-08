"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
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
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="flex min-h-dvh bg-arena">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderPanel />
        <main className="flex-1 overflow-x-hidden">{children}</main>
        <div className="lg:hidden">
          <NavInferior />
        </div>
      </div>
    </div>
  );
}
