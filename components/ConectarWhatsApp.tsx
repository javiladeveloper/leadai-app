"use client";

import { useState, useEffect, useRef } from "react";
import { conectarWhatsAppEmbedded } from "@/lib/api";

// Tipos mínimos del SDK de Facebook en window.
declare global {
  interface Window {
    FB?: {
      init: (o: Record<string, unknown>) => void;
      login: (
        cb: (r: { authResponse?: { code?: string } }) => void,
        o: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID ?? "";

type Estado = "idle" | "abriendo" | "conectando" | "ok" | "error" | "cancelado";

// Valida que el origin del postMessage sea realmente un subdominio de facebook.com
// (un simple `includes("facebook.com")` deja pasar hosts como facebook.com.evil.io).
function origenConfiable(origin: string): boolean {
  try {
    const h = new URL(origin).hostname;
    return h === "facebook.com" || h.endsWith(".facebook.com");
  } catch {
    return false;
  }
}

export default function ConectarWhatsApp({
  onConectado,
  otroNumero = false, // ya hay número(s) conectado(s): el botón pasa a secundario
}: {
  onConectado?: () => void;
  otroNumero?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  // Datos que el popup entrega vía postMessage (wabaId/phoneNumberId).
  /**
   * Los datos del Embedded Signup en una REF, no en estado (2026-08-18).
   *
   * El callback de FB.login CIERRA SOBRE EL RENDER en el que se creó: con
   * `useState` leía siempre el objeto vacío del primer render y el backend
   * recibía el code SIN wabaId. El síntoma es "No se pudo resolver la cuenta
   * de WhatsApp (WABA) del token (scopes: ninguno)".
   *
   * Es el mismo bug que Sania encontró y arregló (ai-clinic-dashboard,
   * `embedded-signup-waba.test.ts`); este componente ya usaba una ref para el
   * redirectUri por la misma razón, y el waba_id se había quedado en estado.
   */
  const sesionES = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  // redirect_uri exacto con el que el SDK abrió el diálogo: Meta exige ese
  // MISMO valor al canjear el code en el backend (error 100 si no coincide).
  // Ref (no estado): el callback de FB.login cierra sobre el render viejo.
  const redirectUriDialogo = useRef<string>("");

  // Cargar el SDK de Facebook una vez.
  useEffect(() => {
    if (window.FB || document.getElementById("fb-sdk")) return;
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: true, version: "v21.0" });
    };
    const s = document.createElement("script");
    s.id = "fb-sdk";
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.onerror = () => {
      setEstado("error");
      setError("No se pudo cargar el conector de Meta. Revisa tu conexión y recarga.");
    };
    document.body.appendChild(s);

    // El Embedded Signup entrega wabaId/phoneNumberId por postMessage.
    const onMsg = (ev: MessageEvent) => {
      if (!origenConfiable(ev.origin)) return;
      try {
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type === "WA_EMBEDDED_SIGNUP" && d?.data) {
          // Se ACUMULA campo por campo: Meta manda varios eventos durante el
          // flujo y los últimos pueden venir incompletos. Pisar el objeto
          // entero borraría el waba_id que ya había llegado.
          if (d.data.waba_id) sesionES.current.wabaId = d.data.waba_id;
          if (d.data.phone_number_id) sesionES.current.phoneNumberId = d.data.phone_number_id;
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // modo "nuevo": número limpio (el flujo estándar). modo "coexistencia":
  // el número YA vive en la app de WhatsApp Business del celular y se conecta
  // SIN borrarla (featureType whatsapp_business_app_onboarding — el asistente
  // pide escanear un QR desde la app; el número sigue funcionando en ambos).
  function conectar(modo: "nuevo" | "coexistencia" = "nuevo") {
    if (!window.FB) { setEstado("error"); setError("El conector de Meta aún no cargó. Recarga la página."); return; }
    if (!CONFIG_ID) { setEstado("error"); setError("Falta configurar el conector de WhatsApp."); return; }
    setEstado("abriendo");
    setError("");
    // Se limpia antes de abrir: sin esto, un segundo intento arrastraría el
    // wabaId del primero y conectaría la cuenta equivocada.
    sesionES.current = {};
    // Capturar la URL del diálogo que abre el SDK para extraer su redirect_uri
    // (dinámico, apunta a xd_arbiter de Facebook). Se restaura window.open al toque.
    const openOriginal = window.open.bind(window);
    window.open = (...args: Parameters<typeof window.open>) => {
      const url = String(args[0] ?? "");
      if (url.includes("dialog/oauth")) {
        try {
          const ru = new URL(url).searchParams.get("redirect_uri");
          if (ru) redirectUriDialogo.current = ru;
        } catch { /* ignore */ }
        window.open = openOriginal;
      }
      return openOriginal(...args);
    };
    // OJO: el SDK de Facebook NO acepta un callback async ("Expression is of
    // type asyncfunction, not function"). El callback debe ser una función
    // normal; el trabajo async va adentro, en una función aparte.
    window.FB.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) { setEstado("cancelado"); return; }
        setEstado("conectando");
        void finalizarConexion(code, modo);
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: modo === "coexistencia" ? "whatsapp_business_app_onboarding" : "",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  async function finalizarConexion(code: string, modo: "nuevo" | "coexistencia") {
    const res = await conectarWhatsAppEmbedded({
      code,
      ...sesionES.current,
      ...(redirectUriDialogo.current ? { redirectUri: redirectUriDialogo.current } : {}),
      // Coexistencia: el backend salta /register (el número ya está registrado
      // del lado de Meta porque sigue viviendo en la app del celular).
      ...(modo === "coexistencia" ? { featureType: "whatsapp_business_app_onboarding" } : {}),
    });
    if (res.ok) { setEstado("ok"); onConectado?.(); }
    else {
      setEstado("error");
      // Si Meta nunca mandó el waba_id, el error del backend ("no se pudo
      // resolver la cuenta de WhatsApp") no le dice al dueño qué hacer. Se
      // traduce a la acción concreta.
      setError(
        !sesionES.current.wabaId
          ? "La conexión no llegó a completarse en la ventana de Meta. Prueba de nuevo y completa todos los pasos sin cerrarla."
          : (res.error ?? "No se pudo conectar."),
      );
    }
  }

  if (estado === "ok") {
    return <p className="text-sm font-medium text-ok">WhatsApp conectado ✅</p>;
  }

  // Sin la configuración de Meta el popup se abre y falla sin decir por qué
  // (2026-08-18): el dueño toca el botón, ve parpadear una ventana y queda sin
  // saber qué pasó. Mejor decirlo de frente.
  if (!APP_ID || !CONFIG_ID) {
    return (
      <div className="rounded-tarjeta bg-calor-suave px-4 py-3">
        <p className="text-sm font-semibold text-calor-hondo">
          Conectar WhatsApp todavía no está habilitado
        </p>
        <p className="mt-0.5 text-[0.82rem] text-tinta-2">
          Nos falta terminar la configuración con Meta. Escríbenos y lo activamos.
        </p>
        {/* El detalle técnico solo en desarrollo: al dueño no le sirve, y a
            quien está integrando le ahorra media hora de adivinar. */}
        {process.env.NODE_ENV === "development" && (
          <p className="mt-2 font-mono text-[0.72rem] text-frio">
            falta {!APP_ID && "NEXT_PUBLIC_META_APP_ID"}
            {!APP_ID && !CONFIG_ID && " y "}
            {!CONFIG_ID && "NEXT_PUBLIC_META_ES_CONFIG_ID"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => conectar("nuevo")}
        disabled={estado === "abriendo" || estado === "conectando"}
        // NARANJA y no `bg-ok` (2026-08-18): conectar WhatsApp es LA acción de
        // esta pantalla, y en la regla de los cuatro colores el naranja es
        // "hacé esto". `ok` es el verde de venta cerrada — acá no cerró nada
        // todavía, y además no es ninguno de los colores del logo.
        className={
          otroNumero
            ? "rounded-full px-5 py-2 text-sm font-semibold text-calor ring-1 ring-orbita/40 transition hover:bg-orbita/10 disabled:opacity-60"
            : "rounded-full bg-orbita px-5 py-2.5 text-sm font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
        }
      >
        {estado === "conectando"
          ? "Conectando…"
          : estado === "abriendo"
            ? "Abriendo Meta…"
            : otroNumero
              ? "＋ Conectar otro número"
              : "Conectar WhatsApp"}
      </button>
      <button
        type="button"
        onClick={() => conectar("coexistencia")}
        disabled={estado === "abriendo" || estado === "conectando"}
        className="block text-left text-sm text-frio underline underline-offset-2 transition hover:text-tinta disabled:opacity-60"
      >
        ¿Ya usas WhatsApp Business en tu celular? Conéctalo sin borrar la app →
      </button>
      {estado === "cancelado" && <p className="text-sm text-frio">Conexión cancelada.</p>}
      {estado === "error" && <p className="text-sm text-brasa-texto">{error}</p>}
    </div>
  );
}
