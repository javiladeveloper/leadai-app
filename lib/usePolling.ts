"use client";
import { useEffect, useRef } from "react";

/**
 * Ejecuta `fn` cada `ms` mientras el componente está montado. Limpia al desmontar.
 *
 * CON LA PESTAÑA ESCONDIDA NO CONSULTA (2026-09-25): el panel queda abierto
 * todo el día en otra pestaña y seguía pidiendo la bandeja cada 4 s sin que
 * nadie la mirara. Al volver a la pestaña se actualiza en el acto.
 */
export function usePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      ref.current();
    }, ms);
    const alVolver = () => { if (!document.hidden) ref.current(); };
    document.addEventListener("visibilitychange", alVolver);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", alVolver); };
  }, [ms]);
}
