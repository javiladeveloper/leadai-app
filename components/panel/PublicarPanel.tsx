"use client";

// Componente reutilizable: la página de Next no recibe la prop embebido.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerEmpresaActiva, empresasVisibles } from "@/lib/auth";
import {
  listarPublicaciones, plantillasPost, subirMediaPost, crearPublicacion,
  listarCanales, borrarPublicacion, opcionesTikTok,
  type Publicacion, type PlantillaPost, type OpcionesTikTok,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import {
  MAX_MEDIA, revisarTanda, tipoMediaDe, moverEn, faltaParaPublicar,
  textoProgreso, porcentajeProgreso, type ProgresoSubida,
  FORMATOS, chequeosDeHistoria, mensajeTrasPublicar, type FormatoPublicacion,
} from "@/lib/carrusel-media";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { HeroSeccion, CabeceraFormulario, PublicarIlustracion } from "@/components/panel/HeroSeccion";
import { PreviewRedes } from "@/components/panel/PreviewRedes";
import { RendimientoPosts } from "@/components/panel/RendimientoPosts";

type Estado = "cargando" | "ok" | "error";

const REDES = [
  { id: "instagram", label: "Instagram" },
  // "messenger" = una Página de Facebook (Meta solo permite publicar en Páginas,
  // no en perfiles personales). El label lo deja claro para el negocio.
  { id: "messenger", label: "Página de Facebook" },
  // TikTok publica DE VERDAD (2026-08-26): necesita la cuenta conectada en
  // Configuración → Canales y un VIDEO en la publicación. Mientras la app de
  // TikTok no pase su revisión, el video queda PRIVADO en el perfil (solo lo
  // ve el dueño; puede hacerlo público a mano) — límite de TikTok, no nuestro.
  { id: "tiktok", label: "TikTok (video)" },
];

/**
 * Los niveles de privacidad de TikTok, dichos como los entiende un negocio.
 * Las claves son las que devuelve su API y viajan tal cual al publicar.
 */
const NOMBRE_PRIVACIDAD: Record<string, string> = {
  PUBLIC_TO_EVERYONE: "Público — lo ve cualquiera",
  MUTUAL_FOLLOW_FRIENDS: "Amigos — solo quienes se siguen mutuamente",
  FOLLOWER_OF_CREATOR: "Seguidores — solo quienes te siguen",
  SELF_ONLY: "Solo yo — privado",
};

const ESTADO_POST: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-arena text-frio" },
  programada: { texto: "Programada", clase: "bg-tibio-suave text-tibio" },
  publicando: { texto: "Publicando…", clase: "bg-tibio-suave text-tibio" },
  publicada: { texto: "Publicada", clase: "bg-ok/12 text-ok" },
  fallida: { texto: "Falló", clase: "bg-alerta-suave text-alerta-hondo" },
};

const MAX_TEXTO = 2200; // límite real de caption en IG y TikTok

// Metadatos del archivo elegido, leídos EN el navegador antes de subir: pesan
// en las validaciones por red (duración/orientación) sin ir al servidor.
interface MetaMedia {
  pesoMB: number;
  duracionSeg: number | null; // solo video
  ancho: number | null;
  alto: number | null;
}

// Un chequeo por red: `bloqueo` impide publicar, `aviso` deja pero advierte.
interface Chequeo { nivel: "aviso" | "bloqueo"; texto: string }

// REQUISITOS POR PLATAFORMA (2026-08-26, pedido de Jonathan: "ver que cumpla
// con todo lo que pide cada plataforma para que salga bien"). Se validan acá,
// ANTES de publicar — no descubriendo el error en el historial.
function chequeosDeRed(
  red: string,
  ctx: { texto: string; mediaUrl: string | null; tipoMedia: string; meta: MetaMedia | null },
): Chequeo[] {
  const c: Chequeo[] = [];
  const esVideo = ctx.mediaUrl && ctx.tipoMedia === "video";
  if (red === "tiktok") {
    if (!esVideo) {
      c.push({ nivel: "bloqueo", texto: "TikTok solo publica videos: agrega uno (MP4 o MOV)." });
    } else if (ctx.meta?.duracionSeg != null) {
      if (ctx.meta.duracionSeg < 3) c.push({ nivel: "bloqueo", texto: "El video dura menos de 3 segundos: TikTok lo rechaza." });
      if (ctx.meta.duracionSeg > 600) c.push({ nivel: "bloqueo", texto: "El video pasa los 10 minutos que acepta TikTok." });
      if (ctx.meta.ancho && ctx.meta.alto && ctx.meta.ancho > ctx.meta.alto) {
        c.push({ nivel: "aviso", texto: "Video horizontal: en TikTok se verá con franjas (ideal vertical 9:16)." });
      }
    }
  }
  if (red === "instagram") {
    if (!ctx.mediaUrl) {
      c.push({ nivel: "bloqueo", texto: "Instagram no publica solo texto: agrega una imagen o un video." });
    } else if (esVideo && ctx.meta?.duracionSeg != null && ctx.meta.duracionSeg > 90) {
      c.push({ nivel: "aviso", texto: "Video de más de 90 seg: en Instagram rinde mejor uno más corto." });
    }
  }
  // Página de Facebook: acepta solo texto, imagen o video — sin requisitos duros.
  return c;
}

