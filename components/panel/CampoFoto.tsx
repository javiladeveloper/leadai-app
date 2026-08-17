"use client";

/**
 * EL CAMPO DE FOTO DE LA CARTA (2026-08-17).
 *
 * Lo usan los platos, los extras, los combos y las promos — cuatro formularios
 * con el mismo comportamiento: se elige el archivo, se ve al instante, y recién
 * viaja al servidor al guardar.
 *
 * Ese "recién al guardar" no es pereza: un plato NUEVO no tiene id hasta que
 * el backend lo crea, así que la subida es siempre un segundo paso. Y si esa
 * subida falla, lo que el dueño escribió ya quedó guardado.
 */

import { useState } from "react";
import { leerFoto, subirFoto, quitarFoto, type ConFoto } from "@/lib/carta";

/** El estado de la foto mientras se edita algo de la carta. */
export interface EstadoFoto {
  /** Lo que se muestra: la URL guardada o la data URL recién elegida. */
  vista: string | null;
  elegir: (archivo: File) => Promise<string | null>;
  quitar: () => void;
  /** Manda la foto al servidor. Se llama DESPUÉS de crear o actualizar. */
  guardar: (tipo: ConFoto, id: string) => Promise<string | null>;
}

export function useFoto(fotoActual: string | null): EstadoFoto {
  const [vista, setVista] = useState<string | null>(fotoActual);
  const [nueva, setNueva] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);

  return {
    vista,
    async elegir(archivo) {
      const r = await leerFoto(archivo);
      if (!r.ok) return r.error;
      setVista(r.datos);
      setNueva(r.datos);
      setBorrar(false);
      return null;
    },
    quitar() {
      setVista(null);
      setNueva(null);
      setBorrar(true);
    },
    async guardar(tipo, id) {
      if (nueva) {
        const r = await subirFoto(tipo, id, nueva);
        return r.ok ? null : (r.error ?? "La foto no subió");
      }
      if (borrar) await quitarFoto(tipo, id);
      return null;
    },
  };
}

export function CampoFoto({
  foto, alFallar, etiqueta = "Foto", ayuda = "Opcional — JPG, PNG o WebP, hasta 5MB",
}: {
  foto: EstadoFoto;
  alFallar: (error: string) => void;
  etiqueta?: string;
  ayuda?: string;
}) {
  return (
    <label className="block">
      <span className="text-[0.8rem] font-bold text-tinta-2">{etiqueta}</span>
      <span className="ml-2 text-[0.78rem] text-frio">{ayuda}</span>
      <div className="mt-1.5 flex items-center gap-3">
        <label className="cursor-pointer">
          <span className="sr-only">Elegir la foto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={async (e) => {
              const archivo = e.target.files?.[0];
              // Se limpia el input para que elegir la MISMA foto otra vez
              // vuelva a disparar el onChange.
              e.target.value = "";
              if (!archivo) return;
              const error = await foto.elegir(archivo);
              if (error) alFallar(error);
            }}
          />
          {foto.vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={foto.vista}
              alt=""
              className="h-20 w-20 rounded-lg object-cover ring-2 ring-orbita/35"
            />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-lg border-2 border-dashed border-linea text-[1.6rem] text-frio transition hover:border-orbita hover:text-orbita">
              +
            </span>
          )}
        </label>
        {foto.vista && (
          <button
            type="button"
            onClick={foto.quitar}
            className="text-[0.85rem] font-semibold text-frio transition hover:text-alerta"
          >
            Quitar
          </button>
        )}
      </div>
    </label>
  );
}
