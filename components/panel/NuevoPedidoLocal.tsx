"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCarta, type Carta, type ProductoCarta } from "@/lib/carta";
import { crearPedidoLocal, obtenerSalas, type ItemNuevoPedido, type SalaConfigurada } from "@/lib/cocina";
import { soles } from "@/lib/precio";

/**
 * TOMAR UN PEDIDO EN EL LOCAL (2026-08-21).
 *
 * Todo pedido nacía de una conversación de WhatsApp. Si entraba alguien y
 * pedía una hamburguesa, no había dónde anotarlo.
 *
 * DISEÑO: esta pantalla la usa alguien con prisa, de pie, mientras el cliente
 * habla. Por eso:
 *  - Buscador enfocado al abrir: se escribe el plato, no se scrollea la carta.
 *  - Un toque agrega; el mismo plato dos veces suma cantidad en vez de
 *    duplicar la línea.
 *  - La comanda vive al costado y crece en vivo, como la libreta del mozo.
 *  - El total siempre visible: es lo que el cliente va a preguntar.
 *
 * Los precios NO viajan desde acá para los platos de la carta: se mandan ids y
 * el servidor cotiza. Un ítem libre sí lleva precio, porque no existe en la
 * carta contra la cual comparar.
 */

interface LineaComanda {
  /** `productoId` para los de la carta; un id sintético para los libres. */
  clave: string;
  productoId?: string;
  nombre: string;
  precioCentavos: number;
  cantidad: number;
}

