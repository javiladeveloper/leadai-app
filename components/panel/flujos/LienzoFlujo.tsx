"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow, Background, Controls, addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { obtenerFlujo, actualizarFlujo } from "@/lib/api";
import { aReactFlow, aBackend } from "@/lib/flujos";
import { NodoTarjeta } from "./NodoTarjeta";

export function LienzoFlujo({ flujoId }: { flujoId: string }) {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<"cargando" | "ok" | "guardando" | "no-encontrado">("cargando");
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const nodeTypes = useMemo(() => ({ brasa: NodoTarjeta }), []);

  useEffect(() => {
    obtenerFlujo(flujoId).then((f) => {
      if (!f) { setEstado("no-encontrado"); return; }
      const { nodes, edges } = aReactFlow(f.grafo);
      setNodes(nodes); setEdges(edges); setNombre(f.nombre); setEstado("ok");
    });
  }, [flujoId]);

  const onNodesChange: OnNodesChange = useCallback((ch) => setNodes((ns) => applyNodeChanges(ch, ns)), []);
  const onEdgesChange: OnEdgesChange = useCallback((ch) => setEdges((es) => applyEdgeChanges(ch, es)), []);
  const onConnect = useCallback((c: Connection) => setEdges((es) => addEdge(c, es)), []);

  async function guardar() {
    setEstado("guardando");
    const r = await actualizarFlujo(flujoId, { nombre, grafo: aBackend(nodes, edges) });
    if (!r.ok) {
      setErrorGuardar(r.error ?? "No se pudo guardar el flujo.");
    } else {
      setErrorGuardar(null);
    }
    setEstado("ok");
  }

  if (estado === "cargando") return <div className="p-8 text-frio">Cargando…</div>;

  if (estado === "no-encontrado") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center p-8">
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-sm font-semibold text-tinta">No encontramos este flujo</p>
          <button onClick={() => router.push("/flujos")}
            className="mt-4 rounded-tarjeta bg-brasa px-4 py-2 text-sm font-semibold text-carta hover:bg-brasa-hondo">
            Volver a flujos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col">
      <div className="flex items-center gap-3 border-b border-linea bg-carta px-5 py-3">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)}
          className="flex-1 rounded-lg border border-linea bg-arena/40 px-3 py-1.5 text-sm font-semibold text-tinta outline-none focus:border-brasa" />
        {errorGuardar && <span className="text-sm text-brasa-hondo">{errorGuardar}</span>}
        <button onClick={guardar} disabled={estado === "guardando"}
          className="rounded-tarjeta bg-brasa px-4 py-2 text-sm font-semibold text-carta hover:bg-brasa-hondo disabled:opacity-60">
          {estado === "guardando" ? "Guardando…" : "Guardar"}
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
