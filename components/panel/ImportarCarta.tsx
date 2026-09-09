"use client";

import { useRef, useState } from "react";
import { leerFotoOPdf, leerExcel, importarCarta, descargarPlantilla } from "@/lib/carta";
import { resumenImportacion, esArchivoDeCarta, ACEPTA_CARTA } from "@/lib/importar-carta";

/**
 * SUBIR LA CARTA DESDE LA SECCIÓN CARTA (2026-09-09).
 *
 * Jonathan: "en carta puede haber una sección extraer de pdf carta?". Existía
 * solo en el onboarding: quien se saltó ese paso —o cambió su carta y quiere
 * volver a subirla— tenía que cargar plato por plato.
 *
 * REIMPORTAR ES SEGURO y por eso el botón puede vivir junto a una carta ya
 * cargada: el backend va en modo "agregar" y saltea por nombre lo que ya
 * existe, así que los precios y las fotos que el dueño ajustó a mano no se
 * tocan. El resumen se lo dice con todas las letras.
 *
 * [alTerminar] recarga la carta de la pantalla: sin eso el dueño sube su PDF,
 * le decimos "12 platos nuevos" y la lista sigue vacía — el mismo silencio
 * que ya mordió en la conexión de WhatsApp.
 */
export function ImportarCarta({
  variante = "boton",
  alTerminar,
}: {
  /** "vacio": tarjeta grande, el camino principal cuando no hay platos. */
  variante?: "boton" | "vacio";
  alTerminar: () => Promise<void> | void;
}) {
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function alElegir(archivo: File) {
    setError("");
    setListo("");

    // Se filtra ANTES de subir: la visión es lo más caro del producto y un
    // .docx solo devolvería una lista vacía tras hacerlo esperar.
    if (!esArchivoDeCarta(archivo.name)) {
      setError("Ese formato no lo podemos leer. Sube una foto, un PDF o un Excel.");
      return;
    }

    setLeyendo(true);
    const datos = await new Promise<string>((res) => {
      const l = new FileReader();
      l.onload = () => res(String(l.result));
      l.readAsDataURL(archivo);
    });

    const esExcel = /\.(xlsx|xls)$/i.test(archivo.name);
    const esPdf = /\.pdf$/i.test(archivo.name);
    const lectura = esExcel
      ? await leerExcel(datos)
      : esPdf
        ? await leerFotoOPdf({ pdfBase64: datos.slice(datos.indexOf(",") + 1) })
        : await leerFotoOPdf({ imagenBase64: datos, imagenMime: archivo.type });

    if (!lectura.ok || !lectura.dato) {
      setLeyendo(false);
      setError(lectura.error ?? "No pudimos leer ese archivo. Intenta con otra foto o PDF.");
      return;
    }
    if (lectura.dato.items.length === 0) {
      setLeyendo(false);
      setError("No encontramos platos en ese archivo. Si es una foto, prueba con una más nítida.");
      return;
    }

    // Modo "agregar" (el default, explícito acá porque es la decisión que
    // hace seguro reimportar): lo que ya existe por nombre se saltea.
    const guardado = await importarCarta(lectura.dato.items, "agregar");
    setLeyendo(false);
    if (!guardado.ok || !guardado.dato) {
      setError(guardado.error ?? "Leímos tu carta pero no pudimos guardarla. Intenta de nuevo.");
      return;
    }
    setListo(resumenImportacion(guardado.dato));
    await alTerminar();
  }

  const abrir = () => input.current?.click();

  return (
    <div className={variante === "vacio" ? "surge" : ""}>
      <input
        ref={input}
        type="file"
        accept={ACEPTA_CARTA}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          // Se limpia para que elegir el MISMO archivo otra vez vuelva a disparar.
          e.target.value = "";
          if (f) void alElegir(f);
        }}
      />

      {variante === "vacio" ? (
        <button
          onClick={abrir}
          disabled={leyendo}
          className="block w-full cursor-pointer rounded-tarjeta border-2 border-dashed border-linea bg-carta px-6 py-8 text-center transition hover:border-brasa disabled:cursor-wait"
        >
          {leyendo ? (
            <>
              {/* Ninguna espera sin animación. Leer una carta de 13 páginas
                  tarda: sin esto parece colgado y el dueño recarga. */}
              <span className="mx-auto mb-3 block h-8 w-8 animate-spin rounded-full border-2 border-linea border-t-brasa" />
              <span className="block font-semibold text-tinta">Leyendo tu carta…</span>
              <span className="mt-1 block text-[0.85rem] text-frio">
                Si tiene varias páginas puede tardar un minuto
              </span>
            </>
          ) : (
            <>
              <span className="block text-[2rem]" aria-hidden>📄</span>
              <span className="mt-2 block font-semibold text-tinta">Sube tu carta y la leemos</span>
              <span className="mt-1 block text-[0.85rem] text-frio">
                Foto, PDF o Excel · sacamos los platos y los precios
              </span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={abrir}
          disabled={leyendo}
          className="inline-flex items-center gap-2 rounded-tarjeta bg-carta px-4 py-2 text-[0.88rem] font-semibold text-tinta ring-1 ring-linea transition hover:bg-arena disabled:opacity-60"
        >
          {leyendo ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-linea border-t-brasa" />
              Leyendo…
            </>
          ) : (
            <>📄 Subir carta</>
          )}
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-tarjeta bg-alerta-suave px-3 py-2 text-[0.85rem] text-alerta-hondo">
          {error}
        </p>
      )}
      {listo && (
        <p className="mt-3 rounded-tarjeta bg-ok/8 px-3 py-2 text-[0.85rem] font-semibold text-tinta-2 ring-1 ring-ok/25">
          ✓ {listo}
        </p>
      )}
      {variante === "vacio" && !leyendo && (
        <button
          onClick={() => void descargarPlantilla()}
          className="mt-3 w-full text-center text-[0.85rem] font-semibold text-brasa-texto hover:underline"
        >
          ¿No tienes tu carta en archivo? Descarga la plantilla de Excel
        </button>
      )}
    </div>
  );
}
