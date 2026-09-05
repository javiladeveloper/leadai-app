// Cliente HTTP al backend de LeadAI (repo `leadia`).
// Autenticación: token de usuario (Bearer) + header X-Tenant-Id para elegir la
// empresa activa. El token y la empresa se guardan en el navegador (ver auth.ts).

import { leerSesion, leerEmpresaActiva, guardarSesion, guardarEmpresaActiva, EMPRESA_GLOBAL, type EmpresaResumen } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface Opciones {
  method?: string;
  body?: unknown;
  // por defecto se manda X-Tenant-Id de la empresa activa; se puede desactivar
  // para endpoints que no dependen de empresa (auth).
  conEmpresa?: boolean;
  // por defecto se manda el token de usuario; se puede desactivar (login).
  conAuth?: boolean;
  // fuerza un X-Tenant-Id distinto de la empresa activa (bandeja global: crear
  // un lead manual en el negocio elegido sin cambiar la empresa activa).
  tenant?: string;
  // manda/acepta cookies del backend (solo la activación de placas lo usa).
  conCookies?: boolean;
}

// Llamada genérica al backend. Arma headers de auth y empresa, parsea el error
// del backend y lo levanta como ApiError con el status real.
export async function api<T>(ruta: string, opts: Opciones = {}): Promise<T> {
  const { method = "GET", body, conEmpresa = true, conAuth = true, tenant, conCookies = false } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (conAuth) {
    const sesion = leerSesion();
    if (sesion?.token) headers.Authorization = `Bearer ${sesion.token}`;
  }
  if (tenant) {
    headers["X-Tenant-Id"] = tenant;
  } else if (conEmpresa) {
    const empresa = leerEmpresaActiva();
    // El centinela del modo global JAMÁS viaja como tenant: las pantallas en
    // modo global pasan `tenant` explícito o usan endpoints de plataforma.
    if (empresa && empresa !== EMPRESA_GLOBAL) headers["X-Tenant-Id"] = empresa;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      // Solo la activación de placas lo usa: acepta la cookie de dueño que
      // planta el backend (reconoce este navegador al tocar su propia placa).
      credentials: conCookies ? "include" : "same-origin",
    });
  } catch {
    throw new ApiError(0, "No pudimos conectar con el servidor. Revisa tu conexión.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? `Error ${res.status}`);
  }
  // 204 sin cuerpo
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Refresca la sesión guardada contra el backend (GET /auth/yo): empresas al
// día y, sobre todo, esSuperAdmin — la marca nace en el LOGIN, así que una
// sesión guardada antes de que el usuario fuera super admin (o antes de que
// existiera la marca) escondía el botón "Plataforma" para siempre. Devuelve
// si algo cambió, para que el layout re-renderice los menús.
export async function refrescarSesion(): Promise<boolean> {
  const sesion = leerSesion();
  if (!sesion) return false;
  const r = await api<{ empresas: EmpresaResumen[]; esSuperAdmin: boolean }>(
    "/auth/yo",
    { conEmpresa: false },
  );
  const cambio =
    r.esSuperAdmin !== (sesion.esSuperAdmin === true) ||
    JSON.stringify(r.empresas) !== JSON.stringify(sesion.empresas);
  if (cambio) {
    guardarSesion({ ...sesion, empresas: r.empresas, esSuperAdmin: r.esSuperAdmin });
  }
  return cambio;
}

// Conecta WhatsApp por Embedded Signup: manda el code (+ ids) del popup de Meta
// al backend, que hace el intercambio y registra el canal.
export async function conectarWhatsAppEmbedded(args: {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
  redirectUri?: string;
  // 'whatsapp_business_app_onboarding' = coexistencia (el número sigue viviendo
  // en la app del celular): el backend NO lo registra vía /register.
  featureType?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = leerSesion()?.token;
  const tenant = leerEmpresaActiva();
  try {
    const res = await fetch(`${API_URL}/canales/whatsapp/embedded-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenant ? { 'X-Tenant-Id': tenant } : {}),
      },
      // redirectUri: el que usó el diálogo del SDK (capturado en ConectarWhatsApp);
      // Meta exige el MISMO redirect_uri al canjear el code.
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? `Error ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo conectar con el servidor' };
  }
}

// ── La red de seguridad del Embedded Signup (2026-09-05) ──
// El caso real: en el celular, el salto a WhatsApp mata la pestaña y el code
// de Meta muere con ella. Estos dos helpers son la mitad panel del arreglo.

// Reporta los ids que Meta manda por postMessage DURANTE el flujo — antes del
// salto. Fire-and-forget: si falla, el flujo normal sigue idéntico.
export async function reportarAvanceConexion(datos: { wabaId?: string; phoneNumberId?: string }): Promise<void> {
  const token = leerSesion()?.token;
  const tenant = leerEmpresaActiva();
  try {
    await fetch(`${API_URL}/canales/whatsapp/avance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenant ? { 'X-Tenant-Id': tenant } : {}),
      },
      body: JSON.stringify(datos),
      keepalive: true, // que sobreviva aunque la pestaña esté por morir
    });
  } catch { /* nunca rompe el flujo */ }
}

// La URL del flujo por REDIRECCIÓN (2026-09-05): en el celular el popup de
// FB.login no es confiable — el diálogo se abre como pestaña suelta ("Cierra
// esta pestaña") o Android mata la página que espera el code. Con esta URL la
// MISMA pestaña navega al asistente y el code vuelve a nuestro servidor.
export async function urlConexionWhatsAppRedirect(modo: "nuevo" | "coexistencia"): Promise<string | null> {
  const token = leerSesion()?.token;
  const tenant = leerEmpresaActiva();
  try {
    const res = await fetch(`${API_URL}/canales/whatsapp/oauth-redirect?modo=${modo}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenant ? { 'X-Tenant-Id': tenant } : {}),
      },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { url?: string };
    return d.url ?? null;
  } catch {
    return null;
  }
}

// ¿Meta confirmó un registro cuyo code nunca llegó? 'meta_confirmo' = mostrar
// "toca Conectar para terminar" en vez de silencio.
export async function estadoIntentoConexion(): Promise<'ninguno' | 'pendiente' | 'meta_confirmo'> {
  const token = leerSesion()?.token;
  const tenant = leerEmpresaActiva();
  try {
    const res = await fetch(`${API_URL}/canales/whatsapp/intento`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenant ? { 'X-Tenant-Id': tenant } : {}),
      },
    });
    if (!res.ok) return 'ninguno';
    const d = (await res.json()) as { estado?: string };
    return d.estado === 'meta_confirmo' ? 'meta_confirmo' : d.estado === 'pendiente' ? 'pendiente' : 'ninguno';
  } catch {
    return 'ninguno';
  }
}

// Playbook del negocio (perfil que la IA usa). Lectura y guardado reales.
export interface PerfilNegocio {
  rubro: string;
  nombreNegocio: string;
  idioma: string;
  tono: string;
  propuestaValor: string;
  catalogo: { nombre: string; descripcion?: string; precio?: string }[];
  preguntasClave: string[];
  senalesCaliente: string[];
  senalesFrio: string[];
  objeciones: { objecion: string; respuesta: string }[];
  politicas: string;
  llamadaAccion: string;
  mensajeBienvenida?: string;
  respuestasFijas?: { palabra: string; respuesta: string }[];
}

/**
 * LO TÍPICO DE SU RUBRO (2026-08-27, Jonathan: "tantas opciones de texto
 * libre, una persona no puede saber qué escribir").
 *
 * Los negocios nuevos ya nacen con el playbook lleno; esto es para que el
 * panel ofrezca las mismas sugerencias como chips a los que ya existen.
 */
export interface SugerenciasPlaybook {
  preguntasClave: string[];
  senalesCaliente: string[];
  senalesFrio: string[];
  objeciones: { objecion: string; respuesta: string }[];
}

export async function obtenerSugerenciasPlaybook(
  // Con `rubro` se pide la plantilla de OTRO rubro, no la del perfil guardado
  // (2026-08-30): al cambiar el selector hay que comparar contra la del rubro
  // VIEJO para saber si el dueño editó sus listas o siguen siendo la plantilla.
  rubro?: string,
): Promise<SugerenciasPlaybook | null> {
  try {
    const q = rubro ? `?rubro=${encodeURIComponent(rubro)}` : "";
    const r = await api<{ sugerencias: SugerenciasPlaybook }>(`/perfil/sugerencias${q}`);
    return r.sugerencias;
  } catch {
    // Sin sugerencias la pantalla funciona igual: son ayuda, no requisito.
    return null;
  }
}

