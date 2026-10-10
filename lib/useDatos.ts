"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cacheFresca, escucharClave, leerCache, pedir } from "./cache-datos";

/**
 * LO YA SABIDO AL INSTANTE, LO NUEVO POR DETRÁS (2026-10-09).
 *
 * Una pantalla que vuelve a abrirse pinta lo último que se supo de esta clave
 * (sin esqueleto) y al mismo tiempo pregunta de nuevo; cuando llega, se
 * reemplaza solo. Si dos componentes piden la misma clave a la vez, sale una
 * sola petición (ver lib/cache-datos.ts).
 *
 * `clave` en `null` = todavía no se sabe qué pedir (falta el negocio, la
 * sesión…): no pide nada.
 *
 * `maxEdadMs`: si lo guardado es más nuevo que esto, ni siquiera revalida. Para
 * datos que casi no cambian (capacidades, canales) evita repetir la consulta
 * en cada pantalla de la misma visita.
 */
export function useDatos<T>(
  clave: string | null,
  cargador: () => Promise<T>,
  opciones: { maxEdadMs?: number } = {},
): { datos: T | undefined; error: unknown; cargando: boolean; recargar: () => Promise<void> } {
  const { maxEdadMs = 0 } = opciones;
  const cargadorRef = useRef(cargador);
  cargadorRef.current = cargador;
  const [datos, setDatos] = useState<T | undefined>(() => (clave ? leerCache<T>(clave) : undefined));
  const [error, setError] = useState<unknown>(null);
  const [cargando, setCargando] = useState<boolean>(() => !!clave && leerCache<T>(clave) === undefined);

  const revalidar = useCallback(async (forzar: boolean) => {
    if (!clave) return;
    try {
      const v = await pedir<T>(clave, () => cargadorRef.current(), { maxEdadMs: forzar ? 0 : maxEdadMs });
      setDatos(v);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }, [clave, maxEdadMs]);

  useEffect(() => {
    if (!clave) { setDatos(undefined); setCargando(false); return; }
    // Cambió la clave (otro negocio, otro filtro): lo guardado de ESA clave, o nada.
    const guardado = leerCache<T>(clave);
    setDatos(guardado);
    setError(null);
    setCargando(guardado === undefined);
    void revalidar(false);
    // Si otra pantalla trae una versión más nueva (o la invalida), se repinta acá.
    return escucharClave(clave, () => {
      const v = leerCache<T>(clave);
      if (v !== undefined) setDatos(v);
      // Solo si la INVALIDARON (en = 0): una respuesta recién llegada también
      // avisa, y revalidar ahí sería pedir dos veces lo mismo.
      if (!cacheFresca(clave, Number.POSITIVE_INFINITY)) void revalidar(true);
    });
  }, [clave, maxEdadMs, revalidar]);

  const recargar = useCallback(() => revalidar(true), [revalidar]);
  return { datos, error, cargando, recargar };
}
