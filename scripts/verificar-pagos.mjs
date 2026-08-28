// CUANDO LE PAGAN AL NEGOCIO (2026-08-27).
//
// El panel no tiene runner de tests y esta derivacion decide como le cobra a
// sus clientes: un error acá pone a cobrar por adelantado a quien trabaja
// contra entrega, o al reves. Corre con `node scripts/verificar-pagos.mjs`.
//
// El "momento" NO es un campo nuevo: se DERIVA de aceptaEfectivo/Yape/Plin,
// que ya existian. Por eso importa que la ida y vuelta sea exacta.
//
// Verificado por mutacion: que "contra entrega" no apague Yape/Plin, y que se
// enciendan sin numero cargado, rompen tests distintos.
const momentoDe = (c) =>
  c.aceptaEfectivo && (c.aceptaYape || c.aceptaPlin) ? "ambos"
  : c.aceptaEfectivo ? "entrega" : "antes";

const flagsDe = (v, hayNumero) =>
  v === "entrega" ? { aceptaEfectivo: true,  aceptaYape: false,     aceptaPlin: false }
: v === "antes"   ? { aceptaEfectivo: false, aceptaYape: hayNumero, aceptaPlin: hayNumero }
:                   { aceptaEfectivo: true,  aceptaYape: hayNumero, aceptaPlin: hayNumero };

let fallos = 0;
const ok = (c, m) => { if (!c) { console.log("  x", m); fallos++; } else console.log("  ok", m); };

console.log("\nLEER LO QUE YA ESTA CONFIGURADO");
ok(momentoDe({aceptaEfectivo:false, aceptaYape:true,  aceptaPlin:true })  === "antes",   "solo Yape/Plin -> por adelantado");
ok(momentoDe({aceptaEfectivo:true,  aceptaYape:false, aceptaPlin:false }) === "entrega", "solo efectivo -> contra entrega");
ok(momentoDe({aceptaEfectivo:true,  aceptaYape:true,  aceptaPlin:true })  === "ambos",   "los tres -> las dos");
ok(momentoDe({aceptaEfectivo:true,  aceptaYape:true,  aceptaPlin:false }) === "ambos",   "efectivo + solo Yape -> las dos");
// El estado que hoy muestra el aviso raro: nada marcado.
ok(momentoDe({aceptaEfectivo:false, aceptaYape:false, aceptaPlin:false }) === "antes",   "nada marcado -> por adelantado (el bot nombra las dos)");

console.log("\nIDA Y VUELTA: elegir un momento y volver a leerlo");
for (const v of ["antes","entrega","ambos"]) {
  ok(momentoDe(flagsDe(v, true)) === v, `con numero, "${v}" se relee igual`);
}

console.log("\nSIN NUMERO CARGADO");
// Sin numero no se encienden Yape/Plin: el bot mandaria a pagar a un Yape
// que no existe (paso con la carta de Shiro).
const sinNum = flagsDe("antes", false);
ok(sinNum.aceptaYape === false && sinNum.aceptaPlin === false, "por adelantado sin numero NO enciende Yape/Plin");
ok(momentoDe(sinNum) === "antes", "y sigue leyendose como por adelantado");
const ambosSinNum = flagsDe("ambos", false);
ok(ambosSinNum.aceptaEfectivo === true, "\"las dos\" sin numero conserva el efectivo");

console.log("\nCONTRA ENTREGA NO PREGUNTA POR EL MEDIO");
const e = flagsDe("entrega", true);
ok(e.aceptaYape === false && e.aceptaPlin === false, "apaga Yape y Plin aunque haya numero");
ok(e.aceptaEfectivo === true, "y deja el cobro al entregar encendido");

console.log(fallos === 0 ? "\nTODO OK\n" : `\n${fallos} FALLOS\n`);
process.exit(fallos ? 1 : 0);