// Lee ancho y alto de una foto antes de subirla (para el aviso de historia horizontal).
function leerMedidasImagen(file: File): Promise<{ ancho: number; alto: number } | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolver({ ancho: img.naturalWidth, alto: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolver(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// Lee duración y dimensiones de un video ANTES de subirlo (object URL local).
function leerMetaVideo(file: File): Promise<{ duracionSeg: number; ancho: number; alto: number } | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolver({ duracionSeg: v.duration, ancho: v.videoWidth, alto: v.videoHeight });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => { resolver(null); URL.revokeObjectURL(url); };
    v.src = url;
  });
}

// Publicador multi-red (Fase 2 embudo): crear un post una vez, elegir redes
// CONECTADAS, ver el preview y las validaciones por red, publicar o programar.
// SIN IA (decisión 2026-08-26): las plantillas insertan texto listo para
// completar — más rápido para el dueño y costo cero.
/**
 * `embebido`: se monta DENTRO de /marketing, que ya puso el título y la barra
 * de negocios. Mismo patrón que Anuncios y Campañas — la pantalla no se
 * reescribe, solo deja de repetir lo que ya está arriba.
 */
export default function PublicarPanel(
  { embebido = false, tenant }: { embebido?: boolean; tenant?: string } = {},
) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [posts, setPosts] = useState<Publicacion[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaPost[]>([]);
  const [conectadas, setConectadas] = useState<Set<string> | null>(null);
  // Negocios SIN redes publicables (tenantId → "sin redes"): sus chips quedan
  // bloqueados en la barra (2026-08-26, Jonathan: "si no tengo conectores en
  // las otras empresas, debería bloquearme poder cambiar de empresa").
  const [negociosSinRedes, setNegociosSinRedes] = useState<Record<string, string>>({});

  // Editor
  const [texto, setTexto] = useState("");
  /**
   * CARRUSEL: VARIAS IMÁGENES EN UN POST (2026-09-19, pedido de Jonathan
   * "¿puedo subir varias imágenes?" al ir a publicar las piezas de Sania).
   *
   * Antes esto era `mediaUrl` (una sola) aunque el backend ya aceptaba hasta
   * 10 en `mediaUrls` y el tipo "carrusel": un carrusel de 5 láminas —la pieza
   * mejor armada que tenía— no se podía subir desde acá.
   *
   * Es una LISTA ORDENADA porque en un carrusel el orden ES el contenido (la
   * lámina 1 engancha, la 5 cierra con el CTA). `mediaUrl` se conserva como
   * derivado (la primera) para el preview y las validaciones por red, que
   * miran la portada — que es lo que la gente ve en el feed.
   */
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const mediaUrl = mediaUrls[0] ?? null;
  const [tipoMedia, setTipoMedia] = useState<"imagen" | "video">("imagen");
  const [meta, setMeta] = useState<MetaMedia | null>(null);
  const [redes, setRedes] = useState<string[]>([]);
  // Post/Reel, historia o los dos (2026-09-25).
  const [formato, setFormato] = useState<FormatoPublicacion>("post");
  const [programar, setProgramar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  // Cuántas van de cuántas, para que la espera se vea avanzar en vez de un
  // "Subiendo…" quieto que no distingue lento de colgado.
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null);
  /**
   * OPCIONES DE TIKTOK (2026-09-20). Se piden al marcar TikTok como destino:
   * TikTok exige que la privacidad la elija el dueño (sin valor por defecto)
   * y que las interacciones que su cuenta no permite salgan deshabilitadas.
   */
  const [tiktok, setTiktok] = useState<OpcionesTikTok | null>(null);
  const [ttPrivacidad, setTtPrivacidad] = useState("");
  const [ttComercial, setTtComercial] = useState(false);
  const [ttComentario, setTtComentario] = useState(false);
  const [ttDueto, setTtDueto] = useState(false);
  const [ttStitch, setTtStitch] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Modo global: el publicador entero trabaja sobre el negocio enfocado en la
  // barra (lista, subida y creación viajan con su tenant explícito).
  const gPropio = useSeccionGlobal();
  /**
   * EL NEGOCIO LO MANDA EL PADRE CUANDO VA EMBEBIDO (2026-09-20).
   *
   * Bug de Jonathan: "cuando cambio de negocio en marketing, en publicar no se
   * cambia — me sigue apareciendo las de Sania". `useSeccionGlobal()` guarda el
   * negocio enfocado en un `useState` PROPIO de cada componente, así que dentro
   * de /marketing había dos: el de la barra de chips y el de este panel. Tocar
   * un chip cambiaba el de la barra y este no se enteraba, dejando en pantalla
   * los datos del negocio anterior — lo más peligroso que puede hacer esta
   * pantalla, porque se publica en la red del negocio equivocado.
   *
   * Mismo patrón que `SeccionAnuncios` y `PresenciaEditor`, que ya reciben
   * `tenant` del padre.
   */
  const g = embebido
    ? { ...gPropio, tenantLista: tenant, enfocado: tenant ?? "", listaLista: true }
    : gPropio;

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const [r, pl, cs] = await Promise.all([
        listarPublicaciones(g.tenantLista),
        plantillasPost(g.tenantLista),
        listarCanales(g.tenantLista),
      ]);
      setPosts(r.items);
      setSiguiente(r.siguiente);
      setPlantillas(pl);
      const activas = new Set(cs.filter((c) => c.activo).map((c) => c.tipo as string));
      setConectadas(activas);
      // Solo se pueden elegir redes CONECTADAS: al cambiar de negocio se
      // desmarcan las que acá no existen; si no había nada marcado, se
      // preseleccionan las conectadas (menos un clic para el caso común).
      setRedes((prev) => {
        const validas = prev.filter((x) => activas.has(x));
        if (validas.length > 0) return validas;
        return REDES.map((x) => x.id).filter((x) => activas.has(x));
      });
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, [g.tenantLista]);

  useEffect(() => {
    if (!listo || !g.listaLista) return;
    cargar();
  }, [listo, g.listaLista, cargar]);

  // Cambio de EMPRESA activa (bug de Jonathan 2026-08-29): las redes
  // conectadas son POR empresa — sin esto, al cambiar de empresa los chips de
  // Instagram/FB quedaban con las conexiones de la anterior y dejaban
  // "publicar" en un negocio sin redes.
  useEffect(() => {
    if (!listo) return;
    const alCambiar = () => cargar();
    window.addEventListener("leadai:empresa-cambiada", alCambiar);
    return () => window.removeEventListener("leadai:empresa-cambiada", alCambiar);
  }, [listo, cargar]);

  // Mapear qué negocios tienen al menos una red PUBLICABLE conectada, para
  // apagar los chips de los que no (y no entrar a un Publicar vacío).
  const negociosClave = g.negocios.map((n) => n.tenantId).join(",");
  useEffect(() => {
    if (!g.modoGlobal || g.negocios.length < 2) return;
    let vivo = true;
    (async () => {
      const publicables = new Set(["instagram", "messenger", "tiktok"]);
      const listas = await Promise.all(
        g.negocios.map(async (n) => {
          const cs = await listarCanales(n.tenantId);
          return [n.tenantId, cs.some((c) => c.activo && publicables.has(c.tipo))] as const;
        }),
      );
      if (!vivo) return;
      const sin: Record<string, string> = {};
      for (const [tenantId, tiene] of listas) if (!tiene) sin[tenantId] = "sin redes";
      setNegociosSinRedes(sin);
      // Si el negocio enfocado quedó bloqueado, saltar al primero con redes.
      if (sin[g.enfocado]) {
        const primero = g.negocios.find((n) => !sin[n.tenantId]);
        if (primero) g.setEnfocado(primero.tenantId);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.modoGlobal, negociosClave]);

  async function cargarMas() {
    if (!siguiente || cargandoMas) return;
    setCargandoMas(true);
    const r = await listarPublicaciones(g.tenantLista, siguiente);
    setPosts((prev) => [...prev, ...r.items]);
    setSiguiente(r.siguiente);
    setCargandoMas(false);
  }

  // Nombre del negocio al que le va a salir el post: en vista global es el
  // enfocado en la barra; con un solo negocio, el de la sesión.
  const nombreNegocio = g.modoGlobal
    ? g.negocios.find((n) => n.tenantId === g.enfocado)?.nombre ?? ""
    : (() => {
        // `empresasVisibles` y no la sesión: en soporte el negocio ajeno no
        // está en tus empresas, y el fallback a `[0]` pondría el nombre de TU
        // primer negocio encima de los datos del cliente.
        const emp = empresasVisibles();
        const activa = leerEmpresaActiva();
        return (emp.find((e) => e.tenantId === activa) ?? emp[0])?.nombre ?? "";
      })();

  function toggleRed(id: string) {
    // Solo redes conectadas en ESTE negocio (regla de Jonathan 26-ago).
    if (conectadas && !conectadas.has(id)) {
      const nombre = REDES.find((x) => x.id === id)?.label ?? id;
      setMsg(`Este negocio no tiene ${nombre} conectado. Conéctalo en Configuración → Canales.`);
      return;
    }
    setMsg("");
    setRedes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /**
   * Al marcar TikTok se le pregunta a TikTok QUE permite esta cuenta.
   *
   * Nada se preselecciona: la privacidad arranca vacia a proposito porque
   * TikTok lo exige ("there should be no default value"), y el boton de
   * publicar queda bloqueado hasta que el dueño elija una.
   */
  const quiereTikTok = redes.includes("tiktok");
  useEffect(() => {
    if (!quiereTikTok) { setTiktok(null); setTtPrivacidad(""); return; }
    let vivo = true;
    void opcionesTikTok(g.tenantLista).then((o) => {
      if (!vivo) return;
      setTiktok(o);
      // Lo que la cuenta no permite se fuerza a desactivado, no a elegible.
      if (o.comentarioDesactivado) setTtComentario(true);
      if (o.duetoDesactivado) setTtDueto(true);
      if (o.stitchDesactivado) setTtStitch(true);
    });
    return () => { vivo = false; };
  }, [quiereTikTok, g.tenantLista]);

  function usarPlantilla(pl: PlantillaPost) {
    // Inserta el texto LISTO de la plantilla (sin IA): el dueño reemplaza los
    // [corchetes] con sus datos y ya.
    setMsg("");
    setTexto(pl.ejemplo || "");
  }

  /** Sube UN archivo (ya validado por `revisarTanda`) y devuelve su url. */
  async function subirUno(file: File): Promise<{ url?: string; tipo?: string; meta?: MetaMedia; error?: string }> {
    const esVideo = file.type.startsWith("video/");
    const pesoMB = file.size / (1024 * 1024);
    let m: MetaMedia = { pesoMB, duracionSeg: null, ancho: null, alto: null };
    if (esVideo) {
      const v = await leerMetaVideo(file);
      if (v) m = { pesoMB, ...v };
    } else {
      // Las medidas de la foto sirven para avisar que una historia horizontal
      // sale con franjas.
      const d = await leerMedidasImagen(file);
      if (d) m = { ...m, ...d };
    }
    const dataUrl = await new Promise<string>((ok, no) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = () => no(new Error("No se pudo leer el archivo."));
      r.readAsDataURL(file);
    });
    const r = await subirMediaPost(dataUrl, g.tenantLista);
    if (!r.ok || !r.url) return { error: r.error ?? `No se pudo subir "${file.name}".` };
    return { url: r.url, tipo: r.tipoMedia, meta: m };
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (elegidos.length === 0) return;
    setMsg("");

    // Las reglas de qué se puede combinar viven en `lib/carrusel-media.ts`
    // (probadas aparte): un video va solo, hasta MAX_MEDIA imágenes, y tipo y
    // peso se revisan acá antes de gastar la subida.
    const veredicto = revisarTanda(
      elegidos.map((f) => ({ nombre: f.name, tipoMime: f.type, pesoMB: f.size / (1024 * 1024) })),
      { cantidad: mediaUrls.length, esVideo: tipoMedia === "video" },
    );
    if (!veredicto.ok) { setMsg(veredicto.motivo); return; }

    setSubiendo(true);
    setProgreso({ hechos: 0, total: elegidos.length });
    const urlsNuevas: string[] = [];
    for (const file of elegidos) {
      const r = await subirUno(file);
      if (r.error) {
        setSubiendo(false); setProgreso(null); setMsg(r.error);
        if (urlsNuevas.length) setMediaUrls((p) => [...p, ...urlsNuevas]);
        return;
      }
      urlsNuevas.push(r.url!);
      setProgreso({ hechos: urlsNuevas.length, total: elegidos.length });
      // El tipo y la meta los define la PORTADA (el primero de todos).
      if (mediaUrls.length === 0 && urlsNuevas.length === 1) {
        setTipoMedia(r.tipo === "video" ? "video" : "imagen");
        setMeta(r.meta ?? null);
      }
    }
    setMediaUrls((prev) => [...prev, ...urlsNuevas]);
    setSubiendo(false);
    setProgreso(null);
  }

  function quitarMedia() {
    setMediaUrls([]);
    setTipoMedia("imagen");
    setMeta(null);
  }

  /** Quita UNA lámina del carrusel sin tocar las demás. */
  function quitarUna(i: number) {
    setMediaUrls((prev) => {
      const q = prev.filter((_, n) => n !== i);
      if (q.length === 0) { setTipoMedia("imagen"); setMeta(null); }
      return q;
    });
  }

  /** Mueve una lámina en el orden: en un carrusel el orden es el contenido. */
  function moverMedia(i: number, delta: number) {
    setMediaUrls((prev) => moverEn(prev, i, delta));
  }

  // Chequeos de las redes elegidas (para el panel de requisitos y el guard).
  const ctx = { texto, mediaUrl, tipoMedia, meta };
  const chequeos = redes.map((r) => ({
    red: r,
    label: REDES.find((x) => x.id === r)?.label ?? r,
    lista: chequeosDeRed(r, ctx),
  }));
  const historia = chequeosDeHistoria({
    formato, redes, cantidadMedia: mediaUrls.length, esVideo: tipoMedia === "video",
    duracionSeg: meta?.duracionSeg, ancho: meta?.ancho, alto: meta?.alto,
  });
  const hayBloqueo = chequeos.some((c) => c.lista.some((x) => x.nivel === "bloqueo"))
    || historia.some((x) => x.nivel === "bloqueo");
  // Lo que falta para poder publicar, dicho en vez de un botón gris y mudo.
  const falta = faltaParaPublicar({ texto, cantidadMedia: mediaUrls.length, redes, programar, fecha, formato });

  async function publicar() {
    if ((!texto.trim() && formato !== "historia") || redes.length === 0 || publicando || subiendo) return;
    const bloqueo = [...chequeos.flatMap((c) => c.lista), ...historia].find((x) => x.nivel === "bloqueo");
    if (bloqueo) { setMsg(bloqueo.texto); return; }
    // TikTok EXIGE que la privacidad la elija una persona, sin valor por
    // defecto: sin eso no se manda nada.
    if (quiereTikTok && tiktok?.conectado && !ttPrivacidad) {
      setMsg("Elige quién puede ver el video en TikTok antes de publicar.");
      return;
    }
    setPublicando(true);
    setMsg("");
    const r = await crearPublicacion({
      texto: texto.trim(),
      mediaUrls,
      tipoMedia: tipoMediaDe(mediaUrls.length, tipoMedia === "video"),
      canales: redes,
      formato,
      programadaPara: programar && fecha ? new Date(fecha).toISOString() : undefined,
      // Lo que eligio el dueño para TikTok. Solo viaja si TikTok es destino.
      ajustesTikTok: quiereTikTok && ttPrivacidad
        ? {
            privacidad: ttPrivacidad,
            desactivarComentario: ttComentario,
            desactivarDueto: ttDueto,
            desactivarStitch: ttStitch,
          }
        : undefined,
    }, g.tenantLista);
    setPublicando(false);
    if (r.ok) {
      setTexto(""); quitarMedia(); setProgramar(false); setFecha("");
      setMsg(`✓ ${mensajeTrasPublicar(formato, programar)}`);
      cargar();
    } else {
      setMsg(r.error ?? "No se pudo publicar.");
    }
  }

  async function borrar(p: Publicacion) {
    // El post ya publicado en la red NO se toca — solo sale del historial.
    if (!window.confirm("¿Borrar esta publicación del historial? Si ya salió en la red, allá se queda.")) return;
    const r = await borrarPublicacion(p.id, g.tenantLista);
    if (r.ok) setPosts((prev) => prev.filter((x) => x.id !== p.id));
  }

  if (!listo) return null;

  const sinRedes = conectadas !== null && conectadas.size === 0;

  return (
    <div className={embebido ? "space-y-6" : "mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8"}>
      {embebido && (
        <HeroSeccion
          titulo="Un post, todas tus redes, una sola vez"
          bajada={<>Sube tu foto o tu video una vez y sale en Instagram, Facebook y TikTok al mismo tiempo. Sin abrir tres apps.</>}
          nota="Solo aparecen las redes que tengas conectadas."
          dibujo={<PublicarIlustracion />}
        />
      )}
      {!embebido && (
        <header>
          <p className="eyebrow">Tu embudo</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Publicar</h1>
          <p className="mt-1 text-[0.92rem] text-frio">
            Crea un post una vez y publícalo en las redes que tengas conectadas.
          </p>
        </header>
      )}

      {!embebido && g.modoGlobal && (
        <BarraNegociosGlobal
          negocios={g.negocios}
          enfocado={g.enfocado}
          onElegir={g.setEnfocado}
          deshabilitados={negociosSinRedes}
        />
      )}

      {sinRedes ? (
        <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.88rem] text-tinta-2 ring-1 ring-tibio/30">
          📡 Este negocio no tiene redes conectadas todavía. Conéctalas en{" "}
          <a href="/configuracion?tab=canales" className="font-semibold text-brasa-texto underline">
            Configuración → Canales
          </a>{" "}
          y vuelve para publicar.
        </div>
      ) : (
        <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
          {/* EL AVISO DE "EN TRÁMITE" YA NO ERA CIERTO (2026-09-11). Se escribió
              cuando publicar en Meta estaba simulado, pero `publicarEnInstagram`
              usa el Graph API de verdad desde hace semanas —verificado hoy: el
              post salió en el perfil real—. El texto viejo le decía al revisor
              de Meta, dentro del video del App Review, que la función no está
              implementada: justo la contradicción que hace que rechacen. */}
          📸 Lo que publiques sale de verdad en las redes conectadas de este negocio.
        </div>
      )}

      {/* Editor */}
      <div className="space-y-4 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        {/* Sin cabecera, el editor arrancaba directo en el campo de texto: no
            decía qué se está armando. No lleva botón de cerrar porque acá el
            formulario ES la pantalla — no hay a dónde volver. */}
        <CabeceraFormulario
          icono={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
              <path d="M8.5 6l1.4-2.2h4.2L15.5 6" />
              <circle cx="12" cy="12.5" r="3.2" />
            </svg>
          }
          titulo="Arma tu publicación"
          bajada="Sube tu foto o video, escribe el texto y elige a qué redes va. Antes de publicar ves cómo va a quedar."
        />
        {/* Plantillas: texto listo para completar (sin IA, costo cero) */}
        {plantillas.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-wide text-frio">
              Plantillas para tu rubro — toca una y completa los [corchetes]
            </p>
            <div className="flex flex-wrap gap-2">
              {plantillas.map((pl) => (
                <button
                  key={pl.titulo}
                  onClick={() => usarPlantilla(pl)}
                  className="rounded-chip bg-arena/70 px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-brasa-suave hover:text-brasa-hondo"
                >
                  {pl.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Texto */}
        <div className="flex items-center justify-between">
          <label className="text-[0.9rem] font-bold text-tinta">Texto del post</label>
          <span className={`text-[0.75rem] ${texto.length > MAX_TEXTO - 100 ? "font-bold text-alerta-hondo" : "text-frio"}`}>
            {texto.length} / {MAX_TEXTO}
          </span>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_TEXTO))}
          rows={4}
          maxLength={MAX_TEXTO}
          placeholder="Escribe tu post, o toca una plantilla de arriba…"
          className="mt-1.5 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
        />

        {/* Media */}
        <div className="mt-3">
          <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={elegirArchivo} className="hidden" />
          {mediaUrls.length === 0 && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              className="rounded-tarjeta border border-dashed border-linea px-4 py-3 text-[0.84rem] font-semibold text-frio transition hover:border-brasa/40 hover:text-tinta-2 disabled:opacity-50"
            >
              {subiendo ? textoProgreso(progreso) : "📷 Agregar imágenes o un video"}
            </button>
          )}

          {/* QUE SE VEA AVANZAR (2026-09-19, Jonathan: "no sé si está subiendo
              o si se colgó"). Antes el único aviso era la palabra "Subiendo…",
              que con 5 imágenes se veía igual el segundo 1 que el 40. */}
          {subiendo && (
            <div className="mt-2" role="status" aria-live="polite">
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brasa/30 border-t-brasa" />
                <span className="text-[0.82rem] font-semibold text-tinta-2">{textoProgreso(progreso)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-arena">
                <div
                  className="h-full rounded-full bg-brasa transition-[width] duration-300"
                  style={{ width: `${porcentajeProgreso(progreso)}%` }}
                />
              </div>
            </div>
          )}

          {/* LAS LÁMINAS DEL CARRUSEL, EN ORDEN.
              Se numeran y se pueden mover porque en un carrusel el orden ES el
              contenido: la 1 engancha y la última cierra con el CTA. Sin ver el
              orden, el dueño publica un carrusel que empieza por el final. */}
          {mediaUrls.length > 0 && tipoMedia !== "video" && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                {mediaUrls.map((u, i) => (
                  <div key={u} className="relative">
                    <img src={u} alt={`Lámina ${i + 1}`} className="h-20 w-20 rounded-tarjeta object-cover ring-1 ring-linea" />
                    <span className="absolute left-1 top-1 rounded-chip bg-tinta/85 px-1.5 text-[0.68rem] font-bold text-carta">
                      {i + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => quitarUna(i)}
                      aria-label={`Quitar lámina ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-tinta text-[0.7rem] font-bold text-carta transition hover:bg-alerta-hondo"
                    >
                      ×
                    </button>
                    {mediaUrls.length > 1 && (
                      <div className="mt-1 flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => moverMedia(i, -1)}
                          disabled={i === 0}
                          aria-label={`Mover la lámina ${i + 1} antes`}
                          className="rounded-chip bg-arena px-1.5 text-[0.7rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-carta disabled:opacity-30"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moverMedia(i, 1)}
                          disabled={i === mediaUrls.length - 1}
                          aria-label={`Mover la lámina ${i + 1} después`}
                          className="rounded-chip bg-arena px-1.5 text-[0.7rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-carta disabled:opacity-30"
                        >
                          →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {mediaUrls.length < MAX_MEDIA && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={subiendo}
                    aria-label="Agregar más imágenes"
                    className="h-20 w-20 rounded-tarjeta border border-dashed border-linea text-[1.3rem] font-semibold text-frio transition hover:border-brasa/40 hover:text-tinta-2 disabled:opacity-50"
                  >
                    {subiendo ? "…" : "+"}
                  </button>
                )}
              </div>
              {mediaUrls.length > 1 && (
                <p className="mt-1.5 text-[0.72rem] text-tinta-2">
                  Carrusel de <b className="text-tinta">{mediaUrls.length} láminas</b>. Se publican en este orden; la 1 es la portada.
                </p>
              )}
            </div>
          )}

          <p className="mt-1.5 text-[0.72rem] text-frio">
            Hasta {MAX_MEDIA} imágenes de 8MB (JPG, PNG, WebP) para un carrusel · o un video de 50MB (MP4, MOV).
          </p>
        </div>

        {/* VISTA PREVIA POR RED (2026-08-27, Jonathan: "un preview de cómo
            quedará en cada plataforma al hacer el post, cosa que el cliente lo
            vea antes").
            Antes había UNA tarjeta genérica: servía para ver que la foto cargó,
            no para lo que importa — cada red recorta y corta el texto distinto,
            y el dueño se enteraba después de publicar. */}
        {(texto.trim() || mediaUrl) && (
          <div className="mt-4">
            <PreviewRedes
              redes={redes}
              negocio={nombreNegocio}
              texto={texto}
              mediaUrls={mediaUrls}
              tipoMedia={tipoMedia}
              formato={formato}
              cuando={
                programar && fecha
                  ? new Date(fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })
                  : "Ahora"
              }
            />
            {/* Quitar el archivo vivía sobre la imagen del preview viejo. Acá
                va aparte: los previews imitan cada red y un botón nuestro
                encima rompería la ilusión de "así se va a ver". */}
            {mediaUrl && (
              <button
                type="button"
                onClick={quitarMedia}
                className="mt-2 text-[0.82rem] font-semibold text-frio underline transition hover:text-tinta"
              >
                Quitar {tipoMedia === "video" ? "el video" : "la foto"}
                {meta && tipoMedia === "video" && meta.duracionSeg != null
                  ? ` (${Math.round(meta.duracionSeg)}s · ${meta.pesoMB.toFixed(1)}MB)`
                  : ""}
              </button>
            )}
          </div>
        )}

        {/* Redes — solo se pueden elegir las CONECTADAS de este negocio */}
        <div className="mt-4">
          <p className="mb-2 text-[0.9rem] font-bold text-tinta">
            Publicar en
            {nombreNegocio && (
              <span className="ml-2 font-semibold text-frio">
                · redes de <span className="text-brasa-texto">{nombreNegocio}</span>
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {REDES.map((r) => {
              const activo = redes.includes(r.id);
              const sinConectar = conectadas !== null && !conectadas.has(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRed(r.id)}
                  title={sinConectar ? `Conecta ${r.label} en Configuración → Canales` : undefined}
                  className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition ${
                    activo
                      ? "bg-brasa text-carta"
                      : sinConectar
                        ? "cursor-not-allowed bg-arena/40 text-frio/70"
                        : "bg-arena/70 text-tinta-2 hover:bg-arena"
                  }`}
                >
                  {activo ? "✓ " : ""}{r.label}
                  {sinConectar && <span className="ml-1.5 text-[0.7rem] font-bold text-frio">· sin conectar</span>}
                </button>
              );
            })}
          </div>

          {/* PUBLICAR COMO (2026-09-25). Hasta hoy todo video salía como Reel;
              ahora también puede salir como historia, o las dos cosas. */}
          <p className="mb-2 mt-4 text-[0.9rem] font-bold text-tinta">Publicar como</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Publicar como">
            {FORMATOS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={formato === f.id}
                onClick={() => setFormato(f.id)}
                className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition ${
                  formato === f.id ? "bg-brasa text-carta" : "bg-arena/70 text-tinta-2 hover:bg-arena"
                }`}
              >
                {formato === f.id ? "✓ " : ""}{f.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.76rem] text-frio">
            {FORMATOS.find((f) => f.id === formato)?.ayuda}
            {formato !== "post" && " Las historias salen en Instagram y Facebook: una sola foto o un video de hasta 60 segundos, mejor vertical."}
          </p>

          {/*
            OPCIONES DE TIKTOK (2026-09-20). TikTok no deja que la app decida
            por el creador: la privacidad la elige una persona, sin valor por
            defecto, y las interacciones que su cuenta no permite salen
            deshabilitadas. Sin este bloque la auditoria de Direct Post se
            rechaza.
          */}
          {quiereTikTok && tiktok?.conectado && (
            <div className="mt-3 rounded-tarjeta border border-arena bg-arena/25 p-3">
              <div className="mb-2 flex items-center gap-2">
                {tiktok.fotoPerfil && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tiktok.fotoPerfil} alt="" className="h-7 w-7 rounded-full object-cover" />
                )}
                <p className="text-[0.85rem] font-bold text-tinta">
                  Se publicará en TikTok como{" "}
                  <span className="text-brasa-texto">@{tiktok.usuario ?? "tu cuenta"}</span>
                </p>
              </div>

              <label className="mb-1 block text-[0.8rem] font-semibold text-tinta-2">
                ¿Quién puede ver este video? <span className="text-coral">*</span>
              </label>
              <select
                value={ttPrivacidad}
                onChange={(e) => setTtPrivacidad(e.target.value)}
                className="w-full rounded-tarjeta border border-arena bg-carta px-3 py-2 text-[0.85rem] text-tinta"
              >
                <option value="">Elige una opción…</option>
                {(tiktok.privacidades ?? []).map((p) => (
                  <option key={p} value={p}>{NOMBRE_PRIVACIDAD[p] ?? p}</option>
                ))}
              </select>

              <div className="mt-3 space-y-1.5">
                {([
                  ["comentario", "Permitir comentarios", ttComentario, setTtComentario, tiktok.comentarioDesactivado],
                  ["dueto", "Permitir dúos", ttDueto, setTtDueto, tiktok.duetoDesactivado],
                  ["stitch", "Permitir stitch", ttStitch, setTtStitch, tiktok.stitchDesactivado],
                ] as const).map(([k, label, valor, set, bloqueado]) => (
                  <label
                    key={k}
                    className={`flex items-center gap-2 text-[0.82rem] ${bloqueado ? "text-frio/60" : "text-tinta-2"}`}
                    title={bloqueado ? "Tu cuenta de TikTok no permite esto" : undefined}
                  >
                    <input
                      type="checkbox"
                      disabled={Boolean(bloqueado)}
                      checked={!valor}
                      onChange={(e) => set(!e.target.checked)}
                    />
                    {label}
                    {bloqueado && <span className="text-[0.72rem]">· no disponible en tu cuenta</span>}
                  </label>
                ))}
              </div>

              <label className="mt-3 flex items-start gap-2 text-[0.82rem] text-tinta-2">
                <input type="checkbox" checked={ttComercial} onChange={(e) => setTtComercial(e.target.checked)} className="mt-0.5" />
                <span>
                  Este video promociona una marca o un producto
                  <span className="block text-[0.74rem] text-frio">
                    Márcalo si es contenido comercial tuyo o de un tercero.
                  </span>
                </span>
              </label>

              <p className="mt-3 border-t border-arena pt-2 text-[0.74rem] leading-snug text-frio">
                {ttComercial
                  ? "Al publicar aceptas la Confirmación de uso de música de marca de TikTok (Branded Content Policy y Music Usage Confirmation)."
                  : "Al publicar aceptas la Confirmación de uso de música de TikTok (Music Usage Confirmation)."}
              </p>
            </div>
          )}

          {/* REQUISITOS por red elegida: qué falta o qué conviene ajustar */}
          {(chequeos.some((c) => c.lista.length > 0) || historia.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {[...chequeos, { red: "historia", lista: historia }].flatMap((c) =>
                c.lista.map((x, i) => (
                  <p
                    key={`${c.red}-${i}`}
                    className={`rounded-tarjeta px-3 py-2 text-[0.82rem] ${
                      x.nivel === "bloqueo"
                        ? "bg-alerta-suave text-alerta-hondo"
                        : "bg-tibio-suave/60 text-tinta-2"
                    }`}
                  >
                    {x.nivel === "bloqueo" ? "⛔" : "💡"} {x.texto}
                  </p>
                )),
              )}
            </div>
          )}
        </div>

        {/* Programar */}
        <div className="mt-4">
          <label className="flex items-center gap-2 text-[0.88rem] text-tinta-2">
            <input type="checkbox" checked={programar} onChange={(e) => setProgramar(e.target.checked)} />
            Programar para más tarde
          </label>
          {programar && (
            <input
              type="datetime-local"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="mt-2 rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
          )}
        </div>

        {/* Publicar — con el negocio DESTINO dicho ahí mismo */}
        {nombreNegocio && g.modoGlobal && (
          <p className="mt-4 rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2">
            📣 Este post saldrá en las redes de <strong className="text-tinta">{nombreNegocio}</strong>.
          </p>
        )}
        {/* QUÉ FALTA, DICHO (2026-09-19). El botón gris no explicaba nada y
            había que adivinar; ahora la lista se ve sin pasar el mouse, que en
            el celular no existe. */}
        {falta.length > 0 && (
          <p className="mt-4 rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2 ring-1 ring-linea">
            Para publicar falta: <b className="text-tinta">{falta.join(" · ")}</b>.
          </p>
        )}
        {/* PUBLICAR TARDA, sobre todo un carrusel: Instagram crea un contenedor
            por lámina y recién después publica. Sin este aviso el botón se
            queda en "Publicando…" y parece colgado. */}
        {publicando && (
          <p className="mt-4 flex items-center gap-2 rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta-2 ring-1 ring-linea" role="status" aria-live="polite">
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brasa/30 border-t-brasa" />
            {mediaUrls.length > 1
              ? `Publicando tu carrusel de ${mediaUrls.length} láminas… Instagram las sube una por una, puede tardar unos segundos.`
              : "Publicando… no cierres esta pantalla."}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={publicar}
            disabled={publicando || subiendo || hayBloqueo || falta.length > 0}
            title={falta.length > 0 ? `Falta: ${falta.join(", ")}` : undefined}
            className="rounded-chip bg-brasa px-6 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {publicando || subiendo ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sobre-brasa/30 border-t-sobre-brasa" />
                {publicando ? "Publicando…" : textoProgreso(progreso)}
              </span>
            ) : programar ? "Programar post" : "Publicar ahora"}
          </button>
          {msg && <span className="text-[0.84rem] font-semibold text-tinta-2">{msg}</span>}
        </div>
      </div>

      {/* Lista de publicaciones */}
      <div>
        <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Tus publicaciones</h2>
        {estado === "cargando" && <SkeletonLista filas={3} />}
        {estado === "ok" && posts.length === 0 && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Todavía no publicaste nada</p>
            <p className="mt-1 text-[0.88rem] text-frio">Crea tu primer post arriba.</p>
          </div>
        )}
        {estado === "ok" && posts.length > 0 && (
          <div className="space-y-2.5">
            {posts.map((p) => {
              const et = ESTADO_POST[p.estado] ?? ESTADO_POST.borrador;
              const errores = p.destinos.filter((d) => d.estado === "fallida" && d.error);
              return (
                <article key={p.id} className="flex gap-3 rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                  {p.mediaUrls[0] && (
                    p.tipoMedia === "video" ? (
                      <video src={p.mediaUrls[0]} className="h-16 w-16 shrink-0 rounded-tarjeta object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.mediaUrls[0]} alt="" className="h-16 w-16 shrink-0 rounded-tarjeta object-cover" />
                    )
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[0.9rem] text-tinta">{p.texto}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>
                          {et.texto}
                        </span>
                        <button
                          onClick={() => borrar(p)}
                          title="Borrar del historial"
                          aria-label="Borrar del historial"
                          className="rounded-full px-1.5 py-0.5 text-[0.78rem] text-frio transition hover:bg-alerta/10 hover:text-alerta"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.74rem] text-frio">
                      {p.destinos.map((d) => (
                        <span key={d.id} className="rounded-full bg-arena px-2 py-0.5 font-semibold">
                          {d.canal === "instagram" ? "Instagram" : d.canal === "tiktok" ? "TikTok" : "Página de FB"}
                          {d.formato === "historia" ? " · historia" : ""}
                          {d.estado === "publicada" ? " ✓" : d.estado === "fallida" ? " ✕" : ""}
                        </span>
                      ))}
                      {p.programadaPara && (
                        <span>· 🗓 {new Date(p.programadaPara).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
                      )}
                    </div>
                    {/* POR QUÉ falló (antes el error quedaba escondido en la BD) */}
                    {errores.map((d) => (
                      <p key={d.id} className="mt-1.5 rounded-tarjeta bg-alerta-suave px-2.5 py-1.5 text-[0.76rem] text-alerta-hondo">
                        {d.canal === "tiktok" ? "TikTok" : d.canal === "instagram" ? "Instagram" : "Facebook"}
                        {d.formato === "historia" ? " (historia)" : ""}: {d.error}
                      </p>
                    ))}
                  </div>
                </article>
              );
            })}
            {siguiente && (
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="w-full rounded-tarjeta bg-carta py-2.5 text-[0.85rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena/60 disabled:opacity-50"
              >
                {cargandoMas ? "Cargando…" : "Ver más publicaciones"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* QUÉ POST TRAE GENTE (2026-09-18). Va DEBAJO del historial y no
          adentro: mide los posts de la red —publicados desde donde sea—, no
          solo los que salieron de acá. Es la otra pregunta: no "qué publiqué"
          sino "cuál funcionó". */}
      <RendimientoPosts key={g.tenantLista ?? "activa"} tenant={g.tenantLista} />
    </div>
  );
}
