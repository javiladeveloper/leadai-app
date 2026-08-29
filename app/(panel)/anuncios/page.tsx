"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  objetivosAd, publicoSugeridoAd, presupuestoAd, sugerirTextoAd, listarAnuncios, crearAnuncio,
  publicarAnuncioMeta, subirMediaPost,
  type ObjetivoAd, type PublicoAd, type RecomPresupuesto, type Anuncio,
  bolsaAnuncios, type BolsaAnuncios,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";
import { HeroSeccion, CabeceraFormulario, AnuncioIlustracion } from "@/components/panel/HeroSeccion";

type Estado = "cargando" | "ok" | "error";

const ESTADO_AD: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: "Borrador", clase: "bg-arena text-frio" },
  en_revision: { texto: "En revisión de Meta", clase: "bg-tibio-suave text-tibio" },
  activo: { texto: "Activo", clase: "bg-ok/12 text-ok" },
  pausado: { texto: "Pausado", clase: "bg-tibio-suave text-tibio" },
  finalizado: { texto: "Finalizado", clase: "bg-arena text-frio" },
  rechazado: { texto: "Rechazado", clase: "bg-calor-suave text-calor-hondo" },
};

// Zonas seleccionables (sin texto libre → sin typos tipo "takna"). Cuando se
// conecte Meta, esto evoluciona al buscador de geolocalización real de Meta
// (Targeting Search API), que valida ciudades/regiones exactas.
const ZONAS = [
  "Todo Perú",
  "Amazonas", "Áncash", "Apurímac", "Arequipa", "Ayacucho", "Cajamarca",
  "Callao", "Cusco", "Huancavelica", "Huánuco", "Ica", "Junín", "La Libertad",
  "Lambayeque", "Lima", "Loreto", "Madre de Dios", "Moquegua", "Pasco",
  "Piura", "Puno", "San Martín", "Tacna", "Tumbes", "Ucayali",
];

// Creador de anuncios guiado (Fase 3B): wizard en pasos que pregunta qué querés
// conseguir y arma el ad con las mejores configuraciones. La publicación real
// espera la conexión de Meta; hoy se simula.
/**
 * `embebido`: esta pantalla se monta DENTRO de /marketing, que ya puso el
 * título y la barra de negocios. Sin esto, se verían dos veces.
 */
