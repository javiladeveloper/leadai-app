"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import { listarComentarios, listarCanalesComentarios, simularComentario, responderComentario, type Comentario, type FiltrosComentarios } from "@/lib/api";
import { redesDeComentarios, textoRedes, fusionarComentarios, describirEnvio } from "@/lib/comentarios-estado";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { AjustesComentarios } from "@/components/panel/AjustesComentarios";
import { HeroSeccion, ComentariosIlustracion } from "@/components/panel/HeroSeccion";

type Estado = "cargando" | "ok" | "error";

/**
 * LOS FILTROS DE LA LISTA (2026-09-29). Con la respuesta automática entran
 * todos —halagos incluidos— y "se ven todos juntos" (Jonathan). Tipo mezcla
 * intención y estado porque es como lo piensa el dueño: "¿quién quiere
 * comprar?", "¿qué me falta contestar?".
 */
type Red = "" | "instagram" | "messenger";
type Tipo = "" | "compra" | "pregunta" | "halago" | "sin_responder";
type Rango = "todo" | "hoy" | "7" | "30";
interface Filtros { red: Red; tipo: Tipo; rango: Rango }
const SIN_FILTROS: Filtros = { red: "", tipo: "", rango: "todo" };

function aApi(f: Filtros): FiltrosComentarios {
  const out: FiltrosComentarios = {};
  if (f.red) out.canal = f.red;
  if (f.tipo === "sin_responder") out.respondido = "no";
  else if (f.tipo) out.intencion = f.tipo;
  if (f.rango !== "todo") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (f.rango !== "hoy") d.setDate(d.getDate() - (Number(f.rango) - 1));
    out.desde = d.toISOString();
  }
  return out;
}

// Etiqueta visual por intención detectada por la IA.
const INTENCION: Record<string, { texto: string; clase: string }> = {
  compra: { texto: "🛒 Intención de compra", clase: "bg-calor-suave text-calor-hondo" },
  pregunta: { texto: "❓ Pregunta", clase: "bg-brasa-suave text-brasa-texto" },
  halago: { texto: "💬 Halago", clase: "bg-tibio-suave text-tibio" },
  spam: { texto: "🚫 Spam", clase: "bg-arena text-frio" },
  otro: { texto: "· Otro", clase: "bg-arena text-frio" },
};

