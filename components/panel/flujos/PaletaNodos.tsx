"use client";
import { TIPOS_NODO_UI } from "@/lib/flujos";

// Paleta de tipos de nodo. Desktop (lg+): columna lateral. Móvil: fila
// horizontal scrolleable ARRIBA del lienzo — como columnas fijas, paleta +
// panel de propiedades sumaban 480px y el lienzo desaparecía en un celular
// (auditoría responsive 2026-07-23).
export function PaletaNodos({ onAgregar }: { onAgregar: (tipo: string) => void }) {
  return (
    <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-linea bg-carta p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:block lg:w-48 lg:space-y-1.5 lg:overflow-visible lg:border-b-0 lg:border-r lg:p-3">
      <p className="eyebrow mb-2 hidden lg:block">Agregar paso</p>
      {TIPOS_NODO_UI.filter((t) => t.tipo !== "inicio").map((t) => (
        <button key={t.tipo} onClick={() => onAgregar(t.tipo)}
          className="block w-36 shrink-0 rounded-lg border border-linea bg-arena/30 px-3 py-2 text-left text-[0.82rem] font-semibold text-tinta transition hover:border-brasa hover:bg-brasa-suave lg:w-full">
          {t.etiqueta}
          <span className="block truncate text-[0.68rem] font-normal text-frio lg:whitespace-normal">{t.descripcion}</span>
        </button>
      ))}
    </div>
  );
}
