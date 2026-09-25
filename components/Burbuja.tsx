import type { Mensaje } from "@/lib/tipos";
import { haceTexto } from "@/lib/leads";
import { IconoMic } from "./Iconos";
import { mediaDelTexto } from "@/lib/media-chat";

// Una burbuja de chat. El autor define alineación y color:
//  · lead → izquierda, superficie clara
//  · bot  → izquierda, teñida (fue la IA quien respondió)
//  · tú   → derecha, brasa (lo que vos mandaste)
export function Burbuja({ m }: { m: Mensaje }) {
  const mio = m.autor === "tu";
  const bot = m.autor === "bot";
  // Foto o video mandado desde el chat (2026-09-25): se ve, no el link.
  const media = mediaDelTexto(m.texto);

  const clase = mio
    ? "bg-brasa text-carta rounded-br-md"
    : bot
      ? "bg-brasa-suave text-tinta rounded-bl-md"
      : "bg-carta text-tinta ring-1 ring-linea rounded-bl-md";

  return (
    <div className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      {bot && (
        <span className="mb-1 ml-1 flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-wide text-brasa-hondo">
          <span className="h-1.5 w-1.5 rounded-full bg-brasa" /> Respondió la IA
        </span>
      )}
      <div className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[0.98rem] leading-snug ${clase} ${m.enviando ? "opacity-70" : ""}`}>
        {m.esVoz && (
          <span
            className={`mb-1 flex items-center gap-1.5 text-[0.72rem] font-semibold ${
              mio ? "text-carta/80" : "text-frio"
            }`}
          >
            <IconoMic className="h-3.5 w-3.5" /> Nota de voz · transcripta
          </span>
        )}
        {media ? (
          <span className="flex flex-col gap-1.5">
            {media.tipo === "video" ? (
              <video src={media.url} controls preload="metadata" className="max-h-72 w-full rounded-xl bg-black/20" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- archivo de nuestro storage, no un asset de Next.
              <img src={media.url} alt={media.caption ?? "Foto enviada"} className="max-h-72 w-full rounded-xl object-cover" />
            )}
            {media.caption && <span>{media.caption}</span>}
          </span>
        ) : m.texto}
      </div>
      <span className="mt-1 px-1 text-[0.68rem] text-frio">
        {m.enviando ? "Enviando…" : m.hora ?? haceTexto(m.haceMinutos)}
      </span>
    </div>
  );
}
