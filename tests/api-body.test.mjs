import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * EL CUERPO VIAJA UNA SOLA VEZ SERIALIZADO (2026-09-22).
 *
 * Siete funciones de lib/api.ts pasaban `body: JSON.stringify({...})` y
 * `api()` lo serializaba otra vez: al backend le llegaba un string JSON y zod
 * contestaba "Expected object, received string". Los públicos de Meta, el
 * retargeting y prender/apagar anuncios nunca habían funcionado desde el
 * panel. Esto cubre las dos formas de llamar.
 */
const { cuerpoParaFetch } = await import('../lib/cuerpo.ts');

test('un objeto se serializa una vez', () => {
  assert.equal(cuerpoParaFetch({ telefonos: ['987654321'] }), '{"telefonos":["987654321"]}');
});

test('un string ya serializado viaja tal cual (no se vuelve a envolver)', () => {
  const s = cuerpoParaFetch(JSON.stringify({ estado: 'PAUSED' }));
  assert.equal(s, '{"estado":"PAUSED"}');
  assert.equal(JSON.parse(s).estado, 'PAUSED');
});

test('sin cuerpo no manda cuerpo', () => {
  assert.equal(cuerpoParaFetch(undefined), undefined);
});
