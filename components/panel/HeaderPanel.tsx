"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, cerrarSesion } from "@/lib/auth";
import { IconoChevron } from "@/components/Iconos";

// Header del panel: selector de empresa activa (Guisella maneja varias marcas)
// + menú de usuario (cerrar sesión).
export function HeaderPanel() {
  const router = useRouter();
  const sesion = leerSesion();
  const empresas = sesion?.empresas ?? [];
  const [activa, setActiva] = useState<string>("");

  useEffect(() => {
    const guardada = leerEmpresaActiva();
    setActiva(guardada ?? empresas[0]?.tenantId ?? "");
  }, [empresas]);

  function cambiarEmpresa(id: string) {
    setActiva(id);
    guardarEmpresaActiva(id);
    router.refresh();
  }

  function salir() {
    cerrarSesion();
    router.replace("/");
  }

  const nombreActiva = empresas.find((e) => e.tenantId === activa)?.nombre ?? "Elegí empresa";

  return (
    <header className="flex items-center justify-between border-b border-linea bg-carta px-5 py-3">
      <div className="relative">
        {empresas.length > 1 ? (
          <select
            value={activa}
            onChange={(e) => cambiarEmpresa(e.target.value)}
            className="rounded-lg border border-linea bg-arena/50 px-3 py-1.5 text-sm font-semibold text-tinta"
          >
            {empresas.map((e) => (
              <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
            ))}
          </select>
        ) : (
          <span className="text-sm font-semibold text-tinta">{nombreActiva}</span>
        )}
      </div>
      <button
        type="button"
        onClick={salir}
        className="flex items-center gap-1.5 text-sm font-medium text-frio hover:text-tinta"
      >
        Cerrar sesión <IconoChevron className="h-4 w-4" />
      </button>
    </header>
  );
}
