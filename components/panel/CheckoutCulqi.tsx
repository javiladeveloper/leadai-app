"use client";

import { useEffect, useRef, useState } from "react";
import { iniciarRecarga } from "@/lib/api";
import { leerSesion } from "@/lib/auth";
import { soles } from "@/lib/precio";

// Checkout de Culqi (pasarela de pago, Perú) para cobrar una recarga de hits.
//
// Versión asumida: Culqi.js "checkout v4" clásico (el widget que se cuelga de
// `window.Culqi`, no el paquete npm `CulqiCheckout`). Este es el patrón
// documentado históricamente en https://docs.culqi.com — se carga un script
// global que expone `window.Culqi` con `.publicKey`, `.settings({...})`,
// `.open()` y `.close()`; el resultado (token o error) llega por el callback
// global `window.culqi`, leyendo `Culqi.token` / `Culqi.error`. Si al probar
// contra la doc vigente la API v4 difiere (p.ej. paquete `new CulqiCheckout(pk,
// {...})` con `.on('token', cb)`), ajustar acá — el resto del componente
// (estados, llamada a iniciarRecarga) no cambia.
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

const CULQI_PUBLIC_KEY = process.env.NEXT_PUBLIC_CULQI_PUBLIC_KEY ?? "";
const CULQI_SCRIPT_ID = "culqi-checkout-js";
const CULQI_SCRIPT_SRC = "https://checkout.culqi.com/js/v4";

type Estado = "idle" | "cargando-sdk" | "abriendo" | "procesando" | "ok" | "error" | "cancelado";

interface Props {
  hits: number; // unidad que el backend consume (se envía en la recarga)
  clientes?: number; // lo que ve el usuario (para textos); hits = clientes × 8
  montoCentavos: number;
  onExito: () => void;
}

export default function CheckoutCulqi({ hits, clientes, montoCentavos, onExito }: Props) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  const [sdkListo, setSdkListo] = useState(false);
  // Evita que un callback de un checkout viejo (usuario abrió, cerró sin
  // pagar, volvió a abrir) proceso un token que ya no corresponde al intento
  // activo.
  const intentoActivo = useRef(0);

  // Cargar el script de Culqi una sola vez (patrón igual al SDK de Facebook
  // en ConectarWhatsApp.tsx: script tag inline, guard por id).
  useEffect(() => {
    if (!CULQI_PUBLIC_KEY) return;
    if (window.Culqi) {
      setSdkListo(true);
      return;
    }
    if (document.getElementById(CULQI_SCRIPT_ID)) {
      // ya se está cargando (otra instancia del componente); esperar a poll.
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

  // Callback global que Culqi invoca al cerrar el checkout con un resultado
  // (token creado) o un error de validación de tarjeta. Se registra una vez
  // y lee el intento activo por closure sobre el ref (no sobre props viejas).
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
        // El usuario cerró el checkout sin completar el pago: no es un error.
        setEstado((prev) => (prev === "abriendo" ? "cancelado" : prev));
        return;
      }

      setEstado("procesando");
      const email = leerSesion()?.usuario.email ?? "";
      void iniciarRecarga(hits, email, token).then((r) => {
        // Si mientras tanto se lanzó otro intento (raro, pero por las dudas),
        // no pisamos su estado con el resultado de este.
        if (intentoActivo.current !== miIntento) return;
        if (r.ok) {
          setEstado("ok");
          onExito();
        } else {
          setEstado("error");
          setError(r.error ?? "No se pudo procesar el pago.");
        }
      });
    };
    // No limpiamos window.culqi al desmontar: si el checkout sigue abierto
    // (raro) y el componente se desmonta, preferimos un callback inerte a
    // uno undefined que rompa el SDK. Se sobreescribe en el próximo montaje.
  }, [hits, onExito]);

  function abrirCheckout() {
    if (!CULQI_PUBLIC_KEY || !window.Culqi) return;
    setError("");
    setEstado("abriendo");
    intentoActivo.current += 1;
    const culqi = window.Culqi;
    culqi.publicKey = CULQI_PUBLIC_KEY;
    culqi.settings({
      title: "LeadAI",
      currency: "PEN",
      amount: montoCentavos,
      description: clientes ? `${clientes.toLocaleString("es-PE")} clientes` : `${hits.toLocaleString("es-PE")} clientes`,
    });
    culqi.options?.({
      lang: "auto",
      installments: false,
      paymentMethods: {
        tarjeta: true,
        yape: true,
        bancaMovil: false,
        agente: false,
        billetera: false,
        cuotealo: false,
      },
    });
    culqi.open();
  }

  if (!CULQI_PUBLIC_KEY) {
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

  const cargandoBoton = estado === "abriendo" || estado === "procesando" || !sdkListo;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={abrirCheckout}
        disabled={cargandoBoton}
        className="w-full rounded-full bg-brasa px-5 py-3 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60"
      >
        {estado === "procesando"
          ? "Procesando pago…"
          : estado === "abriendo"
            ? "Abriendo pago…"
            : !sdkListo
              ? "Cargando pasarela…"
              : `Comprar ${soles(montoCentavos)}`}
      </button>
      {estado === "cancelado" && (
        <p className="text-sm text-frio">Pago cancelado. Podés intentarlo de nuevo cuando quieras.</p>
      )}
      {/* Error destacado (antes quedaba tapado por el widget de Culqi) */}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-calor-suave px-4 py-3">
          <p className="text-sm font-semibold text-calor-hondo">No se pudo completar el pago</p>
          <p className="mt-0.5 text-[0.82rem] text-tinta-2">{error}</p>
        </div>
      )}

      {/* Overlay de carga a pantalla completa: mientras se cobra con el backend,
          el widget de Culqi ya se cerró y sin esto quedaba sin feedback. */}
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
