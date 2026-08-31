"use client";

import { useCapacidadesOptimista } from "@/lib/modo-negocio";

/**
 * QUÉ HACE EL BOT, COMO LISTA CERRADA (2026-08-30).
 *
 * Planteado por Jonathan: "te pueden escribir que agende citas... eso el bot no
 * lo hace, al menos acá no, lo que hacemos es escalar con una persona... no es
 * buena idea dejar a su libre disposición todo esto".
 *
 * LA DISTINCIÓN QUE FALTABA. En el playbook conviven dos cosas que no son lo
 * mismo:
 *
 *   - Lo que el bot SABE (contexto): "vendemos departamentos en Miraflores",
 *     "atendemos de 9 a 6". Texto libre está bien: si se equivoca, dice un
 *     dato mal y se corrige en el próximo mensaje.
 *
 *   - Lo que el bot HACE (capacidades): agendar, cobrar, reservar, derivar.
 *     Esto NUNCA puede salir de un campo de texto: si se equivoca, le promete
 *     al cliente algo que no va a pasar. Un cliente al que le dijeron "listo,
 *     te agendé para el martes" se presenta el martes y no lo espera nadie.
 *
 * Por eso esto NO es un formulario: es una lista de lo que el sistema sabe
 * hacer, y no se edita. Las que todavía no existen se muestran APAGADAS con
 * qué hace en su lugar — hoy el dueño las escribe en el playbook, no funcionan,
 * y no entiende por qué. Verlas apagadas responde esa pregunta antes de que la
 * haga.
 *
 * La otra mitad de esta protección vive en el backend (`llm/prompt.ts`): una
 * regla que le prohíbe al modelo prometer esas acciones aunque el dueño las
 * escriba igual en su texto libre.
 */

interface Accion {
  titulo: string;
  detalle: string;
  /** Cuándo está activa. `true` = siempre; si no, la capacidad que la habilita. */
  activa: boolean;
  /** Qué hace el bot en su lugar mientras no exista. */
  enSuLugar?: string;
}

export function AccionesDelBot() {
  const caps = useCapacidadesOptimista();

  const acciones: Accion[] = [
    {
      titulo: "Responder preguntas",
      detalle: "Contesta con los datos de tu negocio, a cualquier hora",
      activa: true,
    },
    {
      titulo: "Calificar interesados",
      detalle: "Hace tus preguntas clave y detecta quién está listo para comprar",
      activa: caps.calificaLeads !== false,
    },
    {
      titulo: "Avisarte cuando alguien está listo",
      detalle: "Te llega una notificación con el resumen de la conversación",
      activa: true,
    },
    {
      titulo: "Pasar a una persona",
      detalle: 'Si el cliente lo pide o se traba, te lo deriva a ti',
      activa: true,
    },
    {
      titulo: "Hacer seguimiento solo",
      detalle: "Vuelve a escribirle al que no cerró, con el ritmo que elijas",
      activa: caps.nutreLeads !== false,
    },
    {
      titulo: "Tomar pedidos y cobrar",
      detalle: "Arma el pedido, cobra por Yape o Plin y lo manda a cocina",
      activa: caps.tieneCarta !== false,
      enSuLugar: "Disponible en negocios de comida",
    },
    {
      // LA QUE MOTIVÓ TODO ESTO. Alguien va a escribirlo en el playbook: mejor
      // que lo lea acá, apagado y con la verdad al lado.
      titulo: "Agendar citas en tu calendario",
      detalle: "Ver tu disponibilidad real y crear la reunión",
      activa: false,
      enSuLugar: "Todavía no. El bot toma el día y la hora que prefiere el cliente y te lo pasa a ti para que lo agendes.",
    },
    {
      titulo: "Cobrar con link de pago",
      detalle: "Generar un link de tarjeta y confirmar el pago solo",
      activa: false,
      enSuLugar: "Todavía no. Por ahora cobra por Yape o Plin con captura.",
    },
  ];

  return (
    <div className="space-y-2">
      {acciones.map((a) => (
        <div
          key={a.titulo}
          className={
            a.activa
              ? "flex gap-3 rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea"
              : "flex gap-3 rounded-tarjeta bg-arena/50 px-4 py-3"
          }
        >
          <span className={a.activa ? "text-ok" : "text-frio"} aria-hidden>
            {a.activa ? "✓" : "○"}
          </span>
          <div className="min-w-0">
            <p className={a.activa ? "text-sm font-bold text-tinta" : "text-sm font-bold text-frio"}>
              {a.titulo}
            </p>
            <p className="mt-0.5 text-[0.82rem] text-tinta-2">{a.detalle}</p>
            {!a.activa && a.enSuLugar && (
              <p className="mt-1 text-[0.8rem] font-medium text-calor">{a.enSuLugar}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
