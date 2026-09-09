import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenImportacion, esArchivoDeCarta } from '../lib/importar-carta.ts';

/**
 * IMPORTAR LA CARTA DESDE LA SECCIÓN CARTA (2026-09-09).
 *
 * Jonathan: "en carta puede haber una sección extraer de pdf carta?". Existía
 * SOLO en el onboarding: el dueño que se saltó ese paso, o que quiere
 * reimportar después de cambiar su carta, no tenía cómo — le quedaba cargar
 * plato por plato a mano.
 *
 * El backend ya saltea por nombre los que existen (`/carta/importar` en modo
 * "agregar"), así que reimportar NO pisa precios ni fotos ajustadas a mano.
 * Lo que faltaba es la puerta, y DECIR qué pasó: "creados 12, salteados 39"
 * en crudo no le dice nada a nadie.
 */

test('cuenta lo que entró y lo que ya estaba, en español', () => {
  assert.equal(
    resumenImportacion({ creados: 12, salteados: 0, secciones: 3 }),
    '12 platos nuevos en 3 secciones.',
  );
});

test('avisa de los repetidos sin que parezca un error', () => {
  // Reimportar la misma carta es NORMAL (el dueño la actualizó y sube todo de
  // nuevo): que 39 no entren no es un fallo, es la protección funcionando.
  assert.equal(
    resumenImportacion({ creados: 12, salteados: 39, secciones: 2 }),
    '12 platos nuevos en 2 secciones. Otros 39 ya estaban en tu carta.',
  );
});

test('cuando no entró NADA lo dice claro, sin celebrar', () => {
  // El peor mensaje posible acá sería "¡Listo!" sobre cero platos.
  assert.equal(
    resumenImportacion({ creados: 0, salteados: 51, secciones: 0 }),
    'Tu carta ya estaba al día: los 51 platos del archivo ya existían.',
  );
});

test('singulares: un plato no es "1 platos"', () => {
  assert.equal(
    resumenImportacion({ creados: 1, salteados: 1, secciones: 1 }),
    '1 plato nuevo en 1 sección. Otro más ya estaba en tu carta.',
  );
});

test('sin secciones nuevas no inventa el "en N secciones"', () => {
  assert.equal(
    resumenImportacion({ creados: 5, salteados: 0, secciones: 0 }),
    '5 platos nuevos.',
  );
});

test('acepta los formatos que el backend sabe leer', () => {
  for (const n of ['carta.pdf', 'CARTA.PDF', 'menu.jpg', 'foto.jpeg', 'x.png', 'y.webp', 'lista.xlsx', 'viejo.xls']) {
    assert.equal(esArchivoDeCarta(n), true, n);
  }
});

test('rechaza lo que no sabe leer, antes de gastar una llamada de visión', () => {
  for (const n of ['carta.docx', 'notas.txt', 'video.mp4', 'carta.pages', 'sin-extension']) {
    assert.equal(esArchivoDeCarta(n), false, n);
  }
});

/**
 * ESTÁ CABLEADO (no basta con que el componente exista).
 *
 * La lección del velo: un componente probado pero sin montar por nadie se ve
 * idéntico a uno funcionando. Ya pasó dos veces en este proyecto.
 */
test('la sección Carta monta el importador, en el vacío y como botón', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../app/(panel)/carta/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /import \{ ImportarCarta \}/, 'no está importado');
  // El camino principal cuando no hay platos...
  assert.match(src, /<ImportarCarta variante="vacio"/, 'falta en el estado vacío');
  // ...y el botón para reimportar sobre una carta que ya tiene platos.
  assert.match(src, /<ImportarCarta alTerminar=\{recargar\}/, 'falta el botón junto a "Nuevo plato"');
});

test('al terminar recarga la carta: decir "12 platos nuevos" sobre una lista vacía es el peor final', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/ImportarCarta.tsx', import.meta.url), 'utf8');
  assert.match(src, /await alTerminar\(\)/);
});

test('importa en modo "agregar": reimportar no puede pisar precios ni fotos a mano', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/ImportarCarta.tsx', import.meta.url), 'utf8');
  assert.match(src, /importarCarta\([^)]*"agregar"\)/);
  assert.doesNotMatch(src, /"reemplazar"/);
});
