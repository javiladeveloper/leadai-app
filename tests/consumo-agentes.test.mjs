import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarNegocios, importePresupuesto, usdVisible } from '../lib/consumo-agentes.ts';

const negocios = [
  { id: 'dalu', nombre: 'DALU', producto: 'sania' },
  { id: 'dental', nombre: 'Clínica Dental', producto: 'sania' },
  { id: 'gym', nombre: 'Gym', producto: 'fitcore' },
  { id: 'ventas', nombre: 'Ventas', producto: 'leadai' },
  { id: 'viejo', nombre: 'Sin producto' },
];
test('separa agentes y filtra clínica ignorando acentos y mayúsculas', () => {
  assert.deepEqual(filtrarNegocios(negocios, 'sania', 'CLINICA').map(n => n.id), ['dental']);
  assert.deepEqual(filtrarNegocios(negocios, 'sania', '').map(n => n.id), ['dalu', 'dental']);
  assert.deepEqual(filtrarNegocios(negocios, 'fitcore', '').map(n => n.id), ['gym']);
  assert.deepEqual(filtrarNegocios(negocios, 'sin_clasificar', '').map(n => n.id), ['viejo']);
});
test('ausente y cero no son intercambiables', () => {
  assert.equal(importePresupuesto('', true), null);
  assert.equal(importePresupuesto('0', false), '0');
  assert.throws(() => importePresupuesto('', false));
});
test('conserva precisión y rechaza formatos que el backend no acepta', () => {
  assert.equal(importePresupuesto('999999999999.999999', false), '999999999999.999999');
  for (const valor of ['-1', '1e2', '1,25', '1.1234567', '1000000000000', 'NaN']) {
    assert.throws(() => importePresupuesto(valor, false));
  }
});
test('no convierte costo desconocido en gratis ni redondea un gasto pequeño a cero', () => {
  assert.equal(usdVisible(null), 'No calculable');
  assert.equal(usdVisible('0.000000000000'), 'USD 0');
  assert.equal(usdVisible('0.000000000123'), 'USD 0.000000000123');
});
