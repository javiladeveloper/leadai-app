"use client";

import Link from "next/link";
import type { EtiquetaVista } from "@/lib/crm-filtros";

/**
 * UNA ETIQUETA QUE LLEVA A LA LISTA FILTRADA (CRM fase 2, 2026-10-13).
 *
 * Las del vendedor van en teal suave; las que puso la IA (fase 3) llevan 🤖 y
 * un estilo más tenue, con borde punteado: se ven, pero se nota que nadie
 * del equipo las confirmó todavía.
 *
 * Con `href` es un link (a `/leads?etiqueta=…`); con `onElegir`, un botón
 * (filtrar la lista de la misma pantalla); sin ninguno, solo se muestra.
 */
export function ChipEtiqueta({
  nombre, ia = false, href, onElegir, activo = false, chico = false,
}: {
  nombre: string;
  ia?: boolean;
  href?: string;
  onElegir?: (nombre: string) => void;
  /** Es la que está filtrando la lista. */
  activo?: boolean;
  chico?: boolean;
}) {
  const tam = chico ? "px-1.5 py-px text-[0.66rem]" : "px-2 py-0.5 text-[0.72rem]";
  const estilo = activo
    ? "bg-brasa text-sobre-brasa"
    : ia
      ? "border border-dashed border-linea bg-carta text-tinta-2/80"
      : "bg-brasa/10 text-brasa-texto";
  const clases = `inline-flex min-h-0 max-w-[12rem] items-center gap-1 truncate rounded-chip font-bold ${tam} ${estilo}`;
  const titulo = `${ia ? "Etiqueta que puso la IA" : "Etiqueta"}: ${nombre}${href || onElegir ? " · ver todos los que la tienen" : ""}`;
  const contenido = (
    <>
      {ia && <span aria-hidden>🤖</span>}
      <span className="truncate">{nombre}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} title={titulo} onClick={(e) => e.stopPropagation()} className={`${clases} transition hover:ring-1 hover:ring-brasa/40`}>
        {contenido}
      </Link>
    );
  }
  if (onElegir) {
    return (
      <button
        type="button"
        title={titulo}
        aria-pressed={activo}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onElegir(nombre); }}
        className={`${clases} transition hover:ring-1 hover:ring-brasa/40`}
      >
        {contenido}
      </button>
    );
  }
  return <span title={titulo} className={clases}>{contenido}</span>;
}

/**
 * ¿El texto del campo llegó ELIGIENDO una opción del autocompletar (no
 * tecleando)? Así se aplica la etiqueta al elegirla sin esperar el Enter,
 * pero escribir "VIP" camino a "VIP Lima" no la agrega a medio escribir.
 */
export function vinoDeLaLista(e: React.ChangeEvent<HTMLInputElement>): boolean {
  const tipo = (e.nativeEvent as InputEvent).inputType;
  return !tipo || tipo === "insertReplacementText";
}

/** Varias etiquetas en fila: hasta `max` a la vista y "+N" con el resto. */
export function ListaEtiquetas({
  etiquetas, hrefDe, onElegir, activas = [], max = 4, chico = false,
}: {
  etiquetas: EtiquetaVista[];
  hrefDe?: (nombre: string) => string;
  onElegir?: (nombre: string) => void;
  activas?: string[];
  max?: number;
  chico?: boolean;
}) {
  if (etiquetas.length === 0) return null;
  const activasMin = new Set(activas.map((a) => a.toLowerCase()));
  const visibles = etiquetas.slice(0, max);
  const resto = etiquetas.length - visibles.length;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visibles.map((e) => (
        <ChipEtiqueta
          key={`${e.ia ? "ia" : "m"}:${e.nombre}`}
          nombre={e.nombre}
          ia={e.ia}
          chico={chico}
          activo={activasMin.has(e.nombre.toLowerCase())}
          href={hrefDe ? hrefDe(e.nombre) : undefined}
          onElegir={hrefDe ? undefined : onElegir}
        />
      ))}
      {resto > 0 && (
        <span className="text-[0.68rem] font-semibold text-frio" title={etiquetas.slice(max).map((e) => e.nombre).join(", ")}>
          +{resto}
        </span>
      )}
    </span>
  );
}
