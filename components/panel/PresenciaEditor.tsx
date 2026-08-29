"use client";

import { useEffect, useState } from "react";
import {
  obtenerHorario,
  guardarHorario,
  pedirFichaGoogle,
  type ConfigHorario,
} from "@/lib/horario";

/**
 * TU NEGOCIO EN INTERNET (2026-08-27, pedido de Jonathan).
 *
 * "Deberíamos tener una sección que podamos ayudar a conectar o crear su
 * identidad en Google Maps, pixel... todo esto dentro de marketing"; "todo lo
 * que pueda hacer para mejorar su presencia deberíamos poder ayudarlo".
 *
 * Tres cosas, en el orden en que le sirven a un negocio nuevo:
 *
 * 1. ESTAR en Google Maps. Si no está, no lo encuentra quien busca "pollería
 *    cerca". Es lo primero y es gratis.
 * 2. JUNTAR reseñas. El bot ya pregunta al entregar; con el link, manda a los
 *    contentos a dejarla.
 * 3. MEDIR. Recién cuando pauta: sin anuncios, un píxel no le dice nada.
 */
export function PresenciaEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  // Campos de texto: se guardan al SALIR, no por tecla. Un id a medio escribir
  // guardado es un píxel que no mide y un dueño que cree que sí.
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState("");
  const [ga, setGa] = useState("");
  const [pidiendo, setPidiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    void obtenerHorario().then((r) => {
      if (!vivo) return;
      setCfg(r);
      setUrl(r?.googleReviewUrl ?? "");
      setMeta(r?.metaPixelId ?? "");
      setGa(r?.googleAnalyticsId ?? "");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  async function aplicar(cambios: Partial<ConfigHorario>) {
    if (!cfg) return;
    const previo = cfg;
    setCfg({ ...cfg, ...cambios });
    setError("");
    const r = await guardarHorario(cambios);
    if (!r.ok) {
      // Se revierte Y se restauran los campos: si el backend rechazó el id,
      // dejarlo escrito en pantalla le hace creer que quedó guardado.
      setCfg(previo);
      setUrl(previo.googleReviewUrl ?? "");
      setMeta(previo.metaPixelId ?? "");
      setGa(previo.googleAnalyticsId ?? "");
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  async function pedirAyuda() {
    setPidiendo(true);
    setError("");
    const r = await pedirFichaGoogle();
    setPidiendo(false);
    if (!r.ok) { setError(r.error ?? "No se pudo enviar"); return; }
    setCfg((c) => (c ? { ...c, googleFichaPedidaEn: new Date().toISOString() } : c));
  }

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!cfg) return null;

  const conectado = (cfg.googleReviewUrl ?? "").trim().length > 0;
  const yaPidio = Boolean(cfg.googleFichaPedidaEn);
  const midiendo = (cfg.metaPixelId ?? "").trim() || (cfg.googleAnalyticsId ?? "").trim();

  return (
    <div className="space-y-5">
      {/* ── 1. GOOGLE MAPS ── */}
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">Tu negocio en Google Maps</h2>
          <span
            className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
              conectado ? "bg-ok-suave text-ok" : "bg-arena text-frio"
            }`}
          >
            {conectado ? "Conectado" : "Sin conectar"}
          </span>
        </div>

        <p className="mt-2 text-[0.88rem] text-frio">
          Cuando entregas un pedido, el bot pregunta qué tal estuvo. A quien
          responde <strong className="text-tinta">4 o 5 estrellas</strong> le
          pasa este link para que deje su reseña.
        </p>
        <p className="mt-1.5 text-[0.84rem] text-frio">
          A quien califica bajo no se le manda: en vez de eso te avisamos a ti,
          para que puedas resolverlo por chat antes de que quede público.
        </p>

        <label className="mt-4 block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Link para dejar reseña
          </span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              const v = url.trim();
              if (v !== (cfg.googleReviewUrl ?? "")) void aplicar({ googleReviewUrl: v });
            }}
            inputMode="url"
            placeholder="https://g.page/r/..."
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        {/* CÓMO SE SACA. Sin esto, "pega tu link de Google" es una instrucción
            que el dueño no sabe cumplir: no está a la vista en Maps. */}
        <details className="mt-3">
          <summary className="cursor-pointer text-[0.85rem] font-semibold text-brasa-texto">
            ¿De dónde saco ese link?
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[0.85rem] text-frio">
            <li>Busca tu negocio en Google Maps desde tu celular.</li>
            <li>
              Tócalo y elige <strong className="text-tinta">Compartir</strong>.
            </li>
            <li>Copia el enlace y pégalo aquí arriba.</li>
          </ol>
        </details>
      </div>

      {/* ── 2. NO TIENE FICHA: SE LA CREAMOS ──
          La API de Google Business Profile no está abierta, así que esto NO se
          puede automatizar hoy. Se ofrece hacerlo a mano en vez de dejar al
          dueño con un "consíguelo tú": es el trabajo que sí podemos hacer por
          él, y es lo que Jonathan pidió. */}
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h2 className="text-[1.05rem] font-bold text-tinta">
          ¿Tu negocio todavía no aparece en Google?
        </h2>
        <p className="mt-2 text-[0.88rem] text-frio">
          Estar en Maps es gratis y es de donde llega la mayoría de la gente que
          busca por zona: <em>&ldquo;pollería cerca de mí&rdquo;</em>. Si no
          estás, no te encuentran.
        </p>

        {yaPidio ? (
          <p className="mt-3 rounded-tarjeta bg-ok-suave px-4 py-3 text-[0.86rem] font-semibold text-ok">
            Recibimos tu pedido ✓ Nos comunicamos contigo para crearla con tus
            datos.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void pedirAyuda()}
                disabled={pidiendo}
                className="rounded-tarjeta bg-brasa px-4 py-2.5 text-[0.85rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-60"
              >
                {pidiendo ? "Enviando…" : "Créenla por mí"}
              </button>
              <a
                href="https://business.google.com/create"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-tarjeta bg-arena px-4 py-2.5 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-linea"
              >
                Prefiero hacerlo yo
              </a>
            </div>
            <p className="mt-2 text-[0.82rem] text-frio">
              Si la creas tú, ten a mano tu dirección exacta, tu horario y tu
              teléfono. Google manda una postal o una llamada para verificar que
              el local existe.
            </p>
          </>
        )}
      </div>

      {/* ── 3. MEDIR: LOS PÍXELES ── */}
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">Medir tus anuncios</h2>
          <span
            className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
              midiendo ? "bg-ok-suave text-ok" : "bg-arena text-frio"
            }`}
          >
            {midiendo ? "Midiendo" : "Sin medir"}
          </span>
        </div>

        <p className="mt-2 text-[0.88rem] text-frio">
          Si haces anuncios en Facebook, Instagram o Google, esto te dice
          cuántos de los que entraron a tu carta terminaron pidiendo. Sin ellos
          pagas por clics sin saber cuáles se volvieron ventas.
        </p>

        <label className="mt-4 block">
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
            placeholder="1234567890123"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
          />
          <span className="mt-1 block text-[0.8rem] text-frio">
            Solo el número, sin el código. Está en tu Administrador de eventos
            de Meta.
          </span>
        </label>

        <label className="mt-4 block">
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
        </label>

        <p className="mt-3 text-[0.82rem] text-frio">
          Se cargan solo en tu carta web, y solo si los llenas. Medimos cuando
          alguien te hace un pedido.
        </p>
      </div>

      <div className="min-h-[1.2rem] text-[0.84rem]">
        {error && <span className="fila-entra font-semibold text-alerta">{error}</span>}
        {!error && guardado && <span className="confirma font-semibold text-ok">Guardado ✓</span>}
      </div>
    </div>
  );
}

export default PresenciaEditor;
