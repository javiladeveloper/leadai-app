"use client";

import Link from "next/link";
import { IconoRayo, IconoWhatsApp, IconoInstagram, IconoBandeja } from "@/components/Iconos";

/**
 * LO QUE DESBLOQUEA EL PLAN FULL (2026-08-31).
 *
 * La sección sigue en el menú y esta pantalla sigue abriendo: esconder el ítem
 * sería peor de las dos maneras — el dueño no se entera de que existe (y
 * entonces nunca lo compra), y si alguna vez lo vio, la desaparición se lee como
 * que se rompió algo.
 *
 * SE VE COMO EL RESTO DEL PANEL, no como un aviso de sistema. La primera versión
 * era una lista de texto plano en una tarjeta blanca: se leía como una nota
 * legal, no como algo que dan ganas de comprar. Acá se usa el mismo lenguaje que
 * el Inicio —header oscuro con el número grande, tarjetas con íconos en círculo,
 * `entra` para la aparición escalonada— porque es la pantalla que tiene que
 * convencer, y la que peor se veía.
 *
 * CADA TARJETA DICE LO QUE HACE, NO CÓMO SE LLAMA. "Escríbele a todos de una" y
 * no "campañas masivas": el dueño que nunca mandó una no sabe qué es lo segundo.
 */

const BENEFICIOS = [
  {
    Icono: IconoWhatsApp,
    titulo: "Escríbele a todos de una",
    detalle:
      "La promo del viernes le llega a los que ya te compraron, desde tu propio número.",
  },
  {
    Icono: IconoBandeja,
    titulo: "Trae de vuelta al que no volvió",
    detalle:
      "El bot le escribe solo al que hace rato no pide. Es la venta más barata: ya te conoce.",
  },
  {
    Icono: IconoRayo,
    titulo: "Tus promos se ofrecen solas",
    detalle:
      "El bot cuenta lo del día antes de que el cliente elija, así pide dos en vez de una.",
  },
  {
    Icono: IconoInstagram,
    titulo: "Anuncios en Facebook e Instagram",
    detalle: "Con lo que gastaste y cuánta gente llegó, en números reales.",
  },
];

export function MarketingBloqueado({ nombreNegocio }: { nombreNegocio?: string }) {
  return (
    <div className="space-y-5">
      {/* EL HEADER OSCURO es el mismo del Inicio: ancla la pantalla en el panel
          en vez de que parezca un modal de sistema. */}
      <section className="entra rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)] lg:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
          Con el plan Full
        </p>
        <h1 className="mt-1 text-[1.9rem] font-bold leading-tight lg:text-[2.2rem]">
          Vender más, sin que tengas
          <br className="hidden sm:block" /> que hacerlo tú
        </h1>
        <p className="mt-2 max-w-md text-[0.95rem] text-arena/70">
          {nombreNegocio
            ? `Cuatro formas de que ${nombreNegocio} venda más con los clientes que ya tiene.`
            : "Cuatro formas de vender más con los clientes que ya tienes."}
        </p>
      </section>

      {/* LAS CUATRO, EN GRILLA. Una lista vertical de párrafos se lee como
          letra chica; cuatro tarjetas se recorren de un vistazo. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {BENEFICIOS.map(({ Icono, titulo, detalle }) => (
          <div
            key={titulo}
            className="entra flex gap-3.5 rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brasa-suave text-brasa-texto">
              <Icono className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.95rem] font-bold leading-snug text-tinta">{titulo}</p>
              <p className="mt-1 text-[0.86rem] leading-snug text-tinta-2">{detalle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* EL CIERRE. El botón va con el color de acción del panel, no en negro:
          un negro suelto no existe en ninguna otra pantalla. */}
      <div className="entra flex flex-wrap items-center justify-between gap-4 rounded-tarjeta bg-brasa-suave p-5">
        <div>
          <p className="text-[1.02rem] font-bold text-tinta">Actívalo cuando quieras</p>
          <p className="mt-0.5 text-[0.86rem] text-tinta-2">
            Se suma a todo lo que ya tienes. Sin permanencia.
          </p>
        </div>
        <Link
          href="/configuracion?t=plan"
          className="rounded-full bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99]"
        >
          Ver el plan Full
        </Link>
      </div>
    </div>
  );
}
