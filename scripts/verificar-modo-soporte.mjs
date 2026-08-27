// MODO SOPORTE: ENTRAR AL NEGOCIO DE OTRO (2026-08-27).
//
// El panel no tiene runner de tests, y esta lógica no puede quedar sin red:
// un error acá te deja mirando —o tocando— los datos de un cliente creyendo
// que son los tuyos, o te devuelve al negocio equivocado al salir.
//
// Corre con `node scripts/verificar-modo-soporte.mjs`. Replica el contrato de
// lib/auth.ts con un localStorage de mentira; si cambiás esas funciones,
// actualizá esta copia y volvé a correrlo.
//
// Verificado por mutación: pisar `volverA`, sacar el chequeo de que sigas en
// el negocio ajeno, y no restaurar la empresa al salir rompen tests distintos.
const store = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const CLAVE_EMPRESA = "leadai.empresa";
const CLAVE_SOPORTE = "leadai.soporte";
const CLAVE_SESION = "leadai.sesion";

const leerEmpresaActiva = () => localStorage.getItem(CLAVE_EMPRESA);
const guardarEmpresaActiva = (t) => localStorage.setItem(CLAVE_EMPRESA, t);
const leerSesion = () => { const r = localStorage.getItem(CLAVE_SESION); return r ? JSON.parse(r) : null; };

function leerModoSoporte() {
  const raw = localStorage.getItem(CLAVE_SOPORTE);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d?.tenantId && d.tenantId === leerEmpresaActiva()) return d;
    localStorage.removeItem(CLAVE_SOPORTE);
    return null;
  } catch { localStorage.removeItem(CLAVE_SOPORTE); return null; }
}
function entrarComoSoporte(tenantId, nombre) {
  const previa = leerEmpresaActiva();
  const yaEstaba = leerModoSoporte();
  localStorage.setItem(CLAVE_SOPORTE, JSON.stringify({
    tenantId, nombre, volverA: yaEstaba ? yaEstaba.volverA : previa,
  }));
  guardarEmpresaActiva(tenantId);
}
function salirDeSoporte() {
  const d = leerModoSoporte();
  localStorage.removeItem(CLAVE_SOPORTE);
  const propia = d?.volverA ?? leerSesion()?.empresas[0]?.tenantId ?? null;
  if (propia) guardarEmpresaActiva(propia);
}

let fallos = 0;
const ok = (cond, msg) => { if (!cond) { console.log("  ✗", msg); fallos++; } else console.log("  ✓", msg); };
const reset = () => { store.clear(); localStorage.setItem(CLAVE_SESION, JSON.stringify({ empresas: [{ tenantId: "t-mio" }] })); };

console.log("\nENTRAR Y SALIR");
reset(); guardarEmpresaActiva("t-mio");
entrarComoSoporte("t-ajeno", "Shiro");
ok(leerEmpresaActiva() === "t-ajeno", "entrar cambia la empresa activa");
ok(leerModoSoporte()?.nombre === "Shiro", "la barra sabe en qué negocio estás");
salirDeSoporte();
ok(leerEmpresaActiva() === "t-mio", "salir te devuelve a TU negocio");
ok(leerModoSoporte() === null, "salir apaga el aviso");

console.log("\nSALTAR DE UN NEGOCIO AJENO A OTRO");
reset(); guardarEmpresaActiva("t-mio");
entrarComoSoporte("t-a", "A");
entrarComoSoporte("t-b", "B");
ok(leerModoSoporte()?.nombre === "B", "el aviso nombra el último");
salirDeSoporte();
ok(leerEmpresaActiva() === "t-mio", "salir vuelve a lo TUYO, no al ajeno anterior");

console.log("\nSIN EMPRESA PREVIA (entraste directo por la ficha)");
reset();
entrarComoSoporte("t-ajeno", "Shiro");
salirDeSoporte();
ok(leerEmpresaActiva() === "t-mio", "cae a tu primera empresa, no queda sin empresa");

console.log("\nEL AVISO NO MIENTE");
reset(); guardarEmpresaActiva("t-mio");
entrarComoSoporte("t-ajeno", "Shiro");
guardarEmpresaActiva("t-mio");                    // cambiaste por otro camino
ok(leerModoSoporte() === null, "si ya no estás en el ajeno, no avisa de más");

reset();
localStorage.setItem(CLAVE_SOPORTE, "{roto");
ok(leerModoSoporte() === null, "un dato corrupto no rompe el panel");

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
