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

// ── Panel unificado ─────────────────────────────────────────
// Decisión 2026-07-22 (iterada): ya NO hay "modo empresa" vs "modo global" —
// el panel es UNO solo. Con 2+ negocios, las bandejas cruzan todo y cada
// módulo filtra por negocio con sus propios chips; la "empresa activa" queda
// como mecanismo interno (la fijan los chips de las secciones por-negocio y
// los "clavados" a pantallas profundas). El centinela se conserva solo para
// que `api()` nunca lo mande como X-Tenant-Id si quedó guardado de una
// versión anterior.
export const EMPRESA_GLOBAL = "__global__";

// ¿El usuario maneja más de un negocio? Es LO que decide si el panel muestra
// bandejas cruzadas y chips de filtro (la vista unificada es la única vista).
export function tieneVariosNegocios(): boolean {
  return (leerSesion()?.empresas.length ?? 0) > 1;
}

// Compat: algunas pantallas viejas preguntaban por el "modo global". Hoy
// equivale a tener varios negocios.
export function esModoGlobal(): boolean {
  return tieneVariosNegocios();
}

// ¿El usuario logueado es super admin de la plataforma? Solo entonces se
// muestran paneles globales (Aprendizaje). La autorización REAL la hace el
// backend; esto es solo para no mostrar lo que igual daría 403.
export function esSuperAdmin(): boolean {
  return leerSesion()?.esSuperAdmin === true;
}
