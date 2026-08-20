"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * La mecánica del checkout de Culqi, sin decidir qué se hace con el token.
 *
 * Se extrajo de CheckoutCulqi (2026-08-18) para poder cobrar TAMBIÉN la
 * suscripción a un plan: la carga del SDK, el callback y el control de
 * intentos concurrentes son idénticos; lo único que cambia es qué se llama con
 * el token —una recarga de clientes o el alta de un plan—.
 *
 * MIGRADO A CUSTOM CHECKOUT (2026-08-20). Antes usaba `checkout.culqi.com/js/v4`,
 * el widget global `window.Culqi` con callback en `window.culqi`. Dos razones
 * para el cambio, en este orden:
 *
 *  1. **v4 está descontinuado.** La documentación de Culqi dice que v2, v3 y v4
 *     ya no reciben soporte y que van a dejar de estar disponibles; la
 *     integración nueva va por Custom Checkout. Seguir ahí era construir sobre
 *     algo con fecha de vencimiento.
 *  2. **Se puede EMBEBER.** `modal: false` + `container` monta el formulario
 *     dentro de nuestra página en vez de abrir un popup encima. Un popup que
 *     aparece sobre la pantalla se siente como salir del producto justo en el
 *     paso donde el cliente decide si confía o no.
 *
 * Diferencias de API respecto de v4, para quien venga del código viejo:
 *  - Se INSTANCIA (`new CulqiCheckout(pk, config)`) en vez de configurar un
 *    global mutable. Cada intento tiene su propia instancia.
 *  - El callback va en la instancia (`instancia.culqi = fn`), no en
 *    `window.culqi`. Eso elimina la clase de bug que el `intentoActivo` del
 *    código viejo cuidaba: dos checkouts ya no comparten un handler.
 *  - El token se lee igual: `instancia.token.id`.
 */

interface InstanciaCulqi {
  open: () => void;
  close: () => void;
  token?: { id: string } | null;
  order?: unknown;
  error?: { user_message?: string; merchant_message?: string } | null;
  /** El callback que Culqi invoca al resolver el pago. */
  culqi?: () => void;
}

declare global {
  interface Window {
    CulqiCheckout?: new (publicKey: string, config: unknown) => InstanciaCulqi;
  }
}

export const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";
const CULQI_SCRIPT_ID = "culqi-checkout-js";
const CULQI_SCRIPT_SRC = "https://js.culqi.com/checkout-js";

/** Dónde se monta el formulario embebido. Lo dibuja quien usa el hook. */
export const CONTENEDOR_CULQI = "culqi-embebido";

export type EstadoPago = "idle" | "abriendo" | "procesando" | "ok" | "error" | "cancelado";

