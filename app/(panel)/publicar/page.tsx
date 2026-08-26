"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion, leerEmpresaActiva } from "@/lib/auth";
import {
  listarPublicaciones, plantillasPost, subirMediaPost, crearPublicacion,
  listarCanales, borrarPublicacion,
  type Publicacion, type PlantillaPost,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";

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
export default function PublicarPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [posts, setPosts] = useState<Publicacion[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaPost[]>([]);
  const [conectadas, setConectadas] = useState<Set<string> | null>(null);

  // Editor
  const [texto, setTexto] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [tipoMedia, setTipoMedia] = useState<"imagen" | "video">("imagen");
  const [meta, setMeta] = useState<MetaMedia | null>(null);
  const [redes, setRedes] = useState<string[]>([]);
  const [programar, setProgramar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Modo global: el publicador entero trabaja sobre el negocio enfocado en la
  // barra (lista, subida y creación viajan con su tenant explícito).
  const g = useSeccionGlobal();

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
        const emp = leerSesion()?.empresas ?? [];
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

  function usarPlantilla(pl: PlantillaPost) {
    // Inserta el texto LISTO de la plantilla (sin IA): el dueño reemplaza los
    // [corchetes] con sus datos y ya.
    setMsg("");
    setTexto(pl.ejemplo || "");
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo
    if (!file) return;
    setMsg("");

    // Validar ANTES de subir: tipo y peso se saben acá mismo, sin esperar al
    // servidor (un video de 80MB tardaría un minuto en subir para nada).
    const esVideo = file.type.startsWith("video/");
    const tiposOk = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime"];
    if (!tiposOk.includes(file.type)) {
      setMsg("Formato no permitido: usa JPG, PNG, WebP, MP4 o MOV.");
      return;
    }
    const pesoMB = file.size / (1024 * 1024);
    if (esVideo && pesoMB > 50) {
      setMsg(`Tu video pesa ${pesoMB.toFixed(0)}MB y el máximo es 50MB. Compréndelo o graba uno más corto.`);
      return;
    }
    if (!esVideo && pesoMB > 8) {
      setMsg(`Tu imagen pesa ${pesoMB.toFixed(1)}MB y el máximo es 8MB.`);
      return;
    }

    // Duración y orientación del video, leídas en el navegador.
    let m: MetaMedia = { pesoMB, duracionSeg: null, ancho: null, alto: null };
    if (esVideo) {
      const v = await leerMetaVideo(file);
      if (v) m = { pesoMB, ...v };
    }

    setSubiendo(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await subirMediaPost(String(reader.result), g.tenantLista);
      setSubiendo(false);
      if (r.ok && r.url) {
        setMediaUrl(r.url);
        setTipoMedia(r.tipoMedia === "video" ? "video" : "imagen");
        setMeta(m);
      } else {
        setMsg(r.error ?? "No se pudo subir el archivo.");
      }
    };
    reader.readAsDataURL(file);
  }

  function quitarMedia() {
    setMediaUrl(null);
    setTipoMedia("imagen");
    setMeta(null);
  }

  // Chequeos de las redes elegidas (para el panel de requisitos y el guard).
  const ctx = { texto, mediaUrl, tipoMedia, meta };
  const chequeos = redes.map((r) => ({
    red: r,
    label: REDES.find((x) => x.id === r)?.label ?? r,
    lista: chequeosDeRed(r, ctx),
  }));
  const hayBloqueo = chequeos.some((c) => c.lista.some((x) => x.nivel === "bloqueo"));

  async function publicar() {
    if (!texto.trim() || redes.length === 0 || publicando || subiendo) return;
    const bloqueo = chequeos.flatMap((c) => c.lista).find((x) => x.nivel === "bloqueo");
    if (bloqueo) { setMsg(bloqueo.texto); return; }
    setPublicando(true);
    setMsg("");
    const r = await crearPublicacion({
      texto: texto.trim(),
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      tipoMedia,
      canales: redes,
      programadaPara: programar && fecha ? new Date(fecha).toISOString() : undefined,
    }, g.tenantLista);
    setPublicando(false);
    if (r.ok) {
      setTexto(""); quitarMedia(); setProgramar(false); setFecha("");
      setMsg(programar ? "✓ Post programado" : "✓ Post publicado");
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
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu embudo</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Publicar</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Crea un post una vez y publícalo en las redes que tengas conectadas.
        </p>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
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
          📸 La publicación real en Instagram/Facebook se activa cuando Meta apruebe la app
          (en trámite). En TikTok ya se publica de verdad.
        </div>
      )}

      {/* Editor */}
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
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
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={elegirArchivo} className="hidden" />
          {!mediaUrl && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              className="rounded-tarjeta border border-dashed border-linea px-4 py-3 text-[0.84rem] font-semibold text-frio transition hover:border-brasa/40 hover:text-tinta-2 disabled:opacity-50"
            >
              {subiendo ? "Subiendo…" : "📷 Agregar imagen o video"}
            </button>
          )}
          <p className="mt-1.5 text-[0.72rem] text-frio">
            Imágenes hasta 8MB (JPG, PNG, WebP) · videos hasta 50MB (MP4, MOV).
          </p>
        </div>

        {/* VISTA PREVIA: cómo se verá el post (pedido de Jonathan 26-ago) */}
        {(texto.trim() || mediaUrl) && (
          <div className="mt-4">
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-wide text-frio">Vista previa</p>
            <div className="max-w-sm overflow-hidden rounded-tarjeta ring-1 ring-linea">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brasa text-[0.85rem] font-bold text-sobre-brasa">
                  {(nombreNegocio || "N")[0].toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.85rem] font-bold text-tinta">{nombreNegocio || "Tu negocio"}</p>
                  <p className="text-[0.7rem] text-frio">
                    {programar && fecha
                      ? `Se publicará el ${new Date(fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}`
                      : "Ahora"}
                  </p>
                </div>
              </div>
              {mediaUrl && (
                <div className="relative bg-tinta/5">
                  {tipoMedia === "video" ? (
                    <video src={mediaUrl} controls muted playsInline className="max-h-80 w-full object-contain" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl} alt="preview" className="max-h-80 w-full object-contain" />
                  )}
                  <button
                    onClick={quitarMedia}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-tinta/80 text-carta text-sm"
                    aria-label="Quitar archivo"
                  >
                    ✕
                  </button>
                  {meta && tipoMedia === "video" && meta.duracionSeg != null && (
                    <span className="absolute bottom-2 right-2 rounded-full bg-tinta/70 px-2 py-0.5 text-[0.7rem] font-semibold text-carta">
                      {Math.round(meta.duracionSeg)}s · {meta.pesoMB.toFixed(1)}MB
                    </span>
                  )}
                </div>
              )}
              {texto.trim() && (
                <p className="whitespace-pre-wrap px-3.5 py-3 text-[0.88rem] leading-relaxed text-tinta">{texto}</p>
              )}
            </div>
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

          {/* REQUISITOS por red elegida: qué falta o qué conviene ajustar */}
          {chequeos.some((c) => c.lista.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {chequeos.flatMap((c) =>
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
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={publicar}
            disabled={publicando || subiendo || hayBloqueo || !texto.trim() || redes.length === 0 || (programar && !fecha)}
            className="rounded-chip bg-brasa px-6 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {publicando ? "Guardando…" : subiendo ? "Subiendo…" : programar ? "Programar post" : "Publicar ahora"}
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
                        {d.canal === "tiktok" ? "TikTok" : d.canal === "instagram" ? "Instagram" : "Facebook"}: {d.error}
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
    </div>
  );
}
