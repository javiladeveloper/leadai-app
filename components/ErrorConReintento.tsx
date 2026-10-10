"use client";

/**
 * UN ERROR QUE SE PUEDE ARREGLAR DESDE AHÍ MISMO (2026-10-09).
 *
 * Una docena de pantallas decía "No pudimos cargar X. Recarga." y nada más:
 * la única salida era el F5 del navegador, que en el celular casi nadie
 * encuentra, y que además tira todo lo demás que sí había cargado. El patrón
 * bueno ya existía en la Agenda y en Marketing (`ErrorMarketing`): decir qué
 * falló y ofrecer reintentar SOLO eso.
 *
 * `compacto` para columnas angostas (la lista de Conversaciones).
 */
export function ErrorConReintento({
  mensaje,
  reintentar,
  compacto = false,
  className = "",
}: {
  mensaje: string;
  reintentar?: () => void;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-tarjeta bg-carta text-center ring-1 ring-linea ${compacto ? "p-3" : "p-5 shadow-[var(--sombra-tarjeta)]"} ${className}`}
    >
      <p className={`font-semibold text-tinta ${compacto ? "text-[0.85rem]" : ""}`}>{mensaje}</p>
      {reintentar && (
        <button
          type="button"
          onClick={reintentar}
          className={`mt-3 inline-flex items-center justify-center rounded-tarjeta bg-brasa font-semibold text-sobre-brasa transition hover:bg-brasa-hondo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa active:scale-[0.99] ${
            compacto ? "px-3.5 py-1.5 text-[0.8rem]" : "px-5 py-2.5 text-[0.9rem]"
          }`}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
