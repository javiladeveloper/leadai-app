"use client";

import { useMemo, useState } from "react";
import { sinTildes, type Carta, type GrupoOpciones } from "@/lib/carta";

/**
 * ELEGIR LAS OPCIONES DE UN PLATO O DE UN COMBO (2026-08-24).
 *
 * Reportado por Jonathan en la demo: agregó un combo desde el mostrador y el
 * sistema nunca le preguntó los sabores. Hasta entonces no había qué preguntar
 * —un combo era nombre, precio y platos fijos— y el mostrador tampoco
 * preguntaba las opciones de un producto simple.
 *
 * BUSCADOR Y SECCIONES EN LOS GRUPOS LARGOS (2026-08-25, reporte de Jonathan).
 * La primera versión ponía todas las opciones como chips en una nube: el
 * "Elegí tu roll" de Shiro son 39 rolls, y encontrar "Sakana Aburi" entre ellos
 * era barrer la pantalla con la vista. Es el MISMO problema que ya se había
 * resuelto al armar combos en la carta ("Shiro tiene 48 platos y esta lista los
 * mostraba todos planos"), así que se resuelve igual: buscador arriba, filas de
 * ancho completo, y las opciones AGRUPADAS POR LA SECCIÓN DE LA CARTA.
 *
 * La sección sale de cruzar el nombre de la opción con el del producto: una
 * `OpcionCarta` no tiene categoría propia —un "extra de tocino" no es un plato—
 * pero cuando el grupo lista rolls, cada opción SÍ es un producto de la carta.
 * Si no matchea, la opción va a "Otros" en vez de desaparecer.
 *
 * EL SERVIDOR VALIDA IGUAL. Este modal es para que la persona no se equivoque,
 * no para asegurar nada: `crearPedidoLocal` rechaza el pedido si falta una
 * opción obligatoria, porque esta pantalla se puede saltear.
 */

export interface OpcionesElegidas {
  opcionIds: string[];
  /** Para mostrar en la comanda: "Emperatriz A (Acevichada)". */
  etiquetas: string[];
  /** Lo que suman las opciones elegidas, para el precio en vivo. */
  extraCentavos: number;
}

/**
 * A partir de cuántas opciones aparece el buscador.
 *
 * Debajo de esto, buscar cuesta más que mirar: el campo ocuparía el lugar de
 * las tres opciones que hay.
 */
const OPCIONES_PARA_BUSCADOR = 8;

const soles = (c: number) => `S/${(c / 100).toFixed(2)}`;

