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
 * "Todo lo que podamos hacer para ayudarle a configurar todo desde nuestra
 * herramienta es un plus, porque los usuarios muchas veces desconocen cómo
 * ganar presencia digital... no saben nada de esto".
 *
 * ESO CAMBIA EL DISEÑO. La primera versión era un formulario: tres campos
 * esperando que el dueño supiera qué pegar en cada uno. "Está en tu
 * Administrador de eventos de Meta" no le sirve a alguien que no sabe que eso
 * existe.
 *
 * Ahora es un DIAGNÓSTICO. El panel ya sabe qué tiene el negocio —dirección,
 * redes, carta web, píxeles— así que le dice qué le falta, por qué le importa
 * en plata, y le da el camino o lo hace por él. Los campos técnicos quedan
 * plegados: el que sabe los encuentra, el que no, no tropieza con ellos.
 *
 * El ORDEN es el de una pollería que recién empieza, no el de un manual:
 * primero que lo encuentren, después que hablen bien de él, y recién al final
 * medir — que solo importa si ya está pagando anuncios.
 */

/** Un paso del diagnóstico: qué es, si ya está, y qué hacer si no. */
interface Paso {
  id: string;
  titulo: string;
  /** Por qué le importa, en plata o clientes. Nunca en jerga. */
  porQue: string;
  listo: boolean;
  /** Qué mostrar cuando falta. */
  cuerpo: React.ReactNode;
}

