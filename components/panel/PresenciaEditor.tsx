"use client";

import { useEffect, useState } from "react";
import {
  obtenerHorario,
  guardarHorario,
  pedirFichaGoogle,
  type ConfigHorario,
} from "@/lib/horario";
import { guardarNegocio } from "@/lib/carta";
import { HeroSeccion } from "@/components/panel/HeroSeccion";

/**
 * TU NEGOCIO EN INTERNET (2026-08-27, pedido de Jonathan).
 *
 * "Los usuarios muchas veces desconocen cómo ganar presencia digital... no
 * saben nada de esto".
 *
 * DOS INTENTOS FALLIDOS ANTES DE ESTE, y los dos fallaron por lo mismo —
 * asumir que el dueño ya sabe por qué le conviene:
 *
 * 1. Un formulario de tres campos: "pega tu píxel de Meta". Al que no sabe
 *    qué es un píxel no le dice nada.
 * 2. Una lista de hitos que mandaba a otra pantalla a hacer cada cosa.
 *    Jonathan: "¿son solo hitos a cumplir? no entiendo nada, qué porquería de
 *    diseño es este".
 *
 * La referencia que él mismo pasó (OlaClick) hace tres cosas que faltaban:
 * VENDE el beneficio antes de pedir nada, resuelve todo en la misma pantalla,
 * y explica cada paso con capturas en vez de una línea de texto.
 *
 * Eso es lo que hay acá: primero por qué le conviene, después el campo, y las
 * instrucciones dibujadas al lado — nunca "andá a otra sección".
 */
