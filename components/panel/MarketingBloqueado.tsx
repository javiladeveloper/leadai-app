"use client";

import { PlanBloqueado } from "@/components/panel/PlanBloqueado";

/**
 * EL CANDADO DE MARKETING (2026-08-31, generalizado 2026-09-01).
 *
 * El diseño vive en `PlanBloqueado`, que sirve para cualquier sección: acá solo
 * queda QUÉ dice esta. Antes era una copia entera del layout, y al agregar
 * Reportes iban a ser dos copias que se separan con cada retoque.
 */
export function MarketingBloqueado({ nombreNegocio }: { nombreNegocio?: string }) {
  return (
    <PlanBloqueado
      plan="Full"
      titulo="Vender más, sin que tengas que hacerlo tú"
      bajada={
        nombreNegocio
          ? `Cuatro formas de que ${nombreNegocio} venda más con los clientes que ya tiene.`
          : "Cuatro formas de vender más con los clientes que ya tienes."
      }
      beneficios={[
        {
          titulo: "Escríbele a todos de una",
          detalle:
            "La promo del viernes le llega a los que ya te compraron, desde tu propio número.",
        },
        {
          titulo: "Trae de vuelta al que no volvió",
          detalle:
            "El bot le escribe solo al que hace rato no pide. Es la venta más barata: ya te conoce.",
        },
        {
          titulo: "Tus promos se ofrecen solas",
          detalle:
            "El bot cuenta lo del día antes de que el cliente elija, así pide dos en vez de una.",
        },
        {
          titulo: "Anuncios en Facebook e Instagram",
          detalle: "Con lo que gastaste y cuánta gente llegó, en números reales.",
        },
      ]}
    />
  );
}
