"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { obtenerCarta, type Carta, type ProductoCarta, type ComboCarta } from "@/lib/carta";
import {
  crearPedidoLocal, cotizarPedidoLocal, obtenerSalas, promosVigentes,
  type ItemNuevoPedido, type SalaConfigurada,
} from "@/lib/cocina";
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
  /** `productoId`/`comboId` para los de la carta; sintético para los libres. */
  clave: string;
  productoId?: string;
  comboId?: string;
  nombre: string;
  precioCentavos: number;
  cantidad: number;
}

/** La sección reservada de combos: no es una categoría real de la carta. */
const SECCION_COMBOS = "__combos";

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
    void obtenerSalas().then((s) => {
      setSalas(s);
      // LA PRIMERA MESA VIENE MARCADA (2026-08-22, Jonathan: "podríamos dejar
      // salón 1 por defecto"). Un pedido de mesa SIEMPRE tiene mesa, así que
      // arrancar sin ninguna obliga a un toque que casi nunca se quiere
      // saltear — y si se lo saltean, el pedido entra como mostrador y el
      // plato no sabe a dónde va.
      //
      // Solo con UNA sala: con dos, elegir por el mozo es adivinar entre
      // "Salón 1" y "Terraza T1", que son mesas distintas del local.
      if (s.length === 1 && s[0].mesas.length) setMesa(s[0].mesas[0]);
    });
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
  const combos = useMemo(
    () => (carta?.combos ?? []).filter((c) => c.disponible),
    [carta],
  );

  /**
   * LAS PROMOS QUE CORREN AHORA (2026-08-22).
   *
   * El mozo tiene que saberlas para venderlas: "hoy la 2ª tabla va a mitad de
   * precio" es lo que hace que la mesa pida dos. El descuento lo aplica el
   * servidor igual, pero enterarse DESPUÉS no vende nada.
   */
  const promos = useMemo(
    () => promosVigentes(carta?.descuentos ?? []),
    [carta],
  );

  /**
   * LAS SECCIONES DE LA CARTA, en el orden que el dueño les dio.
   *
   * Antes esto era una lista plana de todos los platos: en una carta de 40
   * ítems había que scrollear hasta encontrar el que el cliente dictó. Las
   * secciones son las que el dueño ya definió — la misma división que ve el
   * cliente en la carta web.
   *
   * Los COMBOS van primero y en su propia sección: son lo que más deja y lo
   * que el mozo tiene que ofrecer antes que un plato suelto.
   */
  const secciones = useMemo(() => {
    const cats = [...(carta?.categorias ?? [])].sort((a, b) => a.orden - b.orden);
    const lista: { id: string; nombre: string }[] = [];
    if (combos.length) lista.push({ id: SECCION_COMBOS, nombre: "Combos" });
    for (const c of cats) {
      if (disponibles.some((p) => p.categoriaId === c.id)) lista.push({ id: c.id, nombre: c.nombre });
    }
    // Los platos sin sección existen y hay que poder pedirlos.
    if (disponibles.some((p) => !p.categoriaId)) lista.push({ id: "", nombre: "Otros" });
    return lista;
  }, [carta, combos, disponibles]);

  const [seccion, setSeccion] = useState<string | null>(null);
  const seccionActiva = seccion ?? secciones[0]?.id ?? null;

  const q = busqueda.trim().toLowerCase();

  /** Buscar manda sobre la sección: quien escribe ya sabe qué quiere. */
  const combosVisibles = useMemo(() => {
    if (q) return combos.filter((c) => c.nombre.toLowerCase().includes(q));
    return seccionActiva === SECCION_COMBOS ? combos : [];
  }, [combos, q, seccionActiva]);

  const platosVisibles = useMemo(() => {
    if (q) {
      // También por alias: "un mostro" encuentra el pollo a la brasa, igual
      // que en el bot. El mozo escribe como habla el cliente.
      return disponibles.filter(
        (p) =>
          p.nombre.toLowerCase().includes(q) ||
          p.alias.some((a) => a.toLowerCase().includes(q)),
      );
    }
    if (seccionActiva === SECCION_COMBOS) return [];
    return disponibles
      .filter((p) => (p.categoriaId ?? "") === (seccionActiva ?? ""))
      .sort((a, b) => a.orden - b.orden);
  }, [disponibles, q, seccionActiva]);

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

  const agregarCombo = useCallback((c: ComboCarta) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.comboId === c.id);
      if (i >= 0) {
        const copia = [...ls];
        copia[i] = { ...copia[i], cantidad: copia[i].cantidad + 1 };
        return copia;
      }
      return [...ls, {
        clave: c.id, comboId: c.id, nombre: c.nombre,
        precioCentavos: c.precioCentavos, cantidad: 1,
      }];
    });
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

  /**
   * EL TOTAL CON PROMOS (2026-08-22, reporte de Jonathan: "no está agarrando
   * el descuento").
   *
   * `totalLocal` es la suma a secas — instantánea, para que el número no
   * parpadee mientras se arma el pedido. `totalReal` viene del servidor con
   * las promos aplicadas, y lo reemplaza en cuanto llega.
   *
   * Si el servidor no responde se muestra el local: aproximado, pero mejor
   * que un guion mientras el mozo tiene al cliente enfrente.
   */
  const totalLocal = lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
  const [totalReal, setTotalReal] = useState<number | null>(null);
  const total = totalReal ?? totalLocal;

  useEffect(() => {
    if (!lineas.length) { setTotalReal(null); return; }
    // Medio segundo de espera: tocar cinco platos seguidos manda UNA
    // cotización, no cinco.
    const id = setTimeout(async () => {
      const r = await cotizarPedidoLocal({
        modalidad,
        items: lineas.map((l) => ({
          productoId: l.productoId, comboId: l.comboId, cantidad: l.cantidad,
        })),
      });
      setTotalReal(r?.totalCentavos ?? null);
    }, 500);
    return () => clearTimeout(id);
  }, [lineas, modalidad]);

  /** ¿La promo bajó el total? Es lo que hay que MOSTRAR, no esconder. */
  const ahorro = totalReal !== null && totalReal < totalLocal ? totalLocal - totalReal : 0;

  async function confirmar() {
    if (!lineas.length || guardando) return;
    setGuardando(true);
    setError("");
    const items: ItemNuevoPedido[] = lineas.map((l) => ({
      productoId: l.productoId,
      comboId: l.comboId,
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
        // Alto FIJO, no `max-h`: con tres platos el diálogo se encogía y la
        // comanda quedaba flotando en un panel casi vacío. Una ventana que
        // cambia de tamaño según la sección se siente rota.
        className="surge flex h-[80vh] max-h-[46rem] w-full max-w-3xl flex-col rounded-tarjeta bg-carta shadow-[0_8px_24px_rgba(51,40,31,0.2)] ring-1 ring-linea"
      >
        {/* Encabezado */}
        <div className="shrink-0 border-b border-linea p-5 pb-4">
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

          </div>

          {/* LAS MESAS, A LA VISTA (2026-08-22, pedido de Jonathan: "¿dónde
              están las salas?"). Antes era un `<select>` chico: el mozo tenía
              que abrirlo y buscar dentro, cuando la mesa es lo PRIMERO que
              sabe —está parado en ella.

              Como chips se ven todas de un vistazo y se elige de un toque, que
              es lo que se hace mil veces por turno. Con más de una sala se
              agrupan, porque la mesa 1 del Salón y la de la Terraza son
              distintas. */}
          {modalidad === "local" && salas.length > 0 && (
            <div className="mt-3 space-y-2">
              {salas.map((s) => (
                <div key={s.sala}>
                  {salas.length > 1 && (
                    <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                      {s.sala}
                    </p>
                  )}
                  <div className="sin-barra flex gap-1.5 overflow-x-auto">
                    {s.mesas.map((m) => (
                      <button
                        key={`${s.sala}-${m}`}
                        type="button"
                        onClick={() => setMesa(mesa === m ? "" : m)}
                        className={`size-9 shrink-0 rounded-chip text-[0.85rem] font-bold tabular-nums transition ${
                          mesa === m
                            ? "bg-brasa text-sobre-brasa"
                            : "bg-arena text-tinta-2 hover:bg-arena-2"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {/* Sin mesa es un pedido de mostrador: se dice, en vez de dejar
                  al mozo dudando si se olvidó de tocar algo. Tocar la mesa ya
                  marcada la desmarca, que es cómo se pide para llevar desde
                  la barra. */}
              <p className="text-[0.76rem] text-frio">
                {mesa ? `Va a la mesa ${mesa}` : "Sin mesa: va como mostrador"}
              </p>
            </div>
          )}
        </div>

        {/* Cuerpo: carta a la izquierda, comanda a la derecha. */}
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden rounded-b-tarjeta sm:grid-cols-[minmax(0,1fr)_18rem]">
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

            {/* LAS PROMOS DEL DÍA, arriba de todo. El mozo tiene que saberlas
                para VENDERLAS: "hoy la 2ª va a mitad de precio" es lo que hace
                que la mesa pida dos. El descuento lo aplica el servidor igual,
                pero enterarse después no vende nada.

                Si no hay ninguna no se dibuja NADA: una franja que diga "sin
                promos hoy" ocupa lugar para no decir nada. */}
            {promos.length > 0 && !q && (
              <div className="sin-barra flex gap-1.5 overflow-x-auto px-4 pb-2">
                {promos.map((pr) => (
                  <span
                    key={pr.id}
                    className="shrink-0 rounded-chip bg-calor-suave px-2.5 py-1 text-[0.76rem] text-calor-hondo"
                    title={pr.nombre}
                  >
                    🎉 <b>{pr.nombre}</b> · {pr.detalle}
                  </span>
                ))}
              </div>
            )}

            {/* LAS SECCIONES de la carta, las mismas que ve el cliente. Antes
                esto era una lista plana de 40 platos y había que scrollear
                hasta encontrar el que el cliente dictó. */}
            {secciones.length > 1 && !q && (
              // ENVUELVE en vez de scrollear (2026-08-22, reporte de Jonathan:
              // "no puedo ver más allá de Rolls fritos"). La barra scrolleaba
              // pero sin barra visible ni arrastre, así que las secciones de
              // la derecha eran inalcanzables — el mismo problema que ya tuvo
              // la barra de promos en el celular.
              //
              // Con siete secciones entran en dos filas y se ven TODAS de un
              // vistazo, que es lo que un mozo con prisa necesita. Scrollear
              // horizontal es peor: obliga a descubrir que hay más.
              <div className="flex flex-wrap gap-1.5 border-b border-linea px-4 pb-2.5">
                {secciones.map((s) => (
                  <button
                    key={s.id || "otros"}
                    type="button"
                    onClick={() => setSeccion(s.id)}
                    className={`rounded-chip px-3 py-1 text-[0.82rem] font-semibold transition ${
                      seccionActiva === s.id
                        ? "bg-brasa text-sobre-brasa"
                        : "bg-arena text-tinta-2 hover:bg-arena-2"
                    }`}
                  >
                    {s.id === SECCION_COMBOS ? `🍱 ${s.nombre}` : s.nombre}
                  </button>
                ))}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
              {carta === null && (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-11 animate-pulse rounded-tarjeta bg-arena-2/60" />
                  ))}
                </div>
              )}
              {carta !== null && !combosVisibles.length && !platosVisibles.length && (
                <p className="px-1 py-8 text-center text-[0.85rem] text-frio">
                  {q ? "Nada con ese nombre." : "Todavía no cargaste la carta."}
                </p>
              )}

              <div className="space-y-1.5">
                {/* Los COMBOS se ven distintos: valen menos que la suma de sus
                    platos, y esa es la razón para ofrecerlos primero. */}
                {combosVisibles.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => agregarCombo(c)}
                    className="fila-entra flex w-full items-center gap-3 rounded-tarjeta bg-brasa-suave/60 px-3 py-2 text-left ring-1 ring-brasa/20 transition hover:bg-brasa-suave active:scale-[0.99]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9rem] font-semibold text-tinta">
                        🍱 {c.nombre}
                      </span>
                      {c.descripcion && (
                        <span className="block truncate text-[0.76rem] text-frio">
                          {c.descripcion}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[0.85rem] font-bold tabular-nums text-brasa-texto">
                      {soles(c.precioCentavos)}
                    </span>
                  </button>
                ))}

                {platosVisibles.map((p) => (
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
              {/* EL AHORRO, VISIBLE. Un total más bajo que la suma de las
                  líneas —aunque sea a favor— huele a error si no se explica.
                  Y es lo que el mozo le dice al cliente para que pida más. */}
              {ahorro > 0 && (
                <div className="fila-entra mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-[0.78rem] text-calor-hondo">🎉 Promo aplicada</span>
                  <span className="text-[0.82rem] font-bold tabular-nums text-calor-hondo">
                    −{soles(ahorro)}
                  </span>
                </div>
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
