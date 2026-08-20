"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { volarAlCarrito } from "@/lib/vuelo-carrito";
import { usarNumeroAnimado } from "@/lib/usar-numero-animado";
import { IconoWhatsApp, IconoInstagram, IconoMessenger, IconoTikTok } from "@/components/Iconos";
import { use } from "react";

/**
 * LA CARTA PÚBLICA — el cliente arma su pedido y vuelve a WhatsApp.
 *
 * Es la única página del panel SIN sesión: quien la abre es un cliente del
 * restaurante, no un usuario nuestro. Llega acá desde un link que le mandó el
 * bot por WhatsApp.
 *
 * El circuito (2026-08-20): arma el carrito → "Ver mi pedido" muestra la
 * COTIZACIÓN del backend (promos y total real) → confirma → si el link traía
 * el ref del bot, el pedido aparece DIRECTO en su chat; si no (link frío),
 * queda la card con el código de siempre. El bot sigue el flujo normal
 * (cobrar, cocina, moto).
 *
 * DISEÑO MOBILE PRIMERO: se abre desde un link de WhatsApp, en un teléfono, y
 * casi siempre con una mano. Por eso los controles son grandes y el carrito
 * vive en una barra fija abajo, al alcance del pulgar.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

interface Opcion {
  id: string; nombre: string; precioCentavos: number; fotoUrl: string | null;
  /** La sección de la carta a la que pertenece. `null` = un extra suelto. */
  seccion?: string | null;
}
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
    /** Pedido mínimo para delivery, en céntimos. 0 = sin mínimo. */
    minimoDeliveryCentavos?: number;
    logoUrl: string | null; bannerUrl: string | null;
    direccion: string | null; entregaMinutos: number | null;
    /** A dónde llega el pedido. null = el negocio no conectó WhatsApp. */
    whatsapp: string | null;
    /** 'claro' | 'oscuro'. Lo elige el dueño; por defecto claro. */
    tema?: string | null;
    /** Color de acento en hex. null = el menta de LeadAI. */
    color?: string | null;
    /** Las redes del negocio. Todas opcionales. */
    redes?: {
      instagram?: string | null;
      facebook?: string | null;
      tiktok?: string | null;
      web?: string | null;
    } | null;
  };
  categorias: { id: string; nombre: string }[];
  productos: Producto[];
  grupos: Grupo[];
  combos: Combo[];
  /** Ids de lo más vendido del último mes. Vacío mientras no haya ventas. */
  masPedidos?: string[];
  /**
   * Las promos que están corriendo AHORA (2026-08-20).
   *
   * Antes el descuento aparecía recién al cotizar el carrito, o sea después de
   * que el cliente ya había elegido: la promo no cambiaba lo que pedía, solo
   * le hacía una rebaja sobre lo que ya iba a llevar. "Hoy la 2ª tabla va a
   * mitad de precio" es justamente lo que hace que pida dos.
   *
   * Opcional: una carta servida por un backend viejo no lo manda y la página
   * simplemente no muestra la barra.
   */
  promos?: Promo[];
}

interface Promo {
  id: string;
  /** Lo que el dueño le puso: "3x2 en tablas". */
  nombre: string;
  /** La regla en una línea: "Llevando 3 pagas 2". */
  detalle: string;
  /** Hasta qué hora corre hoy. null = todo el día. */
  hastaHoy: string | null;
  fotoUrl: string | null;
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

/**
 * El pedido COMO LO CALCULÓ EL BACKEND (2026-08-20): líneas con el precio
 * real, promos aplicadas y el total que se va a cobrar. Es lo que pinta el
 * paso de confirmación — el total del navegador es solo para mostrar mientras
 * se arma.
 */
interface Cotizacion {
  lineas: { nombre: string; cantidad: number; unitarioCentavos: number; subtotalCentavos: number; opciones: string[] }[];
  descuentos: { nombre: string; montoCentavos: number }[];
  subtotalCentavos: number;
  totalCentavos: number;
}

const soles = (centavos: number) => `S/${(centavos / 100).toFixed(2)}`;

/**
 * Sin tildes, para buscar. Nadie escribe "acevichado" con tilde cuando busca
 * rápido, y un buscador que no encuentra por eso estorba en vez de ayudar.
 *
 * Definido acá y no importado de `lib/carta`: esta página es la única del
 * panel SIN sesión, y no debe arrastrar el cliente de la API del dueño.
 */
function sinTildes(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Qué dice el botón cuando falta elegir algo obligatorio.
 *
 * El dueño escribe el nombre de sus grupos como quiere: "Tamaño", "Elige tu
 * tartar", "¿Con qué salsa?". Anteponerle "Elige" a todos daba "Elige elige tu
 * tartar" — se vio en la carta de Shiro.
 */
function etiquetaFaltante(nombre: string): string {
  const n = nombre.trim();
  // Ya viene con verbo o con pregunta: se respeta lo que escribió el dueño.
  if (/^(elige|elegí|escoge|selecciona|¿|con qué|qué)/i.test(n)) {
    return n.charAt(0).toUpperCase() + n.slice(1);
  }
  return `Elige ${n.toLowerCase()}`;
}

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
  // Cómo lo quiere: se elige ACÁ y no en el chat (2026-08-19, decisión de
  // Jonathan: "primero es hacer el pedido") — el bot ya no pregunta
  // delivery/recojo; con esto el pedido vuelve al chat con todo resuelto.
  const [modalidad, setModalidad] = useState<"delivery" | "recojo">("delivery");
  const [codigo, setCodigo] = useState<string | null>(null);
  // Se acaba de volver de la confirmación: la carta entra desde la izquierda,
  // que es la dirección de "atrás". Sin distinguirlo, ir y volver se verían
  // igual y el movimiento no comunicaría nada.
  /**
   * HACIA DÓNDE SE ESTÁ MOVIENDO (2026-08-20).
   *
   * `null` = quieto. `"adelante"` = la carta se está yendo a la izquierda
   * porque viene la confirmación; `"atras"` = al revés.
   *
   * Existe para que la pantalla que se VA se vea irse. Antes solo entraba la
   * nueva y la vieja desaparecía de golpe: el ojo leía un corte, no un
   * reemplazo, y por eso "no se notaba" la transición.
   */
  const [saliendo, setSaliendo] = useState<"adelante" | "atras" | null>(null);
  const [volviendo, setVolviendo] = useState(false);

  /** Cuánto dura la salida. Debe coincidir con `.sale-*` en globals.css. */
  const MS_SALIDA = 200;
  // La COTIZACIÓN del backend (2026-08-20): el paso de confirmación. Cuando
  // está seteada, la pantalla muestra el pedido con el TOTAL REAL —promos
  // incluidas— antes de mandarlo. Sin este paso, el cliente veía un total en
  // la web y OTRO en WhatsApp (la promo "aparecía sola" en el chat).
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null);
  // Pedido que viajó DIRECTO al chat (link con ref del bot): la web ya no
  // tiene nada que pedirle al cliente — solo decirle que siga en WhatsApp.
  const [enChat, setEnChat] = useState(false);
  // El ref FIRMADO del lead, si el link lo trajo (lo pone el bot al mandarlo).
  // Se guarda una vez: la URL no cambia mientras se navega la carta.
  const [refLead, setRefLead] = useState<string | null>(null);
  useEffect(() => {
    setRefLead(new URLSearchParams(window.location.search).get("ref"));
  }, []);

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

