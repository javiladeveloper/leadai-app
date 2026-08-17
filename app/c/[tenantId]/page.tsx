"use client";

import { useEffect, useMemo, useState } from "react";
import { use } from "react";

/**
 * LA CARTA PÚBLICA — el cliente arma su pedido y vuelve a WhatsApp.
 *
 * Es la única página del panel SIN sesión: quien la abre es un cliente del
 * restaurante, no un usuario nuestro. Llega acá desde un link que le mandó el
 * bot por WhatsApp.
 *
 * El circuito: arma el carrito → toca "Enviar mi pedido" → se abre WhatsApp
 * con un código → el bot lo resuelve y sigue el flujo normal (confirmar,
 * cobrar, cocina, moto).
 *
 * DISEÑO MOBILE PRIMERO: se abre desde un link de WhatsApp, en un teléfono, y
 * casi siempre con una mano. Por eso los controles son grandes y el carrito
 * vive en una barra fija abajo, al alcance del pulgar.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Opcion { id: string; nombre: string; precioCentavos: number }
interface Grupo {
  id: string; nombre: string; minSelec: number; maxSelec: number | null; opciones: Opcion[];
}
interface Producto {
  id: string; nombre: string; descripcion: string | null; precioCentavos: number;
  /** El precio ANTES, para el tachado. null = sin descuento. */
  precioAntesCentavos: number | null;
  categoriaId: string | null; fotoUrl: string | null; grupoIds: string[];
}

/** Dos o más platos a precio especial. El "antes" es la suma de sus platos. */
interface Combo {
  id: string; nombre: string; descripcion: string | null;
  precioCentavos: number; precioSueltoCentavos: number;
  fotoUrl: string | null;
  items: { nombre: string; cantidad: number }[];
}
interface Carta {
  negocio: {
    nombre: string; abierto: boolean; horaAbre: number | null; horaCierra: number | null;
    logoUrl: string | null; bannerUrl: string | null;
    direccion: string | null; entregaMinutos: number | null;
    /** A dónde llega el pedido. null = el negocio no conectó WhatsApp. */
    whatsapp: string | null;
  };
  categorias: { id: string; nombre: string }[];
  productos: Producto[];
  grupos: Grupo[];
  combos: Combo[];
  /** Ids de lo más vendido del último mes. Vacío mientras no haya ventas. */
  masPedidos?: string[];
}

/**
 * Una línea del carrito: un plato con sus extras, o un combo.
 *
 * Se distinguen por `combo`: un combo no lleva opciones (sus platos ya vienen
 * definidos) y viaja al backend por otro campo, porque se cobra a SU precio.
 */
interface LineaCarrito {
  producto: { id: string; nombre: string; precioCentavos: number };
  cantidad: number;
  opciones: Opcion[];
  combo?: boolean;
}

const soles = (centavos: number) => `S/${(centavos / 100).toFixed(2)}`;

/**
 * El % entre dos precios. Se CALCULA, no viaja guardado: así nunca queda
 * desfasado de los precios reales. null si no hay descuento de verdad, para
 * no mostrar "-0%".
 */
function descuentoPct(antes: number, ahora: number): number | null {
  if (antes <= ahora || antes <= 0) return null;
  const pct = Math.round(((antes - ahora) / antes) * 100);
  return pct > 0 ? pct : null;
}

