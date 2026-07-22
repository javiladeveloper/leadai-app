"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, guardarSesion, cerrarSesion, type EmpresaResumen } from "@/lib/auth";
import { misEmpresas } from "@/lib/api";
import { IconoChevron } from "@/components/Iconos";
import { CampanaAlertas } from "@/components/panel/CampanaAlertas";

// Header del panel: selector de empresa activa (Guisella maneja varias marcas)
// + menú de usuario (cerrar sesión).
export function HeaderPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [empresas, setEmpresas] = useState<EmpresaResumen[]>(() => leerSesion()?.empresas ?? []);
  const [activa, setActiva] = useState<string>("");
  // En /global el selector muestra "Vista global" — es un LUGAR, no una
  // empresa: la empresa activa guardada no cambia al entrar.
  const enGlobal = pathname === "/global";

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
    const elegida = guardada ?? empresas[0]?.tenantId ?? "";
    setActiva(elegida);
    // Sin empresa guardada, el selector mostraba la primera pero las llamadas a
    // la API podían ir con otro tenant: persistimos la elegida para alinearlos.
    if (!guardada && elegida) guardarEmpresaActiva(elegida);
  }, [empresas]);

  function cambiarEmpresa(id: string) {
    if (id === "__nuevo__") {
      router.push("/bienvenida?agregar=1");
      return;
    }
    if (id === "__global__") {
      // La vista global es una PÁGINA, no una empresa: navega sin tocar la
      // empresa activa guardada (al volver a elegir una empresa, todo sigue
      // donde estaba).
      router.push("/global");
      return;
    }
    setActiva(id);
    guardarEmpresaActiva(id);
    // Reload completo: las pantallas fetchean en useEffect sin dependencia del
    // tenant activo, así que router.refresh() no alcanza para que re-fetcheen
    // con el nuevo X-Tenant-Id. Un reload total es aceptable en un panel.
    // Desde /global, elegir una empresa te lleva a SU dashboard (Inicio).
    if (enGlobal) {
      window.location.href = "/inicio";
    } else {
      window.location.reload();
    }
  }

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
        <select
          value={enGlobal ? "__global__" : activa}
          onChange={(e) => cambiarEmpresa(e.target.value)}
          className="max-w-44 rounded-lg border border-linea bg-arena/50 px-3 py-1.5 text-sm font-semibold text-tinta"
          aria-label="Elegí tu negocio"
        >
          {/* Con 2+ negocios: la vista global es la primera opción */}
          {empresas.length > 1 && <option value="__global__">🌐 Vista global</option>}
          {empresas.map((e) => (
            <option key={e.tenantId} value={e.tenantId}>{e.nombre}</option>
          ))}
          <option value="__nuevo__">＋ Agregar otro negocio</option>
        </select>
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
