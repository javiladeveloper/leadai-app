// CRM FASE 2 (2026-10-13): ENCONTRAR Y CONECTAR.
//
// Pedido de Jonathan: "debe ser un CRM muy completo, fácil y que realmente
// sea ÚTIL… enlaces y links directos para interconectar la información". Los
// filtros de Leads y Conversaciones vivían cada uno a su manera y la búsqueda
// era sobre lo que ya estaba bajado: con miles de leads, "Ana" no aparecía si
// no estaba entre los primeros. Ahora:
//
//  · TODOS LOS FILTROS VIVEN EN LA URL, con las mismas claves en las dos
//    pantallas: `q`, `etiqueta` (se repite), `asignado` (yo | sin | id),
//    `sinRespuesta`, `origen`, `fecha` y `orden`. Un chip de etiqueta es un
//    link a la lista filtrada; el link se comparte y el "atrás" funciona.
//  · El SERVIDOR busca y filtra (`paresServidor`). La pantalla vuelve a
//    filtrar lo que ya tiene (`cumpleFiltrosCrm`): el cambio se ve al
//    instante y un backend que todavía no conoce un filtro no lo rompe.
//
// Helpers PUROS (sin React ni localStorage): los prueban los tests de node.

import type { Lead } from "./api";
import { diaLima, horaLima, hoyLima } from "./agenda";
import { duracionCorta, nombreDia } from "./crm";
import { coincideBusqueda, cumpleOrigen, terminoParaServidor } from "./enlaces";
import { etapaVisibleDe, type EtapaEmbudo } from "./etapas";

// ── Los filtros ───────────────────────────────────────────────────────────

export type OrdenLista = "reciente" | "esperando" | "creado";
export type FechaFiltro = "" | "hoy" | "7d" | "30d" | "sin30" | "sin60";

export interface FiltrosCrm {
  /** Búsqueda libre: nombre, teléfono, etiqueta, nota, empresa o correo. */
  q: string;
  /** Las tiene TODAS (sin distinguir mayúsculas). */
  etiquetas: string[];
  /** "" (todos) | "yo" | "sin" (nadie) | un usuarioId. */
  asignado: string;
  /** Solo los que escribieron último y esperan respuesta. */
  sinRespuesta: boolean;
  /** Etiqueta cruda del origen (`ad:<id>`, `comentario`, `directo`…). */
  origen: string;
  fecha: FechaFiltro;
  orden: OrdenLista;
}

export const FILTROS_CRM_VACIOS: FiltrosCrm = {
  q: "", etiquetas: [], asignado: "", sinRespuesta: false, origen: "", fecha: "", orden: "reciente",
};

/** Lo mismo que acepta el servidor (`?etiqueta=` se puede repetir hasta 10 veces). */
export const MAX_ETIQUETAS_FILTRO = 10;

export const OPCIONES_ORDEN: { id: OrdenLista; etiqueta: string }[] = [
  { id: "reciente", etiqueta: "Los más recientes" },
  { id: "esperando", etiqueta: "Los que más esperan" },
  { id: "creado", etiqueta: "Los que llegaron hace poco" },
];

/**
 * El eje del tiempo tiene dos puntas y son usos opuestos: los que escribieron
 * hace poco (bandeja viva) y los que NO escriben hace mucho (recuperar al que
 * se fue). Cada opción es UN parámetro del servidor.
 */
export const OPCIONES_FECHA: { id: FechaFiltro; etiqueta: string; dias?: number; inactivoDias?: number }[] = [
  { id: "", etiqueta: "Cualquier fecha" },
  { id: "hoy", etiqueta: "Escribieron hoy", dias: 1 },
  { id: "7d", etiqueta: "Escribieron esta semana", dias: 7 },
  { id: "30d", etiqueta: "Escribieron este mes", dias: 30 },
  { id: "sin30", etiqueta: "Sin escribir hace 30+ días", inactivoDias: 30 },
  { id: "sin60", etiqueta: "Sin escribir hace 60+ días", inactivoDias: 60 },
];

