"use client";

import { useEffect, useRef, useState } from "react";
import {
  revisarPublico, crearPublico, listarPublicos, publicosEnMeta, borrarPublico, crearRetargeting,
  type RevisionPublico, type PublicoSubido, type PublicoEnMeta,
} from "@/lib/api";
import { extraerTelefonos } from "@/lib/publicos";

/**
 * TUS PROPIOS CONTACTOS COMO PÚBLICO DE META (2026-09-17, pedido de Jonathan:
 * "yo tengo un banco de datos de números de clínicas en 4 o 5 ciudades, ¿eso
 * puede servir?").
 *
 * Sirve para dos cosas distintas y las dos valen:
 *
 *  · mostrarle el anuncio EXACTAMENTE a esa gente, en vez de pagarle a Meta
 *    para que adivine a quién;
 *  · pedirle a Meta que busque cuentas PARECIDAS a esa lista. Ahí está el
 *    volumen: la lista tiene cientos, el similar tiene cientos de miles.
 *
 * DOS PASOS, A PROPÓSITO. Primero se revisa —cuántos quedaron, cuántos se
 * descartaron— y recién después se sube. Son datos de contacto de terceros y
 * de Meta un público no se puede "desmandar": el único momento para darse
 * cuenta de que el archivo estaba mal es ANTES.
 *
 * EL ARCHIVO NO SALE DEL NAVEGADOR. Se lee acá, se extraen los teléfonos y
 * viajan al backend solo cuando se aprieta el botón. No se guarda ninguna
 * copia: lo que queda registrado es el recuento, no la lista.
 */
/**
 * El archivo como texto, venga como venga. Excel guarda "Texto Unicode" en
 * UTF-16: leído como UTF-8 cada dígito queda separado por un byte nulo y
 * ningún número se reconoce — el caso silencioso más probable de "subí el CSV
 * y no pasó nada". Se detecta por el BOM o por la cantidad de nulos.
 */
