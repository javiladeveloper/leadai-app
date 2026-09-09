import { test } from 'node:test';
import assert from 'node:assert/strict';
import { traducirErrorMeta } from '../lib/errores-meta.ts';

/**
 * CONECTAR WHATSAPP ES DONDE SE PIERDEN LOS CLIENTES (2026-09-08).
 *
 * Tres negocios en cuatro días se trabaron acá —dos de ellos el mismo día— y
 * la pantalla no tenía UN test. Los casos de abajo son los reales, no
 * inventados: cada uno viene de algo que le pasó a un dueño de verdad.
 */

test('un fallo de RED no culpa a la página de Facebook', () => {
  // La pizzería que reportó el problema tenía página, portfolio comercial y
  // publicidad corriendo. Mandarla a crear una página la manda a buscar el
  // problema donde no está — y encima el corte fue nuestro, antes de Meta.
  const e = traducirErrorMeta('No pudimos abrir el asistente de Meta. Revisa tu conexión y toca Continuar de nuevo.');
  assert.match(e.titulo, /no pudimos abrir el asistente/i);
  assert.ok(e.reintentable, 'un problema de red SIEMPRE se puede reintentar');
  const pasos = e.pasos.join(' ').toLowerCase();
  assert.ok(pasos.includes('conexión') || pasos.includes('internet'), 'debe hablar de la conexión');
  assert.ok(!pasos.includes('facebook.com/pages/create'), 'NO debe mandar a crear una página');
});

test('el error SIN pista sigue nombrando la página: es la causa más común de Meta', () => {
  // Meta no menciona la página en su error, así que el dueño busca en su
  // número —donde no está— y abandona. Nombrarla es lo que salva el caso.
  const e = traducirErrorMeta('');
  assert.ok(e.pasos.join(' ').includes('página de Facebook'));
  assert.ok(e.reintentable);
});

test('todo error traducido se puede reintentar o dice a quién escribir', () => {
  // Ningún camino puede terminar en una pantalla muerta: o hay un botón, o
  // hay un humano. Eso es lo que faltó con el restaurante que "no cargaba".
  for (const crudo of ['', 'algo raro', 'error 100', 'permission denied', 'timeout']) {
    const e = traducirErrorMeta(crudo);
    const salida = e.reintentable || e.pasos.join(' ').toLowerCase().includes('escríbenos');
    assert.ok(salida, `"${crudo}" deja al dueño sin salida`);
  }
});

test('el navegador embebido de WhatsApp tiene su propio consejo', () => {
  // Captura real: "Abriendo Meta…" clavado en el celular de una dueña que
  // abrió el panel desde el link de WhatsApp. Su WebView ignoró el salto a
  // facebook.com sin error. Ni la conexión ni la página tenían la culpa.
  const e = traducirErrorMeta('Tu navegador no dejó abrir el asistente de Meta. Suele pasar cuando entras desde WhatsApp o Instagram: abre el panel en Chrome o Safari y vuelve a intentar.');
  const pasos = e.pasos.join(' ').toLowerCase();
  assert.ok(pasos.includes('chrome') || pasos.includes('navegador'), 'debe decir cómo salir del WebView');
  assert.ok(!pasos.includes('facebook.com/pages/create'), 'NO debe mandar a crear una página');
  assert.ok(e.reintentable);
});
