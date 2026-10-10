"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

// "VOLVER" RESPETA DE DÓNDE VIENES (2026-10-09).
//
// La ficha del lead tenía un "Volver" que iba SIEMPRE a /leads: entrabas desde
// la Agenda o desde Reportes y volver te tiraba a otra sección. El navegador sí
// sabe de dónde viniste, pero `history.length` no distingue si la entrada
// anterior es del panel o de otro sitio (un link de WhatsApp abre el chat en
// una pestaña nueva, y "atrás" ahí sale de la app).
//
// Por eso el panel lleva su propia cuenta de rutas visitadas EN ESTA PESTAÑA:
// si hay una anterior del panel, `router.back()`; si no, el destino de
// respaldo. Vive en memoria: un F5 la reinicia, y entonces se usa el respaldo,
// que es lo correcto (no se sabe de dónde se vino).

const visitadas: string[] = [];

/** La llama el layout del panel cada vez que cambia la ruta. */
export function registrarRuta(ruta: string): void {
  if (visitadas[visitadas.length - 1] === ruta) return;
  visitadas.push(ruta);
  if (visitadas.length > 50) visitadas.shift();
}

/**
 * La ruta del panel anterior a `actual` (sin querystring), o `null` si se
 * entró directo. Sirve antes y después de que el layout registre la actual:
 * los efectos del hijo corren ANTES que los del layout, así que al montar una
 * pantalla la última registrada todavía es la anterior.
 */
export function rutaPrevia(actual: string): string | null {
  const n = visitadas.length;
  if (n === 0) return null;
  if (visitadas[n - 1] !== actual) return visitadas[n - 1];
  return n > 1 ? visitadas[n - 2] : null;
}

/** Nombre corto de una sección, para "← Volver a Agenda". */
export function nombreDeRuta(ruta: string | null): string | null {
  if (!ruta) return null;
  const NOMBRES: Record<string, string> = {
    "/inicio": "Inicio", "/leads": "Leads", "/global": "Leads", "/seguimiento": "Seguimiento",
    "/agenda": "Agenda", "/reportes": "Reportes", "/marketing": "Marketing", "/comentarios": "Comentarios",
    "/equipo": "Equipo", "/oportunidades": "Oportunidades",
  };
  return NOMBRES[ruta] ?? null;
}

/**
 * `volver()`: a la pantalla anterior del panel si la hay; si se entró directo
 * (link de WhatsApp, F5, pestaña nueva), a `respaldo`.
 */
export function useVolver(respaldo: string): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (rutaPrevia(window.location.pathname)) router.back();
    else router.replace(respaldo);
  }, [router, respaldo]);
}
