import { test } from 'node:test';
import assert from 'node:assert/strict';
import { etapaVisibleDe, normalizarEtapas, ETAPAS_DEFAULT, NOMBRE_ESCALADO } from '../lib/etapas.ts';

/** LAS ETAPAS DEL NEGOCIO, IGUALES EN SEGUIMIENTO Y CONVERSACIONES (2026-10-09). */

const delBackend = [
  { id: 'nuevo', nombre: 'Nuevos', color: 'brasa', motor: 'nuevo' },
  { id: 'nutriendo', nombre: 'En seguimiento', color: 'tibio', motor: 'nutriendo' },
  { id: 'escalado', nombre: 'Escalados', color: 'calor', motor: 'escalado' },
  { id: 'agendado', nombre: 'Agendó demo', color: 'calor', motor: 'escalado' },
  { id: 'demo-hecha', nombre: 'Demo hecha', color: 'tibio', motor: 'escalado' },
  { id: 'ganado', nombre: 'Ganados (pagó)', color: 'ok', motor: 'ganado' },
  { id: 'perdido', nombre: 'Perdidos', color: 'frio', motor: 'perdido' },
];

test('escalado se llama "Para atender" en toda la web', () => {
  assert.equal(ETAPAS_DEFAULT.find((e) => e.id === 'escalado').nombre, NOMBRE_ESCALADO);
  const n = normalizarEtapas(delBackend);
  assert.equal(n.find((e) => e.id === 'escalado').nombre, 'Para atender');
});

test('"Ganados (pagó)" del default se lee "Ganados": pagar se marca aparte', () => {
  assert.equal(normalizarEtapas(delBackend).find((e) => e.id === 'ganado').nombre, 'Ganados');
});

test('lo que el dueño renombró a mano se respeta', () => {
  const propias = [{ id: 'escalado', nombre: 'Lo llamo yo', color: 'calor', motor: 'escalado' }];
  assert.equal(normalizarEtapas(propias)[0].nombre, 'Lo llamo yo');
});

test('la etapa propia vale mientras coincida con el estado del lead', () => {
  assert.equal(etapaVisibleDe({ etapaEmbudo: 'demo-hecha', estado: 'escalado' }, delBackend).id, 'demo-hecha');
  // Se marcó ganado desde "Demo hecha": ya no es una demo, es un ganado.
  assert.equal(etapaVisibleDe({ etapaEmbudo: 'demo-hecha', estado: 'ganado' }, delBackend).id, 'ganado');
});

test('sin etapa propia, la del motor; con una etapa borrada, también', () => {
  assert.equal(etapaVisibleDe({ etapaEmbudo: null, estado: 'nutriendo' }, delBackend).id, 'nutriendo');
  assert.equal(etapaVisibleDe({ etapaEmbudo: 'ya-no-existe', estado: 'perdido' }, delBackend).id, 'perdido');
});
