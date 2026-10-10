import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedir, leerCache, invalidar, cacheFresca, guardarCache, escucharClave, vaciarCache } from '../lib/cache-datos.ts';

/** LA CACHÉ DE DATOS (2026-10-09): "que al volver a una sección se vea al instante". */

test('dos pedidos simultáneos con la misma clave hacen UNA sola petición', async () => {
  vaciarCache();
  let llamadas = 0;
  const cargar = () => { llamadas++; return new Promise((r) => setTimeout(() => r('ok'), 5)); };
  const [a, b] = await Promise.all([pedir('k1', cargar), pedir('k1', cargar)]);
  assert.equal(a, 'ok');
  assert.equal(b, 'ok');
  assert.equal(llamadas, 1);
  assert.equal(leerCache('k1'), 'ok');
});

test('con maxEdadMs no vuelve a pedir lo recién traído; sin él, sí', async () => {
  vaciarCache();
  let llamadas = 0;
  const cargar = async () => ++llamadas;
  await pedir('k2', cargar);
  assert.equal(await pedir('k2', cargar, { maxEdadMs: 60_000 }), 1);
  assert.equal(await pedir('k2', cargar), 2);
});

test('invalidar deja el valor para pintar pero lo marca viejo y avisa', async () => {
  vaciarCache();
  await pedir('canales@A', async () => ['wa']);
  let avisos = 0;
  const soltar = escucharClave('canales@A', () => { avisos++; });
  invalidar('canales@');
  assert.deepEqual(leerCache('canales@A'), ['wa']);
  assert.equal(cacheFresca('canales@A', Number.POSITIVE_INFINITY), false);
  assert.equal(avisos, 1);
  soltar();
});

test('un error no borra lo que ya se sabía y le llega al que esperaba', async () => {
  vaciarCache();
  guardarCache('k3', 'viejo');
  await assert.rejects(pedir('k3', async () => { throw new Error('caído'); }), /caído/);
  assert.equal(leerCache('k3'), 'viejo');
  // Y una clave sin nada guardado queda vacía, no con un `undefined` "válido".
  await assert.rejects(pedir('k4', async () => { throw new Error('x'); }));
  assert.equal(leerCache('k4'), undefined);
});
