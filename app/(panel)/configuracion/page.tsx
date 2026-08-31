"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion, leerEmpresaActiva, guardarEmpresaActiva, EMPRESA_GLOBAL } from "@/lib/auth";
import { EtapasEditor } from "@/components/panel/EtapasEditor";
import { PlaybookEditor } from "@/components/panel/PlaybookEditor";
import { AccionesDelBot } from "@/components/panel/AccionesDelBot";
import { RitmoSeguimiento } from "@/components/panel/RitmoSeguimiento";
import { HorarioEditor } from "@/components/panel/HorarioEditor";
import { PagosEditor } from "@/components/panel/PagosEditor";
import { LocalesEditor } from "@/components/panel/LocalesEditor";
import { PanelCanales } from "@/components/panel/PanelCanales";
import { QueRespondeElBot } from "@/components/panel/QueRespondeElBot";
import { Seccion } from "@/components/panel/Seccion";
import { ConsumoDeCuenta } from "@/components/panel/ConsumoDeCuenta";
import {
  HeroSeccion, BotIlustracion, CanalesIlustracion, PlanIlustracion, PerfilIlustracion,
} from "@/components/panel/HeroSeccion";
import { PlanConsumo } from "@/components/panel/PlanConsumo";
import { ConfigComision } from "@/components/panel/ConfigComision";
import { MiPerfilVendedorPanel } from "@/components/panel/MiPerfilVendedor";
import { BarraNegociosGlobal } from "@/components/panel/GlobalNegocios";
import { useCapacidadesOptimista, type Capacidades } from "@/lib/modo-negocio";
import { empresasVisibles } from "@/lib/auth";
import type { NegocioBandeja } from "@/lib/api";

// Configuración del panel unificado (decisión 2026-07-22): TODO lo
// configurable vive acá. Las pestañas de NEGOCIO (Tu negocio / Canales /
// Plan) llevan chips para elegir cuál configurar — elegir un chip fija la
// empresa activa por debajo y REMONTA el contenido (key), así los
// componentes internos recargan con el X-Tenant-Id correcto sin threading.
// La pestaña "Mi perfil" es de la PERSONA (dueña de la cuenta): sin chips.
// El "＋ Agregar otro negocio" también vive acá (antes estaba en el selector
// del header, que ya no existe).
type Tab = "negocio" | "bot" | "canales" | "plan" | "perfil";

// La BAJADA cambia con la pestaña (2026-08-18): una sola frase genérica no
// dice nada, y "Mi perfil" traía la suya en un segundo encabezado propio.
// EL BOT TIENE SU PROPIA ZONA (2026-08-27, Jonathan: "siento que el bot tiene
// demasiadas configuraciones... podríamos agregar una zona específica para
// configuración del BOT, cosa que no mezclemos todo en TU NEGOCIO").
//
// Estaba todo junto y peor: "Qué responde tu bot" vivía en CANALES, así que
// para entender cómo contesta había que mirar en dos pestañas distintas.
//
// Ahora: "Tu negocio" son los DATOS (horarios, pagos, locales) y "El bot" es
// CÓMO ATIENDE (playbook, qué responde, etapas, seguimiento).
const TABS: { id: Tab; label: string; corta: string; bajada: string; requiere?: keyof Capacidades }[] = [
  { id: "negocio", label: "Tu negocio", corta: "Horarios y pagos", bajada: "Los datos de tu negocio: horarios, cómo cobras y tus locales." },
  { id: "bot", label: "El bot", corta: "Cómo atiende", bajada: "Cómo atiende, qué responde y cuándo hace seguimiento." },
  { id: "canales", label: "Canales", corta: "Por dónde te escriben", bajada: "Conecta tus redes para que LeadAI atienda en cada una." },
  { id: "plan", label: "Plan y consumo", corta: "Cuánto llevas usado", bajada: "Cuánto llevas usado este mes y qué empresa consume más." },
  // "Mi perfil" es el CV del VENDEDOR del marketplace —foto, años de
  // experiencia, ventas cerradas, rubros en los que sos bueno, experiencia
  // profesional— y su propia bajada lo dice: "así te ven los negocios que
  // buscan vendedores".
  //
  // Un restaurante no se ofrece como vendedor de nadie (2026-08-19, reporte de
  // Jonathan: "tiene cosas que no vienen al caso"). De sus 16 campos le
  // servirían cinco, y el resto —LinkedIn, portfolio, mini-CV— es ruido en la
  // pantalla donde configura su negocio.
  { id: "perfil", label: "Mi perfil", corta: "Tu CV de vendedora", bajada: "Así te ven los negocios que buscan vendedores.", requiere: "calificaLeads" },
];

function ConfiguracionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [listo, setListo] = useState(false);
  const [tab, setTab] = useState<Tab>("negocio");
  // TODOS los negocios del usuario (sesión), no solo captación: un
  // restaurante también configura sus canales/plan desde acá (decisión
  // 2026-07-22: el recorte a captación es solo para AGRUPAR bandejas).
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  const [tenantCfg, setTenantCfg] = useState("");
  // Restaurante activo → la pestaña "Tu negocio" se queda con lo que su bot
  // usa de verdad; el pipeline de captación (etapas, ritmo) no se muestra.
  // Optimista: mientras no se sabe se muestran las secciones y después se
  // ocultan las que no aplican. Al revés —aparecer de golpe— es el
  // parpadeo que Jonathan reportó.
  const caps = useCapacidadesOptimista();

  useEffect(() => {
    setNegocios(
      empresasVisibles().map((e) => ({ tenantId: e.tenantId, nombre: e.nombre })),
    );
  }, []);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  // /configuracion?tab=perfil (redirección de la vieja /mi-perfil).
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "perfil" || t === "canales" || t === "plan" || t === "negocio") setTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (negocios.length === 0 || tenantCfg) return;
    const activa = leerEmpresaActiva();
    const valida =
      activa && activa !== EMPRESA_GLOBAL && negocios.some((n) => n.tenantId === activa);
    const elegido = valida ? (activa as string) : negocios[0].tenantId;
    guardarEmpresaActiva(elegido);
    setTenantCfg(elegido);
  }, [negocios, tenantCfg]);

  function elegirNegocio(t: string) {
    guardarEmpresaActiva(t);
    setTenantCfg(t);
  }

  if (!listo) return null;

  const tabDeNegocio = tab !== "perfil";
  /**
   * LOS CHIPS DE NEGOCIO NO VAN EN PLAN (2026-08-27, Jonathan: "si estoy en
   * plan y consumo no debería aparecerme elige tu negocio").
   *
   * Tiene razón: el consumo es de la CUENTA —el panorama de arriba suma todas
   * sus empresas— así que pedirle que elija una antes de mostrárselo contesta
   * la pregunta equivocada. El detalle por negocio de abajo trae su propio
   * selector, que es donde sí corresponde elegir.
   */
  const eligeNegocioArriba = tabDeNegocio && tab !== "plan";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ajustes</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Configuración</h1>
          {/* Una bajada, como en Carta: el H1 solo no dice qué se hace acá. */}
          <p className="mt-1 text-[0.92rem] text-frio">
            {TABS.find((t) => t.id === tab)?.bajada}
          </p>
        </div>
        <button
          onClick={() => router.push("/bienvenida?agregar=1")}
          className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
        >
          ＋ Agregar otro negocio
        </button>
      </header>

      {/* PESTAÑAS COMO TARJETAS (2026-08-27, mismo criterio que Marketing).
          Eran cinco chips de texto en una fila con scroll: en celular había
          que adivinar que existían las de la derecha, y "Tu negocio" vs "El
          bot" no se distinguen por el nombre. Con icono y una frase, se elige
          por lo que se busca hacer. */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5" role="tablist">
        {TABS.filter((x) => !x.requiere || caps[x.requiere]).map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-start gap-2 rounded-tarjeta p-3.5 text-left transition ${
                activa
                  ? "bg-superficie-honda text-arena shadow-[var(--sombra-tarjeta)]"
                  : "bg-carta text-tinta-2 ring-1 ring-linea hover:bg-arena/60"
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full ${
                  activa ? "bg-arena/15 text-arena" : "bg-brasa/12 text-brasa-texto"
                }`}
                aria-hidden
              >
                <IconoTab id={t.id} />
              </span>
              <span className="min-w-0">
                <span className={`block text-[0.92rem] font-bold ${activa ? "text-arena" : "text-tinta"}`}>
                  {t.label}
                </span>
                <span className={`mt-0.5 block text-[0.78rem] ${activa ? "text-arena/70" : "text-frio"}`}>
                  {t.corta}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Chips de negocio — solo donde la pantalla es DE un negocio. */}
      {eligeNegocioArriba && (
        <BarraNegociosGlobal negocios={negocios} enfocado={tenantCfg} onElegir={elegirNegocio} />
      )}

      {/* Contenido. Las pestañas de negocio esperan a que el negocio esté
          resuelto y se remontan (key) al cambiarlo. */}
      {tabDeNegocio && !tenantCfg && null}
      {tabDeNegocio && tenantCfg && (
        /* SIN tarjeta contenedora (2026-08-18). Antes esto era una <section>
           blanca y adentro cada bloque era OTRA tarjeta blanca con borde: tres
           capas de la misma superficie, y nada con más peso que lo demás. Cada
           bloque es ahora su propia tarjeta sobre el fondo arena, como en Carta.

           Los <h2> "Tu negocio" / "Tus redes" / "Tu plan y consumo" también se
           fueron: repetían la pestaña activa, que está tres centímetros arriba. */
        // `key` con la pestaña: al cambiarla el bloque se remonta y la
        // animación corre de nuevo. Sin eso, cambiar de pestaña es un corte
        // seco y no se ve que el contenido es OTRO.
        <div key={`${tenantCfg}-${tab}`} className="surge space-y-5">
          {/* EL HERO DE CADA PESTAÑA (2026-08-27, Jonathan: "esa ventana se ve
              horrible, plana, sin vida... pon animaciones, imágenes, sé más
              creativo, para cada uno: canales, plan y consumo, perfil"). */}
          {tab === "bot" && (
            <HeroSeccion
              titulo="Tu bot ya sabe atender: dile cómo hacerlo"
              bajada={<>Lee todo lo que pongas acá para responder por ti a cualquier hora, en tus palabras y con tus reglas.</>}
              nota="Lo que no le digas, no lo inventa: prefiere derivarte la consulta."
              dibujo={<BotIlustracion />}
            />
          )}
          {tab === "canales" && (
            <HeroSeccion
              titulo="Todo lo que te escriben, en una sola bandeja"
              bajada={<>Conecta WhatsApp, Instagram o Facebook y los mensajes de las tres caen en el mismo lugar, atendidos por tu bot.</>}
              nota="Cada red se conecta una vez y queda andando."
              dibujo={<CanalesIlustracion />}
            />
          )}
          {tab === "plan" && (
            <HeroSeccion
              titulo="Cuánto llevas usado este mes"
              bajada={<>Tu plan alcanza para todas tus empresas juntas. Acá ves cuánto va y cuál de ellas consume más.</>}
              dibujo={<PlanIlustracion />}
            />
          )}
          {tab === "negocio" && (
            <>
              {/* SOLO LA IDENTIDAD (2026-08-30, Jonathan: "toooooda esta
                  configuración debe estar en la sección bot").

                  Historia corta: el 27 mandé el playbook ENTERO al Bot y "Tu
                  negocio" quedó vacío para captación, así que lo traje entero
                  de vuelta — y quedó peor, porque adentro convivían el nombre
                  del negocio con las objeciones del bot.

                  El corte que faltaba: si cambiarlo cambia lo que el bot DICE,
                  es del bot. Acá quedan el nombre y el rubro (identidad); el
                  tono, qué vende, preguntas clave, señales y objeciones se
                  editan en la pestaña Bot. Nada queda vacío y cada cosa está
                  donde uno la busca. */}
              <PlaybookEditor parte="identidad" />
              {/* LAS ETAPAS NO SON DEL BOT (2026-08-27, Jonathan: "etapas del
                  embudo yo creo que no iría en el bot").
                  Tiene razón, y la auditoría lo confirma: `etapasEmbudo` solo
                  lo leen el panel y los reportes — el motor sigue con sus 5
                  estados internos. Renombrar o recolorear una etapa no cambia
                  NADA de lo que el bot dice. Es cómo se ve TU tablero.

                  Un restaurante no las usa: sus pedidos avanzan solos
                  (armando → pagado → cocina), y mostrárselas era ruido. */}
              {caps.tieneEmbudo && <EtapasEditor />}
              {/* El horario solo existía en la app móvil: un dueño en la
                  computadora no podía cerrar su cocina sin buscar el celular
                  (2026-08-19). Va detrás de `tieneCocina` porque un negocio de
                  captación no tiene cocina que abrir ni cerrar. */}
              {caps.tieneCocina && <HorarioEditor />}
              {/* A dónde le pagan. Solo se editaba desde la app, y sin número
                  cargado el bot no puede cobrarle a nadie: el pedido llega al
                  pago y muere ahí (2026-08-19). */}
              {caps.validaPagos && <PagosEditor />}
            </>
          )}

          {tab === "bot" && (
            <>
              {/* QUÉ HACE EL BOT, ANTES DE CÓMO LO DICE (2026-08-30, Jonathan:
                  "te pueden escribir que agende citas... eso el bot no lo
                  hace"). Lista cerrada y NO editable: las capacidades no
                  pueden salir de un campo de texto, porque equivocarse ahí es
                  prometerle al cliente algo que no va a pasar. */}
              <Seccion
                titulo="Qué hace tu bot"
                bajada="Esto es lo que sabe hacer solo. Lo que todavía no, te lo pasa a ti."
                tono="hondo"
              >
                <AccionesDelBot />
              </Seccion>
              {/* Y ACÁ, CÓMO LO DICE. Tono, por qué elegirte, qué vendes,
                  preguntas clave, señales y objeciones. El nombre y el rubro se
                  quedaron en "Tu negocio": son identidad, no guion. */}
              <PlaybookEditor parte="guion" />
              {/* "QUÉ RESPONDE TU BOT" SE MUDÓ DE CANALES (2026-08-27). Estaba
                  ahí porque se agregó pensando en el momento de conectar el
                  WhatsApp, pero es lo que MÁS habla del bot: buscarlo en la
                  pestaña de las redes no se le ocurre a nadie. */}
              {caps.tieneCarta && (
                <Seccion
                  titulo="Qué responde tu bot"
                  bajada="Todo esto lo contesta solo, con los datos de tu negocio."
                  tono="hondo"
                >
                  <QueRespondeElBot />
                </Seccion>
              )}
              {/* CUÁNDO INSISTE, sí es del bot: el ritmo decide cada
                  cuánto vuelve a escribirle a un lead que no contestó.
                  (Las ETAPAS no están acá — ver el comentario en "Tu
                  negocio".) */}
              {caps.nutreLeads && <RitmoSeguimiento />}
            </>
          )}

          {tab === "canales" && (
            <>
              <Seccion
                titulo="Por dónde te escriben"
                bajada="Conecta tus redes para que LeadAI atienda por ti en cada una."
                tono="hondo"
              >
                <PanelCanales />
              </Seccion>

              {/* LOS LOCALES, JUNTO A LOS NÚMEROS (2026-08-25). Es donde el
                  dueño llega cuando quiere conectar el WhatsApp de su segundo
                  local — el aviso de arriba lo manda aquí. Solo para negocios
                  con cocina: una clínica no tiene locales que despachen. */}
              {caps.tieneCocina && (
                <Seccion
                  titulo="Tus locales"
                  bajada="Un negocio, varios locales: comparten carta y clientes, cada uno con su cocina."
                >
                  <LocalesEditor />
                </Seccion>
              )}

            </>
          )}

          {tab === "plan" && (
            <>
              {/* PRIMERO EL PANORAMA (2026-08-27): con varios negocios, "¿cuánto
                  llevo usado?" es una pregunta de la CUENTA, no de una empresa.
                  Con una sola empresa no se muestra — repetiría lo de abajo. */}
              <ConsumoDeCuenta />

              {/* Y RECIÉN ACÁ EL DETALLE de UN negocio, con su propio selector.
                  Los chips salieron de arriba (contestaban la pregunta
                  equivocada), pero sin nada que diga de cuál se está hablando,
                  las tarjetas de abajo son números sin dueño. */}
              {negocios.length > 1 && (
                <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
                  <p className="mb-2.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">
                    El detalle de un negocio
                  </p>
                  <BarraNegociosGlobal
                    negocios={negocios}
                    enfocado={tenantCfg}
                    onElegir={elegirNegocio}
                  />
                </div>
              )}
              <PlanConsumo />
              <ConfigComision />
            </>
          )}
        </div>
      )}

      {/* El gate también acá: entrar por `?tab=perfil` a mano no puede saltear
          lo que la pestaña esconde.

          El hero va en ESTE bloque y no arriba con los otros: aquel es solo
          para las pestañas de NEGOCIO, y "Mi perfil" es de la persona. */}
      {tab === "perfil" && caps.calificaLeads && (
        <div className="surge space-y-5">
          <HeroSeccion
            titulo="Así te ven los negocios que buscan vendedores"
            bajada={<>Tu experiencia, los rubros que manejas y lo que has cerrado. Es lo que mira una empresa antes de darte sus clientes.</>}
            dibujo={<PerfilIlustracion />}
          />
          <MiPerfilVendedorPanel />
        </div>
      )}
    </div>
  );
}

// useSearchParams exige Suspense en el prerender de Next (App Router).
export default function ConfiguracionPanel() {
  return (
    <Suspense fallback={null}>
      <ConfiguracionInner />
    </Suspense>
  );
}

/**
 * El icono de cada pestaña.
 *
 * SVG y no emoji: los emoji se ven distinto en cada teléfono y no toman el
 * color del tema. Estos heredan `currentColor`, así que cambian solos cuando
 * la pestaña queda activa.
 */
function IconoTab({ id }: { id: Tab }) {
  const c = "h-[18px] w-[18px]";
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "negocio") {
    return (
      <svg viewBox="0 0 24 24" className={c} {...p}>
        <path d="M3 21h18" />
        <path d="M5 21V8l7-5 7 5v13" />
        <path d="M10 21v-6h4v6" />
      </svg>
    );
  }
  if (id === "bot") {
    return (
      <svg viewBox="0 0 24 24" className={c} {...p}>
        <rect x="4" y="8" width="16" height="12" rx="4" />
        <path d="M12 8V4" />
        <circle cx="12" cy="3" r="1.4" />
        <path d="M9.5 13.5h.01M14.5 13.5h.01" />
      </svg>
    );
  }
  if (id === "canales") {
    return (
      <svg viewBox="0 0 24 24" className={c} {...p}>
        <path d="M21 11.5a8.5 8.5 0 01-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1121 11.5z" />
      </svg>
    );
  }
  if (id === "plan") {
    return (
      <svg viewBox="0 0 24 24" className={c} {...p}>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={c} {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}
