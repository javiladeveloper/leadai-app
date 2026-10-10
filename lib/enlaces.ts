// LOS DESTINOS DEL PANEL, EN UN SOLO LUGAR (2026-10-09, tanda "todo conectado").
//
// Antes cada pantalla armaba sus links a mano: trece lugares escribían
// `/conversacion/${id}`, cuatro mandaban "Conectar WhatsApp" a
// `/configuracion` (sin la pestaña de canales), los botones de plan iban unos
// a Configuración y otros a Mi plan, y "calientes sin atender" era una regla
// distinta en cada pantalla (caliente+nuevo en Leads, caliente sin cerrar en la
// campana). Un número que dice 7 en Inicio y 3 al tocarlo se lee como que el
// producto miente.
//
// Este archivo es PURO (sin React ni localStorage) a propósito: lo prueban los
// tests de node y lo puede usar cualquier pantalla sin arrastrar dependencias.

/** A dónde va un botón de plan. Un solo texto y un solo destino en toda la web. */
export const URL_MI_PLAN = "/mi-plan";
export const TEXTO_MEJORAR_PLAN = "Mejorar mi plan";

/** Conectar WhatsApp o redes: directo a la pestaña de canales, no a la portada de Configuración. */
export const URL_CONECTAR_CANALES = "/configuracion?tab=canales";

