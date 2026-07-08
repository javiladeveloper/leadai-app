import type { Mensaje } from "@/lib/tipos";
import { haceTexto } from "@/lib/leads";
import { IconoMic } from "./Iconos";

// Una burbuja de chat. El autor define alineación y color:
//  · lead → izquierda, superficie clara
//  · bot  → izquierda, teñida (fue la IA quien respondió)
//  · tú   → derecha, brasa (lo que vos mandaste)
export function Burbuja({ m }: { m: Mensaje }) {
  const mio = m.autor === "tu";
  const bot = m.autor === "bot";

  const clase = mio
    ? "bg-brasa text-carta rounded-br-md"
    : bot
      ? "bg-tibio-suave text-tinta rounded-bl-md"
      : "bg-carta text-tinta ring-1 ring-linea rounded-bl-md";

  return (
    <div className={`flex flex-col ${mio ? "items-end" : "items-start"}`}>
      {bot && (
        <span className="mb-1 ml-1 text-[0.68rem] font-bold uppercase tracking-wide text-tibio">
          Respondió la IA
        </span>
      )}
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[0.98rem] leading-snug ${clase}`}>
        {m.esVoz && (
          <span
            className={`mb-1 flex items-center gap-1.5 text-[0.72rem] font-semibold ${
              mio ? "text-carta/80" : "text-frio"
            }`}
          >
            <IconoMic className="h-3.5 w-3.5" /> Nota de voz · transcripta
          </span>
        )}
        {m.texto}
      </div>
      <span className="mt-1 px-1 text-[0.68rem] text-frio">{haceTexto(m.haceMinutos)}</span>
    </div>
  );
}
