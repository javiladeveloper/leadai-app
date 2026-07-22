"use client";

import { useEffect, useState } from "react";
import { guardarEmpresaActiva, esModoGlobal } from "@/lib/auth";
import { negociosGlobal, type NegocioBandeja } from "@/lib/api";

// Piezas compartidas del MODO GLOBAL (decisión 2026-07-22): con "🌐 Vista
// global" elegida en el header, cada sección del panel muestra lo de TODOS los
// negocios de captación. Dos patrones:
//
// 1. `BarraNegociosGlobal` — secciones por recurso (Flujos, Anuncios,
//    Comentarios, Publicar, Oportunidades): chips para saltar entre negocios
//    sin salir del modo global; la página recarga su lista con el tenant del
//    chip elegido.
// 2. `PickerNegocio` — pantallas que son inherentemente de UN negocio
//    (Configuración, Equipo, Probar bot…): pide elegir el negocio y al
//    elegirlo SALE del modo global hacia esa empresa (recarga completa).

// Hook: la lista de negocios de captación del usuario + el negocio enfocado
// (arranca en el primero). Los restaurantes no aparecen (backend los filtra).
// `habilitado: false` evita el fetch (páginas fuera del modo global).
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

// Hook todo-en-uno para las secciones por recurso (Flujos, Anuncios,
// Comentarios, Publicar, Oportunidades) en modo global:
// - `tenantLista`: tenant a pasar a la función de listado (undefined fuera
//   del modo global o mientras los negocios cargan — la página debe esperar
//   con `listaLista`).
// - `adoptar()`: llamar ANTES de cualquier mutación (crear, activar,
//   responder…) — adopta el negocio enfocado como empresa activa ("clavado":
//   sale del modo global) para que las llamadas sin tenant explícito vayan al
//   negocio correcto.
export function useSeccionGlobal() {
  // esModoGlobal lee localStorage: solo en cliente (evita hydration mismatch).
  const [modoGlobal, setModoGlobal] = useState(false);
  useEffect(() => setModoGlobal(esModoGlobal()), []);
  const { negocios, enfocado, setEnfocado, cargando } = useNegociosGlobal(modoGlobal);

  return {
    modoGlobal,
    negocios,
    enfocado,
    setEnfocado,
    // ¿La página ya puede listar? (fuera del modo global: siempre; dentro:
    // cuando el negocio enfocado quedó resuelto)
    listaLista: !modoGlobal || (!cargando && enfocado !== ""),
    tenantLista: modoGlobal && enfocado ? enfocado : undefined,
    adoptar() {
      if (esModoGlobal() && enfocado) guardarEmpresaActiva(enfocado);
    },
  };
}

export function BarraNegociosGlobal({
  negocios,
  enfocado,
  onElegir,
}: {
  negocios: NegocioBandeja[];
  enfocado: string;
  onElegir: (tenantId: string) => void;
}) {
  if (negocios.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
        🌐 Vista global — elegí el negocio que querés mirar
      </p>
      <div className="flex flex-wrap gap-2">
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

// Pantallas de configuración/acción en modo global: elegir un negocio SALE
// del modo global hacia esa empresa (la pantalla vuelve a cargar con su
// X-Tenant-Id real).
export function PickerNegocio({ titulo }: { titulo: string }) {
  const { negocios, cargando } = useNegociosGlobal();

  function entrar(tenantId: string) {
    guardarEmpresaActiva(tenantId);
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">🌐 Vista global</p>
        <h2 className="mt-1 text-[1.2rem] font-bold text-tinta">{titulo}</h2>
        <p className="mt-1 text-[0.9rem] text-frio">
          Esta sección se trabaja negocio por negocio. Elegí con cuál entrar:
        </p>
        {cargando && <p className="mt-4 text-sm text-frio">Cargando tus negocios…</p>}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {negocios.map((n) => (
            <button
              key={n.tenantId}
              onClick={() => entrar(n.tenantId)}
              className="rounded-chip bg-brasa px-4 py-2.5 text-sm font-bold text-carta transition hover:bg-brasa-hondo"
            >
              {n.nombre}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
