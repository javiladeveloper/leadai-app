// Acciones de sesión: login con Google (real) y login demo (para la reunión).

import { api } from "./api";
import { guardarSesion, type Sesion } from "./auth";
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
