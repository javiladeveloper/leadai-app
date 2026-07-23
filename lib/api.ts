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
}

// Llamada genérica al backend. Arma headers de auth y empresa, parsea el error
// del backend y lo levanta como ApiError con el status real.
export async function api<T>(ruta: string, opts: Opciones = {}): Promise<T> {
  const { method = "GET", body, conEmpresa = true, conAuth = true, tenant } = opts;
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
    });
  } catch {
    throw new ApiError(0, "No pudimos conectar con el servidor. Revisá tu conexión.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? `Error ${res.status}`);
  }
  // 204 sin cuerpo
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// Conecta WhatsApp por Embedded Signup: manda el code (+ ids) del popup de Meta
// al backend, que hace el intercambio y registra el canal.
export async function conectarWhatsAppEmbedded(args: {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
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
  creadoEn: string;
  actualizadoEn: string;
}

// Edita datos manuales del lead: nombre y/o nota privada. Backend: PATCH /leads/:id.
export async function actualizarLead(
  id: string,
  cambios: { nombre?: string | null; nota?: string | null },
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
    tipo: "aprobar_borrador" | "marcar_ganado" | "descartar" | "responder" | "mover_etapa";
    texto?: string;
    monto?: number;
    // mover_etapa: mover a mano entre etapas abiertas (o reabrir un terminal).
    etapa?: "nuevo" | "nutriendo" | "escalado";
  },
  tenant?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/leads/${id}/acciones`, { method: "POST", body: accion, tenant });
    return { ok: true };
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
export interface ReporteNegocio {
  comisiones: { ganada: number; porCobrar: number; total: number };
  leadsPorNivel: Record<string, number>;
  cierre: { ganados: number; perdidos: number; enJuego: number; tasa: number };
  evolucion: { mes: string; comisiones: number; ventas: number }[];
  leadsPorOrigen: Record<string, number>; // de dónde vienen (ad:..., comentario, directo)
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

export interface FeaturesPlan {
  ia: boolean;
  equipo: boolean;
  reportesAvanzados: boolean;
  nodosAvanzados: boolean;
  marketplace: boolean;
  maxFlujos: number;
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
export type RolMiembro = "owner" | "admin" | "agente";
export interface MiembroEquipo { usuarioId: string; email: string; nombre: string | null; rol: RolMiembro }
export interface InvitacionPendiente { id: string; email: string; rol: RolMiembro; token: string; creadoEn: string }

export async function obtenerEquipo(): Promise<{ miembros: MiembroEquipo[]; invitaciones: InvitacionPendiente[] }> {
  try { return await api("/equipo"); } catch { return { miembros: [], invitaciones: [] }; }
}

export async function invitarMiembro(email: string, rol: "admin" | "agente"): Promise<{ ok: boolean; token?: string; correoEnviado?: boolean; error?: string }> {
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
}

export async function listarCanales(): Promise<Canal[]> {
  try { return await api<Canal[]>("/canales"); } catch { return []; }
}

// URL de autorización OAuth para conectar una red (abre el popup de la red).
export async function obtenerUrlOAuth(tipo: TipoCanal): Promise<string | null> {
  try {
    const r = await api<{ url: string }>(`/canales/${tipo}/oauth/url`);
    return r.url;
  } catch { return null; }
}

// Activar/desactivar o renombrar un canal conectado.
export async function actualizarCanal(
  id: string, cambios: { activo?: boolean; nombre?: string },
): Promise<{ ok: boolean }> {
  try { await api(`/canales/${id}`, { method: "PATCH", body: cambios }); return { ok: true }; }
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
}

export async function listarPublicaciones(tenant?: string): Promise<Publicacion[]> {
  try {
    const r = await api<{ items: Publicacion[] }>("/publicaciones", { tenant });
    return r.items;
  } catch {
    return [];
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
}, tenant?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/anuncios", { method: "POST", body: input, tenant });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el anuncio" };
  }
}

export { API_URL };
