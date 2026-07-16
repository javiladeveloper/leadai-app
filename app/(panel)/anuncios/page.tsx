"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  objetivosAd, publicoSugeridoAd, presupuestoAd, sugerirTextoAd, listarAnuncios, crearAnuncio,
  type ObjetivoAd, type PublicoAd, type RecomPresupuesto, type Anuncio,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";

const ESTADO_AD: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-arena text-frio" },
  activo: { texto: "Activo", clase: "bg-ok/12 text-ok" },
  pausado: { texto: "Pausado", clase: "bg-tibio-suave text-tibio" },
  finalizado: { texto: "Finalizado", clase: "bg-arena text-frio" },
  rechazado: { texto: "Rechazado", clase: "bg-brasa-suave text-brasa-hondo" },
};

// Creador de anuncios guiado (Fase 3B): wizard en pasos que pregunta qué querés
// conseguir y arma el ad con las mejores configuraciones. La publicación real
// espera la conexión de Meta; hoy se simula.
export default function AnunciosPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [objetivos, setObjetivos] = useState<ObjetivoAd[]>([]);
  const [creando, setCreando] = useState(false);

  // Wizard
  const [paso, setPaso] = useState(0); // 0=objetivo 1=contenido 2=publico 3=presupuesto 4=resumen
  const [objetivo, setObjetivo] = useState("mensajes");
  const [campania, setCampania] = useState("");
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState<PublicoAd | null>(null);
  const [zona, setZona] = useState("");
  const [total, setTotal] = useState("100");
  const [dias, setDias] = useState("7");
  const [recom, setRecom] = useState<RecomPresupuesto | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const [a, o] = await Promise.all([listarAnuncios(), objetivosAd()]);
      setAnuncios(a);
      setObjetivos(o);
      setEstado("ok");
    } catch { setEstado("error"); }
  }, []);

  useEffect(() => { if (listo) cargar(); }, [listo, cargar]);

  // Al entrar al paso de público, carga el sugerido por rubro.
  useEffect(() => {
    if (paso === 2 && !publico) publicoSugeridoAd().then(setPublico);
  }, [paso, publico]);

  // Al entrar al paso de presupuesto (o cambiar total/días), recalcula.
  useEffect(() => {
    if (paso !== 3) return;
    const t = Number(total), d = Number(dias);
    if (t > 0 && d > 0) {
      const id = setTimeout(() => { presupuestoAd(t, d).then(setRecom); }, 300);
      return () => clearTimeout(id);
    }
  }, [paso, total, dias]);

  async function sugerirTexto() {
    if (!campania.trim() || sugiriendo) return;
    setSugiriendo(true);
    const t = await sugerirTextoAd(campania.trim());
    setSugiriendo(false);
    if (t) setTexto(t);
  }

  async function publicar() {
    if (publicando) return;
    setPublicando(true);
    setMsg("");
    const r = await crearAnuncio({
      objetivo,
      campaniaNombre: campania.trim(),
      texto: texto.trim(),
      publico: publico ? { zona, edadMin: publico.edadMin, edadMax: publico.edadMax, intereses: publico.intereses } : { zona },
      presupuestoTotal: Number(total),
      dias: Number(dias),
    });
    setPublicando(false);
    if (r.ok) {
      // Reset del wizard
      setCreando(false); setPaso(0); setCampania(""); setTexto(""); setPublico(null); setZona(""); setTotal("100"); setDias("7"); setRecom(null);
      cargar();
    } else {
      setMsg(r.error ?? "No se pudo crear el anuncio.");
    }
  }

  if (!listo) return null;

  const objSel = objetivos.find((o) => o.id === objetivo);
  const puedeAvanzar =
    (paso === 0) ||
    (paso === 1 && campania.trim() && texto.trim()) ||
    (paso === 2) ||
    (paso === 3 && Number(total) > 0 && Number(dias) > 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Tu embudo</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Anuncios</h1>
          <p className="mt-1 text-[0.92rem] text-frio">
            Creá anuncios en Instagram y Facebook con la ayuda de la IA. Te guía paso a paso.
          </p>
        </div>
        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="rounded-chip bg-brasa px-5 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo"
          >
            + Crear anuncio
          </button>
        )}
      </header>

      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        📣 La publicación real de anuncios se activa al conectar tu cuenta de Meta (con tu propio
        medio de pago; el gasto es tuyo). Mientras tanto, armá y probá tus anuncios acá.
      </div>

      {/* Wizard de creación */}
      {creando && (
        <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
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
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Qué querés conseguir?</h2>
              <p className="mt-0.5 text-[0.82rem] text-frio">Elegí tu meta y armamos el anuncio para eso.</p>
              <div className="mt-3 space-y-2">
                {objetivos.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setObjetivo(o.id)}
                    className={`w-full rounded-tarjeta border p-3.5 text-left transition ${
                      objetivo === o.id ? "border-brasa bg-brasa-suave" : "border-linea bg-carta hover:border-brasa/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[0.95rem] font-bold text-tinta">{o.pregunta}</span>
                      {o.recomendado && <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[0.66rem] font-bold text-ok">Recomendado</span>}
                    </div>
                    <p className="mt-1 text-[0.8rem] text-tinta-2">{o.porque}</p>
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
                  onChange={(e) => setCampania(e.target.value)}
                  placeholder="Ej: Promo declaración anual"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Así vas a reconocer de qué campaña vienen tus leads.</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[0.85rem] font-bold text-tinta">Texto del anuncio</label>
                  <button onClick={sugerirTexto} disabled={sugiriendo || !campania.trim()} className="text-[0.8rem] font-semibold text-brasa disabled:opacity-40">
                    {sugiriendo ? "Pensando…" : "✨ Escribir con IA"}
                  </button>
                </div>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  placeholder="Poné el nombre de la campaña y tocá 'Escribir con IA', o escribilo vos…"
                  className="mt-1 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Tip: la primera frase es la que engancha. Usá algo que frene el scroll.</p>
              </div>
            </div>
          )}

          {/* Paso 2 — Público */}
          {paso === 2 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿A quién le mostramos el anuncio?</h2>
              <p className="text-[0.82rem] text-frio">
                Elegimos un público según tu rubro. Meta encuentra a los más interesados solo — con
                un público amplio suele rendir mejor.
              </p>
              {publico && (
                <div className="rounded-tarjeta bg-arena/50 p-3.5">
                  <p className="text-[0.85rem] font-semibold text-tinta">{publico.nota}</p>
                  <p className="mt-1 text-[0.82rem] text-tinta-2">
                    Edad {publico.edadMin}–{publico.edadMax}
                    {publico.intereses.length > 0 && <> · {publico.intereses.join(", ")}</>}
                  </p>
                </div>
              )}
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Zona</label>
                <input
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  placeholder="Ej: Lima, Perú"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              </div>
            </div>
          )}

          {/* Paso 3 — Presupuesto */}
          {paso === 3 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Cuánto querés invertir?</h2>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Total (S/)</label>
                  <input type="number" min="1" value={total} onChange={(e) => setTotal(e.target.value)}
                    className="mt-1 w-28 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40" />
                </div>
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Durante (días)</label>
                  <input type="number" min="1" max="90" value={dias} onChange={(e) => setDias(e.target.value)}
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
              <h2 className="text-[1.05rem] font-bold text-tinta">Revisá antes de publicar</h2>
              <div className="space-y-1.5 rounded-tarjeta bg-arena/50 p-4 text-[0.86rem] text-tinta-2">
                <p><b className="text-tinta">Objetivo:</b> {objSel?.pregunta}</p>
                <p><b className="text-tinta">Campaña:</b> {campania}</p>
                <p><b className="text-tinta">Texto:</b> “{texto}”</p>
                <p><b className="text-tinta">Público:</b> {zona || "tu zona"}{publico && <> · {publico.edadMin}–{publico.edadMax} años</>}</p>
                <p className="text-brasa-hondo"><b>Vas a gastar hasta S/{total} en {dias} días</b> (S/{(Number(total) / Number(dias) || 0).toFixed(2)}/día).</p>
              </div>
              <p className="text-[0.78rem] text-frio">
                ⏳ Los primeros 3-7 días el anuncio "aprende" — no lo pauses ni edites en ese tiempo para que rinda mejor.
              </p>
              {msg && <p className="text-[0.84rem] font-semibold text-brasa-hondo">{msg}</p>}
            </div>
          )}

          {/* Navegación */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <button
              onClick={() => (paso === 0 ? setCreando(false) : setPaso(paso - 1))}
              className="rounded-chip bg-arena px-4 py-2 text-sm font-semibold text-tinta-2 transition hover:bg-linea"
            >
              {paso === 0 ? "Cancelar" : "Atrás"}
            </button>
            {paso < 4 ? (
              <button
                onClick={() => setPaso(paso + 1)}
                disabled={!puedeAvanzar}
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={publicar}
                disabled={publicando}
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                {publicando ? "Publicando…" : "Publicar anuncio"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de anuncios */}
      {!creando && (
        <div>
          <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Tus anuncios</h2>
          {estado === "cargando" && <SkeletonLista filas={3} />}
          {estado === "ok" && anuncios.length === 0 && (
            <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
              <p className="text-[1.02rem] font-bold text-tinta">Todavía no creaste anuncios</p>
              <p className="mt-1 text-[0.88rem] text-frio">Tocá "Crear anuncio" y te guiamos paso a paso.</p>
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
                    <p className="mt-1.5 text-[0.76rem] text-frio">
                      S/{a.presupuestoTotal} · {a.dias} días · S/{(a.presupuestoTotal / a.dias || 0).toFixed(0)}/día
                    </p>
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
