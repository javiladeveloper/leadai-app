"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TIPOS_NODO_UI } from "@/lib/flujos";

// Mapea el acento (token) a clases de color del borde/encabezado.
const ACENTO: Record<string, string> = {
  tinta: "border-tinta", "tinta-2": "border-linea", tibio: "border-tibio",
  ok: "border-ok", brasa: "border-brasa",
};

export function NodoTarjeta({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  const tipo = String(d.tipo ?? "mensaje");
  const meta = TIPOS_NODO_UI.find((t) => t.tipo === tipo);
  const resumen = resumenDeDatos(tipo, d);
  const apagado = d.activo === false; // paso desactivado por el usuario → se salta

  // Salidas del nodo: opciones → una por opción; condición → sí/no; resto → una default.
  const salidas = salidasDe(tipo, d);

  return (
    <div className={`min-w-[180px] max-w-[240px] rounded-tarjeta bg-carta p-3 shadow-[var(--sombra-tarjeta)] ring-1 transition ${
      selected ? "ring-2 ring-brasa" : "ring-linea"
    } ${ACENTO[meta?.acento ?? "tinta-2"]} border-l-4 ${apagado ? "opacity-50" : ""}`}>
      {tipo !== "inicio" && <Handle type="target" position={Position.Top} />}
      <div className="flex items-center justify-between gap-1">
        <p className="text-[0.62rem] font-bold uppercase tracking-wide text-frio">{meta?.etiqueta ?? tipo}</p>
        {apagado && <span className="rounded-chip bg-linea px-1.5 py-0.5 text-[0.55rem] font-bold text-frio">APAGADO</span>}
      </div>
      {resumen && <p className="mt-1 line-clamp-2 text-[0.82rem] text-tinta">{resumen}</p>}

      {/* Salidas etiquetadas (multi-handle) */}
      {salidas.length > 1 && (
        <div className="mt-2 flex flex-col gap-1">
          {salidas.map((s) => (
            <div key={s.id} className="relative flex items-center justify-end pr-3">
              <span className="text-[0.68rem] font-semibold text-tinta-2">{s.etiqueta}</span>
              <Handle type="source" id={s.id} position={Position.Right}
                style={{ position: "relative", transform: "none", right: -6, top: 0 }} />
            </div>
          ))}
        </div>
      )}
      {salidas.length === 1 && tipo !== "escalar" && (
        <Handle type="source" id={salidas[0].id} position={Position.Bottom} />
      )}
    </div>
  );
}

// Define las salidas (puertos) de un nodo según su tipo.
function salidasDe(tipo: string, d: Record<string, unknown>): { id: string; etiqueta: string }[] {
  if (tipo === "opciones") {
    const ops = (d.opciones as { id: string; etiqueta: string }[]) ?? [];
    return ops.map((o) => ({ id: o.id, etiqueta: o.etiqueta || o.id }));
  }
  if (tipo === "condicion") {
    return [{ id: "si", etiqueta: "Sí" }, { id: "no", etiqueta: "No" }];
  }
  if (tipo === "escalar") return [];
  return [{ id: "default", etiqueta: "" }];
}

function resumenDeDatos(tipo: string, data: Record<string, unknown>): string {
  if (tipo === "mensaje" || tipo === "fija") return String(data.texto ?? "");
  if (tipo === "opciones" || tipo === "pedir_dato") return String(data.pregunta ?? "");
  if (tipo === "ia") return "La IA responde";
  if (tipo === "escalar") return "Avisa a una persona";
  if (tipo === "condicion") return `Si ${String(data.campo ?? "")} = ${String(data.valor ?? "")}`;
  if (tipo === "accion") return String(data.accion === "notificar" ? "Avisar a la dueña" : `Etiqueta: ${data.etiqueta ?? ""}`);
  if (tipo === "inicio") return "Empieza acá";
  return "";
}
