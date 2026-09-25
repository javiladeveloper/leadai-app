"use client";

import { useState } from "react";

/**
 * CÓMO VA A QUEDAR EN CADA RED (2026-08-27, pedido de Jonathan).
 *
 * "Me gustaría que creemos un preview de cómo quedará en cada plataforma al
 * hacer el post, cosa que el cliente lo vea antes".
 *
 * Antes había UNA vista previa genérica: una tarjeta con el logo, la foto y el
 * texto. Servía para ver que la foto cargó, pero no para lo que importa —
 * cada red recorta distinto y muestra el texto distinto, y el dueño se entera
 * cuando ya publicó.
 *
 * Las diferencias que se ven acá y sí importan:
 *
 * - INSTAGRAM recorta a CUADRADO en el feed. Una foto vertical de comida
 *   pierde el plato de arriba o de abajo, y eso solo se nota mirándolo.
 * - FACEBOOK muestra unas 3 líneas y corta con "Ver más".
 * - TIKTOK es pantalla completa VERTICAL y el texto va encima del video: uno
 *   horizontal aparece con dos franjas negras enormes.
 *
 * No es una simulación exacta —ninguna lo es, las apps cambian— pero muestra
 * el recorte y el corte de texto, que es donde se llevan las sorpresas.
 */

type RedId = "instagram" | "messenger" | "tiktok";
/** Lo que se puede previsualizar: cada red, y la historia (2026-09-25). */
type Vista = RedId | "historia";

