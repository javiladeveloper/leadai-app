"use client";

import { useEffect, useState } from "react";

/**
 * ¿PANTALLA DE ESCRITORIO? (2026-10-09). Conversaciones dibuja DOS pantallas
 * distintas según el ancho: en escritorio la bandeja, el chat y la ficha lado
 * a lado; en el celular la lista O el chat a pantalla completa. No alcanza con
 * esconder por CSS: el chat tiene refs (scroll, campo de texto) que no pueden
 * existir dos veces, y en el celular no hay que abrir el primer chat solo.
 *
 * Mismo corte que Tailwind `lg` (1024 px). El panel no se pinta en el
 * servidor (el layout espera la sesión), así que leer `matchMedia` al iniciar
 * no rompe la hidratación.
 */
export function useEsEscritorio(): boolean {
  const [es, setEs] = useState<boolean>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)").matches
      : true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const medio = window.matchMedia("(min-width: 1024px)");
    const actualizar = () => setEs(medio.matches);
    actualizar();
    medio.addEventListener("change", actualizar);
    return () => medio.removeEventListener("change", actualizar);
  }, []);
  return es;
}
