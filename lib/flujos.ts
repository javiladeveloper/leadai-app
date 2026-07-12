import type { GrafoFlujo, NodoFlujo } from "./api";
import type { Node, Edge } from "@xyflow/react";

// Plantilla inicial al crear un flujo: un ejemplo armado para no arrancar de cero.
export const PLANTILLA_FLUJO: GrafoFlujo = {
  nodos: [
    { id: "inicio", tipo: "inicio", pos: { x: 300, y: 20 }, datos: {} },
    { id: "nodo-1", tipo: "mensaje", pos: { x: 280, y: 120 }, datos: { texto: "¡Hola! 👋 ¿En qué te puedo ayudar?" } },
    { id: "nodo-2", tipo: "opciones", pos: { x: 280, y: 240 }, datos: {
      pregunta: "Elegí una opción:",
      opciones: [
        { id: "op1", etiqueta: "Ver precios" },
        { id: "op2", etiqueta: "Hablar con alguien" },
      ],
    } },
    { id: "nodo-3", tipo: "fija", pos: { x: 120, y: 400 }, datos: { texto: "Nuestros precios son… (editá este texto)" } },
    { id: "nodo-4", tipo: "ia", pos: { x: 440, y: 400 }, datos: {} },
  ],
  conexiones: [
    { id: "c1", desde: "inicio", hacia: "nodo-1" },
    { id: "c2", desde: "nodo-1", hacia: "nodo-2" },
    { id: "c3", desde: "nodo-2", hacia: "nodo-3", puerto: "op1" },
    { id: "c4", desde: "nodo-2", hacia: "nodo-4", puerto: "op2" },
  ],
};

// Validación amigable antes de guardar. Devuelve un mensaje en lenguaje simple
// si algo está mal, o null si el flujo está OK.
export function validarGrafoUI(nodes: Node[], edges: Edge[]): string | null {
  const inicios = nodes.filter((n) => (n.data as { tipo?: string })?.tipo === "inicio");
  if (inicios.length !== 1) {
    return "El flujo necesita un único paso de Inicio.";
  }
  const conEntrada = new Set(edges.map((e) => e.target));
  const sueltos = nodes.filter(
    (n) => (n.data as { tipo?: string })?.tipo !== "inicio" && !conEntrada.has(n.id),
  );
  if (sueltos.length > 0) {
    return `Hay ${sueltos.length} paso(s) sin conectar. Conectá cada paso al flujo antes de guardar.`;
  }
  return null;
}

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
  { tipo: "condicion", etiqueta: "Condición (sí/no)", descripcion: "Ramifica según cómo esté el lead", acento: "tibio" },
  { tipo: "accion", etiqueta: "Acción", descripcion: "Etiqueta el lead o te avisa", acento: "ok" },
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
    id: c.id, source: c.desde, target: c.hacia, sourceHandle: c.puerto ?? "default",
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
    ...(e.sourceHandle && e.sourceHandle !== "default" ? { puerto: e.sourceHandle } : {}),
  }));
  return { nodos, conexiones };
}
