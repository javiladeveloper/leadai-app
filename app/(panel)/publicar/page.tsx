"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  listarPublicaciones, plantillasPost, sugerirCopyPost, subirMediaPost, crearPublicacion,
  type Publicacion, type PlantillaPost,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";

const REDES = [
  { id: "instagram", label: "Instagram" },
  // "messenger" = una Página de Facebook (Meta solo permite publicar en Páginas,
  // no en perfiles personales). El label lo deja claro para el negocio.
  { id: "messenger", label: "Página de Facebook" },
];

const ESTADO_POST: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-arena text-frio" },
  programada: { texto: "Programada", clase: "bg-tibio-suave text-tibio" },
  publicando: { texto: "Publicando…", clase: "bg-tibio-suave text-tibio" },
  publicada: { texto: "Publicada", clase: "bg-ok/12 text-ok" },
  fallida: { texto: "Falló", clase: "bg-brasa-suave text-brasa-hondo" },
};

// Publicador multi-red (Fase 2 embudo): crear un post una vez, la IA ayuda con
// el copy, elegir redes, publicar ahora o programar. La publicación real espera
// la conexión de Meta; hasta entonces se simula.
export default function PublicarPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [posts, setPosts] = useState<Publicacion[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaPost[]>([]);

  // Editor
  const [texto, setTexto] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [tipoMedia, setTipoMedia] = useState<"imagen" | "video">("imagen");
  const [redes, setRedes] = useState<string[]>(["instagram"]);
  const [programar, setProgramar] = useState(false);
  const [fecha, setFecha] = useState("");
  const [sugiriendo, setSugiriendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const [p, pl] = await Promise.all([listarPublicaciones(), plantillasPost()]);
      setPosts(p);
      setPlantillas(pl);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  function toggleRed(id: string) {
    setRedes((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function usarPlantilla(pl: PlantillaPost) {
    setSugiriendo(true);
    setMsg("");
    const copy = await sugerirCopyPost(pl.prompt);
    setSugiriendo(false);
    if (copy) setTexto(copy);
  }

  async function sugerir() {
    if (!texto.trim() || sugiriendo) return;
    setSugiriendo(true);
    const copy = await sugerirCopyPost(texto.trim());
    setSugiriendo(false);
    if (copy) setTexto(copy);
  }

  async function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await subirMediaPost(String(reader.result));
      setSubiendo(false);
      if (r.ok && r.url) {
        setMediaUrl(r.url);
        setTipoMedia(r.tipoMedia === "video" ? "video" : "imagen");
      } else {
        setMsg(r.error ?? "No se pudo subir el archivo.");
      }
    };
    reader.readAsDataURL(file);
  }

  async function publicar() {
    if (!texto.trim() || redes.length === 0 || publicando) return;
    setPublicando(true);
    setMsg("");
    const r = await crearPublicacion({
      texto: texto.trim(),
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      tipoMedia,
      canales: redes,
      programadaPara: programar && fecha ? new Date(fecha).toISOString() : undefined,
    });
    setPublicando(false);
    if (r.ok) {
      setTexto(""); setMediaUrl(null); setProgramar(false); setFecha("");
      setMsg(programar ? "✓ Post programado" : "✓ Post publicado");
      cargar();
    } else {
      setMsg(r.error ?? "No se pudo publicar.");
    }
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu embudo</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Publicar</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Creá un post una vez y publicalo en tus redes. La IA te ayuda a escribirlo.
        </p>
      </header>

      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        📸 La publicación real en Instagram/Facebook se activa cuando conectes tus redes
        (requiere la aprobación de Meta). Mientras tanto, armá y probá tus posts acá.
      </div>

      {/* Editor */}
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        {/* Plantillas recomendadas */}
        {plantillas.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-[0.8rem] font-bold uppercase tracking-wide text-frio">
              Ideas para tu rubro
            </p>
            <div className="flex flex-wrap gap-2">
              {plantillas.map((pl) => (
                <button
                  key={pl.titulo}
                  onClick={() => usarPlantilla(pl)}
                  disabled={sugiriendo}
                  className="rounded-chip bg-arena/70 px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-brasa-suave hover:text-brasa-hondo disabled:opacity-50"
                >
                  ✨ {pl.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Texto + sugerir con IA */}
        <div className="flex items-center justify-between">
          <label className="text-[0.9rem] font-bold text-tinta">Texto del post</label>
          <button
            onClick={sugerir}
            disabled={sugiriendo || !texto.trim()}
            className="text-[0.8rem] font-semibold text-brasa transition hover:text-brasa-hondo disabled:opacity-40"
          >
            {sugiriendo ? "Pensando…" : "✨ Mejorar con IA"}
          </button>
        </div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          placeholder="Escribí tu post, o tocá una idea de arriba para que la IA lo redacte…"
          className="mt-1.5 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
        />

        {/* Media */}
        <div className="mt-3">
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime" onChange={elegirArchivo} className="hidden" />
          {mediaUrl ? (
            <div className="relative inline-block">
              {tipoMedia === "video" ? (
                <video src={mediaUrl} className="h-28 w-28 rounded-tarjeta object-cover ring-1 ring-linea" muted />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="media" className="h-28 w-28 rounded-tarjeta object-cover ring-1 ring-linea" />
              )}
              <button
                onClick={() => { setMediaUrl(null); setTipoMedia("imagen"); }}
                className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-tinta text-carta text-xs"
                aria-label="Quitar archivo"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={subiendo}
              className="rounded-tarjeta border border-dashed border-linea px-4 py-3 text-[0.84rem] font-semibold text-frio transition hover:border-brasa/40 hover:text-tinta-2 disabled:opacity-50"
            >
              {subiendo ? "Subiendo…" : "📷 Agregar imagen o video"}
            </button>
          )}
        </div>

        {/* Redes */}
        <div className="mt-4">
          <p className="mb-2 text-[0.9rem] font-bold text-tinta">Publicar en</p>
          <div className="flex flex-wrap gap-2">
            {REDES.map((r) => {
              const activo = redes.includes(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => toggleRed(r.id)}
                  className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition ${
                    activo ? "bg-brasa text-carta" : "bg-arena/70 text-tinta-2 hover:bg-arena"
                  }`}
                >
                  {activo ? "✓ " : ""}{r.label}
                </button>
              );
            })}
          </div>
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

        {/* Publicar */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={publicar}
            disabled={publicando || !texto.trim() || redes.length === 0 || (programar && !fecha)}
            className="rounded-chip bg-brasa px-6 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {publicando ? "Guardando…" : programar ? "Programar post" : "Publicar ahora"}
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
            <p className="mt-1 text-[0.88rem] text-frio">Creá tu primer post arriba.</p>
          </div>
        )}
        {estado === "ok" && posts.length > 0 && (
          <div className="space-y-2.5">
            {posts.map((p) => {
              const et = ESTADO_POST[p.estado] ?? ESTADO_POST.borrador;
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
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>
                        {et.texto}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.74rem] text-frio">
                      {p.destinos.map((d) => (
                        <span key={d.id} className="rounded-full bg-arena px-2 py-0.5 font-semibold">
                          {d.canal === "instagram" ? "Instagram" : "Página de FB"}
                          {d.estado === "publicada" ? " ✓" : d.estado === "fallida" ? " ✕" : ""}
                        </span>
                      ))}
                      {p.programadaPara && (
                        <span>· 🗓 {new Date(p.programadaPara).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })}</span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
