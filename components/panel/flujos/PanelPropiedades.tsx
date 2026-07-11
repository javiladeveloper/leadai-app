"use client";
import type { Node } from "@xyflow/react";

// Edita los `datos` del nodo seleccionado según su tipo. Cambios en vivo via onCambiar.
export function PanelPropiedades({
  nodo, onCambiar,
}: { nodo: Node | null; onCambiar: (id: string, datos: Record<string, unknown>) => void }) {
  if (!nodo) {
    return <div className="w-72 shrink-0 border-l border-linea bg-carta p-4 text-[0.85rem] text-frio">Tocá un paso para editarlo.</div>;
  }
  const data = (nodo.data ?? {}) as { tipo: string } & Record<string, unknown>;
  const tipo = data.tipo;
  const set = (campo: string, valor: unknown) => onCambiar(nodo.id, { ...data, [campo]: valor });

  return (
    <div className="w-72 shrink-0 space-y-3 border-l border-linea bg-carta p-4">
      <p className="eyebrow">Editar paso</p>
      {(tipo === "mensaje" || tipo === "fija") && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Texto</span>
          <textarea value={String(data.texto ?? "")} onChange={(e) => set("texto", e.target.value)} rows={4}
            className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
        </label>
      )}
      {(tipo === "opciones" || tipo === "pedir_dato") && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Pregunta</span>
          <textarea value={String(data.pregunta ?? "")} onChange={(e) => set("pregunta", e.target.value)} rows={3}
            className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
        </label>
      )}
      {tipo === "opciones" && (
        <OpcionesEditor
          opciones={(data.opciones as { id: string; etiqueta: string }[]) ?? []}
          onCambiar={(ops) => set("opciones", ops)} />
      )}
      {tipo === "pedir_dato" && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-tinta">Guardar como</span>
          <input value={String(data.guardarComo ?? "")} onChange={(e) => set("guardarComo", e.target.value)}
            placeholder="ej: dia, telefono"
            className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
        </label>
      )}
      {tipo === "ia" && <p className="text-[0.85rem] text-frio">La IA toma la conversación con el perfil del negocio.</p>}
      {tipo === "escalar" && <p className="text-[0.85rem] text-frio">Le avisa a una persona con lo que se sabe del cliente.</p>}
      {tipo === "inicio" && <p className="text-[0.85rem] text-frio">Es donde empieza el flujo. No se edita.</p>}
    </div>
  );
}

function OpcionesEditor({
  opciones, onCambiar,
}: { opciones: { id: string; etiqueta: string }[]; onCambiar: (ops: { id: string; etiqueta: string }[]) => void }) {
  const set = (i: number, etiqueta: string) => {
    const copia = [...opciones]; copia[i] = { ...copia[i], etiqueta }; onCambiar(copia);
  };
  const agregar = () => onCambiar([...opciones, { id: `op${opciones.length + 1}`, etiqueta: "" }]);
  const quitar = (i: number) => onCambiar(opciones.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium text-tinta">Opciones</span>
      {opciones.map((o, i) => (
        <div key={o.id} className="flex gap-2">
          <input value={o.etiqueta} onChange={(e) => set(i, e.target.value)}
            className="flex-1 rounded-lg border border-linea bg-arena/30 px-2 py-1.5 text-sm text-tinta outline-none focus:border-brasa" />
          <button onClick={() => quitar(i)} className="text-frio hover:text-brasa-hondo">✕</button>
        </div>
      ))}
      <button onClick={agregar} className="text-[0.8rem] font-semibold text-brasa-hondo">+ Agregar opción</button>
    </div>
  );
}