// Comentarios como leads: cuando alguien comenta un post con intención de
// compra, la IA responde e invita al privado. Esta pantalla muestra el log de
// lo captado + un simulador para probar el flujo antes de conectar Meta.
export default function ComentariosPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [texto, setTexto] = useState("");
  const [simulando, setSimulando] = useState(false);
  const [ultimo, setUltimo] = useState<{ intencion?: string; respuesta?: string | null; destinosPrevistos?: { publica: boolean; privada: boolean } } | null>(null);
  const [errorSimulacion, setErrorSimulacion] = useState("");
  const [errorRedes, setErrorRedes] = useState("");
  const [errorMas, setErrorMas] = useState("");
  const [errorRefresco, setErrorRefresco] = useState("");
  const [claveDatos, setClaveDatos] = useState("");
  const [claveRedes, setClaveRedes] = useState("");
  const [claveErrorRedes, setClaveErrorRedes] = useState("");
  const [claveSimulacion, setClaveSimulacion] = useState("");
  const [intento, setIntento] = useState(0);
  const [cursorHueco, setCursorHueco] = useState<{ antesDe: string; antesId: string } | null>(null);
  /**
   * QUÉ REDES DE COMENTARIOS TIENE ESTE NEGOCIO (2026-09-18). `null` mientras
   * se lee. Jonathan, con Instagram y Facebook conectados en Sania: "me sigue
   * apareciendo este mensaje" — el aviso de conectar estaba fijo en la página.
   */
  const [redes, setRedes] = useState<string[] | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const generacion = useRef(0);
  const generacionRedes = useRef(0);
  const secuenciaSondeo = useRef(0);
  const comentariosActuales = useRef<Comentario[]>([]);

  useEffect(() => { comentariosActuales.current = comentarios; }, [comentarios]);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  // Modo global: barra de negocios; el log se lee del negocio enfocado y la
  // simulación adopta ese negocio (g.adoptar).
  const g = useSeccionGlobal();
  const claveNegocio = g.tenantLista ?? "negocio-activo";
  const claveVista = `${claveNegocio}|${JSON.stringify(filtros)}`;
  const datosVigentes = g.listaLista && claveDatos === claveVista;
  const redesVigentes = g.listaLista && claveRedes === claveNegocio;

  const cargar = useCallback(async (silencioso = false, version = generacion.current) => {
    const secuencia = ++secuenciaSondeo.current;
    if (!silencioso) setEstado("cargando");
    try {
      let pagina = await listarComentarios(g.tenantLista, { ...aApi(filtros), limit: 30 });
      if (version !== generacion.current || secuencia !== secuenciaSondeo.current) return;
      const conocidos = new Set(comentariosActuales.current.map((c) => c.id));
      const nuevos = [...pagina.items];
      let vueltas = 0;
      // Si hubo más de 30 nuevos mientras la pestaña estaba oculta, cerrar
      // el hueco hasta encontrar uno ya cargado (sin perder páginas antiguas).
      while (silencioso && conocidos.size > 0 && pagina.hayMas && !nuevos.some((c) => conocidos.has(c.id)) && vueltas < 5) {
        const ultimo = nuevos[nuevos.length - 1];
        if (!ultimo) break;
        pagina = await listarComentarios(g.tenantLista, { ...aApi(filtros), antesDe: ultimo.creadoEn, antesId: ultimo.id, limit: 100 });
        if (version !== generacion.current || secuencia !== secuenciaSondeo.current) return;
        nuevos.push(...pagina.items);
        vueltas++;
        if (pagina.items.length === 0) break;
      }
      const solapa = nuevos.some((c) => conocidos.has(c.id));
      if (silencioso && conocidos.size > 0 && !solapa && pagina.hayMas) {
        const ultimo = nuevos[nuevos.length - 1];
        if (ultimo) setCursorHueco({ antesDe: ultimo.creadoEn, antesId: ultimo.id });
      } else setCursorHueco(null);
      setComentarios((xs) => silencioso && (solapa || pagina.hayMas) ? fusionarComentarios(xs, nuevos) : nuevos);
      if (!silencioso) setHayMas(pagina.hayMas);
      setClaveDatos(claveVista);
      setEstado("ok");
      setErrorRefresco("");
    } catch (e) {
      if (version !== generacion.current || secuencia !== secuenciaSondeo.current) return;
      if (!silencioso) { setClaveDatos(claveVista); setEstado("error"); }
      else setErrorRefresco(e instanceof Error ? e.message : "No pudimos actualizar los comentarios.");
    }
  }, [g.tenantLista, filtros, claveVista]);

  useEffect(() => {
    if (!listo || !g.listaLista) return;
    const version = ++generacion.current;
    setComentarios([]);
    setClaveDatos("");
    setHayMas(false);
    setCursorHueco(null);
    setCargandoMas(false);
    setSimulando(false);
    setErrorMas("");
    setUltimo(null);
    void cargar(false, version);
    return () => { generacion.current++; };
  }, [listo, g.listaLista, g.tenantLista, claveVista, cargar, intento]);

  useEffect(() => {
    if (!listo || !g.listaLista) return;
    const version = ++generacionRedes.current;
    setRedes(null);
    setClaveRedes("");
    setErrorRedes("");
    setClaveErrorRedes("");
    void listarCanalesComentarios(g.tenantLista).then((canales) => {
      if (version === generacionRedes.current) { setRedes(redesDeComentarios(canales)); setClaveRedes(claveNegocio); }
    }).catch((e: unknown) => {
      if (version === generacionRedes.current) { setErrorRedes(e instanceof Error ? e.message : "No pudimos leer las redes."); setClaveErrorRedes(claveNegocio); }
    });
    return () => { generacionRedes.current++; };
  }, [listo, g.listaLista, g.tenantLista, claveNegocio, intento]);

  /** "Ver más": los anteriores al último que ya se ve (cursor por fecha). */
  async function verMas() {
    const ultimoVisto = comentarios[comentarios.length - 1];
    if (!ultimoVisto || cargandoMas) return;
    const version = generacion.current;
    setCargandoMas(true);
    setErrorMas("");
    try {
      const r = await listarComentarios(g.tenantLista, { ...aApi(filtros), antesDe: ultimoVisto.creadoEn, antesId: ultimoVisto.id, limit: 30 });
      if (version !== generacion.current) return;
      setComentarios((xs) => fusionarComentarios(xs, r.items));
      setHayMas(r.hayMas);
    } catch (e) {
      if (version === generacion.current) setErrorMas(e instanceof Error ? e.message : "No pudimos cargar más comentarios.");
    } finally { if (version === generacion.current) setCargandoMas(false); }
  }

  const conFiltros = filtros.red !== "" || filtros.tipo !== "" || filtros.rango !== "todo";

  /**
   * LOS COMENTARIOS NUEVOS APARECEN SOLOS (2026-09-29). Jonathan, grabando la
   * demo: "¿aparece automáticamente o tengo que estar apretando F5?". Llegan
   * por webhook en segundos, así que la lista se relee cada 10 s mientras la
   * pestaña está a la vista (en segundo plano no gasta).
   */
  useEffect(() => {
    if (!listo || !g.listaLista) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible" && !cursorHueco) void cargar(true);
    }, 10_000);
    return () => window.clearInterval(id);
  }, [listo, g.listaLista, cargar, cursorHueco]);

  async function completarHueco() {
    if (!cursorHueco) return;
    const version = generacion.current;
    const secuencia = ++secuenciaSondeo.current;
    const conocidos = new Set(comentariosActuales.current.map((c) => c.id));
    let cursor = cursorHueco;
    try {
      for (let i = 0; i < 5; i++) {
        const pagina = await listarComentarios(g.tenantLista, { ...aApi(filtros), ...cursor, limit: 100 });
        if (version !== generacion.current || secuencia !== secuenciaSondeo.current) return;
        const solapa = pagina.items.some((c) => conocidos.has(c.id));
        setComentarios((xs) => fusionarComentarios(xs, pagina.items));
        const ultimo = pagina.items[pagina.items.length - 1];
        if (solapa || !pagina.hayMas || !ultimo) { setCursorHueco(null); return; }
        cursor = { antesDe: ultimo.creadoEn, antesId: ultimo.id };
        setCursorHueco(cursor);
      }
    } catch (e) { setErrorRefresco(e instanceof Error ? e.message : "No pudimos completar los comentarios recientes."); }
  }

  async function probar() {
    const t = texto.trim();
    if (!t || simulando) return;
    setSimulando(true);
    setUltimo(null);
    setErrorSimulacion("");
    const version = generacion.current;
    const r = await simularComentario({ texto: t, autorNombre: "Cliente de prueba", tenant: g.tenantLista });
    if (version !== generacion.current) return;
    setSimulando(false);
    if (r.ok) {
      setUltimo({ intencion: r.intencion, respuesta: r.respuesta, destinosPrevistos: r.destinosPrevistos });
      setClaveSimulacion(claveVista);
      setTexto("");
    } else setErrorSimulacion(r.error ?? "No pudimos generar la vista previa.");
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu embudo</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Comentarios</h1>
      </header>

      {/* El hero que le faltaba (pasada UX 2026-09-06): era la única sección
          del embudo sin él — abría con un aviso amarillo de advertencia. */}
      <HeroSeccion
        titulo="Los comentarios también venden"
        bajada="Cuando alguien pregunta o quiere comprar, la IA le responde e invita al privado — y entra a tu pipeline como lead. Si te felicitan, le agradece."
        nota="Aquí ves todo lo que captó y puedes probar cómo respondería."
        dibujo={<ComentariosIlustracion />}
      />

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {/* El aviso depende de las redes: el de conectar solo si no hay ninguna
          (2026-09-18). Antes era fijo y Sania lo veía con las dos conectadas. */}
      {redesVigentes && redes !== null && redes.length === 0 && (
        <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
          Conecta Instagram o Facebook para empezar a recibir comentarios. Puedes probar la respuesta abajo sin enviar nada.
        </div>
      )}
      {redesVigentes && redes !== null && redes.length > 0 && (
        <div className="rounded-tarjeta bg-brasa-suave/40 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-brasa/20">
          {textoRedes(redes)} {redes.length > 1 ? "conectados" : "conectado"}. La conexión registrada no confirma por sí sola los permisos ni la entrega de respuestas de Meta.
        </div>
      )}
      {g.listaLista && errorRedes && claveErrorRedes === claveNegocio && !redesVigentes && <div role="alert" className="rounded-tarjeta bg-calor-suave p-3 text-sm text-calor-hondo">No pudimos comprobar las redes: {errorRedes} <button onClick={() => setIntento((n) => n + 1)} className="font-semibold underline">Reintentar</button></div>}

      {/* Ajustes: activar/desactivar + mensaje personalizado */}
      {g.listaLista && <AjustesComentarios key={g.tenantLista ?? "negocio-activo"} tenant={g.tenantLista} />}

      {/* Simulador: probar el flujo sin Meta */}
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <h2 className="text-[1.05rem] font-bold text-tinta">Prueba la respuesta de la IA</h2>
        <p className="mt-1 text-[0.82rem] text-frio">
          Escribe un comentario como lo haría un cliente. Es una vista previa: no crea leads ni envía mensajes.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") probar(); }}
            aria-label="Comentario de prueba"
            placeholder="Ej: ¿cuánto cuesta? ¿hacen delivery?"
            className="flex-1 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
          />
          <button
            onClick={probar}
            disabled={simulando || !texto.trim() || !g.listaLista}
            className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {simulando ? "Probando…" : "Probar"}
          </button>
        </div>

        {errorSimulacion && <p role="alert" className="mt-3 text-sm text-calor-hondo">{errorSimulacion}</p>}
        {ultimo && claveSimulacion === claveVista && (
          <div className="mt-3 rounded-tarjeta bg-arena/50 px-4 py-3">
            <p className="text-[0.8rem] font-semibold text-tinta">Vista previa · no enviada</p>
            <p className="text-[0.8rem] font-semibold text-tinta-2">
              La IA lo clasificó como:{" "}
              <span className="font-bold">{INTENCION[ultimo.intencion ?? "otro"]?.texto ?? ultimo.intencion}</span>
            </p>
            {ultimo.destinosPrevistos?.publica && ultimo.respuesta ? (
              <>
                <p className="mt-1.5 text-[0.88rem] text-tinta">
                  <span className="text-frio">Así respondería en el comentario: </span>“{ultimo.respuesta}”
                </p>
                {/* El ciclo completo: comentario → DM → lead en el pipeline.
                    Solo si abre conversación: un halago se agradece y listo. */}
                {ultimo.destinosPrevistos?.privada && (
                <div className="mt-2.5 space-y-1 rounded-chip bg-carta px-3 py-2 text-[0.8rem] text-tinta-2 ring-1 ring-linea">
                  <p>Si Meta acepta el flujo real, intentaría abrir un DM y enlazar al autor como lead.</p>
                </div>
                )}
                <p className="mt-1.5 text-[0.76rem] text-frio">
                  No se publicó nada en tus redes.
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[0.84rem] text-frio">
                No se propondría una respuesta pública. Esta prueba no queda registrada.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Log de comentarios */}
      <div>
        <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Comentarios captados</h2>

        {redesVigentes && redes !== null && redes.length > 0 && (
          <BarraFiltros filtros={filtros} redes={redes} onCambiar={setFiltros} />
        )}

        {(estado === "cargando" || !datosVigentes) && <SkeletonLista filas={3} />}
        {estado === "error" && datosVigentes && (
          <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
            <p role="alert" className="font-semibold text-tinta">No pudimos cargar los comentarios.</p>
            <button onClick={() => setIntento((n) => n + 1)} className="mt-2 font-semibold text-brasa-texto">Reintentar</button>
          </div>
        )}
        {errorRefresco && estado === "ok" && datosVigentes && <p role="status" className="mb-2 text-sm text-calor-hondo">No pudimos actualizar: {errorRefresco} <button onClick={() => void (cursorHueco ? completarHueco() : cargar(true))} className="font-semibold underline">Reintentar</button></p>}
        {cursorHueco && datosVigentes && <button onClick={() => void completarHueco()} className="mb-2 w-full rounded-tarjeta bg-tibio-suave px-4 py-2 text-sm font-semibold text-tinta">Hay más comentarios nuevos · completar carga</button>}
        {estado === "ok" && datosVigentes && comentarios.length === 0 && conFiltros && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Ningún comentario con estos filtros</p>
            <button
              onClick={() => setFiltros(SIN_FILTROS)}
              className="mt-3 text-[0.88rem] font-semibold text-brasa-texto hover:text-brasa-hondo"
            >
              Quitar filtros
            </button>
          </div>
        )}
        {estado === "ok" && datosVigentes && comentarios.length === 0 && !conFiltros && redesVigentes && redes && redes.length > 0 && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Aún no hay comentarios</p>
            <p className="mt-1 text-[0.88rem] text-frio">
              Cuando alguien comente tus publicaciones de {textoRedes(redes)}, aparece aquí.
              Los comentarios anteriores a la conexión no llegan.
            </p>
          </div>
        )}
        {estado === "ok" && datosVigentes && comentarios.length === 0 && !conFiltros && redesVigentes && redes !== null && redes.length === 0 && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Aún no hay comentarios</p>
            <p className="mt-1 text-[0.88rem] text-frio">
              Cuando conectes tus redes, los comentarios nuevos aparecerán aquí.
            </p>
            <Link
              href="/configuracion"
              className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition active:scale-[0.99]"
            >
              Conectar mis redes
            </Link>
          </div>
        )}
        {estado === "ok" && datosVigentes && comentarios.length === 0 && !conFiltros && !redesVigentes && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="font-bold text-tinta">Aún no hay comentarios</p>
            <p className="mt-1 text-sm text-frio">{errorRedes ? "No pudimos confirmar el estado de las redes; reintenta la carga antes de conectarlas." : "Comprobando las redes conectadas…"}</p>
          </div>
        )}

        {estado === "ok" && datosVigentes && comentarios.length > 0 && (
          <div className="space-y-2.5">
            {comentarios.map((c) => {
              const et = INTENCION[c.intencion ?? "otro"] ?? INTENCION.otro;
              const version = generacion.current;
              return (
                <ComentarioCaptado
                  key={c.id}
                  c={c}
                  etiqueta={et}
                  tenant={g.tenantLista}
                  onRespondido={(nuevo) => {
                    if (version !== generacion.current) return;
                    secuenciaSondeo.current++;
                    setComentarios((xs) => xs.map((x) => (x.id === nuevo.id ? { ...x, ...nuevo } : x))
                      .filter((x) => filtros.tipo !== "sin_responder" || !x.respondido));
                  }}
                  onActualizar={() => { if (version === generacion.current) void cargar(true); }}
                />
              );
            })}
            {hayMas && (
              <button
                onClick={verMas}
                disabled={cargandoMas}
                className="w-full rounded-tarjeta bg-carta py-3 text-[0.88rem] font-semibold text-brasa-texto ring-1 ring-linea transition hover:bg-arena/50 disabled:opacity-50"
              >
                {cargandoMas ? "Cargando…" : "Ver más comentarios"}
              </button>
            )}
            {errorMas && <p role="alert" className="text-sm text-calor-hondo">{errorMas} <button onClick={verMas} className="font-semibold underline">Reintentar</button></p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Qué red es, en palabras del dueño: en el modelo, Facebook es "messenger". */
const RED: Record<string, string> = { instagram: "Instagram", messenger: "Facebook" };

/**
 * UN COMENTARIO CAPTADO, CON RESPUESTA A MANO (2026-09-29). La IA solo contesta
 * los de intención de compra; el resto quedaba sin respuesta y el dueño tenía
 * que irse a la red a contestarlo. Las simulaciones (post "post_demo") no se
 * pueden responder: no existen en Meta.
 */
function ComentarioCaptado({
  c, etiqueta, tenant, onRespondido, onActualizar,
}: {
  c: Comentario;
  etiqueta: { texto: string; clase: string };
  tenant?: string;
  onRespondido: (c: Comentario) => void;
  onActualizar: () => void;
}) {
  const esSimulacion = c.esPrueba || c.postExterno === "post_demo";
  const red = RED[c.canal] ?? c.canal;
  const envio = describirEnvio({ ...c, esPrueba: !!esSimulacion });
  const puedePublica = !c.respondido && ["pendiente", "omitido", "fallido"].includes(c.estadoPublico ?? "omitido");
  const puedePrivada = !c.dmAbierto && ["pendiente", "omitido", "fallido"].includes(c.estadoPrivado ?? "omitido");
  const [abierto, setAbierto] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [privado, setPrivado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "parcial" | "error"; texto: string } | null>(null);

  async function enviar() {
    const t = respuesta.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setAviso(null);
    const r = await responderComentario(c.id, { texto: t, privado: !puedePublica || privado, tenant });
    setEnviando(false);
    if (r.ok) {
      onRespondido(r.comentario);
      const salidas = [r.publica ? `en ${red}` : "", r.privada ? "por privado" : ""].filter(Boolean).join(" y ");
      setAviso({ tipo: r.error ? "parcial" : "ok", texto: `Meta aceptó la respuesta ${salidas}.${r.error ? ` Otra salida falló: ${r.error}` : ""}` });
      setRespuesta("");
      setAbierto(false);
    } else {
      setAviso({ tipo: "error", texto: r.error });
      if (r.comentario) onRespondido(r.comentario);
      else onActualizar();
    }
  }

  return (
    <article className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 font-semibold text-tinta">
          {c.autorNombre ?? "Alguien"} comentó
          {!esSimulacion && <span className="font-normal text-frio"> en {red}</span>}:
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${etiqueta.clase}`}>
          {etiqueta.texto}
        </span>
      </div>
      <p className="mt-1 text-[0.9rem] text-tinta-2">“{c.texto}”</p>

      <div className="mt-2 flex flex-wrap gap-2 text-[0.76rem] text-tinta-2">
        <span className="rounded-chip bg-arena px-2 py-1">Público: {envio.publico}</span>
        <span className="rounded-chip bg-arena px-2 py-1">DM: {envio.privado}</span>
        {esSimulacion && <span className="rounded-chip bg-tibio-suave px-2 py-1">Prueba histórica</span>}
      </div>
      {envio.requiereRevision && <p role="status" className="mt-2 text-[0.8rem] text-calor-hondo">Meta pudo haber recibido el mensaje. Revísalo allí antes de volver a responder.</p>}
      {(c.errorPublico || c.errorPrivado) && <p className="mt-1 text-[0.78rem] text-calor-hondo">{[c.errorPublico, c.errorPrivado].filter(Boolean).join(" · ")}</p>}

      {c.respondido && c.respuestaTexto && (
        <div className="mt-2 rounded-chip bg-brasa-suave/40 px-3 py-2 text-[0.84rem] text-tinta-2">
          <span className="font-semibold text-brasa-hondo">{esSimulacion ? "La IA respondería: " : "Respondido: "}</span>
          “{c.respuestaTexto}”
          {c.dmAbierto && (
            <span className="ml-1 text-frio">{esSimulacion ? "· y abriría un DM 📩" : "· y se le escribió por privado 📩"}</span>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {c.leadId && (
          <Link
            href={`/conversacion/${c.leadId}`}
            className="text-[0.82rem] font-semibold text-brasa-texto hover:text-brasa-hondo"
          >
            Ver conversación →
          </Link>
        )}
        {!esSimulacion && !abierto && (puedePublica || puedePrivada) && (
          <button
            onClick={() => { setAbierto(true); setAviso(null); }}
            className="text-[0.82rem] font-semibold text-brasa-texto hover:text-brasa-hondo"
          >
            {puedePublica ? "Responder" : "Escribir por privado"}
          </button>
        )}
      </div>

      {abierto && (
        <div className="mt-2.5 space-y-2 rounded-tarjeta bg-arena/50 p-3">
          <textarea
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            rows={2}
            maxLength={1000}
            autoFocus
            aria-label={`Respuesta al comentario de ${c.autorNombre ?? "este cliente"}`}
            placeholder={puedePublica ? `Tu respuesta sale en ${red}, debajo del comentario` : "Tu respuesta se enviará solo por privado"}
            className="w-full resize-none rounded-chip bg-carta px-3 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
          />
          <label className="flex items-center gap-2 text-[0.82rem] text-tinta-2">
            <input type="checkbox" checked={!puedePublica || privado} disabled={!puedePublica || !puedePrivada} onChange={(e) => setPrivado(e.target.checked)} />
            También escribirle por privado (le llega como mensaje)
          </label>
          <div className="flex gap-2">
            <button
              onClick={enviar}
              disabled={enviando || !respuesta.trim()}
              className="rounded-chip bg-brasa px-4 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
            >
              {enviando ? "Respondiendo…" : puedePublica ? `Responder en ${red}` : "Enviar por privado"}
            </button>
            <button
              onClick={() => { setAbierto(false); setAviso(null); }}
              className="rounded-chip px-3 py-2 text-sm font-semibold text-tinta-2 hover:text-tinta"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {aviso && (
        <p role="status" className={`mt-2 text-[0.82rem] font-semibold ${aviso.tipo === "ok" ? "text-brasa-hondo" : "text-calor-hondo"}`}>
          {aviso.tipo === "ok" ? "✓ " : ""}{aviso.texto}
        </p>
      )}
    </article>
  );
}

const TIPOS: Array<{ v: Tipo; texto: string }> = [
  { v: "", texto: "Todos" },
  { v: "compra", texto: "🛒 Compra" },
  { v: "pregunta", texto: "❓ Preguntas" },
  { v: "halago", texto: "💬 Halagos" },
  { v: "sin_responder", texto: "Sin responder" },
];
const RANGOS: Array<{ v: Rango; texto: string }> = [
  { v: "todo", texto: "Todo" },
  { v: "hoy", texto: "Hoy" },
  { v: "7", texto: "7 días" },
  { v: "30", texto: "30 días" },
];

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[0.8rem] font-semibold transition ${
        activo ? "bg-tinta text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea hover:bg-arena/60"
      }`}
    >
      {children}
    </button>
  );
}

/** Red, tipo y fecha. La red solo aparece si el negocio tiene las dos conectadas. */
function BarraFiltros({ filtros, redes, onCambiar }: { filtros: Filtros; redes: string[]; onCambiar: (f: Filtros) => void }) {
  const set = (p: Partial<Filtros>) => onCambiar({ ...filtros, ...p });
  return (
    <div className="mb-3 space-y-2">
      {redes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <Chip activo={filtros.red === ""} onClick={() => set({ red: "" })}>Todas las redes</Chip>
          <Chip activo={filtros.red === "instagram"} onClick={() => set({ red: "instagram" })}>Instagram</Chip>
          <Chip activo={filtros.red === "messenger"} onClick={() => set({ red: "messenger" })}>Facebook</Chip>
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TIPOS.map((t) => (
          <Chip key={t.v || "todos"} activo={filtros.tipo === t.v} onClick={() => set({ tipo: t.v })}>{t.texto}</Chip>
        ))}
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <span className="shrink-0 text-[0.76rem] font-semibold uppercase tracking-wide text-frio">Fecha</span>
        {RANGOS.map((r) => (
          <Chip key={r.v} activo={filtros.rango === r.v} onClick={() => set({ rango: r.v })}>{r.texto}</Chip>
        ))}
      </div>
    </div>
  );
}
