"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listarPedidos, avanzarPedido, editarItemsPedido, siguientePaso, minutosDesde, esUrgente,
  esRecienLlegado, nivelEspera, esperaLegible, validacionDe, motivoLegible,
  puedeSoltarseEn, COLUMNAS, type PedidoCocina, type ValidacionPago,
} from "@/lib/cocina";
import { soles } from "@/lib/precio";
import { NuevoPedidoLocal } from "@/components/panel/NuevoPedidoLocal";

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
  // Qué comprobante se está mirando. Guarda el ID y no el pedido entero: así
  // el diálogo sigue el dato fresco de cada refresco en vez de congelar una
  // copia vieja mientras está abierto.
  const [viendoPago, setViendoPago] = useState<string | null>(null);
  // Qué pedido se está EDITANDO (2026-08-21): agregar/quitar items incluso ya
  // pagado — el backend cobra la diferencia o avisa el vuelto.
  const [editando, setEditando] = useState<string | null>(null);
  // Qué tarjeta se está arrastrando. Guarda el ID: con él las columnas saben
  // si pueden recibirla y se pintan en consecuencia ANTES de que el dueño
  // llegue con el mouse — enterarse antes es mejor que soltar y que no pase.
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  // El que acaba de aterrizar, para la animación de confirmación. Se limpia
  // solo: si quedara pegado, la tarjeta seguiría destellando para siempre.
  const [aterrizo, setAterrizo] = useState<string | null>(null);
  const [tomandoPedido, setTomandoPedido] = useState(false);
  // Fuerza el recálculo de los minutos sin volver a pedir al backend: la
  // espera crece sola aunque no entre ningún pedido.
  const [, setTic] = useState(0);
  const vivo = useRef(true);

  const traer = useCallback(async () => {
    const r = await listarPedidos();
    if (vivo.current) setPedidos(r);
  }, []);

  // Escape cierra el comprobante. Sin esto el diálogo atrapa a quien navega
  // con teclado: entra con Tab y no tiene cómo salir.
  useEffect(() => {
    if (!viendoPago) return;
    const alTecla = (e: KeyboardEvent) => { if (e.key === "Escape") setViendoPago(null); };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [viendoPago]);

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

    // El destello de aterrizaje va acá y no en el drop: así también confirma
    // el toque del botón. Es el mismo movimiento, se haga como se haga.
    setAterrizo(p.id);
    setTimeout(() => setAterrizo((a) => (a === p.id ? null : a)), 450);

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
          {/* TOMAR UN PEDIDO EN EL LOCAL (2026-08-21). Entra alguien, pide una
              hamburguesa, y hasta hoy no había dónde anotarlo: todo pedido
              nacía de una conversación de WhatsApp. */}
          <button
            type="button"
            onClick={() => setTomandoPedido(true)}
            className="rounded-chip bg-brasa px-3 py-1.5 text-[0.82rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.98]"
          >
            + Nuevo pedido
          </button>
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
          // Mientras se arrastra, cada columna dice si puede recibir ESA
          // tarjeta. Se calcula acá y no en el `onDragOver` para poder
          // pintarlo de entrada, sin esperar a que el mouse llegue.
          const enPuerta = arrastrando ? pedidos.find((x) => x.id === arrastrando) : null;
          const enArrastre = Boolean(enPuerta);
          const puedeRecibir = Boolean(enPuerta && puedeSoltarseEn(enPuerta, col.estado));
          return (
            <section
              key={col.estado}
              // ARRASTRAR Y SOLTAR (2026-08-21). `onDragOver` con
              // `preventDefault` es lo que habilita el drop en HTML nativo:
              // sin eso el navegador rechaza todo y el cursor muestra un "no".
              onDragOver={(e) => { if (puedeRecibir) e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const p = pedidos.find((x) => x.id === e.dataTransfer.getData("text/plain"));
                if (p && puedeSoltarseEn(p, col.estado)) void avanzar(p);
                setArrastrando(null);
              }}
              // Una columna VACÍA se apaga. Antes las cuatro pesaban igual
              // aunque tres estuvieran sin nada, y el ojo tenía que leer los
              // números para saber dónde estaba el trabajo.
              className={`overflow-hidden rounded-tarjeta transition-all ${
                vacia ? "bg-arena/30" : "bg-arena/60"
              } ${enArrastre ? (puedeRecibir ? "recibe" : "no-recibe") : ""}`}
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
                  {suyos.map((p, i) => (
                    <TarjetaPedido
                      key={p.id}
                      pedido={p}
                      // LAS PRIMERAS RESPIRAN, LAS DE ABAJO SE APRIETAN
                      // (2026-08-21, pregunta de Jonathan: "¿qué pasa si tengo
                      // 5 o 6 pedidos al mismo tiempo?"). Antes entraban 4 y el
                      // resto quedaba fuera de vista. Ver COMPLETAS_ARRIBA.
                      compacta={i >= COMPLETAS_ARRIBA}
                      avanzando={avanzando === p.id}
                      onAvanzar={() => avanzar(p)}
                      onVerPago={() => setViendoPago(p.id)}
                      arrastrando={arrastrando === p.id}
                      aterrizo={aterrizo === p.id}
                      onArrastrar={setArrastrando}
                      onEditar={() => setEditando(p.id)}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* El pedido se busca por ID en cada render: si el polling lo avanzó o
          lo sacó de la cocina mientras el diálogo estaba abierto, se cierra
          solo en vez de mostrar algo que ya no existe. */}
      {tomandoPedido && (
        <NuevoPedidoLocal
          onCerrar={() => setTomandoPedido(false)}
          onCreado={() => { setTomandoPedido(false); void traer(); }}
        />
      )}

      {viendoPago && (() => {
        const p = pedidos.find((x) => x.id === viendoPago);
        return p ? <DialogoPago pedido={p} onCerrar={() => setViendoPago(null)} /> : null;
      })()}

      {editando && (() => {
        const p = pedidos.find((x) => x.id === editando);
        return p ? (
          <DialogoEditar
            pedido={p}
            onCerrar={() => setEditando(null)}
            onGuardado={() => { setEditando(null); void traer(); }}
          />
        ) : null;
      })()}
    </div>
  );
}

/**
 * Cuántas tarjetas van completas arriba de cada columna.
 *
 * Medido en pantalla: una completa va de 155 a 206px según cuántos datos
 * traiga, una compacta son 97px fijos, y la columna da ~722.
 *
 * Con DOS completas arriba (unos 340px) sobran ~380 para cuatro compactas:
 * seis pedidos a la vista sin scrollear, contra los cuatro de antes. Con tres
 * completas la cuenta no cerraba —465 + 4×97 pasa de 722— y volvía a scrollear
 * justo en el caso que esto viene a resolver.
 *
 * Las dos de arriba son las que más esperaron (la lista va por antigüedad), o
 * sea las próximas a despacharse: esas conservan dirección y referencia.
 */
const COMPLETAS_ARRIBA = 2;

function TarjetaPedido({
  pedido, compacta, avanzando, onAvanzar, onVerPago,
  arrastrando, aterrizo, onArrastrar, onEditar,
}: {
  pedido: PedidoCocina;
  compacta: boolean;
  avanzando: boolean;
  onAvanzar: () => void;
  onVerPago?: (p: PedidoCocina) => void;
  arrastrando?: boolean;
  aterrizo?: boolean;
  onArrastrar?: (id: string | null) => void;
  onEditar?: () => void;
}) {
  const validacion = validacionDe(pedido);
  const paso = siguientePaso(pedido);
  const minutos = minutosDesde(pedido.creadoEn);
  const nivel = nivelEspera(pedido);
  const urgente = nivel === "urgente";
  const nuevo = esRecienLlegado(pedido);

  // Una tarjeta compacta se ABRE al pasar el mouse o al enfocarla con el
  // teclado: el detalle no se pierde, se pide. `group` deja que los hijos
  // reaccionen a ese estado sin JS ni un `useState` por tarjeta.
  //
  // Lo urgente TAMBIÉN se compacta. Primero se probó exceptuarlo y salió mal:
  // en una cocina cargada media columna pasa los 25 minutos, así que la
  // excepción anulaba la compactación justo cuando más se necesita. La
  // urgencia se marca con el BORDE que respira —se ve igual de lejos y no
  // cuesta alto— y el detalle queda a un hover de distancia.
  const apretada = compacta;

  return (
    <article
      tabIndex={0}
      // ARRASTRABLE solo si tiene a dónde ir. Una tarjeta de "En camino" sin
      // paso siguiente no se levanta: dejarla arrastrar para que no pase nada
      // es peor que no dejarla.
      draggable={Boolean(paso)}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", pedido.id);
        e.dataTransfer.effectAllowed = "move";
        onArrastrar?.(pedido.id);
      }}
      onDragEnd={() => onArrastrar?.(null)}
      className={`group fila-entra rounded-tarjeta bg-carta shadow-[var(--sombra-tarjeta)] transition-all ${
        paso ? "cursor-grab active:cursor-grabbing" : ""
      } ${arrastrando ? "arrastrando" : ""} ${aterrizo ? "aterriza" : ""} ${
        apretada ? "p-2.5" : "p-3"
      } ${
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
        {/* Apretada: solo el emoji, y el primer ítem se sube a esta misma
            línea. La palabra "DELIVERY" completa cuesta una línea entera y el
            ícono ya lo dice. */}
        <span className="min-w-0 truncate text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          {apretada ? (
            <>
              <span aria-hidden>
                {pedido.modalidad === "local" ? "🍽️" : pedido.modalidad === "delivery" ? "🛵" : "🥡"}
              </span>
              <span className="sr-only">
                {pedido.modalidad === "local"
                  ? pedido.mesa ? `Mesa ${pedido.mesa}` : "Mostrador"
                  : pedido.modalidad === "delivery" ? "Delivery" : "Recojo"}
              </span>
              {/* Apretada: la mesa se mantiene visible, es lo que distingue
                  un pedido de otro en una columna llena de mesas. */}
              {pedido.modalidad === "local" && pedido.mesa && (
                <span className="ml-1 normal-case tracking-normal text-tinta-2">
                  {pedido.mesa}
                </span>
              )}
              {pedido.items?.[0] && (
                <span className="ml-1 normal-case tracking-normal text-tinta">
                  <b className="tabular-nums">{pedido.items[0].cantidad}×</b>{" "}
                  {pedido.items[0].nombre}
                  {pedido.items.length > 1 && (
                    <span className="text-frio"> +{pedido.items.length - 1}</span>
                  )}
                </span>
              )}
            </>
          ) : pedido.modalidad === "local" ? (
            // La MESA en vez de la modalidad: al cocinero le dice a dónde va
            // el plato, que es lo que necesita saber.
            pedido.mesa ? `🍽️ Mesa ${pedido.mesa}` : "🍽️ Mostrador"
          ) : pedido.modalidad === "delivery" ? (
            "🛵 Delivery"
          ) : (
            "🥡 Recojo"
          )}
        </span>
        {/* El TIEMPO en grande: es el dato que decide a qué se atiende primero,
            y el que se lee desde lejos. Pasada la hora se escribe "11 h 47" —
            "707′" obliga a dividir mentalmente. */}
        <span className="flex shrink-0 items-baseline gap-1">
          {/* EL PIN: la única señal de que hay dirección detrás. Va acá, al
              lado del tiempo, porque en el pie le robaba ancho al botón y lo
              desbordaba. Se apaga cuando el detalle ya está abierto. */}
          {(pedido.direccion || pedido.referencia) && (
            <span
              aria-hidden
              className="text-[0.7rem] text-frio/50 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
              title="Pasá el mouse para ver la dirección"
            >
              📍
            </span>
          )}
          <span
            className={`text-[0.95rem] font-bold tabular-nums ${
              urgente ? "text-calor-hondo" : nivel === "atencion" ? "text-tibio" : "text-tinta-2"
            }`}
            title={`Entró hace ${minutos} minutos`}
          >
            {esperaLegible(minutos)}
          </span>
        </span>
      </div>

      {pedido.items && pedido.items.length > 0 && (
        <ul
          className={`space-y-0.5 ${
            // Apretada: la lista completa vive escondida y se despliega al
            // pasar el mouse o enfocar — el primer ítem ya se ve arriba.
            apretada
              ? "mt-0 max-h-0 overflow-hidden opacity-0 transition-all group-hover:mt-1.5 group-hover:max-h-40 group-hover:opacity-100 group-focus-within:mt-1.5 group-focus-within:max-h-40 group-focus-within:opacity-100"
              : "mt-1.5"
          }`}
        >
          {/* Apretada: se saltea el PRIMER ítem, que ya está en la cabecera.
              Repetirlo al abrir la tarjeta lo hacía ver como si el pedido
              tuviera dos veces el mismo plato. */}
          {(apretada ? pedido.items.slice(1) : pedido.items).map((it, i) => (
            <li key={i} className="text-[0.88rem] leading-snug text-tinta">
              <b className="tabular-nums">{it.cantidad}×</b> {it.nombre}
            </li>
          ))}
        </ul>
      )}

      {/* LAS NOTAS NUNCA SE ESCONDEN. "Sin cebolla", "poca sal" es información
          de COCINA: si el cocinero tiene que pasar el mouse para enterarse, el
          plato sale mal. Van antes que la dirección por la misma razón. */}
      {pedido.notas && (
        <p className="mt-1 rounded bg-arena px-2 py-1 text-[0.78rem] text-tinta-2">
          {pedido.notas}
        </p>
      )}

      {/* EL COMPROBANTE, A UN CLIC (2026-08-21).

          Confirmar "preparando" YA valida el pago (ver `avanzarEstado` en el
          backend), pero hasta hoy el dueño daba ese visto A CIEGAS: la captura
          se leía y se descartaba. Este chip dice qué se cobró y con qué, y al
          tocarlo se abre la imagen.

          Un chip y no una miniatura: la imagen sumaría ~60px por tarjeta y con
          seis pedidos eso es media pantalla. */}
      {validacion && <ChipPago validacion={validacion} onVer={() => onVerPago?.(pedido)} />}

      {/* LA DIRECCIÓN SE PIDE, NO SE MUESTRA (2026-08-21, idea de Jonathan).
          Antes ocupaba dos renglones fijos en TODAS las tarjetas, y en una
          cocina no se usa para nada: nadie cocina mirando la calle. La necesita
          quien reparte, y en un momento distinto.
          
          Ahora se despliega al pasar el mouse o al enfocar la tarjeta con el
          teclado, igual que en las compactas — la diferencia es que ahora vale
          también para las de arriba. La tarjeta completa gana ~35px y el ojo
          se queda con lo que importa acá: qué plato y hace cuánto. */}
      {(pedido.direccion || pedido.referencia) && (
        <>
          {/* LA PISTA de que hay algo escondido, en su forma más chica: el
              pin solo. Sin ninguna señal la dirección no existe para quien no
              sabe que tiene que pasar el mouse, pero escribir "Dirección y
              referencia" gastaba casi el mismo renglón que la dirección misma
              — cambiaba una línea útil por una inútil. El pin cabe al lado del
              precio, así que no cuesta ni una línea. */}
          <div className="max-h-0 overflow-hidden opacity-0 transition-all group-hover:max-h-40 group-hover:opacity-100 group-focus-within:max-h-40 group-focus-within:opacity-100">
            {pedido.direccion && (
              <p className="mt-1.5 line-clamp-2 text-[0.78rem] text-frio">📍 {pedido.direccion}</p>
            )}
            {/* La REFERENCIA del cliente (2026-08-20): "casa del fondo",
                "portón verde". Se muestra aparte y no pegada a la dirección
                para que se lea como lo que es — una indicación de quien vive
                ahí, no parte del domicilio. */}
            {pedido.referencia && (
              <p className="mt-0.5 line-clamp-2 text-[0.78rem] text-tinta-2">💬 {pedido.referencia}</p>
            )}
          </div>
        </>
      )}

      <div className={`flex items-center justify-between gap-2 ${apretada ? "mt-1.5" : "mt-2.5"}`}>
        <span className="flex shrink-0 items-center gap-1">
          <span
            className={`font-bold tabular-nums text-tinta ${
              apretada ? "text-[0.82rem]" : "text-[0.9rem]"
            }`}
          >
            {soles(pedido.totalCentavos)}
          </span>
          {/* EDITAR EL PEDIDO (2026-08-21): el cliente escribió "agrégame un
              arroz" después de pagar y el push ya te lo contó — este lápiz es
              el botón para actuar. Solo mientras está en cocina: listo o en
              moto ya no cambia lo cocinado. */}
          {onEditar && (pedido.estado === "pagado" || pedido.estado === "preparando") && (
            <button
              type="button"
              onClick={onEditar}
              title="Editar el pedido (agregar o quitar items)"
              aria-label="Editar el pedido"
              className="rounded px-1 text-[0.8rem] text-frio/60 transition hover:bg-arena hover:text-tinta"
            >
              ✏️
            </button>
          )}
        </span>
        {paso && (
          <button
            type="button"
            onClick={onAvanzar}
            disabled={avanzando}
            // En una cocina se toca con las manos ocupadas y a veces mojadas:
            // el botón se estira a lo que sobra en vez de quedar chiquito.
            // EL BOTÓN NO ES EL PROTAGONISTA (2026-08-21, Jonathan: "creo que
            // son muy grandes"). Antes se estiraba con `flex-1` y se comía la
            // tarjeta, compitiendo con el plato —que es lo que la cocina lee.
            // Ahora ocupa lo que su texto necesita y nada más.
            //
            // `whitespace-nowrap` se queda: sin eso "Empezar a preparar" se
            // parte en dos renglones al angostarse la tarjeta.
            className={`shrink-0 whitespace-nowrap rounded-chip bg-brasa font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.98] disabled:opacity-50 ${
              apretada ? "px-2.5 py-1 text-[0.73rem]" : "px-3 py-1.5 text-[0.78rem]"
            }`}
          >
            {avanzando ? "…" : paso.etiqueta}
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * EL CHIP DEL COMPROBANTE.
 *
 * Verde si el modelo validó, ámbar si algo no cuadró. El color es la lectura
 * rápida; el número de operación es lo que el dueño coteja contra su app de
 * Yape. Toda la fila es un botón: en una cocina se toca con prisa y un blanco
 * chico se falla.
 */
function ChipPago({ validacion, onVer }: { validacion: ValidacionPago; onVer: () => void }) {
  const estado = validacion.resultado;
  const revisado = validacion.revisionOk === true;

  // TRES ESTADOS, NO DOS (2026-08-21, observación de Jonathan: "cuando el
  // agente dice NO coinciden los montos... esto no debería pasar").
  //
  // Tenía razón: un rechazo por monto NUNCA llega a Cocina — el bot le pide
  // al cliente la captura correcta y el pedido se queda en `esperando_pago`.
  // Lo que sí llega acá es `pendiente`: el plan Arranque no tiene IA
  // validando, así que la captura entra y espera a que una persona la mire.
  //
  // `rechazado` se contempla igual, pero como el caso raro que es: una
  // confirmación revertida a mano, o un pedido que cambió después de validar.
  const tono =
    estado === "validado"
      ? "bg-brasa-suave text-brasa-texto hover:bg-brasa-suave/70"
      : estado === "pendiente"
        ? "bg-tibio-suave text-tibio hover:bg-tibio-suave/70"
        : "bg-calor-suave text-calor-hondo hover:bg-calor-suave/70";
  const icono = estado === "validado" ? "💳" : estado === "pendiente" ? "👀" : "⚠️";

  return (
    <button
      type="button"
      onClick={onVer}
      className={`mt-1.5 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[0.75rem] transition ${tono}`}
    >
      <span aria-hidden>{icono}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {estado === "pendiente" ? (
          // Sin IA no hay número leído: lo que importa es que hay algo que
          // mirar, no un dato que nadie extrajo.
          "Revisá el pago"
        ) : (
          <>
            {validacion.metodo ? validacion.metodo.toUpperCase() : "Pago"}
            {validacion.nroOperacion && (
              <span className="ml-1 font-normal tabular-nums opacity-80">
                N.° {validacion.nroOperacion}
              </span>
            )}
          </>
        )}
      </span>
      {/* El tilde solo aparece cuando lo confirmó una PERSONA. El visto de la
          IA ya está dicho por el color: mezclarlos haría creer al dueño que
          alguien miró algo que nadie miró. */}
      {revisado && <span aria-label="Confirmado por vos">✓</span>}
      <span aria-hidden className="opacity-50">
        Ver
      </span>
    </button>
  );
}

/**
 * LA CAPTURA, EN GRANDE, CON LO QUE EL MODELO LEYÓ AL LADO.
 *
 * Es el segundo par de ojos que Jonathan pidió: la máquina propone, una
 * persona confirma. Los datos van junto a la imagen para poder cotejarlos sin
 * cambiar de pantalla — que es exactamente lo que el dueño hace con su app de
 * Yape abierta en la otra mano.
 */
function DialogoPago({
  pedido, onCerrar,
}: { pedido: PedidoCocina; onCerrar: () => void }) {
  const v = validacionDe(pedido);
  if (!v) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-4"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        className="surge max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-tarjeta bg-carta p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Comprobante de pago"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Comprobante</p>
            <h2 className="mt-0.5 text-[1.15rem] font-bold text-tinta">
              {soles(pedido.totalCentavos)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-chip px-2 py-1 text-[0.82rem] text-frio transition hover:bg-arena"
          >
            Cerrar
          </button>
        </div>

        {/* El veredicto arriba de todo: es lo primero que el dueño necesita. */}
        <p
          className={`mt-3 rounded px-3 py-2 text-[0.85rem] font-semibold ${
            v.resultado === "validado"
              ? "bg-brasa-suave text-brasa-texto"
              : v.resultado === "pendiente"
                ? "bg-tibio-suave text-tibio"
                : "bg-calor-suave text-calor-hondo"
          }`}
        >
          {v.resultado === "validado"
            ? "El monto, el número y la fecha coinciden."
            : v.resultado === "pendiente"
              ? "Nadie revisó este pago todavía. Cotejalo con tu app."
              : motivoLegible(v.motivo)}
        </p>

        {/* LOS DATOS PRIMERO, LA IMAGEN DESPUÉS.
            Con la captura arriba a tamaño completo, los datos leídos quedaban
            fuera de pantalla y había que scrollear justo para ver lo que hay
            que comparar. Un comprobante de Yape es angosto y muy alto: si se
            le deja el ancho del diálogo, se come toda la vista. */}
        <dl className="mt-3 space-y-1.5 text-[0.85rem]">
          <Dato termino="Monto leído" valor={v.montoCentavos != null ? soles(v.montoCentavos) : "—"} />
          <Dato termino="N.° de operación" valor={v.nroOperacion ?? "—"} />
          <Dato termino="Método" valor={v.metodo ? v.metodo.toUpperCase() : "—"} />
          <Dato
            termino="Lo revisó"
            valor={v.revisadoPor ? v.revisadoPor : v.decidioPor === "ia" ? "El asistente" : "—"}
          />
        </dl>

        {v.capturaUrl ? (
          <figure className="mt-3">
            {/* `max-h` con la imagen centrada: entra completa en la vista y
                sigue siendo legible. Quien necesite mirarla de cerca la abre
                en una pestaña. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.capturaUrl}
              alt="Captura del pago que envió el cliente"
              className="mx-auto max-h-[38vh] w-auto rounded-tarjeta ring-1 ring-linea"
            />
            <figcaption className="mt-1.5 text-center text-[0.76rem] text-frio">
              <a
                href={v.capturaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-tinta"
              >
                Ver la captura en grande
              </a>
            </figcaption>
          </figure>
        ) : (
          // Storage pudo estar caído cuando llegó: el registro se guardó igual,
          // así que hay datos aunque falte la foto.
          <p className="mt-3 rounded-tarjeta bg-arena px-3 py-6 text-center text-[0.85rem] text-frio">
            La imagen no se pudo guardar, pero esto es lo que se leyó.
          </p>
        )}

        <p className="mt-4 text-[0.8rem] leading-snug text-frio">
          Cotejá el número de operación con tu app antes de empezar a preparar.
          Al tocar <b>Empezar a preparar</b> el pago queda confirmado por vos.
        </p>
      </div>
    </div>
  );
}

/**
 * EDITAR UN PEDIDO YA PAGADO (2026-08-21).
 *
 * El caso: el cliente pagó y escribe "agrégame un arroz". El bot escala ese
 * mensaje por push; acá el dueño lo resuelve — agrega, quita o corrige
 * cantidades. La plata la cuadra el backend: si el total sube, el bot le pide
 * la diferencia al cliente por WhatsApp; si baja, avisa el vuelto. El pedido
 * nunca sale de cocina por una edición.
 */
function DialogoEditar({
  pedido, onCerrar, onGuardado,
}: { pedido: PedidoCocina; onCerrar: () => void; onGuardado: () => void }) {
  const [items, setItems] = useState(
    (pedido.items ?? []).map((it) => ({
      nombre: it.nombre, cantidad: it.cantidad, precioCentavos: it.precioCentavos ?? 0,
    })),
  );
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoPrecio, setNuevoPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const total = items.reduce((s, i) => s + i.cantidad * i.precioCentavos, 0);
  const diferencia = total - pedido.totalCentavos;

  const cambiarCantidad = (i: number, delta: number) =>
    setItems((xs) => xs
      .map((x, idx) => (idx === i ? { ...x, cantidad: x.cantidad + delta } : x))
      .filter((x) => x.cantidad > 0));

  function agregarItem() {
    const nombre = nuevoNombre.trim();
    const precio = Math.round(parseFloat(nuevoPrecio.replace(",", ".")) * 100);
    if (!nombre || !Number.isFinite(precio) || precio < 0) return;
    setItems((xs) => [...xs, { nombre, cantidad: 1, precioCentavos: precio }]);
    setNuevoNombre("");
    setNuevoPrecio("");
  }

  async function guardar() {
    if (guardando || items.length === 0) return;
    setGuardando(true);
    setError("");
    const r = await editarItemsPedido(pedido.id, items);
    setGuardando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo guardar"); return; }
    onGuardado();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-4"
      onClick={onCerrar}
      role="presentation"
    >
      <div
        className="surge max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-tarjeta bg-carta p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Editar el pedido"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Editar pedido</p>
            <h2 className="mt-0.5 text-[1.15rem] font-bold text-tinta">{soles(total)}</h2>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-chip px-2 py-1 text-[0.82rem] text-frio transition hover:bg-arena"
          >
            Cerrar
          </button>
        </div>

        <ul className="mt-3 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 border-b border-linea/60 pb-2">
              <span className="min-w-0 flex-1 truncate text-[0.9rem] text-tinta">{it.nombre}</span>
              <span className="shrink-0 text-[0.8rem] tabular-nums text-frio">{soles(it.precioCentavos)}</span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => cambiarCantidad(i, -1)}
                  aria-label={`Quitar uno de ${it.nombre}`}
                  className="grid h-7 w-7 place-items-center rounded-chip bg-arena text-tinta-2 ring-1 ring-linea active:scale-95"
                >
                  −
                </button>
                <span className="w-6 text-center text-[0.9rem] font-bold tabular-nums text-tinta">{it.cantidad}</span>
                <button
                  type="button"
                  onClick={() => cambiarCantidad(i, 1)}
                  aria-label={`Agregar uno de ${it.nombre}`}
                  className="grid h-7 w-7 place-items-center rounded-chip bg-arena text-tinta-2 ring-1 ring-linea active:scale-95"
                >
                  +
                </button>
              </span>
            </li>
          ))}
        </ul>

        {/* Ítem libre: lo que el cliente pidió puede no estar en la carta
            ("ají aparte", "porción extra"). Nombre + precio y listo. */}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={nuevoNombre}
            onChange={(e) => setNuevoNombre(e.target.value.slice(0, 80))}
            placeholder="Agregar algo (ej. Arroz chaufa)"
            className="min-w-0 flex-1 rounded-xl bg-arena px-3 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
          />
          <input
            value={nuevoPrecio}
            onChange={(e) => setNuevoPrecio(e.target.value.replace(/[^0-9.,]/g, ""))}
            placeholder="S/"
            inputMode="decimal"
            className="w-20 rounded-xl bg-arena px-3 py-2 text-[0.88rem] tabular-nums text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
          />
          <button
            type="button"
            onClick={agregarItem}
            className="shrink-0 rounded-chip bg-arena px-3 py-2 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea active:scale-95"
          >
            +
          </button>
        </div>

        {/* QUÉ VA A PASAR CON LA PLATA, antes de guardar: nada de sorpresas
            — ni para el dueño ni para el cliente. */}
        {diferencia !== 0 && items.length > 0 && (
          <p
            className={`mt-3 rounded px-3 py-2 text-[0.85rem] font-semibold ${
              diferencia > 0 ? "bg-tibio-suave text-tibio" : "bg-calor-suave text-calor-hondo"
            }`}
          >
            {diferencia > 0
              ? `El bot le pedirá ${soles(diferencia)} de diferencia al cliente por WhatsApp.`
              : `Quedará un vuelto de ${soles(-diferencia)} a coordinar con el cliente.`}
          </p>
        )}
        {items.length === 0 && (
          <p className="mt-3 rounded bg-calor-suave px-3 py-2 text-[0.85rem] font-semibold text-calor-hondo">
            Un pedido no puede quedar vacío. Si ya no va, cancélalo desde la tarjeta.
          </p>
        )}
        {error && <p className="mt-2 text-[0.85rem] font-semibold text-alerta">{error}</p>}

        <button
          type="button"
          onClick={guardar}
          disabled={guardando || items.length === 0}
          className="mt-4 w-full rounded-tarjeta bg-brasa py-3 text-[0.95rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-linea/60 pb-1">
      <dt className="text-frio">{termino}</dt>
      <dd className="font-semibold tabular-nums text-tinta">{valor}</dd>
    </div>
  );
}