  /**
   * EL VUELO AL CARRITO (2026-08-19).
   *
   * Cuando el cliente toca un plato, una copia sale de la tarjeta y aterriza
   * en la barra de abajo. Responde la única pregunta de ese instante —"¿se
   * agregó?"— sin ocupar pantalla.
   *
   * Sin esto la carta se agrega en silencio: en un teléfono, con una mano, la
   * gente toca de nuevo y pide el doble.
   */
  const carritoRef = useRef<HTMLDivElement>(null);
  // De dónde salió el último toque. Se guarda en el capture del contenedor y
  // no en cada tarjeta: así vale para platos, combos y destacados sin tocar
  // los tres componentes.
  const ultimoToque = useRef<HTMLElement | null>(null);

  function despegar() {
    volarAlCarrito(ultimoToque.current, carritoRef.current);
  }

  const agregar = (linea: LineaCarrito) => {
    despegar();
    setCarrito((c) => [...c, linea]);
  };
  const agregarCombo = (k: Combo) => {
    despegar();
    return setCarrito((c) => [...c, {
      producto: { id: k.id, nombre: k.nombre, precioCentavos: k.precioCentavos },
      cantidad: 1,
      opciones: [],
      combo: true,
    }]);
  };
  const quitar = (i: number) => setCarrito((c) => c.filter((_, idx) => idx !== i));

  /**
   * Sumar o restar una unidad desde el carrito (2026-08-20).
   *
   * Antes, para pedir dos había que volver a buscar el plato en la carta —y
   * con 48 platos eso es scrollear de nuevo—. Para pedir uno menos, la única
   * salida era "Quitar" y empezar otra vez.
   *
   * Llegar a 0 SACA la línea: un "0× California" en la lista no significa
   * nada, y obligar a tocar "Quitar" después de bajar a cero es un paso de más.
   */
  const cambiarCantidad = (i: number, delta: number) =>
    setCarrito((c) =>
      c
        .map((l, idx) => (idx === i ? { ...l, cantidad: l.cantidad + delta } : l))
        .filter((l) => l.cantidad > 0),
    );

  // El body que viaja al backend: solo QUÉ eligió (ids y cantidades). Los
  // precios los pone el backend desde su base. Los COMBOS van por su propio
  // campo: se cobran a su precio, no a la suma de sus platos.
  function bodyDelPedido() {
    return {
      items: carrito.filter((l) => !l.combo).map((l) => ({
        productoId: l.producto.id,
        cantidad: l.cantidad,
        opcionIds: l.opciones.map((o) => o.id),
      })),
      combos: carrito.filter((l) => l.combo).map((l) => ({
        comboId: l.producto.id,
        cantidad: l.cantidad,
      })),
      modalidad,
    };
  }