const esOrden = (v: string | null): v is OrdenLista => v === "reciente" || v === "esperando" || v === "creado";
const esFecha = (v: string | null): v is FechaFiltro => OPCIONES_FECHA.some((o) => o.id === v);

/** Sin espacios de más y sin repetidas (sin distinguir mayúsculas), hasta 10. */
export function limpiarEtiquetas(lista: string[]): string[] {
  const vistas = new Set<string>();
  const salida: string[] = [];
  for (const crudo of lista) {
    const e = crudo.replace(/\s+/g, " ").trim().slice(0, 40);
    if (!e || vistas.has(e.toLowerCase())) continue;
    vistas.add(e.toLowerCase());
    salida.push(e);
    if (salida.length >= MAX_ETIQUETAS_FILTRO) break;
  }
  return salida;
}

/**
 * Los filtros que dice la URL. Acepta también las claves viejas: `buscar`
 * (el buscador del header) y `buzon=mios|sin` (Conversaciones), para que los
 * links que ya andan por ahí sigan abriendo lo mismo.
 */
export function leerFiltrosCrm(qs: URLSearchParams): FiltrosCrm {
  const buzon = qs.get("buzon");
  const asignado = qs.get("asignado")?.trim() || (buzon === "mios" ? "yo" : buzon === "sin" ? "sin" : "");
  const sr = qs.get("sinRespuesta");
  const fecha = qs.get("fecha");
  const orden = qs.get("orden");
  return {
    q: (qs.get("q") ?? qs.get("buscar") ?? "").trim(),
    etiquetas: limpiarEtiquetas(qs.getAll("etiqueta")),
    asignado,
    sinRespuesta: sr === "1" || sr === "true",
    origen: qs.get("origen")?.trim() ?? "",
    fecha: esFecha(fecha) ? fecha : "",
    orden: esOrden(orden) ? orden : "reciente",
  };
}

/** Las claves que estos filtros manejan (las demás de la URL no se tocan). */
const CLAVES_CRM = ["q", "buscar", "etiqueta", "asignado", "buzon", "sinRespuesta", "origen", "fecha", "orden"];

/**
 * Escribe los filtros en la URL SIN perder lo demás (`lead`, `negocio`,
 * `nivel`, `etapa`…). Lo que está en su valor por defecto no se escribe:
 * `/leads` limpio es "sin filtros".
 */
export function escribirFiltrosCrm(f: FiltrosCrm, base: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const qs = new URLSearchParams(base);
  for (const k of CLAVES_CRM) qs.delete(k);
  if (f.q.trim()) qs.set("q", f.q.trim());
  for (const e of limpiarEtiquetas(f.etiquetas)) qs.append("etiqueta", e);
  if (f.asignado) qs.set("asignado", f.asignado);
  if (f.sinRespuesta) qs.set("sinRespuesta", "1");
  if (f.origen) qs.set("origen", f.origen);
  if (f.fecha) qs.set("fecha", f.fecha);
  if (f.orden !== "reciente") qs.set("orden", f.orden);
  return qs;
}

/** Una clave estable de los filtros (para la caché de la lista). */
export function claveFiltrosCrm(f: FiltrosCrm): string {
  return escribirFiltrosCrm(f).toString();
}

/** ¿Hay algún filtro puesto? (el orden no cuenta: no saca a nadie de la lista). */
export function hayFiltrosCrm(f: FiltrosCrm): boolean {
  return !!(f.q.trim() || f.etiquetas.length || f.asignado || f.sinRespuesta || f.origen || f.fecha);
}

/** Pone o saca una etiqueta del filtro (tocar el chip dos veces la quita). */
export function alternarEtiqueta(f: FiltrosCrm, etiqueta: string): FiltrosCrm {
  const e = etiqueta.trim();
  if (!e) return f;
  const ya = f.etiquetas.some((x) => x.toLowerCase() === e.toLowerCase());
  return {
    ...f,
    etiquetas: ya ? f.etiquetas.filter((x) => x.toLowerCase() !== e.toLowerCase()) : limpiarEtiquetas([...f.etiquetas, e]),
  };
}