export function NuevoPedidoLocal({
  onCerrar, onCreado,
}: { onCerrar: () => void; onCreado: () => void }) {
  const [carta, setCarta] = useState<Carta | null>(null);
  const [salas, setSalas] = useState<SalaConfigurada[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<LineaComanda[]>([]);
  const [mesa, setMesa] = useState<string>("");
  const [modalidad, setModalidad] = useState<"local" | "recojo">("local");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const buscador = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void obtenerCarta().then(setCarta);
    void obtenerSalas().then(setSalas);
    // El foco va al buscador: quien toma el pedido ya está escuchando el plato.
    buscador.current?.focus();
  }, []);

  // Escape cierra. Sin esto el diálogo atrapa a quien navega con teclado.
  useEffect(() => {
    const alTecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [onCerrar]);

  const disponibles = useMemo(
    () => (carta?.productos ?? []).filter((p) => p.disponible),
    [carta],
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return disponibles;
    // También por alias: "un mostro" encuentra el pollo a la brasa, igual que
    // en el bot. El mozo escribe como habla el cliente.
    return disponibles.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.alias.some((a) => a.toLowerCase().includes(q)),
    );
  }, [disponibles, busqueda]);

  const agregar = useCallback((p: ProductoCarta) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.productoId === p.id);
      // El mismo plato otra vez SUMA CANTIDAD. Dos líneas iguales en una
      // comanda obligan a sumar de cabeza y se cocinan mal.
      if (i >= 0) {
        const copia = [...ls];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...ls, {
        clave: p.id, productoId: p.id, nombre: p.nombre,
        precioCentavos: p.precioCentavos, cantidad: 1,
      }];
    });
    // El buscador se limpia y vuelve a tomar el foco: el siguiente plato se
    // escribe de una, sin tocar el mouse.
    setBusqueda("");
    buscador.current?.focus();
  }, []);

  const cambiarCantidad = useCallback((clave: string, delta: number) => {
    setLineas((ls) =>
      ls
        .map((l) => (l.clave === clave ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );
  }, []);

  const total = lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);

  async function confirmar() {
    if (!lineas.length || guardando) return;
    setGuardando(true);
    setError("");
    const items: ItemNuevoPedido[] = lineas.map((l) => ({
      productoId: l.productoId,
      cantidad: l.cantidad,
    }));
    const r = await crearPedidoLocal({
      modalidad,
      items,
      mesa: modalidad === "local" ? mesa || null : null,
    });
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo crear el pedido");
      return;
    }
    onCreado();
  }

  const todasLasMesas = salas.flatMap((s) => s.mesas.map((m) => ({ sala: s.sala, mesa: m })));

  return (
    <div
      onClick={onCerrar}
      role="presentation"
      className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo pedido"
        className="surge flex max-h-[88vh] w-full max-w-3xl flex-col rounded-tarjeta bg-carta shadow-[0_8px_24px_rgba(51,40,31,0.2)] ring-1 ring-linea"
      >
        {/* Encabezado */}
        <div className="border-b border-linea p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="eyebrow">En el local</p>
              <h2 className="mt-0.5 text-[1.3rem] font-bold leading-tight text-tinta">
                Nuevo pedido
              </h2>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="shrink-0 rounded-chip px-2.5 py-1 text-[0.82rem] text-frio transition hover:bg-arena"
            >
              Cerrar
            </button>
          </div>

          {/* DÓNDE COME. Es lo primero que el mozo sabe —está parado en la
              mesa— y decide si hace falta elegir número. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Alternativa activo={modalidad === "local"} onClick={() => setModalidad("local")}>
              🍽️ Come acá
            </Alternativa>
            <Alternativa activo={modalidad === "recojo"} onClick={() => setModalidad("recojo")}>
              🥡 Se lo lleva
            </Alternativa>

            {modalidad === "local" && todasLasMesas.length > 0 && (
              <select
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                className="ml-auto rounded-chip border border-linea bg-arena/40 px-3 py-1.5 text-[0.85rem] text-tinta outline-none focus:border-brasa"
              >
                <option value="">Mostrador</option>
                {salas.map((s) => (
                  <optgroup key={s.sala} label={s.sala}>
                    {s.mesas.map((m) => (
                      <option key={`${s.sala}-${m}`} value={m}>Mesa {m}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Cuerpo: carta a la izquierda, comanda a la derecha. */}
        <div className="grid min-h-0 flex-1 gap-0 sm:grid-cols-[1fr_18rem]">
          {/* LA CARTA */}
          <div className="flex min-h-0 flex-col border-linea sm:border-r">
            <div className="p-4 pb-2">
              <input
                ref={buscador}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar plato…"
                className="w-full rounded-tarjeta border border-linea bg-arena/30 px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {carta === null && (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-11 animate-pulse rounded-tarjeta bg-arena-2/60" />
                  ))}
                </div>
              )}
              {carta !== null && filtrados.length === 0 && (
                <p className="px-1 py-8 text-center text-[0.85rem] text-frio">
                  {busqueda ? "Ningún plato con ese nombre." : "Todavía no cargaste la carta."}
                </p>
              )}
              <div className="space-y-1.5">
                {filtrados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregar(p)}
                    className="fila-entra flex w-full items-center gap-3 rounded-tarjeta bg-arena/40 px-3 py-2 text-left transition hover:bg-brasa-suave active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[0.9rem] text-tinta">
                      {p.nombre}
                    </span>
                    <span className="shrink-0 text-[0.85rem] font-bold tabular-nums text-tinta-2">
                      {soles(p.precioCentavos)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* LA COMANDA */}
          <div className="flex min-h-0 flex-col bg-arena/30">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {lineas.length === 0 ? (
                <p className="py-8 text-center text-[0.82rem] leading-snug text-frio/70">
                  Tocá un plato<br />para agregarlo
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {lineas.map((l) => (
                    <li
                      key={l.clave}
                      className="fila-entra rounded-tarjeta bg-carta p-2.5 ring-1 ring-linea"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 text-[0.85rem] leading-snug text-tinta">
                          {l.nombre}
                        </span>
                        <span className="shrink-0 text-[0.85rem] font-bold tabular-nums text-tinta">
                          {soles(l.precioCentavos * l.cantidad)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <BotonCantidad onClick={() => cambiarCantidad(l.clave, -1)} etiqueta={`Quitar uno de ${l.nombre}`}>
                          −
                        </BotonCantidad>
                        <span className="min-w-[1.5rem] text-center text-[0.85rem] font-bold tabular-nums text-tinta">
                          {l.cantidad}
                        </span>
                        <BotonCantidad onClick={() => cambiarCantidad(l.clave, 1)} etiqueta={`Agregar uno de ${l.nombre}`}>
                          +
                        </BotonCantidad>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* El pie: total y confirmación, siempre a la vista. */}
            <div className="border-t border-linea p-4">
              {error && (
                <p className="fila-entra mb-2 text-[0.8rem] font-semibold text-alerta">{error}</p>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.82rem] text-frio">Total</span>
                <span className="text-[1.15rem] font-bold tabular-nums text-tinta">
                  {soles(total)}
                </span>
              </div>
              <button
                type="button"
                onClick={confirmar}
                disabled={!lineas.length || guardando}
                className="mt-2.5 w-full rounded-chip bg-brasa px-3 py-2.5 text-[0.9rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99] disabled:opacity-40"
              >
                {guardando ? "Mandando…" : "Mandar a cocina"}
              </button>
              {/* El precio final lo calcula el servidor contra la carta: el
                  total de arriba es una cuenta local para que el mozo pueda
                  decírselo al cliente, no lo que se cobra. */}
              <p className="mt-1.5 text-center text-[0.72rem] leading-snug text-frio/70">
                Las promos vigentes se aplican al confirmar
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Un par de opciones excluyentes, con el mismo peso visual de los chips. */
function Alternativa({
  activo, onClick, children,
}: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-chip px-3 py-1.5 text-[0.85rem] font-semibold transition ${
        activo
          ? "bg-brasa text-sobre-brasa"
          : "bg-arena text-tinta-2 hover:bg-arena-2"
      }`}
    >
      {children}
    </button>
  );
}

function BotonCantidad({
  onClick, etiqueta, children,
}: { onClick: () => void; etiqueta: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="size-6 rounded-chip bg-arena text-[0.9rem] font-bold leading-none text-tinta-2 transition hover:bg-arena-2 active:scale-95"
    >
      {children}
    </button>
  );
}
