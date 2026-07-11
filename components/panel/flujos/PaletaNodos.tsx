"use client";
import { TIPOS_NODO_UI } from "@/lib/flujos";

// Paleta lateral: un botón por tipo de nodo (menos 'inicio', que es único y ya existe).
export function PaletaNodos({ onAgregar }: { onAgregar: (tipo: string) => void }) {
  return (
    <div className="w-48 shrink-0 space-y-1.5 border-r border-linea bg-carta p-3">
      <p className="eyebrow mb-2">Agregar paso</p>
      {TIPOS_NODO_UI.filter((t) => t.tipo !== "inicio").map((t) => (
        <button key={t.tipo} onClick={() => onAgregar(t.tipo)}
          className="block w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-left text-[0.82rem] font-semibold text-tinta transition hover:border-brasa hover:bg-brasa-suave">
          {t.etiqueta}
          <span className="block text-[0.68rem] font-normal text-frio">{t.descripcion}</span>
        </button>
      ))}
    </div>
  );
}
