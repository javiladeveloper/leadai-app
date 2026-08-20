"use client";

import { useState } from "react";

/**
 * LO QUE EL BOT RESPONDE SOLO (2026-08-20).
 *
 * Nace de un pedido de Jonathan mirando la pantalla equivalente de ola.click:
 * un catálogo de "mensajes automáticos" abajo de la vinculación de WhatsApp,
 * para que el dueño ENTIENDA qué compró.
 *
 * El problema real que resuelve: alguien conecta su WhatsApp y no tiene idea
 * de qué va a pasar después. No sabe si el bot va a contestar de noche, si
 * avisa cuando el pedido sale, si el cliente puede preguntar por las promos.
 * Sin eso, o desconfía y contesta él a mano —perdiendo justo lo que paga— o
 * descubre los mensajes de a uno, por el reclamo de un cliente.
 *
 * DIFERENCIA CLAVE con la pantalla de ola.click: allá los mensajes se
 * CONFIGURAN uno por uno (plantillas con {client.name} que el dueño edita).
 * Acá no: son textos que el bot ya sabe decir, armados con los datos reales
 * del negocio. Esta pantalla es para ENTENDER, no para editar. Cuando exista
 * la edición (los ~60 textos hardcodeados de `pedidos-conversacion.ts`) esta
 * lista es su lugar natural.
 *
 * Cada texto de acá está copiado del que manda el bot de verdad
 * (`pedidos-conversacion.ts` y `pedidos.ts`). Si divergen, esta pantalla
 * miente sobre el producto — que es peor que no tenerla.
 */

interface Mensaje {
  id: string;
  titulo: string;
  /** Qué lo dispara, en una línea. */
  cuando: string;
  /** Lo que escribe el cliente, si el mensaje es una respuesta. */
  entrada?: string;
  /** El texto REAL que manda el bot. */
  texto: string;
  /** Todavía no existe: se muestra apagado y no se promete como activo. */
  pronto?: boolean;
}

