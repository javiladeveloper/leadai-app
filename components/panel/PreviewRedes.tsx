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

export function PreviewRedes({
  redes,
  negocio,
  texto,
  mediaUrl,
  tipoMedia,
  cuando,
}: {
  /** Las que eligió publicar. Vacío = se muestra Instagram como referencia. */
  redes: string[];
  negocio: string;
  texto: string;
  mediaUrl: string | null;
  tipoMedia: "imagen" | "video" | null;
  /** "Ahora" o la fecha programada. */
  cuando: string;
}) {
  const disponibles = (["instagram", "messenger", "tiktok"] as RedId[]).filter(
    (r) => redes.includes(r),
  );
  const lista = disponibles.length > 0 ? disponibles : (["instagram"] as RedId[]);
  const [ver, setVer] = useState<RedId>(lista[0]);
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
          mediaUrl={mediaUrl}
          tipoMedia={tipoMedia}
        />
      )}
      {activa === "messenger" && (
        <PreviewFacebook
          inicial={inicial}
          negocio={negocio}
          texto={texto}
          mediaUrl={mediaUrl}
          tipoMedia={tipoMedia}
          cuando={cuando}
        />
      )}
      {activa === "tiktok" && (
        <PreviewTikTok
          negocio={negocio}
          texto={texto}
          mediaUrl={mediaUrl}
          tipoMedia={tipoMedia}
        />
      )}
    </div>
  );
}

const NOMBRE: Record<RedId, string> = {
  instagram: "Instagram",
  messenger: "Facebook",
  tiktok: "TikTok",
};

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

function Media({
  mediaUrl,
  tipoMedia,
  clase,
}: {
  mediaUrl: string | null;
  tipoMedia: "imagen" | "video" | null;
  clase: string;
}) {
  if (!mediaUrl) return null;
  if (tipoMedia === "video") {
    return <video src={mediaUrl} muted playsInline loop autoPlay className={clase} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={mediaUrl} alt="" className={clase} />;
}

/**
 * INSTAGRAM: el feed recorta a CUADRADO.
 *
 * `object-cover` y no `contain` a propósito: así se ve lo que Instagram va a
 * CORTAR de una foto vertical, que es justo la sorpresa que queremos evitar.
 */
function PreviewInstagram({
  inicial, negocio, texto, mediaUrl, tipoMedia,
}: {
  inicial: string; negocio: string; texto: string;
  mediaUrl: string | null; tipoMedia: "imagen" | "video" | null;
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
      {mediaUrl ? (
        <Media mediaUrl={mediaUrl} tipoMedia={tipoMedia} clase="aspect-square w-full object-cover" />
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
  inicial, negocio, texto, mediaUrl, tipoMedia, cuando,
}: {
  inicial: string; negocio: string; texto: string;
  mediaUrl: string | null; tipoMedia: "imagen" | "video" | null; cuando: string;
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
      {mediaUrl ? (
        <Media mediaUrl={mediaUrl} tipoMedia={tipoMedia} clase="max-h-64 w-full bg-black object-contain" />
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
  negocio, texto, mediaUrl, tipoMedia,
}: {
  negocio: string; texto: string;
  mediaUrl: string | null; tipoMedia: "imagen" | "video" | null;
}) {
  return (
    <div className="relative max-w-[220px] overflow-hidden rounded-xl bg-black ring-1 ring-linea">
      <div className="aspect-[9/16] w-full">
        {mediaUrl ? (
          <Media mediaUrl={mediaUrl} tipoMedia={tipoMedia} clase="h-full w-full object-contain" />
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
