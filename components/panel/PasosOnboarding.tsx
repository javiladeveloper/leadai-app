"use client";

/**
 * LA BARRA DE PASOS DEL ALTA (2026-08-18).
 *
 * Un formulario largo asusta; los mismos campos repartidos en pasos cortos, no
 * — y saber cuántos faltan es lo que hace que la persona siga en vez de cerrar
 * la pestaña.
 *
 * Los pasos se muestran SIEMPRE todos: ver "3 de 5" tranquiliza, ver un paso
 * suelto sin contexto no dice nada.
 *
 * `total` PUEDE SER `null` (2026-08-25). En el primer paso todavía no se sabe
 * a qué se dedica el negocio, y de eso depende cuántos pasos son: comida hace
 * 6, el resto hace 2. Decía "1 de 2" y al elegir restaurante saltaba a "de 6",
 * o sea que el número que estaba para tranquilizar hacía lo contrario —
 * prometía un alta corta y después la alargaba.
 *
 * Con `null` no se promete nada: se muestra "Paso 1" a secas hasta saberlo.
 * Es preferible decir menos que decir algo que se va a desmentir.
 */
export function PasosOnboarding({ actual, total }: { actual: number; total: number | null }) {
  // Sin total conocido: una sola barra a medio llenar. No se puede dibujar un
  // progreso honesto sobre un largo que todavía no existe.
  if (total === null) {
    return (
      <div className="mb-8">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[0.78rem] font-bold uppercase tracking-wide text-calor">
            Paso {actual}
          </span>
        </div>
        <div className="flex gap-1.5">
          <div className="h-1.5 flex-1 rounded-full bg-brasa" />
          <div className="h-1.5 flex-[3] rounded-full bg-linea" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[0.78rem] font-bold uppercase tracking-wide text-calor">
          Paso {actual} de {total}
        </span>
        <span className="text-[0.78rem] text-frio">
          {Math.round((actual / total) * 100)}%
        </span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i < actual ? "bg-brasa" : "bg-linea"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * La pantalla de "estamos preparando tu negocio".
 *
 * No es puro adorno: mientras corre se están guardando cosas de verdad, y
 * mostrar QUÉ se guardó le dice a la persona que sus datos llegaron. Un
 * spinner mudo deja la duda de si se perdió algo.
 */
export function Preparando({
  items, alTerminar,
}: {
  items: { emoji: string; titulo: string; detalle: string; hecho: boolean }[];
  alTerminar?: () => void;
}) {
  const listos = items.filter((i) => i.hecho).length;
  const pct = items.length > 0 ? Math.round((listos / items.length) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-lg">
      <h1 className="text-center text-[1.8rem] font-bold leading-tight text-tinta">
        Preparando tu negocio
      </h1>
      <p className="mt-1.5 text-center text-tinta-2">
        {listos === items.length ? "¡Todo listo!" : "Un segundo…"}
      </p>

      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-linea">
        <div
          className="h-full rounded-full bg-brasa transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-6 divide-y divide-linea rounded-tarjeta bg-carta ring-1 ring-linea">
        {items.map((i) => (
          <div key={i.titulo} className="flex items-center gap-3 px-4 py-3.5">
            <span className="text-[1.3rem]">{i.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8rem] text-frio">{i.titulo}</p>
              <p className="truncate font-semibold text-tinta">{i.detalle}</p>
            </div>
            {i.hecho ? (
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brasa text-[0.8rem] font-bold text-sobre-brasa">
                ✓
              </span>
            ) : (
              <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-linea border-t-brasa" />
            )}
          </div>
        ))}
      </div>

      {listos === items.length && alTerminar && (
        <button
          onClick={alTerminar}
          className="entra mt-6 w-full rounded-tarjeta bg-orbita py-3.5 font-bold text-sobre-orbita transition hover:bg-orbita-hondo"
        >
          Ir a mi panel
        </button>
      )}
    </div>
  );
}
