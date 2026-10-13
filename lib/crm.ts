// CRM FASE 1 (2026-10-13): "Hoy", el próximo paso y el historial del lead.
//
// Helpers PUROS (sin React ni localStorage): los prueban los tests de node.
// Todo lo que es "hoy", "mañana" o "el lunes" se razona en DÍAS DE LIMA
// (UTC-5 fija, ver lib/agenda.ts): la vendedora vive en Lima aunque el
// navegador o el servidor estén en otra zona.

import type { Hoy, ItemHistorial, OportunidadDia, ReunionHoy, SinRespuestaHoy, TareaDto, TareaHoy, TipoTarea } from "./api";
import { DIAS_SEMANA_CORTOS, diaDeSemana, diaLima, horaLima, hoyLima, nombreDelDia, sumarDias } from "./agenda";
import { soles, solesDeCentavos } from "./dinero";
import { urlAgenda } from "./enlaces";

// ── Qué toca hacer ────────────────────────────────────────────────────────

export const TIPOS_TAREA: { id: TipoTarea; etiqueta: string; verbo: string; icono: string }[] = [
  { id: "llamar", etiqueta: "Llamar", verbo: "Llamar a", icono: "📞" },
  { id: "escribir", etiqueta: "Escribir", verbo: "Escribirle a", icono: "💬" },
  { id: "mandar_info", etiqueta: "Mandar info", verbo: "Mandarle info a", icono: "📎" },
  { id: "reagendar", etiqueta: "Reagendar", verbo: "Reagendar con", icono: "📅" },
  { id: "otro", etiqueta: "Otro", verbo: "Pendiente con", icono: "📌" },
];

export function tipoTareaDe(tipo: string) {
  return TIPOS_TAREA.find((t) => t.id === tipo) ?? TIPOS_TAREA[TIPOS_TAREA.length - 1];
}

/** "Llamar a Ana", o lo que la vendedora escribió si puso un detalle. */
export function tituloTarea(t: { tipo: string; titulo?: string | null }, nombre?: string | null): string {
  const propio = t.titulo?.trim();
  if (propio) return propio;
  return `${tipoTareaDe(t.tipo).verbo} ${nombre?.trim() || "este cliente"}`;
}

// ── Cuándo ────────────────────────────────────────────────────────────────

/** Los atajos de "¿cuándo?" al crear o posponer un paso. */
export type Atajo = "hoy" | "manana" | "dos_dias" | "lunes";

export const ATAJOS_CUANDO: { id: Atajo; etiqueta: string }[] = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "manana", etiqueta: "Mañana" },
  { id: "dos_dias", etiqueta: "En 2 días" },
  { id: "lunes", etiqueta: "Lunes" },
];

/** Posponer no ofrece "hoy": si ya está para hoy, posponer es moverlo de día. */
export const ATAJOS_POSPONER: { id: Exclude<Atajo, "hoy">; etiqueta: string }[] = [
  { id: "manana", etiqueta: "Mañana" },
  { id: "dos_dias", etiqueta: "En 2 días" },
  { id: "lunes", etiqueta: "El lunes" },
];

/**
 * El día de Lima ("AAAA-MM-DD") de un atajo. "Lunes" es el PRÓXIMO lunes:
 * si hoy es lunes, el de la semana que viene (para hoy está "Hoy").
 */
export function diaDeAtajo(atajo: Atajo, ahora: Date = new Date()): string {
  const hoy = hoyLima(ahora);
  if (atajo === "hoy") return hoy;
  if (atajo === "manana") return sumarDias(hoy, 1);
  if (atajo === "dos_dias") return sumarDias(hoy, 2);
  return sumarDias(hoy, 7 - diaDeSemana(hoy));
}

/** La hora a la que se fija un paso "ese día" (sin hora): la del aviso del servidor, 9:00 de Lima. */
export const HORA_SIN_HORA = "09:00";

/**
 * El `venceEn` (ISO) de un día de Lima y una hora opcional ("HH:MM", de
 * Lima). Sin hora, el paso es "ese día" y se fija a las 9:00 —la hora en que
 * el servidor avisa— con `conHora: false`.
 */
