import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chequeosDeHistoria, faltaParaPublicar } from '../lib/carrusel-media.ts';

/**
 * HISTORIAS (2026-09-25). Las reglas de Meta se dicen ANTES de publicar: una
 * sola foto o video, solo Instagram y Facebook, hasta 60 s, sin texto.
 */
const base = { formato: 'historia', redes: ['instagram'], cantidadMedia: 1, esVideo: false };
const bloqueos = (e) => chequeosDeHistoria({ ...base, ...e }).filter((c) => c.nivel === 'bloqueo').map((c) => c.texto);

test('un post normal no tiene reglas de historia', () => {
  assert.deepEqual(chequeosDeHistoria({ ...base, formato: 'post', cantidadMedia: 5, redes: ['tiktok'] }), []);
});

test('una foto en Instagram como historia está lista', () => {
  assert.deepEqual(bloqueos({}), []);
});

test('carrusel o sin media no puede ser historia', () => {
  assert.match(bloqueos({ cantidadMedia: 3 })[0], /una sola foto/);
  assert.match(bloqueos({ cantidadMedia: 0 })[0], /necesita una foto/);
});

test('TikTok no tiene historias, pero en "ambos" recibe su post', () => {
  assert.match(bloqueos({ redes: ['instagram', 'tiktok'] })[0], /TikTok no tiene historias/);
  assert.deepEqual(bloqueos({ formato: 'ambos', redes: ['instagram', 'tiktok'] }), []);
});

test('sin Instagram ni Facebook no hay dónde publicar la historia', () => {
  assert.match(bloqueos({ formato: 'ambos', redes: ['tiktok'] })[0], /Instagram y Facebook/);
});

test('video de más de 60 segundos se frena; horizontal solo avisa', () => {
  assert.match(bloqueos({ esVideo: true, duracionSeg: 75 })[0], /60 segundos/);
  const c = chequeosDeHistoria({ ...base, esVideo: true, duracionSeg: 20, ancho: 1920, alto: 1080 });
  assert.deepEqual(c.map((x) => x.nivel), ['aviso']);
});

test('una historia sola no exige texto; post e historia sí', () => {
  const e = { texto: '', cantidadMedia: 1, redes: ['instagram'], programar: false, fecha: '' };
  assert.deepEqual(faltaParaPublicar({ ...e, formato: 'historia' }), []);
  assert.deepEqual(faltaParaPublicar({ ...e, formato: 'ambos' }), ['escribe el texto del post']);
});
