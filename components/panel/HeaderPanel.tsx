"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, guardarSesion, cerrarSesion, type EmpresaResumen } from "@/lib/auth";
import { misEmpresas } from "@/lib/api";
import { IconoChevron } from "@/components/Iconos";
import { CampanaAlertas } from "@/components/panel/CampanaAlertas";

// Header del panel: selector de empresa activa (Guisella maneja varias marcas)
// + menú de usuario (cerrar sesión).
export function HeaderPanel() {
  const router = useRouter();
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>(() => leerSesion()?.empresas ?? []);
  const [activa, setActiva] = useState<string>("");

  // La sesión cachea las empresas del momento del login → un negocio nuevo
  // (invitación, creado en otro lado) no aparecería. Refrescamos EN VIVO al
  // montar y actualizamos la sesión guardada.
  useEffect(() => {
    misEmpresas().then((lista) => {
      if (lista.length === 0) return; // error o sin datos: conservar el cache
      setEmpresas(lista);
      const s = leerSesion();
      if (s) guardarSesion({ ...s, empresas: lista });
    });
  }, []);

  useEffect(() => {
    const guardada = leerEmpresaActiva();
    setActiva(guardada ?? empresas[0]?.tenantId ?? "");
  }, [empresas]);

  function cambiarEmpresa(id: string) {
    if (id === "__nuevo__") {
      router.push("/bienvenida?agregar=1");
      return;
    }
    setActiva(id);
    guardarEmpresaActiva(id);
    // Reload completo: las pantallas fetchean en useEffect sin dependencia del
    // tenant activo, así que router.refresh() no alcanza para que re-fetcheen
    // con el nuevo X-Tenant-Id. Un reload total es aceptable en un panel.
    window.location.reload();
  }

  function salir() {
    cerrarSesion();
    router.replace("/");
  }

  return (
    <header className="flex items-center justify-between border-b border-linea bg-carta px-5 py-3">
      <div className="relative">
        <select
          value={activa}
          onChange={(e) => cambiarEmpresa(e.target.value)}
          className="rounded-lg border border-linea bg-arena/50 px-3 py-1.5 text-sm font-semibold text-tinta"
          aria-label="Elegí tu negocio"
        >
          {empresas.map((e) => (
            <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
          ))}
          <option value="__nuevo__">＋ Agregar otro negocio</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <CampanaAlertas />
        <button
          type="button"
          onClick={salir}
          className="flex items-center gap-1.5 text-sm font-medium text-frio hover:text-tinta"
        >
          Cerrar sesión <IconoChevron className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
