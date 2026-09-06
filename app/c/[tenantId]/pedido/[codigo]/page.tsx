"use client";

import { useEffect, useState, use } from "react";

/**
 * EL ESTADO DEL PEDIDO, EN UNA PÁGINA (2026-09-06) — Fase 1 de la app de
 * comensales (compartido/vision-app-comensales.md).
 *
 * Cada refresco de esta página reemplaza un "¿ya está mi pedido?" que por
 * WhatsApp costaría un mensaje de Meta. Consulta el endpoint público (que por
 * diseño no trae NADA personal) y se actualiza sola cada 12 segundos mientras
 * el pedido está vivo.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface EstadoPedido {
  estado: string;
  modalidad?: string;
  totalCentavos: number;
  etaMinutos?: number | null;
  motorizadoNombre?: string | null;
}

const soles = (c: number) => `S/${(c / 100).toFixed(2)}`;

/** Los pasos del viaje, en orden, con cómo se le cuentan al cliente. */
const PASOS: { id: string[]; icono: string; titulo: string }[] = [
  { id: ["esperando_confirmacion", "esperando_pago"], icono: "💳", titulo: "Esperando tu pago" },
  { id: ["pagado", "preparando"], icono: "👨‍🍳", titulo: "En cocina" },
  { id: ["listo"], icono: "🥡", titulo: "Listo" },
  { id: ["en_camino"], icono: "🛵", titulo: "En camino" },
  { id: ["entregado"], icono: "🎉", titulo: "Entregado" },
];

const TERMINALES = new Set(["entregado", "cancelado", "vencido"]);

export default function EstadoPedidoPage({
  params,
}: {
  params: Promise<{ tenantId: string; codigo: string }>;
}) {
  const { tenantId, codigo } = use(params);
  const [pedido, setPedido] = useState<EstadoPedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function consultar() {
      try {
        const res = await fetch(`${API_URL}/c/${tenantId}/pedido/${codigo}`);
        if (!vivo) return;
        if (!res.ok) {
          setError(res.status === 404 ? "No encontramos ese pedido. Revisa el código." : "No pudimos consultar tu pedido.");
          return;
        }
        const d = (await res.json()) as EstadoPedido;
        setPedido(d);
        setError(null);
        // Vivo = se sigue moviendo: se re-consulta solo. Terminal = se para
        // (seguir consultando un pedido entregado es gastar por gusto).
        if (!TERMINALES.has(d.estado)) timer = setTimeout(consultar, 12_000);
      } catch {
        if (!vivo) return;
        setError("Sin conexión. Reintentando…");
        timer = setTimeout(consultar, 12_000);
      }
    }
    void consultar();
    return () => { vivo = false; if (timer) clearTimeout(timer); };
  }, [tenantId, codigo]);

  const estado = pedido?.estado ?? "";
  const cancelado = estado === "cancelado";
  const vencido = estado === "vencido";
  const idxActual = PASOS.findIndex((p) => p.id.includes(estado));
  // Recojo no pasa por "en camino": ese paso se oculta para no mostrar un
  // viaje que nunca va a ocurrir.
  const pasos = pedido?.modalidad === "recojo" ? PASOS.filter((p) => !p.id.includes("en_camino")) : PASOS;
  const idxVisible = pasos.findIndex((p) => p.id.includes(estado));

  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-arena">
      <div className="flex flex-1 flex-col gap-5 p-6">
        <header className="pt-2 text-center">
          <h1 className="text-[1.35rem] font-bold text-tinta">Tu pedido</h1>
          <p className="text-[0.85rem] text-frio">
            #{codigo.toUpperCase()}{pedido ? <> · {soles(pedido.totalCentavos)}</> : null}
          </p>
        </header>

        {error && !pedido && (
          <p className="rounded-tarjeta bg-carta px-4 py-3 text-center text-[0.9rem] text-tinta-2 ring-1 ring-linea">{error}</p>
        )}

        {cancelado && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <div className="text-[2.4rem]">🙏</div>
            <p className="mt-1 font-bold text-tinta">Tu pedido fue cancelado</p>
            <p className="mt-1 text-[0.9rem] text-tinta-2">Si fue un error, escríbele al local por WhatsApp.</p>
          </div>
        )}

        {vencido && (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <div className="text-[2.4rem]">⏳</div>
            <p className="mt-1 font-bold text-tinta">Este carrito venció</p>
            <p className="mt-1 text-[0.9rem] text-tinta-2">
              <a href={`/c/${tenantId}`} className="font-semibold underline">Vuelve a la carta</a> y ármalo de nuevo.
            </p>
          </div>
        )}

        {pedido && !cancelado && !vencido && (
          <ol className="space-y-0">
            {pasos.map((p, i) => {
              const hecho = idxVisible > i;
              const actual = idxVisible === i;
              return (
                <li key={p.titulo} className="flex gap-4">
                  {/* La columna del viaje: punto + línea al siguiente. */}
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid size-11 shrink-0 place-items-center rounded-full text-[1.2rem] ring-2 ${
                        actual
                          ? "bg-brasa/15 ring-brasa"
                          : hecho
                            ? "bg-ok/10 ring-ok/50"
                            : "bg-carta ring-linea opacity-50"
                      }`}
                      aria-hidden
                    >
                      {hecho ? "✓" : p.icono}
                    </span>
                    {i < pasos.length - 1 && (
                      <span className={`w-0.5 flex-1 ${hecho ? "bg-ok/40" : "bg-linea"}`} aria-hidden />
                    )}
                  </div>
                  <div className={`pb-6 pt-2 ${actual ? "" : hecho ? "opacity-80" : "opacity-45"}`}>
                    <p className={`font-bold text-tinta ${actual ? "text-[1.05rem]" : "text-[0.95rem]"}`}>
                      {p.titulo}
                    </p>
                    {actual && estado === "en_camino" && pedido.motorizadoNombre && (
                      <p className="text-[0.85rem] text-tinta-2">Lo lleva {pedido.motorizadoNombre}</p>
                    )}
                    {actual && (estado === "pagado" || estado === "preparando") && pedido.etaMinutos ? (
                      <p className="text-[0.85rem] text-tinta-2">unos {pedido.etaMinutos} min</p>
                    ) : null}
                    {actual && estado === "listo" && pedido.modalidad === "recojo" && (
                      <p className="text-[0.85rem] text-tinta-2">¡Pasa a recogerlo!</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {pedido && !TERMINALES.has(estado) && (
          <p className="mt-auto text-center text-[0.78rem] text-frio">
            Esta página se actualiza sola — no hace falta refrescar
          </p>
        )}
      </div>
    </main>
  );
}