export function venceEnDe(dia: string, hora?: string | null): { venceEn: string; conHora: boolean } {
  const conHora = !!hora && /^\d{2}:\d{2}$/.test(hora);
  const h = conHora ? hora! : HORA_SIN_HORA;
  return { venceEn: new Date(`${dia}T${h}:00-05:00`).toISOString(), conHora };
}

/**
 * Posponer un paso: al día del atajo (contado desde HOY, no desde cuando
 * vencía) y, si tenía hora, a la misma hora.
 */
export function pospuesta(
  t: { venceEn: string; conHora: boolean },
  atajo: Exclude<Atajo, "hoy">,
  ahora: Date = new Date(),
): { venceEn: string; conHora: boolean } {
  return venceEnDe(diaDeAtajo(atajo, ahora), t.conHora ? horaLima(t.venceEn) : null);
}

/**
 * ¿Ya se pasó? Con hora, desde esa hora. "Ese día", recién al día siguiente:
 * un "llamar hoy" no está atrasado a las 10 de la mañana.
 */
export function tareaAtrasada(t: { venceEn: string; conHora: boolean }, ahora: Date = new Date()): boolean {
  if (t.conHora) return new Date(t.venceEn).getTime() < ahora.getTime();
  return diaLima(t.venceEn) < hoyLima(ahora);
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "vie 16 oct" (con el año si no es el de hoy). */
export function diaCorto(dia: string, ahora: Date = new Date()): string {
  const [a, m, d] = dia.split("-").map(Number);
  const anio = a !== Number(hoyLima(ahora).slice(0, 4)) ? ` ${a}` : "";
  return `${DIAS_SEMANA_CORTOS[diaDeSemana(dia)]} ${d} ${MESES_CORTOS[m - 1]}${anio}`;
}

/** "hoy", "mañana", "ayer" o "vie 16 oct". */
export function nombreDia(dia: string, ahora: Date = new Date()): string {
  const hoy = hoyLima(ahora);
  if (dia === hoy) return "hoy";
  if (dia === sumarDias(hoy, 1)) return "mañana";
  if (dia === sumarDias(hoy, -1)) return "ayer";
  return diaCorto(dia, ahora);
}

function mayuscula(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "Hoy · 15:00", "Mañana", "Atrasado · ayer". */
export function cuandoTarea(t: { venceEn: string; conHora: boolean }, ahora: Date = new Date()): string {
  const dia = nombreDia(diaLima(t.venceEn), ahora);
  const cuando = t.conHora ? `${dia} · ${horaLima(t.venceEn)}` : dia;
  return tareaAtrasada(t, ahora) ? `Atrasado · ${cuando}` : mayuscula(cuando);
}

// ── Tiempo transcurrido ───────────────────────────────────────────────────

/** "25 min", "3 h", "2 días": cuánto lleva esperando. */
export function duracionCorta(min: number): string {
  const m = Math.max(0, Math.floor(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 día" : `${d} días`;
}

/** "Esperando hace 25 min". */
export function esperandoTexto(min: number): string {
  return `Esperando hace ${duracionCorta(min)}`;
}

/**
 * La fecha de un renglón del historial: "recién", "hace 5 min", "hace 3 h",
 * "ayer 15:30", "lun 12 oct". Lo que todavía no pasa (una reunión
 * agendada), con día y hora: "mañana 10:00".
 */
export function fechaRelativa(iso: string, ahora: Date = new Date()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const dia = diaLima(iso);
  if (t > ahora.getTime() + 60_000) return `${nombreDia(dia, ahora)} ${horaLima(iso)}`;
  const min = Math.floor((ahora.getTime() - t) / 60_000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  if (dia === hoyLima(ahora)) return `hace ${Math.floor(min / 60)} h`;
  if (dia === sumarDias(hoyLima(ahora), -1)) return `ayer ${horaLima(iso)}`;
  return diaCorto(dia, ahora);
}

// ── "Hoy", agrupado ───────────────────────────────────────────────────────

export interface HoyAgrupado {
  reuniones: ReunionHoy[];
  /** Pasos que ya se pasaron, el más viejo primero. */
  atrasadas: TareaHoy[];
  /** Pasos de hoy que todavía están a tiempo, por hora. */
  deHoy: TareaHoy[];
  /** Quién espera respuesta, el que espera hace más primero. */
  sinRespuesta: SinRespuestaHoy[];
  /** Fase 3: por prioridad. Vacío hasta que el servidor las mande. */
  oportunidades: OportunidadDia[];
  /** ¿No hay nada que hacer hoy? */
  vacio: boolean;
}

const porFecha = (a: string, b: string) => new Date(a).getTime() - new Date(b).getTime();

/**
 * Ordena lo que manda `/hoy` como se lee de arriba abajo: las reuniones por
 * hora (sin las canceladas), lo atrasado antes que lo de hoy, y quien espera
 * hace más, primero. No confía en el orden del servidor: la misma lista llega
 * de Inicio, de la vista global y de la campana.
 */
export function agruparHoy(hoy: Hoy, ahora: Date = new Date()): HoyAgrupado {
  const reuniones = hoy.reuniones
    .filter((r) => r.estado !== "cancelada")
    .sort((a, b) => porFecha(a.inicio, b.inicio));
  const pendientes = hoy.tareas
    .filter((t) => t.estado === "pendiente")
    .sort((a, b) => porFecha(a.venceEn, b.venceEn));
  const atrasadas = pendientes.filter((t) => tareaAtrasada(t, ahora));
  const deHoy = pendientes.filter((t) => !tareaAtrasada(t, ahora));
  const sinRespuesta = [...hoy.sinRespuesta].sort((a, b) => porFecha(a.ultimoEntranteEn, b.ultimoEntranteEn));
  const oportunidades = [...hoy.oportunidades].sort((a, b) => b.prioridad - a.prioridad);
  return {
    reuniones, atrasadas, deHoy, sinRespuesta, oportunidades,
    vacio: reuniones.length + pendientes.length + sinRespuesta.length + oportunidades.length === 0,
  };
}

/** Las tareas atrasadas de un "Hoy" (para la campana). */
export function tareasAtrasadas(hoy: Hoy | null | undefined, ahora: Date = new Date()): TareaHoy[] {
  if (!hoy) return [];
  return agruparHoy(hoy, ahora).atrasadas;
}

/** Saca una tarea de "Hoy" (hecha, cancelada o pospuesta para otro día). */
export function sinTarea(hoy: Hoy, tareaId: string): Hoy {
  return { ...hoy, tareas: hoy.tareas.filter((t) => t.id !== tareaId) };
}

/**
 * "Hoy" después de cambiarle la fecha a una tarea: si sigue venciendo hoy (o
 * antes) se queda con la fecha nueva; si pasó a otro día, sale de la lista.
 */
export function conTareaMovida(hoy: Hoy, tarea: Pick<TareaDto, "id" | "venceEn" | "conHora">, ahora: Date = new Date()): Hoy {
  if (diaLima(tarea.venceEn) > hoyLima(ahora)) return sinTarea(hoy, tarea.id);
  return {
    ...hoy,
    tareas: hoy.tareas.map((t) => (t.id === tarea.id ? { ...t, venceEn: tarea.venceEn, conHora: tarea.conHora } : t)),
  };
}

// ── El historial del lead ────────────────────────────────────────────────

const ESTADOS: Record<string, string> = {
  nuevo: "Nuevo",
  nutriendo: "En seguimiento",
  escalado: "Para atender",
  ganado: "Ganado",
  perdido: "Perdido",
};

const RESULTADOS: Record<string, string> = {
  interesado: "Interesado",
  otra_fecha: "Quiere otra fecha",
  no_contesto: "No contestó",
  no_interesado: "No le interesa",
};

const REDES: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Facebook",
  tiktok: "TikTok",
};

const ICONOS: Record<string, string> = {
  apunte: "📝",
  llamada: "📞",
  whatsapp: "💬",
  etapa: "➡️",
  asignado: "👤",
  ganado: "🏆",
  pago: "💰",
  pago_quitado: "↩️",
  reunion_agendada: "📅",
  reunion_resultado: "✅",
  reunion: "📅",
  etiquetas: "🏷️",
  registro: "🆕",
  nota_fijada: "📌",
  tarea_creada: "🗓️",
  tarea_hecha: "✔️",
  campania: "📣",
  comentario: "💭",
};

/** Lo que hizo el sistema o el bot (autor null): se firma como "Automático". */
const DEL_SISTEMA = new Set([
  "etapa", "asignado", "ganado", "pago", "pago_quitado", "reunion_agendada", "reunion_resultado",
  "etiquetas", "registro", "nota_fijada", "tarea_creada", "tarea_hecha",
]);

export interface ContextoHistorial {
  /** id de etapa del embudo → nombre (las del negocio). */
  etapas?: Map<string, string>;
  /** usuarioId → nombre (el equipo). */
  personas?: Map<string, string>;
  ahora?: Date;
}

export interface ItemLegible {
  icono: string;
  titulo: string;
  detalle: string | null;
  /** Quién lo hizo, o null si no viene al caso (una campaña, un comentario). */
  autor: string | null;
  fecha: string;
  enlace: { href: string; texto: string; externo?: boolean } | null;
}

function cadena(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
}

function nombreEtapa(v: unknown, ctx: ContextoHistorial): string | null {
  const s = cadena(v);
  if (!s) return null;
  return ctx.etapas?.get(s) ?? ESTADOS[s] ?? s;
}

/** "el viernes 16 de octubre a las 10:00". */
function cuandoReunion(iso: string): string {
  return `el ${nombreDelDia(diaLima(iso))} a las ${horaLima(iso)}`;
}

/** La campaña desde la ficha: Marketing → Campañas, con esa campaña marcada. */
export function urlCampania(id: string): string {
  return `/marketing?${new URLSearchParams({ t: "campanias", campania: id })}`;
}

/**
 * Un renglón del historial, en palabras: ícono, qué pasó, el detalle, quién y
 * cuándo, y a dónde lleva (la reunión en la Agenda, la campaña, el
 * comentario). Un `tipo` que esta web no conoce se muestra con su texto, sin
 * romper la lista.
 */
export function describirItem(item: ItemHistorial, ctx: ContextoHistorial = {}): ItemLegible {
  const d = item.datos ?? {};
  const ahora = ctx.ahora ?? new Date();
  const texto = cadena(item.texto);
  let titulo = texto ?? item.tipo;
  let detalle: string | null = null;
  let enlace: ItemLegible["enlace"] = null;

  switch (item.tipo) {
    case "apunte":
      titulo = "Apunte";
      detalle = texto;
      break;
    case "llamada":
      titulo = "Llamada";
      detalle = texto;
      break;
    case "whatsapp":
      titulo = "Contacto por WhatsApp";
      detalle = texto;
      break;
    case "etapa": {
      const de = nombreEtapa(d.de, ctx);
      const a = nombreEtapa(d.etapaId, ctx) ?? nombreEtapa(d.a, ctx);
      titulo = a ? (de && de !== a ? `Pasó de ${de} a ${a}` : `Pasó a ${a}`) : "Cambió de etapa";
      break;
    }
    case "asignado": {
      const a = cadena(d.a);
      titulo = !a ? "Quedó sin asignar" : `Se le asignó a ${ctx.personas?.get(a) ?? "alguien del equipo"}`;
      break;
    }
    case "ganado": {
      const monto = numero(d.monto);
      titulo = monto ? `Marcado como ganado · ${soles(monto)}` : "Marcado como ganado";
      break;
    }
    case "pago": {
      const c = numero(d.centavos);
      titulo = c ? `Pagó ${solesDeCentavos(c)}` : "Pagó";
      break;
    }
    case "pago_quitado":
      titulo = "Se quitó el pago";
      break;
    case "reunion_agendada": {
      const inicio = cadena(d.inicio);
      titulo = inicio ? `Reunión agendada para ${cuandoReunion(inicio)}` : "Reunión agendada";
      const citaId = cadena(d.citaId);
      if (citaId) enlace = { href: urlAgenda({ fecha: inicio ? diaLima(inicio) : undefined, cita: citaId, vista: "dia" }), texto: "Ver en la agenda" };
      break;
    }
    case "reunion_resultado": {
      const r = cadena(d.resultado);
      titulo = r ? `Cómo le fue en la reunión: ${RESULTADOS[r] ?? r}` : "Anotó cómo le fue en la reunión";
      detalle = cadena(d.nota);
      const citaId = cadena(d.citaId);
      if (citaId) enlace = { href: urlAgenda({ cita: citaId }), texto: "Ver en la agenda" };
      break;
    }
    case "etiquetas": {
      const mas = lista(d.agregadas);
      const menos = lista(d.quitadas);
      titulo = "Cambió las etiquetas";
      detalle = [mas.length ? `+ ${mas.join(", ")}` : "", menos.length ? `− ${menos.join(", ")}` : ""].filter(Boolean).join(" · ") || null;
      break;
    }
    case "registro":
      titulo = "Se registró";
      break;
    case "nota_fijada":
      titulo = texto ? "Cambió la nota fijada" : "Borró la nota fijada";
      detalle = texto;
      break;
    case "tarea_creada": {
      const venceEn = cadena(d.venceEn);
      titulo = `Próximo paso: ${tipoTareaDe(cadena(d.tipo) ?? "otro").etiqueta}`;
      detalle = venceEn ? `Para ${nombreDia(diaLima(venceEn), ahora)}${texto ? ` · ${texto}` : ""}` : texto;
      break;
    }
    case "tarea_hecha":
      titulo = `Hecho: ${tipoTareaDe(cadena(d.tipo) ?? "otro").etiqueta}`;
      detalle = texto;
      break;
    case "reunion": {
      const inicio = cadena(d.inicio);
      const estado = cadena(d.estado);
      const pasada = inicio ? new Date(inicio).getTime() < ahora.getTime() : false;
      titulo = !inicio
        ? "Reunión"
        : estado === "cancelada"
          ? `Reunión cancelada (${nombreDelDia(diaLima(inicio))})`
          : pasada
            ? `Reunión del ${nombreDelDia(diaLima(inicio))}`
            : `Reunión ${cuandoReunion(inicio)}`;
      const r = cadena(d.resultado);
      detalle = [r ? RESULTADOS[r] ?? r : "", cadena(d.notaResultado) ?? ""].filter(Boolean).join(" · ") || null;
      const citaId = cadena(d.citaId) ?? (item.id.startsWith("cita_") ? item.id.slice(5) : null);
      if (citaId) enlace = { href: urlAgenda({ fecha: inicio ? diaLima(inicio) : undefined, cita: citaId, vista: "dia" }), texto: "Ver en la agenda" };
      break;
    }
    case "campania": {
      const nombre = cadena(d.nombre);
      titulo = nombre ? `Le llegó la campaña "${nombre}"` : "Le llegó una campaña";
      if (cadena(d.estado) === "fallido") titulo = nombre ? `La campaña "${nombre}" no le llegó` : "Una campaña no le llegó";
      const campaniaId = cadena(d.campaniaId);
      if (campaniaId) enlace = { href: urlCampania(campaniaId), texto: "Ver la campaña" };
      break;
    }
    case "comentario": {
      const red = cadena(d.red);
      titulo = red ? `Comentó en ${REDES[red] ?? red}` : "Comentó en tus redes";
      detalle = cadena(d.texto) ?? texto;
      const permalink = cadena(d.permalink);
      if (permalink && /^https?:\/\//.test(permalink)) enlace = { href: permalink, texto: "Ver el comentario", externo: true };
      break;
    }
  }

  const autor = item.autor
    ? item.autor.nombre?.trim() || "Alguien del equipo"
    : DEL_SISTEMA.has(item.tipo) ? "Automático" : null;

  return {
    icono: ICONOS[item.tipo] ?? "•",
    titulo,
    detalle,
    autor,
    fecha: fechaRelativa(item.fecha, ahora),
    enlace,
  };
}

/**
 * Junta una página más vieja del historial con lo que ya se ve, sin
 * repetidos (dos renglones con la misma fecha pueden venir en las dos
 * páginas) y de lo más nuevo a lo más viejo.
 */
export function juntarHistorial(actual: ItemHistorial[], mas: ItemHistorial[]): ItemHistorial[] {
  const vistos = new Set<string>();
  const salida: ItemHistorial[] = [];
  for (const it of [...actual, ...mas]) {
    if (vistos.has(it.id)) continue;
    vistos.add(it.id);
    salida.push(it);
  }
  return salida.sort((a, b) => porFecha(b.fecha, a.fecha));
}
