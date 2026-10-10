// Acciones de sesión: login con Google (real) y login demo (para la reunión).

import { api } from "./api";
import { cerrarSesion, guardarSesion, type Sesion } from "./auth";
import { VENDEDORA } from "./demo";

// Manda el ID token de Google al backend y guarda la sesión resultante.
export async function entrarConGoogle(idToken: string): Promise<Sesion> {
  const sesion = await api<Sesion>("/auth/google", {
    method: "POST",
    body: { idToken },
    conAuth: false,
    conEmpresa: false,
  });
  guardarSesion(sesion);
  return sesion;
}

// Login por email+password (usuarios existentes).
export async function entrarConEmail(email: string, password: string): Promise<Sesion> {
  const sesion = await api<Sesion>("/auth/login", {
    method: "POST",
    body: { email, password },
    conAuth: false,
    conEmpresa: false,
  });
  guardarSesion(sesion);
  return sesion;
}

/**
 * ENTRAR CON EL ENLACE DE LA APP (2026-10-09). La app móvil pide un enlace de
 * un solo uso (dura 2 minutos) y abre `/entrar?enlace=<token>`; el backend lo
 * canjea por EXACTAMENTE la misma sesión que el login con contraseña, así que
 * se guarda con el mismo `guardarSesion`. Falla con ApiError 401 si venció o
 * ya se usó.
 */
export async function entrarConEnlace(token: string): Promise<Sesion> {
  const sesion = await api<Sesion>("/auth/enlace-web/canjear", {
    method: "POST",
    body: { token },
    conAuth: false,
    conEmpresa: false,
  });
  // Puede ser OTRA cuenta que la que estaba abierta en este navegador: se
  // suelta la anterior (y su empresa activa) antes de guardar la nueva.
  cerrarSesion();
  guardarSesion(sesion);
  return sesion;
}

// Sesión de demostración: no toca el backend. Sirve para mostrarle la app a
// Guisella cuando aún no está configurado el Client ID de Google. Marca la
// sesión como demo para que la capa de datos use los datos de demostración.
export function entrarDemo(): Sesion {
  const sesion: Sesion = {
    token: "demo",
    usuario: { id: "demo", email: "guisella@demo.leadai", nombre: VENDEDORA },
    empresas: [
      { tenantId: "e1", nombre: "Muebles Roble", rol: "vendedora" },
      { tenantId: "e2", nombre: "FitZone Suplementos", rol: "vendedora" },
    ],
  };
  guardarSesion(sesion);
  return sesion;
}

export function esDemo(token: string | undefined): boolean {
  return token === "demo";
}
