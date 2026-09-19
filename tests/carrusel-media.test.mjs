import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MEDIA, revisarArchivo, revisarTanda, tipoMediaDe, moverEn } from '../lib/carrusel-media.ts';

/**
 * CARRUSEL: VARIAS IMÁGENES EN UN POST (2026-09-19).
 *
 * Jonathan fue a publicar las piezas de Sania y preguntó "¿puedo subir varias
 * imágenes?". No se podía: el backend ya aceptaba 10 en `mediaUrls`, pero el
 * panel mandaba siempre una, así que el carrusel de 5 láminas —su mejor pieza—
 * no se podía publicar desde LeadAI. Esto prueba las reglas de la mezcla.
 */

const img = (nombre = 'a.png', pesoMB = 1) => ({ nombre, tipoMime: 'image/png', pesoMB });
const video = (nombre = 'v.mp4', pesoMB = 10) => ({ nombre, tipoMime: 'video/mp4', pesoMB });
const vacio = { cantidad: 0, esVideo: false };

test('varias imágenes juntas: el caso que no se podía antes', () => {
  assert.deepEqual(revisarTanda([img('1.png'), img('2.png'), img('3.png')], vacio), { ok: true });
});

test('las 5 láminas de Sania entran de una', () => {
  const laminas = [1, 2, 3, 4, 5].map((n) => img(`carrusel-0${n}.png`));
  assert.deepEqual(revisarTanda(laminas, vacio), { ok: true });
});

test('se pueden agregar más a lo que ya hay, hasta el tope', () => {
  assert.deepEqual(revisarTanda([img()], { cantidad: MAX_MEDIA - 1, esVideo: false }), { ok: true });
});

test('pasarse del tope no se permite y el mensaje dice cuántas lleva', () => {
  const r = revisarTanda([img(), img()], { cantidad: MAX_MEDIA - 1, esVideo: false });
  assert.equal(r.ok, false);
  assert.match(r.motivo, new RegExp(`${MAX_MEDIA}`));
  assert.match(r.motivo, new RegExp(`${MAX_MEDIA - 1}`));
});

// UN VIDEO VA SOLO: Instagram no mezcla video e imágenes en un carrusel por
// API. Bloquearlo acá evita que el post falle recién al publicar.
test('un video solo, sí', () => {
  assert.deepEqual(revisarTanda([video()], vacio), { ok: true });
});

test('video + imágenes en la misma tanda: bloqueado', () => {
  const r = revisarTanda([video(), img()], vacio);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /video va solo/i);
});

test('un video cuando ya hay imágenes: bloqueado', () => {
  const r = revisarTanda([video()], { cantidad: 3, esVideo: false });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /video va solo/i);
});

test('imágenes cuando ya hay un video: bloqueado y lo explica', () => {
  const r = revisarTanda([img()], { cantidad: 1, esVideo: true });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /Ya hay un video/i);
});

test('dos videos a la vez: bloqueado', () => {
  const r = revisarTanda([video('a.mp4'), video('b.mp4')], vacio);
  assert.equal(r.ok, false);
});

// PESO Y FORMATO: se revisan antes de subir. Un video de 80MB no debe tardar
// un minuto en subir para nada.
test('imagen de más de 8MB: se rechaza nombrando el archivo', () => {
  const r = revisarArchivo(img('pesada.png', 9.4));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /pesada\.png/);
  assert.match(r.motivo, /8MB/);
});

test('video de más de 50MB: se rechaza', () => {
  const r = revisarArchivo(video('largo.mp4', 62));
  assert.equal(r.ok, false);
  assert.match(r.motivo, /50MB/);
});

test('un PDF no es media publicable', () => {
  const r = revisarArchivo({ nombre: 'x.pdf', tipoMime: 'application/pdf', pesoMB: 1 });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /formato no permitido/i);
});

test('el archivo malo de la tanda corta todo, aunque venga al final', () => {
  const r = revisarTanda([img('ok.png'), img('gorda.png', 20)], vacio);
  assert.equal(r.ok, false);
  assert.match(r.motivo, /gorda\.png/);
});

// tipoMedia: "carrusel" SOLO con más de una. Con una sola, el tipo real es el
// que cada red necesita para publicarla bien.
test('el tipo que viaja al backend', () => {
  assert.equal(tipoMediaDe(0, false), 'imagen');
  assert.equal(tipoMediaDe(1, false), 'imagen');
  assert.equal(tipoMediaDe(1, true), 'video');
  assert.equal(tipoMediaDe(5, false), 'carrusel');
});

// EL ORDEN ES EL CONTENIDO: la lámina 1 engancha, la última cierra con el CTA.
test('mover una lámina intercambia con su vecina', () => {
  assert.deepEqual(moverEn(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moverEn(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
});

test('mover fuera de los bordes no rompe ni cambia nada', () => {
  assert.deepEqual(moverEn(['a', 'b'], 0, -1), ['a', 'b']);
  assert.deepEqual(moverEn(['a', 'b'], 1, 1), ['a', 'b']);
});

test('no elegir nada no es un error', () => {
  assert.deepEqual(revisarTanda([], vacio), { ok: true });
});

/**
 * QUÉ FALTA PARA PUBLICAR (2026-09-19).
 *
 * El botón se apagaba en silencio: Jonathan armó su carrusel, lo vio gris y
 * tuvo que preguntar "¿tengo que poner un texto arriba?". Esto prueba que lo
 * que falta se pueda decir en vez de dejarlo adivinar.
 */
import { faltaParaPublicar } from '../lib/carrusel-media.ts';

const base = { texto: 'Hola', cantidadMedia: 1, redes: ['instagram'], programar: false, fecha: '' };

test('con todo puesto no falta nada: se puede publicar', () => {
  assert.deepEqual(faltaParaPublicar(base), []);
});

test('sin texto lo dice (el caso real de Jonathan)', () => {
  const f = faltaParaPublicar({ ...base, texto: '   ' });
  assert.equal(f.length, 1);
  assert.match(f[0], /texto/i);
});

test('sin redes lo dice', () => {
  const f = faltaParaPublicar({ ...base, redes: [] });
  assert.match(f.join(' '), /al menos una red/i);
});

test('Instagram sin media: lo pide nombrando la red', () => {
  const f = faltaParaPublicar({ ...base, cantidadMedia: 0 });
  assert.match(f.join(' '), /Instagram/);
});

test('TikTok sin media: pide un video', () => {
  const f = faltaParaPublicar({ ...base, redes: ['tiktok'], cantidadMedia: 0 });
  assert.match(f.join(' '), /video/i);
  assert.match(f.join(' '), /TikTok/);
});

test('Facebook solo con texto sí se puede: no exige media', () => {
  assert.deepEqual(faltaParaPublicar({ ...base, redes: ['messenger'], cantidadMedia: 0 }), []);
});

test('programar sin fecha lo dice', () => {
  const f = faltaParaPublicar({ ...base, programar: true, fecha: '' });
  assert.match(f.join(' '), /fecha/i);
});

test('programar CON fecha no falta nada', () => {
  assert.deepEqual(faltaParaPublicar({ ...base, programar: true, fecha: '2026-10-01T10:00' }), []);
});

test('faltando varias cosas se listan todas, en orden de la pantalla', () => {
  const f = faltaParaPublicar({ texto: '', cantidadMedia: 0, redes: [], programar: true, fecha: '' });
  assert.equal(f.length, 3); // texto, redes, fecha (sin redes no se pide media de ninguna)
  assert.match(f[0], /texto/i);
  assert.match(f[1], /red/i);
});