export default function CartaPublica({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const [carta, setCarta] = useState<Carta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [eligiendo, setEligiendo] = useState<Producto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/c/${tenantId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("No encontramos esta carta");
        setCarta(await r.json());
      })
      .catch((e) => setError(e.message));
  }, [tenantId]);

  // El total se calcula acá SOLO PARA MOSTRAR. El que vale es el del backend:
  // cualquiera puede editar este JavaScript desde la consola, así que el
  // servidor recalcula todo al recibir el pedido.
  const total = useMemo(
    () => carrito.reduce((s, l) => {
      const extras = l.opciones.reduce((e, o) => e + o.precioCentavos, 0);
      return s + (l.producto.precioCentavos + extras) * l.cantidad;
    }, 0),
    [carrito],
  );

  const agregar = (linea: LineaCarrito) => setCarrito((c) => [...c, linea]);
  const agregarCombo = (k: Combo) =>
    setCarrito((c) => [...c, {
      producto: { id: k.id, nombre: k.nombre, precioCentavos: k.precioCentavos },
      cantidad: 1,
      opciones: [],
      combo: true,
    }]);
  const quitar = (i: number) => setCarrito((c) => c.filter((_, idx) => idx !== i));

  async function enviarPedido() {
    if (carrito.length === 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/c/${tenantId}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Solo QUÉ eligió: ids y cantidades. Los precios los pone el
          // backend desde su base. Los COMBOS van por su propio campo: se
          // cobran a su precio, no a la suma de sus platos.
          items: carrito.filter((l) => !l.combo).map((l) => ({
            productoId: l.producto.id,
            cantidad: l.cantidad,
            opcionIds: l.opciones.map((o) => o.id),
          })),
          combos: carrito.filter((l) => l.combo).map((l) => ({
            comboId: l.producto.id,
            cantidad: l.cantidad,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos enviar tu pedido");
        return;
      }
      setCodigo(data.codigo);
    } catch {
      setError("No pudimos conectar. Revisa tu internet.");
    } finally {
      setEnviando(false);
    }
  }

  if (error && !carta) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] items-center justify-center p-6">
        <p className="text-center text-tinta-2">{error}</p>
      </main>
    );
  }
  if (!carta) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[560px] items-center justify-center p-6">
        <p className="text-tinta-2">Cargando la carta…</p>
      </main>
    );
  }

  // Pedido enviado: se le muestra el código y el botón para volver al chat.
  if (codigo) return <PedidoListo codigo={codigo} total={total} whatsapp={carta.negocio.whatsapp} />;

  const porCategoria = carta.categorias
    .map((c) => ({ ...c, productos: carta.productos.filter((p) => p.categoriaId === c.id) }))
    .filter((c) => c.productos.length > 0);
  const sueltos = carta.productos.filter((p) => !p.categoriaId);
  // Los ids del ranking, resueltos a productos y en su orden de venta.
  const destacados = (carta.masPedidos ?? [])
    .map((id) => carta.productos.find((p) => p.id === id))
    .filter((p): p is Producto => p != null);

  return (
    <main className="mx-auto min-h-dvh max-w-[900px] bg-arena pb-32">
      <Cabecera negocio={carta.negocio} />
      <BarraSecciones
        secciones={[
          ...(destacados.length > 0 ? [{ id: "destacados", nombre: "Lo más pedido" }] : []),
          ...(carta.combos.length > 0 ? [{ id: "combos", nombre: "Combos" }] : []),
          ...porCategoria.map((c) => ({ id: c.id, nombre: c.nombre })),
        ]}
      />

      <div className="space-y-7 px-4 pt-5">
        {/* LO MÁS PEDIDO, cuando hay ventas suficientes. Mientras no las haya
            la carta arranca en los combos, que es lo que más conviene vender. */}
        <FilaDestacados
          titulo="Lo más pedido"
          productos={destacados}
          grupos={carta.grupos}
          onElegir={(p) => setEligiendo(p)}
          onAgregarDirecto={(p) => agregar({ producto: p, cantidad: 1, opciones: [] })}
        />

        {/* LOS COMBOS VAN PRIMERO (2026-08-17): es lo que más conviene vender
            y lo que el cliente compara antes de armar su pedido suelto. */}
        {carta.combos.length > 0 && (
          <section id="sec-combos" className="scroll-mt-16">
            <h2 className="eyebrow mb-2.5 flex items-center gap-2">
              <span className="h-3.5 w-1 rounded-full bg-orbita" aria-hidden />
              Combos
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {carta.combos.map((c) => (
                <TarjetaCombo
                  key={c.id}
                  combo={c}
                  onAgregar={() => agregarCombo(c)}
                />
              ))}
            </div>
          </section>
        )}
        {porCategoria.map((cat) => (
          <section key={cat.id} id={`sec-${cat.id}`} className="scroll-mt-16">
            <h2 className="eyebrow mb-2.5 flex items-center gap-2">
              <span className="h-3.5 w-1 rounded-full bg-orbita" aria-hidden />
              {cat.nombre}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {cat.productos.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  grupos={carta.grupos}
                  onElegir={() => setEligiendo(p)}
                  onAgregarDirecto={() => agregar({ producto: p, cantidad: 1, opciones: [] })}
                />
              ))}
            </div>
          </section>
        ))}
        {sueltos.length > 0 && (
          <section>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {sueltos.map((p) => (
                <TarjetaProducto
                  key={p.id}
                  producto={p}
                  grupos={carta.grupos}
                  onElegir={() => setEligiendo(p)}
                  onAgregarDirecto={() => agregar({ producto: p, cantidad: 1, opciones: [] })}
                />
              ))}
            </div>
          </section>
        )}
        {carta.productos.length === 0 && (
          <p className="py-12 text-center text-tinta-2">
            Este negocio todavía no cargó su carta.
          </p>
        )}
      </div>

      {eligiendo && (
        <HojaOpciones
          producto={eligiendo}
          grupos={carta.grupos.filter((g) => eligiendo.grupoIds.includes(g.id))}
          onCancelar={() => setEligiendo(null)}
          onAgregar={(opciones, cantidad) => {
            agregar({ producto: eligiendo, cantidad, opciones });
            setEligiendo(null);
          }}
        />
      )}

      {carrito.length > 0 && (
        <BarraCarrito
          carrito={carrito}
          total={total}
          abierto={carta.negocio.abierto}
          enviando={enviando}
          error={error}
          onQuitar={quitar}
          onEnviar={enviarPedido}
        />
      )}
    </main>
  );
}

