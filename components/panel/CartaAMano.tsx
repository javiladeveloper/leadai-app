"use client";

import { useRef, useState } from "react";
import type { ItemImportado } from "@/lib/carta";
import { aCentavos, precioTexto } from "@/lib/carta";

/**
 * CARGAR LA CARTA ESCRIBIÉNDOLA (2026-08-25).
 *
 * El onboarding tenía dos caminos para la carta y los DOS exigían un archivo:
 * subir una foto/PDF/Excel, o descargar una plantilla de Excel para volver con
 * un archivo. El dueño que tiene su carta en la cabeza —o en un cuaderno—
 * quedaba trabado en el paso más importante, y su única salida era "Saltar":
 * un negocio sin carta, que es exactamente lo que hace inútil al bot.
 *
 * PENSADO PARA EL CELULAR Y PARA IR RÁPIDO: se escribe plato y precio, Enter
 * agrega y el foco vuelve al nombre. Cargar quince platos son treinta toques
 * sin levantar la vista del teclado.
 *
 * NO PIDE SECCIÓN NI DESCRIPCIÓN. En el alta lo que importa es que el bot
 * pueda vender: nombre y precio alcanzan. Ordenar por secciones y poner fotos
 * es trabajo de después, en la pantalla de Carta, con calma.
 */
export function CartaAMano({
  items,
  onCambio,
}: {
  items: ItemImportado[];
  onCambio: (items: ItemImportado[]) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState("");
  const campoNombre = useRef<HTMLInputElement>(null);

  function agregar() {
    const n = nombre.trim();
    if (!n) { setError("Escribe el nombre del plato."); return; }
    const centavos = aCentavos(precio);
    if (centavos === null) { setError("El precio tiene que ser un número, como 18.50."); return; }

    setError("");
    onCambio([...items, { nombre: n, precioCentavos: centavos }]);
    setNombre("");
    setPrecio("");
    // El foco vuelve al nombre: el siguiente plato se escribe de una.
    campoNombre.current?.focus();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <input
          ref={campoNombre}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          // ENTER AGREGA: en el celular es la tecla que ya está bajo el pulgar.
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder="Lomo saltado"
          aria-label="Nombre del plato"
          autoFocus
          className="min-w-[9rem] flex-[2] rounded-full bg-carta px-4 py-2.5 text-[0.95rem] text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-2 focus:ring-brasa"
        />
        <div className="flex min-w-[7rem] flex-1 items-center gap-1.5 rounded-full bg-carta px-3.5 py-2.5 ring-1 ring-linea focus-within:ring-2 focus-within:ring-brasa">
          <span className="text-[0.9rem] font-semibold text-tinta-2">S/</span>
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.,]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
            // `decimal` abre el teclado numérico del celular, no el de letras.
            inputMode="decimal"
            placeholder="18.50"
            aria-label="Precio del plato"
            className="w-full bg-transparent text-[0.95rem] font-semibold text-tinta outline-none tabular-nums"
          />
        </div>
        <button
          type="button"
          onClick={agregar}
          className="rounded-full bg-brasa px-5 py-2.5 text-[0.9rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
        >
          Agregar
        </button>
      </div>

      {error && <p className="mt-2 text-[0.85rem] text-alerta">{error}</p>}

      {items.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[0.85rem] font-semibold text-tinta">
            {items.length} {items.length === 1 ? "plato cargado" : "platos cargados"}
          </p>
          <div className="scroll-fino max-h-64 space-y-1 overflow-y-auto rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
            {items.map((i, n) => (
              <div key={`${i.nombre}-${n}`} className="flex items-center gap-2 text-[0.9rem]">
                <span className="min-w-0 flex-1 truncate text-tinta">{i.nombre}</span>
                <span className="shrink-0 font-semibold tabular-nums text-calor">
                  {precioTexto(i.precioCentavos)}
                </span>
                {/* Quitar es más importante de lo que parece: escribiendo
                    rápido se agrega un plato mal y sin esto hay que empezar
                    de nuevo. */}
                <button
                  type="button"
                  onClick={() => onCambio(items.filter((_, x) => x !== n))}
                  aria-label={`Quitar ${i.nombre}`}
                  className="shrink-0 rounded-chip px-1.5 text-frio transition hover:text-alerta"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