  /**
   * PASO 1 — COTIZAR (2026-08-20). "Enviar mi pedido" ya no manda nada: pide
   * el total real al backend y abre la pantalla de confirmación. Es donde el
   * cliente ve las promos ANTES de comprometerse — del test de Jonathan: la
   * promo del backend "aparecía sola" recién en el chat.
   */
  async function cotizarPedido() {
    // LA SALIDA ARRANCA YA, no cuando contesta el backend (2026-08-20).
    //
    // Antes se animaba recién con la respuesta, así que entre el toque y el
    // movimiento había una llamada de red: se sentía demorado y "no se
    // notaba" la transición. Ahora la carta empieza a irse mientras el
    // servidor calcula, y las dos cosas terminan casi juntas.
    setSaliendo("adelante");
    if (carrito.length === 0 || enviando) return;
    const t0 = Date.now();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/c/${tenantId}/cotizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyDelPedido()),
      });
      const data = await res.json();
      if (!res.ok) {
        // Se cancela la salida: la carta quedaría desvanecida mostrando un
        // error, que es la peor combinación posible.
        setSaliendo(null);
        setError(data.error ?? "No pudimos revisar tu pedido");
        return;
      }
      // Lo que FALTE de la salida. Si el backend tardó más que la animación
      // —lo normal—, el cambio es inmediato: hacerlo esperar de nuevo sería
      // sumar demora sobre demora.
      const falta = Math.max(0, MS_SALIDA - (Date.now() - t0));
      setTimeout(() => {
        setCotizacion(data);
        setSaliendo(null);
        setVolviendo(false);
      }, falta);
    } catch {
      setSaliendo(null);
      setError("No pudimos conectar. Revisa tu internet.");
    } finally {
      setEnviando(false);
    }
  }

  /** PASO 2 — CONFIRMAR: recién acá el pedido viaja de verdad. */
  async function enviarPedido() {
    if (carrito.length === 0 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/c/${tenantId}/pedido`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bodyDelPedido(),
          // Con ref (el link lo mandó el bot) el pedido aparece DIRECTO en el
          // chat del cliente: nada de card para compartir ni código a mano.
          ...(refLead ? { ref: refLead } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos enviar tu pedido");
        return;
      }
      if (data.directo) {
        setEnChat(true);
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

  // EL TEMA DEL NEGOCIO (2026-08-19).
  //
  // Se pisan las VARIABLES de color sobre el contenedor en vez de tocar las
  // ~60 clases de la carta una por una: `bg-arena`, `text-tinta` y compañía
  // resuelven contra estas variables, así que cambiarlas repinta todo.
  //
  // El oscuro NO es el claro invertido: son valores elegidos y medidos
  // (arena #14100e sobre carta #1c1815 da la separación de tarjeta que en
  // claro dan la sombra y el borde).
  const oscuro = carta.negocio.tema === "oscuro";
  const acento = carta.negocio.color || null;
  const estiloTema = {
    ...(oscuro
      ? {
          "--color-arena": "#14100e",
          "--color-arena-2": "#241e1a",
          "--color-carta": "#1c1815",
          "--color-tinta": "#f7f3f0",
          "--color-tinta-2": "#c9c0b9",
          "--color-frio": "#9a8f87",
          "--color-linea": "#332b26",
        }
      : {}),
    // El acento pisa el menta de marca: es el color del negocio, no el nuestro.
    ...(acento ? { "--color-brasa": acento, "--color-brasa-texto": acento } : {}),
  } as React.CSSProperties;

  // Pedido que ya viajó DIRECTO al chat: la página solo despide.
  if (enChat) return <PedidoEnChat whatsapp={carta.negocio.whatsapp} estiloTema={estiloTema} />;

  // Pedido enviado por la puerta clásica (link sin ref): código + botón.
  if (codigo) return <PedidoListo codigo={codigo} total={total} whatsapp={carta.negocio.whatsapp} estiloTema={estiloTema} />;

  // El paso de CONFIRMACIÓN: el pedido como lo calculó el backend, con las
  // promos visibles y el total real, antes de mandarlo.
  if (cotizacion) {
    return (
      <ConfirmarPedido
        cotizacion={cotizacion}
        negocio={carta.negocio}
        estiloTema={estiloTema}
        modalidad={modalidad}
        enviando={enviando}
        error={error}
        onVolver={() => {
          setSaliendo("atras");
          setError(null);
          setTimeout(() => {
            setCotizacion(null);
            setVolviendo(true);
            setSaliendo(null);
          }, MS_SALIDA);
        }}
        saliendo={saliendo === "atras"}
        onConfirmar={enviarPedido}
      />
    );
  }

  const porCategoria = carta.categorias
    .map((c) => ({ ...c, productos: carta.productos.filter((p) => p.categoriaId === c.id) }))
    .filter((c) => c.productos.length > 0);
  const sueltos = carta.productos.filter((p) => !p.categoriaId);
  // Los ids del ranking, resueltos a productos y en su orden de venta.
  const destacados = (carta.masPedidos ?? [])
    .map((id) => carta.productos.find((p) => p.id === id))
    .filter((p): p is Producto => p != null);



  return (
    <main
      // `key` con el paso: sin él React reusa el nodo y la animación no vuelve
      // a correr, así que volver de la confirmación sería un corte seco.
      key={volviendo ? "carta-vuelta" : "carta"}
      className={`mx-auto min-h-dvh max-w-[900px] bg-arena pb-32 ${
        saliendo === "adelante" ? "sale-adelante" : volviendo ? "paso-atras" : ""
      }`}
      style={estiloTema}
      // `capture`: se registra ANTES de que React procese el click, así el
      // elemento todavía está donde el cliente lo tocó.
      onClickCapture={(e) => {
        const tarjeta = (e.target as HTMLElement).closest("button");
        ultimoToque.current = tarjeta as HTMLElement | null;
      }}
    >
      <Cabecera negocio={carta.negocio} />
      <BarraPromos promos={carta.promos ?? []} />
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
            // El vuelo sale del botón "Agregar" de la hoja, que es lo último
            // que el cliente tocó. `agregar` lo dispara antes de que
            // `setEligiendo(null)` desmonte la hoja: si se cerrara primero, el
            // elemento ya no existiría y el plato se sumaría en silencio —
            // justo en los platos con opciones, que son los más elaborados.
            agregar({ producto: eligiendo, cantidad, opciones });
            setEligiendo(null);
          }}
        />
      )}

      <PieRedes negocio={carta.negocio} />

      {carrito.length > 0 && (
        <BarraCarrito
          refCarrito={carritoRef}
          minimo={carta.negocio.minimoDeliveryCentavos ?? 0}
          carrito={carrito}
          total={total}
          abierto={carta.negocio.abierto}
          modalidad={modalidad}
          onModalidad={setModalidad}
          enviando={enviando}
          error={error}
          onQuitar={quitar}
          onCantidad={cambiarCantidad}
          onEnviar={cotizarPedido}
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

          {/* LAS REDES, ARRIBA (2026-08-20). Ya estaban en el pie, pero ahí
              las ve solo quien scrollea hasta el final — y el que llegó por un
              link reenviado quiere saber AHORA si el negocio es real. Un
              Instagram con fotos y seguidores es la prueba de existencia más
              rápida que hay. Los íconos van a la derecha del nombre, como
              hace ola.click: reconocibles sin leer una palabra. */}
          <RedesCabecera negocio={negocio} />
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
/**
 * LAS PROMOS DEL DÍA, arriba de todo (2026-08-20).
 *
 * Antes el descuento aparecía recién al cotizar el carrito: el cliente ya había
 * elegido, así que la promo no vendía nada — solo le rebajaba lo que ya iba a
 * llevar. "Hoy la 2ª tabla va a mitad de precio" es justamente lo que hace que
 * pida dos en vez de una, y eso tiene que llegar ANTES.
 *
 * Va entre la cabecera y las secciones, que es donde el ojo cae al abrir el
 * link. Se desliza como la barra de secciones: con dos o tres promos no entran
 * de una en un teléfono, y la de más a la derecha no puede quedar escondida sin
 * ninguna señal.
 *
 * Si no hay promos corriendo no se dibuja NADA: una franja vacía que dice "sin
 * promos hoy" ocupa la mejor parte de la pantalla para no decir nada.
 */
function BarraPromos({ promos }: { promos: Promo[] }) {
  const pista = useRef<HTMLDivElement>(null);

  /**
   * ARRASTRAR LA BARRA (2026-08-20, reporte de Jonathan: "no puedo mover las
   * promos en la vista de celular").
   *
   * Es el MISMO problema que ya tuvo la barra de secciones, y se resuelve
   * igual. Con dos promos la tercera queda fuera de pantalla y no habia forma
   * de llegar a ella: la barra de scroll esta oculta a proposito y no habia
   * handler de arrastre.
   *
   * Pointer Events cubre mouse, lapiz y trackpad con un solo camino. En tactil
   * se deja pasar al navegador, que ya resuelve el desplazamiento nativo — y
   * ademas evita pelear con el scroll vertical de la pagina.
   */
  const arrastre = useRef<{ x: number; scroll: number } | null>(null);

  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // el dedo ya funciona solo
    const el = pista.current;
    if (!el) return;
    arrastre.current = { x: e.clientX, scroll: el.scrollLeft };
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const inicio = arrastre.current;
    const el = pista.current;
    if (!inicio || !el) return;
    // Sin `preventDefault` el navegador intenta arrastrar las tarjetas como si
    // fueran imagenes y aparece el cursor de "prohibido".
    e.preventDefault();
    el.scrollLeft = inicio.scroll - (e.clientX - inicio.x);
  };

  const alSoltar = () => { arrastre.current = null; };

  // El `return` va DESPUES de los hooks: uno detras de un return condicional
  // se saltea en ese render y React aborta con "Rendered more hooks than
  // during the previous render".
  if (promos.length === 0) return null;

  const varias = promos.length > 1;

  return (
    /* AIRE Y SEÑAL DE QUE HAY MÁS (2026-08-20). Con dos promos la barra iba
       apretada contra la de secciones y no se veía como un bloque propio.
       Y pensando en un negocio con cinco: sin degradado a la derecha, la
       tercera queda cortada sin ninguna pista de que se puede deslizar —el
       mismo problema que ya tuvo la barra de secciones—. */
    <section className="pb-4 pt-4" aria-label="Promociones de hoy">
      {/* Un encabezado chico: sin él, dos tarjetas naranjas sueltas se leen
          como un banner de publicidad y el ojo las saltea. Diciendo "Hoy" se
          entiende que es de este negocio y que caduca. */}
      {varias && (
        <p className="eyebrow mb-2 px-4">Promos de hoy</p>
      )}
      <div className="relative">
        <div
          ref={pista}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerLeave={alSoltar}
          className="scroll-fino flex touch-pan-x gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {promos.map((p, i) => (
            <div
              key={p.id}
              // Entran escalonadas: con dos o tres, verlas llegar una atrás de
              // otra las hace notar. Todas juntas se leen como parte del fondo.
              style={{ animationDelay: `${i * 70}ms` }}
              className="entra flex min-w-[16.5rem] shrink-0 items-center gap-3 rounded-tarjeta bg-calor/10 px-4 py-3.5 ring-1 ring-calor/25"
            >
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-calor/15 text-[1.15rem]"
                aria-hidden
              >
                🎉
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.9rem] font-bold leading-tight text-tinta">{p.nombre}</p>
                <p className="mt-0.5 truncate text-[0.8rem] leading-snug text-calor">
                  {p.detalle}
                  {/* La hora solo si la promo se corta hoy: un "hasta las 20:00"
                      es lo que hace que pida ahora y no más tarde. */}
                  {p.hastaHoy && <span className="text-tinta-2"> · hasta {p.hastaHoy}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* El degradado solo cuando hay varias: con una sola no hay nada más
            allá y una sombra al costado sería mentira. `pointer-events-none`
            para no comerse el arrastre. */}
        {varias && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-arena to-transparent"
            aria-hidden
          />
        )}
      </div>
    </section>
  );
}

function BarraSecciones({ secciones }: { secciones: { id: string; nombre: string }[] }) {
  const pista = useRef<HTMLDivElement>(null);
  /**
   * ¿QUEDA ALGO A CADA LADO? (2026-08-20).
   *
   * Con siete secciones entran tres y media: hay ~360px ocultos y NINGUNA
   * señal de que se puede deslizar —la barra de scroll está oculta a
   * propósito, porque la del sistema es gris y ancha—. En un teléfono se
   * descubre arrastrando; con mouse, no se descubre (reporte de Jonathan:
   * "quiero ver qué hay más allá y no puedo").
   *
   * El degradado dice que hay más; las flechas dan cómo llegar.
   */
  const [hayIzq, setHayIzq] = useState(false);
  const [hayDer, setHayDer] = useState(false);

  const revisar = useCallback(() => {
    const el = pista.current;
    if (!el) return;
    setHayIzq(el.scrollLeft > 4);
    // -4 de margen: el redondeo del navegador deja un pixel suelto al final y
    // sin esto la flecha derecha nunca se apaga.
    setHayDer(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    revisar();
    window.addEventListener("resize", revisar);
    return () => window.removeEventListener("resize", revisar);
  }, [revisar, secciones.length]);

  if (secciones.length < 2) return null;

  /**
   * ARRASTRAR CON EL MOUSE (2026-08-20).
   *
   * En un teléfono el dedo ya la mueve: es `overflow-x: auto` y el navegador
   * lo resuelve solo. Con MOUSE no: arrastrar no hace nada, la barra está
   * oculta a propósito y la rueda vertical no desplaza en horizontal. El
   * dueño en su computadora se quedaba sin ver la mitad de sus secciones
   * (reporte de Jonathan).
   *
   * Se usa Pointer Events, no mousedown: cubre mouse, lápiz y trackpad con un
   * solo camino, y no interfiere con el táctil porque ahí `pointerType` es
   * "touch" y se deja pasar al navegador.
   */
  const arrastre = useRef<{ x: number; scroll: number } | null>(null);

  const alBajar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return; // el dedo ya funciona solo
    const el = pista.current;
    if (!el) return;
    arrastre.current = { x: e.clientX, scroll: el.scrollLeft };
  };

  const alMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const inicio = arrastre.current;
    const el = pista.current;
    if (!inicio || !el) return;
    // Sin `preventDefault` el navegador intenta arrastrar los enlaces como si
    // fueran imágenes y aparece el cursor de "prohibido".
    e.preventDefault();
    el.scrollLeft = inicio.scroll - (e.clientX - inicio.x);
  };

  const alSoltar = () => { arrastre.current = null; };

  const mover = (dir: 1 | -1) =>
    // 70% del ancho visible: mueve lo suficiente para ver algo nuevo, pero
    // deja una sección a la vista como referencia de dónde estabas.
    pista.current?.scrollBy({ left: dir * pista.current.clientWidth * 0.7, behavior: "smooth" });

  return (
    <nav className="sticky top-0 z-20 border-b border-linea bg-carta/95 backdrop-blur">
      <div className="relative">
        {/* Los degradados: dicen "hay más" sin ocupar lugar ni pedir un toque.
            `pointer-events-none` para que no bloqueen el arrastre del dedo. */}
        {hayIzq && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-carta to-transparent" />
        )}
        {hayDer && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-carta to-transparent" />
        )}

        {/* Las flechas, solo donde hay MOUSE. `hidden sm:grid` estaba mal: se
            apoyaba en el ancho, y justo en 400-640px —donde la barra más
            desborda— quedaban ocultas. Un teléfono ancho tiene dedo, no
            puntero, así que la pregunta correcta es `hover:hover`. */}
        {hayIzq && (
          <button
            onClick={() => mover(-1)}
            aria-label="Ver secciones anteriores"
            className="absolute left-0.5 top-1/2 z-20 hidden -translate-y-1/2 place-items-center rounded-full bg-carta/90 px-1.5 py-1 text-tinta-2 shadow-sm ring-1 ring-linea transition hover:bg-arena [@media(hover:hover)]:grid"
          >
            ‹
          </button>
        )}
        {hayDer && (
          <button
            onClick={() => mover(1)}
            aria-label="Ver más secciones"
            className="absolute right-0.5 top-1/2 z-20 hidden -translate-y-1/2 place-items-center rounded-full bg-carta/90 px-1.5 py-1 text-tinta-2 shadow-sm ring-1 ring-linea transition hover:bg-arena [@media(hover:hover)]:grid"
          >
            ›
          </button>
        )}

        <div
          ref={pista}
          onScroll={revisar}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerLeave={alSoltar}
          // La RUEDA del mouse también desplaza: en una barra horizontal es lo
          // primero que alguien intenta, y sin esto no pasa nada.
          onWheel={(e) => {
            const el = pista.current;
            if (!el || e.deltaY === 0) return;
            el.scrollLeft += e.deltaY;
          }}
          className="flex cursor-grab gap-1 overflow-x-auto px-4 py-2.5 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
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
      className="entra tarjeta-viva group flex w-full items-start gap-3 rounded-tarjeta bg-carta p-4 text-left ring-1 ring-linea transition hover:ring-brasa/40 active:scale-[0.99]"
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

  /**
   * EL FONDO NO SE MUEVE mientras la hoja está abierta (2026-08-20).
   *
   * Sin esto, al llegar al final de la lista de opciones el scroll seguía en
   * la CARTA de atrás: el cliente movía el dedo dentro del selector y lo que
   * se desplazaba era la página. Y su barra de scroll —la gris de Windows,
   * ancha— quedaba encima de la hoja.
   */
  useEffect(() => {
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previo; };
  }, []);
  /**
   * BUSCADOR POR GRUPO (2026-08-20). En Shiro, "Elige tu roll" tiene 39
   * opciones: una lista corrida de 39 filas es un muro que nadie lee, y el
   * cliente que ya sabe cuál quiere igual tiene que scrollear todo.
   *
   * Solo aparece a partir de 8 opciones. Con menos, el buscador ocupa más de
   * lo que ahorra — y con tres salsas, buscar es más trabajo que mirar.
   */
  const [busca, setBusca] = useState<Record<string, string>>({});
  const MIN_PARA_BUSCADOR = 8;

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
    // z-50, no z-20 (2026-08-20): la barra de secciones es `sticky top-0 z-20`,
    // o sea el MISMO nivel, así que se veía por encima de la hoja — el cliente
    // veía "Entradas · Rolls frescos…" flotando sobre el selector abierto.
    <div className="aparece fixed inset-0 z-50 flex items-end bg-tinta/50" onClick={onCancelar}>
      <div
        className="sube flex max-h-[88dvh] w-full flex-col rounded-t-[1.5rem] bg-carta"
        onClick={(e) => e.stopPropagation()}
      >
        {/* La cabecera con la FOTO: el cliente tiene que seguir viendo qué
            está pidiendo mientras elige sus extras. Sin ella, tres grupos más
            abajo ya no se acuerda de cuál plato abrió. */}
        <div className="flex items-center gap-3 border-b border-linea px-5 py-4">
          {producto.fotoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={producto.fotoUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-linea"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-tight text-tinta">{producto.nombre}</h3>
            <p className="text-[0.9rem] font-semibold text-calor">
              {soles(producto.precioCentavos)}
            </p>
          </div>
          <button
            onClick={onCancelar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[1.4rem] leading-none text-frio transition hover:bg-arena hover:text-tinta"
          >
            ×
          </button>
        </div>

        <div className="scroll-fino min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {grupos.map((g) => {
              const cuantas = elegidas.filter((e) => g.opciones.some((o) => o.id === e.id)).length;
              const lleno = g.maxSelec != null && cuantas >= g.maxSelec;
              return (
                <div key={g.id}>
                  <div className="mb-2.5 flex items-baseline justify-between gap-2">
                    <h4 className="font-bold text-tinta">{g.nombre}</h4>
                    {/* La REGLA en palabras, no "min 1 max 1": el cliente
                        necesita saber cuántas puede elegir ANTES de tocar. */}
                    {g.minSelec > 0 ? (
                      <span className="shrink-0 rounded-chip bg-orbita/12 px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-calor">
                        Obligatorio
                      </span>
                    ) : (
                      <span className="shrink-0 text-[0.75rem] text-frio">
                        {g.maxSelec === 1 ? "Elige 1" : g.maxSelec ? `Hasta ${g.maxSelec}` : "Opcional"}
                      </span>
                    )}
                  </div>

                  {g.opciones.length >= MIN_PARA_BUSCADOR && (
                    <input
                      value={busca[g.id] ?? ""}
                      onChange={(e) => setBusca((b) => ({ ...b, [g.id]: e.target.value }))}
                      placeholder={`🔍 Buscar entre ${g.opciones.length}…`}
                      aria-label={`Buscar en ${g.nombre}`}
                      className="mb-2 w-full rounded-lg bg-arena/60 px-3 py-2 text-[0.9rem] text-tinta ring-1 ring-linea placeholder:text-frio focus:ring-brasa/50"
                    />
                  )}

                  <div className="space-y-1.5">
                    {(() => {
                      const q = sinTildes((busca[g.id] ?? "").trim().toLowerCase());
                      const visibles = q
                        ? g.opciones.filter((o) => sinTildes(o.nombre.toLowerCase()).includes(q))
                        : g.opciones;
                      if (visibles.length === 0) {
                        return (
                          <p className="px-1 py-3 text-center text-[0.85rem] text-frio">
                            Nada coincide con «{busca[g.id]}».
                          </p>
                        );
                      }
                      // POR SECCIÓN (2026-08-20). Con 39 rolls seguidos el
                      // cliente no distingue un frito de uno con tartar: la
                      // carta los tiene separados y el selector también debe.
                      //
                      // Solo si hay MÁS DE UNA sección: con todas las opciones
                      // en la misma, un único título es una línea de ruido.
                      const secciones: { nombre: string | null; ops: Opcion[] }[] = [];
                      for (const o of visibles) {
                        const s = o.seccion ?? null;
                        const ultima = secciones.at(-1);
                        if (ultima && ultima.nombre === s) ultima.ops.push(o);
                        else secciones.push({ nombre: s, ops: [o] });
                      }
                      const agrupar = secciones.filter((s) => s.nombre).length > 1;

                      const pintarOpcion = (o: Opcion) => {
                      const marcada = elegidas.some((e) => e.id === o.id);
                      // Un grupo lleno bloquea lo NO elegido, pero deja
                      // destildar: si no, el cliente queda atrapado con una
                      // elección que ya no quiere.
                      const bloqueada = lleno && !marcada && g.maxSelec !== 1;
                      return (
                        <button
                          key={o.id}
                          onClick={() => !bloqueada && alternar(g, o)}
                          disabled={bloqueada}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition ${
                            marcada
                              ? "bg-brasa/10 ring-2 ring-brasa"
                              : bloqueada
                                ? "opacity-40 ring-1 ring-linea"
                                : "ring-1 ring-linea hover:bg-arena/60 hover:ring-brasa/40"
                          }`}
                        >
                          {/* La marca de selección: un círculo que se llena.
                              Antes solo cambiaba el fondo y no se veía qué
                              estaba elegido. */}
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center text-[0.7rem] font-bold transition ${
                              g.maxSelec === 1 ? "rounded-full" : "rounded-md"
                            } ${
                              marcada
                                ? "bg-brasa text-sobre-brasa"
                                : "ring-1 ring-linea"
                            }`}
                            aria-hidden
                          >
                            {marcada ? "✓" : ""}
                          </span>

                          {/* La FOTO de la opción (2026-08-19). En un combo de
                              sushi la lista son 39 nombres —"Calamar Spyce",
                              "Dragón roll"— y quien no conoce la carta elige a
                              ciegas. Solo aparece si la opción tiene foto: sin
                              ella la fila queda como estaba, sin un hueco. */}
                          {o.fotoUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.fotoUrl}
                              alt=""
                              loading="lazy"
                              className="h-11 w-11 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <span className={`min-w-0 flex-1 ${marcada ? "font-semibold text-tinta" : "text-tinta-2"}`}>
                            {o.nombre}
                          </span>
                          {o.precioCentavos > 0 && (
                            <span className={`shrink-0 text-[0.85rem] font-semibold tabular-nums ${marcada ? "text-calor" : "text-frio"}`}>
                              +{soles(o.precioCentavos)}
                            </span>
                          )}
                        </button>
                      );
                      };

                      if (!agrupar) return visibles.map(pintarOpcion);
                      return secciones.map((s, k) => (
                        <div key={`${s.nombre ?? "sueltas"}-${k}`} className="space-y-1.5">
                          {s.nombre && (
                            // Pegajoso: con la lista larga, al scrollear sigue
                            // diciendo en qué sección estás parado.
                            <p className="sticky top-0 z-10 bg-carta/95 py-1 text-[0.72rem] font-bold uppercase tracking-wide text-frio backdrop-blur">
                              {s.nombre}
                            </p>
                          )}
                          {s.ops.map(pintarOpcion)}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* El pie queda FIJO, fuera del scroll: con tres grupos de extras el
            botón de agregar se perdía abajo y había que scrollear para
            encontrarlo. */}
        <div className="border-t border-linea bg-carta px-5 py-4">
          {extras > 0 && (
            <p className="mb-2 text-[0.82rem] text-frio">
              {soles(producto.precioCentavos)} + {soles(extras)} en extras
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex shrink-0 items-center rounded-chip ring-1 ring-linea">
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="grid h-10 w-10 place-items-center rounded-l-chip text-[1.3rem] text-tinta-2 transition hover:bg-arena disabled:opacity-30"
                disabled={cantidad <= 1}
                aria-label="Quitar uno"
              >
                −
              </button>
              <span className="w-8 text-center font-bold tabular-nums text-tinta">{cantidad}</span>
              <button
                onClick={() => setCantidad((c) => Math.min(50, c + 1))}
                className="grid h-10 w-10 place-items-center rounded-r-chip text-[1.3rem] text-tinta-2 transition hover:bg-arena"
                aria-label="Agregar uno"
              >
                +
              </button>
            </div>
            <button
              onClick={() => onAgregar(elegidas, cantidad)}
              disabled={faltanObligatorios.length > 0}
              className="flex-1 rounded-tarjeta bg-brasa py-3.5 font-bold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99] disabled:bg-arena disabled:text-frio"
            >
              {faltanObligatorios.length > 0
                // Se dice QUÉ falta, no solo se deshabilita: un botón gris sin
                // explicación deja al cliente tocándolo sin entender.
                //
                // SIN DUPLICAR EL VERBO (2026-08-19): el dueño suele nombrar
                // su grupo "Elige tu tartar", y el prefijo lo repetía —"Elige
                // elige tu tartar"—. Si el nombre ya arranca con el verbo, se
                // usa tal cual.
                ? etiquetaFaltante(faltanObligatorios[0].nombre)
                : `Agregar · ${soles((producto.precioCentavos + extras) * cantidad)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarraCarrito({
  carrito, total, abierto, modalidad, onModalidad, enviando, error, onQuitar, onCantidad, onEnviar, minimo,
  refCarrito,
}: {
  carrito: LineaCarrito[];
  total: number;
  /** Dónde aterriza el plato que vuela. */
  refCarrito: React.RefObject<HTMLDivElement | null>;
  abierto: boolean;
  /** Pedido mínimo para delivery, en céntimos. 0 = sin mínimo. */
  minimo: number;
  modalidad: "delivery" | "recojo";
  onModalidad: (m: "delivery" | "recojo") => void;
  enviando: boolean;
  error: string | null;
  onQuitar: (i: number) => void;
  /** Sumar o restar una unidad. Llegar a 0 saca la línea. */
  onCantidad: (i: number, delta: number) => void;
  onEnviar: () => void;
}) {
  // Cuánto falta para el mínimo. Solo en DELIVERY: quien pasa a recoger no
  // le cuesta un viaje al local, así que no hay mínimo que exigirle.
  const faltaParaElMinimo =
    modalidad === "delivery" && minimo > 0 ? Math.max(0, minimo - total) : 0;

  // ABIERTO DE ENTRADA (2026-08-20). Estaba colapsado detrás de "ver detalle",
  // así que el cliente tenía que descubrir ese botón para saber qué llevaba y
  // para poder sacar algo. Quien no lo descubría llegaba al pago sin haber
  // revisado su pedido — y ahí es donde se arrepiente y abandona.
  //
  // Se puede cerrar: con ocho platos la lista tapa la carta, y el que ya sabe
  // lo que quiere prefiere seguir mirando.
  const [abiertoDetalle, setAbiertoDetalle] = useState(true);
  const unidades = carrito.reduce((s, l) => s + l.cantidad, 0);
  // El total SUBE en vez de saltar: el ojo lee "creció" en vez de "otro
  // número", y es el dato que decide si sigue agregando o toca enviar.
  const totalVisible = usarNumeroAnimado(total);

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
    <div ref={refCarrito} className="sube fixed inset-x-0 bottom-0 z-10 mx-auto max-w-[900px] bg-carta px-5 pb-5 pt-3 shadow-[0_-4px_24px_rgba(15,20,18,0.08)]">
      {abiertoDetalle && (
        <div className="scroll-fino mb-3 max-h-[40dvh] space-y-2 overflow-y-auto">
          {/* Cada línea ENTRA: sin esto, agregar algo mientras el detalle está
              abierto solo hace que la lista sea más larga, y no se ve qué se
              sumó. */}
          {carrito.map((l, i) => (
            <div key={i} className="fila-entra flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] leading-snug text-tinta">{l.producto.nombre}</p>
                {l.opciones.length > 0 && (
                  <p className="text-[0.8rem] leading-snug text-tinta-2">
                    {l.opciones.map((o) => o.nombre).join(", ")}
                  </p>
                )}
              </div>

              {/* − CANTIDAD + (2026-08-20). Antes, para pedir dos había que
                  volver a buscar el plato entre 48; para pedir uno menos, la
                  única salida era "Quitar" y empezar de nuevo.

                  En 0 la línea se va sola: obligar a tocar "Quitar" después de
                  bajar a cero es un paso de más, y un "0×" no significa nada. */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => (l.cantidad === 1 ? onQuitar(i) : onCantidad(i, -1))}
                  aria-label={l.cantidad === 1 ? `Quitar ${l.producto.nombre}` : `Uno menos de ${l.producto.nombre}`}
                  className="grid size-8 place-items-center rounded-full text-[1.05rem] font-bold text-tinta-2 ring-1 ring-linea transition active:scale-95"
                >
                  {/* Con una sola unidad el botón BORRA: bajar a cero y quitar
                      son la misma intención, y el tacho lo dice sin ambigüedad. */}
                  {l.cantidad === 1 ? "🗑" : "−"}
                </button>
                <span className="w-6 text-center text-[0.95rem] font-bold tabular-nums text-tinta">
                  {l.cantidad}
                </span>
                <button
                  onClick={() => onCantidad(i, 1)}
                  aria-label={`Uno más de ${l.producto.nombre}`}
                  className="grid size-8 place-items-center rounded-full text-[1.05rem] font-bold text-tinta-2 ring-1 ring-linea transition active:scale-95"
                >
                  +
                </button>
              </div>

              <span className="w-[4.5rem] shrink-0 text-right text-[0.9rem] font-semibold tabular-nums text-tinta">
                {soles((l.producto.precioCentavos + l.opciones.reduce((s, o) => s + o.precioCentavos, 0)) * l.cantidad)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-[0.85rem] font-semibold text-alerta">{error}</p>}

      {/* El toggle cambia de sentido según el estado: con el carrito abierto
          "ver detalle" no dice nada —ya lo estás viendo—. */}
      <button
        onClick={() => setAbiertoDetalle((v) => !v)}
        className="mb-2 flex w-full items-center gap-1.5 text-left text-[0.85rem] text-tinta-2"
      >
        <span className={`inline-block transition-transform duration-200 ${abiertoDetalle ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
        {unidades} {unidades === 1 ? "producto" : "productos"} ·{" "}
        {abiertoDetalle ? "ocultar" : "ver mi pedido"}
      </button>

      {/* La modalidad se decide acá, con el pedido ya armado — el chat no la
          vuelve a preguntar. Dos opciones grandes, nada de dropdown: esto se
          toca con el pulgar apurado y con hambre. */}
      <div className="mb-2 grid grid-cols-2 gap-2">
        {([
          ["delivery", "🛵 Delivery"],
          ["recojo", "🥡 Para llevar"],
        ] as const).map(([valor, etiqueta]) => (
          <button
            key={valor}
            onClick={() => onModalidad(valor)}
            className={`rounded-tarjeta border py-2.5 text-[0.9rem] font-semibold transition ${
              modalidad === valor
                ? "border-brasa bg-brasa/10 text-brasa"
                : "border-linea text-tinta-2"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* CUÁNTO FALTA PARA EL MÍNIMO (2026-08-19). Se dice MIENTRAS arma, no
          al enviar: enterarse al final de que su pedido no alcanza se siente
          un cambio de reglas, y a esa altura mucha gente cierra la pestaña.
          Y se dice cuánto falta, no solo que no alcanza: "te faltan S/8" es
          accionable, "pedido mínimo S/30" lo manda a hacer la cuenta. */}
      {faltaParaElMinimo > 0 && (
        <p className="mb-2 rounded-tarjeta bg-calor-suave px-3 py-2 text-center text-[0.85rem] font-semibold text-calor-hondo">
          Te faltan {soles(faltaParaElMinimo)} para el mínimo de delivery
        </p>
      )}

      <button
        onClick={onEnviar}
        disabled={!abierto || enviando || faltaParaElMinimo > 0}
        className={`w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-40 ${late ? "late" : ""}`}
      >
        {!abierto
          ? "Cerrado por ahora"
          : faltaParaElMinimo > 0
            ? `Mínimo ${soles(minimo)} para delivery`
            : enviando
              ? "Revisando…"
              : `Ver mi pedido · ${soles(totalVisible)}`}
      </button>
    </div>
  );
}

/**
 * EL PASO DE CONFIRMACIÓN (2026-08-20, del test de Jonathan: "no me apareció
 * el pedido para confirmar la compra").
 *
 * Lo que se muestra acá es la COTIZACIÓN DEL BACKEND, no la suma del
 * navegador: promos aplicadas y el total real que se va a cobrar. Es el
 * momento en que la promo se VE — antes "aparecía sola" recién en WhatsApp,
 * y una sorpresa en el precio, aunque sea a favor, huele a error.
 */
function ConfirmarPedido({
  cotizacion, negocio, estiloTema, modalidad, enviando, error, onVolver, onConfirmar, saliendo,
}: {
  cotizacion: Cotizacion;
  /** La marca del negocio: sin esto la confirmación parece otro sitio. */
  negocio: Carta["negocio"];
  /** `true` mientras se está yendo, para que se vea salir. */
  saliendo: boolean;
  estiloTema: React.CSSProperties;
  modalidad: "delivery" | "recojo";
  enviando: boolean;
  error: string | null;
  onVolver: () => void;
  onConfirmar: () => void;
}) {
  const hayDescuento = cotizacion.descuentos.length > 0;
  return (
    // EL MISMO TEMA QUE LA CARTA (2026-08-20). Sin `estiloTema` esta pantalla
    // se pintaba con los colores por defecto: un formulario blanco genérico
    // justo en el paso donde el cliente decide si paga. Un nikkei negro y
    // naranja se volvía otro sitio, y eso da desconfianza en el peor momento.
    <main
      className={`mx-auto flex min-h-dvh max-w-[560px] flex-col bg-arena ${
        saliendo ? "sale-atras" : "paso-adelante"
      }`}
      style={estiloTema}
    >
      {/* La cabecera del negocio, compacta: logo y nombre. No es decoración —
          es lo que dice "seguís en el mismo lugar donde armaste tu pedido". */}
      <header className="flex items-center gap-3 border-b border-linea bg-carta px-5 py-3">
        {negocio.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={negocio.logoUrl}
            alt=""
            className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-linea"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brasa/15 text-[1.1rem]" aria-hidden>
            🍽️
          </span>
        )}
        <p className="min-w-0 flex-1 truncate font-bold text-tinta">{negocio.nombre}</p>
      </header>

      <div className="flex flex-1 flex-col p-5">
      <button onClick={onVolver} className="mb-4 self-start text-[0.9rem] font-semibold text-tinta-2">
        ← Volver a la carta
      </button>

      <h1 className="mb-1 text-[1.35rem] font-bold text-tinta">Tu pedido</h1>
      <p className="mb-4 text-[0.9rem] text-tinta-2">
        {modalidad === "delivery" ? "🛵 Delivery" : "🥡 Para llevar"} · revísalo antes de enviarlo
      </p>

      <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
        <div className="space-y-3">
          {cotizacion.lineas.map((l, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.95rem] text-tinta">{l.cantidad}× {l.nombre}</p>
                {l.opciones.length > 0 && (
                  <p className="text-[0.8rem] text-tinta-2">{l.opciones.join(", ")}</p>
                )}
              </div>
              <p className="shrink-0 text-[0.95rem] text-tinta">{soles(l.subtotalCentavos)}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-linea pt-3">
          {/* Las promos, VISIBLES y restando: es la línea que mata la
              sorpresa. Solo se pintan si hay — sin promo no hay subtotal
              que explicar. */}
          {hayDescuento && (
            <>
              <div className="flex justify-between text-[0.9rem] text-tinta-2">
                <span>Subtotal</span><span>{soles(cotizacion.subtotalCentavos)}</span>
              </div>
              {cotizacion.descuentos.map((d, i) => (
                <div key={i} className="flex justify-between text-[0.9rem] font-semibold text-brasa-texto">
                  <span>🎉 {d.nombre}</span><span>−{soles(d.montoCentavos)}</span>
                </div>
              ))}
            </>
          )}
          <div className="flex justify-between pt-1 text-[1.1rem] font-bold text-tinta">
            <span>Total</span><span>{soles(cotizacion.totalCentavos)}</span>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-[0.85rem] font-semibold text-alerta">{error}</p>}

      <div className="mt-auto pt-5">
        <button
          onClick={onConfirmar}
          disabled={enviando}
          className="w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-40"
        >
          {enviando ? "Enviando…" : `Confirmar pedido · ${soles(cotizacion.totalCentavos)}`}
        </button>
      </div>
      </div>
    </main>
  );
}

/**
 * EL PEDIDO YA ESTÁ EN EL CHAT (2026-08-20).
 *
 * El link traía el ref del bot, así que al confirmar el resumen viajó DIRECTO
 * al WhatsApp del cliente — nada de card para compartir ni código a mano
 * ("le dije al otro agente que no quiero eso"). La página intenta cerrarse
 * sola; si el navegador no la deja (una pestaña que no abrió un script no se
 * puede cerrar), queda esta despedida con el camino de vuelta.
 */
function PedidoEnChat({ whatsapp, estiloTema }: { whatsapp: string | null; estiloTema: React.CSSProperties }) {
  // ¿Se pudo cerrar sola? Mientras no se sepa, no se muestra nada: enseñarle
  // "¡Pedido enviado!" a alguien que en 300ms va a estar de vuelta en WhatsApp
  // es un parpadeo, y el mensaje del bot ya le dice lo mismo mejor.
  const [sigueAbierta, setSigueAbierta] = useState(false);

  useEffect(() => {
    // SE CIERRA YA (2026-08-20). Esperaba 1.2s mostrando una pantalla que el
    // cliente no necesita: el bot ya le está escribiendo el resumen al chat,
    // y esta página solo se interpone entre él y ese mensaje.
    //
    // El intento es inmediato; los 300ms son solo para no cortar el frame de
    // la animación de entrada a mitad de camino.
    const cerrar = setTimeout(() => window.close(), 300);

    // `window.close()` SOLO funciona si la ventana la abrió un script. En el
    // navegador embebido de WhatsApp funciona; en Chrome normal —alguien que
    // pegó el link— falla en silencio y la página se queda.
    //
    // Por eso se comprueba: si a los 900ms seguimos vivos, no cerró, y ahí sí
    // se muestra la salida manual. Sin esto, ese cliente se quedaría mirando
    // una pantalla en blanco sin saber qué hacer.
    const revisar = setTimeout(() => setSigueAbierta(true), 900);
    return () => { clearTimeout(cerrar); clearTimeout(revisar); };
  }, []);

  // Todavía intentando cerrar: nada en pantalla, solo el fondo del negocio.
  if (!sigueAbierta) {
    return <main className="min-h-dvh bg-arena" style={estiloTema} />;
  }
  return (
    // Solo para quien NO se pudo cerrar (alguien que pegó el link en Chrome).
    // Con el tema del negocio: un flash blanco sobre una carta oscura se ve
    // como un error del sistema.
    <main className="aparece mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-5 bg-arena p-6 text-center" style={estiloTema}>
      <div className="text-[3rem]">✅</div>
      <h1 className="text-[1.5rem] font-bold text-tinta">¡Pedido enviado!</h1>
      <p className="text-tinta-2">
        Te escribimos por WhatsApp con el detalle. Vuelve al chat para seguir 🙌
      </p>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}`}
          className="mt-1 w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa"
        >
          Volver al chat
        </a>
      )}
    </main>
  );
}

/**
 * El paso final: el código y el botón que devuelve a WhatsApp.
 *
 * El código se muestra GRANDE aunque el botón lo lleve solo: si el link no
 * abre (WhatsApp sin instalar, navegador raro), el cliente puede escribirlo a
 * mano y el pedido no se pierde.
 */
function PedidoListo({ codigo, total, whatsapp, estiloTema }: { codigo: string; total: number; whatsapp: string | null; estiloTema: React.CSSProperties }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[560px] flex-col items-center justify-center gap-5 bg-arena p-6 text-center" style={estiloTema}>
      <div className="text-[3rem]">🧾</div>
      <h1 className="text-[1.5rem] font-bold text-tinta">Tu pedido está listo</h1>

      {/* EL BOTÓN HACE EL TRABAJO, NO EL CLIENTE (2026-08-19).
          Antes esta pantalla decía "Mándanos este código por WhatsApp" con el
          código gigante en el medio, así que se leía como una tarea: copiar
          algo y pegarlo. Nunca lo fue —el botón ya abre WhatsApp con el
          mensaje escrito— pero el texto pedía otra cosa, y alguien que acaba
          de armar su pedido no tiene por qué descubrir eso solo. */}
      <p className="text-tinta-2">
        Toca el botón y te confirmamos por WhatsApp al toque.
      </p>

      <p className="text-[1.05rem] font-bold text-tinta">Total: {soles(total)}</p>

      {/* CON el número del restaurante (2026-08-17): antes era `wa.me/` a
          secas y abría WhatsApp sin destinatario, así que el cliente tenía que
          buscar el contacto a mano — justo después de armar todo su pedido. */}
      <a
        href={`https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(`Hola! Mi pedido es el #${codigo}`)}`}
        className="mt-1 w-full rounded-tarjeta bg-brasa py-4 text-[1.05rem] font-bold text-sobre-brasa"
      >
        Enviar mi pedido por WhatsApp
      </a>

      {/* El código queda como RESPALDO: chico, explicado y abajo. Si WhatsApp
          no abre —navegador raro, app sin instalar— es la única forma de
          recuperar el pedido, así que no se puede sacar. */}
      <p className="text-[0.82rem] text-frio">
        ¿No se abrió WhatsApp? Escríbenos el código{" "}
        <span className="font-bold tracking-wide text-tinta-2">#{codigo}</span>
      </p>
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
      className="entra tarjeta-viva group flex w-full items-start gap-3 rounded-tarjeta bg-carta p-4 text-left ring-1 ring-orbita/30 transition hover:ring-orbita/60 active:scale-[0.99]"
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

/**
 * LAS REDES EN LA CABECERA (2026-08-20).
 *
 * Los mismos links que el pie, pero arriba y como iconos. Dos razones:
 *
 *  - El que llega por un link REENVIADO no sabe si el negocio existe. Un
 *    Instagram con fotos y seguidores lo resuelve en un toque; el pie solo lo
 *    ve quien scrollea 40 platos hasta el final.
 *  - Como icono ocupan lo que una palabra y se reconocen sin leer.
 *
 * El WhatsApp va PRIMERO cuando existe: es el canal por el que de verdad pide,
 * y tenerlo a mano evita que se vaya a buscar el numero a Google.
 *
 * Si el negocio no cargo ninguna red no se dibuja nada: un hueco con recuadros
 * vacios se ve peor que no tener la seccion.
 */
function RedesCabecera({ negocio }: { negocio: Carta["negocio"] }) {
  const redes = [
    negocio.whatsapp
      ? { k: "wa", label: "WhatsApp", url: `https://wa.me/${negocio.whatsapp}`, Icono: IconoWhatsApp }
      : null,
    negocio.redes?.instagram
      ? { k: "ig", label: "Instagram", url: negocio.redes.instagram, Icono: IconoInstagram }
      : null,
    negocio.redes?.facebook
      ? { k: "fb", label: "Facebook", url: negocio.redes.facebook, Icono: IconoMessenger }
      : null,
    negocio.redes?.tiktok
      ? { k: "tt", label: "TikTok", url: negocio.redes.tiktok, Icono: IconoTikTok }
      : null,
  ].filter((r): r is NonNullable<typeof r> => r !== null);

  if (redes.length === 0) return null;

  return (
    // `sm:ml-auto`: al borde derecho en pantalla ancha, como en la referencia;
    // en movil caen bajo el nombre en vez de apretarlo contra el chip.
    <div className="flex gap-1.5 sm:ml-auto">
      {redes.map(({ k, label, url, Icono }) => (
        <a
          key={k}
          href={/^https?:\/\//.test(url) ? url : `https://${url}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="grid h-9 w-9 place-items-center rounded-lg text-tinta-2 ring-1 ring-linea transition hover:bg-arena hover:text-tinta active:scale-95"
        >
          <Icono className="h-[1.05rem] w-[1.05rem]" />
        </a>
      ))}
    </div>
  );
}

/**
 * EL PIE DE LA CARTA (2026-08-19): las redes del negocio y su dirección.
 *
 * El cliente que llegó por el link no tiene cómo volver a encontrarlo: la
 * carta es el final de la cadena. Y la dirección va acá y no arriba porque
 * muchos cocinan desde su casa y la dejan vacía — arriba dejaba un hueco.
 */
function PieRedes({ negocio }: { negocio: Carta["negocio"] }) {
  const redes = [
    { nombre: "Instagram", url: negocio.redes?.instagram, emoji: "📷" },
    { nombre: "Facebook", url: negocio.redes?.facebook, emoji: "👍" },
    { nombre: "TikTok", url: negocio.redes?.tiktok, emoji: "🎵" },
    { nombre: "Web", url: negocio.redes?.web, emoji: "🌐" },
  ].filter((r): r is { nombre: string; url: string; emoji: string } => Boolean(r.url));

  if (redes.length === 0 && !negocio.direccion) return null;

  return (
    <footer className="mt-8 border-t border-linea px-4 py-6 text-center">
      {redes.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {redes.map((r) => (
            <a
              key={r.nombre}
              href={/^https?:\/\//.test(r.url) ? r.url : `https://${r.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-chip bg-carta px-3.5 py-2 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:text-tinta hover:ring-brasa/40"
            >
              <span aria-hidden>{r.emoji}</span> {r.nombre}
            </a>
          ))}
        </div>
      )}
      {negocio.direccion && (
        <p className="mt-3 text-[0.8rem] text-frio">📍 {negocio.direccion}</p>
      )}
    </footer>
  );
}