const GRUPOS: { grupo: string; bajada: string; mensajes: Mensaje[] }[] = [
  {
    grupo: "Cuando te escriben",
    bajada: "El bot contesta al toque, con tu carta y tus datos.",
    mensajes: [
      {
        id: "bienvenida",
        titulo: "Le mandas tu carta",
        cuando: "Alguien saluda o pide la carta",
        entrada: "Hola, buenas",
        texto:
          "¡Buenísimo! 😋\n\nAcá está nuestra carta, con fotos y precios:\nlink de tu carta\n\nElige tranquilo y confirma: tu pedido llega solito a este chat 👍",
      },
      {
        id: "promos",
        titulo: "Le cuentas las promos de hoy",
        cuando: "Junto con la carta, si hay alguna corriendo",
        entrada: "¿Tienen alguna promo?",
        texto:
          "🎉 *Hoy tenemos:*\n• *3x2 en tablas* — Llevando 3 pagas 2\n• *Happy hour* — 15% de descuento _(hasta las 20:00)_",
      },
      {
        id: "cerrado",
        titulo: "Avisas que está cerrado",
        cuando: "Te escriben fuera de tu horario",
        entrada: "¿Están abiertos?",
        texto: "¡Hola! 👋 Hoy abrimos a las 17:00. Escríbeme a esa hora y te tomo el pedido 🙌",
      },
      {
        id: "demanda",
        titulo: "Avisas que hay demora",
        cuando: "La cocina está llena y el tiempo se estira",
        texto:
          "🔥 Ojo: hoy estamos con alta demanda — los pedidos están saliendo en 50-60 min.",
      },
    ],
  },
  {
    grupo: "Mientras arma el pedido",
    bajada: "El bot lo toma completo, sin que toques el teléfono.",
    mensajes: [
      {
        id: "resumen",
        titulo: "Le repites su pedido",
        cuando: "Confirma en la carta web o te lo escribe por chat",
        texto:
          "¡Recibí tu pedido! 🙌\n\n• 2x Acevichado\n• 1x California\n\n_3x2 en tablas: −S/27.00_\n\n*Total: S/54.00*",
      },
      {
        id: "pago",
        titulo: "Le pides el pago",
        cuando: "El pedido queda listo para cobrar",
        texto:
          "Tu pedido está listo para pagar 🙌 Total *S/54.00*. Yapea al 940202780 (Maria Lopez) y mándame la captura.",
      },
      {
        id: "captura",
        titulo: "Confirmas su pago",
        cuando: "Manda la captura de Yape o Plin",
        texto: "¡Pago confirmado! 🎉 Tu pedido ya entró a cocina. Te aviso cuando esté listo 🙌",
      },
      {
        id: "duda",
        titulo: "Le respondes una duda",
        cuando: "Pregunta algo de la carta o de su pedido",
        entrada: "¿El acevichado lleva palta?",
        texto: "Sí, el Acevichado lleva palta y langostinos fritos al panko 🙌 ¿Te lo agrego?",
      },
    ],
  },
  {
    grupo: "Cómo va su pedido",
    bajada: "Cada vez que lo mueves en Cocina, el cliente se entera solo.",
    mensajes: [
      {
        id: "preparando",
        titulo: "Entró a cocina",
        cuando: "Tocas “Empezar a preparar”",
        texto: "¡Confirmado! 👨‍🍳 Tu pedido ya se está preparando.",
      },
      {
        id: "listo",
        titulo: "Está listo",
        cuando: "Tocas “Marcar listo” en un pedido de recojo",
        texto: "¡Tu pedido está listo para recoger! 🥡",
      },
      {
        id: "camino",
        titulo: "Salió el reparto",
        cuando: "El motorizado acepta el pedido",
        texto:
          "¡Tu pedido va en camino! 🛵 Lo lleva *Carlos*.\nSíguelo acá: link del mapa",
      },
      {
        id: "entregado",
        titulo: "Llegó",
        cuando: "Tocas “Entregado”",
        texto: "¡Que lo disfrutes! 😋 Cualquier cosa escríbeme por acá. ¡Gracias por tu pedido! 🙌",
      },
      {
        id: "cancelado",
        titulo: "Se canceló",
        cuando: "Cancelas el pedido desde el panel",
        texto: "Tu pedido fue cancelado 🙏 Escríbenos si fue un error.",
      },
    ],
  },
  {
    grupo: "Para que vuelva",
    bajada: "Lo que trae de nuevo al que ya te compró.",
    mensajes: [
      {
        id: "recompra",
        titulo: "Lo invitas a volver",
        cuando: "Pasaron los días que elegiste desde su último pedido",
        texto:
          "¡Hola! 👋 Hace rato no te vemos por SHIRO 😄\nHoy tenemos 3x2 en tablas.\n¿Te preparo algo?",
      },
      {
        id: "resena",
        titulo: "Le pides una reseña",
        cuando: "Un rato después de entregar el pedido",
        texto:
          "¡Gracias por tu pedido! 🙌 ¿Nos ayudas con una reseña? Toma 10 segundos y nos ayuda un montón ⭐",
        pronto: true,
      },
      {
        id: "carrito",
        titulo: "Le recuerdas el carrito",
        cuando: "Armó su pedido en la carta y no lo confirmó",
        texto:
          "¡Hola! 👋 Dejaste tu pedido a medio camino 🍽️\n¿Lo completamos? Está tal cual lo dejaste 🛒",
        pronto: true,
      },
    ],
  },
];

