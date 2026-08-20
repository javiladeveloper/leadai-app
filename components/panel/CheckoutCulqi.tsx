"use client";

import { useState } from "react";
import { iniciarRecarga } from "@/lib/api";
import { leerSesion } from "@/lib/auth";
import { soles } from "@/lib/precio";
import { useCheckoutCulqi, CONTENEDOR_CULQI } from "./useCheckoutCulqi";

/**
 * Cobrar una recarga de clientes con Culqi.
 *
 * SOBRE EL HOOK, Y EMBEBIDO (2026-08-20). Este componente tenía su PROPIA copia
 * del SDK v4 —carga del script, callback global `window.culqi`, control de
 * intentos— duplicando lo que `useCheckoutCulqi` ya hacía para el cobro de
 * planes. Dos copias del mismo flujo de pago es la peor clase de duplicación:
 * se arregla un bug en una y la otra sigue rota, y es por donde entra la plata.
 *
 * Ahora las dos van por el hook, que además migró a Custom Checkout: el
 * formulario se monta DENTRO de la página en vez de abrir un popup encima.
 */

interface Props {
  hits: number; // unidad que el backend consume (se envía en la recarga)
  clientes?: number; // lo que ve el usuario (para textos); hits = clientes × 8
  montoCentavos: number;
  onExito: () => void;
}

export default function CheckoutCulqi({ hits, clientes, montoCentavos, onExito }: Props) {
  // El formulario se monta recién cuando el dueño decide pagar: montarlo de
  // entrada llena la pantalla de campos de tarjeta antes de que haya elegido
  // cuánto comprar.
  const [pagando, setPagando] = useState(false);

  const { estado, error, sdkListo, abrir, cerrar, hayLlave } = useCheckoutCulqi({
    titulo: "LeadAI",
    alTenerToken: async (token) => {
      const email = leerSesion()?.usuario.email ?? "";
      const r = await iniciarRecarga(hits, email, token);
      if (r.ok) onExito();
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    },
  });

  function empezar() {
    setPagando(true);
    // El contenedor tiene que existir en el DOM antes de que Culqi lo busque.
    // `requestAnimationFrame` espera al repintado que lo monta.
    requestAnimationFrame(() =>
      abrir({
        montoCentavos,
        descripcion: `${(clientes ?? hits).toLocaleString("es-PE")} clientes`,
        email: leerSesion()?.usuario.email,
      }),
    );
  }

  function cancelar() {
    cerrar();
    setPagando(false);
  }

  if (!hayLlave) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded-full bg-arena-2 px-5 py-3 text-sm font-semibold text-frio disabled:cursor-not-allowed"
      >
        Pagos aún no disponibles
      </button>
    );
  }

  if (estado === "ok") {
    return <p className="text-sm font-medium text-ok">Pago aprobado, sumando tus clientes…</p>;
  }

  return (
    <div className="space-y-3">
      {!pagando && (
        <button
          type="button"
          onClick={empezar}
          disabled={!sdkListo}
          className="w-full rounded-full bg-brasa px-5 py-3 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99] disabled:opacity-60"
        >
          {!sdkListo ? "Cargando pasarela…" : `Comprar ${soles(montoCentavos)}`}
        </button>
      )}

      {/* EL FORMULARIO, EMBEBIDO. Culqi lo monta acá dentro (`container` apunta
          a este id). Se deja montado mientras dura el intento: desmontarlo a
          mitad del tipeo perdería lo que el dueño ya escribió. */}
      {pagando && (
        <div className="surge space-y-3">
          <div id={CONTENEDOR_CULQI} className="min-h-[26rem] rounded-tarjeta" />
          {estado !== "procesando" && (
            <button
              type="button"
              onClick={cancelar}
              className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {estado === "cancelado" && (
        <p className="text-sm text-frio">Pago cancelado. Puedes intentarlo de nuevo cuando quieras.</p>
      )}

      {estado === "error" && (
        <div className="fila-entra rounded-tarjeta bg-calor-suave px-4 py-3">
          <p className="text-sm font-semibold text-calor-hondo">No se pudo completar el pago</p>
          <p className="mt-0.5 text-[0.82rem] text-tinta-2">{error}</p>
        </div>
      )}

      {/* Overlay mientras el backend cobra: el formulario ya se cerró y sin
          esto el dueño queda sin señal de que algo está pasando. */}
      {estado === "procesando" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-tinta/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-carta px-8 py-7 shadow-[0_8px_24px_rgba(51,40,31,0.2)]">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-linea border-t-brasa" />
            <p className="text-sm font-semibold text-tinta">Procesando tu pago…</p>
            <p className="text-[0.78rem] text-frio">No cierres esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}
