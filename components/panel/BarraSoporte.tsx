"use client";

import { useSyncExternalStore } from "react";
import { leerModoSoporte, salirDeSoporte, type ModoSoporte } from "@/lib/auth";

/**
 * ESTÁS DENTRO DEL NEGOCIO DE OTRO (2026-08-27).
 *
 * Cuando el super admin entra a dar soporte, el panel se ve EXACTAMENTE igual
 * que el suyo: mismos menús, misma carta, mismos ajustes. Sin un aviso
 * permanente es cuestión de minutos olvidarse y creer que estás en tu negocio
 * — mirando datos de un cliente, o tocando su configuración.
 *
 * Por eso la barra es fija, va arriba de todo y no se puede cerrar: el día que
 * se pueda esconder, alguien la va a esconder. La salida está en la misma
 * barra, que es donde la vas a buscar.
 */
// Nada externo cambia el modo soporte mientras la pantalla vive: entrar y
// salir recargan la página entera a propósito. La suscripción existe porque
// la API la pide, y no tiene a qué engancharse.
function suscribir(): () => void {
  return () => {};
}

let cache: ModoSoporte | null = null;
let cacheLeido = false;

/** El snapshot tiene que ser estable entre renders o el componente cicla. */
function leerCacheado(): ModoSoporte | null {
  if (!cacheLeido) { cache = leerModoSoporte(); cacheLeido = true; }
  return cache;
}

export function BarraSoporte() {
  // `useSyncExternalStore` y no un efecto: localStorage es estado EXTERNO a
  // React. El snapshot del servidor es `null` —allá no existe— así que el
  // HTML inicial no trae la barra y aparece al hidratar, sin desajuste.
  //
  // El snapshot se cachea porque tiene que ser estable: devolver un objeto
  // nuevo en cada llamada haría re-renderizar para siempre.
  const modo = useSyncExternalStore(suscribir, leerCacheado, () => null);

  if (!modo) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-tinta px-4 py-2 text-carta">
      <p className="text-[0.85rem]">
        Estás en <b>{modo.nombre}</b>, que no es tuyo. Entraste como soporte.
      </p>
      <button
        type="button"
        onClick={() => {
          salirDeSoporte();
          // Recarga entera a propósito: media docena de pantallas ya trajeron
          // datos del negocio ajeno y siguen en memoria. Un router.push las
          // dejaría mezcladas con las tuyas.
          window.location.href = "/admin/negocios";
        }}
        className="rounded-chip bg-carta px-3 py-1 text-[0.78rem] font-bold text-tinta transition hover:opacity-90"
      >
        Salir
      </button>
    </div>
  );
}
