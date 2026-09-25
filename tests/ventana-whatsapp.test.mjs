import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ventanaWhatsApp, variablesDe, rellenar } from '../lib/ventana-whatsapp.ts';

/**
 * LA VENTANA DE 24 H (2026-09-25, caso Edith): escribió hace 3 días y nada de
 * lo que se le mandó desde el panel llegó. El chat tiene que decirlo.
 */
const ahora = Date.parse('2026-09-25T15:00:00Z');
const wa = { canalOrigen: 'whatsapp', origenEtiqueta: null };

test('Edith: escribió hace 3 días → cerrada', () => {
  const v = ventanaWhatsApp(wa, '2026-09-22T17:54:00Z', ahora);
  assert.equal(v.abierta, false);
  assert.equal(v.desde, 'hace 2 días');
});

test('Darwin: escribió hoy → abierta', () => {
  assert.equal(ventanaWhatsApp(wa, '2026-09-25T14:32:00Z', ahora).abierta, true);
});

test('quien vino por un anuncio tiene 72 h', () => {
  const v = ventanaWhatsApp({ ...wa, origenEtiqueta: 'ad:120' }, '2026-09-23T15:00:00Z', ahora);
  assert.equal(v.abierta, true);
  assert.equal(v.horas, 72);
});

test('nunca escribió → cerrada; Instagram no aplica', () => {
  assert.equal(ventanaWhatsApp(wa, null, ahora).desde, 'nunca te escribió');
  assert.equal(ventanaWhatsApp({ canalOrigen: 'instagram' }, null, ahora), null);
});

test('las variables de la plantilla se cuentan y se rellenan', () => {
  const cuerpo = 'Hola {{1}}, te escribimos de {{2}}.';
  assert.equal(variablesDe(cuerpo), 2);
  assert.equal(variablesDe('Sin datos'), 0);
  assert.equal(rellenar(cuerpo, ['Edith', 'Sania']), 'Hola Edith, te escribimos de Sania.');
  assert.equal(rellenar(cuerpo, ['Edith']), 'Hola Edith, te escribimos de {{2}}.');
});