// El nombre va en INGLÉS y con `use` a propósito, contra la convención del
// resto del código: React exige que los hooks empiecen con `use` para poder
// verificar las reglas de hooks. Con `usarCheckoutCulqi` el linter no puede
// distinguirlo de una función común y deja de avisar si se rompe una.
export function useCheckoutCulqi(opciones: {
  /** Qué hacer con el token de la tarjeta. Devuelve el error a mostrar, o null. */
  alTenerToken: (tokenId: string) => Promise<{ ok: boolean; error?: string }>;
  /** Título del checkout. */
  titulo?: string;
  /**
   * `true` abre el popup de siempre; por defecto el formulario se monta
   * DENTRO de la página, en `CONTENEDOR_CULQI`.
   */
  modal?: boolean;
}) {
  const [estado, setEstado] = useState<EstadoPago>("idle");
  const [error, setError] = useState("");
  const [sdkListo, setSdkListo] = useState(false);

  // La instancia viva, para poder cerrarla al desmontar: un formulario
  // embebido que queda montado tras cambiar de pestaña deja nodos huérfanos
  // dentro de un contenedor que ya no existe.
  const instancia = useRef<InstanciaCulqi | null>(null);

  // El callback tiene que ver siempre la función más reciente: sin el ref, un
  // cambio de plan dejaría el handler apuntando al plan viejo.
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
    if (window.CulqiCheckout) {
      setSdkListo(true);
      return;
    }
    if (document.getElementById(CULQI_SCRIPT_ID)) {
      // Ya lo está cargando otra instancia del componente: se espera.
      const t = setInterval(() => {
        if (window.CulqiCheckout) {
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
      setError("No se pudo cargar la pasarela de pago. Revisa tu conexión y recarga.");
    };
    document.body.appendChild(s);
  }, []);

  // Al desmontar se cierra lo que haya quedado abierto.
  useEffect(() => {
    return () => {
      try {
        instancia.current?.close();
      } catch {
        // Si el SDK ya se fue, no hay nada que cerrar.
      }
      instancia.current = null;
    };
  }, []);

  const abrir = useCallback(
    (config: { montoCentavos: number; descripcion: string; email?: string }) => {
      if (!CULQI_PUBLIC_KEY || !window.CulqiCheckout) return;
      setError("");
      setEstado("abriendo");

      // Una instancia POR INTENTO: el usuario que abre, cierra sin pagar y
      // vuelve a abrir necesita un formulario limpio. Se cierra la anterior
      // para no dejar dos montados en el mismo contenedor.
      try {
        instancia.current?.close();
      } catch {
        // Nada que cerrar.
      }

      const embebido = opciones.modal !== true;
      const culqi = new window.CulqiCheckout(CULQI_PUBLIC_KEY, {
        // `settings` NO acepta `description` (2026-08-20): Custom Checkout lo
        // rechaza con `ValidationError: "description" is not allowed` y no
        // monta NADA — el contenedor queda vacío sin más pista que ese log.
        // Era un resto de v4, donde sí existía.
        settings: {
          title: opciones.titulo ?? "LeadAI",
          currency: "PEN",
          amount: config.montoCentavos,
        },
        ...(config.email ? { client: { email: config.email } } : {}),
        options: {
          lang: "auto",
          installments: false,
          modal: !embebido,
          // `container` solo tiene sentido embebido; en modal se ignora.
          ...(embebido ? { container: `#${CONTENEDOR_CULQI}` } : {}),
          paymentMethods: {
            tarjeta: true,
            // Yape NO para suscripciones: el cobro recurrente necesita una
            // tarjeta guardada, y con Yape el mes que viene no habría de dónde
            // cobrar.
            yape: false,
            bancaMovil: false,
            agente: false,
            billetera: false,
            cuotealo: false,
          },
        },
        appearance: {
          theme: "default",
          // Sin logo de Culqi: el dueño le está pagando a LeadAI, y una marca
          // ajena en el paso del cobro confunde sobre a quién le paga.
          hiddenCulqiLogo: true,
          buttonCardPayText: "Pagar ahora",
        },
      });

      culqi.culqi = () => {
        if (culqi.token?.id) {
          const token = culqi.token.id;
          setEstado("procesando");
          try {
            culqi.close();
          } catch {
            // El embebido puede no tener nada que cerrar.
          }
          void alTenerTokenRef.current(token).then((r) => {
            // Solo manda el intento vivo: si el usuario abrió otro checkout
            // mientras este resolvía, el viejo no pisa el estado.
            if (instancia.current !== culqi) return;
            if (r.ok) {
              setEstado("ok");
            } else {
              setEstado("error");
              setError(r.error ?? "No se pudo procesar el pago.");
            }
          });
          return;
        }

        if (culqi.error) {
          setEstado("error");
          setError(culqi.error.user_message ?? "Culqi rechazó la tarjeta. Prueba con otra.");
          return;
        }

        // Cerró sin completar: no es un error.
        setEstado((prev) => (prev === "abriendo" ? "cancelado" : prev));
      };

      instancia.current = culqi;
      culqi.open();
    },
    [opciones.modal, opciones.titulo],
  );

  /** Desmonta el formulario embebido (al cancelar, o al cerrar la hoja). */
  const cerrar = useCallback(() => {
    try {
      instancia.current?.close();
    } catch {
      // Nada que cerrar.
    }
    instancia.current = null;
    setEstado("idle");
    setError("");
  }, []);

  return {
    estado,
    error,
    sdkListo,
    abrir,
    cerrar,
    hayLlave: Boolean(CULQI_PUBLIC_KEY),
    setEstado,
  };
}
