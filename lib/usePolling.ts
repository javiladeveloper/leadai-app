"use client";
import { useEffect, useRef } from "react";

// Ejecuta `fn` cada `ms` mientras el componente está montado. Limpia al desmontar.
export function usePolling(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