/**
 * La cabecera de la carta: banner, logo y los datos del negocio.
 *
 * Sin esto el link abre una lista de platos sin cara y no parece del
 * restaurante. El logo montado sobre el banner es el patrón que usan todas
 * las cartas que funcionan — el cliente reconoce el lugar antes de leer nada.
 */
function Cabecera({ negocio }: { negocio: Carta["negocio"] }) {
  return (
    <header>
      {/* El banner. Sin uno cargado va una franja del verde de marca: mejor un
          bloque de color deliberado que un hueco. */}
      <div className="relative h-36 w-full overflow-hidden bg-superficie-honda sm:h-44">
        {negocio.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={negocio.bannerUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="relative px-5 pb-4">
        {/* El logo monta sobre el banner (margen negativo), como en las cartas
            que la gente ya sabe usar. */}
        <div className="-mt-10 mb-3">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-carta shadow-[var(--sombra-tarjeta)] ring-2 ring-carta">
            {negocio.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={negocio.logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              // Sin logo: la inicial del negocio. Un cuadro vacío se ve roto.
              <span className="text-[2rem] font-bold text-orbita">
                {negocio.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-[1.5rem] font-bold leading-tight text-tinta">{negocio.nombre}</h1>
          {/* Abierto/cerrado como chip y no como texto suelto: es el dato que
              decide si el cliente sigue o se va. */}
          <span
            className={`rounded-chip px-2.5 py-1 text-[0.75rem] font-bold ${
              negocio.abierto ? "bg-brasa/15 text-brasa-texto" : "bg-alerta/12 text-alerta"
            }`}
          >
            {negocio.abierto ? "● Abierto" : "● Cerrado"}
            {!negocio.abierto && negocio.horaAbre != null && ` · abre ${negocio.horaAbre}:00`}
          </span>
        </div>

        <div className="mt-2 space-y-1 text-[0.85rem] text-tinta-2">
          {negocio.direccion && <p>📍 {negocio.direccion}</p>}
          {/* EL HORARIO se muestra SIEMPRE, no solo cuando está cerrado
              (2026-08-17): el cliente que entra a las 11 de la noche necesita
              saber a qué hora volver, y el que entra al mediodía necesita
              saber hasta cuándo puede pedir. */}
          {negocio.horaAbre != null && negocio.horaCierra != null && (
            <p>
              🕐 Atendemos de <b>{negocio.horaAbre}:00</b> a{" "}
              <b>{negocio.horaCierra}:00</b>
            </p>
          )}
          {negocio.entregaMinutos && (
            <p>
              🛵 Entrega{" "}
              <b>
                {negocio.entregaMinutos}–{negocio.entregaMinutos + 10} min
              </b>
            </p>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * La barra de secciones, pegada arriba al scrollear.
 *
 * Con 20 platos en cinco secciones, scrollear hasta el postre es donde el
 * cliente se cansa. Se queda fija porque su valor es justamente estar ahí
 * cuando ya bajaste.
 */
function BarraSecciones({ secciones }: { secciones: { id: string; nombre: string }[] }) {
  if (secciones.length < 2) return null;
  return (
    <nav className="sticky top-0 z-20 border-b border-linea bg-carta/95 backdrop-blur">
      <div className="flex gap-1 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]">
        {secciones.map((s) => (
          <a
            key={s.id}
            href={`#sec-${s.id}`}
            className="shrink-0 whitespace-nowrap rounded-chip px-3 py-1.5 text-[0.85rem] font-semibold text-tinta-2 transition hover:bg-arena hover:text-tinta"
          >
            {s.nombre}
          </a>
        ))}
      </div>
    </nav>
  );
}

/**
 * LO MÁS PEDIDO, en fila horizontal con foto grande.
 *
 * Va arriba de todo porque es lo que hace que un cliente nuevo elija rápido en
 * vez de leer veinte platos. Formato distinto al de la lista —foto cuadrada
 * grande, sin descripción— justamente para que no se confunda con el resto: es
 * una vidriera, no un catálogo.
 *
 * Se desliza en horizontal en vez de envolver: ocupa una franja fija y no
 * empuja la carta hacia abajo.
 */
function FilaDestacados({
  titulo, productos, onElegir, onAgregarDirecto, grupos,
}: {
  titulo: string;
  productos: Producto[];
  grupos: Grupo[];
  onElegir: (p: Producto) => void;
  onAgregarDirecto: (p: Producto) => void;
}) {
  if (productos.length === 0) return null;
  return (
    <section id="sec-destacados" className="scroll-mt-16">
      <h2 className="eyebrow mb-2.5 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-orbita" aria-hidden />
        {titulo}
      </h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {productos.map((p) => {
          const pct = p.precioAntesCentavos
            ? descuentoPct(p.precioAntesCentavos, p.precioCentavos)
            : null;
          const tieneOpciones = p.grupoIds.some((id) => grupos.some((g) => g.id === id));
          return (
            <button
              key={p.id}
              onClick={() => (tieneOpciones ? onElegir(p) : onAgregarDirecto(p))}
              className="entra group w-36 shrink-0 text-left"
            >
              <div className="relative">
                {p.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.fotoUrl}
                    alt=""
                    className="h-36 w-36 rounded-xl object-cover ring-1 ring-linea"
                  />
                ) : (
                  <div className="grid h-36 w-36 place-items-center rounded-xl bg-carta ring-1 ring-linea">
                    <span className="text-[2rem]">🍽️</span>
                  </div>
                )}
                {/* El "+" arriba a la derecha, como en las cartas que la gente
                    ya sabe usar. */}
                <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-carta/95 text-[1.05rem] font-bold text-brasa-texto shadow-[0_2px_8px_rgba(0,0,0,0.15)] backdrop-blur transition group-hover:bg-brasa group-hover:text-sobre-brasa">
                  +
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-bold text-calor">{soles(p.precioCentavos)}</span>
                {pct && (
                  <span className="rounded-chip bg-orbita px-1.5 py-0.5 text-[0.68rem] font-bold text-sobre-orbita">
                    −{pct}%
                  </span>
                )}
              </div>
              {pct && p.precioAntesCentavos && (
                <p className="text-[0.75rem] text-frio line-through">
                  {soles(p.precioAntesCentavos)}
                </p>
              )}
              <p className="mt-0.5 line-clamp-2 text-[0.85rem] font-medium leading-snug text-tinta">
                {p.nombre}
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TarjetaProducto({
  producto, grupos, onElegir, onAgregarDirecto,
}: {
  producto: Producto;
  grupos: Grupo[];
  onElegir: () => void;
  onAgregarDirecto: () => void;
}) {
  // Un plato SIN extras se agrega de un toque; con extras abre la hoja. Pedir
  // dos toques para una gaseosa es fricción que no compra nada.
  const tieneOpciones = producto.grupoIds.some((id) => grupos.some((g) => g.id === id));

  return (
    <button
      onClick={tieneOpciones ? onElegir : onAgregarDirecto}
      className="entra group flex w-full items-start gap-3 rounded-tarjeta bg-carta p-4 text-left ring-1 ring-linea transition hover:ring-brasa/40 active:scale-[0.99]"
    >
      {producto.fotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={producto.fotoUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-linea"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-tinta">{producto.nombre}</p>
        {/* `whitespace-pre-line`: el dueño lista los ingredientes uno por
            renglón y HTML colapsa los saltos — "Pan artesanal Lechuga Cremas"
            en una sola línea ilegible (2026-08-17). */}
        {producto.descripcion && (
          <p className="mt-0.5 whitespace-pre-line text-[0.85rem] leading-snug text-tinta-2">
            {producto.descripcion}
          </p>
        )}
        {/* El tachado y el % (2026-08-17): el cliente ve el ahorro en vez de
            tener que creerlo. */}
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-calor">{soles(producto.precioCentavos)}</span>
          {producto.precioAntesCentavos && descuentoPct(producto.precioAntesCentavos, producto.precioCentavos) && (
            <>
              <span className="text-[0.82rem] text-frio line-through">
                {soles(producto.precioAntesCentavos)}
              </span>
              <span className="rounded-chip bg-orbita px-2 py-0.5 text-[0.72rem] font-bold text-sobre-orbita">
                −{descuentoPct(producto.precioAntesCentavos, producto.precioCentavos)}%
              </span>
            </>
          )}
        </div>
      </div>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brasa/12 text-[1.15rem] font-bold text-brasa-texto ring-1 ring-brasa/25 transition group-hover:bg-brasa group-hover:text-sobre-brasa group-hover:ring-brasa">
        +
      </span>
    </button>
  );
}

/**
 * La hoja de extras de un plato.
 *
 * Acá está la ventaja de la web sobre el chat: ocho opciones son ocho
 * checkboxes que se ven de un vistazo, en vez de ocho mensajes.
 */
function HojaOpciones({
  producto, grupos, onCancelar, onAgregar,
}: {
  producto: Producto;
  grupos: Grupo[];
  onCancelar: () => void;
  onAgregar: (opciones: Opcion[], cantidad: number) => void;
}) {
  const [elegidas, setElegidas] = useState<Opcion[]>([]);
  const [cantidad, setCantidad] = useState(1);

  const alternar = (grupo: Grupo, op: Opcion) => {
    setElegidas((prev) => {
      const yaEsta = prev.some((o) => o.id === op.id);
      if (yaEsta) return prev.filter((o) => o.id !== op.id);
      // Un grupo de UNA sola opción (el término de la carne) reemplaza en vez
      // de acumular: sin esto el cliente termina con "medio" Y "jugoso".
      if (grupo.maxSelec === 1) {
        const otrasDelGrupo = grupo.opciones.map((o) => o.id);
        return [...prev.filter((o) => !otrasDelGrupo.includes(o.id)), op];
      }
      return [...prev, op];
    });
  };

  const faltanObligatorios = grupos.filter(
    (g) => g.minSelec > 0 && !g.opciones.some((o) => elegidas.some((e) => e.id === o.id)),
  );
  const extras = elegidas.reduce((s, o) => s + o.precioCentavos, 0);

  return (
    <div className="aparece fixed inset-0 z-20 flex items-end bg-tinta/40" onClick={onCancelar}>
      <div
        className="sube max-h-[85dvh] w-full overflow-y-auto rounded-t-[1.5rem] bg-carta p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[1.2rem] font-bold text-tinta">{producto.nombre}</h3>
        <p className="mt-0.5 text-tinta-2">{soles(producto.precioCentavos)}</p>

        <div className="mt-5 space-y-5">
          {grupos.map((g) => (
            <div key={g.id}>
              <div className="flex items-baseline justify-between">
                <h4 className="font-semibold text-tinta">{g.nombre}</h4>
                {g.minSelec > 0 && (
                  <span className="text-[0.78rem] font-semibold text-calor">Obligatorio</span>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {g.opciones.map((o) => {
                  const marcada = elegidas.some((e) => e.id === o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => alternar(g, o)}
                      className={`flex w-full items-center justify-between rounded-tarjeta px-4 py-3 text-left ring-1 transition ${
                        marcada ? "bg-brasa-suave ring-brasa" : "bg-arena ring-linea"
                      }`}
                    >
                      <span className="text-tinta">{o.nombre}</span>
                      <span className="text-[0.9rem] font-semibold text-tinta-2">
                        {o.precioCentavos > 0 ? `+${soles(o.precioCentavos)}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center gap-3 rounded-chip bg-arena px-2 py-1 ring-1 ring-linea">
            <button
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="grid h-9 w-9 place-items-center text-[1.3rem] text-tinta"
              aria-label="Quitar uno"
            >
              −
            </button>
            <span className="w-6 text-center font-bold tabular-nums text-tinta">{cantidad}</span>
            <button
              onClick={() => setCantidad((c) => Math.min(50, c + 1))}
              className="grid h-9 w-9 place-items-center text-[1.3rem] text-tinta"
              aria-label="Agregar uno"
            >
              +
            </button>
          </div>
          <button
            onClick={() => onAgregar(elegidas, cantidad)}
            disabled={faltanObligatorios.length > 0}
            className="flex-1 rounded-tarjeta bg-brasa py-3.5 font-bold text-sobre-brasa transition disabled:opacity-40"
          >
            {faltanObligatorios.length > 0
              // Se dice QUÉ falta, no solo se deshabilita: un botón gris sin
              // explicación deja al cliente tocándolo sin entender.
              ? `Elige ${faltanObligatorios[0].nombre.toLowerCase()}`
              : `Agregar · ${soles((producto.precioCentavos + extras) * cantidad)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BarraCarrito({
  carrito, total, abierto, enviando, error, onQuitar, onEnviar,
}: {
  carrito: LineaCarrito[];
  total: number;
  abierto: boolean;
  enviando: boolean;
  error: string | null;
  onQuitar: (i: number) => void;
  onEnviar: () => void;
}) {
  const [abiertoDetalle, setAbiertoDetalle] = useState(false);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);

  // El botón LATE cuando entra algo al carrito. Es el único aviso de que el
  // toque funcionó: sin esto el cliente toca de nuevo y pide el doble.
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (unidades === 0) return;
    setLate(true);
    const t = setTimeout(() => setLate(false), 320);
    return () => clearTimeout(t);
  }, [unidades]);

  return (
    <div className="sube fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[900px] bg-carta px-5 pb-5 pt-3 shadow-[0_-4px_24px_rgba(15,20,18,0.08)]">
      {abiertoDetalle && (
        <div className="mb-3 max-h-[40dvh] space-y-2 overflow-y-auto">
          {carrito.map((l, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.95rem] text-tinta">
                  {l.cantidad}× {l.producto.nombre}
                </p>
                {l.opciones.length > 0 && (
                  <p className="text-[0.8rem] text-tinta-2">
                    {l.opciones.map((o) => o.nombre).join(", ")}
                  </p>
                )}
              </div>
              <button
                onClick={() => onQuitar(i)}
                className="shrink-0 text-[0.85rem] font-semibold text-calor"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-[0.85rem] font-semibold text-alerta">{error}</p>}

      <button
        onClick={() => setAbiertoDetalle((v) => !v)}
        className="mb-2 w-full text-left text-[0.85rem] text-tinta-2"
      >
        {unidades} {unidades === 1 ? "producto" : "productos"} · {abiertoDetalle ? "ocultar" : "ver detalle"}
      </button>

      <button
        onClick={onEnviar}
        disabled={!abierto || enviando}
        className={`w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-40 ${late ? "late" : ""}`}
      >
        {!abierto
          ? "Cerrado por ahora"
          : enviando
            ? "Enviando…"
            : `Enviar mi pedido · ${soles(total)}`}
      </button>
    </div>
  );
}

/**
 * El paso final: el código y el botón que devuelve a WhatsApp.
 *
 * El código se muestra GRANDE aunque el botón lo lleve solo: si el link no
 * abre (WhatsApp sin instalar, navegador raro), el cliente puede escribirlo a
 * mano y el pedido no se pierde.
 */
function PedidoListo({ codigo, total, whatsapp }: { codigo: string; total: number; whatsapp: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-5 bg-arena p-6 text-center">
      <div className="text-[3rem]">🧾</div>
      <h1 className="text-[1.5rem] font-bold text-tinta">Tu pedido está listo</h1>
      <p className="text-tinta-2">
        Mándanos este código por WhatsApp y te confirmamos al toque.
      </p>

      <p className="rounded-tarjeta bg-carta px-8 py-5 text-[2.2rem] font-bold tracking-widest text-brasa-texto ring-1 ring-linea">
        #{codigo}
      </p>
      <p className="text-[0.9rem] text-tinta-2">Total: {soles(total)}</p>

      {/* CON el número del restaurante (2026-08-17): antes era `wa.me/` a
          secas y abría WhatsApp sin destinatario, así que el cliente tenía que
          buscar el contacto a mano — justo después de armar todo su pedido. */}
      <a
        href={`https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(`Hola! Mi pedido es el #${codigo}`)}`}
        className="mt-2 w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa"
      >
        Enviar por WhatsApp
      </a>
    </main>
  );
}

/**
 * Un combo en la carta pública.
 *
 * Muestra el precio del combo, lo que costaría suelto tachado y el % que
 * ahorra. Ese porcentaje es el argumento de venta: sin él el cliente no sabe
 * si le conviene y pide los platos por separado.
 */
function TarjetaCombo({ combo, onAgregar }: { combo: Combo; onAgregar: () => void }) {
  const pct = descuentoPct(combo.precioSueltoCentavos, combo.precioCentavos);
  return (
    <button
      onClick={onAgregar}
      className="entra group flex w-full items-start gap-3 rounded-tarjeta bg-carta p-4 text-left ring-1 ring-orbita/30 transition hover:ring-orbita/60 active:scale-[0.99]"
    >
      {combo.fotoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={combo.fotoUrl} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-linea" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug text-tinta">{combo.nombre}</p>
        <p className="mt-0.5 text-[0.82rem] leading-snug text-tinta-2">
          {combo.items.map((i) => `${i.cantidad > 1 ? `${i.cantidad} ` : ""}${i.nombre}`).join(" + ")}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-bold text-calor">{soles(combo.precioCentavos)}</span>
          {pct && (
            <>
              <span className="text-[0.82rem] text-frio line-through">
                {soles(combo.precioSueltoCentavos)}
              </span>
              <span className="rounded-chip bg-orbita px-2 py-0.5 text-[0.72rem] font-bold text-sobre-orbita">
                −{pct}%
              </span>
            </>
          )}
        </div>
      </div>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brasa/12 text-[1.15rem] font-bold text-brasa-texto ring-1 ring-brasa/25 transition group-hover:bg-brasa group-hover:text-sobre-brasa group-hover:ring-brasa">
        +
      </span>
    </button>
  );
}
