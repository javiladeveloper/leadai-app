"use client";

import { useEffect, useState } from "react";

/**
 * EL ENCABEZADO DE UNA PLANTILLA O CAMPAÑA, VISIBLE (2026-10-05, pedido de
 * Jonathan: "veo que está aprobada pero debería poder ver la imagen").
 *
 * Miniatura en la tarjeta; al tocarla se abre en grande. Para un video, el
 * reproductor; para un documento, el enlace. Sin URL no muestra nada: no hay
 * nada que ver y un recuadro vacío parecería un error.
 */
export function VistaEncabezado({ tipo, url, etiqueta }: { tipo: string | null | undefined; url: string | null | undefined; etiqueta: string }) {
  const [abierta, setAbierta] = useState(false);
  const [rota, setRota] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierta(false); };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta]);

  if (!url || !tipo || rota) return null;

  if (tipo === "DOCUMENT") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[0.8rem] font-semibold text-brasa-texto underline-offset-2 hover:underline">
        Ver el documento del encabezado
      </a>
    );
  }

  const esVideo = tipo === "VIDEO";
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        aria-label={`Ver en grande: ${etiqueta}`}
        className="group mt-2 block overflow-hidden rounded-lg ring-1 ring-linea transition hover:ring-brasa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brasa"
      >
        {esVideo ? (
          <video src={url} muted preload="metadata" className="h-28 w-auto max-w-full object-cover" onError={() => setRota(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Meta o del storage: no pasa por el optimizador.
          <img src={url} alt={etiqueta} className="h-28 w-auto max-w-full object-cover transition group-hover:opacity-90" onError={() => setRota(true)} />
        )}
      </button>

      {abierta && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={etiqueta}
          onClick={() => setAbierta(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="relative max-h-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {esVideo ? (
              <video src={url} controls autoPlay className="max-h-[85vh] max-w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={etiqueta} className="max-h-[85vh] max-w-full rounded-lg" />
            )}
            <button
              type="button"
              onClick={() => setAbierta(false)}
              className="absolute -top-3 -right-3 grid h-9 w-9 place-items-center rounded-full bg-carta text-[1.1rem] font-bold text-tinta shadow ring-1 ring-linea"
              aria-label="Cerrar"
              autoFocus
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
