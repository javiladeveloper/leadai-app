// EL PREVIEW POR RED (2026-08-27).
//
// Jonathan: "un preview de como quedara en cada plataforma... cosa que el
// cliente lo vea antes". Si esto miente, es peor que no tenerlo: el dueno
// publica confiado y se entera despues.
//
// Corre con `node scripts/verificar-preview.mjs`.

const recortar = (t, max) => {
  const limpio = t.trim();
  return limpio.length <= max ? limpio : `${limpio.slice(0, max).trimEnd()}…`;
};

// Que red se muestra: la elegida, o la primera disponible si desmarco esa.
const NOMBRES = ["instagram", "messenger", "tiktok"];
const listaDe = (redes) => {
  const d = NOMBRES.filter((r) => redes.includes(r));
  return d.length > 0 ? d : ["instagram"];
};
const activaDe = (redes, ver) => {
  const lista = listaDe(redes);
  return lista.includes(ver) ? ver : lista[0];
};

let fallos = 0;
const ok = (c, m) => { if (!c) { console.log("  x", m); fallos++; } else console.log("  ok", m); };

console.log("\nQUE RED SE MUESTRA");
ok(listaDe(["tiktok"])[0] === "tiktok", "con una sola red elegida, se muestra esa");
ok(listaDe([])[0] === "instagram", "sin ninguna elegida, Instagram como referencia");
ok(listaDe(["tiktok", "instagram"]).length === 2, "con dos, se pueden ver las dos");
// El caso que importa: eligio TikTok, lo vio, y despues lo desmarco.
ok(
  activaDe(["instagram"], "tiktok") === "instagram",
  "si desmarca la red que estaba viendo, NO sigue mostrando esa",
);
ok(activaDe(["instagram", "tiktok"], "tiktok") === "tiktok", "y si sigue elegida, se queda ahi");

console.log("\nEL TEXTO SE CORTA DONDE LO CORTA CADA RED");
const largo = "a".repeat(300);
ok(recortar(largo, 125).length === 126, "Instagram corta a 125 + el puntito");
ok(recortar(largo, 160).endsWith("…"), "Facebook marca el corte con …");
ok(recortar(largo, 100).length === 101, "TikTok corta mas temprano: el texto va sobre el video");

console.log("\nUN TEXTO CORTO NO SE TOCA");
ok(recortar("Promo del dia", 125) === "Promo del dia", "no se le agrega … a lo que entra");
ok(!recortar("Promo", 125).includes("…"), "y no aparece el puntito de la nada");

console.log("\nBORDES");
ok(recortar("", 125) === "", "vacio queda vacio");
ok(recortar("   hola   ", 125) === "hola", "se recortan los espacios de los bordes");
// Exactamente en el limite NO se corta: cortar algo que entra seria mentir.
ok(recortar("a".repeat(125), 125) === "a".repeat(125), "justo en el limite no se corta");
ok(recortar("a".repeat(126), 125).endsWith("…"), "uno mas si se corta");

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
