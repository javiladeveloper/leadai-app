// Helpers PUROS de "Mi calendario" y "Agenda" (2026-09-26). Sin imports del
// panel: los tests los corren con `--experimental-strip-types`.

/** Las citas de "Agenda" agrupadas por día (en hora de Lima), cada día ordenado por hora. */
export function agruparPorDia<T extends { inicio: string }>(citas: T[]): { dia: string; citas: T[] }[] {
  // Lima es UTC-5 todo el año (sin horario de verano).
  const lima = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString();
  const orden = [...citas].sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  const salida: { dia: string; citas: T[] }[] = [];
  for (const c of orden) {
    const dia = lima(c.inicio).slice(0, 10);
    const ultimo = salida[salida.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.citas.push(c);
    else salida.push({ dia, citas: [c] });
  }
  return salida;
}

/**
 * Qué decirle a la persona cuando falla `POST /calendario/google/confirmar`.
 *
 * 404: el pendiente venció (o ya se usó). 403: lo inició OTRA cuenta de
 * LeadAI —pasa cuando se loguea con una cuenta distinta a la que tocó
 * "Conectar"—. Cualquier otro error: el mensaje del backend.
 */
export function avisoConfirmacionCalendario(status: number, mensaje?: string): string {
  // 401: el token guardado venció (el panel no lo detecta hasta que llama).
  if (status === 401) return "Tu sesión venció. Vuelve a entrar y conecta tu calendario de nuevo.";
  if (status === 404) return "La conexión venció. Vuelve a conectar tu calendario.";
  if (status === 403) {
    return "Esta conexión la inició otra cuenta de LeadAI. Entra con la cuenta correcta y vuelve a conectar.";
  }
  return mensaje || "No se pudo conectar tu calendario. Inténtalo de nuevo.";
}

/**
 * A dónde volver tras el login si se llegó SIN sesión desde Google.
 *
 * Google devuelve a `/configuracion?tab=calendario&pendiente=<id>` y el
 * pendiente solo se confirma con la sesión puesta. Si la sesión venció en el
 * medio, el guard del panel manda al login; esto arma la URL que el login
 * retoma (patrón `volver_a` de sessionStorage, ver `destinoTrasEntrar`).
 * Cualquier otra ruta devuelve null: el login decide como siempre.
 */
export function volverTrasLoginCalendario(pathname: string, search: string): string | null {
  if (pathname !== "/configuracion") return null;
  const pendiente = new URLSearchParams(search).get("pendiente");
  if (!pendiente) return null;
  return `/configuracion?${new URLSearchParams({ tab: "calendario", pendiente })}`;
}

/**
 * El inicio del día de HOY en Lima (00:00 -05:00), sea cual sea la zona del
 * navegador: la agenda se lee en hora de Lima, así que "hoy" también.
 */
export function inicioDelDiaLima(ahora: Date = new Date()): Date {
  const lima = new Date(ahora.getTime() - 5 * 3_600_000);
  return new Date(Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate()) + 5 * 3_600_000);
}

// ── Vistas de calendario (Día · Semana · Mes · Lista), 2026-09-27 ──────────
//
// Todo se razona en DÍAS DE LIMA escritos como "AAAA-MM-DD". Lima es UTC-5
// fija (sin horario de verano), así que un día de Lima empieza a las 05:00Z y
// la aritmética de fechas se hace en UTC puro: el huso del navegador (o del
// proceso de tests) nunca entra en la cuenta.

export type VistaAgenda = "dia" | "semana" | "mes" | "lista";
export const VISTAS: VistaAgenda[] = ["dia", "semana", "mes", "lista"];

export function esVista(v: unknown): v is VistaAgenda {
  return typeof v === "string" && (VISTAS as string[]).includes(v);
}

const DESFASE_LIMA_MS = 5 * 3_600_000;
const DIA_MS = 86_400_000;
/** Días de la vista Lista: los "próximos 30 días" de la agenda original. */
const DIAS_LISTA = 30;

/** El día de Lima ("AAAA-MM-DD") de un instante. */
export function diaLima(instante: string | Date): string {
  return new Date(new Date(instante).getTime() - DESFASE_LIMA_MS).toISOString().slice(0, 10);
}

/** Hoy en Lima. */
export function hoyLima(ahora: Date = new Date()): string {
  return diaLima(ahora);
}