/**
 * Los parámetros que el SERVIDOR entiende (`GET /leads` y `/bandeja-global`).
 * `incluirAsignado: false` en Conversaciones: ahí el buzón (Todos / Míos /
 * Sin asignar) se cuenta sobre la lista bajada, y si el servidor ya la
 * recortara los números no cuadrarían. El origen viaja aparte (lo arma
 * `paginaLeadsFiltrada`, que sabe que "directo" no se manda).
 */
export function paresServidor(f: FiltrosCrm, opciones: { incluirAsignado?: boolean } = {}): Array<[string, string]> {
  const { incluirAsignado = true } = opciones;
  const pares: Array<[string, string]> = [];
  const q = terminoParaServidor(f.q).slice(0, 80);
  if (q) pares.push(["q", q]);
  for (const e of limpiarEtiquetas(f.etiquetas)) pares.push(["etiqueta", e]);
  if (incluirAsignado && f.asignado) pares.push(["asignadoA", f.asignado]);
  if (f.sinRespuesta) pares.push(["sinRespuesta", "true"]);
  const fecha = OPCIONES_FECHA.find((o) => o.id === f.fecha);
  if (fecha?.dias) pares.push(["dias", String(fecha.dias)]);
  if (fecha?.inactivoDias) pares.push(["inactivoDias", String(fecha.inactivoDias)]);
  if (f.orden !== "reciente") pares.push(["orden", f.orden]);
  return pares;
}

// ── Filtrar y ordenar lo que ya está bajado ───────────────────────────────

/** Sin tildes ni mayúsculas (el servidor también aplana la ñ). */
function plano(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Las etiquetas del vendedor y las de la IA juntas (sin repetir la misma). */
export function todasLasEtiquetas(l: Pick<Lead, "etiquetas" | "etiquetasIA">): string[] {
  return etiquetasDe(l).map((e) => e.nombre);
}

/**
 * ¿Lo encuentra la búsqueda? Los MISMOS campos que mira el servidor (nombre,
 * teléfono, etiqueta, nota, empresa, correo) más lo que entendió la IA: si el
 * servidor ya filtró, esto no saca a nadie; si todavía no sabe buscar, filtra
 * lo que hay en pantalla.
 */
export function coincideBusquedaAmplia(
  l: Pick<Lead, "nombre" | "contactoExterno" | "nota" | "empresa" | "correo" | "resumenIA" | "etiquetas" | "etiquetasIA">,
  q: string,
): boolean {
  const t = plano(q.trim());
  if (!t) return true;
  if (coincideBusqueda(l, q)) return true;
  const campos = [l.nota, l.empresa, l.correo, l.resumenIA, ...todasLasEtiquetas(l)];
  return campos.some((c) => !!c && plano(c).includes(t));
}

/** Cuánto tiene que esperar un mensaje para contar como "sin respuesta" (el mismo corte del servidor). */
export const MINUTOS_SIN_RESPUESTA = 10;

/** ¿El último mensaje es del cliente? `null` = la fila no lo dice (backend anterior). */
export function escribioUltimo(l: Pick<Lead, "ultimoDireccion">): boolean | null {
  if (l.ultimoDireccion === undefined) return null;
  return l.ultimoDireccion === "entrante";
}

/** Desde cuándo espera: su último entrante, o el último mensaje si fue suyo. */
function esperaDesde(l: Pick<Lead, "ultimoEntranteEn" | "ultimoMensajeEn">): string | null {
  return l.ultimoEntranteEn ?? l.ultimoMensajeEn ?? null;
}

const DIA_MS = 86_400_000;

/**
 * ¿Pasa los filtros? Es la red de abajo del servidor: con un backend que ya
 * filtra no saca a nadie; con uno anterior, filtra lo que hay. Lo que la fila
 * no trae (un backend que no manda `ultimoDireccion`) no filtra: es mejor
 * mostrar de más que esconder a un cliente.
 */
export function cumpleFiltrosCrm(
  l: Lead,
  f: FiltrosCrm,
  contexto: { miUsuarioId?: string | null; ahora?: Date } = {},
): boolean {
  const ahora = (contexto.ahora ?? new Date()).getTime();
  if (f.q.trim() && !coincideBusquedaAmplia(l, f.q)) return false;
  if (f.etiquetas.length) {
    const tiene = new Set(todasLasEtiquetas(l).map((e) => e.toLowerCase()));
    if (!f.etiquetas.every((e) => tiene.has(e.toLowerCase()))) return false;
  }
  if (f.asignado === "sin" && l.asignadoA) return false;
  if (f.asignado === "yo" && contexto.miUsuarioId && l.asignadoA !== contexto.miUsuarioId) return false;
  if (f.asignado && f.asignado !== "sin" && f.asignado !== "yo" && l.asignadoA !== f.asignado) return false;
  if (f.sinRespuesta) {
    const ultimo = escribioUltimo(l);
    if (ultimo === false) return false;
    const desde = esperaDesde(l);
    if (ultimo && desde && ahora - new Date(desde).getTime() < MINUTOS_SIN_RESPUESTA * 60_000) return false;
  }
  if (f.origen && !cumpleOrigen(l, f.origen)) return false;
  const fecha = OPCIONES_FECHA.find((o) => o.id === f.fecha);
  if (fecha?.dias || fecha?.inactivoDias) {
    const ultimo = new Date(l.ultimoMensajeEn ?? l.creadoEn).getTime();
    if (fecha.dias && ultimo < ahora - fecha.dias * DIA_MS) return false;
    if (fecha.inactivoDias && ultimo >= ahora - fecha.inactivoDias * DIA_MS) return false;
  }
  return true;
}

const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);

