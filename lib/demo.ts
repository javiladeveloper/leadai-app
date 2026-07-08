// Datos de demostración — para mostrarle a Guisella cómo se ve la app trabajando.
// Realistas: una vendedora que representa varias marcas (multi-empresa), leads
// entrando por WhatsApp/Instagram, la IA ya calificó y resumió cada uno.
//
// Cuando el backend exponga los endpoints de lectura para la app, esta capa se
// reemplaza por llamadas a `api()` (ver lib/leads.ts). La UI no cambia.

import type { Conversacion, EmpresaConfig, Lead, Reporte } from "./tipos";

export const VENDEDORA = "Guisella";

export const LEADS: Lead[] = [
  {
    id: "l1",
    nombre: "Carla Medina",
    canal: "whatsapp",
    empresa: "Muebles Roble",
    temperatura: "caliente",
    estado: "sin_atender",
    resumenIA:
      "Quiere el ropero de 3 cuerpos, ya preguntó por delivery a Surco. Lista para comprar.",
    ultimoMensaje: "¿Me lo pueden entregar este sábado? Lo necesito sí o sí 🙏",
    haceMinutos: 4,
    quiere: "Ropero 3 cuerpos color nogal",
    presupuesto: "Hasta S/1,200 — no le importa pagar delivery",
    urgencia: "Alta — lo necesita el sábado",
  },
  {
    id: "l2",
    nombre: "Renzo Paredes",
    canal: "instagram",
    empresa: "FitZone Suplementos",
    temperatura: "caliente",
    estado: "sin_atender",
    resumenIA:
      "Preguntó por el combo proteína + creatina y por pago con Yape. Quiere cerrar hoy.",
    ultimoMensaje: "¿El combo sigue con el 20%? Ya te yapeo",
    haceMinutos: 11,
    quiere: "Combo proteína 2kg + creatina",
    presupuesto: "S/280 — busca el descuento del 20%",
    urgencia: "Alta — quiere pagar ahora",
  },
  {
    id: "l3",
    nombre: "Sofía Quispe",
    canal: "whatsapp",
    empresa: "Muebles Roble",
    temperatura: "tibio",
    estado: "en_conversacion",
    resumenIA:
      "Interesada en el juego de comedor, comparando precios. Duda por el espacio en su depa.",
    ultimoMensaje: "¿Y cuánto mide la mesa extendida?",
    haceMinutos: 34,
    quiere: "Juego de comedor 6 sillas",
    presupuesto: "Aún no lo dijo — está comparando",
    urgencia: "Media — decide esta semana",
  },
  {
    id: "l4",
    nombre: "Diego Fernández",
    canal: "tiktok",
    empresa: "FitZone Suplementos",
    temperatura: "tibio",
    estado: "seguimiento",
    resumenIA:
      "Consultó por quemadores. Pidió tiempo para decidir; la IA agendó seguimiento.",
    ultimoMensaje: "Deja lo pienso y te aviso 👍",
    haceMinutos: 180,
    quiere: "Quemador de grasa",
    presupuesto: "S/90 aprox",
    urgencia: "Baja",
  },
  {
    id: "l5",
    nombre: "Lucía Torres",
    canal: "instagram",
    empresa: "Muebles Roble",
    temperatura: "frio",
    estado: "en_conversacion",
    resumenIA: "Preguntó horario de la tienda. Sin intención de compra clara todavía.",
    ultimoMensaje: "¿Atienden los domingos?",
    haceMinutos: 52,
    urgencia: "Baja",
  },
  {
    id: "l6",
    nombre: "Marco Ríos",
    canal: "whatsapp",
    empresa: "FitZone Suplementos",
    temperatura: "frio",
    estado: "en_conversacion",
    resumenIA: "Consulta general de precios, sin producto específico aún.",
    ultimoMensaje: "Hola, ¿qué proteínas manejan?",
    haceMinutos: 96,
    urgencia: "Baja",
  },
];