export default function AnunciosPanel({ embebido = false }: { embebido?: boolean } = {}) {
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
  const [mediaUrl, setMediaUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [publico, setPublico] = useState<PublicoAd | null>(null);
  const [zona, setZona] = useState("Todo Perú");
  const [edadMin, setEdadMin] = useState("18");
  const [edadMax, setEdadMax] = useState("55");
  const [total, setTotal] = useState("100");
  const [dias, setDias] = useState("7");
  const [recom, setRecom] = useState<RecomPresupuesto | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [publicando, setPublicando] = useState(false);
  // ENCENDERLO ES SUYO (2026-08-27, Jonathan: "¿no hay forma que lo creemos no
  // en pausa?"). Meta sí lo permite; el default queda apagado porque el gasto
  // va a SU tarjeta y un presupuesto mal puesto le cuesta plata antes de verlo.
  const [encender, setEncender] = useState(false);
  const [publicandoId, setPublicandoId] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [msg, setMsg] = useState("");
  // La bolsa publicitaria (2026-08-23): el presupuesto de cada anuncio se
  // debita de acá — bono mensual del plan + lo recargado con nosotros.
  const [bolsa, setBolsa] = useState<BolsaAnuncios | null>(null);

  // Modo global: el wizard entero trabaja sobre el negocio enfocado en la
  // barra (todas las llamadas viajan con su tenant explícito).
  const g = useSeccionGlobal();

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const [a, o, b] = await Promise.all([
        listarAnuncios(g.tenantLista), objetivosAd(g.tenantLista), bolsaAnuncios(g.tenantLista),
      ]);
      setAnuncios(a);
      setObjetivos(o);
      setBolsa(b);
      setEstado("ok");
    } catch { setEstado("error"); }
  }, [g.tenantLista]);

  useEffect(() => { if (listo && g.listaLista) cargar(); }, [listo, g.listaLista, cargar]);

  // Al entrar al paso de público, carga el sugerido por rubro. La edad sugerida
  // precarga los campos, pero el usuario la puede ajustar libremente.
  useEffect(() => {
    if (paso === 2 && !publico) {
      publicoSugeridoAd(g.tenantLista).then((p) => {
        setPublico(p);
        if (p) { setEdadMin(String(p.edadMin)); setEdadMax(String(p.edadMax)); }
      });
    }
  }, [paso, publico, g.tenantLista]);

  // Al entrar al paso de presupuesto (o cambiar total/días), recalcula.
  useEffect(() => {
    if (paso !== 3) return;
    const t = Number(total), d = Number(dias);
    if (t > 0 && d > 0) {
      const id = setTimeout(() => { presupuestoAd(t, d, g.tenantLista).then(setRecom); }, 300);
      return () => clearTimeout(id);
    }
  }, [paso, total, dias, g.tenantLista]);

  async function sugerirTexto() {
    if (!campania.trim() || sugiriendo) return;
    setSugiriendo(true);
    const t = await sugerirTextoAd(campania.trim(), g.tenantLista);
    setSugiriendo(false);
    if (t) setTexto(t);
  }

  // La imagen es OBLIGATORIA: Meta rechaza la pieza sin ella ("specify the
  // media"). Reusa la subida de /publicaciones/media (Supabase público).
  async function elegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await subirMediaPost(String(reader.result), g.tenantLista);
      setSubiendo(false);
      if (r.ok && r.url) setMediaUrl(r.url);
      else setMsg(r.error ?? "No se pudo subir la imagen.");
    };
    reader.readAsDataURL(file);
  }

  async function publicar() {
    if (publicando) return;
    setPublicando(true);
    setMsg("");
    const r = await crearAnuncio({
      objetivo,
      campaniaNombre: campania.trim(),
      texto: texto.trim(),
      mediaUrl: mediaUrl || undefined,
      // Se envía la edad EDITADA por el usuario (no la sugerida): estos valores
      // van después directo al AdSet de Meta (age_min/age_max, geo_locations).
      publico: {
        zona,
        edadMin: Number(edadMin),
        edadMax: Number(edadMax),
        intereses: publico?.intereses ?? [],
      },
      presupuestoTotal: Number(total),
      dias: Number(dias),
    }, g.tenantLista);
    if (!r.ok || !r.id) {
      setPublicando(false);
      setMsg(r.error ?? "No se pudo crear el anuncio.");
      return;
    }
    // Publicación REAL: crea la campaña en Meta (en pausa). Si la cuenta aún no
    // está configurada, el anuncio queda como borrador re-publicable.
    const p = await publicarAnuncioMeta(r.id, g.tenantLista, encender);
    setPublicando(false);
    // Reset del wizard (el anuncio ya existe; el resultado se avisa arriba)
    setCreando(false); setPaso(0); setCampania(""); setTexto(""); setMediaUrl(""); setPublico(null); setZona("Todo Perú"); setTotal("100"); setDias("7"); setRecom(null); setEncender(false);
    setAviso(p.ok
      ? `✅ ${p.aviso ?? (encender
          ? "Anuncio publicado y ENCENDIDO en Meta: ya empezó a mostrarse."
          : "Anuncio publicado en Meta. Quedó PAUSADO: enciéndelo desde tu Ads Manager.")}`
      : `⚠️ El anuncio quedó como borrador. ${p.error ?? ""}`);
    cargar();
  }

  async function publicarExistente(id: string) {
    if (publicandoId) return;
    setPublicandoId(id);
    const p = await publicarAnuncioMeta(id, g.tenantLista);
    setPublicandoId(null);
    setAviso(p.ok
      ? `✅ ${p.aviso ?? "Anuncio publicado en Meta. Quedó PAUSADO: enciéndelo desde tu Ads Manager."}`
      : `⚠️ ${p.error ?? "No se pudo publicar el anuncio."}`);
    cargar();
  }

  if (!listo) return null;

  const objSel = objetivos.find((o) => o.id === objetivo);
  const edadValida = Number(edadMin) >= 18 && Number(edadMax) <= 65 && Number(edadMin) <= Number(edadMax);
  const puedeAvanzar =
    (paso === 0) ||
    (paso === 1 && campania.trim() && texto.trim() && mediaUrl) ||
    (paso === 2 && edadValida) ||
    (paso === 3 && Number(total) > 0 && Number(dias) > 0);

  return (
    <div className={embebido ? "space-y-6" : "mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8"}>
      {/* EL HERO (2026-08-27, Jonathan: "lo mismo haz para campañas y
          anuncios"). Antes abría con un título y una línea gris: alguien que
          nunca pautó no sabe qué gana ni en qué se diferencia de Campañas. */}
      {embebido && (
        <HeroSeccion
          titulo="Que te conozca gente que nunca te compró"
          bajada={<>Pagas para que tu carta aparezca en Instagram y Facebook frente a personas de tu zona que todavía no te conocen.</>}
          nota="La IA arma el anuncio contigo. Tú decides cuánto gastar."
          dibujo={<AnuncioIlustracion />}
        />
      )}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!embebido && (
            <>
              <p className="eyebrow">Tu embudo</p>
              <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Anuncios</h1>
              <p className="mt-1 text-[0.92rem] text-frio">
                Crea anuncios en Instagram y Facebook con la ayuda de la IA. Te guía paso a paso.
              </p>
            </>
          )}
          {/* LA BOLSA PUBLICITARIA (2026-08-23): la plata de los anuncios pasa
              por LeadAI — el plan regala un bono cada mes y lo demás se
              recarga con nosotros. Al publicar, el presupuesto sale de aquí. */}
          {bolsa && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1 rounded-tarjeta bg-carta px-3.5 py-2 text-[0.84rem] text-tinta-2 ring-1 ring-linea">
              💰 Tu bolsa publicitaria: <b className="text-tinta">S/{(bolsa.disponiblesCentavos / 100).toFixed(2)}</b>
              {/* El desglose del bono solo si EXISTE un bono (hoy los planes
                  van sin bono: los anuncios se pagan aparte, por recarga). */}
              {(bolsa.bonoCentavos > 0 || bolsa.bonoPlanCentavos > 0) && (
                <> (S/{(bolsa.bonoCentavos / 100).toFixed(2)} del bono del mes + S/{(bolsa.saldoCentavos / 100).toFixed(2)} recargados)</>
              )}
              {/* Sin el punto suelto del inicio (2026-08-24): cuando no hay
                  bono que desglosar, la frase anterior termina y esta abría
                  con un "." huérfano. */}
              <span>El presupuesto de cada anuncio sale de aquí — se paga por recarga con LeadAI.</span>
            </p>
          )}
        </div>
        {!creando && (
          <button
            onClick={() => setCreando(true)}
            className="rounded-chip bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
          >
            + Crear anuncio
          </button>
        )}
      </header>

      {!embebido && g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        📣 Tus anuncios se crean de verdad en tu cuenta publicitaria de Meta.{" "}
        <b>El gasto va a tu propio medio de pago</b>, no a LeadAI. Por defecto quedan
        en pausa y los enciendes tú.
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-tarjeta bg-ok/8 px-4 py-3 text-[0.86rem] text-tinta-2 ring-1 ring-ok/25">
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} className="shrink-0 text-frio hover:text-tinta">✕</button>
        </div>
      )}

      {/* Wizard de creación */}
      {creando && (
        <div className="space-y-4 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          {/* El wizard ya tenía barra de pasos, pero arrancaba en frío: sin
              decir qué se está por hacer ni que se puede salir. */}
          <CabeceraFormulario
            icono={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z" />
                <path d="M15 8a5 5 0 010 8" />
                <path d="M18.5 5a9 9 0 010 14" />
              </svg>
            }
            titulo="Vamos a armar tu anuncio"
            bajada="Cuatro pasos: qué quieres lograr, qué mostrar, a quién y cuánto gastar. Puedes volver atrás en cualquiera."
            onCerrar={() => setCreando(false)}
          />
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
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Qué quieres conseguir?</h2>
              <p className="mt-0.5 text-[0.82rem] text-frio">Elige tu meta y armamos el anuncio para eso.</p>
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
                  <button onClick={sugerirTexto} disabled={sugiriendo || !campania.trim()} className="text-[0.8rem] font-semibold text-brasa-texto disabled:opacity-40">
                    {sugiriendo ? "Pensando…" : "✨ Escribir con IA"}
                  </button>
                </div>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  placeholder="Pon el nombre de la campaña y toca 'Escribir con IA', o escríbelo tú…"
                  className="mt-1 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Tip: la primera frase es la que engancha. Usá algo que frene el scroll.</p>
              </div>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Imagen del anuncio</label>
                {mediaUrl ? (
                  <div className="mt-1 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl} alt="Imagen del anuncio" className="h-20 rounded-tarjeta object-cover ring-1 ring-linea" />
                    <button onClick={() => setMediaUrl("")} className="text-[0.8rem] font-semibold text-calor-hondo">Quitar</button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center rounded-tarjeta border-2 border-dashed border-linea bg-arena/40 px-3 py-5 text-[0.86rem] text-frio transition hover:border-brasa/40">
                    {subiendo ? "Subiendo…" : "📷 Subir imagen (obligatoria — Meta la exige)"}
                    <input type="file" accept="image/*" onChange={elegirImagen} className="hidden" disabled={subiendo} />
                  </label>
                )}
              </div>
              {msg && <p className="text-[0.84rem] font-semibold text-calor-hondo">{msg}</p>}
            </div>
          )}

          {/* Paso 2 — Público */}
          {paso === 2 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿A quién le mostramos el anuncio?</h2>
              <p className="text-[0.82rem] text-frio">
                Te sugerimos un público según tu rubro — ajustalo como quieras. Con un público
                amplio Meta suele rendir mejor (su sistema encuentra a los interesados solo).
              </p>
              {publico && (
                <div className="rounded-tarjeta bg-arena/50 p-3.5">
                  <p className="text-[0.85rem] font-semibold text-tinta">Sugerido para tu rubro: {publico.nota}</p>
                  {publico.intereses.length > 0 && (
                    <p className="mt-1 text-[0.82rem] text-tinta-2">Intereses: {publico.intereses.join(", ")}</p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Zona</label>
                  <select
                    value={zona}
                    onChange={(e) => setZona(e.target.value)}
                    className="mt-1 block w-52 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                  >
                    {ZONAS.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                  <p className="mt-1 text-[0.72rem] text-frio">Al conectar Meta vas a poder afinar por ciudad exacta.</p>
                </div>
                <div>
                  <label className="text-[0.85rem] font-bold text-tinta">Edad</label>
                  <div className="mt-1 flex items-center gap-1.5">
                    <input
                      type="number" min={18} max={65} value={edadMin}
                      onChange={(e) => setEdadMin(e.target.value)}
                      className="w-20 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                    />
                    <span className="text-frio">a</span>
                    <input
                      type="number" min={18} max={65} value={edadMax}
                      onChange={(e) => setEdadMax(e.target.value)}
                      className="w-20 rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                    />
                    <span className="text-[0.82rem] text-frio">años</span>
                  </div>
                  {Number(edadMin) > Number(edadMax) && (
                    <p className="mt-1 text-[0.74rem] font-semibold text-calor-hondo">La edad mínima no puede superar la máxima.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Paso 3 — Presupuesto */}
          {paso === 3 && (
            <div className="space-y-3">
              <h2 className="text-[1.05rem] font-bold text-tinta">¿Cuánto quieres invertir?</h2>
              <p className="text-[0.82rem] text-frio">
                Así funciona: tú pones el monto total y Meta lo reparte en los días que elijas
                (ese es el gasto por día). Lo que varía es el <b>resultado</b> — cuánta gente ve tu
                anuncio y cuántos te escriben depende de tu público, la competencia y qué tan bueno
                sea el anuncio. Por eso la estimación es un rango, no una promesa.
              </p>
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
              <h2 className="text-[1.05rem] font-bold text-tinta">Revisa antes de publicar</h2>
              <div className="space-y-1.5 rounded-tarjeta bg-arena/50 p-4 text-[0.86rem] text-tinta-2">
                <p><b className="text-tinta">Objetivo:</b> {objSel?.pregunta}</p>
                <p><b className="text-tinta">Campaña:</b> {campania}</p>
                <p><b className="text-tinta">Texto:</b> “{texto}”</p>
                {mediaUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={mediaUrl} alt="Imagen del anuncio" className="h-24 rounded-tarjeta object-cover ring-1 ring-linea" />
                )}
                <p><b className="text-tinta">Público:</b> {zona} · {edadMin}–{edadMax} años</p>
                <p className="text-brasa-hondo"><b>Vas a gastar hasta S/{total} en {dias} días</b> (S/{(Number(total) / Number(dias) || 0).toFixed(2)}/día).</p>
              </div>
              {/* EL CHECK, APAGADO POR DEFECTO. Encenderlo empieza a gastar
                  de su tarjeta, así que tiene que ser un acto deliberado — no
                  algo que pase por no leer. */}
              <label className="flex cursor-pointer items-start gap-2.5 rounded-tarjeta bg-arena/50 p-3.5">
                <input
                  type="checkbox"
                  checked={encender}
                  onChange={(e) => setEncender(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brasa)]"
                />
                <span className="min-w-0">
                  <span className="block text-[0.88rem] font-bold text-tinta">
                    Encenderlo apenas se cree
                  </span>
                  <span className="mt-0.5 block text-[0.8rem] text-frio">
                    {encender
                      ? `Empieza a mostrarse y a gastar de tu medio de pago hoy mismo, hasta S/${total} en ${dias} días.`
                      : "Si lo dejas sin marcar, se crea en pausa y no gasta nada hasta que lo enciendas en tu Ads Manager."}
                  </span>
                </span>
              </label>
              <p className="text-[0.78rem] text-frio">
                ⏳ Cuando el anuncio esté activo, los primeros 3-7 días
                &ldquo;aprende&rdquo; — no lo pauses ni edites en ese tiempo
                para que rinda mejor.
              </p>
              {msg && <p className="text-[0.84rem] font-semibold text-calor-hondo">{msg}</p>}
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
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={publicar}
                disabled={publicando}
                className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
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
              <p className="mt-1 text-[0.88rem] text-frio">Toca "Crear anuncio" y te guiamos paso a paso.</p>
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
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <p className="text-[0.76rem] text-frio">
                        S/{a.presupuestoTotal} · {a.dias} días · S/{(a.presupuestoTotal / a.dias || 0).toFixed(0)}/día
                      </p>
                      {/* Sin imagen no hay botón: Meta rechaza la pieza sin media. */}
                      {a.estado === "borrador" && a.mediaUrl && (
                        <button
                          onClick={() => publicarExistente(a.id)}
                          disabled={publicandoId !== null}
                          className="rounded-chip bg-brasa px-3.5 py-1.5 text-[0.78rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
                        >
                          {publicandoId === a.id ? "Publicando…" : "Publicar en Meta"}
                        </button>
                      )}
                    </div>
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
