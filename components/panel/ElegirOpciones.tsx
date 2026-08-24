"use client";

import { useMemo, useState } from "react";
import type { GrupoOpciones } from "@/lib/carta";

/**
 * ELEGIR LAS OPCIONES DE UN PLATO O DE UN COMBO (2026-08-24).
 *
 * Reportado por Jonathan en la demo: agregó un combo desde el mostrador y el
 * sistema nunca le preguntó los sabores. Hasta hoy no había qué preguntar —un
 * combo era nombre, precio y platos fijos— y el mostrador tampoco preguntaba
 * las opciones de un producto simple.
 *
 * EL SERVIDOR VALIDA IGUAL. Este modal es para que la persona no se equivoque,
 * no para asegurar nada: `crearPedidoLocal` rechaza el pedido si falta una
 * opción obligatoria, porque esta pantalla se puede saltear.
 *
 * NO SE ABRE SI NO HAY NADA QUE PREGUNTAR: quien lo llama solo lo monta cuando
 * el ítem tiene grupos. Un modal vacío para agregar una gaseosa sería un clic
 * de más en la hora pico.
 */

export interface OpcionesElegidas {
  opcionIds: string[];
  /** Para mostrar en la comanda: "Emperatriz A (Acevichada)". */
  etiquetas: string[];
  /** Lo que suman las opciones elegidas, para el precio en vivo. */
  extraCentavos: number;
}

const soles = (c: number) => `S/${(c / 100).toFixed(2)}`;

export default function ElegirOpciones({
  titulo,
  grupos,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  grupos: GrupoOpciones[];
  onConfirmar: (elegidas: OpcionesElegidas) => void;
  onCancelar: () => void;
}) {
  const [sel, setSel] = useState<Record<string, string[]>>({});

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
        className="surge max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-tarjeta bg-carta p-4 shadow-xl sm:rounded-tarjeta"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[1.05rem] font-semibold text-tinta">{titulo}</h3>

        <div className="mt-3 space-y-4">
          {grupos.map((g) => {
            const elegidas = sel[g.id] ?? [];
            const falta = elegidas.length < g.minSelec;
            return (
              <div key={g.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.9rem] font-semibold text-tinta">{g.nombre}</p>
                  {/* La regla se dice ANTES de elegir, no como error después. */}
                  <span className={`text-[0.74rem] ${falta ? "font-semibold text-tibio" : "text-frio"}`}>
                    {g.minSelec > 0
                      ? `Elige ${g.minSelec === (g.maxSelec ?? g.minSelec) ? g.minSelec : `${g.minSelec} o más`}`
                      : "Opcional"}
                    {(g.sinCargo ?? 0) > 0 && ` · ${g.sinCargo} sin costo`}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {/* Sin filtrar por disponible: el tipo del panel no lo trae,
                      y el servidor descarta las no disponibles al cobrar. */}
                  {g.opciones.map((o) => {
                    const activa = elegidas.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => alternar(g, o.id)}
                        className={`rounded-chip px-3 py-1.5 text-[0.84rem] font-medium transition ${
                          activa
                            ? "bg-brasa text-sobre-brasa"
                            : "text-tinta-2 ring-1 ring-linea hover:bg-arena"
                        }`}
                      >
                        {o.nombre}
                        {o.precioCentavos > 0 && (
                          <span className={activa ? "opacity-80" : "text-frio"}> +{soles(o.precioCentavos)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
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
  );
}
