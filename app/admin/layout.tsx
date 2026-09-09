"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, esSuperAdmin, leerSesion, cerrarSesion } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminNavInferior } from "@/components/admin/AdminNavInferior";
import Link from "next/link";

// Shell del panel de SUPER ADMIN (dueño de LeadAI). A diferencia del panel de
// negocios, NO exige tener una empresa: exige ser super admin. Un usuario normal
// que llegue acá se va a su panel; sin sesión, al login.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    if (!esSuperAdmin()) { router.replace("/inicio"); return; }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  const sesion = leerSesion();

  return (
    <div className="flex h-dvh bg-arena">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* El header se aprieta en móvil: el correo (largo) se esconde y en su
            lugar va la salida al panel de negocio, que en el celular vivía
            SOLO en el sidebar oculto (2026-09-09). */}
        <header className="flex items-center justify-between gap-3 border-b border-linea bg-carta px-4 py-3 lg:px-5">
          <span className="text-sm font-semibold text-tinta-2">Plataforma</span>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/inicio"
              className="text-xs font-semibold text-frio hover:text-tinta-2 lg:hidden"
            >
              ← Mi negocio
            </Link>
            <span className="hidden text-frio lg:inline">{sesion?.usuario?.email}</span>
            <button
              onClick={() => { cerrarSesion(); router.replace("/"); }}
              className="rounded-chip bg-arena px-3 py-1 font-semibold text-tinta-2 hover:bg-linea"
            >
              Salir
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
        <AdminNavInferior />
      </div>
    </div>
  );
}
