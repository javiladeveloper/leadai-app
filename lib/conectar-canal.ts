/**
 * CÓMO SE ABRE EL FLUJO DE CONEXIÓN DE UNA RED (2026-09-09).
 *
 * EL CASO REAL: WhatsApp costó dos noches y varios reintentos porque en el
 * celular el popup no sobrevive — Android lo abre como pestaña suelta o lo
 * mata al saltar de app, y el `code` de la red muere con esa página. Se
 * resolvió navegando en la MISMA pestaña (ver `ConectarWhatsApp`).
 *
 * Instagram, Messenger y TikTok tenían el mismo pozo abierto: los tres
 * abrían con `window.open`, esperando al primero que intentara conectarlos
 * desde un teléfono. Jonathan lo vio venir: "esto debe ser para todas las
 * conexiones con canales".
 *
 * La decisión vive acá —una función pura, con tests— y no dentro de un
 * componente, porque la comparten el panel de canales y cualquier pantalla
 * futura que conecte una red.
 */

/**
 * ¿Estamos en un teléfono, donde el popup no es confiable?
 *
 * Sin `userAgent` se responde `false` a propósito: el popup es el camino
 * probado y con `postMessage` de vuelta; ante la duda no se degrada.
 */
export function esCelular(userAgent?: string | null): boolean {
  if (!userAgent) return false;
  return /android|iphone|ipad|ipod/i.test(userAgent);
}

/** Cómo abrir el flujo: navegando la pestaña actual, o en un popup. */
export type ModoApertura = "redireccion" | "popup";

/**
 * En el celular, redirección: no hay página que el sistema pueda matar
 * mientras la red hace lo suyo. En escritorio, popup: tiene `window.opener`,
 * así que el callback avisa por `postMessage` y la lista de canales se
 * refresca sola sin recargar.
 */
export function comoAbrirConexion(enCelular: boolean): ModoApertura {
  return enCelular ? "redireccion" : "popup";
}
