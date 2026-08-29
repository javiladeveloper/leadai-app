// EL DIAGNOSTICO DE PRESENCIA (2026-08-27).
//
// Jonathan: "los usuarios muchas veces desconocen como ganar presencia
// digital... no saben nada de esto". Por eso la pantalla no es un formulario
// sino un diagnostico: dice QUE LE FALTA y en que enfocarse hoy.
//
// Si esto se equivoca, le dice a un negocio que ya esta en Google que le
// falta —o peor, le da por listo algo que no hizo y nunca lo configura.
//
// Corre con `node scripts/verificar-presencia.mjs`.

const pasosDe = (c) => [
  { id: "google",  listo: (c.googleReviewUrl ?? "").trim().length > 0 },
  { id: "resenas", listo: (c.googleReviewUrl ?? "").trim().length > 0 },
  { id: "carta",   listo: Boolean((c.slug ?? "").trim()) },
  { id: "redes",   listo: Boolean((c.instagramUrl ?? "").trim() || (c.facebookUrl ?? "").trim()) },
  { id: "medir",   listo: Boolean((c.metaPixelId ?? "").trim() || (c.googleAnalyticsId ?? "").trim()) },
];
const hechos = (c) => pasosDe(c).filter((p) => p.listo).length;
const siguiente = (c) => pasosDe(c).find((p) => !p.listo)?.id ?? null;

let fallos = 0;
const ok = (cond, m) => { if (!cond) { console.log("  x", m); fallos++; } else console.log("  ok", m); };

console.log("\nUN NEGOCIO QUE RECIEN EMPIEZA");
const nuevo = {};
ok(hechos(nuevo) === 0, "no tiene nada hecho");
ok(siguiente(nuevo) === "google", "lo primero es que lo encuentren en Google");

console.log("\nCON GOOGLE CONECTADO");
const conGoogle = { googleReviewUrl: "https://g.page/r/CQabc/review" };
ok(hechos(conGoogle) === 2, "cuentan DOS pasos: estar en Maps y juntar resenas");
ok(siguiente(conGoogle) === "carta", "lo siguiente es el link para compartir");

console.log("\nEL ORDEN NO SE SALTEA A MEDIR");
// Medir es lo ULTIMO a proposito: solo sirve si ya paga anuncios, y un dueno
// que no pauta no tiene que sentir que le falta algo.
const casi = { googleReviewUrl: "https://g.page/r/x", slug: "shiro", instagramUrl: "https://ig.com/x" };
ok(siguiente(casi) === "medir", "medir aparece solo cuando lo demas esta hecho");
ok(hechos(casi) === 4, "4 de 5 sin pixel: no le falta nada importante");

console.log("\nTODO LISTO");
const todo = { ...casi, metaPixelId: "1234567890123" };
ok(hechos(todo) === 5, "los cinco pasos");
ok(siguiente(todo) === null, "no hay nada pendiente que mostrar");

console.log("\nLO QUE NO CUENTA COMO HECHO");
ok(hechos({ googleReviewUrl: "   " }) === 0, "un link de espacios no es estar en Google");
ok(hechos({ slug: "" }) === 0, "un slug vacio no es tener carta");
ok(hechos({ instagramUrl: null, facebookUrl: null }) === 0, "sin redes no cuenta");
// Con UNA red alcanza: pedirle las dos seria inventar un requisito.
ok(hechos({ facebookUrl: "https://fb.com/x" }) === 1, "con Facebook solo ya cuenta");

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
