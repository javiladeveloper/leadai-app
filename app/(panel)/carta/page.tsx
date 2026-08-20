"use client";

/**
 * LA CARTA DEL RESTAURANTE (2026-08-17).
 *
 * Acá el dueño arma lo que su cliente ve en /c/[tenantId] y lo que el bot lee
 * cuando alguien pide por chat. Es la misma fuente para los dos: el bot NO
 * calcula nada, solo mira lo que hay acá.
 *
 * Se movió desde la app móvil a propósito: cargar 40 platos con el pulgar es
 * donde el dueño abandona. La app abre esta pantalla en el navegador.
 *
 * Tres pestañas porque son tres trabajos distintos con ritmos distintos:
 * los PLATOS se tocan a diario (se acabó el lomo), los EXTRAS se arman una vez
 * y casi no cambian, las PROMOS van y vienen por temporada.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerEmpresaActiva } from "@/lib/auth";
import {
  obtenerCarta, crearCategoria, eliminarCategoria,
  crearProducto, actualizarProducto, marcarDisponible, eliminarProducto,
  crearGrupo, actualizarGrupo, eliminarGrupo,
  crearCombo, eliminarCombo,
  crearDescuento, actualizarDescuento, eliminarDescuento,
  subirFotoProducto, quitarFotoProducto, subirFoto, leerFoto,
  aCentavos, precioTexto, porcentajeDescuento, resumenDescuento, sinTildes, DIAS,
  CATEGORIA_COMBOS,
  obtenerNegocio,
  type Carta, type ProductoCarta, type GrupoOpciones, type ComboCarta, type DescuentoCarta,
  type NegocioCarta,
} from "@/lib/carta";
import { CampoFoto, useFoto } from "@/components/panel/CampoFoto";
import { SkeletonLista } from "@/components/Skeletons";
import { MarcaCarta } from "@/components/panel/MarcaCarta";
import { Seccion } from "@/components/panel/Seccion";

type Pestana = "platos" | "extras" | "combos" | "promos" | "marca";

export default function CartaPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [carta, setCarta] = useState<Carta | null>(null);
  const [pestana, setPestana] = useState<Pestana>("platos");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  async function cargar() {
    const c = await obtenerCarta();
    if (c) { setCarta(c); setEstado("ok"); } else setEstado("error");
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (listo) cargar(); }, [listo]);

  // Solo para el LINK: el resto de la marca la edita `MarcaCarta` por su lado.
  const [negocio, setNegocio] = useState<NegocioCarta | null>(null);
  useEffect(() => {
    if (listo) void obtenerNegocio().then(setNegocio);
  }, [listo]);

  const tenant = leerEmpresaActiva();
  // EL LINK CORTO (2026-08-20): `/c/shiro` en vez de `/c/cmswn...`. El id
  // sigue siendo el fallback —la ruta pública acepta los dos— para el negocio
  // que todavía no tiene slug y para el instante antes de que cargue.
  const enlacePublico = tenant
    ? `${window.location.origin}/c/${negocio?.slug || tenant}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Pedidos</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Carta y precios</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Lo que cargues acá es lo que ve tu cliente y lo que el bot usa para tomar pedidos.
        </p>
      </header>

      {/* El link que se comparte. Es el producto de esta pantalla: sin esto el
          dueño configura su carta y no sabe dónde quedó. */}
      {enlacePublico && <EnlaceCarta url={enlacePublico} />}

      {error && (
        <div className="rounded-tarjeta bg-alerta/10 px-4 py-3 text-[0.9rem] font-semibold text-alerta ring-1 ring-alerta/30">
          {error}
        </div>
      )}

      {/* SIN `flex-1` Y CON SCROLL (2026-08-19): con cinco pestañas repartiéndose
          a partes iguales el ancho de un teléfono, a cada una le tocaban ~68px y
          "Tu marca" —la más larga— salía cortada, ilegible. Ahora cada pestaña
          ocupa lo que su texto necesita y la barra se arrastra con el dedo, como
          la de secciones de la carta pública. En pantalla ancha sobra espacio y
          se ve igual que antes. */}
      <nav className="flex gap-1 overflow-x-auto rounded-tarjeta bg-carta p-1 ring-1 ring-linea [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          ["platos", "Platos"],
          ["extras", "Extras"],
          ["combos", "Combos"],
          ["promos", "Promos"],
          // La MARCA va última: se toca una vez al empezar y casi nunca más,
          // a diferencia de los platos.
          ["marca", "Tu marca"],
        ] as [Pestana, string][]).map(([id, nombre]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`shrink-0 grow whitespace-nowrap rounded-lg px-3.5 py-2 text-[0.9rem] font-semibold transition ${
              pestana === id ? "bg-brasa text-sobre-brasa" : "text-tinta-2 hover:bg-arena"
            }`}
          >
            {nombre}
          </button>
        ))}
      </nav>

      {estado === "cargando" && <SkeletonLista filas={4} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar la carta. Recargá.</p>
        </div>
      )}

      {estado === "ok" && carta && (
        <>
          {pestana === "platos" && (
            <Platos carta={carta} recargar={cargar} avisar={setError} />
          )}
          {pestana === "extras" && (
            <Extras carta={carta} recargar={cargar} avisar={setError} />
          )}
          {pestana === "combos" && (
            <Combos carta={carta} recargar={cargar} avisar={setError} />
          )}
          {pestana === "promos" && (
            <Promos carta={carta} recargar={cargar} avisar={setError} />
          )}
          {pestana === "marca" && <MarcaCarta />}
        </>
      )}
    </div>
  );
}

/** El link de la carta, listo para copiar y mandar por WhatsApp. */
function EnlaceCarta({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-superficie-honda px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[0.78rem] font-bold uppercase tracking-wide text-orbita">
          El link de tu carta
        </p>
        {/* El link en menta sobre el oscuro: 7.1:1, y es el dato que el dueño
            viene a buscar acá. */}
        <p className="truncate text-[0.9rem] font-medium text-brasa">{url}</p>
      </div>
      <button
        onClick={copiar}
        className="rounded-lg bg-orbita px-4 py-2 text-[0.85rem] font-semibold text-sobre-orbita transition hover:bg-orbita-hondo"
      >
        {copiado ? "¡Copiado!" : "Copiar"}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="rounded-lg px-3 py-2 text-[0.85rem] font-semibold text-arena/80 transition hover:text-arena hover:underline"
      >
        Ver ↗
      </a>
    </div>
  );
}

// ── Platos ────────────────────────────────────────────────────────────

/**
 * EL RETARDO DE CADA FILA (2026-08-20).
 *
 * Las filas entran ESCALONADAS, no todas juntas. Un bloque entero apareciendo
 * de golpe se lee como un parpadeo; una atrás de otra se lee como una lista que
 * se está sirviendo, y el ojo alcanza a ver cuántas son.
 *
 * Se corta en la fila 8: más allá el retardo acumulado haría esperar a alguien
 * que solo quiere editar el precio del plato 20.
 */
function retardo(i: number): React.CSSProperties {
  return { animationDelay: `${Math.min(i, 8) * 40}ms` };
}

/**
 * El botón principal de cada pestaña. Era el MISMO markup repetido cuatro
 * veces con diferencias mínimas entre copias — cambiar el estilo obligaba a
 * acordarse de las cuatro.
 */
