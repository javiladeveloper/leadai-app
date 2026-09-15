// DATOS DEL NEGOCIO QUE NO SON DE LA CARTA (2026-09-14).
//
// El link para compartir y las redes los tiene CUALQUIER negocio: una
// inmobiliaria, un contador, un gimnasio. Se editan en Marketing → Presencia.
//
// Vivían en `lib/carta.ts` porque el primer lugar donde aparecieron fue la
// carta del restaurante, y ahí quedaron. Eso ataba Marketing —una pantalla que
// este panel sigue teniendo— al módulo de restaurantes, que se fue a Wappido:
// el día que alguien limpie `lib/carta.ts` se lleva por delante el guardado del
// Instagram de un negocio de ventas.
//
// Acá viven solos, con los campos que le importan a un negocio cualquiera.

"use client";

import { api } from "./api";

/** Lo que Presencia edita: el link corto y las redes. */
export interface DatosNegocio {
  slug?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  webUrl?: string | null;
  direccion?: string | null;
}

/**
 * Guarda los datos del negocio.
 *
 * TODAVÍA PEGA A `/carta/negocio` (2026-09-14). La ruta neutra `/negocio` ya
 * está escrita en el backend pero NO deployada: sale con el próximo tag, junto
 * con el trabajo de otro frente que aún no termina. Apuntar ahí antes de que
 * exista deja a Marketing sin poder guardar.
 *
 * Cuando el backend salga, esto pasa a `/negocio` y se borra este párrafo. El
 * resto de este archivo ya no depende de `lib/carta`, que era el punto: el día
 * que alguien limpie el módulo de restaurantes, acá no se rompe nada.
 *
 * El backend valida el slug con sus dos reglas propias: que no sea una ruta
 * reservada y que no lo tenga otro negocio. Por eso un 409 acá es "ese link ya
 * está tomado" y no un error de red.
 */
export async function guardarDatosNegocio(
  datos: DatosNegocio,
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api<{ ok: boolean }>("/carta/negocio", { method: "PATCH", body: datos, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}
