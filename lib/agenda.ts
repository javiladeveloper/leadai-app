// Helpers PUROS de "Mi calendario" y "Agenda" (2026-09-26). Sin imports del
// panel: los tests los corren con `--experimental-strip-types`.

/** Las citas de "Agenda" agrupadas por día (en hora de Lima), cada día ordenado por hora. */
export function agruparPorDia<T extends { inicio: string }>(citas: T[]): { dia: string; citas: T[] }[] {
  // Lima es UTC-5 todo el año (sin horario de verano).
  const lima = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString();
  const orden = [...citas].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const salida: { dia: string; citas: T[] }[] = [];
  for (const c of orden) {
    const dia = lima(c.inicio).slice(0, 10);
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.citas.push(c);
    else salida.push({ dia, citas: [c] });
  }
  return salida;
}

/**
 * Qué decirle a la persona cuando falla `POST /calendario/google/confirmar`.
 *
 * 404: el pendiente venció (o ya se usó). 403: lo inició OTRA cuenta de
 * LeadAI —pasa cuando se loguea con una cuenta distinta a la que tocó
 * "Conectar"—. Cualquier otro error: el mensaje del backend.
 */
export function avisoConfirmacionCalendario(status: number, mensaje?: string): string {
  // 401: el token guardado venció (el panel no lo detecta hasta que llama).
  if (status === 401) return "Tu sesión venció. Vuelve a entrar y conecta tu calendario de nuevo.";
  if (status === 404) return "La conexión venció. Vuelve a conectar tu calendario.";
  if (status === 403) {
    return "Esta conexión la inició otra cuenta de LeadAI. Entra con la cuenta correcta y vuelve a conectar.";
  }
  return mensaje || "No se pudo conectar tu calendario. Inténtalo de nuevo.";
}

/**
 * A dónde volver tras el login si se llegó SIN sesión desde Google.
 *
 * Google devuelve a `/configuracion?tab=calendario&pendiente=<id>` y el
 * pendiente solo se confirma con la sesión puesta. Si la sesión venció en el
 * medio, el guard del panel manda al login; esto arma la URL que el login
 * retoma (patrón `volver_a` de sessionStorage, ver `destinoTrasEntrar`).
 * Cualquier otra ruta devuelve null: el login decide como siempre.
 */
export function volverTrasLoginCalendario(pathname: string, search: string): string | null {
  if (pathname !== "/configuracion") return null;
  const pendiente = new URLSearchParams(search).get("pendiente");
  if (!pendiente) return null;
  return `/configuracion?${new URLSearchParams({ tab: "calendario", pendiente })}`;
}

/**
 * El inicio del día de HOY en Lima (00:00 -05:00), sea cual sea la zona del
 * navegador: la agenda se lee en hora de Lima, así que "hoy" también.
 */
export function inicioDelDiaLima(ahora: Date = new Date()): Date {
  const lima = new Date(ahora.getTime() - 5 * 3_600_000);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()) + 5 * 3_600_000);
}
