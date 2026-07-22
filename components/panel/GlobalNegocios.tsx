"use client";

import { useEffect, useState } from "react";
import { guardarEmpresaActiva, leerEmpresaActiva, tieneVariosNegocios, EMPRESA_GLOBAL } from "@/lib/auth";
import { negociosGlobal, type NegocioBandeja } from "@/lib/api";

// Piezas del panel UNIFICADO (decisión 2026-07-22, iterada el mismo día): ya
// no existe "estar en una empresa" — el panel siempre muestra la operación
// completa y el NEGOCIO es un filtro dentro de cada módulo:
//
// 1. `BarraNegociosGlobal` — chips por negocio (con "Todos" opcional) para
//    las secciones por recurso y las bandejas.
// 2. `SeccionPorNegocio` — wrapper para pantallas inherentemente de UN
//    negocio (Configuración, Equipo, Probar bot, Reportes): chips arriba y
//    el contenido se REMONTA (key) al cambiar de negocio, fijando la empresa
//    activa por debajo — los componentes internos siguen leyendo la empresa
//    activa como siempre, sin threading de tenant.
// 3. `useSeccionGlobal` — hook de las secciones por recurso (Flujos,
//    Anuncios, Comentarios, Publicar, Oportunidades): listado con tenant
//    explícito del negocio enfocado.

// Hook: la lista de negocios de captación del usuario + el negocio enfocado
// (arranca en el primero). Los restaurantes no aparecen (backend los filtra).
// `habilitado: false` evita el fetch.
export function useNegociosGlobal(habilitado = true) {
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [enfocado, setEnfocado] = useState<string>("");
  const [cargando, setCargando] = useState(habilitado);

  useEffect(() => {
    if (!habilitado) return;
    negociosGlobal().then((lista) => {
      setNegocios(lista);
      setEnfocado((prev) => prev || (lista[0]?.tenantId ?? ""));
      setCargando(false);
    });
  }, [habilitado]);

  return { negocios, enfocado, setEnfocado, cargando };
}

// Hook de las secciones por recurso. `modoGlobal` ya no depende de un modo
// elegido: es simplemente "¿este usuario tiene más de un negocio?" — la vista
// unificada es LA vista del panel.
export function useSeccionGlobal() {
  // Se resuelve en efecto (localStorage) para no romper la hidratación.
  const [modoGlobal, setModoGlobal] = useState(false);
  useEffect(() => setModoGlobal(tieneVariosNegocios()), []);
  const { negocios, enfocado, setEnfocado, cargando } = useNegociosGlobal(modoGlobal);

  return {
    modoGlobal,
    negocios,
    enfocado,
    setEnfocado,
    // ¿La página ya puede listar? (con un solo negocio: siempre; con varios:
    // cuando el negocio enfocado quedó resuelto)
    listaLista: !modoGlobal || (!cargando && enfocado !== ""),
    tenantLista: modoGlobal && enfocado ? enfocado : undefined,
    // Antes de navegar a una pantalla profunda por-negocio (editor de flujo,
    // conversación completa): fija el negocio enfocado como empresa activa.
    adoptar() {
      if (enfocado) guardarEmpresaActiva(enfocado);
    },
  };
}

export function BarraNegociosGlobal({
  negocios,
  enfocado,
  onElegir,
  todosLabel,
}: {
  negocios: NegocioBandeja[];
  enfocado: string;
  onElegir: (tenantId: string) => void;
  // Si viene, se antepone un chip "Todos" (tenantId = "") — para vistas que
  // pueden mostrar TODO junto (Seguimiento) además de enfocar un negocio.
  todosLabel?: string;
}) {
  // Con 0 o 1 negocio no hay nada que filtrar: la barra sería ruido.
  if (negocios.length < 2) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
        Elegí el negocio que querés mirar
      </p>
      <div className="flex flex-wrap gap-2">
        {todosLabel && (
          <button
            onClick={() => onElegir("")}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              enfocado === "" ? "bg-brasa text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {todosLabel}
          </button>
        )}
        {negocios.map((n) => (
          <button
            key={n.tenantId}
            onClick={() => onElegir(n.tenantId)}
            className={`shrink-0 rounded-chip px-4 py-2 text-[0.9rem] font-bold transition ${
              enfocado === n.tenantId ? "bg-brasa text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            {n.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Wrapper de pantallas por-negocio (Configuración, Equipo, Probar bot,
 * Reportes): chips arriba (solo con 2+ negocios de captación) y el contenido
 * se remonta con `key` al cambiar de negocio. El truco: fija la EMPRESA
 * ACTIVA antes de montar — los componentes internos (PlaybookEditor,
 * PanelCanales, etc.) siguen llamando a la API "como siempre" y les llega el
 * X-Tenant-Id correcto, sin pasarles tenant uno por uno.
 */
export function SeccionPorNegocio({ children }: { children: React.ReactNode }) {
  const { negocios, cargando } = useNegociosGlobal();
  const [tenant, setTenant] = useState("");

  useEffect(() => {
    if (cargando) return;
    const activa = leerEmpresaActiva();
    const valida =
      activa && activa !== EMPRESA_GLOBAL && negocios.some((n) => n.tenantId === activa);
    const elegido = valida ? (activa as string) : (negocios[0]?.tenantId ?? "");
    if (elegido) {
      guardarEmpresaActiva(elegido);
      setTenant(elegido);
    } else {
      // Sin negocios de captación (p.ej. solo restaurantes): se muestra el
      // contenido con la empresa activa que hubiera — comportamiento clásico.
      setTenant("__sin-captacion__");
    }
  }, [cargando, negocios]);

  if (!tenant) return null; // cargando la lista de negocios

  function elegir(t: string) {
    guardarEmpresaActiva(t);
    setTenant(t);
  }

  return (
    <div>
      {negocios.length > 1 && (
        <div className="mx-auto max-w-5xl px-5 pt-6 lg:px-8">
          <BarraNegociosGlobal negocios={negocios} enfocado={tenant} onElegir={elegir} />
        </div>
      )}
      <div key={tenant}>{children}</div>
    </div>
  );
}