/**
 * El orden de la lista, el mismo del servidor (no se confía en el orden en
 * que llegan las páginas: el sondeo mezcla lo nuevo arriba).
 *  · reciente  → último mensaje (o alta), lo más nuevo arriba;
 *  · creado    → fecha de alta, lo más nuevo arriba;
 *  · esperando → quien escribió último y espera HACE MÁS, arriba; los que
 *                no esperan, después (por lo más reciente).
 */
export function ordenarLista<T extends Lead>(leads: T[], orden: OrdenLista): T[] {
  const reciente = (l: Lead) => ms(l.ultimoMensajeEn ?? l.creadoEn);
  const copia = [...leads];
  if (orden === "creado") return copia.sort((a, b) => ms(b.creadoEn) - ms(a.creadoEn));
  if (orden === "esperando") {
    return copia.sort((a, b) => {
      const ea = escribioUltimo(a) === true;
      const eb = escribioUltimo(b) === true;
      if (ea !== eb) return ea ? -1 : 1;
      if (ea) return ms(esperaDesde(a)) - ms(esperaDesde(b));
      return reciente(b) - reciente(a);
    });
  }
  return copia.sort((a, b) => reciente(b) - reciente(a));
}

// ── Lo que se lee en cada fila ────────────────────────────────────────────

export interface Esperando {
  texto: string;
  minutos: number;
  /** Hace una hora o más: se pinta con color de alerta. */
  urgente: boolean;
}

/**
 * "Te escribió hace 2 h · esperando": solo si el ÚLTIMO mensaje es del
 * cliente. Si ya le respondieron (o la fila no lo dice), `null`.
 */
export function esperandoDeFila(
  l: Pick<Lead, "ultimoDireccion" | "ultimoEntranteEn" | "ultimoMensajeEn">,
  ahora: Date = new Date(),
): Esperando | null {
  if (escribioUltimo(l) !== true) return null;
  const desde = esperaDesde(l);
  if (!desde) return null;
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(desde).getTime()) / 60_000));
  const cuanto = minutos < 1 ? "recién" : `hace ${duracionCorta(minutos)}`;
  return { texto: `Te escribió ${cuanto} · esperando`, minutos, urgente: minutos >= 60 };
}