function BotonNuevo({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-tarjeta bg-orbita px-5 py-2.5 font-semibold text-sobre-orbita shadow-[0_2px_10px_rgba(0,0,0,0.10)] transition hover:bg-orbita-hondo hover:shadow-[0_4px_16px_rgba(0,0,0,0.16)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

/**
 * Las acciones de una fila (Agotar, Eliminar…).
 *
 * ANTES ERAN TEXTO SUELTO (2026-08-20): "Agotar" y "Eliminar" tenían el mismo
 * peso que el nombre del plato, así que cada fila terminaba en un renglón de
 * palabras sin jerarquía y no se veía qué era clickeable. Ahora son chips: se
 * leen como controles, y lo destructivo solo se pone rojo al apuntarlo.
 */
function AccionFila({
  children, onClick, peligro = false, hondo = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  peligro?: boolean;
  /** Va sobre el verde hondo, no sobre una tarjeta blanca. */
  hondo?: boolean;
}) {
  // SOBRE EL VERDE HONDO los grises `frio`/`tinta-2` no llegan a contraste
  // legible: ahí el texto es arena, como la bajada de `Seccion`.
  const colores = hondo
    ? "text-arena/60 hover:bg-arena/10 hover:text-arena"
    : peligro
      ? "text-frio hover:bg-alerta/10 hover:text-alerta"
      : "text-tinta-2 hover:bg-arena hover:text-tinta";

  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold transition active:scale-[0.97] ${colores}`}
    >
      {children}
    </button>
  );
}

/**
 * LAS CLASES DE UN INPUT DE HOJA (2026-08-20).
 *
 * Estaban escritas a mano en cada campo de las cuatro hojas —unas veinte
 * copias— con diferencias que nadie eligió: algunos tenían `focus`, otros no.
 * El foco importa: sin un borde que responda, en un formulario largo no se ve
 * dónde está parado el cursor.
 */
const CAMPO_HOJA =
  "w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25";

/**
 * EL MARCO DE UNA HOJA (2026-08-20).
 *
 * Las cuatro hojas repetían el mismo armazón con un `<h2>` suelto arriba y los
 * botones al final del scroll. Dos problemas reales:
 *
 *  - En una hoja larga (un plato con extras) el botón "Guardar" quedaba abajo
 *    de todo: había que scrollear hasta el fondo para guardar, y en el celular
 *    ni se veía que existía.
 *  - El título se iba con el scroll, así que a media hoja no se sabía si se
 *    estaba editando un plato o creando uno nuevo.
 *
 * Ahora el encabezado y el pie quedan FIJOS y solo el medio scrollea.
 */
function Hoja({
  titulo, bajada, cerrar, children, pie,
}: {
  titulo: string;
  bajada?: string;
  cerrar: () => void;
  children: React.ReactNode;
  pie: React.ReactNode;
}) {
  return (
    <div
      className="aparece fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={cerrar}
    >
      <div
        className="sube flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-carta shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <div className="flex items-start gap-3 border-b border-linea px-6 pb-3 pt-5">
          <span className="mt-1 h-5 w-1 shrink-0 rounded-full bg-orbita" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.15rem] font-bold leading-tight text-tinta">{titulo}</h2>
            {bajada && <p className="mt-0.5 text-[0.82rem] leading-snug text-frio">{bajada}</p>}
          </div>
          {/* La ✕ (2026-08-20): se cerraba tocando afuera o con "Cancelar" abajo
              de todo. En el celular, con el teclado abierto, no había ninguna
              de las dos a mano. */}
          <button
            onClick={cerrar}
            aria-label="Cerrar"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-frio transition hover:bg-arena hover:text-tinta active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="scroll-fino min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>

        <div className="flex gap-2 border-t border-linea bg-carta px-6 py-4">{pie}</div>
      </div>
    </div>
  );
}

/** Los dos botones del pie de una hoja: cancelar y la acción real. */
function PieHoja({
  cerrar, guardar, guardando, puedeGuardar, etiqueta = "Guardar",
}: {
  cerrar: () => void;
  guardar: () => void;
  guardando: boolean;
  puedeGuardar: boolean;
  etiqueta?: string;
}) {
  return (
    <>
      <button
        onClick={cerrar}
        className="flex-1 rounded-tarjeta px-4 py-2.5 font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena active:scale-[0.98]"
      >
        Cancelar
      </button>
      <button
        onClick={guardar}
        disabled={guardando || !puedeGuardar}
        className="flex-[1.4] rounded-tarjeta bg-orbita px-4 py-2.5 font-semibold text-sobre-orbita shadow-[0_2px_10px_rgba(0,0,0,0.10)] transition hover:bg-orbita-hondo hover:shadow-[0_4px_16px_rgba(0,0,0,0.16)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
      >
        {guardando ? "Guardando…" : etiqueta}
      </button>
    </>
  );
}

/**
 * El vacío de una pestaña. Con ícono grande y una sola frase de por qué
 * conviene llenarlo: una pantalla en blanco no dice qué hacer.
 */
function Vacio({
  icono, titulo, texto,
}: { icono: string; titulo: string; texto: string }) {
  // TARJETA BLANCA A PROPÓSITO: va dentro de una `Seccion` honda, así que si
  // heredara los colores del contenedor quedaría tinta oscura sobre verde
  // oscuro — ilegible. Blanca destaca sobre el fondo y se lee sola.
  return (
    <div className="surge rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
      <p className="text-[2rem] leading-none" aria-hidden>{icono}</p>
      <p className="mt-2 text-[1.05rem] font-bold text-tinta">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-[0.9rem] leading-snug text-frio">{texto}</p>
    </div>
  );
}

function Platos({
  carta, recargar, avisar,
}: { carta: Carta; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);
  const [editando, setEditando] = useState<ProductoCarta | null>(null);

  // Los platos agrupados por sección, en el orden de las secciones. Los que no
  // tienen sección van al final bajo "Sin sección" — no se esconden: un plato
  // invisible en el editor es un plato que el dueño cree que borró.
  const porSeccion = useMemo(() => {
    const grupos = carta.categorias.map((c) => ({
      categoria: c,
      platos: carta.productos.filter((p) => p.categoriaId === c.id),
    }));
    const sueltos = carta.productos.filter((p) => !p.categoriaId);
    if (sueltos.length) grupos.push({ categoria: null as never, platos: sueltos });
    return grupos;
  }, [carta]);

  async function agotar(p: ProductoCarta) {
    const r = await marcarDisponible(p.id, !p.disponible);
    if (!r.ok) avisar(r.error ?? "No se pudo cambiar");
    await recargar();
  }

  async function borrar(p: ProductoCarta) {
    if (!confirm(`¿Borrar "${p.nombre}" de la carta?`)) return;
    const r = await eliminarProducto(p.id);
    if (!r.ok) avisar(r.error ?? "No se pudo borrar");
    await recargar();
  }

  const total = carta.productos.length;
  const agotados = carta.productos.filter((p) => !p.disponible).length;

  return (
    <Seccion
      titulo="Tus platos"
      bajada={
        total === 0
          ? "Lo que tus clientes van a poder pedir."
          : `${total} ${total === 1 ? "plato" : "platos"} en ${carta.categorias.length} ${
              carta.categorias.length === 1 ? "sección" : "secciones"
            }${agotados > 0 ? ` · ${agotados} agotado${agotados === 1 ? "" : "s"}` : ""}`
      }
      tono="hondo"
      accion={
        <BotonNuevo onClick={() => { setEditando(null); setAbriendo(true); }}>
          + Nuevo plato
        </BotonNuevo>
      }
    >
      <div className="space-y-5">
        <NuevaSeccion recargar={recargar} avisar={avisar} />

        {carta.productos.length === 0 && carta.categorias.length === 0 && (
          <Vacio
            icono="🍽️"
            titulo="Tu carta está vacía"
            texto="Carga tu primer plato para que tus clientes puedan pedirlo."
          />
        )}

        {porSeccion.map(({ categoria, platos }, iSeccion) => (
          <section
            key={categoria?.id ?? "sueltos"}
            className="surge space-y-2"
            style={retardo(iSeccion)}
          >
            {/* EL ENCABEZADO DE SECCIÓN, CON PESO (2026-08-20): antes era una
                línea gris del mismo tamaño que todo lo demás, así que las
                secciones no se veían y la pestaña parecía una sola lista larga.
                Ahora lleva el conteo al costado y una línea que cierra el
                bloque, para que se vea dónde termina cada sección. */}
            {/* SOBRE EL VERDE HONDO, TEXTO ARENA (2026-08-20): el encabezado
                iba en `text-tinta` —tinta oscura sobre fondo oscuro— y el
                nombre de la sección directamente NO SE VEÍA. Todo lo que va
                fuera de las tarjetas blancas toma los colores de la superficie
                honda, igual que la bajada de `Seccion`. */}
            <div className="flex items-center gap-2 border-b border-arena/15 pb-1.5">
              <span className="h-4 w-1 shrink-0 rounded-full bg-orbita" aria-hidden />
              <h3 className="text-[0.78rem] font-bold uppercase tracking-wide text-arena">
                {categoria?.nombre ?? "Sin sección"}
              </h3>
              <span className="rounded-chip bg-arena/15 px-2 py-0.5 text-[0.7rem] font-bold tabular-nums text-arena/80">
                {platos.length}
              </span>
              {categoria && (
                <div className="ml-auto">
                  <AccionFila
                    hondo
                    onClick={async () => {
                      // Los platos NO se van con la sección: quedan sueltos.
                      // Borrar "Entradas" no puede llevarse ocho por delante.
                      if (!confirm(`¿Borrar la sección "${categoria.nombre}"? Los platos quedan sin sección.`)) return;
                      const r = await eliminarCategoria(categoria.id);
                      if (!r.ok) avisar(r.error ?? "No se pudo borrar");
                      await recargar();
                    }}
                  >
                    Borrar sección
                  </AccionFila>
                </div>
              )}
            </div>

            {platos.length === 0 && (
              <p className="px-1 py-2 text-[0.85rem] text-arena/50">Sin platos todavía.</p>
            )}

            {platos.map((p, i) => (
              <div
                key={p.id}
                style={retardo(i)}
                /* LA BARRA DE ESTADO A LA IZQUIERDA (2026-08-20): verde el que
                   se está vendiendo, gris el agotado. Antes el agotado era solo
                   `opacity-60` —que de un vistazo se confunde con una fila
                   normal— y el disponible no tenía nada. Con la barra, cuáles
                   están en venta se barre sin leer una palabra. */
                className={`fila-entra tarjeta-viva group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta border-l-4 bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition ${
                  p.disponible
                    ? "border-ok hover:ring-orbita/40"
                    : "border-frio/40 opacity-70"
                }`}
              >
                {p.fotoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={p.fotoUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-orbita/35 transition group-hover:ring-orbita/70"
                  />
                ) : (
                  /* UN HUECO CON FORMA (2026-08-20): sin foto la fila arrancaba
                     pegada al borde y las filas con y sin foto no alineaban
                     entre sí. Además el marco vacío se lee como "acá falta la
                     foto", que es información útil para el dueño. */
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-arena-2 text-[1.1rem] opacity-45 ring-1 ring-linea"
                    aria-hidden
                  >
                    🍽️
                  </span>
                )}
                <button
                  onClick={() => { setEditando(p); setAbriendo(true); }}
                  className="min-w-[9rem] flex-1 text-left"
                >
                  <p className="font-semibold text-tinta transition group-hover:text-brasa-texto">
                    {p.nombre}
                  </p>
                  {p.descripcion && (
                    /* En la lista va en UNA línea a propósito: son muchas filas
                       y la altura tiene que ser pareja para barrerlas de un
                       vistazo. Los renglones se unen con "·" en vez de perderse
                       pegados uno contra otro. El detalle completo se ve al
                       abrir el plato y en la carta pública. */
                    <p className="truncate text-[0.8rem] text-frio">
                      {p.descripcion.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {p.grupos.length > 0 && (
                    <p className="text-[0.75rem] text-frio">
                      + {p.grupos.length} {p.grupos.length === 1 ? "grupo de extras" : "grupos de extras"}
                    </p>
                  )}
                </button>
                <span className="font-bold tabular-nums text-calor">{precioTexto(p.precioCentavos)}</span>
                {!p.disponible && (
                  <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-frio">
                    Agotado
                  </span>
                )}
                <AccionFila onClick={() => agotar(p)}>
                  {p.disponible ? "Agotar" : "Reponer"}
                </AccionFila>
                <AccionFila peligro onClick={() => borrar(p)}>
                  Eliminar
                </AccionFila>
              </div>
            ))}
          </section>
        ))}

        {abriendo && (
          <HojaPlato
            carta={carta}
            plato={editando}
            cerrar={() => setAbriendo(false)}
            recargar={recargar}
            avisar={avisar}
          />
        )}
      </div>
    </Seccion>
  );
}

function NuevaSeccion({
  recargar, avisar,
}: { recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function crear() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const r = await crearCategoria(nombre.trim());
    setGuardando(false);
    if (!r.ok) { avisar(r.error ?? "No se pudo crear"); return; }
    setNombre("");
    await recargar();
  }

  // VA SOBRE EL VERDE HONDO (2026-08-20): el botón "Agregar" era
  // `text-brasa-texto` —pensado para tarjeta blanca— y sobre el fondo oscuro
  // apenas se distinguía.
  //
  // SIN CAJA ALREDEDOR (segunda pasada): meter los dos controles en un recuadro
  // `bg-arena/5` le daba al bloque el peso de una tarjeta y el conjunto se leía
  // APAGADO, como si estuviera deshabilitado. Van sueltos sobre el fondo, y el
  // botón solo aparece cuando hay algo escrito — hasta entonces no hay ninguna
  // acción que ofrecer.
  const listo = nombre.trim().length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
        placeholder="Nueva sección (Entradas, Bebidas…)"
        aria-label="Nombre de la nueva sección"
        className="min-w-0 flex-1 rounded-lg border border-arena/25 bg-transparent px-3 py-2 text-[0.88rem] text-arena transition placeholder:text-arena/45 focus:border-orbita focus:bg-arena/10 focus:outline-none focus:ring-2 focus:ring-orbita/30 sm:w-64 sm:flex-none"
      />
      {listo && (
        <button
          onClick={crear}
          disabled={guardando}
          className="fila-entra shrink-0 rounded-lg bg-orbita px-3.5 py-2 text-[0.85rem] font-semibold text-sobre-orbita transition hover:bg-orbita-hondo active:scale-[0.98] disabled:opacity-50"
        >
          {guardando ? "Creando…" : "Agregar sección"}
        </button>
      )}
    </div>
  );
}

/** Alta y edición de un plato. */
function HojaPlato({
  carta, plato, cerrar, recargar, avisar,
}: {
  carta: Carta;
  plato: ProductoCarta | null;
  cerrar: () => void;
  recargar: () => Promise<void>;
  avisar: (s: string) => void;
}) {
  const [nombre, setNombre] = useState(plato?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plato?.descripcion ?? "");
  // El precio vive como TEXTO mientras se escribe: si se guardara como número,
  // teclear "19." lo volvería 19 y el cursor saltaría.
  const [precio, setPrecio] = useState(plato ? (plato.precioCentavos / 100).toFixed(2) : "");
  // El precio ANTES, para el tachado. Opcional: vacío = sin descuento.
  const [precioAntes, setPrecioAntes] = useState(
    plato?.precioAntesCentavos ? (plato.precioAntesCentavos / 100).toFixed(2) : "",
  );
  const [categoriaId, setCategoriaId] = useState(plato?.categoriaId ?? "");
  const [grupoIds, setGrupoIds] = useState<string[]>(plato?.grupos.map((g) => g.grupoId) ?? []);
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");
  // La foto se muestra al instante desde el navegador (`vista`) y recién viaja
  // al servidor al guardar: en un plato NUEVO no hay id al que subirla todavía,
  // y hacer dos viajes seguidos dejaría el plato creado a medias si el segundo
  // falla. `vista` es la data URL; `quitar` marca que había una y se sacó.
  const [vista, setVista] = useState<string | null>(plato?.fotoUrl ?? null);
  const [fotoNueva, setFotoNueva] = useState<string | null>(null);
  const [quitarLaFoto, setQuitarLaFoto] = useState(false);

  const centavos = aCentavos(precio);
  const puedeGuardar = nombre.trim().length > 0 && centavos !== null;

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponle un nombre al plato."); return; }
    if (centavos === null) { setErrorCampo("El precio tiene que ser un número, como 19.90."); return; }
    if (precioAntes.trim()) {
      const antes = aCentavos(precioAntes);
      if (antes === null) { setErrorCampo("El precio anterior tiene que ser un número."); return; }
      if (antes <= centavos) {
        setErrorCampo("El precio anterior tiene que ser MAYOR al que cobras — si no, no hay descuento que mostrar.");
        return;
      }
    }

    setErrorCampo("");
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      precioCentavos: centavos,
      // Cadena VACÍA y no `undefined`: en un PATCH, `undefined` significa "no
      // toques este campo", así que borrar la descripción de un plato que ya
      // la tenía no haría nada. (Tampoco `null`: el backend la valida como
      // string opcional y rechazaría el null explícito.)
      // `null` explícito y no `undefined`: en un PATCH, `undefined` significa
      // "no toques", así que quitar el precio tachado no haría nada.
      precioAntesCentavos: precioAntes.trim() ? aCentavos(precioAntes) : null,
      descripcion: descripcion.trim(),
      categoriaId: categoriaId || null,
      grupoIds,
    };
    // Editar y crear se resuelven por separado porque solo el alta devuelve el
    // producto (con el id que la foto necesita).
    let id: string | undefined;
    let error: string | undefined;
    if (plato) {
      const r = await actualizarProducto(plato.id, datos);
      if (r.ok) id = plato.id;
      else error = r.error;
    } else {
      const r = await crearProducto(datos);
      if (r.ok) id = r.dato?.id;
      else error = r.error;
    }

    if (error) { setGuardando(false); setErrorCampo(error); return; }

    // La foto va DESPUÉS: un plato nuevo no tiene id hasta que el backend lo
    // crea. Si la subida falla, el plato igual quedó guardado — se avisa pero
    // no se pierde lo que el dueño escribió.
    if (id) {
      if (fotoNueva) {
        const f = await subirFotoProducto(id, fotoNueva);
        if (!f.ok) avisar(f.error ?? "El plato se guardó, pero la foto no subió.");
      } else if (quitarLaFoto) {
        await quitarFotoProducto(id);
      }
    }

    setGuardando(false);
    await recargar();
    cerrar();
  }

  return (
    <Hoja
      titulo={plato ? "Editar plato" : "Nuevo plato"}
      bajada={plato ? plato.nombre : "Lo que el cliente ve y pide en tu carta."}
      cerrar={cerrar}
      pie={
        <PieHoja
          cerrar={cerrar}
          guardar={guardar}
          guardando={guardando}
          puedeGuardar={puedeGuardar}
        />
      }
    >
      <div className="space-y-4">
        <Campo etiqueta="Nombre">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Lomo saltado"
            autoFocus
            className={CAMPO_HOJA}
          />
        </Campo>

          {/* La foto va ARRIBA de todo: es lo primero que ve el cliente en la
              carta, y ponerla al final la convierte en algo opcional que nadie
              carga. */}
          <Campo etiqueta="Foto" ayuda="Opcional — JPG, PNG o WebP, hasta 5MB">
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <span className="sr-only">Elegir la foto del plato</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const archivo = e.target.files?.[0];
                    // Se limpia el input para que elegir la MISMA foto otra vez
                    // vuelva a disparar el onChange.
                    e.target.value = "";
                    if (!archivo) return;
                    const r = await leerFoto(archivo);
                    if (!r.ok) { setErrorCampo(r.error); return; }
                    setErrorCampo("");
                    setVista(r.datos);
                    setFotoNueva(r.datos);
                    setQuitarLaFoto(false);
                  }}
                />
                {vista ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={vista}
                    alt="Foto del plato"
                    className="h-20 w-20 rounded-lg object-cover ring-1 ring-linea"
                  />
                ) : (
                  <span className="grid h-20 w-20 place-items-center rounded-lg border-2 border-dashed border-linea text-[1.6rem] text-frio hover:border-brasa hover:text-brasa-texto">
                    +
                  </span>
                )}
              </label>
              {vista && (
                <button
                  onClick={() => { setVista(null); setFotoNueva(null); setQuitarLaFoto(true); }}
                  className="text-[0.85rem] font-semibold text-frio hover:text-alerta"
                >
                  Quitar
                </button>
              )}
            </div>
          </Campo>

          <Campo etiqueta="Precio" ayuda="En soles, como 19.90">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-frio">S/</span>
                  <input
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    inputMode="decimal"
                    placeholder="19.90"
                    className="w-28 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
                  />
                </div>
                <p className="mt-1 text-[0.72rem] text-frio">Lo que cobras</p>
              </div>

              {/* El precio ANTES (2026-08-17). Un tachado al lado con el % de
                  descuento vende más que el precio a secas: el cliente ve el
                  ahorro en vez de tener que creerlo. Es lo que hacen todos los
                  que venden comida por internet. */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-frio">S/</span>
                  <input
                    value={precioAntes}
                    onChange={(e) => setPrecioAntes(e.target.value)}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label="Precio anterior, para mostrarlo tachado"
                    className="w-28 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
                  />
                </div>
                <p className="mt-1 text-[0.72rem] text-frio">Antes (opcional)</p>
              </div>

              {/* La cuenta hecha, en vivo: sin esto el dueño pone un "antes"
                  cualquiera y se entera del descuento recién al publicarlo. */}
              {(() => {
                const a = precioAntes.trim() ? aCentavos(precioAntes) : null;
                const p = aCentavos(precio);
                const pct = a !== null && p !== null ? porcentajeDescuento(a, p) : null;
                if (!pct) return null;
                return (
                  <div className="pb-6">
                    <span className="rounded-chip bg-orbita px-2.5 py-1 text-[0.8rem] font-bold text-sobre-orbita">
                      −{pct}%
                    </span>
                  </div>
                );
              })()}
            </div>
            <p className="mt-2 text-[0.78rem] text-frio">
              Pon un precio anterior y tu plato se muestra con el descuento tachado. Vende más.
            </p>
          </Campo>

          {/* 4 renglones y no 2: la gente lista los ingredientes uno por línea
              (feedback 2026-08-17 — "pan / lechuga / cremas" no entraba y había
              que scrollear dentro de un recuadro diminuto). `resize-y` deja
              estirarlo si la lista es más larga. */}
          <Campo etiqueta="Descripción" ayuda="Opcional — lo que lleva el plato">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={4}
              placeholder={"Pan artesanal\nLechuga\nCremas de la casa"}
              className="w-full resize-y rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-[0.9rem] text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
            />
          </Campo>

          {/* Sin secciones creadas el desplegable ofrece una sola opción y no
              se entiende para qué está: mejor decir cómo se crean. */}
          {carta.categorias.length === 0 ? (
            <Campo etiqueta="Sección">
              <p className="rounded-lg bg-arena/50 px-3 py-2.5 text-[0.85rem] text-frio">
                Todavía no tienes secciones. Crea una (Entradas, Bebidas…) desde la
                lista de platos y después podés mover este plato ahí.
              </p>
            </Campo>
          ) : (
            <Campo etiqueta="Sección">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              >
                <option value="">Sin sección</option>
                {carta.categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
          )}

          {carta.grupos.length > 0 && (
            <Campo etiqueta="Extras" ayuda="Qué se le puede agregar a este plato">
              <div className="space-y-1.5">
                {carta.grupos.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2.5 text-[0.9rem] text-tinta-2">
                    <input
                      type="checkbox"
                      checked={grupoIds.includes(g.id)}
                      onChange={(e) =>
                        setGrupoIds((prev) =>
                          e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id),
                        )
                      }
                      className="size-4 accent-[var(--color-brasa)]"
                    />
                    <span>{g.nombre}</span>
                    <span className="text-[0.78rem] text-frio">
                      {g.opciones.length} {g.opciones.length === 1 ? "opción" : "opciones"}
                    </span>
                  </label>
                ))}
              </div>
            </Campo>
          )}

          {errorCampo && (
            <p className="fila-entra rounded-lg bg-alerta/10 px-3 py-2 text-[0.85rem] font-semibold text-alerta">
              {errorCampo}
            </p>
          )}
      </div>
    </Hoja>
  );
}

function Campo({
  etiqueta, ayuda, children,
}: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.8rem] font-bold text-tinta-2">{etiqueta}</span>
      {ayuda && <span className="ml-2 text-[0.78rem] text-frio">{ayuda}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

// ── Extras ────────────────────────────────────────────────────────────

function Extras({
  carta, recargar, avisar,
}: { carta: Carta; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);
  const [editando, setEditando] = useState<GrupoOpciones | null>(null);

  async function borrar(g: GrupoOpciones) {
    const usanEste = carta.productos.filter((p) => p.grupos.some((x) => x.grupoId === g.id)).length;
    // SE AVISA A CUÁNTOS PLATOS AFECTA (2026-08-20): borrar un grupo lo
    // desengancha de todos los platos que lo usaban, y "Salsa extra" está en
    // 39. Volver a tildarlos uno por uno es media hora de trabajo que nadie
    // eligió al tocar "Eliminar".
    const aviso = usanEste > 0
      ? `¿Borrar el grupo "${g.nombre}"?\n\nLo usan ${usanEste} ${usanEste === 1 ? "plato" : "platos"} y van a quedar sin él.`
      : `¿Borrar el grupo "${g.nombre}"?`;
    if (!confirm(aviso)) return;
    const r = await eliminarGrupo(g.id);
    if (!r.ok) avisar(r.error ?? "No se pudo borrar");
    await recargar();
  }

  const total = carta.grupos.length;

  return (
    <Seccion
      titulo="Extras y opciones"
      bajada={
        total === 0
          ? "Cremas, tamaño, término de la carne: lo que el cliente elige junto al plato."
          : `${total} ${total === 1 ? "grupo" : "grupos"} · después los asignas a los platos que los llevan`
      }
      tono="hondo"
      accion={
        <BotonNuevo onClick={() => { setEditando(null); setAbriendo(true); }}>
          + Nuevo grupo
        </BotonNuevo>
      }
    >
      <div className="space-y-3">
        {carta.grupos.length === 0 && (
          <Vacio
            icono="🧂"
            titulo="Todavía no tienes extras"
            texto="Crea un grupo si tus platos llevan agregados con costo: una crema, una porción extra, el tamaño."
          />
        )}

        {carta.grupos.map((g, i) => {
          const usanEste = carta.productos.filter((p) => p.grupos.some((x) => x.grupoId === g.id)).length;
          const obligatorio = g.minSelec >= 1;
          return (
            <div
              key={g.id}
              style={retardo(i)}
              /* La barra dice si el grupo FRENA el pedido: naranja el
                 obligatorio —el cliente no puede seguir sin elegir— y gris el
                 opcional, que solo suma. Es la misma lectura de costado que en
                 platos y promos. */
              className={`fila-entra tarjeta-viva rounded-tarjeta border-l-4 bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-orbita/40 ${
                obligatorio ? "border-orbita" : "border-linea"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-tinta">{g.nombre}</p>
                    {/* OBLIGATORIO vs OPCIONAL, EN COLOR (2026-08-20): la
                        diferencia estaba enterrada en una frase gris, y es lo
                        que decide si el cliente puede saltearse el paso. */}
                    <span
                      className={`rounded-chip px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide ${
                        obligatorio ? "bg-orbita/15 text-orbita-hondo" : "bg-arena text-frio"
                      }`}
                    >
                      {obligatorio ? "Obligatorio" : "Opcional"}
                    </span>
                  </div>
                  <p className="text-[0.78rem] text-frio">
                    {reglaDelGrupo(g)}
                    {usanEste > 0
                      ? ` · en ${usanEste} ${usanEste === 1 ? "plato" : "platos"}`
                      : " · todavía sin asignar"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <AccionFila onClick={() => { setEditando(g); setAbriendo(true); }}>
                    Editar
                  </AccionFila>
                  <AccionFila peligro onClick={() => borrar(g)}>
                    Eliminar
                  </AccionFila>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-linea pt-3">
                {g.opciones.map((o) => (
                  <span
                    key={o.id}
                    className="rounded-chip bg-arena px-2.5 py-1 text-[0.78rem] text-tinta-2 transition hover:bg-arena-2"
                  >
                    {o.nombre}
                    {o.precioCentavos > 0 && (
                      <span className="ml-1 font-semibold tabular-nums text-brasa-texto">
                        +{precioTexto(o.precioCentavos)}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {abriendo && (
          <HojaGrupo
            /* `key`: sin esto React reusa la hoja anterior y sus `useState`
               iniciales —el grupo viejo— quedan pegados al abrir otro. */
            key={editando?.id ?? "nuevo"}
            grupo={editando}
            cerrar={() => { setAbriendo(false); setEditando(null); }}
            recargar={recargar}
          />
        )}
      </div>
    </Seccion>
  );
}

/**
 * "Elige 1" / "Hasta 3, opcional" — la regla del grupo en palabras.
 *
 * `min`/`max` en crudo no le dice nada al dueño; esto sí le dice qué va a
 * pasarle al cliente cuando pida.
 */
function reglaDelGrupo(g: GrupoOpciones): string {
  if (g.minSelec >= 1 && g.maxSelec === 1) return "Elige 1 — obligatorio";
  if (g.minSelec >= 1) return `Elige entre ${g.minSelec} y ${g.maxSelec ?? "las que quieras"}`;
  if (g.maxSelec === 1) return "Hasta 1, opcional";
  return g.maxSelec ? `Hasta ${g.maxSelec}, opcional` : "Las que quiera, opcional";
}

function HojaGrupo({
  grupo, cerrar, recargar,
}: {
  /** El grupo a editar. `null` = uno nuevo. */
  grupo?: GrupoOpciones | null;
  cerrar: () => void;
  recargar: () => Promise<void>;
}) {
  // EDITAR UN GRUPO (2026-08-20): se podía crear y borrar, pero no corregir.
  // Cambiarle el precio a un extra, arreglar un nombre mal escrito o sumar una
  // opción obligaba a borrar el grupo entero y cargarlo de nuevo — y al
  // borrarlo se desengancha de todos los platos que lo usaban ("Salsa extra"
  // está en 39), así que había que volver a tildarlo plato por plato.
  const [nombre, setNombre] = useState(grupo?.nombre ?? "");
  // Obligatorio = "hay que elegir uno". Es la distinción que el dueño entiende;
  // min/max son el detalle que se deriva de acá.
  const [obligatorio, setObligatorio] = useState((grupo?.minSelec ?? 0) >= 1);
  const [unaSola, setUnaSola] = useState(grupo ? grupo.maxSelec === 1 : true);
  // Cada opción puede llevar foto: "¿qué es chimichurri?" se responde con una
  // imagen, no con el nombre. Viaja como data URL y sube DESPUÉS de crear el
  // grupo, que es cuando existen los ids de las opciones.
  const [opciones, setOpciones] = useState<{ nombre: string; precio: string; foto: string | null }[]>(
    grupo?.opciones?.length
      ? grupo.opciones.map((o) => ({
          nombre: o.nombre,
          // El precio 0 se muestra VACÍO, no "0.00": es lo que la ayuda del
          // campo pide escribir cuando la opción no cuesta nada.
          precio: o.precioCentavos ? (o.precioCentavos / 100).toFixed(2) : "",
          foto: o.fotoUrl ?? null,
        }))
      : [{ nombre: "", precio: "", foto: null }],
  );
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");

  const llenas = opciones.filter((o) => o.nombre.trim());

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponle un nombre al grupo."); return; }
    if (llenas.length === 0) { setErrorCampo("Agrega al menos una opción."); return; }

    const mal = llenas.find((o) => o.precio.trim() && aCentavos(o.precio) === null);
    if (mal) { setErrorCampo(`El precio de "${mal.nombre}" no es válido.`); return; }

    setErrorCampo("");
    setGuardando(true);
    const datos = {
      nombre: nombre.trim(),
      minSelec: obligatorio ? 1 : 0,
      maxSelec: unaSola ? 1 : null,
      opciones: llenas.map((o) => ({
        nombre: o.nombre.trim(),
        precioCentavos: o.precio.trim() ? aCentavos(o.precio)! : 0,
      })),
    };

    if (grupo) {
      // El PATCH REEMPLAZA las opciones enteras, así que las que ya estaban
      // vuelven con id nuevo. Por eso las fotos se resuben abajo igual que en
      // un alta: mantener el id viejo pediría un diff que el backend no toma.
      const r = await actualizarGrupo(grupo.id, datos);
      if (!r.ok) { setGuardando(false); setErrorCampo(r.error ?? "No se pudo guardar"); return; }
      setGuardando(false);
      await recargar();
      cerrar();
      return;
    }

    const r = await crearGrupo(datos);

    if (!r.ok) { setGuardando(false); setErrorCampo(r.error ?? "No se pudo guardar"); return; }

    // Las fotos van una por una, ya con los ids que devolvió el backend. El
    // orden se respeta: `llenas[i]` es `r.dato.opciones[i]`.
    const creadas = r.dato?.opciones ?? [];
    for (let i = 0; i < llenas.length; i++) {
      const dato = llenas[i].foto;
      const creada = creadas[i];
      if (dato && creada) await subirFoto("opciones", creada.id, dato);
    }

    setGuardando(false);
    await recargar();
    cerrar();
  }

  return (
    <Hoja
      titulo={grupo ? "Editar grupo de extras" : "Nuevo grupo de extras"}
      bajada={grupo ? grupo.nombre : "Las opciones que el cliente elige junto al plato."}
      cerrar={cerrar}
      pie={
        <PieHoja
          cerrar={cerrar}
          guardar={guardar}
          guardando={guardando}
          puedeGuardar
        />
      }
    >
        <div className="space-y-4">
          <Campo etiqueta="Nombre del grupo" ayuda="Cremas, Tamaño, Término…">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cremas"
              autoFocus
              className={CAMPO_HOJA}
            />
          </Campo>

          <div className="space-y-2 rounded-lg bg-arena/50 p-3">
            <label className="flex cursor-pointer items-center gap-2.5 text-[0.9rem] text-tinta-2">
              <input
                type="checkbox"
                checked={obligatorio}
                onChange={(e) => setObligatorio(e.target.checked)}
                className="size-4 accent-[var(--color-brasa)]"
              />
              El cliente <b>tiene</b> que elegir
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 text-[0.9rem] text-tinta-2">
              <input
                type="checkbox"
                checked={unaSola}
                onChange={(e) => setUnaSola(e.target.checked)}
                className="size-4 accent-[var(--color-brasa)]"
              />
              Solo puede elegir <b>una</b>
            </label>
          </div>

          <Campo etiqueta="Opciones" ayuda="Dejá el precio vacío si no cuesta nada">
            <div className="space-y-2">
              {opciones.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  {/* Foto del extra: chica, al costado. Es opcional y no debe
                      robarle lugar al nombre y el precio, que es lo que el
                      dueño viene a escribir. */}
                  <label className="shrink-0 cursor-pointer" title="Foto del extra (opcional)">
                    <span className="sr-only">Foto de la opción {i + 1}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const archivo = e.target.files?.[0];
                        e.target.value = "";
                        if (!archivo) return;
                        const r = await leerFoto(archivo);
                        if (!r.ok) { setErrorCampo(r.error); return; }
                        setErrorCampo("");
                        setOpciones((prev) => prev.map((x, j) => (j === i ? { ...x, foto: r.datos } : x)));
                      }}
                    />
                    {o.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.foto} alt="" className="h-9 w-9 rounded object-cover ring-2 ring-orbita/35" />
                    ) : (
                      <span className="grid h-9 w-9 place-items-center rounded border border-dashed border-linea text-frio transition hover:border-orbita hover:text-orbita">
                        +
                      </span>
                    )}
                  </label>
                  <input
                    value={o.nombre}
                    onChange={(e) =>
                      setOpciones((prev) => prev.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))
                    }
                    placeholder="Queso"
                    aria-label={`Nombre de la opción ${i + 1}`}
                    className="min-w-0 flex-1 rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.9rem] text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
                  />
                  <span className="text-[0.85rem] font-semibold text-frio">+S/</span>
                  <input
                    value={o.precio}
                    onChange={(e) =>
                      setOpciones((prev) => prev.map((x, j) => (j === i ? { ...x, precio: e.target.value } : x)))
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    aria-label={`Precio de la opción ${i + 1}`}
                    className="w-20 rounded-lg border border-linea bg-arena/40 px-2 py-2 text-[0.9rem] tabular-nums text-tinta placeholder:text-frio"
                  />
                  {opciones.length > 1 && (
                    <button
                      onClick={() => setOpciones((prev) => prev.filter((_, j) => j !== i))}
                      aria-label={`Quitar la opción ${i + 1}`}
                      className="px-1 text-frio hover:text-alerta"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setOpciones((prev) => [...prev, { nombre: "", precio: "", foto: null }])}
                className="text-[0.85rem] font-semibold text-brasa-texto hover:underline"
              >
                + Agregar otra
              </button>
            </div>
          </Campo>

          {errorCampo && (
            <p className="fila-entra rounded-lg bg-alerta/10 px-3 py-2 text-[0.85rem] font-semibold text-alerta">
              {errorCampo}
            </p>
          )}
        </div>
    </Hoja>
  );
}

// ── Combos ────────────────────────────────────────────────────────────

/**
 * Dos o tres platos juntos a un precio especial.
 *
 * El precio es el del COMBO ENTERO, no un descuento sobre la suma: así el
 * dueño pone el número redondo que quiere cobrar ("Combo familiar S/59") sin
 * calcular porcentajes. Al lado se le muestra cuánto costaría suelto, que es
 * el argumento de venta — y lo que evita que arme un combo sin ahorro.
 */
function Combos({
  carta, recargar, avisar,
}: { carta: Carta; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);

  async function borrar(c: ComboCarta) {
    if (!confirm(`¿Borrar el combo "${c.nombre}"?`)) return;
    const r = await eliminarCombo(c.id);
    if (!r.ok) avisar(r.error ?? "No se pudo borrar");
    await recargar();
  }

  /** Cuánto costarían esos platos por separado. */
  function sueltos(c: ComboCarta): number {
    return c.productos.reduce((s, x) => {
      const p = carta.productos.find((y) => y.id === x.productoId);
      return s + (p ? p.precioCentavos * x.cantidad : 0);
    }, 0);
  }

  const total = carta.combos.length;

  return (
    <Seccion
      titulo="Combos"
      bajada={
        total === 0
          ? "Dos o tres platos a un precio especial. El cliente los pide como una sola cosa."
          : `${total} ${total === 1 ? "combo armado" : "combos armados"} con platos de tu carta`
      }
      tono="hondo"
      accion={
        <BotonNuevo
          onClick={() => setAbriendo(true)}
          disabled={carta.productos.length === 0}
        >
          + Nuevo combo
        </BotonNuevo>
      }
    >
      <div className="space-y-3">
        {carta.productos.length === 0 && (
          <Vacio
            icono="🍔"
            titulo="Primero carga tus platos"
            texto="Un combo se arma con platos de tu carta, así que empieza por ahí."
          />
        )}

        {carta.productos.length > 0 && carta.combos.length === 0 && (
          <Vacio
            icono="🥤"
            titulo="Todavía no tienes combos"
            texto="Una hamburguesa con papas y gaseosa a precio de combo vende más que las tres cosas por separado."
          />
        )}

        {carta.combos.map((c, i) => {
          const suelto = sueltos(c);
          const ahorro = suelto - c.precioCentavos;
          return (
            <div
              key={c.id}
              style={retardo(i)}
              /* La barra avisa si el combo CONVIENE: verde cuando cuesta menos
                 que los platos sueltos, naranja cuando no —ahí el combo no le
                 ahorra nada al cliente y no hay razón para pedirlo, que es un
                 error de carga fácil de cometer y difícil de ver. */
              className={`fila-entra tarjeta-viva group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta border-l-4 bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-orbita/40 ${
                ahorro > 0 ? "border-ok" : "border-calor"
              }`}
            >
              {c.fotoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={c.fotoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-orbita/35 transition group-hover:ring-orbita/70"
                />
              ) : (
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-arena-2 text-[1.1rem] opacity-45 ring-1 ring-linea"
                  aria-hidden
                >
                  🍔
                </span>
              )}
              <div className="min-w-[9rem] flex-1">
                <p className="font-semibold text-tinta">{c.nombre}</p>
                <p className="text-[0.8rem] text-frio">
                  {c.productos.map((x) => {
                    const p = carta.productos.find((y) => y.id === x.productoId);
                    return p ? `${x.cantidad > 1 ? `${x.cantidad}x ` : ""}${p.nombre}` : null;
                  }).filter(Boolean).join(" + ")}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold tabular-nums text-calor">{precioTexto(c.precioCentavos)}</p>
                {/* El ahorro es el argumento de venta: sin esto ni el dueño sabe
                    si su combo conviene, ni el cliente por qué pedirlo. En
                    verde y con el monto, no solo el precio tachado: "ahorra
                    S/8" se entiende de un vistazo, un número cruzado no. */}
                {ahorro > 0 && (
                  <p className="text-[0.75rem] text-frio">
                    <span className="line-through">{precioTexto(suelto)}</span>{" "}
                    <span className="font-bold text-ok">ahorra {precioTexto(ahorro)}</span>
                  </p>
                )}
                {/* SI NO AHORRA, SE DICE (2026-08-20): un combo que cuesta lo
                    mismo —o más— que sus platos sueltos no tiene por qué
                    pedirse, y el dueño no tenía cómo notarlo: veía su precio y
                    listo. La barra naranja del costado lo marca, esta línea
                    explica por qué está marcado. */}
                {ahorro <= 0 && suelto > 0 && (
                  <p className="text-[0.75rem] font-semibold text-calor">
                    {ahorro === 0 ? "igual que por separado" : `${precioTexto(-ahorro)} más caro`}
                  </p>
                )}
              </div>
              <AccionFila peligro onClick={() => borrar(c)}>
                Eliminar
              </AccionFila>
            </div>
          );
        })}

        {abriendo && (
          <HojaCombo carta={carta} cerrar={() => setAbriendo(false)} recargar={recargar} avisar={avisar} />
        )}
      </div>
    </Seccion>
  );
}

function HojaCombo({
  carta, cerrar, recargar, avisar,
}: { carta: Carta; cerrar: () => void; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [elegidos, setElegidos] = useState<{ productoId: string; cantidad: number }[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");
  const foto = useFoto(null);
  // BUSCADOR (2026-08-19). Shiro tiene 48 platos y esta lista los mostraba
  // todos planos en una caja de 56px: armar un combo era scrollear a ciegas.
  const [busca, setBusca] = useState("");

  /**
   * Los platos AGRUPADOS POR SECCIÓN, como están en la carta.
   *
   * Antes era una lista corrida sin separaciones, así que "California" y
   * "Langostinos al panko" —de secciones distintas— se veían igual de
   * cercanos. Con la carta agrupada, elegir es reconocer en vez de buscar.
   */
  const gruposCombo = (() => {
    const q = sinTildes(busca.trim().toLowerCase());
    const visibles = q
      ? carta.productos.filter((x) => sinTildes(x.nombre.toLowerCase()).includes(q))
      : carta.productos;
    const secciones = carta.categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: visibles.filter((x) => x.categoriaId === c.id),
    }));
    // Los que no tienen sección van al final, no se pierden.
    const sueltos = visibles.filter((x) => !x.categoriaId);
    if (sueltos.length > 0) secciones.push({ id: "_sin", nombre: "Sin sección", productos: sueltos });
    return secciones.filter((s) => s.productos.length > 0);
  })();

  const centavos = aCentavos(precio);
  // Lo que costarían sueltos, para que el dueño vea si su precio tiene sentido.
  const suelto = elegidos.reduce((s, x) => {
    const p = carta.productos.find((y) => y.id === x.productoId);
    return s + (p ? p.precioCentavos * x.cantidad : 0);
  }, 0);

  function alternar(id: string) {
    setElegidos((prev) => prev.some((x) => x.productoId === id)
      ? prev.filter((x) => x.productoId !== id)
      : [...prev, { productoId: id, cantidad: 1 }]);
  }

  // Las MISMAS tres condiciones que valida `guardar`. El botón se apaga hasta
  // que se cumplen; los mensajes de abajo siguen ahí para decir cuál falta, que
  // es lo que un botón gris no explica solo.
  const puedeGuardar = nombre.trim().length > 0 && elegidos.length >= 2 && centavos !== null;

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponle un nombre al combo."); return; }
    if (elegidos.length < 2) { setErrorCampo("Un combo lleva al menos dos platos."); return; }
    if (centavos === null) { setErrorCampo("El precio tiene que ser un número, como 39.90."); return; }

    setErrorCampo("");
    setGuardando(true);
    const r = await crearCombo({
      nombre: nombre.trim(),
      precioCentavos: centavos,
      productos: elegidos,
    });
    if (!r.ok) { setGuardando(false); setErrorCampo(r.error ?? "No se pudo guardar"); return; }

    // La foto va DESPUÉS: el combo no tiene id hasta que el backend lo crea.
    if (r.dato?.id) {
      const err = await foto.guardar("combos", r.dato.id);
      if (err) avisar(`El combo se guardó, pero la foto no subió.`);
    }
    setGuardando(false);
    await recargar();
    cerrar();
  }

  return (
    <Hoja
      titulo="Nuevo combo"
      bajada="Varios platos que el cliente pide como uno solo."
      cerrar={cerrar}
      pie={
        <PieHoja
          cerrar={cerrar}
          guardar={guardar}
          guardando={guardando}
          puedeGuardar={puedeGuardar}
        />
      }
    >
        <div className="space-y-4">
          <CampoFoto foto={foto} alFallar={setErrorCampo} />

          <Campo etiqueta="Nombre" ayuda="Combo familiar, Dúo clásico…">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Combo familiar"
              autoFocus
              className={CAMPO_HOJA}
            />
          </Campo>

          <Campo
            etiqueta="Qué lleva"
            ayuda={elegidos.length > 0 ? `${elegidos.length} elegido(s)` : "Elige dos o más platos"}
          >
            {/* BUSCADOR (2026-08-19). Con 48 platos, encontrar "California"
                era scrollear a ciegas una lista corrida. */}
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="🔍 Buscar un plato…"
              aria-label="Buscar un plato"
              className="mb-2 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.9rem] text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
            />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-arena/40 p-2">
              {gruposCombo.length === 0 && (
                <p className="px-1.5 py-3 text-center text-[0.85rem] text-frio">
                  Ningún plato coincide con «{busca}».
                </p>
              )}
              {gruposCombo.map((seccion) => (
              <div key={seccion.id}>
                {/* El nombre de la sección, pegajoso: al scrollear sigue
                    diciendo dónde estás parado. */}
                <p className="sticky top-0 z-10 bg-arena/95 px-1.5 pb-1 pt-1.5 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                  {seccion.nombre}
                </p>
              {seccion.productos.map((p) => {
                const elegido = elegidos.find((x) => x.productoId === p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded px-1.5 py-1">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[0.9rem] text-tinta-2">
                      <input
                        type="checkbox"
                        checked={!!elegido}
                        onChange={() => alternar(p.id)}
                        className="size-4 shrink-0 accent-[var(--color-orbita)]"
                      />
                      <span className="truncate">{p.nombre}</span>
                      <span className="shrink-0 text-[0.78rem] text-frio">{precioTexto(p.precioCentavos)}</span>
                    </label>
                    {elegido && (
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={elegido.cantidad}
                        onChange={(e) => {
                          const n = Math.max(1, Number(e.target.value) || 1);
                          setElegidos((prev) => prev.map((x) => x.productoId === p.id ? { ...x, cantidad: n } : x));
                        }}
                        aria-label={`Cuántos ${p.nombre}`}
                        className="w-14 shrink-0 rounded border border-linea bg-carta px-2 py-1 text-center text-[0.85rem] tabular-nums"
                      />
                    )}
                  </div>
                );
              })}
              </div>
              ))}
            </div>
          </Campo>

          <Campo etiqueta="Precio del combo" ayuda="Lo que cobras por todo junto">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-frio">S/</span>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                inputMode="decimal"
                placeholder="39.90"
                className="w-32 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
              {/* Sin esto el dueño arma combos que no ahorran nada —o que le
                  dan pérdida— y se entera cuando ya están publicados. */}
              {suelto > 0 && (
                <span className="text-[0.82rem] text-frio">
                  sueltos: <b className="tabular-nums">{precioTexto(suelto)}</b>
                  {centavos !== null && centavos < suelto && (
                    <b className="ml-1 text-brasa-texto">— ahorra {precioTexto(suelto - centavos)}</b>
                  )}
                </span>
              )}
            </div>
          </Campo>

          {errorCampo && (
            <p className="fila-entra rounded-lg bg-alerta/10 px-3 py-2 text-[0.85rem] font-semibold text-alerta">
              {errorCampo}
            </p>
          )}
        </div>
    </Hoja>
  );
}

// ── Promos ──────────────────────────────────────────────────────────────

function Promos({
  carta, recargar, avisar,
}: { carta: Carta; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);
  const [editando, setEditando] = useState<DescuentoCarta | null>(null);

  async function alternar(d: DescuentoCarta) {
    const r = await actualizarDescuento(d.id, { activo: !d.activo });
    if (!r.ok) avisar(r.error ?? "No se pudo cambiar");
    await recargar();
  }

  async function borrar(d: DescuentoCarta) {
    if (!confirm(`¿Borrar la promo "${d.nombre}"?`)) return;
    const r = await eliminarDescuento(d.id);
    if (!r.ok) avisar(r.error ?? "No se pudo borrar");
    await recargar();
  }

  const activas = carta.descuentos.filter((d) => d.activo).length;
  const total = carta.descuentos.length;

  return (
    <Seccion
      titulo="Promos"
      bajada={
        total === 0
          ? "Descuentos por día u hora. Se aplican solos cuando el cliente pide dentro de la ventana."
          : `${activas} ${activas === 1 ? "activa" : "activas"} de ${total} · se aplican solas dentro de su ventana`
      }
      tono="hondo"
      accion={
        <BotonNuevo onClick={() => { setEditando(null); setAbriendo(true); }}>
          + Nueva promo
        </BotonNuevo>
      }
    >
      <div className="space-y-3">
        {carta.descuentos.length === 0 && (
          <Vacio
            icono="🏷️"
            titulo="Sin promos todavía"
            texto="Crea una para los días flojos: 20% los martes, por ejemplo."
          />
        )}

        {/* Cada promo ENTRA: sin esto, crear o borrar una solo hace que la lista
            sea distinta y no se ve cuál cambió. */}
        {carta.descuentos.map((d, i) => (
          <div
            key={d.id}
            style={retardo(i)}
            /* LA PROMO APAGADA SE VE APAGADA (2026-08-20): activa y apagada se
               diferenciaban solo por un chip chico al costado. Ahora la activa
               lleva un borde verde a la izquierda y la apagada se atenúa: cuál
               está corriendo se ve de un vistazo, que es la única pregunta que
               alguien le hace a esta lista. */
            className={`fila-entra tarjeta-viva flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition ${
              d.activo ? "border-l-4 border-ok" : "opacity-70"
            }`}
          >
            <div className="min-w-[9rem] flex-1">
              <p className="font-semibold text-tinta">{d.nombre}</p>
              {/* Se le pasa "Combos" como una sección más: si no, una promo
                  que apunta a combos mostraría el id crudo `__combos`. */}
              <p className="text-[0.8rem] text-frio">
                {resumenDescuento(d, [
                  ...carta.categorias,
                  { id: CATEGORIA_COMBOS, nombre: "Combos" },
                ])}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
                d.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
              }`}
            >
              {d.activo ? "Activa" : "Apagada"}
            </span>
            <AccionFila onClick={() => alternar(d)}>
              {d.activo ? "Apagar" : "Activar"}
            </AccionFila>
            <AccionFila onClick={() => { setEditando(d); setAbriendo(true); }}>
              Editar
            </AccionFila>
            <AccionFila peligro onClick={() => borrar(d)}>
              Eliminar
            </AccionFila>
          </div>
        ))}

        {abriendo && (
          <HojaPromo
            key={editando?.id ?? "nueva"}
            promo={editando}
            cerrar={() => { setAbriendo(false); setEditando(null); }}
            recargar={recargar}
            /* LOS COMBOS SON UNA "SECCIÓN" MÁS (2026-08-20): no viven en
               ninguna categoría de la carta, así que ninguna promo podía
               apuntarles y "3 combos x 2" no se podía armar. El id reservado
               `__combos` lo entiende el motor de precios; acá es una opción
               más del selector. Solo se ofrece si hay combos cargados. */
            categorias={
              carta.combos.length > 0
                ? [...carta.categorias, { id: CATEGORIA_COMBOS, nombre: "Combos" }]
                : carta.categorias
            }
          />
        )}
      </div>
    </Seccion>
  );
}

/**
 * LOS TIPOS DE PROMO, en el idioma del dueño (2026-08-19).
 *
 * El modelo guarda `minUnidades`/`unidadesEnPromo`, que es lo correcto para
 * calcular pero no lo que alguien piensa cuando arma una promo. Nadie dice
 * "mínimo 3 unidades, 1 en promo": dice "3x2".
 *
 * Esto importó de verdad: el formulario NO tenía estas opciones, así que las
 * promos de Shiro se cargaron por script con `alcance: 'todo'` y sin mínimo, y
 * a un pedido de 1 langostino + 1 roll le descontó la mitad del carrito.
 */
const TIPOS_PROMO = [
  {
    id: "simple",
    label: "Descuento directo",
    ayuda: "Un % o un monto sobre lo que pida",
    minUnidades: 0, unidadesEnPromo: 1,
  },
  {
    id: "segunda",
    label: "2ª a mitad de precio",
    ayuda: "Llevando 2, la más barata sale al 50%",
    minUnidades: 2, unidadesEnPromo: 1, tipo: "porcentaje" as const, valor: 50,
  },
  {
    id: "3x2",
    label: "3x2",
    ayuda: "Llevando 3, la más barata sale gratis",
    minUnidades: 3, unidadesEnPromo: 1, tipo: "porcentaje" as const, valor: 100,
  },
  {
    id: "4x3",
    label: "4x3",
    ayuda: "Llevando 4, la más barata sale gratis",
    minUnidades: 4, unidadesEnPromo: 1, tipo: "porcentaje" as const, valor: 100,
  },
] as const;

/**
 * De la promo guardada de vuelta al tipo que muestra el formulario.
 *
 * `minUnidades` es lo que distingue un 3x2 de un "2ª a mitad": el modelo
 * guarda el número, el dueño piensa en el nombre. Sin esto, editar una promo
 * la mostraría siempre como "Descuento directo" y guardarla la convertiría en
 * eso — perdiendo el 3x2 sin que nadie lo pida.
 */
function claseDePromo(d: DescuentoCarta): string {
  const min = d.minUnidades ?? 0;
  if (min >= 2) {
    const encontrado = TIPOS_PROMO.find(
      (t) => t.minUnidades === min && ("valor" in t ? t.valor === d.valor : true),
    );
    if (encontrado) return encontrado.id;
  }
  return "simple";
}

function HojaPromo({
  promo, cerrar, recargar, categorias,
}: {
  /** La promo a editar. `null` = una nueva. */
  promo?: DescuentoCarta | null;
  cerrar: () => void;
  recargar: () => Promise<void>;
  categorias: { id: string; nombre: string }[];
}) {
  // EDITAR UNA PROMO (2026-08-20): solo se podía crear, apagar y borrar.
  // Corregir un 20% que debía ser 15, o sumarle un día, obligaba a borrarla y
  // cargarla entera de nuevo.
  const [nombre, setNombre] = useState(promo?.nombre ?? "");
  const [tipo, setTipo] = useState<"porcentaje" | "monto">(promo?.tipo ?? "porcentaje");
  const [valor, setValor] = useState(
    promo ? (promo.tipo === "porcentaje" ? String(promo.valor) : (promo.valor / 100).toFixed(2)) : "",
  );
  const [dias, setDias] = useState<number[]>(promo?.dias ?? []);
  const [clase, setClase] = useState<string>(promo ? claseDePromo(promo) : "simple");
  // ¿Se suma a otras promos de cantidad? Default NO: entra la mejor para el
  // cliente. Ver el comentario de `acumulable` en el backend.
  const [acumulable, setAcumulable] = useState(promo?.acumulable ?? false);
  // Vacío = toda la carta. Con categorías elegidas, la promo solo cuenta esas
  // —el bug era justamente que alcanzaba a todo—.
  const [cats, setCats] = useState<string[]>(
    // `alcanceIds` es la lista nueva; `alcanceId` el campo viejo de una sola.
    // Las promos ya cargadas pueden tener cualquiera de los dos.
    promo?.alcanceIds?.length
      ? promo.alcanceIds
      : promo?.alcance === "categoria" && promo.alcanceId
        ? [promo.alcanceId]
        : [],
  );
  const [horaDesde, setHoraDesde] = useState(promo?.horaDesde ?? "");
  const [horaHasta, setHoraHasta] = useState(promo?.horaHasta ?? "");
  // TEMPORADA (2026-08-19). El modelo ya tenía `desde`/`hasta` pero el
  // formulario no los exponía, así que una promo de Fiestas Patrias solo se
  // podía cargar por API — y quedaba encendida para siempre hasta que alguien
  // se acordara de apagarla a mano.
  const [desde, setDesde] = useState(promo?.desde?.slice(0, 10) ?? "");
  const [hasta, setHasta] = useState(promo?.hasta?.slice(0, 10) ?? "");
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");
  const foto = useFoto(promo?.fotoUrl ?? null);

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponle un nombre a la promo."); return; }

    // Una promo por cantidad sobre TODA la carta mezcla peras con manzanas:
    // "3x2" contando entradas y postres juntos no es lo que nadie quiso decir,
    // y es la forma exacta en que se rompió la carta de Shiro.
    const claseElegida = TIPOS_PROMO.find((x) => x.id === clase)!;
    if (claseElegida.minUnidades >= 2 && cats.length === 0) {
      setErrorCampo("Elige a qué secciones aplica: una promo por cantidad no puede contar toda la carta.");
      return;
    }

    // El porcentaje va entero (20 = 20%); el monto va en céntimos.
    let n: number | null;
    if (tipo === "porcentaje") {
      const entero = parseInt(valor.trim(), 10);
      n = Number.isFinite(entero) && entero > 0 ? entero : null;
      if (n !== null && n > 100) { setErrorCampo("El porcentaje no puede pasar de 100."); return; }
    } else {
      n = aCentavos(valor);
    }
    if (n === null || n <= 0) {
      setErrorCampo(tipo === "porcentaje" ? "Pon un porcentaje, como 20." : "Pon un monto, como 5.00.");
      return;
    }

    // Una sola hora sin la otra deja una ventana a medias: el backend la
    // ignoraría y el dueño juraría que la promo está rota.
    if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) {
      setErrorCampo("Pon las dos horas, o ninguna.");
      return;
    }

    // Una temporada al revés no aplica NUNCA, y el dueño juraría que la promo
    // está rota. Es barato avisarlo acá.
    if (desde && hasta && desde > hasta) {
      setErrorCampo("La fecha de inicio tiene que ser anterior a la de fin.");
      return;
    }

    setErrorCampo("");
    setGuardando(true);
    const preset = TIPOS_PROMO.find((x) => x.id === clase)!;
    const datos = {
      nombre: nombre.trim(),
      tipo,
      valor: n,
      dias,
      horaDesde: horaDesde || null,
      horaHasta: horaHasta || null,
      desde: desde || null,
      hasta: hasta || null,
      // Sin categorías elegidas la promo alcanza toda la carta, que es lo que
      // el dueño ve escrito arriba del selector.
      alcance: (cats.length > 0 ? "categoria" : "todo") as "categoria" | "todo",
      alcanceIds: cats,
      minUnidades: preset.minUnidades,
      unidadesEnPromo: preset.unidadesEnPromo,
      repetible: true,
      acumulable,
    };

    // Al editar NO se manda `activo`: se prende y se apaga desde la lista, y
    // pisarlo acá apagaría una promo viva por entrar a corregirle el nombre.
    let id: string | undefined;
    let error: string | undefined;
    if (promo) {
      const r = await actualizarDescuento(promo.id, datos);
      if (r.ok) id = promo.id;
      else error = r.error;
    } else {
      const r = await crearDescuento(datos);
      if (r.ok) id = r.dato?.id;
      else error = r.error;
    }

    if (error || !id) {
      setGuardando(false);
      setErrorCampo(error ?? "No se pudo guardar");
      return;
    }

    // El banner va después: una promo nueva no tiene id hasta que el backend
    // la crea.
    await foto.guardar("descuentos", id);

    setGuardando(false);
    await recargar();
    cerrar();
  }

  return (
    <Hoja
      titulo={promo ? "Editar promo" : "Nueva promo"}
      bajada={promo ? promo.nombre : "Se aplica sola cuando el cliente pide dentro de la ventana."}
      cerrar={cerrar}
      pie={
        <PieHoja
          cerrar={cerrar}
          guardar={guardar}
          guardando={guardando}
          puedeGuardar
          etiqueta={promo ? "Guardar cambios" : "Crear promo"}
        />
      }
    >
        <div className="space-y-4">
          <CampoFoto
            foto={foto}
            alFallar={setErrorCampo}
            etiqueta="Banner"
            ayuda="Opcional — la imagen que anuncia la promo"
          />

          <Campo etiqueta="Nombre" ayuda="Lo ve el cliente en su pedido">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Martes de promo"
              autoFocus
              className={CAMPO_HOJA}
            />
          </Campo>

          {/* QUÉ CLASE DE PROMO. Va antes que el descuento porque elegirla
              define el resto: un "3x2" ya sabe que es 100% sobre una unidad. */}
          <Campo etiqueta="Tipo de promo">
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_PROMO.map((tp) => (
                <button
                  key={tp.id}
                  onClick={() => {
                    setClase(tp.id);
                    // Los presets traen su propio descuento: "3x2" es 100% de
                    // una unidad, y pedirle al dueño que lo deduzca es pedirle
                    // que haga la cuenta que el sistema ya sabe.
                    if ("tipo" in tp) { setTipo(tp.tipo); setValor(String(tp.valor)); }
                  }}
                  className={`rounded-tarjeta px-3 py-2.5 text-left transition ring-1 ${
                    clase === tp.id
                      ? "bg-brasa-suave ring-brasa"
                      : "bg-arena/40 ring-linea hover:bg-arena"
                  }`}
                >
                  <p className="text-[0.88rem] font-bold text-tinta">{tp.label}</p>
                  <p className="mt-0.5 text-[0.75rem] leading-snug text-frio">{tp.ayuda}</p>
                </button>
              ))}
            </div>
          </Campo>

          {/* ¿SE SUMA A OTRAS? Solo para promos de cantidad: dos descuentos de
              plata siempre se suman, no hay nada que preguntar.

              Salió de Shiro (2026-08-20): tenía "3x2" y "4x3" el mismo jueves
              sobre las mismas tablas, y sumadas cuatro tablas costaban lo
              mismo que tres —el negocio regalaba dos— cuando su carta promete
              una. */}
          {clase !== "simple" && (
            <Campo
              etiqueta="Si coincide con otra promo"
              ayuda="Cuando dos promos de cantidad caen el mismo día"
            >
              <div className="grid gap-2">
                {[
                  { v: false, t: "Se aplica la mejor", d: "El cliente recibe la que más le conviene. Es lo que espera al leer dos ofertas juntas." },
                  { v: true, t: "Se suman", d: "Las dos se descuentan. Ojo: con 3x2 y 4x3 juntas, cuatro salen al precio de dos." },
                ].map((o) => (
                  <button
                    key={String(o.v)}
                    onClick={() => setAcumulable(o.v)}
                    className={`rounded-tarjeta px-3 py-2.5 text-left ring-1 transition ${
                      acumulable === o.v ? "bg-brasa-suave ring-brasa" : "bg-arena/40 ring-linea hover:bg-arena"
                    }`}
                  >
                    <p className="text-[0.88rem] font-bold text-tinta">{o.t}</p>
                    <p className="mt-0.5 text-[0.75rem] leading-snug text-frio">{o.d}</p>
                  </button>
                ))}
              </div>
            </Campo>
          )}

          {/* SOBRE QUÉ APLICA. Es el campo que faltaba y por el que una promo
              de makis le descontó a unos langostinos: sin esto, `alcance`
              quedaba en 'todo' y la promo alcanzaba el carrito entero. */}
          <Campo
            etiqueta="¿Sobre qué aplica?"
            ayuda={cats.length === 0 ? "Ninguna elegida = toda la carta" : `${cats.length} sección(es)`}
          >
            {categorias.length === 0 ? (
              <p className="text-[0.85rem] text-frio">
                Todavía no tienes secciones en tu carta: la promo va a aplicar a todo.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    onClick={() =>
                      setCats((prev) =>
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id],
                      )
                    }
                    className={`rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold transition ${
                      cats.includes(c.id)
                        ? "bg-brasa text-sobre-brasa"
                        : "bg-arena text-tinta-2 hover:bg-arena-2"
                    }`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>
            )}
          </Campo>

          <Campo etiqueta="Descuento">
            <div className="flex items-center gap-2">
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value as "porcentaje" | "monto"); setValor(""); }}
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              >
                <option value="porcentaje">Porcentaje</option>
                <option value="monto">Monto fijo</option>
              </select>
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder={tipo === "porcentaje" ? "20" : "5.00"}
                aria-label="Valor del descuento"
                className="w-24 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
              <span className="font-semibold text-frio">{tipo === "porcentaje" ? "%" : "soles"}</span>
            </div>
          </Campo>

          <Campo etiqueta="Días" ayuda="Ninguno = todos los días">
            <div className="flex flex-wrap gap-1.5">
              {DIAS.map((nombreDia, n) => (
                <button
                  key={n}
                  onClick={() =>
                    setDias((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]))
                  }
                  className={`rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold transition ${
                    dias.includes(n) ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 hover:bg-arena-2"
                  }`}
                >
                  {nombreDia}
                </button>
              ))}
            </div>
          </Campo>

          <Campo etiqueta="Temporada" ayuda="Vacío = sin fecha de fin">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                aria-label="Desde qué fecha"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
              <span className="text-frio">a</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                aria-label="Hasta qué fecha"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
            </div>
          </Campo>

          <Campo etiqueta="Horario" ayuda="Vacío = todo el día">
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                aria-label="Desde qué hora"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
              <span className="text-frio">a</span>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                aria-label="Hasta qué hora"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta transition focus:border-brasa focus:bg-carta focus:outline-none focus:ring-2 focus:ring-brasa/25"
              />
            </div>
          </Campo>

          {errorCampo && (
            <p className="fila-entra rounded-lg bg-alerta/10 px-3 py-2 text-[0.85rem] font-semibold text-alerta">
              {errorCampo}
            </p>
          )}
        </div>
    </Hoja>
  );
}
