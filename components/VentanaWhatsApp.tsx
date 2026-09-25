"use client";
import type { Ventana } from "@/lib/ventana-whatsapp";

/**
 * LA VENTANA DE WHATSAPP, A LA VISTA EN CADA CHAT (2026-09-25).
 *
 * Jonathan: "necesito ver en cada chat cuál es su ventana de tiempo". El chip
 * va en la cabecera: abierta o cerrada, cuánto le queda (24 h desde su último
 * mensaje) y cómo llegó (directo o por un anuncio). Se pone ámbar cuando
 * quedan menos de 3 horas: es el momento de escribirle si hay algo pendiente.
 */
export function ChipVentana({ ventana }: { ventana: Ventana }) {
  const porCerrar = ventana.abierta && ventana.quedan < 3;
  const clase = !ventana.abierta
    ? "bg-alerta-suave text-alerta-hondo ring-alerta/30"
    : porCerrar
      ? "bg-tibio-suave text-tibio ring-tibio/30"
      : "bg-ok/10 text-ok ring-ok/30";
  return (
    <span
      title={`Ventana de ${ventana.horas} h: ${ventana.origen}. WhatsApp solo entrega mensajes normales dentro de ella.`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-bold ring-1 ${clase}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ventana.abierta ? (porCerrar ? "bg-tibio" : "bg-ok") : "bg-alerta"}`} />
      {ventana.abierta ? "Ventana abierta" : "Ventana cerrada"} · {ventana.cuando}
      <span className="font-semibold opacity-80">({ventana.horas} h, {ventana.origen})</span>
    </span>
  );
}

/** Con la ventana cerrada: por qué no se puede escribir, arriba del cuadro de texto. */
export function AvisoVentanaCerrada({ ventana }: { ventana: Ventana }) {
  if (ventana.abierta) return null;
  return (
    <div className="border-t border-linea bg-tibio-suave/60 px-4 py-2.5">
      <p className="text-[0.84rem] font-semibold text-tinta">
        ⏳ La ventana de {ventana.horas} h {ventana.cuando === "nunca te escribió" ? "nunca se abrió: el cliente nunca te escribió" : ventana.cuando}.
      </p>
      <p className="mt-0.5 text-[0.78rem] text-tinta-2">
        WhatsApp no le va a entregar mensajes ni archivos. Cuando el cliente vuelva a escribirte, se abre de nuevo.
      </p>
    </div>
  );
}
