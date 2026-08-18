"use client";

import { useEffect, useRef, useState } from "react";

/**
 * La mecánica del checkout de Culqi, sin decidir qué se hace con el token.
 *
 * Se extrajo de CheckoutCulqi (2026-08-18) para poder cobrar TAMBIÉN la
 * suscripción a un plan: la carga del SDK, el callback global y el control de
 * intentos concurrentes son idénticos; lo único que cambia es qué se llama con
 * el token —una recarga de clientes o el alta de un plan—.
 *
 * Versión asumida: Culqi.js "checkout v4" clásico, el widget que se cuelga de
 * `window.Culqi`. El resultado llega por el callback global `window.culqi`,
 * leyendo `Culqi.token` / `Culqi.error`.
 */

declare global {
  interface Window {
    Culqi?: {
      publicKey: string;
      settings: (o: Record<string, unknown>) => void;
      options?: (o: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
      token?: { id: string } | null;
      order?: unknown;
      error?: { user_message?: string; merchant_message?: string } | null;
    };
    culqi?: () => void;
  }
}

export const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";
const CULQI_SCRIPT_ID = "culqi-checkout-js";
const CULQI_SCRIPT_SRC = "https://checkout.culqi.com/js/v4";

export type EstadoPago = "idle" | "abriendo" | "procesando" | "ok" | "error" | "cancelado";

// El nombre va en INGLÉS y con `use` a propósito, contra la convención del
// resto del código: React exige que los hooks empiecen con `use` para poder
// verificar las reglas de hooks. Con `usarCheckoutCulqi` el linter no puede
// distinguirlo de una función común y deja de avisar si se rompe una.
export function useCheckoutCulqi(opciones: {
  /** Qué hacer con el token de la tarjeta. Devuelve el error a mostrar, o null. */
  alTenerToken: (tokenId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Título y monto del widget. */
  titulo?: string;
}) {
  const [estado, setEstado] = useState<EstadoPago>("idle");
  const [error, setError] = useState("");
  const [sdkListo, setSdkListo] = useState(false);
  // Evita que el callback de un checkout viejo (el usuario abrió, cerró sin
  // pagar y volvió a abrir) pise el estado del intento activo.
  const intentoActivo = useRef(0);
  // El callback global se registra UNA vez pero tiene que ver siempre la
  // función más reciente: sin el ref, un cambio de plan dejaría el handler
  // apuntando al plan viejo.
  //
  // Se actualiza en un EFECTO y no durante el render: escribir un ref mientras
  // se renderiza rompe las garantías de React (y el linter lo marca).
  const alTenerTokenRef = useRef(opciones.alTenerToken);
  useEffect(() => {
    alTenerTokenRef.current = opciones.alTenerToken;
  });

  // Carga del script, una sola vez para toda la app.
  useEffect(() => {
    if (!CULQI_PUBLIC_KEY) return;
    if (window.Culqi) {
      setSdkListo(true);
      return;
    }
    if (document.getElementById(CULQI_SCRIPT_ID)) {
      // Ya lo está cargando otra instancia del componente: se espera.
      const t = setInterval(() => {
        if (window.Culqi) {
          setSdkListo(true);
          clearInterval(t);
        }
      }, 150);
      return () => clearInterval(t);
    }
    const s = document.createElement("script");
    s.id = CULQI_SCRIPT_ID;
    s.src = CULQI_SCRIPT_SRC;
    s.async = true;
    s.onload = () => setSdkListo(true);
    s.onerror = () => {
      setEstado("error");
      setError("No se pudo cargar la pasarela de pago. Revisá tu conexión y recargá.");
    };
    document.body.appendChild(s);
  }, []);

  // El callback que invoca Culqi al cerrar el widget.
  useEffect(() => {
    window.culqi = () => {
      const culqi = window.Culqi;
      if (!culqi) return;
      const miIntento = intentoActivo.current;

      if (culqi.error) {
        setEstado("error");
        setError(culqi.error.user_message ?? "Culqi rechazó la tarjeta. Probá con otra.");
        return;
      }

      const token = culqi.token?.id;
      if (!token) {
        // Cerró el widget sin completar: no es un error.
        setEstado((prev) => (prev === "abriendo" ? "cancelado" : prev));
        return;
      }

      setEstado("procesando");
      void alTenerTokenRef.current(token).then((r) => {
        if (intentoActivo.current !== miIntento) return;
        if (r.ok) {
          setEstado("ok");
        } else {
          setEstado("error");
          setError(r.error ?? "No se pudo procesar el pago.");
        }
      });
    };
    // No se limpia `window.culqi` al desmontar: si el widget quedó abierto,
    // preferimos un callback inerte a uno undefined que rompa el SDK.
  }, []);

  function abrir(config: { montoCentavos: number; descripcion: string }) {
    if (!CULQI_PUBLIC_KEY || !window.Culqi) return;
    setError("");
    setEstado("abriendo");
    intentoActivo.current += 1;
    const culqi = window.Culqi;
    culqi.publicKey = CULQI_PUBLIC_KEY;
    culqi.settings({
      title: opciones.titulo ?? "LeadAI",
      currency: "PEN",
      amount: config.montoCentavos,
      description: config.descripcion,
    });
    culqi.options?.({
      lang: "auto",
      installments: false,
      paymentMethods: {
        tarjeta: true,
        // Yape NO para suscripciones: el cobro recurrente necesita una tarjeta
        // guardada, y con Yape el mes que viene no habría de dónde cobrar.
        yape: false,
        bancaMovil: false,
        agente: false,
        billetera: false,
        cuotealo: false,
      },
    });
    culqi.open();
  }

  return { estado, error, sdkListo, abrir, hayLlave: Boolean(CULQI_PUBLIC_KEY), setEstado };
}
