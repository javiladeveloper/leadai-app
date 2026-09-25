"use client";
import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { cercaDelFinal } from "@/lib/chat-tramos";

/**
 * EL CHAT ABRE EN EL ÚLTIMO MENSAJE (2026-09-25).
 *
 * Antes la conversación abría arriba, en el mensaje más viejo, y había que
 * bajarla entera para ver lo que acababa de escribir el cliente.
 *
 * - Al abrir otra conversación (`clave`), baja al final.
 * - Si llega un mensaje nuevo, baja solo si ya estabas abajo: si subiste a
 *   leer algo viejo, no te arranca de donde estabas. "Estar abajo" se mide
 *   al desplazarte, ANTES de que llegue el mensaje: medirlo después fallaría
 *   con un mensaje largo, que por sí solo te aleja del final.
 * - "Ver mensajes anteriores" agrega arriba y no mueve nada (el último
 *   mensaje no cambia).
 *
 * `contenedor` es la caja que se desplaza; sin ella, la página entera (la
 * vista del celular).
 */
export function useChatAlFinal(
  clave: string | null,
  ultimoId: string | undefined,
  finRef: RefObject<HTMLElement | null>,
  contenedor?: RefObject<HTMLElement | null>,
) {
  const visto = useRef<{ clave: string | null; ultimoId?: string }>({ clave: null });
  const abajo = useRef(true);
  // La caja del chat aparece recién cuando llega la conversación: el oyente se
  // engancha de nuevo en ese momento, no solo al cambiar de chat.
  const hayChat = Boolean(ultimoId);

  useEffect(() => {
    const caja = contenedor?.current ?? null;
    const medir = () => {
      const el = caja ?? document.scrollingElement;
      if (el) abajo.current = cercaDelFinal(el as HTMLElement);
    };
    const destino: HTMLElement | Window = caja ?? window;
    destino.addEventListener("scroll", medir, { passive: true });
    return () => destino.removeEventListener("scroll", medir);
  }, [contenedor, clave, hayChat]);

  useLayoutEffect(() => {
    if (!clave || !ultimoId) return;
    const antes = visto.current;
    const bajar = antes.clave !== clave || (antes.ultimoId !== ultimoId && abajo.current);
    visto.current = { clave, ultimoId };
    if (bajar) {
      finRef.current?.scrollIntoView({ block: "end" });
      abajo.current = true;
    }
    // Solo al cambiar de chat o de último mensaje: un re-render por otra razón
    // (sondeo sin novedades, escribir) no mueve la vista.
  }, [clave, ultimoId, finRef]);
}
