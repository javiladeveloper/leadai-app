import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mezclarPaginaReciente, agregarPaginaVieja, separadorDeDia, horaDe } from '../lib/bandeja-rapida.ts';

/** LA BANDEJA RÁPIDA (2026-09-25): "que cargue más rápido los mensajes". */
const l = (id, v = 0) => ({ id, v });

test('la página fresca va arriba y reemplaza su versión vieja', () => {
  const actuales = [l('a'), l('b'), l('c'), l('d')];
  const r = mezclarPaginaReciente(actuales, [l('c', 1), l('a', 1)]);
  assert.deepEqual(r.map((x) => `${x.id}${x.v}`), ['c1', 'a1', 'b0', 'd0']);
});

test('una página vieja se suma al final sin duplicar', () => {
  assert.deepEqual(agregarPaginaVieja([l('a'), l('b')], [l('b'), l('c')]).map((x) => x.id), ['a', 'b', 'c']);
});

const ahora = new Date('2026-09-25T20:00:00Z'); // 15:00 en Lima

test('separador: Hoy, Ayer o el día con nombre, en hora de Lima', () => {
  assert.equal(separadorDeDia('2026-09-25T14:00:00Z', undefined, ahora), 'Hoy');
  assert.equal(separadorDeDia('2026-09-24T20:00:00Z', undefined, ahora), 'Ayer');
  assert.equal(separadorDeDia('2026-09-22T17:00:00Z', undefined, ahora), 'martes 22 set');
  // 02:00 UTC del 25 son las 21:00 del 24 en Lima: todavía es "Ayer".
  assert.equal(separadorDeDia('2026-09-25T02:00:00Z', undefined, ahora), 'Ayer');
});

test('dentro del mismo día no se repite el separador', () => {
  assert.equal(separadorDeDia('2026-09-25T15:00:00Z', '2026-09-25T14:00:00Z', ahora), null);
  assert.equal(separadorDeDia('2026-09-25T15:00:00Z', '2026-09-24T14:00:00Z', ahora), 'Hoy');
});

test('la hora de cada mensaje en Lima', () => {
  assert.equal(horaDe('2026-09-25T19:05:00Z'), '14:05');
});