/** Días enteros desde el último contacto (último mensaje, o el alta si nunca hubo uno). */
export function diasSinContacto(l: Pick<Lead, "ultimoMensajeEn" | "creadoEn">, ahora: Date = new Date()): number {
  const desde = ms(l.ultimoMensajeEn ?? l.creadoEn);
  if (!desde) return 0;
  return Math.max(0, Math.floor((ahora.getTime() - desde) / DIA_MS));
}

/** "Habló hoy", "1 día sin contacto", "12 días sin contacto". */
export function textoSinContacto(dias: number): string {
  if (dias <= 0) return "Habló hoy";
  return dias === 1 ? "1 día sin contacto" : `${dias} días sin contacto`;
}

/** "Reunión hoy 15:00", "Reunión mañana 10:00", "Reunión vie 16 oct 10:00". */
export function textoProximaReunion(iso: string | null | undefined, ahora: Date = new Date()): string | null {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  return `Reunión ${nombreDia(diaLima(iso), ahora)} ${horaLima(iso)}`;
}

/** "Próximo paso: mañana" o, si ya pasó el día, "Paso atrasado · ayer". */
export function textoProximoPaso(iso: string | null | undefined, ahora: Date = new Date()): { texto: string; atrasado: boolean } | null {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return null;
  const dia = diaLima(iso);
  const atrasado = dia < hoyLima(ahora);
  return { texto: atrasado ? `Paso atrasado · ${nombreDia(dia, ahora)}` : `Próximo paso: ${nombreDia(dia, ahora)}`, atrasado };
}

/** Una etiqueta como se pinta: las de la IA llevan 🤖 y otro estilo. */
export interface EtiquetaVista {
  nombre: string;
  ia: boolean;
}

/** Las del vendedor primero y después las de la IA que no repiten una suya. */
export function etiquetasDe(l: Pick<Lead, "etiquetas" | "etiquetasIA">): EtiquetaVista[] {
  const manuales = (l.etiquetas ?? []).filter((e) => typeof e === "string" && e.trim());
  const vistas = new Set(manuales.map((e) => e.trim().toLowerCase()));
  const ia: EtiquetaVista[] = [];
  for (const e of l.etiquetasIA ?? []) {
    if (typeof e !== "string" || !e.trim() || vistas.has(e.trim().toLowerCase())) continue;
    vistas.add(e.trim().toLowerCase());
    ia.push({ nombre: e.trim(), ia: true });
  }
  return [...manuales.map((nombre) => ({ nombre: nombre.trim(), ia: false })), ...ia];
}

/**
 * Las etiquetas que hay en una lista ya bajada, las más usadas primero. Es lo
 * que se ofrece al autocompletar cuando el servidor todavía no tiene
 * `GET /etiquetas`.
 */
