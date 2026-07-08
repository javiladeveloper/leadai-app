// Cliente HTTP al backend de LeadAI (repo `leadia`).
// Autenticación: token de usuario (Bearer) + header X-Tenant-Id para elegir la
// empresa activa. El token y la empresa se guardan en el navegador (ver auth.ts).

import { leerSesion, leerEmpresaActiva } from "./auth";

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

export { API_URL };
