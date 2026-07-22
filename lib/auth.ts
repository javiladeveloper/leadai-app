// Sesión del usuario en el navegador. El backend devuelve { token, usuario,
// empresas } en el login (email, o Google). Guardamos eso y la empresa activa
// (X-Tenant-Id) en localStorage. Sin backend de sesión: el token es stateless.

export interface EmpresaResumen {
  tenantId: string;
  nombre: string;
  rol: string;
}

export interface Sesion {
  token: string;
  usuario: { id: string; email: string; nombre: string | null };
  empresas: EmpresaResumen[];
  esSuperAdmin?: boolean; // dueño de la plataforma LeadAI (ve paneles globales)
}

const CLAVE_SESION = "leadai.sesion";
const CLAVE_EMPRESA = "leadai.empresa";

const esNavegador = () => typeof window !== "undefined";

export function guardarSesion(sesion: Sesion): void {
  if (!esNavegador()) return;
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  // Si hay una sola empresa, la dejamos activa por defecto.
  if (sesion.empresas.length === 1) {
    guardarEmpresaActiva(sesion.empresas[0].tenantId);
  }
}

export function leerSesion(): Sesion | null {
  if (!esNavegador()) return null;
  const raw = localStorage.getItem(CLAVE_SESION);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Sesion;
  } catch {
    return null;
  }
}

export function cerrarSesion(): void {
  if (!esNavegador()) return;
  localStorage.removeItem(CLAVE_SESION);
  localStorage.removeItem(CLAVE_EMPRESA);
}

export function guardarEmpresaActiva(tenantId: string): void {
  if (!esNavegador()) return;
  localStorage.setItem(CLAVE_EMPRESA, tenantId);
}

export function leerEmpresaActiva(): string | null {
  if (!esNavegador()) return null;
  return localStorage.getItem(CLAVE_EMPRESA);
}

export function haySesion(): boolean {
  return leerSesion() !== null;
}

// ── Modo global ─────────────────────────────────────────────
// "Vista global" es un MODO persistente (decisión 2026-07-22): el selector del
// header guarda este centinela como empresa activa y TODO el panel muestra los
// datos de todos los negocios de captación (bandejas cruzadas, secciones por
// empresa, picker en pantallas de configuración). Elegir una empresa real en
// el selector (o abrir un lead: "clavado") sale del modo. `api()` jamás manda
// el centinela como X-Tenant-Id (ver lib/api.ts).
export const EMPRESA_GLOBAL = "__global__";

export function esModoGlobal(): boolean {
  return leerEmpresaActiva() === EMPRESA_GLOBAL;
}

// ¿El usuario logueado es super admin de la plataforma? Solo entonces se
// muestran paneles globales (Aprendizaje). La autorización REAL la hace el
// backend; esto es solo para no mostrar lo que igual daría 403.
export function esSuperAdmin(): boolean {
  return leerSesion()?.esSuperAdmin === true;
}