async function leerTexto(f: File): Promise<string> {
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes.length >= 2) {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  }
  const muestra = bytes.subarray(0, Math.min(bytes.length, 4096));
  let nulos = 0;
  for (const b of muestra) if (b === 0) nulos++;
  if (nulos > muestra.length / 8) {
    return new TextDecoder(muestra[0] === 0 ? "utf-16be" : "utf-16le").decode(bytes);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

export function PublicosMeta({ tenant }: { tenant?: string } = {}) {
  const [telefonos, setTelefonos] = useState<string[]>([]);
  const [archivo, setArchivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [conSimilar, setConSimilar] = useState(true);
  const [revision, setRevision] = useState<RevisionPublico | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  // Mientras el backend cuenta los teléfonos: sin esto, entre elegir el archivo
  // y ver el número no pasaba nada visible (2026-09-22).
  const [revisando, setRevisando] = useState(false);
  const [historial, setHistorial] = useState<PublicoSubido[]>([]);
  // Lo que Meta ya tiene: cuanta gente matcheo y si se puede usar. Es otra cosa
  // que el historial -aquel dice que se mando, este que paso despues.
  const [enMeta, setEnMeta] = useState<PublicoEnMeta[]>([]);
  const [refresco, setRefresco] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listarPublicos(tenant).then(setHistorial);
    void publicosEnMeta(tenant).then(setEnMeta);
  }, [tenant, refresco]);

  /**
   * CADA CAMINO TERMINA EN UN MENSAJE (2026-09-22, Jonathan: "subí el csv con
   * contactos, pero cómo suben a Meta no entiendo").
   *
   * Subió el archivo, vio su nombre en el recuadro y nada más. El botón de
   * "Crear el público en Meta" solo aparece DESPUÉS de la revisión, y la
   * revisión fallaba en silencio: si el archivo no traía nada que pareciera
   * un teléfono, o si el backend contestaba con error (sin plan, sin cuenta,
   * red), `cargar` tiraba y nadie lo mostraba. Ahora cada rama dice qué pasó
   * y qué hacer.
   */
  async function cargar(f: File) {
    setArchivo(f.name);
    setResultado(null);
    setRevision(null);
    setTelefonos([]);
    setRevisando(true);
    try {
      const crudos = extraerTelefonos(await leerTexto(f));
      setTelefonos(crudos);
      if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, ""));
      if (crudos.length === 0) {
        setResultado({
          ok: false,
          texto: "No encontré teléfonos en ese archivo. Tiene que ser un CSV o TXT con una columna de números (ej. 987654321 o +51 987 654 321), un contacto por fila.",
        });
        return;
      }
      // Solo viajan los teléfonos únicos, ya como dígitos (ver lib/publicos.ts):
      // el archivo de Google Places traía coordenadas, ids y direcciones y el
      // POST pesaba varios megas — el backend lo cortaba y el navegador veía
      // "no pudimos conectar" (2026-09-22).
      setRevision(await revisarPublico(crudos, tenant));
    } catch (e) {
      setResultado({
        ok: false,
        texto: `No pude revisar el archivo: ${e instanceof Error ? e.message : "error desconocido"}`,
      });
    } finally {
      setRevisando(false);
    }
  }

  async function subir() {
    if (!revision?.alcanza || !nombre.trim()) return;
    setSubiendo(true);
    setResultado(null);
    try {
      const r = await crearPublico(
        { nombre: nombre.trim(), telefonos, origen: archivo, conSimilar },
        tenant,
      );
      setResultado({ ok: r.ok, texto: r.mensaje });
      if (r.ok) {
        // Se limpia la lista apenas Meta la acepta: no hay razón para tenerla
        // en memoria del navegador después de haberla mandado.
        setTelefonos([]);
        setRevision(null);
        setArchivo("");
        if (input.current) input.current.value = "";
        setHistorial(await listarPublicos(tenant));
        setEnMeta(await publicosEnMeta(tenant));
      }
    } catch (e) {
      setResultado({ ok: false, texto: e instanceof Error ? e.message : "No se pudo subir" });
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus contactos como público</h3>
        <p className="mt-1 text-[0.85rem] text-frio">
          Si tenés una lista de teléfonos, Meta puede mostrarle el anuncio justo a
          esa gente — o buscar personas parecidas, que suele ser donde está el
          volumen. Subí el archivo y te digo cuántos sirven antes de mandar nada.
        </p>

        <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-tarjeta border border-dashed border-linea bg-arena/40 px-4 py-6 text-[0.86rem] font-semibold text-tinta-2 transition hover:bg-arena">
          <input
            ref={input}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void cargar(f); }}
          />
          {archivo || "Elegí un archivo CSV con los teléfonos"}
        </label>
        {/* Qué va a pasar después: sin esto, el archivo cargado parecía el
            final del camino (2026-09-22). */}
        {!revision && !revisando && !resultado && (
          <p className="mt-2 text-center text-[0.76rem] text-frio">
            Primero te muestro cuántos contactos sirven; recién ahí aparece el botón para crear el público en Meta.
          </p>
        )}
        {revisando && (
          <p className="mt-3 rounded-lg bg-arena/50 px-4 py-3 text-[0.85rem] text-tinta-2">
            Revisando los teléfonos del archivo…
          </p>
        )}

        {revision && <Revision r={revision} />}

        {revision?.alcanza && (
          <div className="mt-4 space-y-3 border-t border-linea pt-4">
            <div>
              <label className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">
                Cómo se va a llamar en Meta
              </label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={80}
                placeholder="Clínicas Lima"
                className="mt-1 w-full rounded-lg bg-arena px-3 py-2 text-[0.88rem] text-tinta ring-1 ring-linea outline-none focus:ring-brasa"
              />
            </div>

            <label className="flex items-start gap-2 text-[0.85rem] text-tinta-2">
              <input
                type="checkbox"
                checked={conSimilar}
                onChange={(e) => setConSimilar(e.target.checked)}
                disabled={!revision.alcanzaParaSimilar}
                className="mt-0.5 accent-brasa disabled:opacity-40"
              />
              <span className={revision.alcanzaParaSimilar ? "" : "opacity-50"}>
                Buscar también gente parecida
                <span className="block text-[0.78rem] text-frio">
                  {revision.alcanzaParaSimilar
                    ? "Meta arma un público nuevo con cuentas similares a las de tu lista. Es donde suele estar el alcance."
                    : `Hace falta ${revision.minimoSimilar} contactos para esto y tenés ${revision.contactos}.`}
                </span>
              </span>
            </label>

            {/* NADA SE MANDA HASTA ACÁ. El botón es el consentimiento: son
                datos de terceros y de Meta un público no se desmanda. */}
            <button
              type="button"
              onClick={() => void subir()}
              disabled={subiendo || !nombre.trim()}
              className="w-full rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
            >
              {subiendo ? "Subiendo…" : `Crear el público en Meta con ${revision.contactos} contactos`}
            </button>
            <p className="text-center text-[0.76rem] text-frio">
              Los teléfonos viajan cifrados y no se guardan. Queda registrado qué
              subiste y cuándo.
            </p>
          </div>
        )}

        {resultado && (
          <p
            className={`mt-3 rounded-lg px-3 py-2 text-[0.84rem] ${
              resultado.ok ? "bg-ok/12 text-ok" : "bg-tibio-suave text-tibio"
            }`}
          >
            {resultado.texto}
          </p>
        )}
      </div>

      {/* RETARGETING (2026-09-18): volver a mostrarle el anuncio a quien ya te
          visitó. Va después de "subir contactos" y antes de "los de Meta"
          porque es la otra forma de armar un público — con el pixel, sin subir
          nada. El público que crea aparece solo en la lista de abajo. */}
      <Retargeting tenant={tenant} alCrear={() => setRefresco((n) => n + 1)} />

      {/* Los de Meta van ANTES del historial: son los que se pueden usar hoy;
          el historial es el registro de lo que se mando. */}
      {enMeta.length > 0 && (
        <EnMeta filas={enMeta} alBorrar={() => setRefresco((n) => n + 1)} />
      )}

      {historial.length > 0 && <Historial filas={historial} />}
    </div>
  );
}