export function QueRespondeElBot() {
  // Abierto el primer grupo: la pantalla tiene que decir algo de entrada, pero
  // los cuatro abiertos serían una pared de quince burbujas.
  const [abierto, setAbierto] = useState<string | null>(GRUPOS[0].grupo);

  const activos = GRUPOS.flatMap((g) => g.mensajes).filter((m) => !m.pronto).length;

  return (
    <div className="space-y-3">
      <p className="text-[0.88rem] leading-snug text-arena/70">
        Tu bot ya sabe decir <b className="text-arena">{activos} mensajes</b> solo, con los datos
        de tu negocio. No hay nada que configurar: se arman con tu carta, tu horario y tus promos.
      </p>

      <div className="space-y-2">
        {GRUPOS.map((g, i) => {
          const abiertoEste = abierto === g.grupo;
          return (
            <section
              key={g.grupo}
              style={{ animationDelay: `${i * 50}ms` }}
              className="surge overflow-hidden rounded-tarjeta bg-arena/5 ring-1 ring-arena/10"
            >
              <button
                onClick={() => setAbierto(abiertoEste ? null : g.grupo)}
                aria-expanded={abiertoEste}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-arena/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[0.92rem] font-bold text-arena">{g.grupo}</p>
                  <p className="text-[0.78rem] leading-snug text-arena/50">{g.bajada}</p>
                </div>
                <span className="shrink-0 rounded-chip bg-arena/10 px-2 py-0.5 text-[0.7rem] font-bold tabular-nums text-arena/70">
                  {g.mensajes.length}
                </span>
                {/* La flecha gira: dice si se abre o se cierra sin leer nada. */}
                <span
                  className={`shrink-0 text-arena/40 transition-transform ${abiertoEste ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>

              {abiertoEste && (
                <div className="grid gap-2.5 px-4 pb-4 sm:grid-cols-2">
                  {g.mensajes.map((m, j) => (
                    <Burbuja key={m.id} mensaje={m} orden={j} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Un mensaje, dibujado como el chat que el cliente va a ver.
 *
 * La burbuja de WhatsApp y no una lista de textos: el dueño reconoce esa forma
 * al instante y entiende que es lo que le va a llegar a SU cliente. Es la
 * misma razón por la que ola.click dibuja un teléfono entero.
 */
/**
 * El *negrita* y el _cursiva_ de WhatsApp, dibujados.
 *
 * Sin esto la burbuja mostraba los asteriscos crudos —"*Hoy tenemos:*"— que es
 * exactamente lo que el cliente NO va a ver. La pantalla existe para que el
 * dueño vea lo que le llega a su cliente; mostrarle el markup la vuelve una
 * mentira sobre el producto.
 */
function conFormatoWhatsApp(texto: string): React.ReactNode[] {
  // Se parte por los delimitadores conservándolos, y cada trozo se decide por
  // su primer carácter. Alcanza para *negrita* y _cursiva_, que es todo lo que
  // usan los textos del bot.
  return texto.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((trozo, i) => {
    if (trozo.startsWith("*") && trozo.endsWith("*") && trozo.length > 2) {
      return <b key={i}>{trozo.slice(1, -1)}</b>;
    }
    if (trozo.startsWith("_") && trozo.endsWith("_") && trozo.length > 2) {
      return <i key={i} className="text-frio">{trozo.slice(1, -1)}</i>;
    }
    return <span key={i}>{trozo}</span>;
  });
}

function Burbuja({ mensaje, orden }: { mensaje: Mensaje; orden: number }) {
  return (
    <article
      style={{ animationDelay: `${orden * 45}ms` }}
      className={`fila-entra rounded-tarjeta bg-carta p-3 ring-1 ring-linea ${
        mensaje.pronto ? "opacity-65" : ""
      }`}
    >
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.85rem] font-bold leading-tight text-tinta">{mensaje.titulo}</p>
          <p className="text-[0.72rem] leading-snug text-frio">{mensaje.cuando}</p>
        </div>
        {mensaje.pronto && (
          <span className="shrink-0 rounded-chip bg-arena px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-frio">
            Pronto
          </span>
        )}
      </div>

      {/* El chat. Se lee como lo que es —una conversación, no un formulario— y
          por eso el mensaje del cliente va a la derecha y el del bot a la
          izquierda, como en WhatsApp. */}
      <div className="space-y-1.5 rounded-lg bg-arena/60 p-2.5">
        {mensaje.entrada && (
          <p className="ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm bg-ok/15 px-2.5 py-1.5 text-[0.78rem] leading-snug text-tinta">
            {mensaje.entrada}
          </p>
        )}
        {/* `whitespace-pre-line`: los saltos son parte del mensaje —el bot manda
            párrafos, no un renglón— y HTML los colapsa. */}
        <p className="w-fit max-w-[92%] whitespace-pre-line rounded-lg rounded-bl-sm bg-carta px-2.5 py-1.5 text-[0.78rem] leading-snug text-tinta shadow-[var(--sombra-tarjeta)]">
          {conFormatoWhatsApp(mensaje.texto)}
        </p>
      </div>
    </article>
  );
}

export default QueRespondeElBot;
