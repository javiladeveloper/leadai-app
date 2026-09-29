"use client";

// Componente reutilizable: la página de Next no recibe la prop embebido.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerEmpresaActiva, empresasVisibles } from "@/lib/auth";
import { leerBorradorAnuncio, guardarBorradorAnuncio, borrarBorradorAnuncio, type BorradorAnuncioLocal } from "@/lib/marketing-borrador";
import {
  objetivosAd, publicoSugeridoAd, presupuestoAd, sugerirTextoAd, listarAnuncios, crearAnuncio,
  publicarAnuncioMeta, subirMediaPost, canalesAd,
  type ObjetivoAd, type PublicoAd, type RecomPresupuesto, type Anuncio, type CanalAd,
  bolsaAnuncios, type BolsaAnuncios,
  publicosEnMeta, type PublicoEnMeta,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { HeroSeccion, CabeceraFormulario, AnuncioIlustracion } from "@/components/panel/HeroSeccion";

type Estado = "cargando" | "ok" | "error";

const ESTADO_AD: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-arena text-frio" },
  publicando: { texto: "En proceso · requiere verificar", clase: "bg-tibio-suave text-tibio" },
  en_revision: { texto: "En revisión de Meta", clase: "bg-tibio-suave text-tibio" },
  activo: { texto: "Activo", clase: "bg-ok/12 text-ok" },
  pausado: { texto: "Pausado", clase: "bg-tibio-suave text-tibio" },
  finalizado: { texto: "Finalizado", clase: "bg-arena text-frio" },
  rechazado: { texto: "Rechazado", clase: "bg-calor-suave text-calor-hondo" },
};

const AVISO_PUBLICANDO = "La publicación está en proceso o requiere revisión. Verifica su estado antes de continuar; no vuelvas a publicarla ni crees una copia para evitar duplicados y cargos.";

