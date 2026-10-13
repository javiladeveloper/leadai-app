"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { claveEtiquetas, listarEtiquetas, type EtiquetaUso, type Lead } from "./api";
import { escribirFiltrosCrm, etiquetasDeLista, leerFiltrosCrm, type FiltrosCrm } from "./crm-filtros";
import { useDatos } from "./useDatos";

/**
 * LOS FILTROS DEL CRM, CON LA URL COMO ÚNICA FUENTE DE VERDAD (fase 2,
 * 2026-10-13).
 *
 * Los filtros SON la URL: no hay una copia en el estado que se pueda
 * desincronizar. Cambiarlos reescribe la URL (sin llenar el historial y sin
 * tocar los demás parámetros: `lead`, `negocio`, `nivel`…); si cambia desde
 * afuera —un chip de etiqueta, el buscador del header, el "atrás"— la
 * pantalla la sigue sola.
 */
export function useFiltrosCrm(ruta: string): {
  filtros: FiltrosCrm;
  cambiar: (cambios: Partial<FiltrosCrm>) => void;
  limpiar: () => void;
} {
  const router = useRouter();
  const params = useSearchParams();
  const desdeUrl = params.toString();
  const filtros = useMemo(() => leerFiltrosCrm(new URLSearchParams(desdeUrl)), [desdeUrl]);

  const escribir = useCallback((armar: (actuales: FiltrosCrm) => FiltrosCrm) => {
    // Se parte de la URL de AHORA (no de la del último render): dos cambios
    // seguidos se suman en vez de pisarse.
    const base = new URLSearchParams(window.location.search);
    const qs = escribirFiltrosCrm(armar(leerFiltrosCrm(base)), base);
    qs.delete("nuevo");
    const s = qs.toString();
    router.replace(`${ruta}${s ? `?${s}` : ""}`, { scroll: false });
  }, [router, ruta]);

  const cambiar = useCallback((cambios: Partial<FiltrosCrm>) => {
    escribir((actuales) => ({ ...actuales, ...cambios }));
  }, [escribir]);

  const limpiar = useCallback(() => {
    escribir((actuales) => ({ q: "", etiquetas: [], asignado: "", sinRespuesta: false, origen: "", fecha: "", orden: actuales.orden }));
  }, [escribir]);

  return { filtros, cambiar, limpiar };
}

/**
 * EL CUADRO DE BÚSQUEDA: lo escrito se ve y filtra al instante lo que hay en
 * pantalla, y recién cuando se deja de escribir (400 ms) va a la URL y al
 * servidor (una consulta por búsqueda, no por letra). Si la URL trae otra
 * búsqueda desde afuera (el buscador del header), el cuadro la muestra; la
 * que escribimos nosotros no pisa lo que se siguió tecleando.
 */
export function useBusquedaCrm(qUrl: string, escribirQ: (q: string) => void, ms = 400): [string, (t: string) => void] {
  const [texto, setTexto] = useState(qUrl);
  // La última que mandamos nosotros a la URL, y la última URL vista.
  const [escrita, setEscrita] = useState(qUrl);
  const [qVista, setQVista] = useState(qUrl);
  const escritaRef = useRef(qUrl);
  const escribirRef = useRef(escribirQ);
  useEffect(() => { escribirRef.current = escribirQ; });

  // La URL cambió: si no fue por lo que escribimos, el cuadro la sigue.
  if (qUrl !== qVista) {
    setQVista(qUrl);
    if (qUrl !== escrita) setTexto(qUrl);
  }

  useEffect(() => {
    const t = window.setTimeout(() => {
      const v = texto.trim();
      if (v === escritaRef.current) return;
      escritaRef.current = v;
      setEscrita(v);
      escribirRef.current(v);
    }, ms);
    return () => window.clearTimeout(t);
  }, [texto, ms]);

  return [texto, setTexto];
}

/**
 * Las etiquetas para autocompletar y filtrar: las del servidor (`GET
 * /etiquetas`, manuales y de la IA) y, si todavía no la tiene, las que
 * aparecen en la lista ya bajada.
 */
export function useEtiquetasDisponibles(tenantId: string | null | undefined, leads: Lead[] = []): EtiquetaUso[] {
  const { datos } = useDatos(claveEtiquetas(tenantId), () => listarEtiquetas(tenantId), { maxEdadMs: 60_000 });
  const deLista = useMemo(() => (datos ? [] : etiquetasDeLista(leads)), [datos, leads]);
  return datos ?? deLista;
}
