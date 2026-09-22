import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * EL NEGOCIO PREDETERMINADO MANDA EN TODOS LADOS (2026-09-22, pedido de
 * Jonathan: "si pongo Sania por defecto... todo debe filtrar correctamente en
 * todas las partes, debería empezar con Sania si escojo").
 *
 * Fijarlo ya decidía en cuál abre cada sección con chips, pero el header caía
 * a `lista[0]`, las bandejas abrían en "Todos" y los chips seguían en el orden
 * del backend. Estos tests cubren las tres piezas que lo unifican.
 */
const almacen = new Map();
globalThis.window = globalThis.window ?? { dispatchEvent() {} };
globalThis.CustomEvent = globalThis.CustomEvent ?? class { constructor(tipo, init) { this.type = tipo; this.detail = init?.detail; } };
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};

const {
  guardarEmpresaPredeterminada, guardarEmpresaActiva, empresaInicial,
  conPredeterminadaPrimero, filtroInicialDeBandeja,
} = await import('../lib/auth.ts');

const norac = { tenantId: 'norac', nombre: 'Norac Labs' };
const dalu = { tenantId: 'dalu', nombre: 'Dalu' };
const sania = { tenantId: 'sania', nombre: 'Sania' };
const lista = [norac, dalu, sania];

beforeEach(() => almacen.clear());

test('conPredeterminadaPrimero pone al predeterminado adelante y conserva el resto en orden', () => {
  guardarEmpresaPredeterminada('sania');
  assert.deepEqual(conPredeterminadaPrimero(lista).map((n) => n.tenantId), ['sania', 'norac', 'dalu']);
});

test('sin predeterminado, o si ya no está en la lista, el orden no se toca', () => {
  assert.deepEqual(conPredeterminadaPrimero(lista), lista);
  guardarEmpresaPredeterminada('vendido');
  assert.deepEqual(conPredeterminadaPrimero(lista), lista);
});

test('una bandeja abre filtrada por el predeterminado, y sin él en "todos"', () => {
  assert.equal(filtroInicialDeBandeja(lista, ''), '');
  assert.equal(filtroInicialDeBandeja(lista, 'todos'), 'todos');
  guardarEmpresaPredeterminada('sania');
  assert.equal(filtroInicialDeBandeja(lista, ''), 'sania');
  guardarEmpresaPredeterminada('vendido');
  assert.equal(filtroInicialDeBandeja(lista, 'todos'), 'todos');
});

test('el header abre en el predeterminado aunque la activa sea otra válida', () => {
  guardarEmpresaActiva('norac');
  guardarEmpresaPredeterminada('sania');
  assert.equal(empresaInicial(lista), 'sania');
});

test('sin predeterminado, el header conserva la activa válida y solo cae al primero si no sirve', () => {
  guardarEmpresaActiva('dalu');
  assert.equal(empresaInicial(lista), 'dalu');
  guardarEmpresaActiva('vendido');
  assert.equal(empresaInicial(lista), 'norac');
});
