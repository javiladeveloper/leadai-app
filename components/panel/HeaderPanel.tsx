"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { leerSesion, leerEmpresaActiva, guardarEmpresaActiva, guardarSesion, cerrarSesion, empresaInicial } from "@/lib/auth";
import { misEmpresas } from "@/lib/api";
import { vaciarCache } from "@/lib/cache-datos";
import { IconoChevron } from "@/components/Iconos";
import { CampanaAlertas } from "@/components/panel/CampanaAlertas";
import { useCapacidades } from "@/lib/modo-negocio";
import { BuscadorPanel } from "@/components/panel/BuscadorPanel";

// Header del panel UNIFICADO (decisión 2026-07-22): ya NO hay selector de
// empresa — el panel muestra siempre la operación completa y cada módulo
// filtra por negocio con sus propios chips. La "empresa activa" sigue
// existiendo por debajo (la fijan los chips de Configuración/Equipo/… y los
// "clavados" a pantallas profundas), pero dejó de ser un concepto visible.
// "＋ Agregar otro negocio" vive ahora en Configuración.
export function HeaderPanel() {
  const negocio = useCapacidades();
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
      // CON CUÁL ABRE EL PANEL (2026-09-22). Antes, si la activa no servía,
      // caía a `lista[0]` —el orden del backend— y el predeterminado que el
      // dueño fijó en Configuración no contaba acá. `empresaInicial` lo pone
      // primero; sin predeterminado conserva la activa válida como siempre.
      const inicial = empresaInicial(lista);
      if (inicial && inicial !== leerEmpresaActiva()) guardarEmpresaActiva(inicial);
    });
  }, []);

  function salir() {
    cerrarSesion();
    // Lo que el panel recordaba en memoria es de ESTA cuenta (2026-10-09).
    vaciarCache();
    router.replace("/");
  }

  return (
    <header className="flex items-center gap-3 bg-superficie-honda px-4 py-3 sm:px-5">
      {/* Buscador: visible también en el celular, va a la sección que el
          negocio tiene y sugiere mientras escribes (2026-10-09). Cada rubro
          le dice distinto a su gente —leads, clientes, pacientes, socios— y
          el texto viene del backend con el rubro. */}
      <BuscadorPanel
        placeholder={negocio?.vocabulario.buscar ?? "Buscar…"}
        tieneLeads={negocio?.capacidades.calificaLeads ?? true}
      />
      <div className="ml-auto flex shrink-0 items-center gap-3">
        <CampanaAlertas />
        <button
          type="button"
          onClick={salir}
          className="flex items-center gap-1.5 text-sm font-medium text-arena/70 transition hover:text-arena"
        >
          Salir <IconoChevron className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
