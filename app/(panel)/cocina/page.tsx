"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarPedidos, avanzarPedido, siguientePaso, minutosDesde, esUrgente,
  esRecienLlegado, nivelEspera, esperaLegible,
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
      <div className="grid gap-3 px-5 py-6 sm:grid-cols-2 lg:px-8 xl:grid-cols-4">
        {COLUMNAS.map((c) => (
          <div key={c.estado} className="h-64 animate-pulse rounded-tarjeta bg-arena-2/60" />
        ))}
      </div>
    );
  }

  // SOLO LO QUE SE VE (2026-08-21). `GET /pedidos` también devuelve estados
  // sin columna —hoy `esperando_pago`— y contarlos hacía que la cabecera
  // dijera "2 pedidos" cuando en pantalla había uno. Un número que no cuadra
  // con lo que se ve hace dudar de toda la pantalla.
  //
  // Esos pedidos van a tener su lugar cuando entre la columna de pagos por
  // confirmar (con la captura de Yape); hasta entonces no se cuentan.
  const visibles = pedidos.filter((p) => COLUMNAS.some((c) => c.estado === p.estado));
  // La columna más cargada define el 100% de las franjas: así se comparan
  // entre sí. Un ancho fijo por pedido daría barras llenas con 4 pedidos y
  // idénticas con 40.
  const pico = Math.max(1, ...COLUMNAS.map((c) => visibles.filter((p) => p.estado === c.estado).length));
  const enCurso = visibles.length;
  const demorados = visibles.filter(esUrgente).length;

  return (
    // El mismo respiro que el resto del panel (`px-5 py-6`, como Inicio y
    // Carta): esta pantalla no lo tenía y quedaba pegada al techo. SIN
    // `max-w-5xl` a propósito — las cuatro columnas necesitan todo el ancho
    // de la compu del mostrador.
    <div className="space-y-5 px-5 py-6 lg:px-8">
      {/* LA CABECERA DICE CÓMO VA EL TURNO (2026-08-21).
          Antes era un título chico y una línea de texto. En una pantalla que
          se mira de reojo todo el servicio, el número que importa —cuántos
          pedidos hay encima— tiene que leerse desde el otro lado del mostrador.
          Y si alguno se está pasando de tiempo, eso va acá arriba: es la única
          zona que el dueño mira siempre. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* El eyebrow del panel (Carta, Inicio y el resto lo usan), pero acá
              dice algo que CAMBIA: cuántos pedidos hay encima. En una pantalla
              que se mira todo el turno, esa línea es más útil que repetir una
              categoría fija. */}
          <p className="eyebrow">
            {enCurso === 0
              ? "Sin pedidos"
              : enCurso === 1
                ? "1 pedido en curso"
                : `${enCurso} pedidos en curso`}
          </p>
          <h1 className="mt-1 text-[1.8rem] font-bold leading-none text-tinta">Cocina</h1>
          <p className="mt-1.5 text-[0.92rem] text-frio">
            {enCurso === 0
              ? "Cuando entre un pedido, aparece acá."
              : demorados > 0
                ? `${demorados} ${demorados === 1 ? "pedido lleva" : "pedidos llevan"} más de 25 minutos esperando.`
                : "Todo saliendo a tiempo."}
          </p>
        </div>

        {/* `shrink-0`: sin esto "En vivo" se corta contra el borde cuando el
            texto de la izquierda crece. */}
        <div className="flex shrink-0 items-center gap-3 pt-0.5">
          {error && <p className="fila-entra text-[0.85rem] font-semibold text-alerta">{error}</p>}
          {/* Que la pantalla se actualiza sola no es obvio: sin esto, el dueño
              no sabe si está viendo algo de hace media hora. */}
          <span className="flex items-center gap-1.5 text-[0.76rem] text-frio">
            <span className="size-1.5 rounded-full bg-brasa respira-punto" aria-hidden />
            En vivo
          </span>
        </div>
      </div>

      {/* CUATRO COLUMNAS en pantalla grande, dos en tablet, una en el celular.
          En la compu del mostrador se ve todo el turno de un vistazo. */}
      {/* `items-start`: sin esto las cuatro columnas se estiran a la altura de
          la más cargada, y tres columnas vacías quedan como bloques enormes. */}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COLUMNAS.map((col) => {
          // LO QUE MÁS ESPERÓ, PRIMERO (2026-08-21). El backend devuelve por
          // `creadoEn` ascendente, así que dentro de una columna cargada el
          // pedido más viejo quedaba arriba y el nuevo abajo — bien. Pero al
          // pasar de 4 o 5 tarjetas la columna scrollea, y lo urgente tiene
          // que estar donde el ojo cae primero, no al fondo.
          const suyos = visibles
            .filter((p) => p.estado === col.estado)
            .sort((a, b) => new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime());
          const vacia = suyos.length === 0;
          return (
            <section
              key={col.estado}
              // Una columna VACÍA se apaga. Antes las cuatro pesaban igual
              // aunque tres estuvieran sin nada, y el ojo tenía que leer los
              // números para saber dónde estaba el trabajo.
              className={`overflow-hidden rounded-tarjeta transition-colors ${
                vacia ? "bg-arena/30" : "bg-arena/60"
              }`}
            >
              {/* La franja de carga: se pinta solo donde hay pedidos. */}
              <div className="h-1 bg-linea/40">
                {!vacia && (
                  <div
                    className="carga-columna h-full bg-brasa"
                    style={{ width: `${Math.round((suyos.length / pico) * 100)}%` }}
                    aria-hidden
                  />
                )}
              </div>

              <div className="p-3">
                <p
                  className={`mb-2 flex items-center gap-1.5 px-1 text-[0.78rem] font-bold uppercase tracking-wide ${
                    vacia ? "text-frio/60" : "text-tinta-2"
                  }`}
                >
                  <span aria-hidden>{col.emoji}</span>
                  {col.titulo}
                  <span
                    className={`ml-auto rounded-chip px-1.5 tabular-nums ${
                      vacia ? "text-frio/60" : "bg-brasa-suave text-brasa-texto"
                    }`}
                  >
                    {suyos.length}
                  </span>
                </p>

                <div className="max-h-[calc(100vh-15rem)] space-y-2 overflow-y-auto">
                  {vacia && (
                    <p className="px-1 py-6 text-center text-[0.8rem] text-frio/50">
                      {col.vacia}
                    </p>
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
  const nivel = nivelEspera(pedido);
  const urgente = nivel === "urgente";
  const nuevo = esRecienLlegado(pedido);

  return (
    <article
      className={`fila-entra rounded-tarjeta bg-carta p-3 shadow-[var(--sombra-tarjeta)] transition-shadow ${
        // El borde de lo urgente RESPIRA: uno fijo se vuelve invisible a los
        // veinte minutos mirando la misma pantalla. El escalón intermedio
        // (`atencion`) marca sin gritar: avisa que se viene, no que ya pasó.
        urgente
          ? "respira ring-2 ring-calor"
          : nivel === "atencion"
            ? "ring-1 ring-tibio"
            : "ring-1 ring-linea"
      } ${nuevo ? "recien-llegado" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          {pedido.modalidad === "delivery" ? "🛵 Delivery" : "🥡 Recojo"}
        </span>
        {/* El TIEMPO en grande: es el dato que decide a qué se atiende primero,
            y el que se lee desde lejos. Pasada la hora se escribe "11 h 47" —
            "707′" obliga a dividir mentalmente. */}
        <span
          className={`text-[0.95rem] font-bold tabular-nums ${
            urgente ? "text-calor-hondo" : nivel === "atencion" ? "text-tibio" : "text-tinta-2"
          }`}
          title={`Entró hace ${minutos} minutos`}
        >
          {esperaLegible(minutos)}
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
      {/* La REFERENCIA del cliente (2026-08-20): "casa del fondo", "portón
          verde". Se muestra aparte y no pegada a la dirección para que se lea
          como lo que es — una indicación de quien vive ahí, no parte del
          domicilio. */}
      {pedido.referencia && (
        <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-tinta-2">💬 {pedido.referencia}</p>
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
            // En una cocina se toca con las manos ocupadas y a veces mojadas:
            // el botón se estira a lo que sobra en vez de quedar chiquito.
            className="flex-1 rounded-chip bg-brasa px-3 py-2 text-[0.82rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.98] disabled:opacity-50"
          >
            {avanzando ? "…" : paso.etiqueta}
          </button>
        )}
      </div>
    </article>
  );
}