export async function obtenerPerfil(): Promise<PerfilNegocio | null> {
  try {
    const r = await api<{ perfil: PerfilNegocio } | PerfilNegocio>("/perfil");
    // el backend devuelve { rubro, perfil, version } o similar — normalizamos
    return (r as { perfil?: PerfilNegocio }).perfil ?? (r as PerfilNegocio) ?? null;
  } catch (e) {
    // 404: todavía no hay perfil guardado para esta empresa — no es un error fatal.
    if (e instanceof ApiError && e.status === 404) return null;
    // Cualquier otro error (backend caído, red, 5xx) es real: lo relanzamos.
    // Devolver null acá haría que el formulario se muestre vacío y, si el
    // usuario guarda, el PUT (full-replace) pisaría el perfil real con vacío.
    throw e;
  }
}

export async function guardarPerfil(
  rubro: string,
  perfil: PerfilNegocio,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/perfil", { method: "PUT", body: { rubro, perfil } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export type NivelInteres = "frio" | "tibio" | "caliente";
// Etapas PERSONALIZADAS del embudo (capa CRM visible; el motor no cambia).
export interface EtapaEmbudo {
  id: string;
  nombre: string;
  color: "brasa" | "tibio" | "calor" | "ok" | "frio";
  motor: "nuevo" | "nutriendo" | "escalado" | "ganado" | "perdido";
}
export const ETAPAS_DEFAULT: EtapaEmbudo[] = [
  { id: "nuevo", nombre: "Nuevos", color: "brasa", motor: "nuevo" },
  { id: "nutriendo", nombre: "En seguimiento", color: "tibio", motor: "nutriendo" },
  { id: "escalado", nombre: "Escalados", color: "calor", motor: "escalado" },
  { id: "ganado", nombre: "Ganados", color: "ok", motor: "ganado" },
  { id: "perdido", nombre: "Perdidos", color: "frio", motor: "perdido" },
];
// Etapa visible de un lead: su custom (si existe) o la mapeada desde el motor.
export function etapaVisibleDe(
  lead: { etapaEmbudo?: string | null; estado: string },
  etapas: EtapaEmbudo[],
): EtapaEmbudo {
  const porId = lead.etapaEmbudo ? etapas.find((e) => e.id === lead.etapaEmbudo) : undefined;
  if (porId) return porId;
  return etapas.find((e) => e.motor === lead.estado) ?? etapas[0];
}
// Etapas del negocio (del propio o de otro tenant del usuario, para la bandeja
// global). Nunca lanza: sin permiso o error responde las default.
export async function obtenerEtapas(tenant?: string): Promise<EtapaEmbudo[]> {
  try {
    const r = await api<{ etapasEmbudo?: EtapaEmbudo[] }>("/mi-plan", { tenant });
    return r?.etapasEmbudo?.length ? r.etapasEmbudo : ETAPAS_DEFAULT;
  } catch {
    return ETAPAS_DEFAULT;
  }
}
export async function guardarEtapas(etapas: EtapaEmbudo[]): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/mi-plan", { method: "PATCH", body: { etapasEmbudo: etapas } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export type EstadoLead = "nuevo" | "nutriendo" | "escalado" | "ganado" | "perdido";

export interface Lead {
  id: string;
  nombre: string | null;
  contactoExterno: string;
  canalOrigen: string;
  nivelInteres: NivelInteres;
  estado: EstadoLead;
  resumenIA: string | null;
  borradorIA: string | null;
  nota: string | null;
  origenEtiqueta: string | null; // de dónde vino (ej. "comentario")
  // Chatbot ON/OFF por conversación: true = el humano tomó este chat y la IA calla acá.
  botPausado?: boolean;
  // Etapa personalizada del embudo (id en las etapas del negocio) y asignación.
  etapaEmbudo?: string | null;
  asignadoA?: string | null;
  // Etiquetas libres del contacto (chips de la ficha).
  etiquetas?: string[];
  creadoEn: string;
  actualizadoEn: string;
}

/**
 * Reinicia la conversación de un lead (2026-08-20): borra los mensajes,
 * cancela los pedidos vivos y lo deja como si escribiera por primera vez.
 * Para PROBAR el bot con el propio número. Backend: POST /leads/:id/reiniciar.
 */
export async function reiniciarLead(
  id: string,
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/leads/${id}/reiniciar`, { method: "POST", tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo reiniciar" };
  }
}

// Edita datos manuales del lead: nombre y/o nota privada. Backend: PATCH /leads/:id.
export async function actualizarLead(
  id: string,
  cambios: { nombre?: string | null; nota?: string | null; etiquetas?: string[] },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/leads/${id}`, { method: "PATCH", body: cambios });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export interface Mensaje {
  id: string;
  direccion: "entrante" | "saliente";
  contenido: string;
  canal: string;
  creadoEn: string;
  // Estado del envío ('enviado' | 'fallido'): el panel marca los fallidos.
  estado?: string;
  origen?: string; // ia | ia_aprobada | ia_editada | humano | fija | sistema
}

export interface LeadDetalle extends Lead {
  mensajes: Mensaje[];
}

export interface Comision {
  id: string;
  estado: string;
  monto: number;
  leadId: string;
  creadoEn: string;
  // El backend incluye el lead (nombre para mostrar en Reportes).
  lead?: { id: string; nombre: string | null; canalOrigen?: string };
}

// Marca una comisión como cobrada (o cambia su estado). Backend: PATCH /comisiones/:id.
export async function actualizarComision(
  id: string,
  estado: "pendiente" | "pagada",
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/comisiones/${id}`, { method: "PATCH", body: { estado } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar" };
  }
}

export interface Resumen {
  leadsActivos: number;
  calientesSinAtender: number;
  ventasCerradas: number;
}

export async function listarLeads(
  filtros?: { estado?: string; nivel?: string },
): Promise<Lead[]> {
  // El backend pagina por cursor (máx 100 por página). Seguimos el cursor hasta
  // agotar para que el pipeline no se quede con solo la primera página (antes
  // mostraba máx 20 leads en total). Tope de seguridad: 20 páginas (2000 leads)
  // para no colgar el navegador si el volumen es enorme.
  const acumulado: Lead[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 20; pagina++) {
    const qs = new URLSearchParams();
    if (filtros?.estado) qs.set("estado", filtros.estado);
    if (filtros?.nivel) qs.set("nivel", filtros.nivel);
    qs.set("limit", "100");
    if (cursor) qs.set("cursor", cursor);
    const r: { items: Lead[]; siguienteCursor: string | null } = await api(
      `/leads?${qs.toString()}`,
    );
    acumulado.push(...r.items);
    if (!r.siguienteCursor) break;
    cursor = r.siguienteCursor;
  }
  return acumulado;
}

// Crea un lead a mano (contacto conocido en la calle / referido). Canal
// 'externo', origen 'manual'. `tenantId` (opcional): en la bandeja global el
// modal deja elegir a QUÉ negocio entra el lead sin cambiar la empresa activa.
export async function crearLeadManual(input: {
  nombre: string;
  contacto: string;
  nota?: string;
  tenantId?: string;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  const { tenantId, ...body } = input;
  try {
    const r = await api<{ id: string }>("/leads", { method: "POST", body, tenant: tenantId });
    return { ok: true, leadId: r.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el lead" };
  }
}

// ── Bandeja global (CRM unificado) ──────────────────────────
// Leads de TODOS los negocios del usuario en una lista (backend:
// GET /bandeja-global, identidad de plataforma — sin X-Tenant-Id). Cada lead
// trae su tenantId + negocioNombre para etiquetar la tarjeta y para que, al
// abrirlo, el panel cambie la empresa activa a la del lead.

export interface NegocioBandeja {
  tenantId: string;
  nombre: string;
}

export interface LeadGlobal extends Lead {
  tenantId: string;
  negocioNombre: string;
}

// Solo la lista de negocios de captación del usuario (sin traer leads):
// alimenta la barra de negocios del modo global y los pickers.
export async function negociosGlobal(): Promise<NegocioBandeja[]> {
  try {
    const r = await api<{ negocios: NegocioBandeja[] }>("/bandeja-global?limit=1", { conEmpresa: false });
    return r.negocios;
  } catch {
    return [];
  }
}

export async function listarBandejaGlobal(filtros?: {
  estado?: string;
  nivel?: string;
  tenantId?: string;
}): Promise<{ negocios: NegocioBandeja[]; leads: LeadGlobal[] }> {
  // Mismo esquema de paginación por cursor que `listarLeads` (máx 100 por
  // página, tope de seguridad de 20 páginas).
  const leads: LeadGlobal[] = [];
  let negocios: NegocioBandeja[] = [];
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 20; pagina++) {
    const qs = new URLSearchParams();
    if (filtros?.estado) qs.set("estado", filtros.estado);
    if (filtros?.nivel) qs.set("nivel", filtros.nivel);
    if (filtros?.tenantId) qs.set("tenantId", filtros.tenantId);
    qs.set("limit", "100");
    if (cursor) qs.set("cursor", cursor);
    const r: {
      negocios: NegocioBandeja[];
      items: LeadGlobal[];
      siguienteCursor: string | null;
    } = await api(`/bandeja-global?${qs.toString()}`, { conEmpresa: false });
    negocios = r.negocios;
    leads.push(...r.items);
    if (!r.siguienteCursor) break;
    cursor = r.siguienteCursor;
  }
  return { negocios, leads };
}

// Solo los últimos N leads (primera página) — para "Actividad reciente" del
// Inicio sin pagar el costo de paginar toda la bandeja.
export async function leadsRecientes(n = 5): Promise<Lead[]> {
  try {
    const r = await api<{ items: Lead[] }>(`/leads?limit=${Math.min(20, Math.max(1, n))}`);
    return r.items.slice(0, n);
  } catch {
    return [];
  }
}

export async function obtenerLead(id: string, tenant?: string): Promise<LeadDetalle | null> {
  try {
    return await api<LeadDetalle>(`/leads/${id}`, { tenant });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function accionLead(
  id: string,
  accion: {
    tipo:
      | "aprobar_borrador" | "marcar_ganado" | "descartar" | "responder" | "mover_etapa"
      // Rediseño 2026-08-04: toggle del chatbot por conversación + borrador a demanda.
      | "pausar_bot" | "activar_bot" | "sugerir_respuesta"
      // Buzón: tomar/soltar conversación.
      | "asignar"
      // Compositor: corregir el texto escrito (ortografía/tono) sin enviarlo.
      | "corregir_texto";
    texto?: string;
    monto?: number;
    // mover_etapa: mover a mano entre etapas abiertas (o reabrir un terminal).
    etapa?: "nuevo" | "nutriendo" | "escalado";
    // mover_etapa a una etapa PERSONALIZADA del negocio.
    etapaId?: string;
    // asignar: "yo" | usuarioId | null (soltar).
    asignarA?: string | null;
    // Tono del compositor (sugerir_respuesta / corregir_texto).
    tono?: "formal" | "cercano" | "directo" | "alegre";
  },
  tenant?: string,
): Promise<{ ok: boolean; error?: string; borrador?: string; texto?: string }> {
  try {
    const r = await api<{ ok: boolean; borrador?: string; texto?: string }>(
      `/leads/${id}/acciones`,
      { method: "POST", body: accion, tenant },
    );
    return { ok: true, borrador: r?.borrador, texto: r?.texto };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No se pudo completar la acción",
    };
  }
}

export async function obtenerComisiones(): Promise<{
  items: Comision[];
  resumen: Record<string, number>;
}> {
  return api<{ items: Comision[]; resumen: Record<string, number> }>(
    "/comisiones",
  );
}

export async function obtenerResumen(): Promise<Resumen> {
  return api<Resumen>("/resumen");
}

// ── Reportes de ventas ──────────────────────────────────────
/** Un escalón del embudo. `quedan` = cuántos LLEGARON hasta acá. */
export interface EscalonEmbudo {
  etapa: "escribieron" | "conversaron" | "atendidos" | "cerraron";
  titulo: string;
  quedan: number;
  seCayeron: number;  // cuántos no pasaron desde la etapa anterior
  pasaron: number;    // proporción 0..1 contra la etapa ANTERIOR, no contra el total
}

export interface ReporteNegocio {
  comisiones: { ganada: number; porCobrar: number; total: number };
  leadsPorNivel: Record<string, number>;
  cierre: { ganados: number; perdidos: number; enJuego: number; tasa: number };
  evolucion: { mes: string; comisiones: number; ventas: number }[];
  leadsPorOrigen: Record<string, number>; // de dónde vienen (ad:..., comentario, directo)
  embudo: EscalonEmbudo[];                // dónde se caen las ventas
}
export async function obtenerReporteNegocio(): Promise<ReporteNegocio | null> {
  try { return await api<ReporteNegocio>("/reportes/negocio"); } catch { return null; }
}

// Simula un lead entrante desde un anuncio (para probar el tracking sin Meta).
export async function simularLeadAd(campania: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/ads/simular-lead", { method: "POST", body: { campania, nombre: "Cliente de un ad" } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo simular" };
  }
}

export interface ReporteGlobalNegocio {
  tenantId: string; nombre: string; ganada: number; porCobrar: number; ventas: number;
}
export interface ReporteGlobal {
  totalGanada: number; totalPorCobrar: number; totalVentas: number;
  negocios: ReporteGlobalNegocio[];
}
export async function obtenerReporteGlobal(): Promise<ReporteGlobal | null> {
  // Cruza todos los negocios del usuario: sin empresa activa (conEmpresa:false).
  try { return await api<ReporteGlobal>("/reportes/global", { conEmpresa: false }); } catch { return null; }
}

export interface Alerta {
  tipo: "umbral" | "bloqueo";
  usado: number;
  limite: number;
  mensaje: string;
  ts: string;
}

// Avisos reales del backend: cuota por agotarse (umbral) o bot pausado por falta
// de saldo (bloqueo). Devuelve [] si no hay o si falla (no rompe la campana).
export async function obtenerAlertas(tenant?: string): Promise<Alerta[]> {
  try {
    return await api<Alerta[]>("/alertas", { tenant });
  } catch {
    return [];
  }
}

export interface Uso {
  plan: string;
  // Unidad REAL de cobro: clientes únicos atendidos por la IA este mes.
  clientes?: { usados: number; limite: number; restante: number };
  /**
   * Cupo de PEDIDOS del mes — solo en planes de restaurante.
   *
   * `null`/ausente = el plan no cuenta pedidos (captación: un contador de
   * pedidos ahí es ruido). `limite: 0` = ilimitado (plan Full).
   *
   * Opcional además de nullable: durante un deploy el backend viejo todavía no
   * manda el campo.
   */
  pedidos?: { usados: number; limite: number; restante: number } | null;
  bolsa: {
    mensual: { total: number; usado: number; restante: number };
    prepago: { total: number; restante: number };
    totalDisponible: number;
    seResetea: string; // fecha ISO del reseteo
  };
}

// Consumo del plan: cuántas "respuestas" (hits) le quedan al tenant activo.
export async function obtenerUso(): Promise<Uso | null> {
  try {
    return await api<Uso>("/uso");
  } catch {
    return null;
  }
}

export interface Catalogo {
  planes: Record<string, { hitsMes: number; maxCanales: number; precioCentavos: number }>;
  recargaDinamica: { minHits: number; tramos: { hastaHits: number; centavosPorHit: number }[] };
}

/**
 * EL REPORTE DE UN RESTAURANTE (2026-09-01).
 *
 * Distinto del de captación (`ReporteNegocio`), que resume leads y embudo de
 * ventas: un restaurante no tiene leads, tiene pedidos. Todo sale de pedidos
 * ENTREGADOS —la venta real, no la promesa— y con el día calendario de Perú.
 *
 * El backend ya lo servía desde julio en `GET /reportes/pedidos`; lo que
 * faltaba era la pantalla.
 */
export interface ReportePedidos {
  desde: string;
  hasta: string;
  totales: {
    pedidos: number;
    totalCentavos: number;
    ticketPromedioCentavos: number;
    cancelados: number;
    /** Preguntas que el bot no resolvió y contestó el dueño a mano. */
    preguntasAMano: number;
  };
  /** Dónde se caen las conversaciones: no es lo mismo perder gente eligiendo que al pagar. */
  embudo: { etapa: string; llegaron: number; siguieron: number }[];
  serie: { dia: string; pedidos: number; totalCentavos: number }[];
  topPlatos: { nombre: string; cantidad: number; totalCentavos: number }[];
  porModalidad: { modalidad: string; pedidos: number; totalCentavos: number }[];
}

export async function reportePedidos(
  preset: "hoy" | "semana" | "mes" = "semana",
): Promise<ReportePedidos | null> {
  try {
    return await api<ReportePedidos>(`/reportes/pedidos?preset=${preset}`);
  } catch {
    // `null` y no una excepción: la pantalla muestra su estado de error y el
    // resto del panel sigue andando.
    return null;
  }
}

export interface FeaturesPlan {
  ia: boolean;
  equipo: boolean;
  reportesAvanzados: boolean;
  nodosAvanzados: boolean;
  marketplace: boolean;
  maxFlujos: number;
  /**
   * El bloque de marketing: campañas, recompra automática, promos que el bot
   * ofrece solo y anuncios (2026-08-31). Es lo que trae el plan Full.
   *
   * Opcional a propósito: si el backend todavía no lo manda, `undefined` se
   * trata como "sí lo tiene" en las pantallas, y el corte real igual lo hace
   * el backend con un 402. Al revés —asumir que NO— le escondería la sección
   * a quien sí la paga cada vez que el panel salga antes que el backend.
   */
  marketing?: boolean;
}

export type RitmoSeguimiento = "suave" | "normal" | "insistente";

export interface MiPlan {
  plan: string;
  insistencia: "poca" | "normal" | "mucha";
  botActivo: boolean;
  iaActiva: boolean;
  ritmoSeguimiento: RitmoSeguimiento;
  comentariosActivo: boolean;
  comentariosMensaje: string;
  comisionTipo: "porcentaje" | "fijo";
  comisionValor: number;
  features: FeaturesPlan;
}

export async function obtenerCatalogo(): Promise<Catalogo | null> {
  try {
    return await api<Catalogo>("/catalogo", { conAuth: false, conEmpresa: false });
  } catch {
    return null;
  }
}

export async function obtenerMiPlan(): Promise<MiPlan | null> {
  try {
    return await api<MiPlan>("/mi-plan");
  } catch {
    return null;
  }
}

export async function guardarMiPlan(cfg: {
  insistencia?: "poca" | "normal" | "mucha";
  botActivo?: boolean;
  iaActiva?: boolean;
  ritmoSeguimiento?: RitmoSeguimiento;
  comentariosActivo?: boolean;
  comentariosMensaje?: string;
  comisionTipo?: "porcentaje" | "fijo";
  comisionValor?: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/mi-plan", { method: "PATCH", body: cfg });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export async function iniciarRecarga(
  hits: number,
  email: string,
  sourceId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/recargas", { method: "POST", body: { hits, email, sourceId } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo procesar el pago" };
  }
}

// ─── SUSCRIPCIÓN A UN PLAN (2026-08-18) ─────────────────────────────────────

export type Periodicidad = "mensual" | "anual";

export interface PlanDisponible {
  id: string;
  precioCentavos: number;
  pedidosMes: number;
  /**
   * El pago anual. OPCIONAL a propósito: durante un deploy el backend viejo
   * todavía no lo manda, y sin esto la pantalla del plan se cae entera.
   */
  anual?: {
    precioCentavos: number;
    ahorroCentavos: number;
    /** Lo que sale por mes pagando anual: el número con el que se compara. */
    equivalenteMensualCentavos: number;
    mesesGratis: number;
  };
  /**
   * Lo que cuesta CADA local extra en este plan, y el total con los que el
   * negocio ya tiene (2026-08-31).
   *
   * Sin esto el dueño de tres locales compara planes con un precio que no es
   * el que va a pagar, y se entera del real recién en el checkout.
   *
   * Opcionales: un backend viejo no los manda y ahí no se muestra el bloque de
   * locales — mejor eso que un "S/0 por local", que sería mentira.
   */
  porSedeExtraCentavos?: number;
  precioConSedesCentavos?: number;
}

/** El desglose de locales del negocio (2026-08-31). */
export interface SedesSuscripcion {
  /** Los que tiene activos hoy. */
  activas: number;
  /**
   * Los que se FACTURAN, que no es lo mismo: el primero va incluido y los que
   * ya tenía antes de que esto saliera quedan gratis para siempre.
   */
  cobrables: number;
  gratis: number;
  porSedeExtraCentavos: number;
}

export interface EstadoSuscripcion {
  plan: string;
  periodicidad: Periodicidad;
  /** 'activa' | 'en_gracia' | 'cancelada'. */
  estado: string;
  precioCentavos: number;
  vigenteHasta: string;
  fallaDesde: string | null;
  tarjetaUltimos4: string | null;
  tarjetaMarca: string | null;
  /** Cambio programado (2026-08-23): el plan al que pasa al cierre del ciclo. */
  planSiguiente?: string | null;
  periodicidadSiguiente?: Periodicidad | null;
}

export interface RespuestaSuscripcion {
  suscripcion: EstadoSuscripcion | null;
  /**
   * El plan vigente, venga de una suscripción con tarjeta o asignado a mano
   * (2026-08-20). `suscripcion` solo existe cuando alguien pagó por Culqi; los
   * planes que vendemos hablando viven en `Tenant.plan`, y sin este campo el
   * panel mostraba los tres planes sin marcar ninguno.
   *
   * Opcional: un backend viejo no lo manda y ahí se cae a `suscripcion.plan`.
   */
  planActual?: string | null;
  /** ¿Se cobra solo con tarjeta? Con `false` no hay renovación que cancelar. */
  cobroAutomatico?: boolean;
  disponibles: PlanDisponible[];
  /** Los locales del negocio y lo que suman. Opcional: backend viejo no lo manda. */
  sedes?: SedesSuscripcion;
  /** Sin esto el panel no puede tokenizar y no hay pago posible. */
  llavePublica: string | null;
}

export async function obtenerSuscripcion(): Promise<RespuestaSuscripcion | null> {
  try {
    return await api<RespuestaSuscripcion>("/suscripcion");
  } catch {
    return null;
  }
}

/**
 * Contrata un plan. El precio NO se manda: lo calcula el backend desde el
 * catálogo — quien pide el cobro no decide cuánto paga.
 */
export async function contratarPlan(datos: {
  plan: string;
  tokenId: string;
  email: string;
  nombre: string;
  periodicidad: Periodicidad;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/suscripcion", { method: "POST", body: datos });
    return { ok: true };
  } catch (e) {
    // El mensaje de Culqi es accionable ("Tarjeta sin fondos"): se muestra
    // tal cual en vez de un "ocurrió un error".
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo contratar el plan" };
  }
}

/**
 * Programa el cambio de plan para el CIERRE del ciclo (2026-08-23): no se
 * cobra nada hoy — la siguiente factura ya sale con el plan nuevo. No pide
 * tarjeta: la guardada sigue valiendo.
 */
export async function cambiarPlanProgramado(datos: {
  plan: string;
  periodicidad: Periodicidad;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/suscripcion/cambio-plan", { method: "POST", body: datos });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo programar el cambio" };
  }
}

export async function cancelarCambioPlan(): Promise<{ ok: boolean }> {
  try {
    await api("/suscripcion/cambio-plan", { method: "DELETE" });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function cancelarPlan(): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/suscripcion", { method: "DELETE" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo dar de baja" };
  }
}

export interface PagoSuscripcion {
  estado: string; // 'pagado' | 'fallido'
  montoCentavos: number;
  motivoFalla: string | null;
  creadoEn: string;
}

export async function historialPagos(): Promise<PagoSuscripcion[]> {
  try {
    const r = await api<{ pagos: PagoSuscripcion[] }>("/suscripcion/pagos");
    return r.pagos;
  } catch {
    return [];
  }
}

/** Cómo va la cocina ahora mismo, para el inicio de un restaurante. */
export interface ResumenPedidos {
  /** Pagados y esperando que la cocina los tome. */
  enCola: number;
  preparando: number;
  listos: number;
  enCamino: number;
  /** Vendido HOY, solo lo entregado. Céntimos. */
  hoyCentavos: number;
  hoyPedidos: number;
  /** Plata que anda en la calle o en una mesa: pedidos vivos que pagan al entregar. */
  efectivoPorCobrarCentavos?: number;
  efectivoPorCobrarPedidos?: number;
}

export async function resumenPedidos(): Promise<ResumenPedidos | null> {
  try {
    return await api<ResumenPedidos>("/pedidos-resumen");
  } catch {
    return null;
  }
}

// Lista las empresas del usuario EN VIVO desde el backend. La sesión cachea la
// lista del momento del login, así que un negocio nuevo (invitación, seed,
// creado en otro dispositivo) no aparecería sin este refresco.
export async function misEmpresas(): Promise<EmpresaResumen[]> {
  try {
    return await api<EmpresaResumen[]>("/empresas");
  } catch {
    return [];
  }
}

// Crea el primer negocio del usuario (onboarding). El backend crea la empresa y
// hace owner al usuario. Actualizamos la sesión local con la nueva empresa y la
// dejamos activa, para que el panel la use al entrar.
export async function crearEmpresa(nombre: string, rubro?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const empresa = await api<EmpresaResumen>("/empresas", { method: "POST", body: { nombre, rubro } });
    const sesion = leerSesion();
    if (sesion) {
      const yaEsta = sesion.empresas.some((e) => e.tenantId === empresa.tenantId);
      const empresas = yaEsta ? sesion.empresas : [...sesion.empresas, empresa];
      guardarSesion({ ...sesion, empresas });
      guardarEmpresaActiva(empresa.tenantId);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el negocio" };
  }
}

// Flujos: editor visual de bots con nodos y conexiones (Fase 4).
export type NodoFlujo = { id: string; tipo: string; pos: { x: number; y: number }; datos: Record<string, unknown> };
export type ConexionFlujo = { id: string; desde: string; hacia: string; puerto?: string };
export type GrafoFlujo = { nodos: NodoFlujo[]; conexiones: ConexionFlujo[] };
// `canal`: en qué red corre el flujo — null = todas (histórico) o una
// específica; al entrar un mensaje, el flujo del canal GANA al general.
export type CanalFlujo = "whatsapp" | "instagram" | "messenger" | "tiktok" | null;
export interface Flujo { id: string; nombre: string; activo: boolean; canal: CanalFlujo; grafo: GrafoFlujo }

export async function listarFlujos(tenant?: string): Promise<Flujo[]> {
  try { return await api<Flujo[]>("/flujos", { tenant }); } catch { return []; }
}

export async function obtenerFlujo(id: string): Promise<Flujo | null> {
  try { return await api<Flujo>(`/flujos/${id}`); } catch { return null; }
}

export async function crearFlujo(
  nombre: string, grafo: GrafoFlujo, tenant?: string,
): Promise<{ ok: boolean; flujo?: Flujo; error?: string }> {
  try {
    const flujo = await api<Flujo>("/flujos", { method: "POST", body: { nombre, grafo }, tenant });
    return { ok: true, flujo };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el flujo" }; }
}

export async function actualizarFlujo(
  id: string,
  cambios: { nombre?: string; activo?: boolean; grafo?: GrafoFlujo; canal?: CanalFlujo },
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/flujos/${id}`, { method: "PATCH", body: cambios, tenant });
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" }; }
}

