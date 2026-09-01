"use client";

/**
 * LA ESPERA, IGUAL EN TODO EL PANEL (2026-09-01).
 *
 * Pedido de Jonathan: "pon la misma animación para cada cosa... cargando tus
 * placas, cargando tu equipo, cargando carta... para todo lo que demore".
 *
 * Antes cada pantalla copiaba las clases del spinner, así que había cuatro
 * variantes de tamaño y color conviviendo — y arreglar una no arreglaba las
 * otras. Acá vive una sola vez.
 *
 * MOSTRAR UN ESQUELETO DE CAJAS GRISES CON LOS TÍTULOS PUESTOS ES PEOR que no
 * mostrar nada: se ve la página armándose a pedazos. Un skeleton sirve cuando
 * el resto de la pantalla YA es real y falta un bloque; cuando falta todo, esto.
 */
export function Cargando({ que }: { que?: string }) {
  return (
    <div
      className="grid min-h-[50vh] place-items-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-3">
        {/* `girando` y no `animate-spin` (2026-09-01): el bloque de
            `prefers-reduced-motion` del globals.css anula TODAS las animaciones
            con `!important`, y con "reducir movimiento" activado en el sistema
            el spinner quedaba clavado. Para una decoración eso está bien; para
            un spinner no, porque su único trabajo es decir "esto sigue vivo" —
            uno quieto se lee igual que una pantalla colgada.

            La clase propia SÍ respeta la preferencia: gira más lento y sin
            saltos, en vez de no girar. */}
        <span className="girando h-11 w-11 rounded-full border-[3px] border-arena-2 border-t-brasa border-r-brasa" />
        <p className="text-[0.86rem] text-frio">
          {que ? `Cargando ${que}…` : "Cargando…"}
        </p>
      </div>
    </div>
  );
}
