// UN SOLO FORMATO DE DINERO EN TODA LA WEB (2026-10-09, tanda "consistencia").
//
// Había doce `soles()` repartidos: unos con `toFixed(2)` ("S/1234.00"), otros
// con `toLocaleString("es-PE")` sin decimales ("S/1,234") y otros con
// decimales y separador ("S/1,234.00"). El mismo monto se leía distinto en
// Reportes, en la ficha y en Marketing, y eso parece un error de cuentas.
//
// El formato elegido es el del recibo peruano: `S/1,234.00` — separador de
// miles con coma, dos decimales con punto, sin espacio después de "S/".
//
// Se arma A MANO y no con `toLocaleString("es-PE")` a propósito: el resultado
// de Intl depende de la versión de ICU del navegador (y de Node en los
// tests), y un monto no puede verse distinto según quién lo abra.
//
// PURO: sin React, lo prueban los tests de node.

/** `1234.5` → `"1,234.50"`. Redondea a céntimos. */
export function montoConFormato(monto: number): string {
  if (!Number.isFinite(monto)) return "0.00";
  const negativo = monto < 0;
  const centavos = Math.round(Math.abs(monto) * 100);
  const enteros = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimales = (centavos % 100).toString().padStart(2, "0");
  return `${negativo ? "-" : ""}${enteros}.${decimales}`;
}

/** Un monto en SOLES (número con decimales): `1234.5` → `"S/1,234.50"`. */
export function soles(monto: number): string {
  const t = montoConFormato(monto);
  return t.startsWith("-") ? `-S/${t.slice(1)}` : `S/${t}`;
}

/** Un monto en CÉNTIMOS (como lo guarda el backend): `123450` → `"S/1,234.50"`. */
export function solesDeCentavos(centavos: number): string {
  return soles(centavos / 100);
}

/** Igual que `solesDeCentavos`, pero con "—" cuando no hay dato. */
export function solesOGuion(centavos: number | null | undefined): string {
  return centavos === null || centavos === undefined ? "—" : solesDeCentavos(centavos);
}