export function PreviewRedes({
  redes,
  negocio,
  texto,
  mediaUrls,
  tipoMedia,
  cuando,
  formato = "post",
}: {
  /** Las que eligió publicar. Vacío = se muestra Instagram como referencia. */
  redes: string[];
  negocio: string;
  texto: string;
  /**
   * TODAS las láminas, en orden (2026-09-19). Antes era `mediaUrl` (una): un
   * carrusel se previsualizaba como si fuera un post de una sola foto, así que
   * no había forma de revisar las otras láminas antes de publicar.
   */
  mediaUrls: string[];
  tipoMedia: "imagen" | "video" | null;
  /** "Ahora" o la fecha programada. */
  cuando: string;
  /** Post, historia o los dos: la historia tiene su propia pestaña. */
  formato?: "post" | "historia" | "ambos";
}) {
  const disponibles = (["instagram", "messenger", "tiktok"] as RedId[]).filter(
    (r) => redes.includes(r) && !(formato === "historia" && r === "tiktok"),
  );
  const posts: Vista[] = formato === "historia"
    ? []
    : disponibles.length > 0 ? disponibles : ["instagram"];
  const lista: Vista[] = formato === "post" ? posts : [...posts, "historia"];
  const [ver, setVer] = useState<Vista>(lista[0]);
  // Si desmarcó la red que estaba viendo, se cae a la primera disponible en
  // vez de mostrar un preview de una red a la que ya no va a publicar.
  const activa = lista.includes(ver) ? ver : lista[0];

  const inicial = (negocio || "N")[0].toUpperCase();

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.8rem] font-bold uppercase tracking-wide text-frio">
          Así se va a ver
        </p>
        {lista.length > 1 && (
          <div className="flex gap-1" role="tablist">
            {lista.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={activa === r}
                onClick={() => setVer(r)}
                className={`rounded-chip px-2.5 py-1 text-[0.75rem] font-bold transition ${
                  activa === r
                    ? "bg-tinta text-carta"
                    : "bg-arena text-frio ring-1 ring-linea hover:bg-linea"
                }`}
              >
                {NOMBRE[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      {activa === "instagram" && (
        <PreviewInstagram
          inicial={inicial}
          negocio={negocio}
          texto={texto}
          mediaUrls={mediaUrls}
          tipoMedia={tipoMedia}
        />
      )}
      {activa === "messenger" && (
        <PreviewFacebook
          inicial={inicial}
          negocio={negocio}
          texto={texto}
          mediaUrls={mediaUrls}
          tipoMedia={tipoMedia}
          cuando={cuando}
        />
      )}
      {activa === "tiktok" && (
        <PreviewTikTok
          negocio={negocio}
          texto={texto}
          mediaUrls={mediaUrls}
          tipoMedia={tipoMedia}
        />
      )}
      {activa === "historia" && (
        <PreviewHistoria
          inicial={inicial}
          negocio={negocio}
          mediaUrl={mediaUrls[0] ?? null}
          tipoMedia={tipoMedia}
        />
      )}
    </div>
  );
}

const NOMBRE: Record<Vista, string> = {
  instagram: "Instagram",
  messenger: "Facebook",
  tiktok: "TikTok",
  historia: "Historia",
};

/**
 * LA HISTORIA (2026-09-25). Pantalla completa vertical 9:16, sin texto: lo
 * que el dueño tiene que ver es cómo recorta su foto y que el copy no sale.
 * Es igual en Instagram y en Facebook, por eso es una sola pestaña.
 */
function PreviewHistoria({
  inicial, negocio, mediaUrl, tipoMedia,
}: { inicial: string; negocio: string; mediaUrl: string | null; tipoMedia: "imagen" | "video" | null }) {
  return (
    <div>
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[240px] overflow-hidden rounded-[18px] bg-black ring-1 ring-linea">
        {mediaUrl ? (
          tipoMedia === "video" ? (
            <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Vista de la historia" className="h-full w-full object-cover" />
          )
        ) : (
          <SinMedia alto="h-full" />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/50 to-transparent px-2.5 pb-6 pt-2">
          <div className="h-0.5 w-full rounded-full bg-white/40">
            <div className="h-full w-1/3 rounded-full bg-white" />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-brasa text-[0.7rem] font-bold text-carta">{inicial}</span>
            <span className="text-[0.74rem] font-semibold text-white">{negocio || "Tu negocio"}</span>
            <span className="text-[0.7rem] text-white/70">· ahora</span>
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[0.74rem] text-frio">
        Así sale en Instagram y en Facebook. La historia no muestra el texto y dura 24 horas.
      </p>
    </div>
  );
}

/** El hueco cuando todavía no subió nada: sin foto no hay nada que mostrar. */
function SinMedia({ alto = "aspect-square" }: { alto?: string }) {
  return (
    <div className={`grid w-full place-items-center bg-arena ${alto}`}>
      <p className="px-4 text-center text-[0.8rem] text-frio">
        Sube tu foto o video para verlo aquí
      </p>
    </div>
  );
}

/**
 * La media del post. Con varias láminas es un CARRUSEL NAVEGABLE, no solo la
 * portada (2026-09-19): las redes dejan deslizar y el dueño tiene que poder
 * revisar la lámina 5 —donde suele ir el CTA— antes de publicar, no después.
 *
 * Los puntitos y el contador imitan lo que Instagram muestra de verdad, así
 * que también sirven de recordatorio de que el post ES un carrusel.
 */
function Media({
  mediaUrls,
  tipoMedia,
  clase,
}: {
  mediaUrls: string[];
  tipoMedia: "imagen" | "video" | null;
  clase: string;
}) {
  const [i, setI] = useState(0);
  if (mediaUrls.length === 0) return null;

  // Si se quitó una lámina, el índice puede quedar fuera: se cae a la última.
  const idx = Math.min(i, mediaUrls.length - 1);
  const actual = mediaUrls[idx];
  const varias = mediaUrls.length > 1;

  const media = tipoMedia === "video"
    ? <video src={actual} muted playsInline loop autoPlay className={clase} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={actual} alt={varias ? `Lámina ${idx + 1} de ${mediaUrls.length}` : ""} className={clase} />;

  if (!varias) return media;

  return (
    <div className="relative">
      {media}
      {/* Contador arriba a la derecha, como en Instagram. */}
      <span className="absolute right-2 top-2 rounded-chip bg-black/60 px-2 py-0.5 text-[0.7rem] font-semibold text-white">
        {idx + 1}/{mediaUrls.length}
      </span>
      {idx > 0 && (
        <button
          type="button"
          onClick={() => setI(idx - 1)}
          aria-label="Lámina anterior"
          className="absolute left-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[0.85rem] font-bold text-[#262626] shadow transition hover:bg-white"
        >
          ‹
        </button>
      )}
      {idx < mediaUrls.length - 1 && (
        <button
          type="button"
          onClick={() => setI(idx + 1)}
          aria-label="Lámina siguiente"
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-[0.85rem] font-bold text-[#262626] shadow transition hover:bg-white"
        >
          ›
        </button>
      )}
      {/* Los puntitos: dónde estoy dentro del carrusel. */}
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
        {mediaUrls.map((u, n) => (
          <button
            key={u}
            type="button"
            onClick={() => setI(n)}
            aria-label={`Ver la lámina ${n + 1}`}
            className={`h-1.5 w-1.5 rounded-full transition ${n === idx ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * INSTAGRAM: el feed recorta a CUADRADO.
 *
 * `object-cover` y no `contain` a propósito: así se ve lo que Instagram va a
 * CORTAR de una foto vertical, que es justo la sorpresa que queremos evitar.
 */
function PreviewInstagram({
  inicial, negocio, texto, mediaUrls, tipoMedia,
}: {
  inicial: string; negocio: string; texto: string;
  mediaUrls: string[]; tipoMedia: "imagen" | "video" | null;
}) {
  return (
    <div className="max-w-[320px] overflow-hidden rounded-xl bg-white ring-1 ring-linea">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-[0.75rem] font-bold text-white">
          {inicial}
        </span>
        <p className="min-w-0 truncate text-[0.8rem] font-semibold text-[#262626]">
          {negocio || "tu_negocio"}
        </p>
        <span className="ml-auto text-[1rem] leading-none text-[#262626]">⋯</span>
      </div>
      {mediaUrls.length > 0 ? (
        <Media mediaUrls={mediaUrls} tipoMedia={tipoMedia} clase="aspect-square w-full object-cover" />
      ) : (
        <SinMedia />
      )}
      <div className="px-3 pb-3 pt-2.5">
        <div className="flex gap-3 text-[1.05rem] text-[#262626]">
          <span>♡</span>
          <span>💬</span>
          <span>➤</span>
        </div>
        {texto.trim() && (
          <p className="mt-2 text-[0.78rem] leading-snug text-[#262626]">
            <span className="font-semibold">{negocio || "tu_negocio"}</span>{" "}
            <span className="whitespace-pre-wrap">{recortar(texto, 125)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** FACEBOOK: horizontal, y el texto se corta con "Ver más" a las ~3 líneas. */
function PreviewFacebook({
  inicial, negocio, texto, mediaUrls, tipoMedia, cuando,
}: {
  inicial: string; negocio: string; texto: string;
  mediaUrls: string[]; tipoMedia: "imagen" | "video" | null; cuando: string;
}) {
  const largo = texto.trim().length > 160;
  return (
    <div className="max-w-[340px] overflow-hidden rounded-xl bg-white ring-1 ring-linea">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1877f2] text-[0.85rem] font-bold text-white">
          {inicial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.82rem] font-semibold text-[#050505]">
            {negocio || "Tu negocio"}
          </p>
          <p className="text-[0.7rem] text-[#65676b]">{cuando} · 🌎</p>
        </div>
      </div>
      {texto.trim() && (
        <p className="px-3 pb-2.5 text-[0.8rem] leading-snug text-[#050505]">
          <span className="whitespace-pre-wrap">{recortar(texto, 160)}</span>
          {largo && <span className="text-[#65676b]"> Ver más</span>}
        </p>
      )}
      {mediaUrls.length > 0 ? (
        <Media mediaUrls={mediaUrls} tipoMedia={tipoMedia} clase="max-h-64 w-full bg-black object-contain" />
      ) : (
        <SinMedia alto="aspect-[4/3]" />
      )}
      <div className="flex justify-around border-t border-[#ced0d4] py-1.5 text-[0.75rem] font-semibold text-[#65676b]">
        <span>👍 Me gusta</span>
        <span>💬 Comentar</span>
        <span>↗ Compartir</span>
      </div>
    </div>
  );
}

/**
 * TIKTOK: pantalla completa VERTICAL, con el texto encima del video.
 *
 * Es donde más se sorprende la gente: un video horizontal queda con dos
 * franjas negras enormes, y eso solo se entiende viéndolo.
 */
function PreviewTikTok({
  negocio, texto, mediaUrls, tipoMedia,
}: {
  negocio: string; texto: string;
  mediaUrls: string[]; tipoMedia: "imagen" | "video" | null;
}) {
  return (
    <div className="relative max-w-[220px] overflow-hidden rounded-xl bg-black ring-1 ring-linea">
      <div className="aspect-[9/16] w-full">
        {mediaUrls.length > 0 ? (
          <Media mediaUrls={mediaUrls} tipoMedia={tipoMedia} clase="h-full w-full object-contain" />
        ) : (
          <div className="grid h-full place-items-center px-4 text-center text-[0.78rem] text-white/60">
            TikTok necesita un video vertical
          </div>
        )}
      </div>
      {/* El texto va ENCIMA del video, abajo a la izquierda, como en la app. */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        <p className="text-[0.78rem] font-bold text-white">@{(negocio || "tunegocio").toLowerCase().replace(/\s+/g, "")}</p>
        {texto.trim() && (
          <p className="mt-1 text-[0.74rem] leading-snug text-white/90">
            <span className="whitespace-pre-wrap">{recortar(texto, 100)}</span>
          </p>
        )}
      </div>
      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-[1.1rem] text-white">
        <span>♡</span>
        <span>💬</span>
        <span>➤</span>
      </div>
    </div>
  );
}

/**
 * Corta el texto donde lo corta la red, con "…".
 *
 * Los topes son aproximados a propósito: cada app los cambia seguido y no vale
 * la pena perseguirlos. Lo que importa es que el dueño VEA que su texto se
 * corta, no en qué letra exacta.
 */
function recortar(t: string, max: number): string {
  const limpio = t.trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max).trimEnd()}…`;
}

export default PreviewRedes;