export default function ElegirOpciones({
  titulo,
  grupos,
  carta,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  grupos: GrupoOpciones[];
  /** Para resolver a qué sección pertenece cada opción. */
  carta: Carta | null;
  onConfirmar: (elegidas: OpcionesElegidas) => void;
  onCancelar: () => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  /** Un buscador por grupo: filtrar "roll" no debe esconder las entradas. */
  const [busca, setBusca] = useState<Record<string, string>>({});

  function alternar(g: GrupoOpciones, opcionId: string) {
    setSel((s) => {
      const actual = s[g.id] ?? [];
      if (actual.includes(opcionId)) {
        return { ...s, [g.id]: actual.filter((x) => x !== opcionId) };
      }
      // Un grupo de "elegí 1" se comporta como radio: la nueva REEMPLAZA a la
      // anterior en vez de rebotar. Rebotar obliga a deseleccionar primero, y
      // en el mostrador eso es un clic perdido con el cliente esperando.
      if (g.maxSelec === 1) return { ...s, [g.id]: [opcionId] };
      if (g.maxSelec != null && actual.length >= g.maxSelec) return s;
      return { ...s, [g.id]: [...actual, opcionId] };
    });
  }

  /**
   * A qué sección de la carta pertenece cada opción, por nombre.
   *
   * Se arma UNA vez para todos los grupos: cruzar 39 opciones contra 48
   * productos dentro del render sería rehacerlo en cada tecla del buscador.
   */
  const seccionPorNombre = useMemo(() => {
    const m = new Map<string, string>();
    if (!carta) return m;
    const nombreDeCat = new Map(carta.categorias.map((c) => [c.id, c.nombre]));
    for (const p of carta.productos) {
      const cat = p.categoriaId ? nombreDeCat.get(p.categoriaId) : undefined;
      if (cat) m.set(sinTildes(p.nombre.toLowerCase()), cat);
    }
    return m;
  }, [carta]);

  const faltan = useMemo(
    () => grupos.filter((g) => (sel[g.id]?.length ?? 0) < g.minSelec),
    [grupos, sel],
  );

  const resumen = useMemo<OpcionesElegidas>(() => {
    const ids: string[] = [];
    const etiquetas: string[] = [];
    let extra = 0;
    for (const g of grupos) {
      const elegidas = (sel[g.id] ?? [])
        .map((id) => g.opciones.find((o) => o.id === id))
        .filter((o) => o != null);
      // Las que van SIN CARGO son las más caras, igual que en el servidor
      // (`sinCargoDe` en core/precios-carrito.ts): es lo que espera el cliente
      // y evita la sensación de que le cobran justo la cara.
      const precios = elegidas.map((o) => o.precioCentavos).sort((a, b) => b - a);
      extra += precios.slice(g.sinCargo ?? 0).reduce((s, v) => s + v, 0);
      for (const o of elegidas) {
        ids.push(o.id);
        etiquetas.push(o.nombre);
      }
    }
    return { opcionIds: ids, etiquetas, extraCentavos: extra };
  }, [grupos, sel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Opciones de ${titulo}`}
      onClick={onCancelar}
    >
      <div
        className="surge flex max-h-[88vh] w-full max-w-md flex-col rounded-t-tarjeta bg-carta shadow-xl sm:rounded-tarjeta"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABECERA FIJA: con 34 opciones se scrollea mucho, y perder de vista
            qué se está pidiendo desorienta. */}
        <div className="shrink-0 border-b border-linea px-4 pb-3 pt-4">
          <h3 className="text-[1.05rem] font-semibold text-tinta">{titulo}</h3>
          {resumen.etiquetas.length > 0 && (
            <p className="mt-0.5 text-[0.82rem] text-tinta-2">{resumen.etiquetas.join(" · ")}</p>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {grupos.map((g) => {
            const elegidas = sel[g.id] ?? [];
            const falta = elegidas.length < g.minSelec;
            const q = sinTildes((busca[g.id] ?? "").trim().toLowerCase());
            const visibles = q
              ? g.opciones.filter((o) => sinTildes(o.nombre.toLowerCase()).includes(q))
              : g.opciones;
            const conBuscador = g.opciones.length >= OPCIONES_PARA_BUSCADOR;

            // POR SECCIÓN, en el orden de la carta. "Otros" al final junta lo
            // que no es un plato (un extra, una salsa) — nada se pierde.
            const secciones: { nombre: string; opciones: typeof visibles }[] = [];
            if (conBuscador) {
              const orden = carta?.categorias.map((c) => c.nombre) ?? [];
              const porSeccion = new Map<string, typeof visibles>();
              for (const o of visibles) {
                const sec = seccionPorNombre.get(sinTildes(o.nombre.toLowerCase())) ?? "Otros";
                porSeccion.set(sec, [...(porSeccion.get(sec) ?? []), o]);
              }
              for (const nombre of orden) {
                const ops = porSeccion.get(nombre);
                if (ops?.length) secciones.push({ nombre, opciones: ops });
              }
              const otros = porSeccion.get("Otros");
              if (otros?.length) secciones.push({ nombre: "Otros", opciones: otros });
            }
            // Una sola sección no aporta nada: sería un título repitiendo lo
            // que el grupo ya dice.
            const conSecciones = secciones.length > 1;

            return (
              <div key={g.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.9rem] font-semibold text-tinta">{g.nombre}</p>
                  {/* La regla se dice ANTES de elegir, no como error después. */}
                  <span className={`shrink-0 text-[0.74rem] ${falta ? "font-semibold text-tibio" : "text-frio"}`}>
                    {g.minSelec > 0
                      ? `Elige ${g.minSelec === (g.maxSelec ?? g.minSelec) ? g.minSelec : `${g.minSelec} o más`}`
                      : "Opcional"}
                    {(g.sinCargo ?? 0) > 0 && ` · ${g.sinCargo} sin costo`}
                  </span>
                </div>

                {conBuscador && (
                  <input
                    value={busca[g.id] ?? ""}
                    onChange={(e) => setBusca((b) => ({ ...b, [g.id]: e.target.value }))}
                    placeholder={`🔍 Buscar en ${g.opciones.length} opciones…`}
                    aria-label={`Buscar en ${g.nombre}`}
                    className="mt-2 w-full rounded-full bg-arena px-3.5 py-2 text-[0.86rem] text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-2 focus:ring-brasa"
                  />
                )}

                {/* FILAS, NO CHIPS, cuando son muchas: los chips de ancho
                    variable arman una nube que no se puede barrer con la vista.
                    Con pocas, los chips leen mejor y ocupan menos alto. */}
                {conSecciones ? (
                  <div className="mt-2 space-y-3">
                    {secciones.map((sec) => (
                      <div key={sec.nombre}>
                        <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                          {sec.nombre}
                        </p>
                        <div className="space-y-1">
                          {sec.opciones.map((o) => (
                            <FilaOpcion
                              key={o.id}
                              opcion={o}
                              activa={elegidas.includes(o.id)}
                              onClick={() => alternar(g, o.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className={conBuscador ? "mt-2 space-y-1" : "mt-1.5 flex flex-wrap gap-1.5"}>
                  {visibles.map((o) => {
                    const activa = elegidas.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => alternar(g, o.id)}
                        className={
                          conBuscador
                            ? `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.86rem] transition ${
                                activa
                                  ? "bg-brasa font-semibold text-sobre-brasa"
                                  : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
                              }`
                            : `rounded-chip px-3 py-1.5 text-[0.84rem] font-medium transition ${
                                activa
                                  ? "bg-brasa text-sobre-brasa"
                                  : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
                              }`
                        }
                      >
                        <span>{o.nombre}</span>
                        {o.precioCentavos > 0 && (
                          <span className={activa ? "opacity-80" : "text-frio"}>
                            +{soles(o.precioCentavos)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {visibles.length === 0 && (
                    <p className="py-2 text-[0.84rem] text-frio">Nada con ese nombre.</p>
                  )}
                </div>
                )}
                {conSecciones && visibles.length === 0 && (
                  <p className="py-2 text-[0.84rem] text-frio">Nada con ese nombre.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* PIE FIJO: el botón no se busca scrolleando hasta el fondo. */}
        <div className="shrink-0 border-t border-linea px-4 pb-4 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={faltan.length > 0}
              onClick={() => onConfirmar(resumen)}
              className="flex-1 rounded-full bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
            >
              {faltan.length > 0
                ? `Falta elegir ${faltan[0].nombre}`
                : `Agregar${resumen.extraCentavos > 0 ? ` (+${soles(resumen.extraCentavos)})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Una opción como fila de ancho completo, con su precio a la derecha. */
function FilaOpcion({
  opcion, activa, onClick,
}: {
  opcion: { nombre: string; precioCentavos: number };
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[0.86rem] transition ${
        activa
          ? "bg-brasa font-semibold text-sobre-brasa"
          : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
      }`}
    >
      <span>{opcion.nombre}</span>
      {opcion.precioCentavos > 0 && (
        <span className={activa ? "opacity-80" : "text-frio"}>
          +{soles(opcion.precioCentavos)}
        </span>
      )}
    </button>
  );
}
