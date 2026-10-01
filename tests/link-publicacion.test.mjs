import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarLink } from '../lib/link-publicacion.ts';

// El link de una publicación (2026-10-01): lo que el dueño pega en el panel
// tiene que llegar al backend como una URL http(s) válida, o no llegar.

test('vacío = sin link', () => {
  assert.deepEqual(normalizarLink('   '), {});
});

test('www y dominio pelado se completan con https://', () => {
  assert.equal(normalizarLink('www.shiro.pe/carta').link, 'https://www.shiro.pe/carta');
  assert.equal(normalizarLink('shiro.pe').link, 'https://shiro.pe/');
});

test('un link completo pasa tal cual', () => {
  assert.equal(normalizarLink('https://cal.com/sania/15min').link, 'https://cal.com/sania/15min');
});

test('lo que no es un link web vuelve con error', () => {
  assert.ok(normalizarLink('hola').error);
  assert.ok(normalizarLink('javascript:alert(1)').error);
  assert.ok(normalizarLink('ftp://archivos.pe/x').error);
});