// Zonas seleccionables (sin texto libre → sin typos tipo "takna"). Cuando se
// conecte Meta, esto evoluciona al buscador de geolocalización real de Meta
// (Targeting Search API), que valida ciudades/regiones exactas.
const ZONAS = [
  "Todo Perú",
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
  "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad",
  "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco",
  "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

// Creador guiado: prepara un borrador y luego lo publica en la cuenta real
// de Meta del negocio seleccionado. Encenderlo implica gasto real.
/**
 * `embebido`: esta pantalla se monta DENTRO de /marketing, que ya puso el
 * título y la barra de negocios. Sin esto, se verían dos veces.
 */
export default function AnunciosPanel({ embebido = false, tenant, nombreNegocio, solicitudHistorial = 0 }: { embebido?: boolean; tenant?: string; nombreNegocio?: string; solicitudHistorial?: number } = {}) {
  if (!embebido) return <AnunciosIndependientes />;
  if (!tenant) return <p role="status">Selecciona un negocio para crear su anuncio.</p>;
  return <CreadorAnuncios key={tenant} embebido tenant={tenant} nombreNegocio={nombreNegocio} solicitudHistorial={solicitudHistorial} />;
}

function AnunciosIndependientes() {
  const g = useSeccionGlobal();
  if (!g.resuelto || !g.listaLista) return <SkeletonLista filas={3} />;
  const tenant = g.tenantLista ?? leerEmpresaActiva() ?? empresasVisibles()[0]?.tenantId;
  if (!tenant) return <p role="status">Selecciona un negocio para crear su anuncio.</p>;
  const nombre = g.negocios.find(n => n.tenantId === tenant)?.nombre ?? empresasVisibles().find(n => n.tenantId === tenant)?.nombre;
  return <div>
    {g.modoGlobal && <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />}
    <CreadorAnuncios key={tenant} tenant={tenant} nombreNegocio={nombre} />
  </div>;
}

function CreadorAnuncios({ embebido = false, tenant, nombreNegocio, solicitudHistorial = 0 }: { embebido?: boolean; tenant: string; nombreNegocio?: string; solicitudHistorial?: number }) {
  const router = useRouter();
  const [borrador] = useState(() => leerBorradorAnuncio(tenant));
  const [borradorId, setBorradorId] = useState(borrador?.id);
  const [errorLocal, setErrorLocal] = useState("");
  const vivo = useRef(true);
  const bloqueo = useRef(false);
  const cargandoId = useRef(0);
  const imagenId = useRef(0);
  const sugerenciaId = useRef(0);
  const ultimaEdicionTexto = useRef(0);
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoAd[]>([]);
  const [creando, setCreando] = useState(false);

  // Abrir el historial conserva el formulario en memoria y su copia local.
  // La señal cambia en cada acceso, incluso si el creador ya estaba montado.
  useEffect(() => {
    if (solicitudHistorial > 0) setCreando(false);
  }, [solicitudHistorial]);

  // Wizard
  const [paso, setPaso] = useState(borrador?.paso ?? 0); // 0=objetivo 1=contenido 2=publico 3=presupuesto 4=resumen
  const [objetivo, setObjetivo] = useState(borrador?.objetivo ?? "mensajes");
  const [campania, setCampania] = useState(borrador?.campania ?? "");
  const [texto, setTexto] = useState(borrador?.texto ?? "");
  const [mediaUrl, setMediaUrl] = useState(borrador?.mediaUrl ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [publico, setPublico] = useState<PublicoAd | null>(borrador ? { edadMin: Number(borrador.edadMin), edadMax: Number(borrador.edadMax), intereses: borrador.intereses } : null);
  // DÓNDE aparece el anuncio (2026-09-07, pedido de Jonathan). Default 'todos':
  // sin restringir, Meta reparte entre Facebook, Instagram y WhatsApp buscando
  // el menor costo por conversación. Restringir NO baja el presupuesto (lo fija
  // el dueño y se gasta igual): solo achica el inventario donde competir.
  const [canales, setCanales] = useState<CanalAd[]>([]);
  const [canal, setCanal] = useState(borrador?.canal ?? "todos");
  const [zona, setZona] = useState(borrador?.zona ?? "Todo Perú");
  const [edadMin, setEdadMin] = useState(borrador?.edadMin ?? "18");
  // PUBLICOS PROPIOS (2026-09-18, pedido de Jonathan: "si quiero tirar otra
  // campania pero que no le llegue a ellos, como se hace").
  const [misPublicos, setMisPublicos] = useState<PublicoEnMeta[]>([]);
  const [incluir, setIncluir] = useState<string[]>(borrador?.incluir ?? []);
  const [excluir, setExcluir] = useState<string[]>(borrador?.excluir ?? []);
  const [edadMax, setEdadMax] = useState(borrador?.edadMax ?? "55");
  const [total, setTotal] = useState(borrador?.total ?? "100");
  const [dias, setDias] = useState(borrador?.dias ?? "7");
  const [recom, setRecom] = useState<RecomPresupuesto | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  // ENCENDERLO ES SUYO (2026-08-27, Jonathan: "¿no hay forma que lo creemos no
  // en pausa?"). Meta sí lo permite; el default queda apagado porque el gasto
  // va a SU tarjeta y un presupuesto mal puesto le cuesta plata antes de verlo.
  const [encender, setEncender] = useState(false);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [msg, setMsg] = useState("");
  // La bolsa publicitaria (2026-08-23): el presupuesto de cada anuncio se
  // debita de acá — bono mensual del plan + lo recargado con nosotros.
  const [bolsa, setBolsa] = useState<BolsaAnuncios | null>(null);
  // Un error de publicación no prueba que Meta no haya creado el anuncio.
  // Sólo el estado remoto confirmado permite reintentar o preparar otro.
  const anuncioGuardado = anuncios.find(a => a.id === borradorId);
  const borradorConfirmado = estado === "ok" && anuncioGuardado?.estado === "borrador";

  // La instancia está identificada por tenant; ninguna respuesta de una
  // instancia desmontada puede cambiar el negocio siguiente.
  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  const tieneBorrador = !!(campania || texto || mediaUrl || borradorId);
  useEffect(() => {
    if (!creando && !tieneBorrador) return;
    const guardado = guardarBorradorAnuncio(tenant, {
      id: borradorId, paso, objetivo, campania, texto, mediaUrl, canal, zona,
      edadMin, edadMax, total, dias, incluir, excluir, intereses: publico?.intereses ?? [],
    });
    setErrorLocal(guardado ? "" : "No pudimos guardar el borrador en este navegador. Mantén esta página abierta para conservarlo.");
  }, [tenant, creando, tieneBorrador, borradorId, paso, objetivo, campania, texto, mediaUrl, canal, zona, edadMin, edadMax, total, dias, incluir, excluir, publico]);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    const solicitud = ++cargandoId.current;
    setEstado("cargando");
    try {
      const [a, o, b] = await Promise.all([
        listarAnuncios(tenant), objetivosAd(tenant), bolsaAnuncios(tenant),
      ]);
      if (!vivo.current || solicitud !== cargandoId.current) return;
      setAnuncios(a);
      setObjetivos(o);
      setBolsa(b);
      setEstado("ok");
    } catch { if (vivo.current && solicitud === cargandoId.current) setEstado("error"); }
  }, [tenant]);

  useEffect(() => { if (listo) void cargar(); }, [listo, cargar]);

  // Al entrar al paso de público, carga el sugerido por rubro. La edad sugerida
  // precarga los campos, pero el usuario la puede ajustar libremente.
  useEffect(() => {
    if (!creando || paso !== 2) return;
    let vigente = true;
    void Promise.all([publicoSugeridoAd(tenant), publicosEnMeta(tenant), canalesAd(tenant)])
      .then(([p, ps, cs]) => {
        if (!vigente) return;
        // Las sugerencias nunca pisan edades que el usuario ya editó.
        setPublico(prev => prev ?? p);
        setMisPublicos(ps.filter(x => x.listo)); setCanales(cs);
      }).catch(() => { if (vigente) setMsg("No pudimos cargar tus públicos. Vuelve a este paso para reintentar."); });
    return () => { vigente = false; };
  }, [creando, paso, tenant]);

  // Al entrar al paso de presupuesto (o cambiar total/días), recalcula.
  useEffect(() => {
    if (!creando || paso !== 3) return;
    let vigente = true;
    setRecom(null);
    const t = Number(total), d = Number(dias);
    if (!Number.isFinite(t) || t <= 0 || !Number.isInteger(d) || d < 1 || d > 90) return;
    const id = setTimeout(() => {
      void presupuestoAd(t, d, tenant).then(r => { if (vigente) setRecom(r); })
        .catch(() => { if (vigente) setMsg("No pudimos calcular la recomendación. Revisa el importe e inténtalo de nuevo."); });
    }, 300);
    return () => { vigente = false; clearTimeout(id); };
  }, [creando, paso, total, dias, tenant]);

  async function sugerirTexto() {
    if (!campania.trim() || sugiriendo) return;
    const solicitud = ++sugerenciaId.current;
    const edicion = ultimaEdicionTexto.current;
    setSugiriendo(true);
    try {
      const t = await sugerirTextoAd(campania.trim(), tenant);
      if (!vivo.current || solicitud !== sugerenciaId.current) return;
      if (t && edicion === ultimaEdicionTexto.current) setTexto(t);
      else if (!t) setMsg("No pudimos generar el texto. Puedes escribirlo o volver a intentarlo.");
    } finally { if (vivo.current) setSugiriendo(false); }
  }

  // La imagen es OBLIGATORIA: Meta rechaza la pieza sin ella ("specify the
  // media"). Reusa la subida de /publicaciones/media (Supabase público).
  async function elegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setMsg("Elige una imagen de hasta 10 MB."); return;
    }
    const solicitud = ++imagenId.current;
    setSubiendo(true);
    setMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      if (!vivo.current || solicitud !== imagenId.current) return;
      try {
        const r = await subirMediaPost(String(reader.result), tenant);
        if (!vivo.current || solicitud !== imagenId.current) return;
        if (r.ok && r.url) setMediaUrl(r.url);
        else setMsg(r.error ?? "No se pudo subir la imagen.");
      } catch { if (vivo.current) setMsg("No se pudo subir la imagen. Inténtalo de nuevo."); }
      finally { if (vivo.current) setSubiendo(false); }
    };
    reader.onerror = () => { if (vivo.current) { setSubiendo(false); setMsg("No se pudo leer la imagen. Elige otra e inténtalo de nuevo."); } };
    reader.readAsDataURL(file);
  }

  function limpiarFormulario() {
    setBorradorId(undefined);
    setCreando(false); setPaso(0); setObjetivo("mensajes");
    setCampania(""); setTexto(""); setMediaUrl(""); setPublico(null);
    setCanal("todos"); setZona("Todo Perú"); setIncluir([]); setExcluir([]);
    setEdadMin("18"); setEdadMax("55"); setTotal("100"); setDias("7");
    setRecom(null); setEncender(false); setMsg("");
  }

  function descartarLocalYCrearOtro() {
    if (bloqueo.current || !borradorId || !borradorConfirmado) return;
    if (!window.confirm("¿Descartar el borrador local y preparar otro anuncio con estos datos para corregirlos? El borrador remoto seguirá guardado. No se creará ni publicará otro anuncio hasta que pulses Publicar anuncio.")) return;
    if (!borrarBorradorAnuncio(tenant)) {
      setErrorLocal("No pudimos descartar el borrador local. Revisa el almacenamiento del navegador e inténtalo de nuevo.");
      return;
    }
    // Conserva los datos editables, pero nunca hereda el ID ni la autorización
    // de encendido del anuncio anterior. Publicar exigirá una nueva acción.
    setBorradorId(undefined);
    setEncender(false); setRecom(null); setMsg(""); setErrorLocal("");
    setPaso(1); setCreando(true);
    setAviso("El borrador remoto se conserva. Corrige los datos de este nuevo borrador antes de publicar.");
  }

  async function publicar() {
    if (bloqueo.current || !formularioValido || (borradorId && !borradorConfirmado)) return;
    bloqueo.current = true;
    setPublicando(true);
    setMsg("");
    try {
      const r = borradorId ? { ok: true, id: borradorId, error: undefined } : await crearAnuncio({
        objetivo,
        campaniaNombre: campania.trim(),
        texto: texto.trim(),
        mediaUrl: mediaUrl || undefined,
        publico: {
          zona, edadMin: Number(edadMin), edadMax: Number(edadMax),
          intereses: publico?.intereses ?? [],
          incluirPublicos: incluir.length ? incluir : undefined,
          excluirPublicos: excluir.length ? excluir : undefined,
        },
        presupuestoTotal: Number(total), dias: Number(dias), canal,
      }, tenant);
      if (!r.ok || !r.id) {
        if (vivo.current) setMsg(r.error ?? "No se pudo crear el anuncio.");
        return;
      }
      const pendiente: BorradorAnuncioLocal = {
        id: r.id, paso: 4, objetivo, campania, texto, mediaUrl, canal, zona,
        edadMin, edadMax, total, dias, incluir, excluir, intereses: publico?.intereses ?? [],
      };
      guardarBorradorAnuncio(tenant, pendiente);
      // Si se cambió de negocio mientras creaba, queda guardado para retomar.
      if (!vivo.current) return;
      setBorradorId(r.id);
      const p = await publicarAnuncioMeta(r.id, tenant, encender);
      if (p.ok) borrarBorradorAnuncio(tenant);
      if (!vivo.current) return;
      if (!p.ok) {
        setMsg(p.error ?? "No se pudo confirmar la publicación. Verifica el estado del anuncio.");
        await cargar();
        return;
      }
      limpiarFormulario();
      setAviso(`✅ ${p.aviso ?? (encender
        ? "Anuncio encendido y en revisión de Meta. Empezará a mostrarse cuando Meta lo apruebe."
        : "Anuncio publicado en Meta. Quedó PAUSADO: enciéndelo desde tu Ads Manager.")}`);
      void cargar();
    } catch {
      if (vivo.current) {
        setMsg("No se pudo confirmar la publicación. Conservamos los datos; verifica el estado antes de continuar.");
        await cargar();
      }
    }
    finally { bloqueo.current = false; if (vivo.current) setPublicando(false); }
  }

  async function publicarExistente(id: string) {
    if (bloqueo.current || estado !== "ok" || !anuncios.some(a => a.id === id && a.estado === "borrador")) return;
    bloqueo.current = true;
    setPublicandoId(id);
    try {
      const p = await publicarAnuncioMeta(id, tenant);
      if (p.ok && borradorId === id) borrarBorradorAnuncio(tenant);
      if (!vivo.current) return;
      if (p.ok && borradorId === id) limpiarFormulario();
      setAviso(p.ok
        ? `✅ ${p.aviso ?? "Anuncio publicado en Meta. Quedó PAUSADO: enciéndelo desde tu Ads Manager."}`
        : `⚠️ ${p.error ?? "No se pudo publicar el anuncio."}`);
      await cargar();
    } catch {
      if (vivo.current) {
        setAviso("No se pudo confirmar la publicación. Verifica el estado del anuncio antes de continuar.");
        await cargar();
      }
    }
    finally { bloqueo.current = false; if (vivo.current) setPublicandoId(null); }
  }

  if (!listo) return null;

  const objSel = objetivos.find((o) => o.id === objetivo);
  const edadValida = Number(edadMin) >= 18 && Number(edadMax) <= 65 && Number(edadMin) <= Number(edadMax);
  const presupuestoValido = Number.isFinite(Number(total)) && Number(total) > 0 && Number.isInteger(Number(dias)) && Number(dias) >= 1 && Number(dias) <= 90;
  const formularioValido = objetivo === "mensajes" && !!campania.trim() && !!texto.trim() && !!mediaUrl && edadValida && presupuestoValido;
  const puedeAvanzar =
    (paso === 0 && objetivo === "mensajes") ||
    (paso === 1 && campania.trim() && texto.trim() && mediaUrl) ||
    (paso === 2 && edadValida) ||
    (paso === 3 && presupuestoValido);

  return (
    <div className={embebido ? "space-y-6" : "mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8"}>
      {/* EL HERO (2026-08-27, Jonathan: "lo mismo haz para campañas y
          anuncios"). Antes abría con un título y una línea gris: alguien que
          nunca pautó no sabe qué gana ni en qué se diferencia de Campañas. */}
      {embebido && (
        <HeroSeccion
          titulo="Que te conozca gente que nunca te compró"
          bajada={<>Pagas para que tu carta aparezca en Instagram y Facebook frente a personas de tu zona que todavía no te conocen.</>}
          nota="La IA arma el anuncio contigo. Tú decides cuánto gastar."
          dibujo={<AnuncioIlustracion />}
        />
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!embebido && (
            <>
              <p className="eyebrow">Tu embudo</p>
              <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Anuncios</h1>
              <p className="mt-1 text-[0.92rem] text-frio">
                Crea anuncios en Instagram y Facebook con la ayuda de la IA. Te guía paso a paso.
              </p>
            </>
          )}
          {/* LA BOLSA PUBLICITARIA (2026-08-23): la plata de los anuncios pasa
              por LeadAI — el plan regala un bono cada mes y lo demás se
              recarga con nosotros. Al publicar, el presupuesto sale de aquí. */}
          {bolsa && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-tarjeta bg-carta px-3.5 py-2 text-[0.84rem] text-tinta-2 ring-1 ring-linea">
              💰 Tu bolsa publicitaria: <b className="text-tinta">S/{(bolsa.disponiblesCentavos / 100).toFixed(2)}</b>
              {/* El desglose del bono solo si EXISTE un bono (hoy los planes
                  van sin bono: los anuncios se pagan aparte, por recarga). */}
              {(bolsa.bonoCentavos > 0 || bolsa.bonoPlanCentavos > 0) && (
                <> (S/{(bolsa.bonoCentavos / 100).toFixed(2)} del bono del mes + S/{(bolsa.saldoCentavos / 100).toFixed(2)} recargados)</>
              )}
              {/* Sin el punto suelto del inicio (2026-08-24): cuando no hay
                  bono que desglosar, la frase anterior termina y esta abría
                  con un "." huérfano. */}
              <span>El presupuesto de cada anuncio sale de aquí — se paga por recarga con LeadAI.</span>
            </p>
          )}
        </div>
        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="rounded-chip bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
          >
            {tieneBorrador ? "Retomar borrador" : "+ Crear anuncio"}
          </button>
        )}
      </header>

      {errorLocal && <p role="alert" className="text-sm text-alerta-hondo">{errorLocal}</p>}
      {tieneBorrador && !errorLocal && <p className="text-sm text-frio">Borrador guardado en este navegador para {nombreNegocio || "este negocio"}.</p>}
      {borradorId && !borradorConfirmado && (
        <div role="status" className="space-y-2 rounded-tarjeta bg-tibio-suave/50 p-4 text-sm text-tinta-2 ring-1 ring-tibio/30">
          {anuncioGuardado?.estado === "publicando" ? <>
            <p className="font-semibold">{ESTADO_AD.publicando.texto}</p>
            <p>{AVISO_PUBLICANDO}</p>
          </> : <p>{estado === "ok" && anuncioGuardado
            ? "Este anuncio ya no es un borrador. Revisa su estado antes de continuar; no se volverá a publicar ni se creará una copia."
            : "Necesitamos verificar el estado del anuncio guardado antes de reintentar o preparar otro. Tus datos locales se conservan."}</p>}
          <button type="button" onClick={() => void cargar()} disabled={estado === "cargando" || publicando || publicandoId !== null} className="font-semibold text-brasa-texto disabled:opacity-50">Verificar estado</button>
        </div>
      )}
      {borradorId && borradorConfirmado && (
        <button
          type="button"
          onClick={descartarLocalYCrearOtro}
          disabled={publicando || publicandoId !== null}
          className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-brasa-texto ring-1 ring-linea transition hover:bg-arena disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brasa"
        >
          Descartar borrador local y crear otro
        </button>
      )}

      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        📣 Tus anuncios se crean de verdad en tu cuenta publicitaria de Meta.{" "}
        <b>El gasto va a tu propio medio de pago</b>, no a LeadAI. Por defecto quedan
        en pausa y los enciendes tú.
      </div>

      {aviso && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-tarjeta bg-ok/8 px-4 py-3 text-[0.86rem] text-tinta-2 ring-1 ring-ok/25">
          <span>{aviso}</span>
          <button aria-label="Cerrar aviso" onClick={() => setAviso("")} className="shrink-0 text-frio hover:text-tinta">✕</button>
        </div>
      )}

      {/* Wizard de creación */}
      {creando && (
        <fieldset disabled={publicando} aria-busy={publicando} className="min-w-0 space-y-4 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          {/* El wizard ya tenía barra de pasos, pero arrancaba en frío: sin
              decir qué se está por hacer ni que se puede salir. */}
          <CabeceraFormulario
            icono={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" />
                <path d="M15 8a5 5 0 010 8" />
                <path d="M18.5 5a9 9 0 010 14" />
              </svg>
            }
            titulo="Vamos a armar tu anuncio"
            bajada="Cuatro pasos: qué quieres lograr, qué mostrar, a quién y cuánto gastar. Puedes volver atrás en cualquiera."
            onCerrar={() => { if (!bloqueo.current) setCreando(false); }}
          />
          {/* Progreso */}
          <div className="mb-4 flex items-center gap-1.5">
            {["Objetivo", "Contenido", "Público", "Presupuesto", "Resumen"].map((t, i) => (
              <div key={t} className="flex flex-1 flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full ${i <= paso ? "bg-brasa" : "bg-linea"}`} />
                <span className={`text-[0.68rem] ${i === paso ? "font-bold text-tinta" : "text-frio"}`}>{t}</span>
              </div>
            ))}
          </div>

          {/* Paso 0 — Objetivo */}
          {paso === 0 && (
            <div>
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Qué quieres conseguir?</h2>
              <p className="mt-0.5 text-[0.82rem] text-frio">Elige tu meta y armamos el anuncio para eso.</p>
              <div className="mt-3 space-y-2">
                {objetivos.map((o) => (
                  <button
                    key={o.id}
                    disabled={o.id !== "mensajes"}
                    aria-pressed={objetivo === o.id}
                    onClick={() => { if (o.id === "mensajes") setObjetivo(o.id); }}
                    className={`w-full rounded-tarjeta border p-3.5 text-left transition ${
                      objetivo === o.id ? "border-brasa bg-brasa-suave" : "border-linea bg-carta hover:border-brasa/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[0.95rem] font-bold text-tinta">{o.pregunta}</span>
                      {o.recomendado && <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[0.66rem] font-bold text-ok">Recomendado</span>}
                    </div>
                    <p className="mt-1 text-[0.8rem] text-tinta-2">{o.porque}</p>
                    {o.id !== "mensajes" && <p className="mt-1 text-sm text-frio">Aún no disponible para publicar desde LeadAI.</p>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Paso 1 — Contenido */}
          {paso === 1 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Qué vas a promocionar?</h2>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Nombre de la campaña</label>
                <input
                  value={campania}
                  aria-label="Nombre de la campaña"
                  onChange={(e) => setCampania(e.target.value)}
                  placeholder="Ej: Promo declaración anual"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Así vas a reconocer de qué campaña vienen tus leads.</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[0.85rem] font-bold text-tinta">Texto del anuncio</label>
                  <button onClick={sugerirTexto} disabled={sugiriendo || !campania.trim()} className="text-[0.8rem] font-semibold text-brasa-texto disabled:opacity-40">
                    {sugiriendo ? "Pensando…" : "✨ Escribir con IA"}
                  </button>
                </div>
                <textarea
                  value={texto}
                  aria-label="Texto del anuncio"
                  onChange={(e) => { ultimaEdicionTexto.current++; setTexto(e.target.value); }}
                  rows={4}
                  placeholder="Pon el nombre de la campaña y toca 'Escribir con IA', o escríbelo tú…"
                  className="mt-1 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Tip: la primera frase es la que engancha. Usá algo que frene el scroll.</p>
              </div>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Imagen del anuncio</label>
                {mediaUrl ? (
                  <div className="mt-1 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl} alt="Imagen del anuncio" className="h-20 rounded-tarjeta object-cover ring-1 ring-linea" />
                    <button onClick={() => setMediaUrl("")} className="text-[0.8rem] font-semibold text-calor-hondo">Quitar</button>
                  </div>
                ) : (
                  <label className="relative mt-1 flex cursor-pointer items-center justify-center rounded-tarjeta border-2 border-dashed border-linea bg-arena/40 px-3 py-5 text-[0.86rem] text-frio transition hover:border-brasa/40 focus-within:ring-2 focus-within:ring-brasa">
                    {subiendo ? "Subiendo…" : "📷 Subir imagen (obligatoria — Meta la exige)"}
                    <input type="file" aria-label="Subir imagen del anuncio" accept="image/*" onChange={elegirImagen} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={subiendo} />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Paso 2 — Público */}
          {paso === 2 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿A quién le mostramos el anuncio?</h2>
              <p className="text-[0.82rem] text-frio">
                Te sugerimos un público según tu rubro — ajustalo como quieras. Con un público
                amplio Meta suele rendir mejor (su sistema encuentra a los interesados solo).
              </p>
              {publico && (
                <div className="rounded-tarjeta bg-arena/50 p-3.5">
                  <p className="text-[0.85rem] font-semibold text-tinta">Sugerido para tu rubro: {publico.nota}</p>
                  {publico.intereses.length > 0 && (
                    <p className="mt-1 text-[0.82rem] text-tinta-2">Intereses: {publico.intereses.join(", ")}</p>
                  )}
                </div>
              )}

              {/* DÓNDE APARECE (2026-09-07, pedido de Jonathan: "que pueda
                  escoger a qué canal quiere salir la publicidad"). Va acá y no
                  en su propio paso: "a quién" y "dónde" son la misma decisión.
                  El aviso del costo es explícito porque la intuición engaña —
                  recortar canales no abarata, encarece por persona alcanzada. */}
              {canales.length > 0 && (
                <div className="pt-1">
                  <p className="text-[0.85rem] font-bold text-tinta">¿Dónde quieres que aparezca?</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {canales.map((c) => {
                      const activo = canal === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCanal(c.id)}
                          aria-pressed={activo}
                          className={`rounded-tarjeta p-3 text-left transition ${
                            activo
                              ? "bg-brasa-suave ring-2 ring-brasa"
                              : "bg-carta ring-1 ring-linea hover:ring-brasa/40"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className="text-[0.9rem] font-bold text-tinta">{c.nombre}</span>
                            {c.recomendado && (
                              <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[0.68rem] font-bold text-ok">
                                Recomendado
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-[0.78rem] leading-snug text-frio">{c.porque}</span>
                        </button>
                      );
                    })}
                  </div>
                  {canales.find((c) => c.id === canal)?.vertical && !mediaUrl && (
                    <p className="mt-2 rounded-tarjeta bg-tibio-suave/60 px-3.5 py-2 text-[0.8rem] text-tinta-2">
                      📱 Ahí tu anuncio se ve a pantalla completa: sube una imagen <b>vertical</b> para que no salga recortada.
                    </p>
                  )}
                  <p className="mt-2 text-[0.72rem] text-frio">
                    Gastas lo mismo elijas lo que elijas: el presupuesto lo pones tú. Elegir menos lugares
                    solo hace que tu anuncio compita en un espacio más chico.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Zona</label>
                  <select
                    value={zona}
                    aria-label="Zona del anuncio"
                    onChange={(e) => setZona(e.target.value)}
                    className="mt-1 block w-52 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                  >
                    {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <p className="mt-1 text-[0.72rem] text-frio">Al conectar Meta vas a poder afinar por ciudad exacta.</p>
                </div>
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Edad</label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number" min={18} max={65} value={edadMin}
                      aria-label="Edad mínima"
                      onChange={(e) => setEdadMin(e.target.value)}
                      className="w-20 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                    />
                    <span className="text-frio">a</span>
                    <input
                      type="number" min={18} max={65} value={edadMax}
                      aria-label="Edad máxima"
                      onChange={(e) => setEdadMax(e.target.value)}
                      className="w-20 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                    />
                    <span className="text-[0.82rem] text-frio">años</span>
                  </div>
                  {Number(edadMin) > Number(edadMax) && (
                    <p className="mt-1 text-[0.74rem] font-semibold text-calor-hondo">La edad mínima no puede superar la máxima.</p>
                  )}
                </div>
              </div>

              {/* TUS PROPIAS LISTAS (2026-09-18). Lo que mas rinde es incluir
                  el SIMILAR y excluir la lista original: Meta busca parecidos
                  sin cobrarte por los que ya tenes. */}
              {misPublicos.length > 0 && (
                <div className="mt-4 border-t border-linea pt-4">
                  <label className="text-[0.85rem] font-bold text-tinta">Tus públicos</label>
                  <p className="mt-0.5 text-[0.8rem] text-frio">
                    Mostrale el anuncio solo a tu lista, o evitá a quienes ya
                    contactaste.
                  </p>

                  <div className="mt-3 space-y-2">
                    {misPublicos.map((pb) => (
                      <div key={pb.id} className="flex flex-wrap items-center justify-between gap-2 rounded-tarjeta bg-arena/40 px-3 py-2">
                        <span className="min-w-0 truncate text-[0.85rem] text-tinta">
                          {pb.nombre}
                          {pb.personas !== null && (
                            <span className="text-frio"> · {pb.personas.toLocaleString("es-PE")}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 gap-1.5">
                          {([
                            ["incluir", "Mostrar", incluir, setIncluir, excluir, setExcluir],
                            ["excluir", "Evitar", excluir, setExcluir, incluir, setIncluir],
                          ] as const).map(([clave, texto, lista, set, otra, setOtra]) => {
                            const activo = lista.includes(pb.id);
                            return (
                              <button
                                key={clave}
                                type="button"
                                onClick={() => {
                                  // Un publico no puede estar en los dos lados:
                                  // Meta lo rechaza y el anuncio no sale.
                                  set(activo ? lista.filter((x) => x !== pb.id) : [...lista, pb.id]);
                                  if (!activo && otra.includes(pb.id)) setOtra(otra.filter((x) => x !== pb.id));
                                }}
                                className={`rounded-chip px-2.5 py-1 text-[0.76rem] font-bold transition ${
                                  activo
                                    ? clave === "incluir" ? "bg-brasa text-sobre-brasa" : "bg-tibio text-carta"
                                    : "bg-arena text-tinta-2 ring-1 ring-linea hover:text-tinta"
                                }`}
                              >
                                {texto}
                              </button>
                            );
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paso 3 — Presupuesto */}
          {paso === 3 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Cuánto quieres invertir?</h2>
              <p className="text-[0.82rem] text-frio">
                Así funciona: tú pones el monto total y Meta lo reparte en los días que elijas
                (ese es el gasto por día). Lo que varía es el <b>resultado</b> — cuánta gente ve tu
                anuncio y cuántos te escriben depende de tu público, la competencia y qué tan bueno
                sea el anuncio. Por eso la estimación es un rango, no una promesa.
              </p>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Total (S/)</label>
                  <input aria-label="Presupuesto total en soles" type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)}
                    className="mt-1 w-28 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40" />
                </div>
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Durante (días)</label>
                  <input aria-label="Duración en días" type="number" min="1" max="90" value={dias} onChange={(e) => setDias(e.target.value)}
                    className="mt-1 w-24 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40" />
                </div>
              </div>
              {recom && (
                <div className={`rounded-tarjeta p-3.5 text-[0.84rem] ${recom.minimoOk ? "bg-ok/8 text-tinta-2" : "bg-tibio-suave/50 text-tinta-2"}`}>
                  <p><b>S/{recom.diario}/día.</b> {recom.aviso}</p>
                </div>
              )}
            </div>
          )}

          {/* Paso 4 — Resumen */}
          {paso === 4 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">Revisa antes de publicar</h2>
              <div className="space-y-1.5 rounded-tarjeta bg-arena/50 p-4 text-[0.86rem] text-tinta-2">
                <p><b className="text-tinta">Negocio:</b> {nombreNegocio || "Negocio seleccionado"}</p>
                <p><b className="text-tinta">Objetivo:</b> {objSel?.pregunta ?? objetivo}</p>
                <p><b className="text-tinta">Campaña:</b> {campania}</p>
                <p><b className="text-tinta">Texto:</b> “{texto}”</p>
                {mediaUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl} alt="Imagen del anuncio" className="h-24 rounded-tarjeta object-cover ring-1 ring-linea" />
                )}
                <p><b className="text-tinta">Público:</b> {zona} · {edadMin}–{edadMax} años</p>
                <p><b className="text-tinta">Dónde aparece:</b> {canales.find((c) => c.id === canal)?.nombre ?? "Donde mejor funcione"}</p>
                <p className="text-brasa-hondo"><b>Vas a gastar hasta S/{total} en {dias} días</b> (S/{(Number(total) / Number(dias) || 0).toFixed(2)}/día).</p>
              </div>
              {/* EL CHECK, APAGADO POR DEFECTO. Encenderlo empieza a gastar
                  de su tarjeta, así que tiene que ser un acto deliberado — no
                  algo que pase por no leer. */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-tarjeta bg-arena/50 p-3.5">
                <input
                  type="checkbox"
                  checked={encender}
                  onChange={(e) => setEncender(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brasa)]"
                />
                <span className="min-w-0">
                  <span className="block text-[0.88rem] font-bold text-tinta">
                    Encenderlo apenas se cree
                  </span>
                  <span className="mt-0.5 block text-[0.8rem] text-frio">
                    {encender
                      ? `Empieza a mostrarse y a gastar de tu medio de pago hoy mismo, hasta S/${total} en ${dias} días.`
                      : "Si lo dejas sin marcar, se crea en pausa y no gasta nada hasta que lo enciendas en tu Ads Manager."}
                  </span>
                </span>
              </label>
              <p className="text-[0.78rem] text-frio">
                ⏳ Cuando el anuncio esté activo, los primeros 3-7 días
                &ldquo;aprende&rdquo; — no lo pauses ni edites en ese tiempo
                para que rinda mejor.
              </p>
              {borradorId && borradorConfirmado && <p className="text-sm text-frio">El servidor confirma que sigue como borrador. Puedes reintentar su publicación o descartar la copia local para corregir los datos como otro anuncio; el borrador remoto se conserva.</p>}
            </div>
          )}

          {/* Navegación */}
          {msg && <p role="alert" className="text-[0.84rem] font-semibold text-calor-hondo">{msg}</p>}
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              onClick={() => (paso === 0 ? setCreando(false) : setPaso(paso - 1))}
              disabled={publicando || !!borradorId}
              className="rounded-chip bg-arena px-4 py-2 text-sm font-semibold text-tinta-2 transition hover:bg-linea"
            >
              {paso === 0 ? "Cancelar" : "Atrás"}
            </button>
            {paso < 4 ? (
              <button
                onClick={() => setPaso(paso + 1)}
                disabled={!puedeAvanzar}
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                Siguiente
              </button>
            ) : (!borradorId || borradorConfirmado) && (
              <button
                onClick={publicar}
                disabled={publicando || !formularioValido}
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                {publicando ? "Publicando…" : borradorId ? "Reintentar publicación" : "Publicar anuncio"}
              </button>
            )}
          </div>
        </fieldset>
      )}

      {/* Lista de anuncios */}
      {!creando && (
        <div>
          <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Tus anuncios</h2>
          {estado === "cargando" && <SkeletonLista filas={3} />}
          {estado === "error" && <div role="alert" className="space-y-2 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
            <p>No pudimos cargar los anuncios de este negocio.</p>
            <button type="button" onClick={() => void cargar()} className="font-semibold text-brasa-texto">Reintentar</button>
          </div>}
          {estado === "ok" && anuncios.length === 0 && (
            <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
              <p className="text-[1.02rem] font-bold text-tinta">Todavía no creaste anuncios</p>
              <p className="mt-1 text-[0.88rem] text-frio">Toca "Crear anuncio" y te guiamos paso a paso.</p>
            </div>
          )}
          {estado === "ok" && anuncios.length > 0 && (
            <div className="space-y-2.5">
              {anuncios.map((a) => {
                const et = ESTADO_AD[a.estado] ?? ESTADO_AD.borrador;
                return (
                  <article key={a.id} className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-tinta">📣 {a.campaniaNombre}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>{et.texto}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[0.86rem] text-tinta-2">{a.texto}</p>
                    {a.estado === "publicando" && <div role="status" className="mt-2 space-y-2 text-sm text-frio">
                      <p>{AVISO_PUBLICANDO}</p>
                      <button type="button" onClick={() => void cargar()} disabled={publicando || publicandoId !== null} className="font-semibold text-brasa-texto disabled:opacity-50">Verificar estado</button>
                    </div>}
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[0.76rem] text-frio">
                        S/{a.presupuestoTotal} · {a.dias} días · S/{(a.presupuestoTotal / a.dias || 0).toFixed(0)}/día
                      </p>
                      {/* Sin imagen no hay botón: Meta rechaza la pieza sin media. */}
                      {a.estado === "borrador" && a.mediaUrl && a.objetivo === "mensajes" && (
                        <button
                          onClick={() => publicarExistente(a.id)}
                          disabled={publicandoId !== null}
                          className="rounded-chip bg-brasa px-3.5 py-1.5 text-[0.78rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
                        >
                          {publicandoId === a.id ? "Publicando…" : "Publicar en Meta"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