export function PresenciaEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  // Los campos se guardan al SALIR, no por tecla: un id a medio escribir
  // guardado es un píxel que no mide y un dueño que cree que sí.
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState("");
  const [ga, setGa] = useState("");
  const [pidiendo, setPidiendo] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

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
      // Se revierten los campos también: si el backend rechazó el id, dejarlo
      // escrito en pantalla le hace creer que quedó guardado.
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

  const enGoogle = (cfg.googleReviewUrl ?? "").trim().length > 0;
  const yaPidio = Boolean(cfg.googleFichaPedidaEn);
  const conRedes = Boolean(cfg.instagramUrl?.trim() || cfg.facebookUrl?.trim());
  const conCarta = Boolean(cfg.slug?.trim());
  const midiendo = Boolean((cfg.metaPixelId ?? "").trim() || (cfg.googleAnalyticsId ?? "").trim());

  const pasos: Paso[] = [
    {
      id: "google",
      titulo: "Que te encuentren en Google",
      porQue:
        "La mayoría busca “pollería cerca de mí” antes de pedir. Si no estás en Google Maps, esa gente llega al de al lado.",
      listo: enGoogle,
      cuerpo: yaPidio ? (
        <p className="rounded-tarjeta bg-ok-suave px-4 py-3 text-[0.86rem] font-semibold text-ok">
          Recibimos tu pedido ✓ Nos comunicamos contigo para crear tu ficha.
        </p>
      ) : (
        <>
          <p className="text-[0.86rem] text-frio">
            Es gratis. Si ya tienes tu negocio en Maps, pega el link abajo. Si
            no, lo creamos nosotros con tus datos.
          </p>
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
          <label className="mt-4 block">
            <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
              Ya tengo mi negocio en Maps
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                const v = url.trim();
                if (v !== (cfg.googleReviewUrl ?? "")) void aplicar({ googleReviewUrl: v });
              }}
              inputMode="url"
              placeholder="Pega aquí el link de tu negocio"
              className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
            />
            <span className="mt-1.5 block text-[0.8rem] text-frio">
              Búscalo en Google Maps desde tu celular, tócalo, elige{" "}
              <strong className="text-tinta">Compartir</strong> y copia el
              enlace.
            </span>
          </label>
        </>
      ),
    },
    {
      id: "resenas",
      titulo: "Juntar reseñas sin pedirlas tú",
      porQue:
        "Un negocio con 30 reseñas de 5 estrellas aparece antes en Google y convence más rápido que cualquier anuncio.",
      // Depende del mismo link: sin Google no hay a dónde mandar a nadie.
      listo: enGoogle,
      cuerpo: (
        <p className="text-[0.86rem] text-frio">
          Cuando conectes Google, tu bot le pide la reseña a cada cliente
          contento —los que califican 4 o 5— apenas recibe su pedido. A los que
          califican bajo no los manda: te avisa a ti para que lo arregles antes
          de que quede público.
        </p>
      ),
    },
    {
      id: "carta",
      titulo: "Tener un link para compartir",
      porQue:
        "Es lo que pegas en tu Instagram, en tu estado de WhatsApp o en un anuncio. Sin él no tienes a dónde mandar a la gente.",
      listo: conCarta,
      cuerpo: (
        <p className="text-[0.86rem] text-frio">
          Tu carta web ya existe. Ponle un nombre corto en{" "}
          <strong className="text-tinta">Carta → Compartir</strong> y queda
          lista para pegar donde quieras.
        </p>
      ),
    },
    {
      id: "redes",
      titulo: "Poner tus redes en la carta",
      porQue:
        "El que ve tu carta y te sigue, vuelve solo. Es el cliente más barato que vas a conseguir.",
      listo: conRedes,
      cuerpo: (
        <p className="text-[0.86rem] text-frio">
          Agrega tu Instagram o Facebook en{" "}
          <strong className="text-tinta">Carta → Tu marca</strong> y aparecen
          como botones al final de tu carta.
        </p>
      ),
    },
    {
      id: "medir",
      titulo: "Medir tus anuncios",
      porQue:
        "Solo si ya pagas publicidad en Facebook, Instagram o Google. Te dice cuántos de los que entraron terminaron pidiendo, en vez de pagar por clics a ciegas.",
      listo: midiendo,
      cuerpo: (
        <>
          <p className="text-[0.86rem] text-frio">
            Si todavía no haces anuncios, sáltate esto: no te falta nada.
          </p>
          {/* PLEGADO A PROPÓSITO: son los dos campos más técnicos de la
              pantalla, y el dueño que no pauta no tiene por qué tropezar con
              ellos. El que sí pauta sabe qué está buscando. */}
          <details className="mt-3">
            <summary className="cursor-pointer text-[0.85rem] font-semibold text-brasa-texto">
              Ya hago anuncios y quiero medirlos
            </summary>
            <label className="mt-3 block">
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
                Solo el número. Está en Meta Business → Administrador de
                eventos. Si no sabes cuál es, escríbenos y lo vemos contigo.
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
              Se cargan solo en tu carta web, y solo si los llenas. Medimos
              cuando alguien te hace un pedido.
            </p>
          </details>
        </>
      ),
    },
  ];

  const hechos = pasos.filter((p) => p.listo).length;
  // El primero que falta: es en el que conviene que se enfoque hoy.
  const pendiente = pasos.find((p) => !p.listo);

  return (
    <div className="space-y-4">
      {/* EL RESUMEN. Un dueño que no sabe de esto necesita saber DÓNDE ESTÁ
          antes que qué hacer: "2 de 5" convierte un tema abstracto en algo
          que se puede terminar. */}
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">Tu presencia en internet</h2>
          <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.75rem] font-bold text-tinta-2 tabular-nums">
            {hechos} de {pasos.length}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-arena">
          <div
            className="h-2 rounded-full bg-brasa transition-[width] duration-500"
            style={{ width: `${(hechos / pasos.length) * 100}%` }}
          />
        </div>
        <p className="mt-3 text-[0.88rem] text-frio">
          {pendiente
            ? <>Lo siguiente: <strong className="text-tinta">{pendiente.titulo.toLowerCase()}</strong>.</>
            : "Está todo listo. Tu negocio se puede encontrar, te dejan reseñas y estás midiendo."}
        </p>
      </div>

      {pasos.map((p) => {
        const desplegado = abierto === p.id || (abierto === null && p.id === pendiente?.id);
        return (
          <div key={p.id} className="rounded-tarjeta bg-carta ring-1 ring-linea">
            <button
              type="button"
              onClick={() => setAbierto(desplegado ? "" : p.id)}
              aria-expanded={desplegado}
              className="flex w-full items-start gap-3 p-5 text-left"
            >
              <span
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.8rem] font-bold ${
                  p.listo ? "bg-ok-suave text-ok" : "bg-arena text-frio"
                }`}
                aria-hidden
              >
                {p.listo ? "✓" : ""}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.98rem] font-bold text-tinta">{p.titulo}</span>
                <span className="mt-1 block text-[0.85rem] text-frio">{p.porQue}</span>
              </span>
            </button>
            {desplegado && <div className="px-5 pb-5 pl-14">{p.cuerpo}</div>}
          </div>
        );
      })}

      <div className="min-h-[1.2rem] text-[0.84rem]">
        {error && <span className="fila-entra font-semibold text-alerta">{error}</span>}
        {!error && guardado && <span className="confirma font-semibold text-ok">Guardado ✓</span>}
      </div>

      {/* LA SALIDA PARA EL QUE SE PIERDE. Es la promesa de Jonathan —"todo lo
          que podamos hacer para ayudarle"— hecha explícita: si nada de esto se
          entiende, hay una persona del otro lado. */}
      <p className="rounded-tarjeta bg-arena/50 px-4 py-3 text-[0.85rem] text-tinta-2">
        ¿No sabes por dónde empezar? Escríbenos y lo configuramos contigo. No
        hace falta que sepas de esto para que te funcione.
      </p>
    </div>
  );
}

export default PresenciaEditor;
