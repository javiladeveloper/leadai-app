import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tramoVisible, verAnteriores, cercaDelFinal, MENSAJES_VISIBLES, TRAMO } from '../lib/chat-tramos.ts';

/**
 * CONVERSACIONES LARGAS, POR TRAMOS (2026-09-25): "los mensajes tengo que
 * bajar mucho". Se pintan los últimos y "Ver anteriores" trae de a 100.
 */
const mensajes = (n) => Array.from({ length: n }, (_, i) => i + 1);

test('pinta solo los últimos y dice cuántos quedan, contando los del backend', () => {
  const t = tramoVisible(mensajes(150), MENSAJES_VISIBLES, 900);
  assert.equal(t.visibles.length, 60);
  assert.equal(t.visibles.at(-1), 150);
  assert.equal(t.anteriores, 840);
});

test('una conversación corta se ve entera, sin botón', () => {
  assert.deepEqual(tramoVisible(mensajes(12), MENSAJES_VISIBLES, 12), { visibles: mensajes(12), anteriores: 0 });
});

test('ver anteriores muestra más de lo ya cargado sin pedir al backend', () => {
  assert.deepEqual(verAnteriores({ mostrar: 60, cargados: 450, pedidos: 450, total: 900 }), { mostrar: 60 + TRAMO, pedir: null });
});

test('cuando lo cargado no alcanza, pide más al backend (con tope)', () => {
  assert.deepEqual(verAnteriores({ mostrar: 160, cargados: 150, pedidos: 150, total: 900 }), { mostrar: 260, pedir: 450 });
  assert.equal(verAnteriores({ mostrar: 960, cargados: 900, pedidos: 900, total: 5000 }).pedir, 1000);
});

test('si ya está todo cargado, no pide nada', () => {
  assert.equal(verAnteriores({ mostrar: 160, cargados: 150, pedidos: 150, total: 150 }).pedir, null);
});

test('cerca del final: solo ahí un mensaje nuevo baja el chat', () => {
  assert.equal(cercaDelFinal({ scrollHeight: 2000, scrollTop: 1500, clientHeight: 450 }), true);
  assert.equal(cercaDelFinal({ scrollHeight: 2000, scrollTop: 200, clientHeight: 450 }), false);
});
