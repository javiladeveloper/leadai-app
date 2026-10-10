import { test } from 'node:test';
import assert from 'node:assert/strict';
import { soles, solesDeCentavos, solesOGuion, montoConFormato } from '../lib/dinero.ts';

/** UN SOLO FORMATO DE DINERO (2026-10-09): `S/1,234.00` en toda la web. */

test('soles: separador de miles con coma y siempre dos decimales', () => {
  assert.equal(soles(1234), 'S/1,234.00');
  assert.equal(soles(0), 'S/0.00');
  assert.equal(soles(12.5), 'S/12.50');
  assert.equal(soles(1234567.891), 'S/1,234,567.89');
  assert.equal(soles(999.999), 'S/1,000.00');
});

test('céntimos (como los guarda el backend) se ven igual que los soles', () => {
  assert.equal(solesDeCentavos(123450), 'S/1,234.50');
  assert.equal(solesDeCentavos(5), 'S/0.05');
  assert.equal(solesDeCentavos(100), soles(1));
});

test('negativos y valores rotos no rompen el formato', () => {
  assert.equal(soles(-50), '-S/50.00');
  assert.equal(montoConFormato(Number.NaN), '0.00');
});

test('sin dato se muestra un guion, no S/0.00', () => {
  assert.equal(solesOGuion(null), '—');
  assert.equal(solesOGuion(undefined), '—');
  assert.equal(solesOGuion(0), 'S/0.00');
});
