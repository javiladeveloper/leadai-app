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
