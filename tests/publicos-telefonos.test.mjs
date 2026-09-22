import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * EL CSV DE GOOGLE PLACES NO ES UNA LISTA DE TELÉFONOS (2026-09-22).
 *
 * Jonathan subió su archivo de clínicas y el panel dijo "No pudimos conectar
 * con el servidor": la extracción tomaba cualquier celda con seis dígitos
 * (coordenadas, ids, direcciones) y mandaba varios megas en un POST. Esto
 * cubre que solo viajen los teléfonos, una vez cada uno.
 */
const { extraerTelefonos, MAX_TELEFONOS } = await import('../lib/publicos.ts');

test('de una fila de Google Places se queda solo con el celular', () => {
  const csv = [
    'nombre,direccion,lat,lng,place_id,celular,rating',
    '"Clínica Dental Sonrisa","Av. Larco 1234, Miraflores",-12.121212,-77.030303,0x9105c8c1e1b2a3d5:0x12345678,"+51 987 654 321",4.5',
    '"Consultorio Vega","Jr. Unión 345",-12.05,-77.03,ChIJ1234567890abc,987654322,4.8',
  ].join('\n');
  assert.deepEqual(extraerTelefonos(csv), ['51987654321', '987654322']);
});

test('acepta las formas comunes de escribir un número y descarta el resto', () => {
  const csv = ['987654321', '(01) 445-1234', '0051 987 654 323', '+51-987-654-324', '12345', '-12.0464', '20240912', 'Av. Arequipa 1234 Lima'].join('\n');
  // "20240912" tiene 8 dígitos y nada más: no hay forma de saber que es una
  // fecha, y el backend igual lo descarta al normalizar. Lo importante es que
  // coordenadas, direcciones y números cortos no viajen.
  assert.deepEqual(extraerTelefonos(csv), ['987654321', '014451234', '0051987654323', '51987654324', '20240912']);
});

test('deduplica antes de mandar', () => {
  assert.deepEqual(extraerTelefonos('987654321\n987654321\n"987654321"'), ['987654321']);
});

test('nunca manda más que el tope del backend', () => {
  const muchos = Array.from({ length: MAX_TELEFONOS + 500 }, (_, i) => String(900000000 + i)).join('\n');
  assert.equal(extraerTelefonos(muchos).length, MAX_TELEFONOS);
});

test('archivo sin teléfonos → lista vacía (el panel avisa)', () => {
  assert.deepEqual(extraerTelefonos('nombre,direccion\nClínica,Av. Larco 12'), []);
});
