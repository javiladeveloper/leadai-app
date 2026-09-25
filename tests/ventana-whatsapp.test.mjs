import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ventanaWhatsApp } from '../lib/ventana-whatsapp.ts';

/**
 * LA VENTANA DE CADA CHAT (2026-09-25): "necesito ver en cada chat cuál es su
 * ventana de tiempo… unos escriben directo, otros llegan por publicidad".
 */
const ahora = Date.parse('2026-09-25T15:00:00Z');
const wa = { canalOrigen: 'whatsapp', origenEtiqueta: null };

test('Edith escribió directo hace casi 3 días → cerrada, de 24 h', () => {
  const v = ventanaWhatsApp(wa, '2026-09-22T17:54:00Z', ahora);
  assert.equal(v.abierta, false);
  assert.equal(v.horas, 24);
  assert.equal(v.origen, 'escribió directo');
  assert.equal(v.cuando, 'se cerró hace 45 h');
});

test('Darwin escribió hace 30 min → abierta, quedan 23 h', () => {
  const v = ventanaWhatsApp(wa, '2026-09-25T14:30:00Z', ahora);
  assert.equal(v.abierta, true);
  assert.equal(v.cuando, 'quedan 23 h');
});

/**
 * EL ANUNCIO NO ALARGA LA VENTANA (2026-09-25): Edith llegó por un anuncio, el
 * chip decía "quedan 1 h" con 72 h, y lo que se le mandó no le llegó.
 */
test('quien llegó por un anuncio también tiene 24 h', () => {
  const v = ventanaWhatsApp({ ...wa, origenEtiqueta: 'ad:120' }, '2026-09-22T17:54:00Z', ahora);
  assert.equal(v.abierta, false);
  assert.equal(v.horas, 24);
  assert.equal(v.origen, 'llegó por un anuncio');
});

test('por cerrarse, en minutos', () => {
  assert.equal(ventanaWhatsApp(wa, '2026-09-24T15:20:00Z', ahora).cuando, 'quedan 20 min');
});

test('nunca escribió → cerrada; Instagram no aplica', () => {
  assert.equal(ventanaWhatsApp(wa, null, ahora).cuando, 'nunca te escribió');
  assert.equal(ventanaWhatsApp({ canalOrigen: 'instagram' }, null, ahora), null);
});
