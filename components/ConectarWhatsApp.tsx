"use client";

import { useState, useEffect } from "react";
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

export default function ConectarWhatsApp({ onConectado }: { onConectado?: () => void }) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState("");
  // Datos que el popup entrega vía postMessage (wabaId/phoneNumberId).
  const [sesionES, setSesionES] = useState<{ wabaId?: string; phoneNumberId?: string }>({});

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
      setError("No se pudo cargar el conector de Meta. Revisá tu conexión y recargá.");
    };
    document.body.appendChild(s);

    // El Embedded Signup entrega wabaId/phoneNumberId por postMessage.
    const onMsg = (ev: MessageEvent) => {
      if (!origenConfiable(ev.origin)) return;
      try {
        const d = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
        if (d?.type === "WA_EMBEDDED_SIGNUP" && d?.data) {
          setSesionES({ wabaId: d.data.waba_id, phoneNumberId: d.data.phone_number_id });
        }
      } catch { /* ignore */ }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  function conectar() {
    if (!window.FB) { setEstado("error"); setError("El conector de Meta aún no cargó. Recargá la página."); return; }
    if (!CONFIG_ID) { setEstado("error"); setError("Falta configurar el conector de WhatsApp."); return; }
    setEstado("abriendo");
    setError("");
    // OJO: el SDK de Facebook NO acepta un callback async ("Expression is of
    // type asyncfunction, not function"). El callback debe ser una función
    // normal; el trabajo async va adentro, en una función aparte.
    window.FB.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) { setEstado("cancelado"); return; }
        setEstado("conectando");
        void finalizarConexion(code);
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  async function finalizarConexion(code: string) {
    const res = await conectarWhatsAppEmbedded({ code, ...sesionES });
    if (res.ok) { setEstado("ok"); onConectado?.(); }
    else { setEstado("error"); setError(res.error ?? "No se pudo conectar."); }
  }

  if (estado === "ok") {
    return <p className="text-sm font-medium text-ok">WhatsApp conectado ✅</p>;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={conectar}
        disabled={estado === "abriendo" || estado === "conectando"}
        className="rounded-full bg-ok px-5 py-2.5 text-sm font-semibold text-carta transition hover:brightness-95 disabled:opacity-60"
      >
        {estado === "conectando" ? "Conectando…" : estado === "abriendo" ? "Abriendo Meta…" : "Conectar WhatsApp"}
      </button>
      {estado === "cancelado" && <p className="text-sm text-frio">Conexión cancelada.</p>}
      {estado === "error" && <p className="text-sm text-brasa">{error}</p>}
    </div>
  );
}
