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
function guardarEmpresaActiva(t) {
  const soporte = leerModoSoporte();
  if (soporte && t !== soporte.tenantId) return;
  localStorage.setItem(CLAVE_EMPRESA, t);
}
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
  localStorage.setItem(CLAVE_EMPRESA, tenantId);
  localStorage.setItem(CLAVE_SOPORTE, JSON.stringify({
    tenantId, nombre, volverA: yaEstaba ? yaEstaba.volverA : previa,
  }));
}
function tieneVariosNegocios() {
  if (leerModoSoporte()) return false;
  return (leerSesion()?.empresas.length ?? 0) > 1;
}
function empresasVisibles() {
  const soporte = leerModoSoporte();
  const propias = leerSesion()?.empresas ?? [];
  if (!soporte) return propias;
  return [{ tenantId: soporte.tenantId, nombre: soporte.nombre, rol: "admin" }];
}

function rolEnEmpresaActiva() {
  const sesion = leerSesion();
  if (!sesion) return undefined;
  const soporte = leerModoSoporte();
  if (soporte) return "admin";
  const activa = leerEmpresaActiva();
  const empresa = sesion.empresas?.find((e) => e.tenantId === activa) ?? sesion.empresas?.[0];
  return empresa?.rol;
}
function guardarSesion(sesion) {
  localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  if (sesion.empresas.length === 1 && !leerModoSoporte()) {
    guardarEmpresaActiva(sesion.empresas[0].tenantId);
  }
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
// Ya NO se puede cambiar la empresa por otro camino: `guardarEmpresaActiva`
// rechaza cualquier tenant que no sea el del soporte. Lo que se cuida acá es
// que el aviso y la empresa activa no puedan quedar diciendo cosas distintas.
guardarEmpresaActiva("t-mio");
ok(leerModoSoporte()?.tenantId === leerEmpresaActiva(),
   "el aviso y la empresa activa nunca se contradicen");
// Y si alguien borra la clave a mano (DevTools), el aviso se apaga solo en
// vez de mentir sobre dónde estás.
localStorage.setItem(CLAVE_EMPRESA, "t-mio");
ok(leerModoSoporte() === null, "sin la empresa del soporte, no avisa de más");

reset();
localStorage.setItem(CLAVE_SOPORTE, "{roto");
ok(leerModoSoporte() === null, "un dato corrupto no rompe el panel");

console.log("");
console.log("ADENTRO NO SE VE LO TUYO");
// El bug que reporto Jonathan: entro a Shiro y el panel le mostro "Tu
// operacion - Todos tus negocios" con SUS leads y SUS ventas. La vista global
// agrega las empresas de la SESION e ignora la empresa activa.
reset();
localStorage.setItem(CLAVE_SESION, JSON.stringify({ empresas: [
  { tenantId: "t-mio", nombre: "LeadAI" },
  { tenantId: "t-otro", nombre: "Contadora" },
] }));
guardarEmpresaActiva("t-mio");
ok(tieneVariosNegocios() === true, "con varios negocios propios, vista global");
entrarComoSoporte("t-shiro", "Shiro");
ok(tieneVariosNegocios() === false, "en soporte NO hay vista global: estas en UNO");
const v = empresasVisibles();
ok(v.length === 1 && v[0].tenantId === "t-shiro", "los chips solo ofrecen el negocio ajeno");
ok(!v.some((e) => e.tenantId === "t-mio"), "no podes saltar a lo TUYO desde adentro del ajeno");
ok(v[0].nombre === "Shiro", "el nombre es el del cliente, no el tuyo");
salirDeSoporte();
ok(tieneVariosNegocios() === true, "al salir vuelve tu vista global");
ok(empresasVisibles().length === 2, "y vuelven tus negocios");

console.log("");
console.log("EL ROL NO SALE DE TU OTRO NEGOCIO");
// Jonathan entro a Shiro (restaurante) y el menu le salio de captacion:
// rolEnEmpresaActiva caia a `empresas[0]` porque Shiro no esta en sus
// membresias, y le devolvia el rol de SU primer negocio.
reset();
localStorage.setItem(CLAVE_SESION, JSON.stringify({ empresas: [
  { tenantId: "t-mio", nombre: "LeadAI", rol: "owner" },
  { tenantId: "t-otro", nombre: "Contadora", rol: "vendedor" },
] }));
guardarEmpresaActiva("t-mio");
ok(rolEnEmpresaActiva() === "owner", "en lo tuyo, tu rol de siempre");
entrarComoSoporte("t-shiro", "Shiro");
ok(rolEnEmpresaActiva() === "admin", "en soporte el rol es admin, no el de TU negocio");
ok(rolEnEmpresaActiva() !== "owner", "y nunca owner: las decisiones del dueno son suyas");
salirDeSoporte();
ok(rolEnEmpresaActiva() === "owner", "al salir vuelve tu rol");

console.log("");
console.log("REFRESCAR LA SESION NO TE SACA DEL SOPORTE");
// refrescarSesion() corre en CADA carga del panel. Con un solo negocio propio
// pisaba la empresa activa y sacaba al super admin del negocio ajeno.
reset();
guardarSesion({ empresas: [{ tenantId: "t-unico", nombre: "Mio", rol: "owner" }] });
ok(leerEmpresaActiva() === "t-unico", "con un solo negocio queda activo");
entrarComoSoporte("t-shiro", "Shiro");
guardarSesion({ empresas: [{ tenantId: "t-unico", nombre: "Mio", rol: "owner" }] });
ok(leerEmpresaActiva() === "t-shiro", "el refresco NO te saca del negocio ajeno");

console.log("");
console.log("NADA TE SACA DEL NEGOCIO AJENO POR ATRAS");
// Jonathan: "primero carga bien, pone Carta, Cocina... pero luego cuando
// carga toda la data vuelve a aparecer todo lo de ventas". Media docena de
// pantallas "corrigen" la empresa activa al montar: si no la encuentran entre
// tus negocios la pisan con lista[0] — el tuyo. El primer render era correcto
// y el efecto lo deshacia.
reset();
localStorage.setItem(CLAVE_SESION, JSON.stringify({ empresas: [
  { tenantId: "t-mio", nombre: "LeadAI", rol: "owner" },
] }));
guardarEmpresaActiva("t-mio");
entrarComoSoporte("t-shiro", "Shiro");
ok(leerEmpresaActiva() === "t-shiro", "entraste a Shiro");
guardarEmpresaActiva("t-mio");
ok(leerEmpresaActiva() === "t-shiro", "un efecto NO te devuelve a tu negocio");
ok(leerModoSoporte()?.tenantId === "t-shiro", "y el modo soporte sigue en pie");
guardarEmpresaActiva("t-shiro");
ok(leerEmpresaActiva() === "t-shiro", "fijar el MISMO negocio ajeno si se permite");
salirDeSoporte();
ok(leerEmpresaActiva() === "t-mio", "y salir sigue devolviendote a lo tuyo");

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
