import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esCelular, comoAbrirConexion } from '../lib/conectar-canal.ts';

/**
 * CONECTAR INSTAGRAM / MESSENGER / TIKTOK DESDE EL CELULAR (2026-09-09).
 *
 * Jonathan, después de las dos noches que costó WhatsApp: "esto debe ser para
 * todas las conexiones con canales... messenger, instagram y tiktok también
 * debe estar preparado para una conexión mediante el celular".
 *
 * Tenía razón y el bug estaba latente: los tres abrían con `window.open`
 * popup, que es justo lo que falla en Android — se abre como pestaña suelta o
 * el sistema la mata, y el `postMessage` que avisa al panel nunca llega
 * porque no hay `opener`. Es el mismo pozo de WhatsApp esperando al primero
 * que conectara Instagram desde un teléfono.
 */

test('reconoce los teléfonos donde el popup no es confiable', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; SM-A536E) AppleWebKit/537.36 Chrome/120';
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  const ipad = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
  for (const ua of [android, iphone, ipad]) assert.equal(esCelular(ua), true, ua);
});

test('el escritorio conserva el popup', () => {
  const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120';
  for (const ua of [windows, mac]) assert.equal(esCelular(ua), false, ua);
});

test('sin userAgent no se asume celular: el popup es el camino probado', () => {
  assert.equal(esCelular(''), false);
  assert.equal(esCelular(undefined), false);
});

test('en el celular se navega en la MISMA pestaña, no se abre otra', () => {
  // Una pestaña que el sistema puede matar es exactamente el fallo de
  // WhatsApp: el code vuelve a una página que ya no existe.
  assert.equal(comoAbrirConexion(true), 'redireccion');
});

test('en escritorio se abre el popup, que avisa al panel al terminar', () => {
  // El popup tiene `window.opener`: el callback hace postMessage y la lista
  // de canales se refresca sola. Eso NO se pierde por arreglar el móvil.
  assert.equal(comoAbrirConexion(false), 'popup');
});

/**
 * VOLVER DE LA RED TIENE QUE REFRESCAR LA LISTA (2026-09-09).
 *
 * En el popup avisaba el `postMessage` del callback. En redirección no hay
 * `opener` que avise: la pestaña se fue y volvió. Sin recargar al volver, el
 * panel muestra "Sin conectar" aunque la conexión haya quedado — que es
 * exactamente lo que pasó en la app con WhatsApp y costó repetir el flujo.
 */
test('al volver de la red hay que recargar la lista, no confiar en postMessage', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/PanelCanales.tsx', import.meta.url), 'utf8');
  // `pageshow` cubre la vuelta desde la caché del navegador (botón atrás), que
  // es como vuelve un celular; `visibilitychange`, volver a la pestaña.
  assert.match(src, /pageshow|visibilitychange/,
    'el panel no se entera de que el dueño volvió de autorizar');
});

test('el fallo al abrir se le DICE al dueño, no se traga', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/PanelCanales.tsx', import.meta.url), 'utf8');
  // `obtenerUrlOAuth` devuelve null ante cualquier error: sin mensaje, el
  // botón se apaga y no pasa nada visible.
  assert.match(src, /setErrorConexion\(/);
  assert.match(src, /\{errorConexion &&/);
});
