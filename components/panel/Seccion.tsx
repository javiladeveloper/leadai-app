/**
 * Una sección de Configuración: su propia tarjeta, con título y bajada.
 *
 * Antes (2026-08-18) la página envolvía TODO en una tarjeta blanca y cada
 * bloque metía otra tarjeta blanca adentro: tres capas de la misma superficie,
 * sin nada que pesara más que lo demás. Ahora cada sección es una tarjeta sobre
 * el fondo arena, como en Carta.
 *
 * `acento` marca la sección con la barrita naranja de la izquierda — el mismo
 * recurso que separa las secciones de la carta. Se reserva para el bloque
 * PRINCIPAL de cada pestaña: si todas la llevan, no marca nada.
 */
export function Seccion({
  titulo,
  bajada,
  acento = false,
  accion,
  children,
}: {
  titulo: string;
  bajada?: string;
  acento?: boolean;
  /** Control alineado a la derecha del título (un switch, un botón). */
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-tarjeta bg-carta shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 lg:px-6 lg:pt-6">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[1.02rem] font-bold text-tinta">
            {acento && (
              <span className="h-4 w-1 shrink-0 rounded-full bg-orbita" aria-hidden />
            )}
            {titulo}
          </h2>
          {bajada && <p className="mt-1 text-[0.84rem] leading-snug text-frio">{bajada}</p>}
        </div>
        {accion}
      </div>
      <div className="px-5 pb-5 pt-4 lg:px-6 lg:pb-6">{children}</div>
    </section>
  );
}

export default Seccion;