/**
 * Lo que quedó del archivo, antes de mandar nada.
 *
 * Los DESCARTADOS se muestran aunque sean pocos: un archivo donde se cae la
 * mitad casi siempre tiene la columna equivocada, y ese número es la única
 * pista de que algo salió mal.
 */
/**
 * VOLVER A IMPACTAR A QUIEN YA TE VISITÓ (2026-09-18).
 *
 * El dueño solo elige "cuánto tiempo atrás" y aprieta un botón. Nada de jerga
 * de Meta (pixel WEBSITE, retention_days): "los que entraron en los últimos 30
 * días" se entiende sin explicar. El pixel ya está puesto en Presencia; si
 * falta, el backend lo dice claro.
 */
const VENTANAS = [
  { dias: 7, etiqueta: "última semana" },
  { dias: 14, etiqueta: "últimas 2 semanas" },
  { dias: 30, etiqueta: "último mes" },
  { dias: 90, etiqueta: "últimos 3 meses" },
];

function Retargeting({ tenant, alCrear }: { tenant?: string; alCrear: () => void }) {
  const [dias, setDias] = useState(30);
  const [creando, setCreando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function crear() {
    setCreando(true);
    setMsg(null);
    const r = await crearRetargeting({ dias }, tenant);
    setCreando(false);
    if (r.ok) {
      setMsg({ ok: true, texto: "¡Listo! El público aparece abajo. Ya puedes usarlo al crear un anuncio." });
      alCrear();
    } else {
      setMsg({ ok: false, texto: r.error ?? "No se pudo crear el público." });
    }
  }

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <h3 className="text-[1.05rem] font-bold text-tinta">Volver a mostrarle tu anuncio a quien ya te visitó</h3>
      <p className="mt-1 text-[0.85rem] text-frio">
        Mucha gente entra a tu página y no escribe la primera vez. Con esto le
        muestras tu anuncio de nuevo — ya te conoce, solo le faltó el empujón. Es
        de lo más rentable: no pagas por gente nueva.
      </p>

      <label className="mt-4 block text-[0.78rem] font-bold uppercase tracking-wide text-frio">
        ¿A quién? Los que entraron en…
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {VENTANAS.map((v) => (
          <button
            key={v.dias}
            type="button"
            onClick={() => setDias(v.dias)}
            className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
              dias === v.dias ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
            }`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[0.76rem] text-frio">
        Menos tiempo = gente más caliente pero público más chico. Un mes suele ser buen equilibrio.
      </p>

      <button
        type="button"
        onClick={() => void crear()}
        disabled={creando}
        className="mt-4 w-full rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
      >
        {creando ? "Creando…" : "Crear este público"}
      </button>

      {msg && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-[0.84rem] ${msg.ok ? "bg-ok/12 text-ok" : "bg-tibio-suave text-tibio"}`}>
          {msg.texto}
        </p>
      )}
    </div>
  );
}

function Revision({ r }: { r: RevisionPublico }) {
  return (
    <div className="mt-4 rounded-lg bg-arena/50 px-4 py-3">
      <p className="text-[0.95rem] font-bold text-tinta">
        {r.contactos.toLocaleString("es-PE")} contactos sirven
      </p>
      {r.descartados > 0 && (
        <p className="mt-0.5 text-[0.8rem] text-frio">
          Se descartaron {r.descartados.toLocaleString("es-PE")}: repetidos o sin
          un número que se pueda usar.
        </p>
      )}
      {!r.alcanza && (
        <p className="mt-2 text-[0.82rem] font-semibold text-tibio">
          Meta pide al menos {r.minimo} y este archivo llega a {r.contactos}.
        </p>
      )}
    </div>
  );
}