export function etiquetasDeLista(leads: Array<Pick<Lead, "etiquetas" | "etiquetasIA">>): { nombre: string; cuenta: number }[] {
  const mapa = new Map<string, { nombre: string; cuenta: number }>();
  for (const l of leads) {
    for (const nombre of todasLasEtiquetas(l)) {
      const k = nombre.toLowerCase();
      const e = mapa.get(k);
      if (e) e.cuenta += 1;
      else mapa.set(k, { nombre, cuenta: 1 });
    }
  }
  return [...mapa.values()].sort((a, b) => b.cuenta - a.cuenta || a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * De dónde vinieron los leads de la lista, para el filtro de origen: "Mensaje
 * directo", "Comentarios" y cada anuncio o link con su nombre (no el id crudo
 * de Meta). Los que más leads trajeron, primero.
 */
export function origenesDeLista(
  leads: Array<Pick<Lead, "origenEtiqueta" | "origen">>,
): { id: string; etiqueta: string; cuenta: number }[] {
  const mapa = new Map<string, { id: string; etiqueta: string; cuenta: number }>();
  for (const l of leads) {
    const crudo = l.origenEtiqueta?.trim();
    const id = !crudo || crudo === "directo" ? "directo" : crudo;
    const etiqueta = id === "directo"
      ? "Mensaje directo"
      : id === "comentario"
        ? "Comentarios"
        : l.origen?.etiqueta?.trim() || (id.startsWith("ad:") ? "Un anuncio" : id);
    const e = mapa.get(id);
    if (!e) mapa.set(id, { id, etiqueta, cuenta: 1 });
    else {
      e.cuenta += 1;
      // Un lead que sí trae el nombre del anuncio mejora el rótulo genérico.
      if (l.origen?.etiqueta?.trim()) e.etiqueta = l.origen.etiqueta.trim();
    }
  }
  return [...mapa.values()].sort((a, b) => b.cuenta - a.cuenta || a.etiqueta.localeCompare(b.etiqueta, "es"));
}

/** ¿La lista trae los campos nuevos de la fila? (un backend anterior no los manda). */
export function listaConCamposCrm(leads: Lead[]): boolean {
  return leads.some((l) => l.ultimoDireccion !== undefined);
}

// ── Embudo ────────────────────────────────────────────────────────────────

export interface Columna<T> {
  etapa: EtapaEmbudo;
  leads: T[];
  total: number;
  /** Cuántos de la columna escribieron y esperan respuesta. */
  esperando: number;
}

const ORDEN_NIVEL: Record<string, number> = { caliente: 0, tibio: 1, frio: 2 };

/**
 * Las columnas del embudo, en el orden de las etapas del negocio, con la MISMA
 * regla que Conversaciones para decidir dónde cae cada lead
 * (`etapaVisibleDe`). Dentro de cada columna, los calientes arriba y, entre
 * iguales, el que espera hace más.
 */
export function agruparPorColumna<T extends Lead>(leads: T[], etapas: EtapaEmbudo[]): Columna<T>[] {
  const mapa = new Map<string, T[]>(etapas.map((e) => [e.id, []]));
  for (const l of leads) mapa.get(etapaVisibleDe(l, etapas).id)?.push(l);
  return etapas.map((etapa) => {
    const lista = (mapa.get(etapa.id) ?? []).sort((a, b) => {
      const n = (ORDEN_NIVEL[a.nivelInteres] ?? 3) - (ORDEN_NIVEL[b.nivelInteres] ?? 3);
      if (n !== 0) return n;
      const ea = escribioUltimo(a) === true;
      const eb = escribioUltimo(b) === true;
      if (ea !== eb) return ea ? -1 : 1;
      return ea ? ms(esperaDesde(a)) - ms(esperaDesde(b)) : 0;
    });
    return { etapa, leads: lista, total: lista.length, esperando: lista.filter((l) => escribioUltimo(l) === true).length };
  });
}

/**
 * Qué acción del servidor mueve a esta etapa. Con las etapas DEL NEGOCIO se
 * mueve por id (el backend sincroniza el estado). Con las de siempre (vista
 * de todos los negocios, donde cada lead es de uno con las suyas) se mueve por
 * estado, y los cierres van por "Ganado" / "Descartar".
 */
export function accionParaEtapa(
  et: EtapaEmbudo,
  etapasPropias: boolean,
):
  | { tipo: "mover_etapa"; etapaId: string }
  | { tipo: "mover_etapa"; etapa: "nuevo" | "nutriendo" | "escalado" }
  | { tipo: "marcar_ganado" }
  | { tipo: "descartar" } {
  if (etapasPropias) return { tipo: "mover_etapa", etapaId: et.id };
  if (et.motor === "ganado") return { tipo: "marcar_ganado" };
  if (et.motor === "perdido") return { tipo: "descartar" };
  return { tipo: "mover_etapa", etapa: et.motor };
}