export async function eliminarFlujo(id: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/flujos/${id}`, { method: "DELETE", tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

// ── Perfil de vendedor (marketplace) ───────────────────────
export interface Experiencia {
  cargo: string;
  lugar: string;
  desde: string;
  hasta: string;
}

export interface PerfilVendedor {
  nombre: string | null;
  bio: string;
  aniosExp: number;
  rubros: string[];
  fotoUrl: string;
  instagram: string;
  linkedin: string;
  whatsapp: string;
  telefono: string;
  email: string;
  ciudad: string;
  web: string;
  experiencia: Experiencia[];
  publico: boolean;
  ventasCerradas: number;
}

export async function miPerfilVendedor(): Promise<PerfilVendedor | null> {
  try { return await api<PerfilVendedor>("/vendedor/yo"); } catch { return null; }
}

export async function guardarPerfilVendedor(data: {
  bio: string; aniosExp: number; rubros: string[]; fotoUrl: string;
  instagram: string; linkedin: string; whatsapp: string;
  telefono: string; email: string; ciudad: string; web: string;
  experiencia: Experiencia[]; publico: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/vendedor/yo", { method: "PUT", body: data });
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" }; }
}

// Sube una foto de perfil (data URL base64) y devuelve la URL pública guardada.
export async function subirFotoVendedor(imagen: string): Promise<{ ok: boolean; fotoUrl?: string; error?: string }> {
  try {
    const r = await api<{ fotoUrl: string }>("/vendedor/foto", { method: "POST", body: { imagen } });
    return { ok: true, fotoUrl: r.fotoUrl };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir la foto" }; }
}

// ── Equipo (trabajadores del negocio) ──────────────────────
export type RolMiembro = "owner" | "admin" | "agente" | "mozo";
export interface MiembroEquipo { usuarioId: string; email: string; nombre: string | null; rol: RolMiembro }
export interface InvitacionPendiente { id: string; email: string; rol: RolMiembro; token: string; creadoEn: string }

export async function obtenerEquipo(tenant?: string): Promise<{ miembros: MiembroEquipo[]; invitaciones: InvitacionPendiente[] }> {
  try { return await api("/equipo", { tenant }); } catch { return { miembros: [], invitaciones: [] }; }
}

export async function invitarMiembro(email: string, rol: "admin" | "agente" | "mozo"): Promise<{ ok: boolean; token?: string; correoEnviado?: boolean; error?: string }> {
  try {
    const r = await api<{ ok: boolean; token: string; correoEnviado?: boolean }>("/equipo/invitar", { method: "POST", body: { email, rol } });
    return { ok: true, token: r.token, correoEnviado: r.correoEnviado };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo invitar" }; }
}

export async function cancelarInvitacion(id: string): Promise<{ ok: boolean }> {
  try { await api(`/equipo/invitacion/${id}`, { method: "DELETE" }); return { ok: true }; }
  catch { return { ok: false }; }
}

export async function quitarMiembro(usuarioId: string): Promise<{ ok: boolean; error?: string }> {
  try { await api(`/equipo/miembro/${usuarioId}`, { method: "DELETE" }); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo quitar" }; }
}

/**
 * QUÉ DICE ESTA INVITACIÓN, sin necesidad de tener cuenta (2026-08-21).
 *
 * Quien abre el link del correo puede no estar registrado —el caso normal de
 * un mozo—, así que esta consulta va SIN sesión. El backend devuelve lo
 * mínimo: a qué negocio, con qué rol y para qué correo.
 *
 * El correo importa: la invitación SOLO la acepta ese, y descubrirlo después
 * de crear la cuenta con otro es la peor forma de enterarse.
 */
export interface InvitacionAbierta {
  negocio: string;
  rol: RolMiembro;
  email: string;
}

export async function mirarInvitacion(
  token: string,
): Promise<{ ok: true; datos: InvitacionAbierta } | { ok: false; error: string }> {
  try {
    const r = await api<InvitacionAbierta>(`/equipo/invitacion/${encodeURIComponent(token)}`, {
      // Sin sesión ni empresa: es el punto de entrada de alguien que todavía
      // no tiene cuenta, y menos aún una empresa activa.
      conAuth: false,
      conEmpresa: false,
    });
    return { ok: true, datos: r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No pudimos leer la invitación" };
  }
}

export async function aceptarInvitacion(token: string): Promise<{ ok: boolean; tenantId?: string; error?: string }> {
  try {
    const r = await api<{ ok: boolean; tenantId: string }>("/equipo/aceptar", { method: "POST", body: { token } });
    return { ok: true, tenantId: r.tenantId };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo aceptar la invitación" }; }
}

// ── Entrenamiento por rubro (dataset para fine-tuning futuro) ─
export interface ProgresoRubro {
  rubro: string;
  ganados: number;
  perdidos: number;
  total: number;
  // Dataset estructurado (conversaciones completas) — el activo de fine-tuning.
  conversaciones: number;
  turnosProm: number;
  autoCerradas: number;
}

// Panel de super admin: sin empresa activa (conEmpresa:false), son datos de
// plataforma. El backend valida que el token sea de un super admin (403 si no).
export async function obtenerProgresoEntrenamiento(): Promise<ProgresoRubro[]> {
  try { return await api<ProgresoRubro[]>("/admin/entrenamiento", { conEmpresa: false }); }
  catch { return []; }
}

export interface MetricasPlataforma {
  negocios: number;
  negociosPorPlan: Record<string, number>;
  leads: { total: number; porNivel: Record<string, number>; porEstado: Record<string, number> };
  mensajes: number;
  ejemplosEntrenamiento: number;
}
export async function obtenerMetricasPlataforma(): Promise<MetricasPlataforma | null> {
  try { return await api<MetricasPlataforma>("/admin/metricas", { conEmpresa: false }); }
  catch { return null; }
}

export interface NegocioAdmin {
  id: string;
  nombre: string;
  plan: string;
  saldoPrepagoHits: number;
  leads: number;
  creadoEn: string;
}
export async function obtenerNegociosAdmin(): Promise<NegocioAdmin[]> {
  try { return await api<NegocioAdmin[]>("/admin/negocios", { conEmpresa: false }); }
  catch { return []; }
}

// ── Ventas y movimientos por restaurante (super admin, 2026-08-24) ──

export interface TramoVentas { pedidos: number; solesCentavos: number }

// Las señales de PUESTA EN MARCHA de un negocio: conectó WhatsApp, armó su
// carta, puede cobrar... El super admin distingue de un vistazo al que vende
// poco del que nunca arrancó.
export interface SenalesNegocio {
  whatsapp: boolean;
  platos: number;
  cartaWeb: boolean;
  pagos: boolean;
  mesas: number;
  redes: boolean;
}

/** `leadai` | `sania` | `fitcore`. Ver `productoDe` en el backend. */
export type ProductoDelNegocio = "leadai" | "sania" | "fitcore";

export interface VentasNegocioAdmin {
  tenantId: string;
  nombre: string;
  plan: string;
  hoy: TramoVentas;
  dias7: TramoVentas;
  dias30: TramoVentas;
  senales: SenalesNegocio;
  /**
   * De qué producto es este negocio (2026-08-27).
   *
   * Las clínicas con Sania tienen que existir como tenant —es la unidad del
   * bot— pero no son clientes del panel. Sin esto, sus pedidos y leads se
   * sumaban a los de LeadAI y el tablero contestaba otra pregunta.
   *
   * OPCIONAL A PROPÓSITO: un backend viejo no lo manda y la tabla tiene que
   * seguir funcionando; se asume `leadai`, que es no esconder a nadie.
   */
  producto?: ProductoDelNegocio;
}

export async function ventasAdmin(): Promise<VentasNegocioAdmin[]> {
  try {
    const r = await api<{ negocios: VentasNegocioAdmin[] }>("/admin/ventas", { conEmpresa: false });
    return r.negocios;
  } catch { return []; }
}

export interface MovimientosNegocioAdmin {
  tenantId: string;
  nombre: string;
  plan: string;
  resumen: { hoy: TramoVentas; dias7: TramoVentas; dias30: TramoVentas };
  porMetodo: { metodo: string; pedidos: number; solesCentavos: number }[];
  pedidos: {
    id: string;
    creadoEn: string;
    estado: string;
    pago: string;
    pagoMetodo: string | null;
    modalidad: string;
    mesa: string | null;
    canal: string;
    totalCentavos: number;
    items: string;
  }[];
  suscripcion: { plan: string; estado: string; vigenteHasta: string; planSiguiente: string | null } | null;
  recargas: { mensajesUltimos90: number; adsCentavosUltimos90: number };
  senales: SenalesNegocio;
}

export async function movimientosNegocioAdmin(id: string): Promise<MovimientosNegocioAdmin | null> {
  try {
    return await api<MovimientosNegocioAdmin>(`/admin/negocios/${id}/movimientos`, { conEmpresa: false });
  } catch { return null; }
}

// ── Simulador de chat (probar la IA desde el panel) ─────────
export interface RespuestaSimulador {
  nivelInteres: string;
  estado: string;
  mensajes: {
    direccion: "entrante" | "saliente";
    texto: string;
    botones?: { id: string; etiqueta: string }[];
  }[];
}

export async function simularMensaje(texto: string): Promise<RespuestaSimulador> {
  return api<RespuestaSimulador>("/simular-mensaje", { method: "POST", body: { texto } });
}

export async function resetSimulador(): Promise<{ ok: boolean }> {
  try { await api("/simular-reset", { method: "POST" }); return { ok: true }; }
  catch { return { ok: false }; }
}

// Trae la conversación de prueba ya existente (para no perderla al volver).
export async function obtenerHistorialSimulador(): Promise<RespuestaSimulador | null> {
  try { return await api<RespuestaSimulador>("/simular-historial"); } catch { return null; }
}

// ── Oportunidades (marketplace de referidos) ────────────────
export interface Oportunidad {
  id: string;
  rubro: string;
  titulo: string;
  descripcion: string;
  comision: string;
  zona: string;
  contacto: string;
  creadoEn: string;
  tomada: boolean;
}

export async function listarOportunidades(rubro?: string, tenant?: string): Promise<Oportunidad[]> {
  const qs = rubro ? `?rubro=${encodeURIComponent(rubro)}` : "";
  try { return await api<Oportunidad[]>(`/oportunidades${qs}`, { tenant }); } catch { return []; }
}

export async function tomarOportunidad(id: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/oportunidades/${id}/tomar`, { method: "POST", tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

export async function soltarOportunidad(id: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/oportunidades/${id}/tomar`, { method: "DELETE", tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

// Respuestas de un toque: las frases que la vendedora más usó (backend las
// aprende de su uso). Para reenviar sin escribir. [] si falla.
export async function obtenerFrasesRapidas(): Promise<{ id: string; texto: string }[]> {
  try { return await api<{ id: string; texto: string }[]>("/frases-rapidas"); }
  catch { return []; }
}

// ── Canales (redes conectadas) ──────────────────────────────
export type TipoCanal = "whatsapp" | "instagram" | "messenger" | "tiktok";

export interface Canal {
  id: string;
  tipo: TipoCanal;
  cuentaExterna: string;   // número / handle / id de la cuenta conectada
  nombre: string | null;
  activo: boolean;
  creadoEn: string;
  // Canal COMPARTIDO: ids de otros negocios del dueño que atienden por este
  // mismo número (vacío = dedicado a este negocio).
  compartirCon: string[];
  /**
   * DE QUÉ LOCAL ES ESTE NÚMERO (2026-08-25).
   *
   * `null` = de toda la cadena: el pedido que entre por acá no sabe de qué
   * local es hasta que se resuelva. Con un local puesto, el pedido nace ahí y
   * el bot responde siempre por este número.
   */
  sucursalId?: string | null;
}

// `tenant` opcional: Publicar (vista global) consulta las redes del negocio
// ENFOCADO sin cambiar la empresa activa.
/**
 * LAS CUENTAS QUE AUTORIZÓ Y TODAVÍA NO ELIGIÓ (2026-08-27, bug de Jonathan).
 *
 * Meta devuelve todas las páginas que administra. Con más de una no se guarda
 * ninguna: quedan pendientes 10 minutos para que él elija cuál conectar —
 * antes se guardaban TODAS y le comían el cupo de canales de su plan.
 */
export interface CuentaPendiente {
  cuentaExterna: string;
  nombre: string | null;
}

export async function cuentasPendientes(tipo: TipoCanal): Promise<CuentaPendiente[]> {
  try {
    const r = await api<{ cuentas: CuentaPendiente[] }>(`/canales/${tipo}/pendientes`);
    return r.cuentas;
  } catch {
    // Sin pendientes no hay nada que elegir: es el caso normal.
    return [];
  }
}

export async function elegirCuenta(
  tipo: TipoCanal,
  cuentaExterna: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/canales/${tipo}/elegir`, { method: "POST", body: { cuentaExterna } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo conectar" };
  }
}

export async function listarCanales(tenant?: string): Promise<Canal[]> {
  try { return await api<Canal[]>("/canales", { tenant }); } catch { return []; }
}

// URL de autorización OAuth para conectar una red (abre el popup de la red).
export async function obtenerUrlOAuth(tipo: TipoCanal): Promise<string | null> {
  try {
    const r = await api<{ url: string }>(`/canales/${tipo}/oauth/url`);
    return r.url;
  } catch { return null; }
}

// Activar/desactivar, renombrar o compartir un canal conectado.
export async function actualizarCanal(
  id: string,
  cambios: { activo?: boolean; nombre?: string; compartirCon?: string[]; sucursalId?: string | null },
): Promise<{ ok: boolean }> {
  try { await api(`/canales/${id}`, { method: "PATCH", body: cambios }); return { ok: true }; }
  catch { return { ok: false }; }
}

// Desconectar (eliminar) un canal. Las conversaciones y leads NO se borran:
// solo se quita la conexión con la red.
export async function eliminarCanal(id: string): Promise<{ ok: boolean }> {
  try { await api(`/canales/${id}`, { method: "DELETE" }); return { ok: true }; }
  catch { return { ok: false }; }
}

// ── Comentarios como leads (Fase 1 embudo) ──────────────────────
export interface Comentario {
  id: string;
  canal: string;
  postExterno: string;
  autorNombre: string | null;
  texto: string;
  intencion: string | null; // compra | halago | spam | otro
  respondido: boolean;
  respuestaTexto: string | null;
  dmAbierto: boolean;
  leadId: string | null;
  creadoEn: string;
}

export async function listarComentarios(tenant?: string): Promise<Comentario[]> {
  try {
    const r = await api<{ items: Comentario[] }>("/comentarios", { tenant });
    return r.items;
  } catch {
    return [];
  }
}

// Simula un comentario entrante (para probar el flujo sin Meta conectado).
export async function simularComentario(input: {
  texto: string;
  autorNombre?: string;
  tenant?: string;
}): Promise<{ ok: boolean; intencion?: string; respondido?: boolean; respuesta?: string; leadId?: string; error?: string }> {
  try {
    // Ids únicos por simulación (evita chocar con el unique de idempotencia).
    const n = `sim-${Math.random().toString(36).slice(2, 10)}`;
    const r = await api<{ procesado: boolean; intencion?: string; respondido?: boolean; respuesta?: string; leadId?: string }>(
      "/comentarios/simular",
      {
        method: "POST",
        tenant: input.tenant,
        body: {
          canal: "instagram",
          comentarioExterno: n,
          autorExterno: `user-${n}`,
          autorNombre: input.autorNombre,
          texto: input.texto,
        },
      },
    );
    return { ok: true, intencion: r.intencion, respondido: r.respondido, respuesta: r.respuesta, leadId: r.leadId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo simular" };
  }
}

// ── Publicador multi-red (Fase 2 embudo) ────────────────────────
export interface PublicacionDestino {
  id: string;
  canal: string;
  estado: string; // pendiente | publicada | fallida
  error?: string | null; // por qué falló (se muestra en el historial)
}
export interface Publicacion {
  id: string;
  texto: string;
  mediaUrls: string[];
  tipoMedia: string;
  estado: string; // borrador | programada | publicando | publicada | fallida
  programadaPara: string | null;
  creadoEn: string;
  destinos: PublicacionDestino[];
}
export interface PlantillaPost {
  titulo: string;
  prompt: string;
  // Texto listo para insertar y completar (sin IA — decisión 2026-08-26).
  ejemplo?: string;
}

// Paginado por cursor: `siguiente` = pasarlo como cursor para la próxima página.
export async function listarPublicaciones(
  tenant?: string, cursor?: string, limit = 10,
): Promise<{ items: Publicacion[]; siguiente: string | null }> {
  try {
    const q = `?limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    return await api<{ items: Publicacion[]; siguiente: string | null }>(`/publicaciones${q}`, { tenant });
  } catch {
    return { items: [], siguiente: null };
  }
}

export async function plantillasPost(tenant?: string): Promise<PlantillaPost[]> {
  try {
    const r = await api<{ plantillas: PlantillaPost[] }>("/publicaciones/plantillas", { tenant });
    return r.plantillas;
  } catch {
    return [];
  }
}

export async function sugerirCopyPost(idea: string, tenant?: string): Promise<string> {
  try {
    const r = await api<{ texto: string }>("/publicaciones/sugerir", { method: "POST", body: { idea }, tenant });
    return r.texto;
  } catch {
    return "";
  }
}

export async function subirMediaPost(
  imagen: string, tenant?: string,
): Promise<{ ok: boolean; url?: string; tipoMedia?: string; error?: string }> {
  try {
    const r = await api<{ url: string; tipoMedia?: string }>("/publicaciones/media", { method: "POST", body: { imagen }, tenant });
    return { ok: true, url: r.url, tipoMedia: r.tipoMedia };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo subir" };
  }
}

export async function crearPublicacion(input: {
  texto: string;
  mediaUrls?: string[];
  tipoMedia?: string;
  canales: string[];
  programadaPara?: string;
}, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/publicaciones", { method: "POST", body: input, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear" };
  }
}

// Borra una publicación del historial (el post ya publicado en la red no se toca).
export async function borrarPublicacion(id: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/publicaciones/${id}`, { method: "DELETE", tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

// ── Placas NFC de reseñas (2026-08-26) ──────────────────────────
export interface NegocioGooglePlaca {
  placeId: string;
  nombre: string;
  direccion: string;
}

export interface PlacaMia {
  uid: string;
  placeId: string | null;
  reviewUrl: string | null;
  estado: string; // libre | activa | bloqueada
  escaneos: number;
  activadaEn: string | null;
  porMes: Record<string, number>; // "2026-08" → escaneos
  // Radar de reseñas: foto al activar (base) y la última semanal (ultimo).
  resenas: {
    base: { rating: number | null; total: number; fecha: string };
    ultimo: { rating: number | null; total: number; fecha: string };
    ganadas: number;
  } | null;
}

// Negocios de Google para elegir al activar: por GPS (lat/lng) o texto (q).
export async function negociosParaPlaca(
  params: { lat?: number; lng?: number; q?: string }, tenant?: string,
): Promise<NegocioGooglePlaca[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.lat != null && params.lng != null) {
    qs.set("lat", String(params.lat));
    qs.set("lng", String(params.lng));
  }
  try {
    const r = await api<{ negocios: NegocioGooglePlaca[] }>(`/placas/cercanos?${qs}`, { tenant });
    return r.negocios;
  } catch { return []; }
}

export async function activarPlaca(
  input: { uid: string; pin: string; placeId: string }, tenant?: string,
): Promise<{ ok: boolean; reviewUrl?: string; marca?: string | null; error?: string }> {
  try {
    const r = await api<{ reviewUrl: string; marca?: string | null }>("/placas/activar", {
      method: "POST", body: input, tenant, conCookies: true,
    });
    return { ok: true, reviewUrl: r.reviewUrl, marca: r.marca ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo activar" };
  }
}

// ── Placas: operación del super admin (alta de lote, PINs) ──────
export interface PlacaAdmin {
  uid: string;
  estado: string;
  tipo?: string; // resenas | cobro | fidelidad | carta | acceso
  lote: string | null;
  marca: string | null;
  escaneos: number;
  activadaEn: string | null;
  creadoEn: string;
  tenant: { nombre: string } | null;
}

// Torre de control Norac (super admin): MRR real, cuentas, placas por marca
// y conexiones del ecosistema.
export interface ResumenNorac {
  mrr: {
    centavos: number;
    suscripciones: number;
    enGracia: number;
    porPlan: Record<string, { cuentas: number; centavos: number }>;
  };
  cuentas: { total: number; nuevas30d: number; porPlan: Record<string, number> };
  placas: Record<string, {
    total: number; activas: number; libres: number; bloqueadas: number;
    activadas30d: number; escaneos30d: number;
  }>;
  ecosistema: { conSania: number; conFitcore: number };
}

export async function adminResumenNorac(): Promise<ResumenNorac | null> {
  try { return await api("/admin/norac", { conEmpresa: false }); }
  catch { return null; }
}

export async function adminResumenPlacas(): Promise<{
  total: number; libres: number; activas: number; bloqueadas: number; placas: PlacaAdmin[];
} | null> {
  try { return await api("/admin/placas", { conEmpresa: false }); }
  catch { return null; }
}

export async function adminAltaLotePlacas(input: {
  uids: string[]; lote?: string; marca?: string;
  tipo?: "resenas" | "cobro" | "fidelidad" | "carta" | "acceso";
}): Promise<{ registradas: { uid: string; pin: string }[]; invalidas: string[]; yaExistian: string[] } | null> {
  try { return await api("/admin/placas/lote", { method: "POST", body: input, conEmpresa: false }); }
  catch { return null; }
}

export async function adminResetPinPlaca(uid: string): Promise<{ ok: boolean; pin?: string; error?: string }> {
  try {
    const r = await api<{ pin: string }>(`/admin/placas/${uid}/reset-pin`, { method: "POST", conEmpresa: false });
    return { ok: true, pin: r.pin };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo" }; }
}

export async function adminLiberarPlaca(uid: string): Promise<{ ok: boolean; pin?: string; error?: string }> {
  try {
    const r = await api<{ pin: string }>(`/admin/placas/${uid}/liberar`, { method: "POST", conEmpresa: false });
    return { ok: true, pin: r.pin };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo" }; }
}

export async function misPlacas(tenant?: string): Promise<PlacaMia[]> {
  try { return (await api<{ placas: PlacaMia[] }>("/placas", { tenant })).placas; }
  catch { return []; }
}

export async function cambiarDestinoPlaca(uid: string, placeId: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/placas/${uid}`, { method: "PATCH", body: { placeId }, tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

export async function bajaPlaca(uid: string, tenant?: string): Promise<{ ok: boolean }> {
  try { await api(`/placas/${uid}/baja`, { method: "POST", tenant }); return { ok: true }; }
  catch { return { ok: false }; }
}

// ── Fidelidad (placa de sellos, 2026-09-02) ─────────────────────
export interface ResumenFidelidad {
  config: { modo: "premio" | "paquete"; meta: number; premio?: string };
  totalClientes: number;
  cercaDelPremio: number;
  clientes: { telefono: string; nombre: string | null; sellos: number; ciclos: number; ultimoSelloEn: string | null }[];
  canjesPendientes: { codigo: string; creadoEn: string; cliente: { telefono: string; nombre: string | null } }[];
}

// null = el negocio no tiene fidelidad configurada (la pestaña lo explica).
export async function resumenFidelidad(tenant?: string): Promise<ResumenFidelidad | null> {
  try { return await api("/fidelidad", { tenant }); }
  catch { return null; }
}

export async function canjearCodigoFidelidad(codigo: string, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try { await api(`/fidelidad/canjes/${encodeURIComponent(codigo)}/canjear`, { method: "POST", tenant }); return { ok: true }; }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo canjear" }; }
}

// ── Acceso (placa de la puerta, 2026-09-02) ─────────────────────
export interface EventoAcceso {
  telefono: string;
  nombre: string | null;
  tipoPersona: string; // socio | personal | desconocido
  evento: string; // entrada | salida | rechazado
  detalle: string | null;
  creadoEn: string;
}

export async function registroAcceso(tenant?: string): Promise<EventoAcceso[] | null> {
  try { return (await api<{ eventos: EventoAcceso[] }>("/acceso-registro", { tenant })).eventos; }
  catch { return null; }
}

// Admin: asignar una placa registrada a un negocio, por tipo (cobro/fidelidad/carta/acceso).
export async function adminAsignarPlaca(
  uid: string, tipo: "cobro" | "fidelidad" | "carta" | "acceso", tenantId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const r = await api<{ url: string }>(`/admin/placas/${uid}/asignar-${tipo}`, {
      method: "POST", body: { tenantId }, conEmpresa: false,
    });
    return { ok: true, url: r.url };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo asignar" }; }
}

// Calcula la comisión sugerida para un monto de venta, según la config del
// negocio. Devuelve null si el negocio no configuró comisión.
export async function calcularComision(monto: number, tenant?: string): Promise<number | null> {
  try {
    const r = await api<{ comision: number | null }>(`/comisiones/calcular?monto=${monto}`, { tenant });
    return r.comision;
  } catch {
    return null;
  }
}

// ── Creador de Ads guiado (Fase 3B) ─────────────────────────────
export interface ObjetivoAd {
  id: string;
  pregunta: string;
  recomendado?: boolean;
  porque: string;
}
export interface PublicoAd {
  zona?: string;
  edadMin: number;
  edadMax: number;
  intereses: string[];
  nota?: string;
}
export interface RecomPresupuesto {
  diario: number;
  minimoOk: boolean;
  minimoSugeridoDiario: number;
  mensajesEstimados: { min: number; max: number };
  aviso: string;
}
export interface Anuncio {
  id: string;
  objetivo: string;
  campaniaNombre: string;
  texto: string;
  mediaUrl: string | null;
  presupuestoTotal: number;
  dias: number;
  estado: string;
  creadoEn: string;
}

export async function objetivosAd(tenant?: string): Promise<ObjetivoAd[]> {
  try { return (await api<{ objetivos: ObjetivoAd[] }>("/anuncios/objetivos", { tenant })).objetivos; } catch { return []; }
}
export async function publicoSugeridoAd(tenant?: string): Promise<PublicoAd | null> {
  try { return (await api<{ publico: PublicoAd }>("/anuncios/publico-sugerido", { tenant })).publico; } catch { return null; }
}
export async function presupuestoAd(total: number, dias: number, tenant?: string): Promise<RecomPresupuesto | null> {
  try { return await api<RecomPresupuesto>(`/anuncios/presupuesto?total=${total}&dias=${dias}`, { tenant }); } catch { return null; }
}
export async function sugerirTextoAd(idea: string, tenant?: string): Promise<string> {
  try { return (await api<{ texto: string }>("/anuncios/sugerir-texto", { method: "POST", body: { idea }, tenant })).texto; } catch { return ""; }
}
export async function listarAnuncios(tenant?: string): Promise<Anuncio[]> {
  try { return (await api<{ items: Anuncio[] }>("/anuncios", { tenant })).items; } catch { return []; }
}
export async function crearAnuncio(input: {
  objetivo: string;
  campaniaNombre: string;
  texto: string;
  mediaUrl?: string;
  publicacionId?: string;
  publico: { zona?: string; edadMin?: number; edadMax?: number; intereses?: string[] };
  presupuestoTotal: number;
  dias: number;
}, tenant?: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  try {
    const r = await api<{ anuncio: { id: string } }>("/anuncios", { method: "POST", body: input, tenant });
    return { ok: true, id: r.anuncio?.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el anuncio" };
  }
}

// Publicación REAL en Meta (Marketing API): crea la campaña completa en la
// cuenta publicitaria del negocio, todo EN PAUSA (el dueño la enciende desde
// su Ads Manager). El backend valida config y traduce los errores de Meta.
export async function publicarAnuncioMeta(
  id: string,
  tenant?: string,
  /**
   * `true` = el anuncio nace ENCENDIDO y empieza a gastar (2026-08-27).
   *
   * Por defecto queda en pausa: el gasto va a la tarjeta del dueño en su
   * cuenta de Meta, así que encenderlo tiene que ser una decisión suya.
   */
  encender = false,
): Promise<{ ok: boolean; aviso?: string; error?: string }> {
  try {
    const r = await api<{ aviso?: string }>(`/anuncios/${id}/publicar`, {
      method: "POST", body: { encender }, tenant,
    });
    return { ok: true, aviso: r.aviso };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo publicar el anuncio" };
  }
}

// ── Campañas HSM (envíos masivos de plantillas de WhatsApp) ──
// Los envíos NO consumen la cuota de clientes del plan; el peaje por mensaje
// lo cobra Meta directo al método de pago del negocio (su WABA, su tarjeta).

export interface PlantillaHSM {
  nombre: string;
  estado: string; // APPROVED | PENDING | REJECTED
  categoria: string;
  idioma: string;
  cuerpo: string;
  encabezadoTipo?: string; // '' | IMAGE | VIDEO | DOCUMENT
}
export interface CampaniaHSM {
  id: string;
  nombre: string;
  plantillaNombre: string;
  cuerpoVista: string;
  encabezadoTipo: string;
  encabezadoUrl: string;
  estado: string; // enviando | pausada | completada
  programadaPara: string | null;
  totalDestinatarios: number;
  enviados: number;
  fallidos: number;
  respondieron: number;
  creadoEn: string;
}
export interface CupoCampanias {
  usados: number; tope: number; restante: number; incluido: boolean;
  /** Modelo administrado (2026-08-23): los envíos pasan por LeadAI. */
  administrado?: boolean;
  /** Mensajes recargados (no vencen). */
  saldo?: number;
  /** Mensajes del bono del mes que quedan / lo que regala el plan. */
  bonoMensajes?: number;
  bonoMensajesPlan?: number;
}

export interface BolsaAnuncios {
  bonoCentavos: number;
  bonoPlanCentavos: number;
  saldoCentavos: number;
  disponiblesCentavos: number;
  periodo: string;
}

export async function bolsaAnuncios(tenant?: string): Promise<BolsaAnuncios | null> {
  try { return await api<BolsaAnuncios>("/anuncios/bolsa", { tenant }); } catch { return null; }
}

export async function listarPlantillasHSM(tenant?: string): Promise<{ ok: boolean; plantillas: PlantillaHSM[]; error?: string }> {
  try {
    const r = await api<{ plantillas: PlantillaHSM[] }>("/campanias/plantillas", { tenant });
    return { ok: true, plantillas: r.plantillas };
  } catch (e) {
    return { ok: false, plantillas: [], error: e instanceof Error ? e.message : "No se pudieron leer las plantillas" };
  }
}

export async function crearPlantillaHSM(input: {
  nombre: string;
  categoria: "MARKETING" | "UTILITY";
  cuerpo: string;
  encabezado?: { tipo: "IMAGE" | "VIDEO" | "DOCUMENT"; url: string };
}, tenant?: string): Promise<{ ok: boolean; aviso?: string; error?: string }> {
  try {
    const r = await api<{ aviso?: string }>("/campanias/plantillas", { method: "POST", body: input, tenant });
    return { ok: true, aviso: r.aviso };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear la plantilla" };
  }
}

export async function eliminarPlantillaHSM(nombre: string, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/campanias/plantillas/${encodeURIComponent(nombre)}`, { method: "DELETE", tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo borrar la plantilla" };
  }
}

export async function cupoCampanias(tenant?: string): Promise<CupoCampanias | null> {
  try { return await api<CupoCampanias>("/campanias/cupo", { tenant }); } catch { return null; }
}

/**
 * ¿La cuenta de WhatsApp del negocio ya tiene tarjeta registrada en Meta?
 *
 * EL NOMBRE DEL CAMPO IMPORTA (2026-08-24): esto leía `tienePago`, que el
 * backend NUNCA devolvió —manda `tieneMetodoPago`—, así que era siempre
 * `undefined` y el aviso "registrá tu tarjeta" se le habría mostrado a TODOS,
 * incluso a quien ya la tenía. Estaba tapado tras el flag de mensajería
 * administrada, así que nadie lo vio.
 *
 * `tieneMetodoPago` puede ser `null`: no se pudo determinar (Meta no
 * respondió, o la WABA no está conectada). Se distingue de `false` a
 * propósito — ver quién consume esto.
 */
export interface EstadoPagoCampanias {
  conectado: boolean;
  tieneMetodoPago: boolean | null;
  urlPagos: string;
}

export async function estadoPagoCampanias(tenant?: string): Promise<EstadoPagoCampanias | null> {
  try { return await api<EstadoPagoCampanias>("/campanias/estado-pago", { tenant }); } catch { return null; }
}

export async function listarCampanias(tenant?: string): Promise<CampaniaHSM[]> {
  try { return (await api<{ items: CampaniaHSM[] }>("/campanias", { tenant })).items; } catch { return []; }
}

export async function crearCampaniaHSM(input: {
  nombre: string;
  plantillaNombre: string;
  cuerpoVista?: string;
  encabezado?: { tipo: "IMAGE" | "VIDEO" | "DOCUMENT"; url: string };
  programadaPara?: string;
  contactos: { telefono: string; nombre?: string }[];
}, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/campanias", { method: "POST", body: input, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear la campaña" };
  }
}

export async function pausarCampania(id: string, reanudar: boolean, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/campanias/${id}/${reanudar ? "reanudar" : "pausar"}`, { method: "POST", tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cambiar el estado" };
  }
}

export { API_URL };

