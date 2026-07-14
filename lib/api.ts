// Cliente HTTP al backend de LeadAI (repo `leadia`).
// Autenticación: token de usuario (Bearer) + header X-Tenant-Id para elegir la
// empresa activa. El token y la empresa se guardan en el navegador (ver auth.ts).

import { leerSesion, leerEmpresaActiva, guardarSesion, guardarEmpresaActiva, type EmpresaResumen } from "./auth";

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
}

// Llamada genérica al backend. Arma headers de auth y empresa, parsea el error
// del backend y lo levanta como ApiError con el status real.
export async function api<T>(ruta: string, opts: Opciones = {}): Promise<T> {
  const { method = "GET", body, conEmpresa = true, conAuth = true } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (conAuth) {
    const sesion = leerSesion();
    if (sesion?.token) headers.Authorization = `Bearer ${sesion.token}`;
  }
  if (conEmpresa) {
    const empresa = leerEmpresaActiva();
    if (empresa) headers["X-Tenant-Id"] = empresa;
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
  const qs = new URLSearchParams();
  if (filtros?.estado) qs.set("estado", filtros.estado);
  if (filtros?.nivel) qs.set("nivel", filtros.nivel);
  const q = qs.toString();
  const r = await api<{ items: Lead[]; siguienteCursor: string | null }>(
    `/leads${q ? `?${q}` : ""}`,
  );
  return r.items;
}

export async function obtenerLead(id: string): Promise<LeadDetalle | null> {
  try {
    return await api<LeadDetalle>(`/leads/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function accionLead(
  id: string,
  accion: {
    tipo: "aprobar_borrador" | "marcar_ganado" | "descartar" | "responder";
    texto?: string;
    monto?: number;
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/leads/${id}/acciones`, { method: "POST", body: accion });
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

export interface Alerta {
  tipo: "umbral" | "bloqueo";
  usado: number;
  limite: number;
  mensaje: string;
  ts: string;
}

// Avisos reales del backend: cuota por agotarse (umbral) o bot pausado por falta
// de saldo (bloqueo). Devuelve [] si no hay o si falla (no rompe la campana).
export async function obtenerAlertas(): Promise<Alerta[]> {
  try {
    return await api<Alerta[]>("/alertas");
  } catch {
    return [];
  }
}

export interface Uso {
  plan: string;
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

export interface MiPlan {
  plan: string;
  insistencia: "poca" | "normal" | "mucha";
  botActivo: boolean;
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
export interface Flujo { id: string; nombre: string; activo: boolean; grafo: GrafoFlujo }

export async function listarFlujos(): Promise<Flujo[]> {
  try { return await api<Flujo[]>("/flujos"); } catch { return []; }
}

export async function obtenerFlujo(id: string): Promise<Flujo | null> {
  try { return await api<Flujo>(`/flujos/${id}`); } catch { return null; }
}

export async function crearFlujo(
  nombre: string, grafo: GrafoFlujo,
): Promise<{ ok: boolean; flujo?: Flujo; error?: string }> {
  try {
    const flujo = await api<Flujo>("/flujos", { method: "POST", body: { nombre, grafo } });
    return { ok: true, flujo };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el flujo" }; }
}

export async function actualizarFlujo(
  id: string, cambios: { nombre?: string; activo?: boolean; grafo?: GrafoFlujo },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/flujos/${id}`, { method: "PATCH", body: cambios });
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" }; }
}

export async function eliminarFlujo(id: string): Promise<{ ok: boolean }> {
  try { await api(`/flujos/${id}`, { method: "DELETE" }); return { ok: true }; }
  catch { return { ok: false }; }
}

// ── Perfil de vendedor (marketplace) ───────────────────────
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
  publico: boolean;
  ventasCerradas: number;
}

export async function miPerfilVendedor(): Promise<PerfilVendedor | null> {
  try { return await api<PerfilVendedor>("/vendedor/yo"); } catch { return null; }
}

export async function guardarPerfilVendedor(data: {
  bio: string; aniosExp: number; rubros: string[]; fotoUrl: string;
  instagram: string; linkedin: string; whatsapp: string;
  telefono: string; email: string; ciudad: string; web: string; publico: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/vendedor/yo", { method: "PUT", body: data });
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" }; }
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
  mensajes: { direccion: "entrante" | "saliente"; texto: string }[];
}

export async function simularMensaje(texto: string): Promise<RespuestaSimulador> {
  return api<RespuestaSimulador>("/simular-mensaje", { method: "POST", body: { texto } });
}

export async function resetSimulador(): Promise<{ ok: boolean }> {
  try { await api("/simular-reset", { method: "POST" }); return { ok: true }; }
  catch { return { ok: false }; }
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

export async function listarOportunidades(rubro?: string): Promise<Oportunidad[]> {
  const qs = rubro ? `?rubro=${encodeURIComponent(rubro)}` : "";
  try { return await api<Oportunidad[]>(`/oportunidades${qs}`); } catch { return []; }
}

export async function tomarOportunidad(id: string): Promise<{ ok: boolean }> {
  try { await api(`/oportunidades/${id}/tomar`, { method: "POST" }); return { ok: true }; }
  catch { return { ok: false }; }
}

export async function soltarOportunidad(id: string): Promise<{ ok: boolean }> {
  try { await api(`/oportunidades/${id}/tomar`, { method: "DELETE" }); return { ok: true }; }
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

export { API_URL };
