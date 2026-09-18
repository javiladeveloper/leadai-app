import Link from "next/link";
import { puedeAbrirConversacion } from "@/lib/auth";
import type { Temperatura } from "@/lib/tipos";
import { haceTexto } from "@/lib/leads";
import { ChipTemp } from "./ChipTemp";
import { BadgeCanal } from "./BadgeCanal";

// Shape mínimo que la tarjeta necesita para renderizarse. Tanto el `Lead` de
// demo (lib/tipos, usado hoy en Conversaciones) como el `Lead` real del
// backend (lib/api, mapeado en la pantalla de Leads) cumplen esta forma —
// esta última con campos opcionales cubiertos vía adaptador en cada pantalla.
export interface TarjetaLeadProps {
  id: string;
  nombre: string;
  canal?: string;
  empresa?: string;
  temperatura: Temperatura;
  urgente?: boolean;
  resumenIA: string;
  ultimoMensaje?: string;
  haceMinutos?: number;
}

// Avatar con inicial, teñido por temperatura (lenguaje visual del Inicio).
const AVATAR_TEMP: Record<string, string> = {
  caliente: "bg-calor",
  tibio: "bg-tibio",
  frio: "bg-frio",
};

// Tarjeta de un lead en la bandeja. Muestra el resumen que arma la IA — la
// vendedora entiende de qué se trata sin abrir la conversación. Un toque entra.
export function TarjetaLead({ lead }: { lead: TarjetaLeadProps }) {
  const urgente = lead.urgente ?? false;
  const inicial = lead.nombre.trim().charAt(0).toUpperCase() || "?";

  /**
   * MARKETING VE LA LISTA PERO NO ABRE LA CONVERSACION (2026-09-18, pregunta
   * de Jonathan: "si el presiona alguno lo lleva a la conversacion o no pasa
   * nada con su rol").
   *
   * Pasaba lo peor de los dos mundos: la tarjeta se veia clickeable, navegaba,
   * y del otro lado el backend devolvia 403 -- una pantalla de error, sin
   * explicacion. El bloqueo es correcto (son consultas de pacientes), lo que
   * estaba mal era no decirlo.
   *
   * Sin link y con el motivo a la vista: se entiende que no es un error sino
   * un permiso que ese puesto no tiene.
   */
  const puedeAbrir = puedeAbrirConversacion();
  const clases = `block rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ${
    puedeAbrir ? "transition active:scale-[0.99]" : ""
  } ${urgente ? "ring-2 ring-calor/60" : "ring-1 ring-linea"}`;

  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[0.95rem] font-bold text-carta ${AVATAR_TEMP[lead.temperatura] ?? "bg-frio"}`}
          >
            {inicial}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-[1.05rem] font-bold text-tinta">{lead.nombre}</h3>
            <div className="mt-0.5 flex items-center gap-2">
              <BadgeCanal canal={lead.canal} tamano="chico" />
            </div>
          </div>
        </div>
        <ChipTemp t={lead.temperatura} />
      </div>

      {/* De qué negocio viene (bandeja unificada): línea propia a lo ancho de
          la tarjeta — compartía fila con el canal y se truncaba a "Fisiot…". */}
      {lead.empresa && (
        <p className="mt-1.5 truncate text-[0.78rem] font-semibold text-frio">🏢 {lead.empresa}</p>
      )}

      {/* Resumen de la IA — el corazón de la tarjeta */}
      <p className="mt-2.5 text-[0.95rem] leading-snug text-tinta-2">{lead.resumenIA}</p>

      {(lead.ultimoMensaje || lead.haceMinutos !== undefined) && (
        <div className="mt-3 flex items-center justify-between">
          <p className="truncate pr-3 text-[0.85rem] italic text-frio">
            {lead.ultimoMensaje ? `"${lead.ultimoMensaje}"` : ""}
          </p>
          {lead.haceMinutos !== undefined && (
            <span className="shrink-0 text-[0.75rem] font-semibold text-frio">
              {haceTexto(lead.haceMinutos)}
            </span>
          )}
        </div>
      )}
    </>
  );

  // Sin permiso NO se envuelve en <Link>: una tarjeta que navega a un 403 se
  // lee como que el producto esta roto, no como un permiso que no se tiene.
  if (!puedeAbrir) {
    return (
      <div className={clases}>
        {cuerpo}
        <p className="mt-3 border-t border-linea pt-2.5 text-[0.78rem] text-frio">
          Las conversaciones las atiende el equipo de ventas.
        </p>
      </div>
    );
  }

  return (
    <Link href={`/conversacion/${lead.id}`} className={clases}>
      {cuerpo}
    </Link>
  );
}