export function PresenciaEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Se guardan al SALIR del campo, no por tecla: un enlace a medio pegar
  // guardado es un link roto que el bot le manda a sus clientes.
  const [url, setUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [ig, setIg] = useState("");
  const [fb, setFb] = useState("");
  const [meta, setMeta] = useState("");
  const [ga, setGa] = useState("");

  useEffect(() => {
    let vivo = true;
    void obtenerHorario().then((r) => {
      if (!vivo) return;
      setCfg(r);
      setUrl(r?.googleReviewUrl ?? "");
      setSlug(r?.slug ?? "");
      setIg(r?.instagramUrl ?? "");
      setFb(r?.facebookUrl ?? "");
      setMeta(r?.metaPixelId ?? "");
      setGa(r?.googleAnalyticsId ?? "");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  function avisarOk() {
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  /** Lo que vive en la config del negocio (Google, píxeles). */
  async function aplicar(cambios: Partial<ConfigHorario>) {
    if (!cfg) return;
    const previo = cfg;
    setCfg({ ...cfg, ...cambios });
    setError("");
    const r = await guardarHorario(cambios);
    if (!r.ok) {
      // Se revierte el campo también: si el backend lo rechazó, dejarlo
      // escrito en pantalla le hace creer que quedó guardado.
      setCfg(previo);
      setUrl(previo.googleReviewUrl ?? "");
      setMeta(previo.metaPixelId ?? "");
      setGa(previo.googleAnalyticsId ?? "");
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    avisarOk();
  }

  /** Lo que vive en la carta (link corto, redes). Misma pantalla, otra ruta. */
  async function aplicarCarta(cambios: Parameters<typeof guardarNegocio>[0]) {
    if (!cfg) return;
    const previo = cfg;
    setError("");
    const r = await guardarNegocio(cambios);
    if (!r.ok) {
      setSlug(previo.slug ?? "");
      setIg(previo.instagramUrl ?? "");
      setFb(previo.facebookUrl ?? "");
      // El slug puede estar TOMADO por otro negocio: el mensaje del backend
      // dice cuál es el problema, y perderlo lo deja sin saber por qué falló.
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    setCfg({
      ...previo,
      ...(cambios.slug !== undefined ? { slug: cambios.slug } : {}),
      ...(cambios.instagramUrl !== undefined ? { instagramUrl: cambios.instagramUrl } : {}),
      ...(cambios.facebookUrl !== undefined ? { facebookUrl: cambios.facebookUrl } : {}),
    });
    avisarOk();
  }

  async function pedirAyuda() {
    setPidiendo(true);
    setError("");
    const r = await pedirFichaGoogle();
    setPidiendo(false);
    if (!r.ok) { setError(r.error ?? "No se pudo enviar"); return; }
    setCfg((c) => (c ? { ...c, googleFichaPedidaEn: new Date().toISOString() } : c));
  }

  if (cargando) return <div className="h-64 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!cfg) return null;

  const enGoogle = (cfg.googleReviewUrl ?? "").trim().length > 0;
  const yaPidio = Boolean(cfg.googleFichaPedidaEn);
  const conRedes = Boolean(cfg.instagramUrl?.trim() || cfg.facebookUrl?.trim());
  const conCarta = Boolean(cfg.slug?.trim());
  const midiendo = Boolean((cfg.metaPixelId ?? "").trim() || (cfg.googleAnalyticsId ?? "").trim());
  const linkCarta = cfg.slug?.trim() ? `app.leadai-pe.com/c/${cfg.slug.trim()}` : "";

  return (
    <div className="space-y-5">
      {/* El hero, con el mismo componente que Anuncios, Campañas y Publicar:
          las cuatro secciones de Marketing tienen que verse hermanas, y cuatro
          copias del mismo bloque divergen a la primera edición. */}
      <HeroSeccion
        titulo="Haz que te encuentren en Google y gana clientes de tu zona"
        bajada={<>Cuando alguien busca <em>&ldquo;pollería cerca de mí&rdquo;</em>, ¿aparece tu negocio? Si estás en Google Maps y tienes buenas reseñas, sí.</>}
        nota="Aquí lo configuras todo, sin salir de esta página."
        dibujo={<FichaGoogleIlustracion />}
      />

      {/* ── 1. GOOGLE ── */}
      <Bloque
        n={1}
        titulo="Tu negocio en Google Maps"
        porQue="Es de donde llega la gente que busca por zona. Si no estás, esos clientes van al de al lado."
        listo={enGoogle}
      >
        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Pega el link de tu negocio
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const v = url.trim();
              if (v !== (cfg.googleReviewUrl ?? "")) void aplicar({ googleReviewUrl: v });
            }}
            inputMode="url"
            placeholder="https://maps.app.goo.gl/..."
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        <Pasos
          titulo="Cómo consigo ese link"
          pasos={[
            <>Abre <strong className="text-tinta">Google Maps</strong> en tu celular y busca tu negocio.</>,
            <>Tócalo y elige el botón <strong className="text-tinta">Compartir</strong>.</>,
            <>Toca <strong className="text-tinta">Copiar vínculo</strong> y pégalo aquí arriba.</>,
          ]}
          dibujo={<CompartirMapsIlustracion />}
        />

        {enGoogle && (
          <p className="mt-4 rounded-tarjeta bg-brasa-suave px-4 py-3 text-[0.85rem] text-ok">
            <strong>Listo.</strong> A cada cliente que califique tu pedido con 4
            o 5 estrellas, el bot le pide la reseña con este link. A los que
            califican bajo no los manda: te avisa a ti para que lo arregles
            antes de que sea público.
          </p>
        )}

        {!enGoogle && (
          <div className="mt-4 rounded-tarjeta bg-arena/60 p-4">
            {yaPidio ? (
              <p className="text-[0.86rem] font-semibold text-ok">
                Recibimos tu pedido ✓ Te contactamos para crear tu ficha.
              </p>
            ) : (
              <>
                <p className="text-[0.86rem] font-semibold text-tinta">
                  ¿Tu negocio todavía no está en Google?
                </p>
                <p className="mt-1 text-[0.84rem] text-frio">
                  Es gratis y la creamos nosotros con tus datos. Tú solo
                  confirmas cuando Google te llame o te mande la postal.
                </p>
                <button
                  type="button"
                  onClick={() => void pedirAyuda()}
                  disabled={pidiendo}
                  className="mt-3 rounded-tarjeta bg-brasa px-4 py-2.5 text-[0.85rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-60"
                >
                  {pidiendo ? "Enviando…" : "Créenla por mí"}
                </button>
              </>
            )}
          </div>
        )}
      </Bloque>

      {/* ── 2. EL LINK DE SU CARTA ── */}
      <Bloque
        n={2}
        titulo="Tu link para compartir"
        porQue="Es lo que pegas en tu Instagram, en tu estado de WhatsApp o en un anuncio. Sin él no tienes a dónde mandar a la gente."
        listo={conCarta}
      >
        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Elige tu nombre corto
          </span>
          <div className="mt-1.5 flex items-center gap-0.5 rounded-lg border border-linea bg-arena/40 px-3">
            <span className="shrink-0 text-[0.88rem] text-frio">leadai-pe.com/c/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              onBlur={() => {
                const v = slug.trim().toLowerCase();
                if (v && v !== (cfg.slug ?? "")) void aplicarCarta({ slug: v });
              }}
              placeholder="tunegocio"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-tinta outline-none placeholder:text-frio"
            />
          </div>
        </label>

        {linkCarta && (
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(`https://${linkCarta}`).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 1500);
              });
            }}
            className="mt-3 w-full rounded-tarjeta bg-arena px-4 py-2.5 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-linea"
          >
            {copiado ? "¡Copiado! ✓" : `Copiar ${linkCarta}`}
          </button>
        )}
      </Bloque>

      {/* ── 3. REDES ── */}
      <Bloque
        n={3}
        titulo="Tus redes en la carta"
        porQue="El que ve tu carta y te sigue, vuelve solo. Es el cliente más barato que vas a conseguir."
        listo={conRedes}
      >
        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Instagram
          </span>
          <input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            onBlur={() => {
              const v = ig.trim();
              if (v !== (cfg.instagramUrl ?? "")) void aplicarCarta({ instagramUrl: v || null });
            }}
            placeholder="https://instagram.com/tunegocio"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Facebook
          </span>
          <input
            value={fb}
            onChange={(e) => setFb(e.target.value)}
            onBlur={() => {
              const v = fb.trim();
              if (v !== (cfg.facebookUrl ?? "")) void aplicarCarta({ facebookUrl: v || null });
            }}
            placeholder="https://facebook.com/tunegocio"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>
        <p className="mt-2 text-[0.8rem] text-frio">
          Con una sola alcanza. Aparecen como botones al final de tu carta.
        </p>
      </Bloque>

      {/* ── 4. MEDIR ── */}
      <Bloque
        n={4}
        titulo="Medir tus anuncios"
        porQue="Solo si ya pagas publicidad en Facebook, Instagram o Google. Te dice cuántos de los que entraron terminaron pidiendo, en vez de pagar por clics a ciegas."
        listo={midiendo}
        opcional
      >
        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Píxel de Meta (Facebook e Instagram)
          </span>
          <input
            value={meta}
            onChange={(e) => setMeta(e.target.value)}
            onBlur={() => {
              const v = meta.trim();
              if (v !== (cfg.metaPixelId ?? "")) void aplicar({ metaPixelId: v });
            }}
            inputMode="numeric"
            placeholder="1179156252599904"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
          />
        </label>

        <Pasos
          titulo="Dónde encuentro mi píxel"
          pasos={[
            <>Entra al <strong className="text-tinta">Administrador de eventos</strong> de tu cuenta de Facebook.</>,
            <>Elige tu píxel en la lista de la izquierda.</>,
            <>Copia el <strong className="text-tinta">identificador</strong>: son solo números.</>,
          ]}
          dibujo={<PixelIlustracion />}
        />

        <label className="mt-5 block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Google Analytics
          </span>
          <input
            value={ga}
            onChange={(e) => setGa(e.target.value)}
            onBlur={() => {
              const v = ga.trim();
              if (v !== (cfg.googleAnalyticsId ?? "")) void aplicar({ googleAnalyticsId: v });
            }}
            placeholder="G-ABC1234"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
          <span className="mt-1 block text-[0.8rem] text-frio">
            En Google Analytics, en Administrar → Flujos de datos. Empieza con
            &ldquo;G-&rdquo;.
          </span>
        </label>
      </Bloque>

      <div className="min-h-[1.2rem] text-[0.84rem]">
        {error && <span className="fila-entra font-semibold text-alerta">{error}</span>}
        {!error && guardado && <span className="confirma font-semibold text-ok">Guardado ✓</span>}
      </div>

      {/* La promesa de Jonathan, explícita: si nada de esto se entiende, hay
          una persona del otro lado. */}
      <p className="rounded-tarjeta bg-arena/50 px-4 py-3 text-[0.85rem] text-tinta-2">
        ¿No sabes por dónde empezar? Escríbenos y lo configuramos contigo. No
        hace falta que sepas de esto para que te funcione.
      </p>
    </div>
  );
}

