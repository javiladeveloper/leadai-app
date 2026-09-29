"use client";

import { useEffect, useState } from "react";

/** La clave evita mostrar datos del negocio/periodo anterior incluso antes del efecto. */
export function useLecturaMarketing<T>(clave: string, cargar: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [lectura, setLectura] = useState<{ clave: string; version: number; datos?: T; error?: string } | null>(null);
  useEffect(() => {
    let vigente = true;
    void cargar().then(
      (datos) => { if (vigente) setLectura({ clave, version, datos }); },
      (e: unknown) => { if (vigente) setLectura({ clave, version, error: e instanceof Error ? e.message : "No se pudieron cargar los datos." }); },
    );
    return () => { vigente = false; };
  }, [clave, cargar, version]);
  const vigente = lectura?.clave === clave && lectura.version === version;
  return { datos: vigente ? lectura.datos : undefined, error: vigente ? lectura.error : undefined, cargando: !vigente, reintentar: () => setVersion((n) => n + 1) };
}

export function ErrorMarketing({ mensaje, reintentar }: { mensaje: string; reintentar: () => void }) {
  return <div role="alert" className="rounded-tarjeta bg-carta p-5 text-tinta-2 ring-1 ring-linea">
    <p>{mensaje}</p>
    <button type="button" onClick={reintentar} className="mt-2 rounded-chip bg-arena px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-brasa">Reintentar</button>
  </div>;
}

export type MetadatosMarketing = {
  periodo?: { desde: string; hasta: string; dias: number };
  moneda?: string | null;
  actualizadoEn?: string | null;
};

export function periodoCoincide(datos: MetadatosMarketing, dias: number) {
  return datos.periodo?.dias === dias;
}

export function importeMarketing(centavos: number | null | undefined, moneda?: string | null) {
  if (typeof centavos !== "number" || !Number.isFinite(centavos)) return "No medido";
  return `${(centavos / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda || "(moneda no informada)"}`;
}