export const CONVERSACIONES: Record<string, Conversacion> = {
  l1: {
    lead: LEADS[0],
    mensajes: [
      { id: "m1", autor: "lead", texto: "Hola! vi el ropero de 3 cuerpos en su Instagram", haceMinutos: 48 },
      { id: "m2", autor: "bot", texto: "¡Hola Carla! 😊 Sí, el ropero de 3 cuerpos en nogal está disponible. Mide 1.80m de ancho. ¿Te gustaría conocer el precio y las opciones de entrega?", haceMinutos: 47 },
      { id: "m3", autor: "lead", texto: "Sí porfa, y si llega a Surco", haceMinutos: 46, esVoz: true },
      { id: "m4", autor: "bot", texto: "Claro 🙌 El ropero está S/1,090 y a Surco el delivery es S/60. Lo entregamos armado. ¿Para qué fecha lo necesitarías?", haceMinutos: 45 },
      { id: "m5", autor: "lead", texto: "¿Me lo pueden entregar este sábado? Lo necesito sí o sí 🙏", haceMinutos: 4 },
    ],
    borradores: [
      "¡Sí, Carla! Para el sábado lo tenemos. Te confirmo la entrega armada en Surco a S/60. ¿Te tomo el pedido y coordinamos la hora?",
      "El sábado está perfecto 🙌 Necesito tu dirección exacta en Surco y un teléfono de contacto para el reparto. ¿Prefieres mañana o tarde?",
    ],
  },
  l2: {
    lead: LEADS[1],
    mensajes: [
      { id: "m1", autor: "lead", texto: "Vi el combo de proteína en tu historia", haceMinutos: 40 },
      { id: "m2", autor: "bot", texto: "¡Hola Renzo! 💪 El combo es proteína 2kg + creatina 300g. Esta semana está con 20% off: S/280 (antes S/350). ¿Sabor de la proteína?", haceMinutos: 39 },
      { id: "m3", autor: "lead", texto: "Chocolate. ¿El combo sigue con el 20%? Ya te yapeo", haceMinutos: 11 },
    ],
    borradores: [
      "¡Sí, sigue con el 20%! Combo en chocolate = S/280. Te paso el número de Yape y apenas confirmes el pago coordinamos el envío. ¿Delivery o recojo?",
      "Perfecto Renzo 🔥 Chocolate confirmado, S/280 con el descuento. ¿A qué distrito sería el envío para calcularte el delivery?",
    ],
  },
};

export const EMPRESAS: EmpresaConfig[] = [
  {
    id: "e1",
    nombre: "Muebles Roble",
    comision: 8,
    whatsapp: "+51 987 654 321",
    productos: [
      { nombre: "Ropero 3 cuerpos (nogal)", precio: "S/1,090" },
      { nombre: "Juego de comedor 6 sillas", precio: "S/1,450" },
      { nombre: "Cama box 2 plazas", precio: "S/890" },
    ],
  },
  {
    id: "e2",
    nombre: "FitZone Suplementos",
    comision: 12,
    whatsapp: "+51 998 112 233",
    productos: [
      { nombre: "Combo proteína 2kg + creatina", precio: "S/280" },
      { nombre: "Quemador de grasa", precio: "S/90" },
      { nombre: "Pre-entreno", precio: "S/110" },
    ],
  },
];

export const REPORTE: Reporte = {
  comisionesGanadas: 1840,
  comisionesPendientes: 620,
  leads: 47,
  calientes: 8,
  ventas: 14,
  funnel: [
    { etapa: "Leads entrantes", cantidad: 47 },
    { etapa: "Calificados por IA", cantidad: 31 },
    { etapa: "Conversación activa", cantidad: 19 },
    { etapa: "Ventas cerradas", cantidad: 14 },
  ],
  porEmpresa: [
    { empresa: "Muebles Roble", ventas: 9, comision: 1240, pagada: false },
    { empresa: "FitZone Suplementos", ventas: 5, comision: 600, pagada: true },
  ],
};
