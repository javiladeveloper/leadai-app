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
//
// EN SOPORTE SIEMPRE ES `false` (2026-08-27). Jonathan entró a Shiro y el
// panel le mostró "Tu operación · Todos tus negocios" con SUS leads y SUS
// ventas: la barra decía Shiro y los datos eran suyos. La vista global agrega
// las empresas de la SESIÓN e ignora la empresa activa, así que en soporte
// contesta la pregunta equivocada — y encima es la más peligrosa de todas,
// porque parece que estás viendo al cliente.
//
// Adentro de un negocio ajeno no hay "todos tus negocios": hay UNO.
export function tieneVariosNegocios(): boolean {
  if (leerModoSoporte()) return false;
  return (leerSesion()?.empresas.length ?? 0) > 1;
}

/**
 * LAS EMPRESAS QUE EL PANEL PUEDE MOSTRAR AHORA (2026-08-27).
 *
 * Normalmente son las tuyas. EN SOPORTE es solo el negocio ajeno en el que
 * estás: los chips de "elegí un negocio" leían la sesión directo, así que
 * adentro de Shiro te ofrecían saltar a TUS negocios — y las pantallas que
 * caen a `empresas[0]` te ponían el nombre de tu primer negocio encima de los
 * datos del cliente.
 *
 * Usalo en vez de `leerSesion()?.empresas` en cualquier pantalla que liste o
 * elija negocios.
 */
export function empresasVisibles(): EmpresaResumen[] {
  const soporte = leerModoSoporte();
  const propias = leerSesion()?.empresas ?? [];
  if (!soporte) return propias;
  // El nombre sale del modo soporte: el negocio ajeno NO está en tu sesión,
  // así que no hay de dónde sacarlo si no.
  // `admin` es el rol REAL con el que el backend te deja entrar: ni `owner`
  // (las decisiones del dueño son suyas) ni el rol que tengas en lo tuyo.
  return [{ tenantId: soporte.tenantId, nombre: soporte.nombre, rol: "admin" }];
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

// ── SOPORTE: ENTRAR A UN NEGOCIO AJENO (2026-08-27) ──
//
// Jonathan: "¿puedo entrar para ver qué están haciendo por si me piden
// soporte?". El backend ya lo permite —el super admin entra a cualquier
// negocio como `admin`, y cada entrada queda en el log— pero el panel elige
// la empresa activa entre TUS membresías, así que no había forma de llegar.
//
// SE GUARDA APARTE de la empresa activa, y esa es la decisión importante: si
// solo cambiáramos `leadai.empresa`, el panel entero se vería idéntico al
// tuyo y es facilísimo olvidarse de que estás dentro del negocio de otro —
// mirando datos de un cliente, o peor, tocando su configuración creyendo que
// es la tuya. Con esto la barra de aviso sabe que hay que avisar, y a dónde
// volver.
const CLAVE_SOPORTE = "leadai.soporte";

export interface ModoSoporte {
  tenantId: string;
  nombre: string;
  /** La empresa que era tuya antes de entrar: a dónde volvés al salir. */
  volverA: string | null;
}

export function entrarComoSoporte(tenantId: string, nombre: string): void {
  if (!esNavegador()) return;
  const previa = leerEmpresaActiva();
  // No se pisa el "volverA" si ya estabas en modo soporte y saltás a otro
  // negocio: te devolvería a un negocio ajeno en vez de al tuyo.
  const yaEstaba = leerModoSoporte();
  const dato: ModoSoporte = {
    tenantId,
    nombre,
    volverA: yaEstaba ? yaEstaba.volverA : previa,
  };
  localStorage.setItem(CLAVE_SOPORTE, JSON.stringify(dato));
  guardarEmpresaActiva(tenantId);
}

export function leerModoSoporte(): ModoSoporte | null {
  if (!esNavegador()) return null;
  const raw = localStorage.getItem(CLAVE_SOPORTE);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as ModoSoporte;
    // Si la empresa activa ya no es la del soporte (cambiaste de negocio por
    // otro camino), el modo dejó de aplicar: mejor no avisar de más.
    if (d?.tenantId && d.tenantId === leerEmpresaActiva()) return d;
    localStorage.removeItem(CLAVE_SOPORTE);
    return null;
  } catch {
    localStorage.removeItem(CLAVE_SOPORTE);
    return null;
  }
}

export function salirDeSoporte(): void {
  if (!esNavegador()) return;
  const d = leerModoSoporte();
  localStorage.removeItem(CLAVE_SOPORTE);
  // Volver a lo tuyo. Sin empresa previa (entraste directo por la ficha), se
  // cae a tu primera empresa: quedarse sin empresa activa rompe el panel.
  const propia = d?.volverA ?? leerSesion()?.empresas[0]?.tenantId ?? null;
  if (propia) guardarEmpresaActiva(propia);
}

/**
 * EL ROL DE ESTA PERSONA EN EL NEGOCIO ACTIVO (2026-08-21).
 *
 * Sale de la sesión guardada, no de una llamada: el menú se dibuja antes de
 * que cualquier request responda, y esperar haría parpadear las secciones.
 *
 * `undefined` cuando todavía no se sabe. Quien lo use debe tratar ese caso
 * como "sin restricción": el backend es el que manda —bloquea con 403 aunque
 * la UI falle—, así que equivocarse acá muestra de más, nunca de menos.
 */
export function rolEnEmpresaActiva(): string | undefined {
  const sesion = leerSesion();
  if (!sesion) return undefined;
  const activa = leerEmpresaActiva();
  const empresa = sesion.empresas?.find((e) => e.tenantId === activa) ?? sesion.empresas?.[0];
  return empresa?.rol;
}