/** Una tarjeta numerada, SIEMPRE abierta y con su campo adentro. */
function Bloque({
  n, titulo, porQue, listo, opcional, children,
}: {
  n: number;
  titulo: string;
  porQue: string;
  listo: boolean;
  opcional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea sm:p-6">
      <div className="flex items-start gap-3.5">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.9rem] font-bold ${
            listo ? "bg-brasa-suave text-ok" : "bg-brasa/12 text-brasa-texto"
          }`}
          aria-hidden
        >
          {listo ? "✓" : n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.02rem] font-bold text-tinta">
            {titulo}
            {opcional && (
              <span className="ml-2 rounded-chip bg-arena px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-frio">
                Opcional
              </span>
            )}
          </h3>
          <p className="mt-1 text-[0.88rem] text-frio">{porQue}</p>
        </div>
      </div>
      <div className="mt-4 sm:pl-[2.9rem]">{children}</div>
    </div>
  );
}

/**
 * Instrucciones con dibujo al lado.
 *
 * La referencia de OlaClick explica cada paso CON UNA CAPTURA de dónde
 * mirar. Una línea de texto ("está en tu Administrador de eventos") no le
 * alcanza a quien nunca entró ahí.
 */
function Pasos({
  titulo, pasos, dibujo,
}: {
  titulo: string;
  pasos: React.ReactNode[];
  dibujo: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-tarjeta bg-arena/50 p-4">
      <p className="text-[0.82rem] font-bold uppercase tracking-wide text-frio">{titulo}</p>
      <div className="mt-2.5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <ol className="min-w-0 flex-1 space-y-2">
          {pasos.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-[0.86rem] text-tinta-2">
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-carta text-[0.72rem] font-bold text-frio ring-1 ring-linea"
                aria-hidden
              >
                {i + 1}
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        <div className="shrink-0 self-center">{dibujo}</div>
      </div>
    </div>
  );
}

/* ── LAS ILUSTRACIONES ──
   En SVG y no imágenes: pesan casi nada, se ven nítidas en cualquier pantalla
   y toman los colores del tema. Son esquemáticas a propósito — muestran DÓNDE
   mirar, no una captura real que quedaría vieja al primer rediseño de Meta. */

/** Un teléfono con la ficha del negocio en Google: el resultado que se busca. */
function FichaGoogleIlustracion() {
  return (
    <svg viewBox="0 0 150 130" className="h-32 w-auto shrink-0 self-center" aria-hidden>
      <rect x="34" y="6" width="82" height="118" rx="11" fill="#fff" opacity=".95" />
      <rect x="41" y="15" width="68" height="11" rx="5.5" fill="#e8eaed" />
      <rect x="41" y="31" width="32" height="24" rx="3" fill="#c4a882" />
      <rect x="77" y="31" width="32" height="24" rx="3" fill="#9c7b56" />
      <rect x="41" y="60" width="46" height="5" rx="2.5" fill="#3c4043" />
      <g fill="#fbbc04">
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={43 + i * 8} cy={72} r="2.6" />
        ))}
      </g>
      <rect x="41" y="82" width="68" height="1" fill="#e8eaed" />
      <g fill="#1a73e8">
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={49 + i * 17} cy={93} r="6.5" />
        ))}
      </g>
      <rect x="41" y="105" width="68" height="13" rx="6.5" fill="none" stroke="#1a73e8" strokeWidth="2" />
      <text x="75" y="114" textAnchor="middle" fill="#1a73e8" fontSize="7.5" fontWeight="700">
        Pedir ahora
      </text>
      <circle cx="122" cy="26" r="13" fill="#fff" />
      <path d="M122 18l4.6 9.3-4.6-2.2-4.6 2.2z" fill="#ea4335" />
      <circle cx="122" cy="26" r="3.1" fill="#fff" />
    </svg>
  );
}

/** El botón "Compartir" de Google Maps: dónde tocar. */
function CompartirMapsIlustracion() {
  return (
    <svg viewBox="0 0 120 74" className="h-[74px] w-auto" aria-hidden>
      <rect x="1" y="1" width="118" height="72" rx="8" fill="#fff" stroke="#e8eaed" />
      <rect x="10" y="11" width="44" height="5" rx="2.5" fill="#3c4043" />
      <g fill="#fbbc04">
        {[0, 1, 2, 3, 4].map((i) => (
          <circle key={i} cx={12 + i * 7} cy={25} r="2.2" />
        ))}
      </g>
      {["Cómo\nllegar", "Guardar", "Compartir"].map((t, i) => (
        <g key={t}>
          <circle
            cx={24 + i * 34}
            cy={48}
            r="12"
            fill={i === 2 ? "#1a73e8" : "#f1f3f4"}
          />
          <text
            x={24 + i * 34}
            y={51}
            textAnchor="middle"
            fontSize="6"
            fontWeight="700"
            fill={i === 2 ? "#fff" : "#5f6368"}
          >
            {i === 2 ? "↗" : i === 1 ? "★" : "→"}
          </text>
          <text x={24 + i * 34} y={68} textAnchor="middle" fontSize="5.5" fill="#5f6368">
            {t.split("\n")[0]}
          </text>
        </g>
      ))}
      {/* El anillo marca cuál es: el que hay que tocar. */}
      <circle cx="92" cy="48" r="16" fill="none" stroke="#1a73e8" strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

/** El identificador del píxel en el Administrador de eventos, resaltado. */
function PixelIlustracion() {
  return (
    <svg viewBox="0 0 150 74" className="h-[74px] w-auto" aria-hidden>
      <rect x="1" y="1" width="148" height="72" rx="8" fill="#fff" stroke="#e8eaed" />
      <rect x="9" y="10" width="52" height="5" rx="2.5" fill="#3c4043" />
      <rect x="9" y="22" width="132" height="1" fill="#e8eaed" />
      <rect x="9" y="31" width="16" height="16" rx="3" fill="#e7f0fe" />
      <rect x="12" y="35" width="10" height="8" rx="1.5" fill="#1877f2" />
      <rect x="31" y="32" width="26" height="4.5" rx="2.25" fill="#3c4043" />
      <rect x="31" y="41" width="30" height="4" rx="2" fill="#9aa0a6" />
      {/* El número resaltado, como lo deja Meta cuando lo seleccionas. */}
      <rect x="66" y="38" width="72" height="12" rx="2" fill="#1877f2" opacity=".18" />
      <text x="70" y="47" fontSize="7.5" fontWeight="700" fill="#1877f2" fontFamily="monospace">
        1179156252599904
      </text>
      <rect x="66" y="56" width="34" height="11" rx="3" fill="#f1f3f4" />
      <text x="83" y="64" textAnchor="middle" fontSize="6" fontWeight="700" fill="#5f6368">
        Copiar
      </text>
    </svg>
  );
}

export default PresenciaEditor;
