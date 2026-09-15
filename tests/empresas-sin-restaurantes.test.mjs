import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * LOS RESTAURANTES NO VIVEN EN LEADAI (2026-09-15).
 *
 * Jonathan, en Configuración → Canales: "aún me aparece La Churrísima... no
 * debería aparecer, es un restaurante". Se fueron a Wappido sobre el mismo
 * backend, así que `/auth/yo` y `/empresas` los siguen devolviendo. El corte
 * va en la FRONTERA (`guardarSesion` y `misEmpresas`), igual que en la app
 * móvil (leadai-mobile caa02a6): ninguna pantalla filtra por su cuenta.
 */

// localStorage y window de mentira: `lib/auth.ts` solo pregunta si existen.
const almacen = new Map();
globalThis.window = globalThis.window ?? { dispatchEvent() {} };
globalThis.CustomEvent = globalThis.CustomEvent ?? class { constructor(tipo, init) { this.type = tipo; this.detail = init?.detail; } };
globalThis.localStorage = {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => almacen.set(k, String(v)),
  removeItem: (k) => almacen.delete(k),
};

const { guardarSesion, leerSesion, leerEmpresaActiva, guardarEmpresaActiva, empresasSinRestaurantes } = await import('../lib/auth.ts');

const churrisima = { tenantId: 'churri', nombre: 'La Churrísima', rol: 'owner', objetivo: 'vender_pedidos' };
const norac = { tenantId: 'norac', nombre: 'Norac Labs', rol: 'owner', objetivo: 'captar_y_derivar' };
const sania = { tenantId: 'sania', nombre: 'Sania', rol: 'owner', objetivo: 'captar_y_derivar' };
const sinObjetivo = { tenantId: 'viejo', nombre: 'Sesión vieja', rol: 'owner' };
const sesionDe = (empresas) => ({ token: 't', usuario: { id: 'u', email: 'j@x.pe', nombre: 'J' }, empresas });

beforeEach(() => almacen.clear());

test('empresasSinRestaurantes quita solo vender_pedidos y conserva lo que no trae objetivo', () => {
  assert.deepEqual(empresasSinRestaurantes([churrisima, norac, sinObjetivo, sania]), [norac, sinObjetivo, sania]);
});

test('guardarSesion nunca deja un restaurante en la sesión', () => {
  guardarSesion(sesionDe([norac, churrisima, sania]));
  assert.deepEqual(leerSesion().empresas.map((e) => e.nombre), ['Norac Labs', 'Sania']);
});

test('si el restaurante era la empresa activa, se suelta para no mandar su X-Tenant-Id', () => {
  guardarSesion(sesionDe([norac, churrisima, sania]));
  guardarEmpresaActiva('churri'); // como quedó guardado de una versión anterior
  guardarSesion(sesionDe([norac, churrisima, sania]));
  assert.equal(leerEmpresaActiva(), null);
});

test('si queda un solo negocio de captación, ese pasa a ser el activo (regla de siempre)', () => {
  guardarSesion(sesionDe([norac, churrisima]));
  guardarEmpresaActiva('churri');
  guardarSesion(sesionDe([norac, churrisima]));
  assert.equal(leerEmpresaActiva(), 'norac');
});

test('una empresa activa de captación no se toca', () => {
  guardarSesion(sesionDe([norac, sania]));
  guardarEmpresaActiva('sania');
  guardarSesion(sesionDe([norac, churrisima, sania]));
  assert.equal(leerEmpresaActiva(), 'sania');
});

test('con un solo restaurante, la sesión queda sin negocios (y sin empresa activa por defecto)', () => {
  guardarSesion(sesionDe([churrisima]));
  assert.deepEqual(leerSesion().empresas, []);
  assert.equal(leerEmpresaActiva(), null);
});

test('con una sola empresa de captación, queda activa por defecto como siempre', () => {
  guardarSesion(sesionDe([churrisima, norac]));
  assert.equal(leerEmpresaActiva(), 'norac');
});
