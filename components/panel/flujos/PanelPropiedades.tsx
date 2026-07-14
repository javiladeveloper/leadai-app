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

  // El inicio no se puede apagar. Para el resto, un toggle "activo": si se
  // apaga, el motor SALTA este paso (datos.activo === false).
  const activo = data.activo !== false;

  return (
    <div className="w-72 shrink-0 space-y-3 border-l border-linea bg-carta p-4">
      <p className="eyebrow">Editar paso</p>

      {tipo !== "inicio" && (
        <label className="flex items-center justify-between gap-2 rounded-lg bg-arena/40 px-3 py-2">
          <span className="text-sm font-medium text-tinta">
            {activo ? "Paso activo" : "Paso apagado (se salta)"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label="Activar o apagar este paso"
            onClick={() => set("activo", !activo)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              activo ? "bg-ok" : "bg-linea"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-carta shadow transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </label>
      )}

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
      {tipo === "condicion" && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">Si el lead…</span>
            <select value={String(data.campo ?? "nivelInteres")} onChange={(e) => set("campo", e.target.value)}
              className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa">
              <option value="nivelInteres">Su interés</option>
              <option value="estado">Su etapa</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">es igual a</span>
            <input value={String(data.valor ?? "")} onChange={(e) => onCambiar(nodo.id, { ...data, operador: "es", valor: e.target.value })}
              placeholder="ej: caliente, ganado"
              className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
          </label>
          <p className="text-[0.78rem] text-frio">Conectá la salida &quot;Sí&quot; y la &quot;No&quot; a distintos pasos.</p>
        </div>
      )}
      {tipo === "accion" && (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-tinta">¿Qué hago?</span>
            <select value={String(data.accion ?? "etiquetar")} onChange={(e) => set("accion", e.target.value)}
              className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa">
              <option value="etiquetar">Ponerle una etiqueta</option>
              <option value="notificar">Avisarme a mí</option>
            </select>
          </label>
          {String(data.accion ?? "etiquetar") === "etiquetar" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-tinta">Etiqueta</span>
              <input value={String(data.etiqueta ?? "")} onChange={(e) => set("etiqueta", e.target.value)}
                placeholder="ej: interesado-vip"
                className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
            </label>
          )}
          {String(data.accion ?? "") === "notificar" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-tinta">Mensaje del aviso</span>
              <input value={String(data.mensaje ?? "")} onChange={(e) => set("mensaje", e.target.value)}
                placeholder="ej: Nuevo lead VIP"
                className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-sm text-tinta outline-none focus:border-brasa" />
            </label>
          )}
        </div>
      )}
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
  // Id único basado en el máximo existente (no en .length): una secuencia
  // agregar/quitar/agregar no debe reusar un id vivo (con multi-handle, un id
  // duplicado engancharía la conexión a la opción equivocada).
  const agregar = () => {
    const maxN = opciones.reduce((m, o) => {
      const n = Number(/^op(\d+)$/.exec(o.id)?.[1] ?? 0);
      return n > m ? n : m;
    }, 0);
    onCambiar([...opciones, { id: `op${maxN + 1}`, etiqueta: "" }]);
  };
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
