/**
 * Una sección de Configuración: su propia tarjeta, con título y bajada.
 *
 * Antes (2026-08-18) la página envolvía TODO en una tarjeta blanca y cada
 * bloque metía otra tarjeta blanca adentro: tres capas de la misma superficie,
 * sin nada que pesara más que lo demás. Ahora cada sección es una tarjeta sobre
 * el fondo arena, como en Carta.
 *
 * LOS CUATRO COLORES (segunda pasada, 2026-08-18). Con todo en blanco la
 * pantalla quedaba sin peso: el verde hondo del logo —que es la ESTRUCTURA de
 * la marca— no aparecía ni una vez en el contenido, solo en el sidebar. Inicio,
 * Carta y Reportes ya lo usan para su bloque principal; Configuración era la
 * única que no.
 *
 * · `tono="hondo"` → verde hondo #0e1614: el bloque PRINCIPAL de cada pestaña.
 *   Uno solo por pantalla — dos tarjetas oscuras y ninguna destaca.
 * · `tono="claro"` (default) → blanco: todo lo demás.
 * · `acento` → la barrita naranja del título, para el bloque principal claro
 *   cuando la pestaña no tiene uno oscuro.
 */
export function Seccion({
  titulo,
  bajada,
  tono = "claro",
  acento = false,
  accion,
  children,
}: {
  titulo: string;
  bajada?: string;
  tono?: "claro" | "hondo";
  acento?: boolean;
  /** Control alineado a la derecha del título (un switch, un botón). */
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hondo = tono === "hondo";

  return (
    <section
      className={`rounded-tarjeta shadow-[var(--sombra-tarjeta)] ${
        hondo ? "bg-superficie-honda text-arena" : "bg-carta ring-1 ring-linea"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 lg:px-6 lg:pt-6">
        <div className="min-w-0">
          <h2
            className={`flex items-center gap-2 text-[1.02rem] font-bold ${
              hondo ? "text-arena" : "text-tinta"
            }`}
          >
            {acento && !hondo && (
              <span className="h-4 w-1 shrink-0 rounded-full bg-orbita" aria-hidden />
            )}
            {titulo}
          </h2>
          {bajada && (
            /* Sobre el verde hondo el gris `frio` no llega a contraste legible:
               ahí la bajada es arena a 70%, igual que en la tarjeta de Inicio. */
            <p
              className={`mt-1 text-[0.84rem] leading-snug ${
                hondo ? "text-arena/70" : "text-frio"
              }`}
            >
              {bajada}
            </p>
          )}
        </div>
        {accion}
      </div>
      <div className="px-5 pb-5 pt-4 lg:px-6 lg:pb-6">{children}</div>
    </section>
  );
}

export default Seccion;
