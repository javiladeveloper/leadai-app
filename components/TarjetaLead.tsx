import { puedeAbrirConversacion } from "@/lib/auth";
import { LinkLead } from "./LinkLead";
import type { Temperatura } from "@/lib/tipos";
import { haceTexto } from "@/lib/leads";
import { ChipTemp } from "./ChipTemp";
import { BadgeCanal } from "./BadgeCanal";
import { ChipPlataforma } from "./panel/OrigenLead";
import type { Lead } from "@/lib/api";
import { solesDeCentavos } from "@/lib/dinero";

// Shape mínimo que la tarjeta necesita para renderizarse. Tanto el `Lead` de
// demo (lib/tipos, usado hoy en Conversaciones) como el `Lead` real del
// backend (lib/api, mapeado en la pantalla de Leads) cumplen esta forma —
// esta última con campos opcionales cubiertos vía adaptador en cada pantalla.
export interface TarjetaLeadProps {
  id: string;
  /**
   * El negocio del lead (2026-10-09). Con varios negocios, abrir la ficha
   * fija ese negocio; sin esto la ficha lo buscaba en la empresa activa.
   */
  tenant?: string;
  nombre: string;
  canal?: string;
  empresa?: string;
  temperatura: Temperatura;
  urgente?: boolean;
  resumenIA: string;
  ultimoMensaje?: string;
  haceMinutos?: number;
  /**
   * DE DÓNDE VINO Y CUÁNTO COSTÓ (2026-10-07, Jonathan: "en la sección leads
   * podrías colocar esos detalles, no solo el resumen"). Opcional: las
   * pantallas que no lo tienen siguen igual.
   */
  origen?: Lead["origen"];
  /** Cuándo entró, en texto ("5 oct"). */
  entro?: string;
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

      {lead.origen && <LineaOrigen origen={lead.origen} entro={lead.entro} />}

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

  // A la ficha única del lead (Conversaciones), con su negocio.
  return (
    <LinkLead id={lead.id} tenant={lead.tenant} className={clases}>
      {cuerpo}
    </LinkLead>
  );
}

// Un solo formato de dinero en la web (lib/dinero.ts, 2026-10-09).
const soles = solesDeCentavos;

/**
 * Una línea bajo el resumen: plataforma, anuncio, campaña y el costo repartido.
 * El costo lleva "aprox." porque es el gasto del anuncio dividido entre los
 * leads que trajo, no lo que costó esta persona.
 */
function LineaOrigen({ origen, entro }: { origen: NonNullable<Lead["origen"]>; entro?: string }) {
  return (
    <div className="mt-3 rounded-lg bg-arena/50 px-3 py-2 text-[0.78rem]">
      <p className="flex min-w-0 items-center gap-1.5">
        <ChipPlataforma plataforma={origen.plataforma} />
        <span className="truncate font-semibold text-tinta">{origen.etiqueta}</span>
        {origen.costoCentavos !== undefined && (
          <span className="ml-auto shrink-0 tabular-nums text-tinta-2">≈ {soles(origen.costoCentavos)}</span>
        )}
      </p>
      {(origen.campania || entro) && (
        <p className="mt-0.5 truncate text-frio">
          {[origen.campania && `Campaña: ${origen.campania}`, entro && `Entró el ${entro}`].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}
