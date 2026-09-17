"use client";

import { useEffect, useRef, useState } from "react";
import {
  revisarPublico, crearPublico, listarPublicos,
  type RevisionPublico, type PublicoSubido,
} from "@/lib/api";

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
export function PublicosMeta({ tenant }: { tenant?: string } = {}) {
  const [telefonos, setTelefonos] = useState<string[]>([]);
  const [archivo, setArchivo] = useState("");
  const [nombre, setNombre] = useState("");
  const [conSimilar, setConSimilar] = useState(true);
  const [revision, setRevision] = useState<RevisionPublico | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [historial, setHistorial] = useState<PublicoSubido[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listarPublicos(tenant).then(setHistorial);
  }, [tenant]);

  async function cargar(f: File) {
    const texto = await f.text();
    setArchivo(f.name);
    setResultado(null);
    // Se toma cualquier cosa que parezca un teléfono, en cualquier columna: un
    // CSV exportado de otra herramienta rara vez tiene la columna donde uno
    // espera, y pedirle al dueño que la acomode es pedirle que edite un CSV.
    const crudos = texto
      .split(/\r?\n/)
      .flatMap((l) => l.split(/[,;\t]/))
      .map((c) => c.replace(/^"|"$/g, "").trim())
      .filter((c) => /\d{6,}/.test(c.replace(/\D/g, "")));
    setTelefonos(crudos);
    if (!nombre) setNombre(f.name.replace(/\.[^.]+$/, ""));
    setRevision(crudos.length > 0 ? await revisarPublico(crudos, tenant) : null);
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
