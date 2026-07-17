import Link from "next/link";
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
  return (
    <Link
      href={`/conversacion/${lead.id}`}
      className={`block rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] transition active:scale-[0.99] ${
        urgente ? "ring-2 ring-calor/60" : "ring-1 ring-linea"
      }`}
    >
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
              {lead.empresa && <p className="truncate text-[0.8rem] text-frio">{lead.empresa}</p>}
            </div>
          </div>
        </div>
        <ChipTemp t={lead.temperatura} />
      </div>

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
    </Link>
  );
}