/** Arma un querystring sin las claves vacías (`undefined`, `null`, `""`). */
function query(params: Record<string, string | number | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * LA FICHA DE UN LEAD (2026-10-09). Hay UNA sola, dentro del panel: la de
 * Conversaciones. `negocio` viaja en la URL además de fijarse como empresa
 * activa: con varios negocios, el link tiene que abrir el chat correcto
 * aunque se abra en otra pestaña (donde la empresa activa puede ser otra).
 */
export function urlLead(id: string, opciones: { tenant?: string | null } = {}): string {
  return `/conversaciones${query({ lead: id, negocio: opciones.tenant ?? undefined })}`;
}

/**
 * EL ESTADO "ABIERTOS" NO EXISTE EN EL BACKEND: es "ni ganado ni perdido".
 * `GET /leads` filtra por UN estado; este se resuelve en el cliente.
 */
export const ESTADO_ABIERTOS = "abiertos";

export interface FiltrosLeads {
  nivel?: string;
  estado?: string;
  /** Etiqueta cruda del origen (`ad:<id>`, `comentario`, `directo`…). */
  origen?: string;
  buscar?: string;
  /** Con varios negocios: en cuál mirar (la vista global lo usa de filtro inicial). */
  negocio?: string | null;
}

export function urlLeads(f: FiltrosLeads = {}): string {
  return `/leads${query({ nivel: f.nivel, estado: f.estado, origen: f.origen, buscar: f.buscar, negocio: f.negocio ?? undefined })}`;
}

/**
 * "CALIENTES SIN ATENDER", LA DEFINICIÓN DEL BACKEND (GET /resumen): nivel
 * caliente y estado que no sea ganado ni perdido. Es la que usan el número de
 * Inicio, la campana y la tarjeta naranja de Leads, para que los tres digan lo
 * mismo y al tocarlos aparezcan esos mismos leads.
 */
export function esCalienteSinAtender(l: { nivelInteres: string; estado: string }): boolean {
  return l.nivelInteres === "caliente" && l.estado !== "ganado" && l.estado !== "perdido";
}

export function urlCalientesSinAtender(negocio?: string | null): string {
  return urlLeads({ nivel: "caliente", estado: ESTADO_ABIERTOS, negocio });
}

/** ¿El lead pasa el filtro de estado de la URL? (incluye el pseudo-estado "abiertos"). */
export function cumpleEstado(l: { estado: string }, estado?: string | null): boolean {
  if (!estado || estado === "todos") return true;
  if (estado === ESTADO_ABIERTOS) return l.estado !== "ganado" && l.estado !== "perdido";
  return l.estado === estado;
}

/**
 * ¿El lead vino de este origen? `directo` es "sin etiqueta" — así lo agrupa el
 * reporte de negocio (`leadsPorOrigen`). Un anuncio se puede pedir como
 * `ad:<id>` o solo con el id.
 */
export function cumpleOrigen(
  l: { origenEtiqueta?: string | null; origen?: { adId?: string } | null },
  origen?: string | null,
): boolean {
  if (!origen) return true;
  const etiqueta = l.origenEtiqueta ?? null;
  if (origen === "directo") return !etiqueta || etiqueta === "directo";
  if (etiqueta === origen) return true;
  const adId = origen.startsWith("ad:") ? origen.slice(3) : null;
  return !!adId && (etiqueta === `ad:${adId}` || l.origen?.adId === adId);
}

/** Los leads que trajo un anuncio: la lista filtrada por su origen. */
export function urlLeadsDeAnuncio(adId: string, negocio?: string | null): string {
  return urlLeads({ origen: adId.startsWith("ad:") ? adId : `ad:${adId}`, negocio });
}

/** Gestionar un anuncio: Marketing → Anuncios con ese anuncio abierto. */
export function urlGestionarAnuncio(adId: string): string {
  return `/marketing${query({ t: "anuncios", ad: adId.replace(/^ad:/, "") })}`;
}

export interface FiltrosAgenda {
  /** AAAA-MM-DD, u "hoy". */
  fecha?: string;
  cita?: string;
  vista?: "dia" | "semana" | "mes" | "lista";
  /** usuarioId de quien atiende. */
  atiende?: string;
  /** Nombre de quien atiende: las citas traen el nombre, no siempre el id. */
  quien?: string;
}

export function urlAgenda(f: FiltrosAgenda = {}): string {
  return `/agenda${query({ fecha: f.fecha, cita: f.cita, vista: f.vista, atiende: f.atiende, quien: f.quien })}`;
}

/** Seguimiento con una etapa (estado del motor) destacada. */
export function urlSeguimiento(etapa?: string): string {
  return `/seguimiento${query({ etapa })}`;
}

/** ¿Una reunión está por empezar (menos de 15 min) o en curso? Ahí se ofrece "Unirse". */
export function reunionUnible(
  r: { inicio: string; fin: string },
  ahora: Date = new Date(),
  margenMin = 15,
): boolean {
  const inicio = new Date(r.inicio).getTime();
  const fin = new Date(r.fin).getTime();
  const t = ahora.getTime();
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return false;
  return t >= inicio - margenMin * 60_000 && t <= fin;
}

/**
 * EL CONTACTO DE UNA PERSONA, YA RESUELTO (2026-10-09).
 *
 * `contactoExterno` es el número en WhatsApp y en un lead cargado a mano, pero
 * un id interno en Instagram, Messenger o TikTok — con ese no se llama a
 * nadie. Un texto libre (el "contacto" de una oportunidad) puede ser un correo.
 */
export function telefonoDe(canal: string | null | undefined, contacto: string | null | undefined): string | null {
  if (!contacto) return null;
  if (canal && ["instagram", "messenger", "tiktok"].includes(canal)) return null;
  if (contacto.includes("@")) return null;
  const digitos = contacto.replace(/[^\d]/g, "");
  if (digitos.length < 8 || digitos.length > 15) return null;
  // Un número peruano de 9 dígitos sin código de país: se le pone el 51 para
  // que tel: y wa.me funcionen desde cualquier lado.
  if (digitos.length === 9 && digitos.startsWith("9")) return `51${digitos}`;
  return digitos;
}

export function correoDe(contacto: string | null | undefined): string | null {
  if (!contacto) return null;
  const m = contacto.match(/[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/);
  return m ? m[0] : null;
}

/** Dirección → Google Maps (búsqueda, funciona en el celular y en la compu). */
export function urlMapa(direccion: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}
