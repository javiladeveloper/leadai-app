"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TIPOS_NODO_UI } from "@/lib/flujos";

// Mapea el acento (token) a clases de color del borde/encabezado.
const ACENTO: Record<string, string> = {
  tinta: "border-tinta", "tinta-2": "border-linea", tibio: "border-tibio",
  ok: "border-ok", brasa: "border-brasa",
};

export function NodoTarjeta({ data, selected }: NodeProps) {
  const tipo = String((data as { tipo?: string }).tipo ?? "mensaje");
  const meta = TIPOS_NODO_UI.find((t) => t.tipo === tipo);
  const resumen = resumenDeDatos(tipo, data as Record<string, unknown>);
  return (
    <div className={`min-w-[180px] max-w-[220px] rounded-tarjeta bg-carta p-3 shadow-[var(--sombra-tarjeta)] ring-1 transition ${
      selected ? "ring-2 ring-brasa" : "ring-linea"
    } ${ACENTO[meta?.acento ?? "tinta-2"]} border-l-4`}>
      {tipo !== "inicio" && <Handle type="target" position={Position.Top} />}
      <p className="text-[0.62rem] font-bold uppercase tracking-wide text-frio">{meta?.etiqueta ?? tipo}</p>
      {resumen && <p className="mt-1 line-clamp-2 text-[0.82rem] text-tinta">{resumen}</p>}
      {tipo !== "escalar" && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
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
