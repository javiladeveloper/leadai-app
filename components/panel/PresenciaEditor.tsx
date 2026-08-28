"use client";

import { useEffect, useState } from "react";
import { obtenerHorario, guardarHorario, type ConfigHorario } from "@/lib/horario";

/**
 * TU NEGOCIO EN GOOGLE (2026-08-27, pedido de Jonathan).
 *
 * "Deberíamos tener una sección que podamos ayudar a conectar o crear su
 * identidad en Google Maps, pixel... todo esto dentro de marketing".
 *
 * Empieza por Google Maps porque desbloquea algo que ya está a medias: el bot
 * pide la estrella al entregar, y con este link puede mandar a los contentos
 * a dejar la reseña. Sin él, la pregunta se queda sin destino.
 *
 * EL LINK SOLO VA A QUIEN CALIFICÓ 4 o 5. Se explica acá, en la pantalla del
 * dueño, porque es la diferencia entre "junto reseñas" y "mando a todos a
 * Google": lo segundo le llena la ficha de estrellas malas, y eso no se
 * borra.
 */
export function PresenciaEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    let vivo = true;
    void obtenerHorario().then((r) => {
      if (!vivo) return;
      setCfg(r);
      setUrl(r?.googleReviewUrl ?? "");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  async function guardar(googleReviewUrl: string) {
    if (!cfg) return;
    const previo = cfg;
    setCfg({ ...cfg, googleReviewUrl });
    setError("");
    const r = await guardarHorario({ googleReviewUrl });
    if (!r.ok) {
      // Se revierte: un campo que quedó donde el backend no lo aceptó le hace
      // creer al dueño que su link está guardado cuando no lo está.
      setCfg(previo);
      setUrl(previo.googleReviewUrl ?? "");
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!cfg) return null;

  const conectado = (cfg.googleReviewUrl ?? "").trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">Reseñas en Google</h2>
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
              if (v !== (cfg.googleReviewUrl ?? "")) void guardar(v);
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
              Toca <strong className="text-tinta">Compartir</strong> y copia el
              enlace que te da.
            </li>
            <li>Pégalo aquí arriba.</li>
          </ol>
          <p className="mt-2 text-[0.82rem] text-frio">
            Si tu negocio todavía no aparece en Google Maps, escríbenos y te
            ayudamos a crearlo — es gratis y es de donde llega la mayoría de
            los clientes que te buscan por zona.
          </p>
        </details>

        <div className="mt-3 min-h-[1.2rem] text-[0.84rem]">
          {error && <span className="fila-entra font-semibold text-alerta">{error}</span>}
          {!error && guardado && <span className="confirma font-semibold text-ok">Guardado ✓</span>}
        </div>
      </div>

      {/* PIXEL: TODAVÍA NO SE PROMETE (2026-08-27).
          Jonathan lo pidió junto con Maps, pero es de otro tamaño: hay que
          instrumentar la carta web pública, decidir qué eventos se disparan y
          manejar consentimiento. Se anuncia en vez de dejar un campo que no
          hace nada — un input que se guarda y no mide es peor que no tenerlo,
          porque el dueño cree que ya está midiendo. */}
      <div className="rounded-tarjeta bg-arena/50 p-5 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">Píxel de Meta</h2>
          <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-frio">
            En camino
          </span>
        </div>
        <p className="mt-2 text-[0.88rem] text-frio">
          Para medir cuánta gente ve tu carta y cuántos terminan comprando,
          desde tus propios anuncios de Facebook e Instagram.
        </p>
        <p className="mt-1.5 text-[0.84rem] text-frio">
          Si ya corres anuncios por tu cuenta y lo necesitas, escríbenos: eso
          nos ayuda a priorizarlo.
        </p>
      </div>
    </div>
  );
}

export default PresenciaEditor;
