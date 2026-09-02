"use client";

import { useState, useEffect, useRef } from "react";
import { conectarWhatsAppEmbedded } from "@/lib/api";
import { traducirErrorMeta } from "@/lib/errores-meta";

/**
 * El WhatsApp al que nos escriben cuando la conexión falla.
 *
 * Espejo de `WHATSAPP_SOPORTE` en el backend. Literal y no por env: es una
 * página del panel y `NEXT_PUBLIC_*` obliga a rebuild igual.
 */
const WHATSAPP_SOPORTE = "51986110558";

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
  /**
   * EN QUÉ PASO DEL FLUJO GUIADO ESTÁ (2026-08-30).
   *
   * `pregunta` averigua si su número ya vive en WhatsApp Business; `aviso` le
   * cuenta qué va a pedirle Meta antes de abrirlo. Los dos existen porque el
   * dueño NO es técnico: antes elegía a ciegas entre dos flujos y se topaba
   * con pantallas de Meta que parecían errores nuestros.
   */
  const [paso, setPaso] = useState<"pregunta" | "aviso">("pregunta");
  const [modo, setModo] = useState<"nuevo" | "coexistencia">("coexistencia");
  /**
   * El asistente de Meta anda mucho peor en el teléfono: abre ventanas, obliga
   * a salir de la app para buscar el código y vence la sesión si uno se
   * demora. No se bloquea — se avisa, que es distinto.
   */
  const [enCelular, setEnCelular] = useState(false);
  useEffect(() => {
    setEnCelular(/android|iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);
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

  // ── EL ERROR, TRADUCIDO Y CON LA SALIDA ─────────────────────────────────
  if (estado === "error") {
    const t = traducirErrorMeta(error);
    return (
      <div className="rounded-tarjeta bg-calor-suave px-4 py-3.5">
        <p className="text-sm font-bold text-calor-hondo">{t.titulo}</p>
        <ol className="mt-2 space-y-1.5">
          {t.pasos.map((p, i) => (
            <li key={p} className="flex gap-2 text-[0.84rem] text-tinta-2">
              <span className="font-bold text-calor">{i + 1}.</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {t.reintentable && (
            <button
              type="button"
              onClick={() => { setEstado("idle"); setError(""); setPaso("pregunta"); }}
              className="rounded-full bg-orbita px-5 py-2 text-sm font-semibold text-sobre-orbita transition hover:bg-orbita-hondo"
            >
              Intentar de nuevo
            </button>
          )}

          {/* EL "ESCRÍBENOS" AHORA TIENE DÓNDE (2026-08-31).
              Los pasos decían "escríbenos y lo resolvemos" sin dar número ni
              link: quien se traba acá —el caso de una clienta real que perdió
              dos días— quedaba leyendo una instrucción imposible de seguir.

              EL ERROR VIAJA EN EL MENSAJE. Un "no puedo conectar" no nos deja
              ayudar; con el código de Meta adentro sabemos qué pasó antes de
              responder, y el dueño no tiene que explicar algo que no entiende
              ni mandarnos una captura. */}
          <a
            href={`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(
              `Hola, no puedo conectar mi WhatsApp a LeadAI.

Me aparece: ${t.titulo}

Detalle: ${error || "sin detalle"}`,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-[#25d366] px-5 py-2 text-sm font-semibold text-white"
          >
            💬 Escríbenos
          </a>
        </div>
      </div>
    );
  }

  // ── PASO 1: ¿QUÉ NÚMERO ES? ─────────────────────────────────────────────
  //
  // ANTES SE ELEGÍA MAL Y NADIE SE ENTERABA (2026-08-30). El botón grande
  // abría el flujo de números NUEVOS, y la coexistencia —el caso de casi todo
  // negocio peruano, que ya usa WhatsApp Business en el celular— vivía abajo
  // como un link gris subrayado. Una clienta tocó el grande y chocó con "el
  // número ya está asociado a otra empresa", que en su cabeza significa que
  // LeadAI está roto.
  //
  // Ahora se pregunta ANTES de abrir nada: nadie tiene que adivinar cuál de
  // los dos flujos le toca.
  if (paso === "pregunta") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-tinta">
          {otroNumero
            ? "¿El otro número ya usa WhatsApp Business en el celular?"
            : "¿Ya usas WhatsApp Business en tu celular con ese número?"}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { setModo("coexistencia"); setPaso("aviso"); }}
            className="block w-full rounded-tarjeta bg-carta px-4 py-3 text-left ring-1 ring-linea transition hover:ring-orbita"
          >
            <span className="block text-sm font-bold text-tinta">Sí, ya lo uso</span>
            <span className="mt-0.5 block text-[0.82rem] text-frio">
              Lo conectamos sin borrar la app ni perder tus chats
            </span>
          </button>
          <button
            type="button"
            onClick={() => { setModo("nuevo"); setPaso("aviso"); }}
            className="block w-full rounded-tarjeta bg-carta px-4 py-3 text-left ring-1 ring-linea transition hover:ring-orbita"
          >
            <span className="block text-sm font-bold text-tinta">Es un número nuevo</span>
            <span className="mt-0.5 block text-[0.82rem] text-frio">
              Todavía no está en WhatsApp Business
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── PASO 2: QUÉ VA A PASAR ──────────────────────────────────────────────
  //
  // El asistente de Meta pide cuenta de Facebook, datos de empresa y verificar
  // el número. Sin aviso, cada una de esas pantallas se siente un error del
  // producto — y el dueño abandona en la primera que no entiende.
  return (
    <div className="space-y-3">
      <div className="rounded-tarjeta bg-arena/60 px-4 py-3.5">
        <p className="text-sm font-bold text-tinta">Ahora se abre el asistente de Meta</p>
        <p className="mt-1 text-[0.84rem] text-tinta-2">
          Es el trámite de WhatsApp, no de LeadAI. Te va a pedir:
        </p>
        {/* LOS DOS CAMINOS PIDEN COSAS DISTINTAS (2026-08-31). Coexistencia
            —el número que ya vive en su app— NO pide perfil de empresa, ni
            sitio web, ni verificación de negocio: solo el número, un código
            que le llega por WhatsApp, y confirmar desde su propia app. Listar
            los pasos del flujo largo para todos asustaba de más a quien iba a
            hacer el corto. */}
        <ul className="mt-2 space-y-1 text-[0.84rem] text-tinta-2">
          <li>• Entrar con tu cuenta de Facebook</li>
          {modo === "coexistencia" ? (
            <>
              <li>• Tu número de WhatsApp Business</li>
              <li>• Confirmar desde tu app, con un código que te llega por WhatsApp</li>
            </>
          ) : (
            <>
              <li>• Algunos datos de tu negocio</li>
              <li>• Verificar tu número con un código</li>
            </>
          )}
        </ul>
        <p className="mt-2 text-[0.82rem] text-frio">
          {modo === "coexistencia"
            ? "Son unos 2 minutos y se hace una sola vez. Tu app del celular sigue funcionando igual, con tus chats y tus contactos."
            : "Toma unos minutos y se hace una sola vez."}
        </p>
      </div>

      {/* EL CELULAR ES EL PEOR LUGAR PARA ESTO (2026-08-30): el asistente de
          Meta abre ventanas, obliga a cambiar de app para buscar el código y
          vence la sesión si uno se demora. No se bloquea a nadie: se avisa. */}
      {enCelular && (
        <p className="rounded-tarjeta bg-tibio-suave px-4 py-2.5 text-[0.82rem] text-tinta-2">
          Estás en el celular. Si puedes, hazlo desde una computadora: el
          asistente de Meta funciona mucho mejor ahí.
        </p>
      )}

      {/* EL AVISO DEL PROVEEDOR ANTERIOR (2026-08-31).
          Caso real: una clienta quedó dos días trabada porque su número ya
          estaba tomado por un servicio que había usado antes. Meta responde
          "no está asociado con la empresa que seleccionaste" y NO hay forma
          de averiguar cuál es —su API no deja consultar el dueño de un número
          ajeno—, así que se pregunta ANTES de que choque.

          Solo en coexistencia: un número nuevo no puede tener historia. */}
      {modo === "coexistencia" && (
        <p className="rounded-tarjeta bg-arena/60 px-4 py-2.5 text-[0.82rem] text-tinta-2">
          <strong className="font-semibold text-tinta">
            ¿Ya usaste este número con otro chatbot o CRM?
          </strong>{" "}
          Si contrataste antes un servicio de WhatsApp —aunque ya no lo
          uses— tienes que pedirle a ese proveedor que libere el número.
          Si no, Meta no nos deja conectarlo.
        </p>
      )}

      {/* LA PÁGINA DE FACEBOOK ES REQUISITO, Y NADIE LO SABE (2026-08-31).

          DIAGNOSTICADO CON DOS CASOS EN VIVO, mismo número: desde un portfolio
          CON página llegó hasta el último paso; desde uno SIN página, Meta
          cortó con un error genérico apenas puso el número. Se revisó el
          portfolio que fallaba y tenía 0 páginas, 0 cuentas publicitarias, 0
          WhatsApp.

          Y NO ERA LA VERIFICACIÓN, que es lo primero que uno supone: el
          portfolio que SÍ funcionó tampoco está verificado. Lo único que los
          separaba era la página.

          Meta lo documenta como prerrequisito de coexistencia, pero su error
          no lo dice: habla de la empresa seleccionada, así que el dueño busca
          el problema en su número —donde no está— y abandona.

          POR QUÉ VA ANTES Y NO EN EL ERROR: crear la página toma dos minutos
          si se sabe de antemano; descubrirlo después de fallar significa
          volver a empezar el trámite entero.

          TENER LA PÁGINA NO ALCANZA — TIENE QUE ESTAR DENTRO DEL PORTFOLIO
          (2026-09-02, caso Shiro: fanpage sí, portfolio no).

          Antes había DOS avisos que preguntaban "¿tenés página?" y "¿tenés
          portfolio?" como casillas independientes. Pero lo que Meta exige es la
          RELACIÓN entre las dos, y ahí se colaba el caso más caro:

            - quien NO tiene página la crea acá y queda bien;
            - quien SÍ la tiene lee "sí, tengo", saltea el aviso, crea el
              portfolio nuevo del paso siguiente —que NACE VACÍO— y cae en el
              mismo error genérico igual.

          Es exactamente lo que pasó con el portfolio de Guisella: las páginas
          existían, pero el portfolio tenía 0 — dos semanas trabada.

          Por eso ahora son tres avisos, uno por caso: no tengo página (éste),
          ya tengo página pero no portfolio (el de abajo), y no sé qué elegir
          cuando Meta me lo pida (el último). */}
      <div className="rounded-tarjeta bg-arena/60 px-4 py-2.5 text-[0.82rem] text-tinta-2">
        <strong className="font-semibold text-tinta">
          ¿Tu negocio tiene página de Facebook?
        </strong>{" "}
        Meta la pide para conectar WhatsApp. Si no tienes,{" "}
        <a
          href="https://www.facebook.com/pages/create"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-orbita underline"
        >
          créala acá
        </a>{" "}
        — es gratis y toma dos minutos. No hace falta publicar nada.
      </div>

      {/* AVISO APARTE PARA QUIEN YA TIENE PÁGINA — no un párrafo más largo.

          Al leerlo en pantalla, el aviso combinado quedaba en 62 palabras, y
          quien YA tiene fanpage (el caso Shiro) tenía que atravesar 30 sobre
          crear una página que ya tiene antes de llegar a lo suyo. En un trámite
          donde la gente abandona, el dato que le sirve no puede estar al final
          de un texto que arranca hablándole a otro.

          Separados, cada dueño lee el que le toca: el de arriba si no tiene
          página, éste si la tiene. */}
      <div className="rounded-tarjeta bg-arena/60 px-4 py-2.5 text-[0.82rem] text-tinta-2">
        <strong className="font-semibold text-tinta">
          ¿Ya tienes página pero nunca usaste Facebook para empresas?
        </strong>{" "}
        Tu página tiene que estar dentro de tu portfolio comercial — tenerla en
        tu Facebook personal no alcanza. Se agrega desde{" "}
        <a
          href="https://business.facebook.com/settings/pages"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-orbita underline"
        >
          Configuración → Páginas
        </a>{" "}
        del portfolio, con el botón “Agregar”.
      </div>

      {/* EL "PORTFOLIO COMERCIAL" NO SIGNIFICA NADA PARA UN DUEÑO (2026-08-31).

          Meta le pide elegir uno en medio del asistente, con esas dos palabras
          y sin explicación. Quien nunca usó Facebook para empresas no sabe qué
          es, si tiene uno, ni cuál elegir — y se traba en una pantalla que ni
          siquiera es nuestra.

          NO HAY QUE CONSTRUIR NADA para que pueda crearlo: el propio asistente
          ofrece "Crea un portfolio comercial" como primera opción de la lista.
          Lo que falta es que sepa que eso es normal y esperable.

          Y LA TRAMPA QUE ESTO EVITA: un portfolio recién creado nace VACÍO, sin
          página de Facebook. O sea que quien lo crea ahí mismo va derecho al
          error del aviso de arriba — a menos que cree la página primero, que es
          justo lo que este texto le dice.

          EL CASO QUE FALTABA (2026-09-02): "ya tengo fanpage, no tengo
          portfolio". Es el más común entre negocios con algo de recorrido —
          hicieron su página hace años y nunca tocaron Business Manager. Para
          ellos el portfolio nuevo NO resuelve solo: nace vacío igual, y su
          página sigue afuera. Les falta el paso de agregarla, que es el que
          este texto ahora nombra. */}
      <p className="px-1 text-[0.8rem] text-frio">
        Si Meta te pide elegir un <strong className="text-tinta-2">portfolio
        comercial</strong> y no tienes ninguno, elige “Crear uno nuevo”: es la
        carpeta donde Meta guarda las cosas de tu negocio. Ponle el nombre de tu
        negocio y, apenas lo crees,{" "}
        <strong className="text-tinta-2">agrega ahí tu página de Facebook</strong>{" "}
        — nace vacío, y sin la página adentro la conexión falla.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => conectar(modo)}
          disabled={estado === "abriendo" || estado === "conectando"}
          className="rounded-full bg-orbita px-5 py-2.5 text-sm font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
        >
          {estado === "conectando"
            ? "Conectando…"
            : estado === "abriendo"
              ? "Abriendo Meta…"
              : "Continuar"}
        </button>
        <button
          type="button"
          onClick={() => setPaso("pregunta")}
          disabled={estado === "abriendo" || estado === "conectando"}
          className="rounded-full px-4 py-2.5 text-sm font-semibold text-frio transition hover:text-tinta disabled:opacity-60"
        >
          Volver
        </button>
      </div>
      {estado === "cancelado" && (
        <p className="text-sm text-frio">
          Se cerró la ventana de Meta sin terminar. Puedes intentar de nuevo cuando quieras.
        </p>
      )}
    </div>
  );
}
