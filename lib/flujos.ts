import type { GrafoFlujo, NodoFlujo } from "./api";
import type { Node, Edge } from "@xyflow/react";

// Metadatos de cada tipo de nodo: etiqueta legible, descripción y acento (token
// Brasa) para la paleta y el estilo del nodo en el canvas.
export const TIPOS_NODO_UI: {
  tipo: string; etiqueta: string; descripcion: string; acento: string;
}[] = [
  { tipo: "inicio", etiqueta: "Inicio", descripcion: "Donde empieza el flujo", acento: "tinta" },
  { tipo: "mensaje", etiqueta: "Mensaje", descripcion: "El bot dice algo", acento: "tinta-2" },
  { tipo: "opciones", etiqueta: "Pregunta con opciones", descripcion: "Ofrece botones a elegir", acento: "tibio" },
  { tipo: "fija", etiqueta: "Respuesta fija", descripcion: "Texto fijo, sin IA (gratis)", acento: "ok" },
  { tipo: "ia", etiqueta: "Pasar a la IA", descripcion: "La IA toma la conversación", acento: "brasa" },
  { tipo: "pedir_dato", etiqueta: "Pedir un dato", descripcion: "Pregunta y guarda la respuesta", acento: "tibio" },
  { tipo: "escalar", etiqueta: "Avisar a una persona", descripcion: "Escala a un humano", acento: "brasa" },
];

// Backend -> React Flow.
export function aReactFlow(grafo: GrafoFlujo): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = grafo.nodos.map((n) => ({
    id: n.id,
    type: "brasa", // usamos un solo nodo custom que renderiza según n.tipo
    position: n.pos,
    data: { tipo: n.tipo, ...n.datos },
    // El backend exige exactamente 1 nodo "inicio": no debe poder borrarse
    // con Backspace/Delete ni dejar el grafo inválido.
    deletable: n.tipo !== "inicio",
    draggable: true,
  }));
  const edges: Edge[] = grafo.conexiones.map((c) => ({
    id: c.id, source: c.desde, target: c.hacia, sourceHandle: c.puerto ?? null,
  }));
  return { nodes, edges };
}

// React Flow -> Backend.
export function aBackend(nodes: Node[], edges: Edge[]): GrafoFlujo {
  const nodos: NodoFlujo[] = nodes.map((n) => {
    const { tipo, ...datos } = (n.data ?? {}) as { tipo: string } & Record<string, unknown>;
    return { id: n.id, tipo, pos: { x: n.position.x, y: n.position.y }, datos };
  });
  const conexiones = edges.map((e) => ({
    id: e.id, desde: e.source, hacia: e.target,
    ...(e.sourceHandle ? { puerto: e.sourceHandle } : {}),
  }));
  return { nodos, conexiones };
}
