"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import { listarComentarios, simularComentario, type Comentario } from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { AjustesComentarios } from "@/components/panel/AjustesComentarios";

type Estado = "cargando" | "ok" | "error";

// Etiqueta visual por intención detectada por la IA.
const INTENCION: Record<string, { texto: string; clase: string }> = {
  compra: { texto: "🛒 Intención de compra", clase: "bg-brasa-suave text-brasa-hondo" },
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
  const [ultimo, setUltimo] = useState<{ intencion?: string; respondido?: boolean; respuesta?: string; leadId?: string } | null>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      setComentarios(await listarComentarios());
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  async function probar() {
    const t = texto.trim();
    if (!t || simulando) return;
    setSimulando(true);
    setUltimo(null);
    const r = await simularComentario({ texto: t, autorNombre: "Cliente de prueba" });
    setSimulando(false);
    if (r.ok) {
      setUltimo({ intencion: r.intencion, respondido: r.respondido, respuesta: r.respuesta, leadId: r.leadId });
      setTexto("");
      cargar(); // refresca el log con el nuevo comentario
    }
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu embudo</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Comentarios</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Cuando alguien comenta tu publicación con intención de compra, la IA le responde
          e invita al privado. Acá ves todo lo que captó.
        </p>
      </header>

      {/* Aviso: conexión real pendiente de Meta */}
      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        📸 La captación automática de comentarios de Instagram/Facebook se activa cuando conectes
        tus redes (requiere la aprobación de Meta). Mientras tanto, probá cómo responde la IA acá abajo.
      </div>

      {/* Ajustes: activar/desactivar + mensaje personalizado */}
      <AjustesComentarios />

      {/* Simulador: probar el flujo sin Meta */}
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <h2 className="text-[1.05rem] font-bold text-tinta">Probá la respuesta de la IA</h2>
        <p className="mt-1 text-[0.82rem] text-frio">
          Escribí un comentario como lo haría un cliente y mirá cómo lo clasifica y responde.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") probar(); }}
            placeholder="Ej: ¿cuánto cuesta? ¿hacen delivery?"
            className="flex-1 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
          />
          <button
            onClick={probar}
            disabled={simulando || !texto.trim()}
            className="shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {simulando ? "Probando…" : "Probar"}
          </button>
        </div>

        {ultimo && (
          <div className="mt-3 rounded-tarjeta bg-arena/50 px-4 py-3">
            <p className="text-[0.8rem] font-semibold text-tinta-2">
              La IA lo clasificó como:{" "}
              <span className="font-bold">{INTENCION[ultimo.intencion ?? "otro"]?.texto ?? ultimo.intencion}</span>
            </p>
            {ultimo.respondido && ultimo.respuesta ? (
              <>
                <p className="mt-1.5 text-[0.88rem] text-tinta">
                  <span className="text-frio">Así respondería en el comentario: </span>“{ultimo.respuesta}”
                </p>
                {/* El ciclo completo: comentario → DM → lead en el pipeline */}
                <div className="mt-2.5 space-y-1 rounded-chip bg-carta px-3 py-2 text-[0.8rem] text-tinta-2 ring-1 ring-linea">
                  <p className="font-semibold text-tinta">El ciclo completo:</p>
                  <p>1️⃣ Responde el comentario e invita al privado</p>
                  <p>2️⃣ Abre un DM y la IA sigue la venta ahí (como en WhatsApp)</p>
                  <p>
                    3️⃣ Entra al pipeline como lead{" "}
                    {ultimo.leadId && (
                      <Link href={`/conversacion/${ultimo.leadId}`} className="font-semibold text-brasa hover:text-brasa-hondo">
                        — ver la conversación →
                      </Link>
                    )}
                  </p>
                </div>
                <p className="mt-1.5 text-[0.76rem] text-frio">
                  (Es una simulación — el envío real a Instagram se activa al conectar tus redes.)
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-[0.84rem] text-frio">
                No es intención de compra → la IA no responde (no gasta). Queda registrado igual.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Log de comentarios */}
      <div>
        <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Comentarios captados</h2>

        {estado === "cargando" && <SkeletonLista filas={3} />}
        {estado === "error" && (
          <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
            <p className="font-semibold text-tinta">No pudimos cargar los comentarios. Recargá.</p>
          </div>
        )}
        {estado === "ok" && comentarios.length === 0 && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Todavía no hay comentarios captados</p>
            <p className="mt-1 text-[0.88rem] text-frio">
              Cuando conectes tus redes, los comentarios con intención van a aparecer acá.
            </p>
          </div>
        )}

        {estado === "ok" && comentarios.length > 0 && (
          <div className="space-y-2.5">
            {comentarios.map((c) => {
              const et = INTENCION[c.intencion ?? "otro"] ?? INTENCION.otro;
              return (
                <article
                  key={c.id}
                  className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-semibold text-tinta">
                      {c.autorNombre ?? "Alguien"} comentó:
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>
                      {et.texto}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.9rem] text-tinta-2">“{c.texto}”</p>

                  {c.respondido && c.respuestaTexto && (
                    <div className="mt-2 rounded-chip bg-brasa-suave/40 px-3 py-2 text-[0.84rem] text-tinta-2">
                      <span className="font-semibold text-brasa-hondo">La IA respondería: </span>
                      “{c.respuestaTexto}”
                      {c.dmAbierto && <span className="ml-1 text-frio">· y abriría un DM 📩</span>}
                    </div>
                  )}

                  {c.leadId && (
                    <Link
                      href={`/conversacion/${c.leadId}`}
                      className="mt-2 inline-block text-[0.82rem] font-semibold text-brasa hover:text-brasa-hondo"
                    >
                      Ver conversación →
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