/** Medianoche UTC del día (solo para aritmética de calendario). */
function utc(dia: string): number {
  const [a, m, d] = dia.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

function aDia(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function sumarDias(dia: string, n: number): string {
  return aDia(utc(dia) + n * DIA_MS);
}

/** 0 = lunes … 6 = domingo (la semana de la agenda empieza el lunes). */
export function diaDeSemana(dia: string): number {
  return (new Date(utc(dia)).getUTCDay() + 6) % 7;
}

/** El instante en que empieza ese día en Lima (00:00 -05:00). */
export function inicioDeDiaUtc(dia: string): Date {
  return new Date(utc(dia) + DESFASE_LIMA_MS);
}

/** Minutos desde la medianoche de Lima del día en que cae el instante. */
export function minutosLima(instante: string | Date): number {
  const d = new Date(new Date(instante).getTime() - DESFASE_LIMA_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** "10:05" en hora de Lima (24 h). */
export function horaLima(instante: string | Date): string {
  const m = minutosLima(instante);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function lunesDe(dia: string): string {
  return sumarDias(dia, -diaDeSemana(dia));
}

/** Las 42 casillas (6 filas × lun–dom) de la cuadrícula del mes de `dia`. */
export function diasDeCuadriculaMes(dia: string): string[] {
  const primero = lunesDe(`${dia.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, i) => sumarDias(primero, i));
}

/** Lunes a domingo de la semana de `dia`. */
export function diasDeSemana(dia: string): string[] {
  const lunes = lunesDe(dia);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/**
 * Los días que muestra una vista y el rango a pedirle a `listarAgenda`
 * (`hasta` exclusivo: 00:00 de Lima del día siguiente al último). El backend
 * rechaza más de 92 días; la vista más larga (Mes) pide 42.
 */
export function rangoDeVista(vista: VistaAgenda, dia: string): { desde: Date; hasta: Date; dias: string[] } {
  const dias =
    vista === "mes" ? diasDeCuadriculaMes(dia)
    : vista === "semana" ? diasDeSemana(dia)
    : vista === "dia" ? [dia]
    : Array.from({ length: DIAS_LISTA }, (_, i) => sumarDias(dia, i));
  return { desde: inicioDeDiaUtc(dias[0]), hasta: inicioDeDiaUtc(sumarDias(dias[dias.length - 1], 1)), dias };
}

/**
 * La fecha de referencia del periodo anterior/siguiente. En Mes salta al día
 * 1 (así "31 de enero + 1 mes" no tiene que inventar un 31 de febrero).
 */
export function moverPeriodo(vista: VistaAgenda, dia: string, delta: number): string {
  if (vista === "mes") {
    const [a, m] = dia.split("-").map(Number);
    return aDia(Date.UTC(a, m - 1 + delta, 1));
  }
  const paso = vista === "semana" ? 7 : vista === "dia" ? 1 : DIAS_LISTA;
  return sumarDias(dia, paso * delta);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_SEMANA_CORTOS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function partes(dia: string) {
  const [a, m, d] = dia.split("-").map(Number);
  return { a, m, d };
}

/** "lunes 28 de septiembre". */
export function nombreDelDia(dia: string): string {
  const { m, d } = partes(dia);
  return `${DIAS_SEMANA[diaDeSemana(dia)]} ${d} de ${MESES[m - 1]}`;
}

function tramo(desde: string, hasta: string): string {
  const x = partes(desde);
  const y = partes(hasta);
  if (x.a !== y.a) return `${x.d} ${MESES_CORTOS[x.m - 1]} ${x.a} – ${y.d} ${MESES_CORTOS[y.m - 1]} ${y.a}`;
  if (x.m !== y.m) return `${x.d} ${MESES_CORTOS[x.m - 1]} – ${y.d} ${MESES_CORTOS[y.m - 1]} ${y.a}`;
  return `${x.d} – ${y.d} ${MESES_CORTOS[y.m - 1]} ${y.a}`;
}

/** "octubre 2026" · "28 sep – 4 oct 2026" · "lunes 28 de septiembre". */
export function tituloDePeriodo(vista: VistaAgenda, dia: string): string {
  if (vista === "mes") {
    const { a, m } = partes(dia);
    return `${MESES[m - 1]} ${a}`;
  }
  if (vista === "dia") return nombreDelDia(dia);
  const { dias } = rangoDeVista(vista, dia);
  return tramo(dias[0], dias[dias.length - 1]);
}

/** Lo mínimo que se dibuja de una cita en la grilla por hora (una de 5 min se vería como una raya). */
const MIN_ALTO_MIN = 15;

export interface CitaPosicionada<T> {
  cita: T;
  /** Minutos desde la hora de arranque de la grilla. */
  desdeMin: number;
  hastaMin: number;
  /** Columna dentro de su grupo de solapes, y cuántas columnas tiene el grupo. */
  columna: number;
  columnas: number;
}

/**
 * Coloca las citas de UN día de Lima en la grilla por hora: arriba/alto en
 * minutos desde `horaDesde`, y las que se pisan, lado a lado. Una cita que
 * pasa la medianoche se corta al final del día.
 */
export function posicionarEnDia<T extends { inicio: string; fin: string }>(
  citas: T[],
  dia: string,
  horaDesde: number,
): CitaPosicionada<T>[] {
  const base = inicioDeDiaUtc(dia).getTime();
  const finDelDia = 24 * 60;
  const items = citas
    .map((cita) => {
      const ini = Math.max(0, Math.round((new Date(cita.inicio).getTime() - base) / 60_000));
      const finReal = Math.min(finDelDia, Math.round((new Date(cita.fin).getTime() - base) / 60_000));
      const fin = Math.min(finDelDia, Math.max(finReal, ini + MIN_ALTO_MIN));
      return { cita, ini, fin, columna: 0, columnas: 1 };
    })
    .sort((a, b) => a.ini - b.ini || b.fin - a.fin);

  // Grupos de solape encadenado: cada grupo reparte columnas con codicia
  // (la primera columna libre) y todos los del grupo comparten el ancho.
  let grupo: typeof items = [];
  let finGrupo = -1;
  let finesColumna: number[] = [];
  const cerrar = () => {
    for (const it of grupo) it.columnas = finesColumna.length;
    grupo = [];
    finesColumna = [];
  };
  for (const it of items) {
    if (it.ini >= finGrupo) cerrar();
    let col = finesColumna.findIndex((f) => f <= it.ini);
    if (col === -1) {
      col = finesColumna.length;
      finesColumna.push(it.fin);
    } else finesColumna[col] = it.fin;
    it.columna = col;
    grupo.push(it);
    finGrupo = Math.max(finGrupo, it.fin);
  }
  cerrar();

  return items.map((it) => ({
    cita: it.cita,
    desdeMin: it.ini - horaDesde * 60,
    hastaMin: it.fin - horaDesde * 60,
    columna: it.columna,
    columnas: it.columnas,
  }));
}

/** Horas de la grilla: 7–22 por defecto, ampliadas para que entre toda cita. */
export function rangoDeHoras(citas: { inicio: string; fin: string }[]): { desde: number; hasta: number } {
  let desde = 7;
  let hasta = 22;
  for (const c of citas) {
    const ini = minutosLima(c.inicio);
    // Si termina otro día (o justo a medianoche), la grilla llega hasta las 24.
    const fin = diaLima(c.fin) !== diaLima(c.inicio) ? 24 * 60 : minutosLima(c.fin);
    desde = Math.min(desde, Math.floor(ini / 60));
    hasta = Math.max(hasta, Math.min(24, Math.ceil(Math.max(fin, ini + MIN_ALTO_MIN) / 60)));
  }
  return { desde, hasta };
}

/**
 * Demo o llamada. No hay campo "tipo" en la cita: una de ≤ 15 min o con link
 * de cal.com es la demo; lo demás, una llamada.
 */
export function tipoDeCita(c: { inicio: string; fin: string; meetLink?: string | null }): "demo" | "llamada" {
  const minutos = (new Date(c.fin).getTime() - new Date(c.inicio).getTime()) / 60_000;
  if (minutos <= 15) return "demo";
  if (c.meetLink) {
    try {
      const host = new URL(c.meetLink).hostname;
      if (host === "cal.com" || host.endsWith(".cal.com")) return "demo";
    } catch {
      /* link raro: no decide */
    }
  }
  return "llamada";
}

/**
 * El índice de color (en una paleta de `tamano`) de cada negocio, por orden
 * alfabético de tenantId: el mismo negocio sale del mismo color sin importar
 * el orden en que lleguen las citas.
 */
export function coloresDeNegocios(tenantIds: string[], tamano = 8): Map<string, number> {
  const unicos = [...new Set(tenantIds)].sort();
  return new Map(unicos.map((id, i) => [id, i % tamano]));
}

/** Las primeras `max` citas de una casilla del mes y cuántas quedan para "+N más". */
export function resumenDelDia<T>(citas: T[], max = 3): { mostradas: T[]; resto: number } {
  return { mostradas: citas.slice(0, max), resto: Math.max(0, citas.length - max) };
}
