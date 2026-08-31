/**
 * CHIPS PARA LOS CAMPOS DE TEXTO LIBRE (2026-08-30).
 *
 * Jonathan: "podríamos crear algunos chips más para ayudar a las personas a
 * ser más claras... no son personas técnicas... mientras menos configuraciones
 * libres queden, trabajará mejor el bot".
 *
 * POR QUÉ CHIPS Y NO UNA LISTA CERRADA. Estos tres campos describen el
 * NEGOCIO, no lo que el bot hace. Una lista cerrada de "por qué elegirte"
 * obligaría a que todos los negocios del Perú se describan con las mismas
 * cinco frases, y ahí se pierde justo lo que vende: "somos los únicos con
 * horno de barro en Tacna" no entra en ninguna opción prearmada.
 *
 * Las ACCIONES sí son lista cerrada (`AccionesDelBot`): el bot puede o no
 * puede, no hay grises. Estos campos son otra cosa.
 *
 * Los chips no van por rubro exacto sino por CÓMO VENDE el negocio: un
 * contador y un abogado cierran igual (agendar una consulta), aunque sus
 * rubros no se parezcan. Diecisiete listas por rubro serían diecisiete
 * lugares donde equivocarse.
 */

/** Cómo cierra la venta este negocio. Se deduce de sus capacidades. */
export type FormaDeVender = "pedidos" | "servicios";

export interface ChipsDeCampo {
  propuestaValor: string[];
  politicas: string[];
  llamadaAccion: string[];
}

/**
 * NINGUNO PROMETE UNA ACCIÓN QUE EL BOT NO PUEDE HACER.
 *
 * El placeholder viejo de "qué quieres que hagan" decía "Ej: Que agenden una
 * llamada" — o sea que nosotros mismos sugeríamos la acción imposible que
 * después el bot no cumplía. Acá todos son cosas que el CLIENTE hace, no que
 * el bot ejecute.
 */
const CHIPS: Record<FormaDeVender, ChipsDeCampo> = {
  pedidos: {
    propuestaValor: [
      "Preparado al momento",
      "Entrega en 30 minutos",
      "Recetas de la casa",
      "Ingredientes frescos del día",
      "Porciones abundantes",
    ],
    politicas: [
      "Mínimo S/20 para delivery",
      "Cobramos por Yape o Plin antes de enviar",
      "También se paga al recibir",
      "El delivery tiene costo según la zona",
      "Los pedidos grandes se piden con un día de anticipación",
    ],
    llamadaAccion: [
      "Que hagan su pedido por aquí",
      "Que miren la carta y elijan",
      "Que reserven una mesa",
      "Que pregunten por las promos del día",
    ],
  },
  servicios: {
    propuestaValor: [
      "Más de 10 años de experiencia",
      "Primera consulta sin costo",
      "Atención personalizada",
      "Respondemos el mismo día",
      "Trabajamos con empresas y particulares",
    ],
    politicas: [
      "Atendemos con cita previa",
      "Cobramos por adelantado el 50%",
      "Atención remota a todo el Perú",
      "Los precios dependen de cada caso",
      "Emitimos factura y boleta",
    ],
    llamadaAccion: [
      // Todos son cosas que el CLIENTE hace y el bot puede pedirle.
      "Que dejen su nombre y qué necesitan",
      "Que pidan una cotización",
      "Que cuenten su caso por aquí",
      "Que digan qué día les acomoda para coordinar",
      "Que visiten nuestra oficina",
    ],
  },
};

export function chipsDeCampo(tieneCarta: boolean | null): ChipsDeCampo {
  return CHIPS[tieneCarta ? "pedidos" : "servicios"];
}

/**
 * ACCIONES QUE EL BOT NO PUEDE EJECUTAR, para avisar mientras escriben.
 *
 * Espejo de la regla del backend (`llm/prompt.ts`): allá el modelo tiene
 * prohibido prometerlas; acá el dueño se entera ANTES, que es cuando puede
 * corregirlo. Hoy lo escribe, no funciona, y nunca se entera de por qué.
 *
 * Se AVISA, no se bloquea: puede que lo escriba a propósito para que el bot
 * tome el dato, y en ese caso el aviso ya le dijo qué va a pasar de verdad.
 */
const ACCIONES_IMPOSIBLES: { patron: RegExp; aviso: string }[] = [
  {
    patron: /\b(agend[ae]|agendar|reserv[ae]|reservar|coordin[ae]\s+(la\s+)?cita)\b/i,
    aviso: "El bot no agenda ni reserva. Va a tomar el día que prefiere el cliente y pasártelo a ti.",
  },
  {
    // "que EL BOT llame", no "que ME llamen": el cliente llamando está bien.
    // Por eso se exige el imperativo dirigido al bot, no el verbo suelto.
    patron: /\b(que\s+)?(llames?|llamar\s+(al|a\s+l)|telefone[ae]s?)\b/i,
    aviso: "El bot no llama por teléfono. Puede pedir el número para que llames tú.",
  },
  {
    // OJO CON EL FALSO POSITIVO: "emitimos boleta" es una política normal —
    // la emite el NEGOCIO, no el bot. Solo se avisa cuando se le pide al bot
    // que cobre o emita ("que cobre", "cobrar por el chat").
    patron: /\b(que\s+(cobre|facture|emita)|cobrar\s+(por|con)\s+(el\s+)?(chat|link|tarjeta))\b/i,
    aviso: "El bot no cobra ni emite comprobantes. Puede pasar el dato de pago y avisarte.",
  },
  {
    patron: /\b(enví[ae]|envie|manda[r]?\s+(un\s+)?(correo|mail|email))\b/i,
    aviso: "El bot no envía correos. Solo responde por el chat.",
  },
];

/** El aviso para ese texto, o `null` si no promete nada imposible. */
export function avisoDeAccionImposible(texto: string): string | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  for (const { patron, aviso } of ACCIONES_IMPOSIBLES) {
    if (patron.test(t)) return aviso;
  }
  return null;
}
