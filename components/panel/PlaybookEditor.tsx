"use client";

import { useEffect, useState } from "react";
import {
  obtenerPerfil, guardarPerfil, obtenerSugerenciasPlaybook,
  type PerfilNegocio, type SugerenciasPlaybook,
} from "@/lib/api";
import { RUBROS } from "@/lib/rubros";
import { Seccion } from "@/components/panel/Seccion";
import { useCapacidadesOptimista } from "@/lib/modo-negocio";
import { chipsDeCampo, avisoDeAccionImposible } from "@/lib/chips-playbook";

// Tonos CURADOS del bot — lista canónica compartida con el backend
// (TONOS_BOT en core/types.ts) y la app. Texto libre ya no se acepta.
const TONOS_BOT = [
  "cálido y cercano, como atiende el dueño",
  "cercano y profesional",
  "formal y profesional",
  "informal y directo",
  "alegre y juvenil",
  "serio y al grano",
];

const PERFIL_VACIO: PerfilNegocio = {
  rubro: "",
  nombreNegocio: "",
  idioma: "es",
  tono: "",
  propuestaValor: "",
  catalogo: [],
  preguntasClave: [],
  senalesCaliente: [],
  senalesFrio: [],
  objeciones: [],
  politicas: "",
  llamadaAccion: "",
  mensajeBienvenida: "",
  respuestasFijas: [],
};

type Estado = "cargando" | "idle" | "guardando" | "ok" | "error" | "error-carga";

// Editor real del Playbook: carga y guarda contra el backend (`/perfil`). Es
// el "cerebro" que usa la IA para responder — nombre, tono, catálogo,
// preguntas clave y objeciones que el negocio quiere que maneje.
/**
 * ¿Estas cuatro listas son TAL CUAL la plantilla, o el dueño las escribió?
 *
 * Es la pregunta que decide si se le puede ofrecer cambiarlas al cambiar de
 * rubro (2026-08-30). Se compara el contenido completo y en orden: alcanza con
 * que haya agregado, borrado o editado un ítem para que ya no sea la plantilla
 * y nadie le toque nada.
 *
 * Se compara por texto y no por referencia porque las listas viajaron a la
 * base y volvieron: son otros objetos con el mismo contenido.
 */
function esLaPlantilla(
  perfil: {
    preguntasClave: string[];
    senalesCaliente: string[];
    senalesFrio: string[];
    objeciones: { objecion: string; respuesta: string }[];
  },
  plantilla: SugerenciasPlaybook,
): boolean {
  const igual = (a: string[], b: string[]) =>
    a.length === b.length && a.every((x, i) => x === b[i]);
  return (
    igual(perfil.preguntasClave, plantilla.preguntasClave) &&
    igual(perfil.senalesCaliente, plantilla.senalesCaliente) &&
    igual(perfil.senalesFrio, plantilla.senalesFrio) &&
    igual(
      perfil.objeciones.map((o) => `${o.objecion}→${o.respuesta}`),
      plantilla.objeciones.map((o) => `${o.objecion}→${o.respuesta}`),
    )
  );
}

/**
 * QUÉ MITAD DEL PLAYBOOK SE EDITA (2026-08-30, pedido de Jonathan: "toooooda
 * esta configuración debe estar en la sección bot").
 *
 * El criterio: **si cambiarlo cambia lo que el bot DICE, es del bot**. El
 * nombre y el rubro son identidad del negocio y viven en "Tu negocio"; el
 * tono, qué vende, las preguntas clave, las señales y las objeciones son su
 * guion y viven en "Bot".
 *
 * Se parte con una prop y no en dos componentes porque el estado es UNO: el
 * PUT de `/perfil` es full-replace, así que dos formularios separados que
 * guardan por su cuenta se pisarían el trabajo mutuamente.
 */
export type ParteDelPlaybook = "identidad" | "guion";