/**
 * LOS PÚBLICOS TAL COMO LOS VE META (2026-09-18, pedido de Jonathan: "podemos
 * ver el csv que subimos y luego bajarlo para ya no tener que llegar a esas
 * personas").
 *
 * Es DISTINTO del historial de abajo: aquel dice qué se mandó, este dice qué
 * pasó después. Subir 708 contactos y que Meta encuentre 300 es lo normal —no
 * todos tienen ese teléfono registrado en su cuenta— pero sin ese segundo
 * número parece que se perdieron.
 */
function EnMeta({ filas, alBorrar }: { filas: PublicoEnMeta[]; alBorrar: () => void }) {
  const [borrando, setBorrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);

  async function borrar(id: string) {
    setBorrando(id);
    setConfirmar(null);
    try {
      await borrarPublico(id);
      alBorrar();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <h3 className="text-[1.05rem] font-bold text-tinta">Tus públicos en Meta</h3>
      <p className="mt-1 text-[0.85rem] text-frio">
        Estos ya se pueden usar para segmentar un anuncio. Meta siempre
        encuentra a menos gente de la que subiste: no todos tienen ese número
        registrado en su cuenta.
      </p>

      <div className="mt-5 space-y-2">
        {filas.map((f) => (
          <div key={f.id} className="rounded-lg bg-arena/40 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-[0.88rem] font-semibold text-tinta">{f.nombre}</span>
                {f.tipo === "LOOKALIKE" && (
                  <span className="rounded-chip bg-brasa/12 px-1.5 py-0.5 text-[0.7rem] font-bold text-brasa">
                    similares
                  </span>
                )}
                {f.tipo === "WEBSITE" && (
                  <span className="rounded-chip bg-brasa/12 px-1.5 py-0.5 text-[0.7rem] font-bold text-brasa">
                    visitaron tu web
                  </span>
                )}
              </span>
              <span
                className={`rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${
                  f.listo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
                }`}
              >
                {f.listo ? "listo para usar" : f.estado}
              </span>
            </div>

            <p className="mt-1.5 text-[0.84rem] text-tinta-2">
              {f.personas !== null ? (
                <>
                  Meta encontró a <strong className="text-tinta">
                    {f.personas.toLocaleString("es-PE")} personas
                  </strong>
                </>
              ) : (
                // Nunca "0 personas": mientras procesa, Meta no informa el
                // tamaño, y un cero se leería como que no matcheó a nadie.
                <span className="text-frio">Meta todavía lo está procesando (tarda unas horas)</span>
              )}
            </p>

            {/* BORRAR PIDE CONFIRMACIÓN. Meta desactiva los anuncios que usaban
                ese público: no rompe nada, pero dejan de mostrarse, y eso no se
                puede deshacer sin volver a subir la lista. */}
            <div className="mt-2">
              {confirmar === f.id ? (
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[0.78rem] text-tibio">
                    Los anuncios que lo usen dejarán de mostrarse.
                  </span>
                  <button
                    type="button"
                    disabled={borrando === f.id}
                    onClick={() => void borrar(f.id)}
                    className="rounded-chip bg-tibio px-2.5 py-1 text-[0.76rem] font-bold text-carta transition hover:opacity-90 disabled:opacity-50"
                  >
                    {borrando === f.id ? "Sacando…" : "Sí, sacarlo"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmar(null)}
                    className="text-[0.76rem] font-semibold text-frio hover:text-tinta"
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmar(f.id)}
                  className="text-[0.78rem] font-semibold text-frio transition hover:text-tibio"
                >
                  Sacar de Meta
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Qué se subió y cuándo. Es la trazabilidad, y por eso no se puede borrar. */
function Historial({ filas }: { filas: PublicoSubido[] }) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <h3 className="text-[1.05rem] font-bold text-tinta">Lo que ya subiste</h3>
      <div className="mt-3 space-y-1.5">
        {filas.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-lg bg-arena/40 px-3 py-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[0.86rem] font-semibold text-tinta">
                {f.nombre}
                {f.tipo === "similar" && (
                  <span className="ml-2 rounded-chip bg-brasa/12 px-1.5 py-0.5 text-[0.7rem] font-bold text-brasa">
                    similares
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-[0.76rem] text-frio">
                {f.contactos.toLocaleString("es-PE")} contactos ·{" "}
                {new Date(f.creadoEn).toLocaleDateString("es-PE", {
                  day: "numeric", month: "short", year: "numeric",
                })}
                {f.origen && ` · ${f.origen}`}
              </span>
            </div>
            {f.estado !== "ok" && (
              <span className="shrink-0 rounded-chip bg-tibio-suave px-2 py-0.5 text-[0.72rem] font-bold text-tibio">
                falló
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
