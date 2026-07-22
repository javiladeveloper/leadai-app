"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, guardarSesion, cerrarSesion, EMPRESA_GLOBAL } from "@/lib/auth";
import { misEmpresas } from "@/lib/api";
import { IconoChevron } from "@/components/Iconos";
import { CampanaAlertas } from "@/components/panel/CampanaAlertas";

// Header del panel UNIFICADO (decisión 2026-07-22): ya NO hay selector de
// empresa — el panel muestra siempre la operación completa y cada módulo
// filtra por negocio con sus propios chips. La "empresa activa" sigue
// existiendo por debajo (la fijan los chips de Configuración/Equipo/… y los
// "clavados" a pantallas profundas), pero dejó de ser un concepto visible.
// "＋ Agregar otro negocio" vive ahora en Configuración.
export function HeaderPanel() {
  const router = useRouter();

  // Higiene de la empresa activa interna: refresca la lista de empresas en la
  // sesión (membresías nuevas) y garantiza que la empresa activa guardada sea
  // una REAL (ni vacía ni el centinela "__global__" de la versión anterior) —
  // las pantallas profundas la siguen usando como default.
  useEffect(() => {
    misEmpresas().then((lista) => {
      if (lista.length === 0) return; // error o sin datos: conservar el cache
      const s = leerSesion();
      if (s) guardarSesion({ ...s, empresas: lista });
      const activa = leerEmpresaActiva();
      const valida = activa && activa !== EMPRESA_GLOBAL && lista.some((e) => e.tenantId === activa);
      if (!valida) guardarEmpresaActiva(lista[0].tenantId);
    });
  }, []);

  function salir() {
    cerrarSesion();
    router.replace("/");
  }

  // Búsqueda global (diseño Stitch): navega a Leads con el término; la bandeja
  // filtra por nombre/contacto/resumen.
  function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (q) router.push(`/leads?buscar=${encodeURIComponent(q)}`);
  }

  return (
    <header className="flex items-center gap-3 border-b border-linea bg-carta px-5 py-3">
      {/* Buscador (oculto en pantallas muy chicas para no apretar el header) */}
      <form onSubmit={buscar} className="hidden min-w-0 flex-1 sm:block sm:max-w-md">
        <input
          name="q"
          type="search"
          placeholder="🔍 Buscar leads o mensajes…"
          className="w-full rounded-chip bg-arena px-4 py-2 text-sm text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-brasa/40"
          aria-label="Buscar leads"
        />
      </form>
      <div className="ml-auto flex items-center gap-3">
        <CampanaAlertas />
        <button
          type="button"
          onClick={salir}
          className="flex items-center gap-1.5 text-sm font-medium text-frio hover:text-tinta"
        >
          Salir <IconoChevron className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
