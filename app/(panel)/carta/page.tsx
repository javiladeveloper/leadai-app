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
  crearGrupo, eliminarGrupo,
  crearCombo, eliminarCombo,
  crearDescuento, actualizarDescuento, eliminarDescuento,
  subirFotoProducto, quitarFotoProducto, subirFoto, leerFoto,
  aCentavos, precioTexto, porcentajeDescuento, resumenDescuento, DIAS,
  type Carta, type ProductoCarta, type GrupoOpciones, type ComboCarta, type DescuentoCarta,
} from "@/lib/carta";
import { CampoFoto, useFoto } from "@/components/panel/CampoFoto";
import { SkeletonLista } from "@/components/Skeletons";
import { MarcaCarta } from "@/components/panel/MarcaCarta";

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

  const tenant = leerEmpresaActiva();
  const enlacePublico = tenant ? `${window.location.origin}/c/${tenant}` : null;

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

      <nav className="flex gap-1 rounded-tarjeta bg-carta p-1 ring-1 ring-linea">
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
            className={`flex-1 rounded-lg px-3 py-2 text-[0.9rem] font-semibold transition ${
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <NuevaSeccion recargar={recargar} avisar={avisar} />
        <button
          onClick={() => { setEditando(null); setAbriendo(true); }}
          className="rounded-tarjeta bg-orbita px-5 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo active:scale-[0.99]"
        >
          + Nuevo plato
        </button>
      </div>

      {carta.productos.length === 0 && carta.categorias.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Tu carta está vacía</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Cargá tu primer plato para que tus clientes puedan pedirlo.
          </p>
        </div>
      )}

      {porSeccion.map(({ categoria, platos }) => (
        <section key={categoria?.id ?? "sueltos"} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-orbita" aria-hidden />
            <h2 className="text-[0.78rem] font-bold uppercase tracking-wide text-tinta-2">
              {categoria?.nombre ?? "Sin sección"}
            </h2>
            {categoria && (
              <button
                onClick={async () => {
                  // Los platos NO se van con la sección: quedan sueltos. Borrar
                  // "Entradas" no puede llevarse ocho platos por delante.
                  if (!confirm(`¿Borrar la sección "${categoria.nombre}"? Los platos quedan sin sección.`)) return;
                  const r = await eliminarCategoria(categoria.id);
                  if (!r.ok) avisar(r.error ?? "No se pudo borrar");
                  await recargar();
                }}
                className="text-[0.75rem] font-semibold text-frio hover:text-alerta"
              >
                borrar
              </button>
            )}
          </div>

          {platos.length === 0 && (
            <p className="px-1 text-[0.85rem] text-frio">Sin platos todavía.</p>
          )}

          {platos.map((p) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta bg-carta p-4 ring-1 ring-linea ${
                p.disponible ? "" : "opacity-60"
              }`}
            >
              {p.fotoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={p.fotoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-orbita/35"
                />
              )}
              <button
                onClick={() => { setEditando(p); setAbriendo(true); }}
                className="min-w-[9rem] flex-1 text-left"
              >
                <p className="font-semibold text-tinta hover:text-brasa-texto">{p.nombre}</p>
                {p.descripcion && (
                  /* En la lista va en UNA línea a propósito: son muchas filas y
                     la altura tiene que ser pareja para barrerlas de un
                     vistazo. Los renglones de la descripción se unen con "·"
                     en vez de perderse pegados uno contra otro. El detalle
                     completo se ve al abrir el plato y en la carta pública. */
                  <p className="truncate text-[0.8rem] text-frio">
                    {p.descripcion.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(" · ")}
                  </p>
                )}
                {p.grupos.length > 0 && (
                  <p className="text-[0.75rem] text-frio">
                    {p.grupos.length} {p.grupos.length === 1 ? "grupo de extras" : "grupos de extras"}
                  </p>
                )}
              </button>
              <span className="font-bold tabular-nums text-calor">{precioTexto(p.precioCentavos)}</span>
              {!p.disponible && (
                <span className="rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-frio">
                  Agotado
                </span>
              )}
              <button
                onClick={() => agotar(p)}
                className="text-sm font-semibold text-tinta-2 hover:text-tinta"
              >
                {p.disponible ? "Agotar" : "Reponer"}
              </button>
              <button
                onClick={() => borrar(p)}
                className="text-sm font-semibold text-frio hover:text-alerta"
              >
                Eliminar
              </button>
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

  return (
    <div className="flex items-center gap-2">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") crear(); }}
        placeholder="Nueva sección (Entradas, Bebidas…)"
        aria-label="Nombre de la nueva sección"
        className="w-56 rounded-lg border border-linea bg-carta px-3 py-2 text-[0.88rem] text-tinta placeholder:text-frio"
      />
      <button
        onClick={crear}
        disabled={guardando || !nombre.trim()}
        className="rounded-lg px-3 py-2 text-[0.85rem] font-semibold text-brasa-texto hover:bg-brasa-suave disabled:opacity-50"
      >
        Agregar
      </button>
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
    if (!nombre.trim()) { setErrorCampo("Ponele un nombre al plato."); return; }
    if (centavos === null) { setErrorCampo("El precio tiene que ser un número, como 19.90."); return; }
    if (precioAntes.trim()) {
      const antes = aCentavos(precioAntes);
      if (antes === null) { setErrorCampo("El precio anterior tiene que ser un número."); return; }
      if (antes <= centavos) {
        setErrorCampo("El precio anterior tiene que ser MAYOR al que cobrás — si no, no hay descuento que mostrar.");
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-6"
      onClick={cerrar}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-carta p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[1.25rem] font-bold text-tinta">
          {plato ? "Editar plato" : "Nuevo plato"}
        </h2>

        <div className="mt-4 space-y-4">
          <Campo etiqueta="Nombre">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Lomo saltado"
              autoFocus
              className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
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
                    className="w-28 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
                  />
                </div>
                <p className="mt-1 text-[0.72rem] text-frio">Lo que cobrás</p>
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
                    className="w-28 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
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
              Poné un precio anterior y tu plato se muestra con el descuento tachado. Vende más.
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
              className="w-full resize-y rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-[0.9rem] text-tinta placeholder:text-frio"
            />
          </Campo>

          {/* Sin secciones creadas el desplegable ofrece una sola opción y no
              se entiende para qué está: mejor decir cómo se crean. */}
          {carta.categorias.length === 0 ? (
            <Campo etiqueta="Sección">
              <p className="rounded-lg bg-arena/50 px-3 py-2.5 text-[0.85rem] text-frio">
                Todavía no tenés secciones. Creá una (Entradas, Bebidas…) desde la
                lista de platos y después podés mover este plato ahí.
              </p>
            </Campo>
          ) : (
            <Campo etiqueta="Sección">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta"
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
            <p className="text-[0.85rem] font-semibold text-alerta">{errorCampo}</p>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={cerrar}
            className="flex-1 rounded-tarjeta px-4 py-2.5 font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando || !puedeGuardar}
            className="flex-1 rounded-tarjeta bg-orbita px-4 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
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

  async function borrar(g: GrupoOpciones) {
    if (!confirm(`¿Borrar el grupo "${g.nombre}"?`)) return;
    const r = await eliminarGrupo(g.id);
    if (!r.ok) avisar(r.error ?? "No se pudo borrar");
    await recargar();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-md text-[0.88rem] text-frio">
          Un grupo junta opciones que van con un plato: cremas, tamaño, término de la carne.
          Después lo asignás a los platos que lo llevan.
        </p>
        <button
          onClick={() => setAbriendo(true)}
          className="shrink-0 rounded-tarjeta bg-orbita px-5 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo"
        >
          + Nuevo grupo
        </button>
      </div>

      {carta.grupos.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Todavía no tenés extras</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Creá un grupo si tus platos llevan agregados con costo.
          </p>
        </div>
      )}

      {carta.grupos.map((g) => {
        const usanEste = carta.productos.filter((p) => p.grupos.some((x) => x.grupoId === g.id)).length;
        return (
          <div key={g.id} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-tinta">{g.nombre}</p>
                <p className="text-[0.78rem] text-frio">
                  {reglaDelGrupo(g)}
                  {usanEste > 0 && ` · en ${usanEste} ${usanEste === 1 ? "plato" : "platos"}`}
                </p>
              </div>
              <button
                onClick={() => borrar(g)}
                className="shrink-0 text-sm font-semibold text-frio hover:text-alerta"
              >
                Eliminar
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.opciones.map((o) => (
                <span
                  key={o.id}
                  className="rounded-chip bg-arena px-2.5 py-1 text-[0.78rem] text-tinta-2"
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
        <HojaGrupo cerrar={() => setAbriendo(false)} recargar={recargar} />
      )}
    </div>
  );
}

/**
 * "Elegí 1" / "Hasta 3, opcional" — la regla del grupo en palabras.
 *
 * `min`/`max` en crudo no le dice nada al dueño; esto sí le dice qué va a
 * pasarle al cliente cuando pida.
 */
function reglaDelGrupo(g: GrupoOpciones): string {
  if (g.minSelec >= 1 && g.maxSelec === 1) return "Elegí 1 — obligatorio";
  if (g.minSelec >= 1) return `Elegí entre ${g.minSelec} y ${g.maxSelec ?? "las que quieras"}`;
  if (g.maxSelec === 1) return "Hasta 1, opcional";
  return g.maxSelec ? `Hasta ${g.maxSelec}, opcional` : "Las que quiera, opcional";
}

function HojaGrupo({
  cerrar, recargar,
}: { cerrar: () => void; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  // Obligatorio = "hay que elegir uno". Es la distinción que el dueño entiende;
  // min/max son el detalle que se deriva de acá.
  const [obligatorio, setObligatorio] = useState(false);
  const [unaSola, setUnaSola] = useState(true);
  // Cada opción puede llevar foto: "¿qué es chimichurri?" se responde con una
  // imagen, no con el nombre. Viaja como data URL y sube DESPUÉS de crear el
  // grupo, que es cuando existen los ids de las opciones.
  const [opciones, setOpciones] = useState<{ nombre: string; precio: string; foto: string | null }[]>(
    [{ nombre: "", precio: "", foto: null }],
  );
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");

  const llenas = opciones.filter((o) => o.nombre.trim());

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponele un nombre al grupo."); return; }
    if (llenas.length === 0) { setErrorCampo("Agregá al menos una opción."); return; }

    const mal = llenas.find((o) => o.precio.trim() && aCentavos(o.precio) === null);
    if (mal) { setErrorCampo(`El precio de "${mal.nombre}" no es válido.`); return; }

    setErrorCampo("");
    setGuardando(true);
    const r = await crearGrupo({
      nombre: nombre.trim(),
      minSelec: obligatorio ? 1 : 0,
      maxSelec: unaSola ? 1 : null,
      opciones: llenas.map((o) => ({
        nombre: o.nombre.trim(),
        precioCentavos: o.precio.trim() ? aCentavos(o.precio)! : 0,
      })),
    });

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-6"
      onClick={cerrar}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-carta p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[1.25rem] font-bold text-tinta">Nuevo grupo de extras</h2>

        <div className="mt-4 space-y-4">
          <Campo etiqueta="Nombre del grupo" ayuda="Cremas, Tamaño, Término…">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Cremas"
              autoFocus
              className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
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
                    className="min-w-0 flex-1 rounded-lg border border-linea bg-arena/40 px-3 py-2 text-[0.9rem] text-tinta placeholder:text-frio"
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

          {errorCampo && <p className="text-[0.85rem] font-semibold text-alerta">{errorCampo}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={cerrar}
            className="flex-1 rounded-tarjeta px-4 py-2.5 font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 rounded-tarjeta bg-orbita px-4 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-md text-[0.88rem] text-frio">
          Juntá dos o tres platos a un precio especial. El cliente los ve como
          una sola cosa que puede pedir.
        </p>
        <button
          onClick={() => setAbriendo(true)}
          disabled={carta.productos.length === 0}
          className="shrink-0 rounded-tarjeta bg-orbita px-5 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-50"
        >
          + Nuevo combo
        </button>
      </div>

      {carta.productos.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Primero cargá tus platos</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Un combo se arma con platos de tu carta.
          </p>
        </div>
      )}

      {carta.productos.length > 0 && carta.combos.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Todavía no tenés combos</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Una hamburguesa con papas y gaseosa a precio de combo vende más que
            las tres cosas por separado.
          </p>
        </div>
      )}

      {carta.combos.map((c) => {
        const suelto = sueltos(c);
        const ahorro = suelto - c.precioCentavos;
        return (
          <div key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
            {c.fotoUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={c.fotoUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-2 ring-orbita/35" />
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
                  si su combo conviene, ni el cliente por qué pedirlo. */}
              {ahorro > 0 && (
                <p className="text-[0.75rem] text-frio line-through">{precioTexto(suelto)}</p>
              )}
            </div>
            <button onClick={() => borrar(c)} className="text-sm font-semibold text-frio hover:text-alerta">
              Eliminar
            </button>
          </div>
        );
      })}

      {abriendo && (
        <HojaCombo carta={carta} cerrar={() => setAbriendo(false)} recargar={recargar} avisar={avisar} />
      )}
    </div>
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

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponele un nombre al combo."); return; }
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-6" onClick={cerrar}>
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-carta p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[1.25rem] font-bold text-tinta">Nuevo combo</h2>

        <div className="mt-4 space-y-4">
          <CampoFoto foto={foto} alFallar={setErrorCampo} />

          <Campo etiqueta="Nombre" ayuda="Combo familiar, Dúo clásico…">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Combo familiar"
              autoFocus
              className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
            />
          </Campo>

          <Campo etiqueta="Qué lleva" ayuda="Elegí dos o más platos">
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-arena/40 p-2">
              {carta.productos.map((p) => {
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
          </Campo>

          <Campo etiqueta="Precio del combo" ayuda="Lo que cobrás por todo junto">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-frio">S/</span>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                inputMode="decimal"
                placeholder="39.90"
                className="w-32 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
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

          {errorCampo && <p className="text-[0.85rem] font-semibold text-alerta">{errorCampo}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={cerrar} className="flex-1 rounded-tarjeta px-4 py-2.5 font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 rounded-tarjeta bg-orbita px-4 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Promos ──────────────────────────────────────────────────────────────

function Promos({
  carta, recargar, avisar,
}: { carta: Carta; recargar: () => Promise<void>; avisar: (s: string) => void }) {
  const [abriendo, setAbriendo] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-md text-[0.88rem] text-frio">
          Descuentos por día u hora. Se aplican solos cuando el cliente pide dentro de la ventana.
        </p>
        <button
          onClick={() => setAbriendo(true)}
          className="shrink-0 rounded-tarjeta bg-orbita px-5 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo"
        >
          + Nueva promo
        </button>
      </div>

      {carta.descuentos.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">Sin promos activas</p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Creá una para los días flojos: 20% los martes, por ejemplo.
          </p>
        </div>
      )}

      {carta.descuentos.map((d) => (
        <div key={d.id} className="flex items-center gap-3 rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-tinta">{d.nombre}</p>
            <p className="text-[0.8rem] text-frio">{resumenDescuento(d)}</p>
          </div>
          <span
            className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
              d.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
            }`}
          >
            {d.activo ? "Activa" : "Apagada"}
          </span>
          <button onClick={() => alternar(d)} className="text-sm font-semibold text-tinta-2 hover:text-tinta">
            {d.activo ? "Apagar" : "Activar"}
          </button>
          <button onClick={() => borrar(d)} className="text-sm font-semibold text-frio hover:text-alerta">
            Eliminar
          </button>
        </div>
      ))}

      {abriendo && <HojaPromo cerrar={() => setAbriendo(false)} recargar={recargar} />}
    </div>
  );
}

function HojaPromo({
  cerrar, recargar,
}: { cerrar: () => void; recargar: () => Promise<void> }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<"porcentaje" | "monto">("porcentaje");
  const [valor, setValor] = useState("");
  const [dias, setDias] = useState<number[]>([]);
  const [horaDesde, setHoraDesde] = useState("");
  const [horaHasta, setHoraHasta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorCampo, setErrorCampo] = useState("");
  const foto = useFoto(null);

  async function guardar() {
    if (!nombre.trim()) { setErrorCampo("Ponele un nombre a la promo."); return; }

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
      setErrorCampo(tipo === "porcentaje" ? "Poné un porcentaje, como 20." : "Poné un monto, como 5.00.");
      return;
    }

    // Una sola hora sin la otra deja una ventana a medias: el backend la
    // ignoraría y el dueño juraría que la promo está rota.
    if ((horaDesde && !horaHasta) || (!horaDesde && horaHasta)) {
      setErrorCampo("Poné las dos horas, o ninguna.");
      return;
    }

    setErrorCampo("");
    setGuardando(true);
    const r = await crearDescuento({
      nombre: nombre.trim(),
      tipo,
      valor: n,
      dias,
      horaDesde: horaDesde || null,
      horaHasta: horaHasta || null,
    });

    if (!r.ok) { setGuardando(false); setErrorCampo(r.error ?? "No se pudo guardar"); return; }

    // El banner va después: la promo no tiene id hasta que el backend la crea.
    if (r.dato?.id) await foto.guardar("descuentos", r.dato.id);

    setGuardando(false);
    await recargar();
    cerrar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 sm:items-center sm:p-6"
      onClick={cerrar}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-carta p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[1.25rem] font-bold text-tinta">Nueva promo</h2>

        <div className="mt-4 space-y-4">
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
              className="w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
            />
          </Campo>

          <Campo etiqueta="Descuento">
            <div className="flex items-center gap-2">
              <select
                value={tipo}
                onChange={(e) => { setTipo(e.target.value as "porcentaje" | "monto"); setValor(""); }}
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta"
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
                className="w-24 rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
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

          <Campo etiqueta="Horario" ayuda="Vacío = todo el día">
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={horaDesde}
                onChange={(e) => setHoraDesde(e.target.value)}
                aria-label="Desde qué hora"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta"
              />
              <span className="text-frio">a</span>
              <input
                type="time"
                value={horaHasta}
                onChange={(e) => setHoraHasta(e.target.value)}
                aria-label="Hasta qué hora"
                className="rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta"
              />
            </div>
          </Campo>

          {errorCampo && <p className="text-[0.85rem] font-semibold text-alerta">{errorCampo}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={cerrar}
            className="flex-1 rounded-tarjeta px-4 py-2.5 font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex-1 rounded-tarjeta bg-orbita px-4 py-2.5 font-semibold text-sobre-orbita transition hover:bg-orbita-hondo disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
