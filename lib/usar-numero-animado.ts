"use client";

import { useEffect, useRef, useState } from "react";

/**
 * UN NÚMERO QUE SUBE EN VEZ DE SALTAR (2026-08-19).
 *
 * El total del carrito pasaba de S/25.50 a S/51.00 en un frame. Un salto no se
 * lee: el ojo ve "otro número" y no "creció". Contando, el cliente ve cuánto
 * subió sin tener que comparar contra lo que recuerda.
 *
 * Importa más de lo que parece en una carta: el total es el número que decide
 * si sigue agregando o toca enviar, y es el que mira antes de pagar.
 *
 * SOLO PARA MOSTRAR. El valor real es el que llega por props; esto es cómo se
 * dibuja mientras alcanza. Si el componente se desmonta a mitad del conteo, el
 * cliente ya se fue de esa pantalla y no importa.
 */
export function usarNumeroAnimado(valor: number, ms = 420): number {
  const [mostrado, setMostrado] = useState(valor);
  const anim = useRef<number | null>(null);

  useEffect(() => {
    // Sin movimiento: se salta al valor. Para alguien con sensibilidad
    // vestibular un número temblando es peor que un salto.
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setMostrado(valor);
      return;
    }

    const desde = mostrado;
    const delta = valor - desde;
    if (delta === 0) return;

    // Un salto GRANDE se anima; uno chico se aplica directo. Contar de 2550 a
    // 2600 es un temblor que distrae sin comunicar nada.
    if (Math.abs(delta) < 100) {
      setMostrado(valor);
      return;
    }

    const t0 = performance.now();
    if (anim.current) cancelAnimationFrame(anim.current);

    const paso = (ahora: number) => {
      const p = Math.min(1, (ahora - t0) / ms);
      // easeOutCubic: arranca rápido y frena. Un número que desacelera al
      // llegar se lee como que "aterrizó" en su valor final.
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrado(Math.round(desde + delta * suave));
      if (p < 1) anim.current = requestAnimationFrame(paso);
    };
    anim.current = requestAnimationFrame(paso);

    return () => { if (anim.current) cancelAnimationFrame(anim.current); };
    // `mostrado` a propósito fuera de las deps: incluirlo reiniciaría la
    // animación en cada frame y el número nunca llegaría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, ms]);

  return mostrado;
}