export function PlaybookEditor({ parte = "guion" }: { parte?: ParteDelPlaybook } = {}) {
  const esIdentidad = parte === "identidad";
  const esGuion = parte === "guion";
  const [perfil, setPerfil] = useState<PerfilNegocio>(PERFIL_VACIO);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [error, setError] = useState("");
  // Un RESTAURANTE no califica leads (2026-08-19, pedido de Jonathan: "hay
  // muchas configuraciones en ajustes que no tienen nada que ver"). Su bot
  // toma pedidos: la maquinaria de captación —catálogo del playbook (su carta
  // vive en /carta), preguntas clave, señales, objeciones, respuestas fijas
  // (el camino de pedidos corta ANTES de evaluarlas, leads.ts:225 vs :291) y
  // llamada a la acción— solo mete ruido. Lo que SÍ usa queda: nombre, tono,
  // por qué elegirte y políticas alimentan la IA de preguntas libres, y el
  // saludo abre el menú de pedidos (leadia a1cd566). `null` (aún no se sabe)
  // muestra todo: mejor largo que un formulario que crece de golpe.
  // Cada bloque de acá abajo pregunta por la capacidad que le corresponde,
  // no por "¿es restaurante?". Son preguntas distintas: el catálogo es de
  // quien CALIFICA, las respuestas fijas de quien REDACTA. Una clínica dice
  // que sí a las dos; un restaurante, a ninguna.
  // `useCapacidadesOptimista`: mientras no se sabe, muestra TODO. Con
  // `useCapacidades()` a secas los gates eran `caps.X &&`, y `null && X` no
  // renderiza — o sea que el formulario arrancaba corto y CRECÍA de golpe al
  // llegar la respuesta, justo lo contrario de lo que decía el comentario de
  // arriba. Reportado por Jonathan: "carga una cosa y al ratito otra".
  const caps = useCapacidadesOptimista();
  // Los chips de los campos largos, según CÓMO vende el negocio (pedidos vs
  // servicios): un contador y un abogado cierran igual aunque sus rubros no se
  // parezcan.
  const chips = chipsDeCampo(caps.tieneCarta);
  // Los ejemplos de su rubro, para los chips. `null` mientras cargan o si
  // falla: son ayuda, y sin ellos la pantalla funciona igual que siempre.
  const [sug, setSug] = useState<SugerenciasPlaybook | null>(null);
  // La plantilla del rubro NUEVO, cuando cambiar el selector nos deja
  // ofrecerla (ver `cambiarRubro`). `null` = no hay nada que ofrecer.
  const [oferta, setOferta] = useState<SugerenciasPlaybook | null>(null);

  useEffect(() => {
    let vivo = true;
    void obtenerSugerenciasPlaybook().then((r) => { if (vivo) setSug(r); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    obtenerPerfil()
      .then((p) => {
        if (cancelado) return;
        if (p) setPerfil({ ...PERFIL_VACIO, ...p });
        setEstado("idle");
      })
      .catch(() => {
        if (cancelado) return;
        // No mostramos el formulario vacío ni el botón Guardar: si el backend
        // está caído y el usuario guardara, el PUT (full-replace) pisaría el
        // perfil real con vacío.
        setEstado("error-carga");
      });
    return () => {
      cancelado = true;
    };
  }, []);

  /**
   * CAMBIAR DE RUBRO PUEDE CAMBIAR EL PLAYBOOK (2026-08-30).
   *
   * Caso real, en vivo con Guisella: creó una inmobiliaria, eligió "Ventas /
   * Comercio / Tienda" —donde cae casi todo— y el bot quedó preguntándole a
   * quien busca casa "¿cuántas unidades necesita?". Al corregir el rubro NO
   * pasaba nada: `completarConPlantilla` solo rellena listas VACÍAS (para no
   * pisar lo que escribió el dueño) y el botón "Completar con lo típico de mi
   * rubro" solo aparece si las cuatro están vacías. Las dos protecciones son
   * correctas por separado; juntas dejaban al usuario ATRAPADO con la
   * plantilla equivocada, sin más salida que borrar ítem por ítem.
   *
   * La regla: solo se ofrece si sus listas son EXACTAMENTE la plantilla del
   * rubro viejo, o sea nadie las tocó. Si escribió algo propio —aunque sea
   * cambiar una palabra— no se pregunta nada y sus textos quedan intactos.
   */
  async function cambiarRubro(nuevo: string) {
    const anterior = perfil.rubro;
    setPerfil({ ...perfil, rubro: nuevo });
    setOferta(null);
    if (!nuevo || nuevo === anterior) return;

    // Las cuatro vacías: el bloque de "¿Empezamos con lo típico?" ya cubre ese
    // caso más abajo, y mostrar dos ofrecimientos a la vez confunde.
    const todoVacio =
      perfil.preguntasClave.length === 0 && perfil.senalesCaliente.length === 0 &&
      perfil.senalesFrio.length === 0 && perfil.objeciones.length === 0;
    if (todoVacio) return;

    const [vieja, nueva] = await Promise.all([
      obtenerSugerenciasPlaybook(anterior || undefined),
      obtenerSugerenciasPlaybook(nuevo),
    ]);
    // Sin plantillas no se ofrece nada: preferimos callar antes que proponer
    // un reemplazo a ciegas sobre listas que quizá el dueño escribió.
    if (!vieja || !nueva) return;
    if (!esLaPlantilla(perfil, vieja)) return;
    setOferta(nueva);
  }

  async function guardar() {
    setEstado("guardando");
    setError("");
    const r = await guardarPerfil(perfil.rubro || "general", perfil);
    if (r.ok) setEstado("ok");
    else {
      setEstado("error");
      setError(r.error ?? "No se pudo guardar");
    }
  }

  if (estado === "cargando") return <p className="text-frio">Cargando…</p>;

  if (estado === "error-carga") {
    return (
      <p className="rounded-xl border border-brasa/40 bg-arena/40 p-4 text-sm text-brasa-texto">
        No pudimos cargar tu configuración. Recarga la página.
      </p>
    );
  }

  return (
    // El bloque PRINCIPAL de "Tu negocio": lleva la barrita naranja para que
    // se distinga de las secciones de abajo, que son ajustes de segundo orden.
    <Seccion
      titulo={esIdentidad ? "Tu negocio" : "Cómo atiende tu bot"}
      bajada={
        esIdentidad
          ? "El nombre y el rubro con los que se presenta. Lo que el bot dice se configura en la pestaña Bot."
          : caps.tieneCarta
            ? "El saludo con el que tu bot recibe a cada cliente. Tus horarios, pagos y mínimo de delivery se configuran en Ajustes; tu carta, en su sección."
            : "El playbook que usa la IA para responder por ti: tono, qué vendes, preguntas clave y objeciones."
      }
      tono="hondo"
    >
      {/* El formulario en BLANCO dentro de la sección oscura: son ocho campos,
          chips y cuatro listas pensadas para fondo claro, y un formulario largo
          sobre oscuro se lee peor. El verde hondo enmarca; aquí se escribe. */}
      <div className="space-y-5 rounded-tarjeta bg-carta p-5">
      {/* EL RUBRO NO SE ELIGE ACÁ EN PEDIDOS (2026-08-27, Jonathan: "el
          rubro no es necesario que aparezca... para el tema de ventas sí es
          necesario porque cambia el rubro de cada negocio con el que
          trabaje").

          Además de duplicar el alta, acá MIENTE sobre lo que hace: este es el
          `rubro` del PERFIL, que solo escribe una línea del prompt ("un
          negocio del rubro X"). El que decide si el negocio ve Carta y Cocina
          es `Tenant.objetivo`, y este selector no lo toca — se podía elegir
          "Salud" y seguía siendo un restaurante.

          En captación se queda: una agencia cambia de rubro según el cliente
          para el que capta, y ahí esa línea del prompt sí pesa (el bot
          conversa de verdad, no manda textos fijos). */}
      {esIdentidad && (
      <div className={caps.tieneCarta ? "" : "grid gap-4 lg:grid-cols-2"}>
        <Campo
          label="Nombre del negocio"
          value={perfil.nombreNegocio}
          onChange={(v) => setPerfil({ ...perfil, nombreNegocio: v })}
        />
        {!caps.tieneCarta && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">A qué te dedicas</span>
            <select
              value={perfil.rubro}
              onChange={(e) => cambiarRubro(e.target.value)}
              className="w-full rounded-tarjeta border border-linea bg-carta px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
            >
              <option value="">Elige tu rubro…</option>
              {RUBROS.map((r) => (
                <option key={r.id} value={r.id}>{r.emoji} {r.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      )}

      {/* EL TONO NO APLICA A PEDIDOS (2026-08-27, Jonathan: "¿de verdad
          funciona esto? si todo es determinístico").
          Tenía razón, y con números: el flujo de pedidos manda 69 mensajes
          FIJOS contra 2 llamadas al LLM, y `tono` no aparece ni una vez en
          `pedidos-conversacion.ts`. El cliente de un restaurante lee textos
          que escribimos nosotros; el selector prometía algo que no pasa.
          En captación SÍ manda: ahí el bot conversa de verdad.

          Tono CURADO (2026-07-22, mismo criterio que la app): opciones
          predeterminadas en vez de texto libre — un tono arbitrario puede
          alterar el comportamiento del bot. Un tono legacy (texto libre de
          antes) se muestra como "Actual" y se respeta hasta que elijan uno
          curado (el backend valida con la misma lista). */}
      {esGuion && !caps.tieneCarta && (
      <div>
        <span className="mb-2 block text-sm font-medium text-tinta">Cómo quieres que hable el bot</span>
        <div className="flex flex-wrap gap-2">
          {perfil.tono.trim() !== "" &&
            !TONOS_BOT.some((t) => t.toLowerCase() === perfil.tono.trim().toLowerCase()) && (
              <span className="rounded-chip bg-tibio-suave px-3 py-1.5 text-[0.82rem] font-semibold text-tibio ring-1 ring-tibio/30">
                Actual: “{perfil.tono}”
              </span>
            )}
          {TONOS_BOT.map((t) => {
            const activo = t.toLowerCase() === perfil.tono.trim().toLowerCase();
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPerfil({ ...perfil, tono: t })}
                className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                  activo ? "bg-brasa text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-linea"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            );
          })}
        </div>
      </div>
      )}
      {/* "Por qué elegirte" alimenta el prompt de CALIFICACIÓN de leads, que
          un restaurante no usa: no califica a quien pide comida, le cobra. */}
      {esGuion && !caps.tieneCarta && (
        <CampoArea
          label="Por qué elegirte"
          ayuda="Lo que te diferencia. El bot lo usa para convencer a quien duda."
          chips={chips.propuestaValor}
          value={perfil.propuestaValor}
          onChange={(v) => setPerfil({ ...perfil, propuestaValor: v })}
          placeholder="Ej: 20 años de experiencia, atención el mismo día"
        />
      )}

      {esGuion && caps.calificaLeads && (
        <>
          {/* CAMBIÓ DE RUBRO Y SUS LISTAS SON LA PLANTILLA VIEJA (2026-08-30).
              Ver `cambiarRubro`: solo aparece si no editó nada, así que aceptar
              no puede borrarle trabajo propio. Se ofrece, no se aplica solo —
              cambiar cuatro listas sin preguntar es lo que da miedo. */}
          {oferta && (
            <div className="rounded-tarjeta border border-brasa/30 bg-brasa-suave p-4">
              <p className="text-[0.88rem] font-bold text-tinta">
                Cambiaste de rubro: ¿actualizo las listas?
              </p>
              <p className="mt-1 text-[0.84rem] text-frio">
                Las que tienes ahora son las que pusimos por tu rubro anterior
                — no las editaste. Puedo reemplazarlas por las de tu rubro
                nuevo. Nada se publica hasta que guardes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPerfil({
                      ...perfil,
                      preguntasClave: oferta.preguntasClave,
                      senalesCaliente: oferta.senalesCaliente,
                      senalesFrio: oferta.senalesFrio,
                      objeciones: oferta.objeciones,
                    });
                    setSug(oferta);
                    setOferta(null);
                  }}
                  className="rounded-tarjeta bg-brasa px-4 py-2.5 text-[0.85rem] font-bold text-sobre-brasa transition active:scale-[0.99]"
                >
                  Sí, actualizar
                </button>
                <button
                  type="button"
                  onClick={() => setOferta(null)}
                  className="rounded-tarjeta bg-arena-2 px-4 py-2.5 text-[0.85rem] font-bold text-tinta-2 transition active:scale-[0.99]"
                >
                  Dejar las mías
                </button>
              </div>
            </div>
          )}
          {/* "COMPLETAR CON LO TÍPICO DE MI RUBRO" (2026-08-27).
              Los negocios NUEVOS ya nacen con el playbook lleno, pero los que
              ya existían lo tienen vacío — y son la mayoría. Los chips ayudan
              de a uno; esto lo deja andando de una.

              Solo aparece si TODO está vacío: con algo escrito, los chips
              alcanzan y un botón que llena cuatro listas de golpe da miedo. */}
          {sug &&
            perfil.preguntasClave.length === 0 &&
            perfil.senalesCaliente.length === 0 &&
            perfil.senalesFrio.length === 0 &&
            perfil.objeciones.length === 0 && (
              <div className="rounded-tarjeta bg-arena/60 p-4">
                <p className="text-[0.88rem] font-bold text-tinta">
                  ¿Empezamos con lo típico de tu rubro?
                </p>
                <p className="mt-1 text-[0.84rem] text-frio">
                  Llenamos las listas de abajo con lo que suele funcionar en
                  negocios como el tuyo. Después borras o cambias lo que quieras
                  — nada se publica hasta que guardes.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setPerfil({
                      ...perfil,
                      preguntasClave: sug.preguntasClave,
                      senalesCaliente: sug.senalesCaliente,
                      senalesFrio: sug.senalesFrio,
                      objeciones: sug.objeciones,
                    })
                  }
                  className="mt-3 rounded-tarjeta bg-brasa px-4 py-2.5 text-[0.85rem] font-bold text-sobre-brasa transition active:scale-[0.99]"
                >
                  Completar con lo típico de mi rubro
                </button>
              </div>
            )}
          <ListaCatalogo
            catalogo={perfil.catalogo}
            onChange={(catalogo) => setPerfil({ ...perfil, catalogo })}
          />
          <ListaSimple
            titulo="Preguntas clave"
            descripcion="Lo que el bot pregunta antes de avisarte que un cliente está listo para comprar"
            placeholder="¿Para cuándo lo necesitas?"
            valores={perfil.preguntasClave}
            onChange={(preguntasClave) => setPerfil({ ...perfil, preguntasClave })}
            sugerencias={sug?.preguntasClave}
          />
          <ListaSimple
            titulo="Señales de que un cliente está listo para comprar"
            descripcion="Lo que dice o pregunta un cliente que está por comprar"
            placeholder="Ej: pregunta por precios y disponibilidad"
            valores={perfil.senalesCaliente}
            onChange={(senalesCaliente) => setPerfil({ ...perfil, senalesCaliente })}
            sugerencias={sug?.senalesCaliente}
          />
          <ListaSimple
            titulo="Señales de que un cliente todavía no está listo"
            descripcion="Lo que indica que todavía no está listo para comprar"
            placeholder="Ej: solo pregunta info general, sin urgencia"
            valores={perfil.senalesFrio}
            onChange={(senalesFrio) => setPerfil({ ...perfil, senalesFrio })}
            sugerencias={sug?.senalesFrio}
          />
          <ListaObjeciones
            objeciones={perfil.objeciones}
            onChange={(objeciones) => setPerfil({ ...perfil, objeciones })}
          />
        </>
      )}

      <div>
        <p className="mb-1 text-xs text-frio">
          {caps.tieneCarta
            ? "Abre el menú de pedidos: es lo primero que el cliente lee, antes de los botones y el link de tu carta."
            : "Es lo primero que el cliente lee cuando te escribe por primera vez."}
        </p>
        <CampoArea
          label="El primer saludo del bot"
          value={perfil.mensajeBienvenida ?? ""}
          onChange={(v) => setPerfil({ ...perfil, mensajeBienvenida: v })}
          placeholder={
            caps.tieneCarta
              ? "Ej: ¡Bienvenido a [tu negocio]! 🍗 El mejor sabor de la zona."
              : "Ej: ¡Hola! Soy el asistente de [tu negocio] 😊 ¿En qué te puedo ayudar?"
          }
        />
      </div>

      {esGuion && caps.redactaRespuestas && (
        <ListaRespuestasFijas
          respuestasFijas={perfil.respuestasFijas ?? []}
          onChange={(respuestasFijas) => setPerfil({ ...perfil, respuestasFijas })}
        />
      )}

      {/* "CÓMO TRABAJAS" DUPLICA CONFIGURACIÓN QUE YA FUNCIONA MEJOR
          (2026-08-27, Jonathan: "ya hay secciones de configuración donde
          tenemos los días que abre, horario, métodos de pago, si es en local
          o delivery... ¿para qué necesitamos este campo?").
          Horarios, mínimo de delivery, Yape y efectivo son campos
          ESTRUCTURADOS: el bot los hace cumplir. Escritos acá, solo los
          menciona — un mínimo de S/20 en texto no frena un pedido de S/12.
          En captación no hay esos campos, así que ahí sigue siendo el lugar
          donde se cuentan las condiciones del servicio. */}
      {esGuion && !caps.tieneCarta && (
        <CampoArea
          label="Cómo trabajas (envíos, horarios, pagos)"
          ayuda="Tus reglas. El bot las responde tal cual cuando se las preguntan."
          chips={chips.politicas}
          value={perfil.politicas}
          onChange={(v) => setPerfil({ ...perfil, politicas: v })}
          placeholder="Ej: Atención remota a todo el Perú. Pago por Yape o transferencia."
        />
      )}
      {esGuion && caps.calificaLeads && (
        <CampoArea
          label="Qué quieres que hagan tus clientes"
          ayuda="Hacia dónde empuja el bot al cerrar. Tiene que ser algo que el CLIENTE hace."
          chips={chips.llamadaAccion}
          value={perfil.llamadaAccion}
          onChange={(v) => setPerfil({ ...perfil, llamadaAccion: v })}
          placeholder="Ej: Que dejen su nombre y qué necesitan"
        />
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={guardar}
          disabled={estado === "guardando"}
          className="rounded-full bg-brasa px-6 py-2.5 text-sm font-semibold text-sobre-brasa hover:bg-brasa-hondo disabled:opacity-60"
        >
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        {estado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
        {estado === "error" && <p className="text-sm text-brasa-texto">{error}</p>}
      </div>
      </div>
    </Seccion>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
    </label>
  );
}

/**
 * CON CHIPS Y AVISO (2026-08-30, Jonathan: "podríamos crear algunos chips más
 * para ayudar a las personas a ser más claras... no son personas técnicas...
 * mientras menos configuraciones libres queden, trabajará mejor el bot").
 *
 * Los CHIPS son para no arrancar de cero: la mayoría toca uno y ya. Se AGREGAN
 * al texto en vez de reemplazarlo, así se pueden combinar dos.
 *
 * El AVISO es lo que más sirve: si escribe una acción que el bot no puede
 * ejecutar ("que agende una cita"), se lo dice EN EL MOMENTO. Hoy lo escribe,
 * no funciona y nunca se entera de por qué. No bloquea — puede que lo quiera
 * igual para que el bot tome el dato, y el aviso ya le dijo qué va a pasar de
 * verdad.
 */
function CampoArea({
  label,
  value,
  onChange,
  placeholder,
  chips = [],
  ayuda,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  chips?: string[];
  ayuda?: string;
}) {
  const aviso = avisoDeAccionImposible(value);
  // Solo los que todavía no puso: repetir uno ya usado es ruido.
  const disponibles = chips.filter((c) => !value.includes(c));

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-tinta">{label}</span>
      {ayuda && <span className="mb-2 block text-[0.82rem] text-frio">{ayuda}</span>}
      {disponibles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {disponibles.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(value.trim() ? `${value.trim()} ${c}.` : `${c}.`)}
              className="rounded-chip bg-arena px-2.5 py-1 text-[0.8rem] text-tinta-2 ring-1 ring-linea transition hover:bg-carta hover:ring-brasa"
            >
              + {c}
            </button>
          ))}
        </div>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-sm text-tinta outline-none focus:border-brasa"
      />
      {aviso && (
        <span className="mt-1.5 flex gap-1.5 rounded-tarjeta bg-calor-suave px-3 py-2 text-[0.82rem] text-calor-hondo">
          <span aria-hidden>⚠</span>
          <span>{aviso}</span>
        </span>
      )}
    </label>
  );
}

// Lista editable de strings simples (preguntas clave), con agregar/quitar fila.
function ListaSimple({
  titulo,
  descripcion,
  placeholder,
  valores,
  onChange,
  sugerencias = [],
}: {
  titulo: string;
  descripcion?: string;
  placeholder?: string;
  valores: string[];
  onChange: (v: string[]) => void;
  /**
   * Ejemplos de su rubro, para tocar y agregar (2026-08-27, Jonathan: "tantas
   * opciones de texto libre, una persona no puede saber qué escribir").
   *
   * Un placeholder con UN ejemplo en gris no alcanza: hay que entender para
   * qué sirve la lista antes de inventar la primera línea.
   */
  sugerencias?: string[];
}) {
  function actualizar(i: number, v: string) {
    const copia = [...valores];
    copia[i] = v;
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(valores.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...valores, ""]);
  }

  return (
    // Bloque separado por una LÍNEA, no otra caja (2026-08-18): estas listas
    // ya viven dentro de la tarjeta de la sección, y una caja gris adentro de
    // una tarjeta blanca adentro de la página era la tercera superficie.
    <div className="border-t border-linea pt-4">
      <p className="text-[0.88rem] font-bold text-tinta">{titulo}</p>
      {descripcion && <p className="mb-2.5 mt-0.5 text-[0.78rem] text-frio">{descripcion}</p>}

      {/* LOS CHIPS. Solo los que TODAVÍA NO agregó: ofrecerle algo que ya
          tiene lo haría dudar de si se guardó. */}
      {(() => {
        const yaEstan = new Set(valores.map((v) => v.trim().toLowerCase()));
        const libres = sugerencias.filter((x) => !yaEstan.has(x.trim().toLowerCase()));
        if (libres.length === 0) return null;
        return (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {libres.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => onChange([...valores.filter((v) => v.trim()), x])}
                className="rounded-chip bg-arena px-2.5 py-1 text-[0.78rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-linea"
              >
                + {x}
              </button>
            ))}
          </div>
        );
      })()}

      <div className="space-y-2">
        {valores.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={v}
              onChange={(e) => actualizar(i, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-xl border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa-texto"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa-texto"
      >
        + Agregar
      </button>
    </div>
  );
}

// Catálogo: nombre, descripción y precio por fila.
function ListaCatalogo({
  catalogo,
  onChange,
}: {
  catalogo: PerfilNegocio["catalogo"];
  onChange: (v: PerfilNegocio["catalogo"]) => void;
}) {
  function actualizar(i: number, campo: "nombre" | "descripcion" | "precio", v: string) {
    const copia = catalogo.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(catalogo.filter((_, idx) => idx !== i));
  }
  const MAX = 50; // debe coincidir con LIMITES_PERFIL.catalogoMax del backend
  const lleno = catalogo.length >= MAX;
  function agregar() {
    if (lleno) return;
    onChange([...catalogo, { nombre: "", descripcion: "", precio: "" }]);
  }

  return (
    <div className="border-t border-linea pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-[0.88rem] font-bold text-tinta">Qué vendes</p>
          <p className="mt-0.5 text-[0.78rem] text-frio">Productos o servicios que ofrece el negocio</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold ${lleno ? "text-brasa-hondo" : "text-frio"}`}>
          {catalogo.length}/{MAX}
        </span>
      </div>
      <div className="space-y-3">
        {catalogo.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto_auto]">
            <input
              value={item.nombre}
              onChange={(e) => actualizar(i, "nombre", e.target.value)}
              placeholder="Ej: Declaración de renta"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.descripcion ?? ""}
              onChange={(e) => actualizar(i, "descripcion", e.target.value)}
              placeholder="Descripción"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.precio ?? ""}
              onChange={(e) => actualizar(i, "precio", e.target.value)}
              placeholder="Precio"
              className="w-full rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa sm:w-28"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa-texto"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        disabled={lleno}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa-texto disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-linea disabled:hover:text-frio"
      >
        + Agregar producto
      </button>
      {lleno && (
        <p className="mt-1.5 text-xs text-brasa-hondo">
          Llegaste al máximo de {MAX} productos. Es para que la IA no se sobrecargue y responda mejor.
        </p>
      )}
    </div>
  );
}

// Respuestas listas: palabra clave + respuesta fija por fila. Si el cliente
// escribe algo que contiene esa palabra, el bot responde esto directo, sin
// pensarlo (útil para preguntas repetidas como precio, horario, ubicación).
function ListaRespuestasFijas({
  respuestasFijas,
  onChange,
}: {
  respuestasFijas: { palabra: string; respuesta: string }[];
  onChange: (v: { palabra: string; respuesta: string }[]) => void;
}) {
  function actualizar(i: number, campo: "palabra" | "respuesta", v: string) {
    const copia = respuestasFijas.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(respuestasFijas.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...respuestasFijas, { palabra: "", respuesta: "" }]);
  }

  return (
    <div className="border-t border-linea pt-4">
      <p className="text-[0.88rem] font-bold text-tinta">Respuestas listas</p>
      <p className="mb-2 text-xs text-frio">
        Para preguntas que se repiten mucho: si el cliente escribe esa palabra, el bot contesta esto
        directo, sin pensarlo.
      </p>
      <div className="space-y-3">
        {respuestasFijas.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.palabra}
              onChange={(e) => actualizar(i, "palabra", e.target.value)}
              placeholder="Si preguntan por... Ej: precio"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.respuesta}
              onChange={(e) => actualizar(i, "respuesta", e.target.value)}
              placeholder="El bot responde... Ej: Depende de tu caso, ¿cuánto facturas al mes?"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa-texto"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa-texto"
      >
        + Agregar respuesta lista
      </button>
    </div>
  );
}

// Dudas comunes: duda del cliente + respuesta sugerida por fila.
function ListaObjeciones({
  objeciones,
  onChange,
}: {
  objeciones: PerfilNegocio["objeciones"];
  onChange: (v: PerfilNegocio["objeciones"]) => void;
}) {
  function actualizar(i: number, campo: "objecion" | "respuesta", v: string) {
    const copia = objeciones.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it));
    onChange(copia);
  }
  function quitar(i: number) {
    onChange(objeciones.filter((_, idx) => idx !== i));
  }
  function agregar() {
    onChange([...objeciones, { objecion: "", respuesta: "" }]);
  }

  return (
    <div className="border-t border-linea pt-4">
      <p className="text-[0.88rem] font-bold text-tinta">Dudas comunes de tus clientes</p>
      <p className="mb-2 text-xs text-frio">Qué suele frenar la venta y cómo responderlo</p>
      <div className="space-y-3">
        {objeciones.map((item, i) => (
          <div key={i} className="grid gap-2 rounded-lg bg-carta p-3 ring-1 ring-linea sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.objecion}
              onChange={(e) => actualizar(i, "objecion", e.target.value)}
              placeholder="Ej: Está caro"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <input
              value={item.respuesta}
              onChange={(e) => actualizar(i, "respuesta", e.target.value)}
              placeholder="Ej: Tenemos planes a tu medida, ¿cuánto facturas al mes?"
              className="rounded-lg border border-linea bg-carta px-3 py-2 text-sm text-tinta outline-none focus:border-brasa"
            />
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar"
              className="shrink-0 rounded-lg px-2 py-2 text-sm font-semibold text-frio hover:text-brasa-texto"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={agregar}
        className="mt-2 rounded-lg border border-dashed border-linea px-3 py-1.5 text-xs font-semibold text-frio hover:border-brasa hover:text-brasa-texto"
      >
        + Agregar duda
      </button>
    </div>
  );
}
