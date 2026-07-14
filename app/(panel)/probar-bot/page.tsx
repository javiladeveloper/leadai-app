"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { simularMensaje, resetSimulador, obtenerHistorialSimulador } from "@/lib/api";
import { IconoEnviar } from "@/components/Iconos";

type Boton = { id: string; etiqueta: string };
type Msg = { direccion: "entrante" | "saliente"; texto: string; botones?: Boton[] };

const NIVEL_ETIQUETA: Record<string, { txt: string; clase: string }> = {
  caliente: { txt: "🔴 Caliente", clase: "bg-brasa-suave text-brasa-hondo" },
  tibio: { txt: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { txt: "⚪ Frío", clase: "bg-arena text-frio" },
};

export default function ProbarBotPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [nivel, setNivel] = useState<string>("");
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
    // Cargamos la conversación de prueba que ya existía, para no perderla al
    // volver a esta pantalla.
    obtenerHistorialSimulador().then((h) => {
      if (h && h.mensajes.length > 0) {
        setMensajes(h.mensajes);
        setNivel(h.nivelInteres);
      }
    });
  }, [router]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, enviando]);

  // `directo` se usa al tocar un botón (mandamos su etiqueta como si el cliente
  // la hubiera escrito). Sin argumento, toma lo escrito en el input.
  async function enviar(directo?: string) {
    const t = (directo ?? texto).trim();
    if (!t || enviando) return;
    if (!directo) setTexto("");
    // Pinta el mensaje del "cliente" al instante (optimista).
    setMensajes((m) => [...m, { direccion: "entrante", texto: t }]);
    setEnviando(true);
    try {
      const r = await simularMensaje(t);
      setMensajes(r.mensajes); // la fuente de verdad: toda la conversación real
      setNivel(r.nivelInteres);
    } catch {
      setMensajes((m) => [...m, { direccion: "saliente", texto: "⚠️ Hubo un error al procesar. Probá de nuevo." }]);
    } finally {
      setEnviando(false);
    }
  }

  async function reiniciar() {
    await resetSimulador();
    setMensajes([]);
    setNivel("");
  }

  if (!listo) return null;

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-2xl flex-col px-4 py-4">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Simulador</p>
          <h1 className="mt-1 text-[1.5rem] font-bold text-tinta">Probá tu bot</h1>
          <p className="mt-0.5 text-[0.85rem] text-frio">
            Escribí como si fueras un cliente y mirá cómo responde la IA. No usa WhatsApp real.
          </p>
        </div>
        <button
          onClick={reiniciar}
          className="shrink-0 rounded-chip bg-carta px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena"
        >
          Reiniciar
        </button>
      </header>

      {nivel && (
        <div className="mb-2 flex items-center gap-2 text-[0.8rem]">
          <span className="text-frio">La IA lo calificó como:</span>
          <span className={`rounded-chip px-2 py-0.5 font-bold ${NIVEL_ETIQUETA[nivel]?.clase ?? "bg-arena text-frio"}`}>
            {NIVEL_ETIQUETA[nivel]?.txt ?? nivel}
          </span>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto rounded-tarjeta bg-[#e8ddc9]/40 p-4 ring-1 ring-linea">
        {mensajes.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-4xl">💬</p>
              <p className="mt-2 text-[0.9rem] font-semibold text-tinta">Escribí tu primer mensaje</p>
              <p className="mt-1 text-[0.82rem] text-frio">Ej: &ldquo;Hola, ¿cuánto cuesta?&rdquo;</p>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {mensajes.map((m, i) => {
            // Los botones se pueden tocar solo si es el ÚLTIMO mensaje (los de
            // mensajes viejos se muestran deshabilitados, como en WhatsApp).
            const esUltimo = i === mensajes.length - 1;
            return (
              <div key={i}>
                <div className={`flex ${m.direccion === "entrante" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.95rem] shadow-sm ${
                      m.direccion === "entrante"
                        ? "rounded-br-sm bg-[#d9fdd3] text-tinta"
                        : "rounded-bl-sm bg-carta text-tinta ring-1 ring-linea"
                    }`}
                  >
                    {m.texto}
                  </div>
                </div>
                {/* Botones interactivos del nodo 'opciones' */}
                {m.botones && m.botones.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap justify-start gap-2">
                    {m.botones.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        disabled={!esUltimo || enviando}
                        onClick={() => enviar(b.etiqueta)}
                        className="rounded-full border border-brasa/40 bg-carta px-4 py-1.5 text-[0.88rem] font-semibold text-brasa-hondo transition hover:bg-brasa-suave disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-carta"
                      >
                        {b.etiqueta}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {enviando && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-carta px-4 py-3 ring-1 ring-linea">
                <span className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-frio [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-frio [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-frio" />
                </span>
              </div>
            </div>
          )}
          <div ref={finRef} />
        </div>
      </div>

      {/* Input */}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          rows={1}
          placeholder="Escribí como si fueras el cliente…"
          className="max-h-28 flex-1 resize-none rounded-2xl bg-arena px-3.5 py-2.5 text-[0.98rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
        />
        <button
          onClick={() => enviar()}
          disabled={enviando || !texto.trim()}
          aria-label="Enviar"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brasa text-carta disabled:opacity-60"
        >
          <IconoEnviar className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
