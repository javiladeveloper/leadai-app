"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarPedidos, avanzarPedido, siguientePaso, minutosDesde, esUrgente,
  COLUMNAS, type PedidoCocina,
} from "@/lib/cocina";
import { soles } from "@/lib/precio";

/**
 * LA COCINA, EN LA COMPUTADORA (2026-08-19).
 *
 * Hasta hoy despachar pedidos solo se podía desde el celular. Un dueño con la
 * compu en el mostrador tenía que agarrar el teléfono —con las manos ocupadas—
 * para marcar un pedido como listo.
 *
 * DISEÑO: esta pantalla se mira durante todo el turno, de reojo, mientras se
 * hacen otras cosas. Por eso:
 *  - Columnas, no una lista: dónde está cada pedido se lee sin contar.
 *  - Un botón por tarjeta, grande, con el paso siguiente escrito. Nada de
 *    menús: en una cocina no se navega.
 *  - Los minutos en grande. Es el dato que decide a qué se atiende primero.
 *  - Lo urgente respira. Un borde fijo se vuelve invisible a los veinte
 *    minutos mirando la misma pantalla.
 */
export default function CocinaPage() {
  const [pedidos, setPedidos] = useState<PedidoCocina[] | null>(null);
  const [avanzando, setAvanzando] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Fuerza el recálculo de los minutos sin volver a pedir al backend: la
  // espera crece sola aunque no entre ningún pedido.
  const [, setTic] = useState(0);
  const vivo = useRef(true);

  const traer = useCallback(async () => {
    const r = await listarPedidos();
    if (vivo.current) setPedidos(r);
  }, []);

  useEffect(() => {
    vivo.current = true;
    void traer();
    // 15s: una cocina cambia rápido y esta pantalla queda abierta. Más lento y
    // el dueño ve un pedido que entró hace rato; más rápido no aporta.
    const id = setInterval(traer, 15_000);
    const idTic = setInterval(() => setTic((n) => n + 1), 30_000);
    return () => { vivo.current = false; clearInterval(id); clearInterval(idTic); };
  }, [traer]);

  async function avanzar(p: PedidoCocina) {
    const paso = siguientePaso(p);
    if (!paso || avanzando) return;
    setAvanzando(p.id);
    setError("");

    // OPTIMISTA: la tarjeta se mueve al instante y después se confirma. En una
    // cocina, esperar la red para ver que el toque funcionó hace que el dueño
    // toque dos veces.
    const antes = pedidos;
    setPedidos((ps) =>
      (ps ?? [])
        .map((x) => (x.id === p.id ? { ...x, estado: paso.estado } : x))
        // `entregado` sale de la cocina: ya no es un pedido en curso.
        .filter((x) => x.estado !== "entregado"),
    );

    const r = await avanzarPedido(p.id, paso.estado);
    setAvanzando(null);
    if (!r.ok) {
      // Se revierte: dejar la tarjeta movida cuando el backend la rechazó le
      // haría creer al dueño que despachó algo que sigue en la cocina.
      setPedidos(antes);
      setError(r.error ?? "No se pudo actualizar");
      return;
    }
    void traer();
  }

  if (pedidos === null) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((c) => (
          <div key={c.estado} className="h-64 animate-pulse rounded-tarjeta bg-arena-2/60" />
        ))}
      </div>
    );
  }

  const enCurso = pedidos.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-[1.3rem] font-bold text-tinta">Cocina</h1>
          <p className="text-[0.88rem] text-frio">
            {enCurso === 0
              ? "No hay pedidos en curso. Cuando entre uno, aparece acá."
              : enCurso === 1
                ? "1 pedido en curso."
                : `${enCurso} pedidos en curso.`}
          </p>
        </div>
        {error && <p className="fila-entra text-[0.85rem] font-semibold text-alerta">{error}</p>}
      </div>

      {/* CUATRO COLUMNAS en pantalla grande, dos en tablet, una en el celular.
          En la compu del mostrador se ve todo el turno de un vistazo. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((col) => {
          const suyos = pedidos.filter((p) => p.estado === col.estado);
          return (
            <section key={col.estado} className="rounded-tarjeta bg-arena/50 p-3">
              <p className="mb-2 flex items-center gap-1.5 px-1 text-[0.78rem] font-bold uppercase tracking-wide text-frio">
                <span aria-hidden>{col.emoji}</span>
                {col.titulo}
                <span className="ml-auto tabular-nums">{suyos.length}</span>
              </p>

              <div className="space-y-2">
                {suyos.length === 0 && (
                  <p className="px-1 py-4 text-center text-[0.82rem] text-frio/70">Nada acá</p>
                )}
                {suyos.map((p) => (
                  <TarjetaPedido
                    key={p.id}
                    pedido={p}
                    avanzando={avanzando === p.id}
                    onAvanzar={() => avanzar(p)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TarjetaPedido({
  pedido, avanzando, onAvanzar,
}: { pedido: PedidoCocina; avanzando: boolean; onAvanzar: () => void }) {
  const paso = siguientePaso(pedido);
  const minutos = minutosDesde(pedido.creadoEn);
  const urgente = esUrgente(pedido);

  return (
    <article
      className={`fila-entra rounded-tarjeta bg-carta p-3 shadow-[var(--sombra-tarjeta)] transition-shadow ${
        // El borde de lo urgente RESPIRA: uno fijo se vuelve invisible a los
        // veinte minutos mirando la misma pantalla.
        urgente ? "respira ring-2 ring-calor" : "ring-1 ring-linea"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          {pedido.modalidad === "delivery" ? "🛵 Delivery" : "🥡 Recojo"}
        </span>
        {/* Los MINUTOS en grande: es el dato que decide a qué se atiende
            primero, y el que se lee desde lejos. */}
        <span
          className={`text-[0.95rem] font-bold tabular-nums ${
            urgente ? "text-calor-hondo" : "text-tinta-2"
          }`}
        >
          {minutos}′
        </span>
      </div>

      {pedido.items && pedido.items.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {pedido.items.map((it, i) => (
            <li key={i} className="text-[0.88rem] leading-snug text-tinta">
              <b className="tabular-nums">{it.cantidad}×</b> {it.nombre}
            </li>
          ))}
        </ul>
      )}

      {pedido.direccion && (
        <p className="mt-1.5 line-clamp-2 text-[0.78rem] text-frio">📍 {pedido.direccion}</p>
      )}
      {pedido.notas && (
        <p className="mt-1 rounded bg-arena px-2 py-1 text-[0.78rem] text-tinta-2">{pedido.notas}</p>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[0.9rem] font-bold tabular-nums text-tinta">
          {soles(pedido.totalCentavos)}
        </span>
        {paso && (
          <button
            type="button"
            onClick={onAvanzar}
            disabled={avanzando}
            className="rounded-chip bg-brasa px-3 py-1.5 text-[0.82rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {avanzando ? "…" : paso.etiqueta}
          </button>
        )}
      </div>
    </article>
  );
}
