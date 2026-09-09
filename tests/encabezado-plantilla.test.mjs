import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatoEncabezadoOk, ACEPTA_ENCABEZADO, MENSAJE_FORMATO } from '../lib/encabezado-plantilla.ts';

/**
 * EL FORMATO DEL ENCABEZADO SE VALIDA ANTES DE SUBIR (2026-09-09).
 *
 * Jonathan subió el logo de Norac Labs como encabezado de plantilla y el panel
 * mostró "Invalid parameter" y nada más. Reproducido contra Meta: era WebP, y
 * Meta solo acepta JPG y PNG ahí (subcode 2388084, "File Type Not Supported").
 *
 * Dos fallas encadenadas: el input decía `accept="image/*"` —dejando elegir un
 * formato que iba a fallar seguro— y el error de Meta se mostraba en su
 * versión genérica en vez de la que explica qué pasó.
 */

test('acepta JPG y PNG, que es lo que Meta acepta', () => {
  for (const f of ['logo.jpg', 'logo.JPG', 'foto.jpeg', 'marca.png', 'MARCA.PNG']) {
    assert.equal(formatoEncabezadoOk(f), true, f);
  }
});

test('rechaza WebP — el caso real que rompió', () => {
  assert.equal(formatoEncabezadoOk('logo.webp'), false);
});

test('rechaza los demás formatos que Meta no soporta', () => {
  for (const f of ['animado.gif', 'vector.svg', 'moderno.avif', 'documento.pdf', 'sin-extension']) {
    assert.equal(formatoEncabezadoOk(f), false, f);
  }
});

test('el input NO deja elegir lo que va a fallar', () => {
  // `image/*` dejaba pasar WebP: el dueño elegía su logo y esperaba la subida
  // para recibir un error que se podía saber de antemano.
  assert.ok(!ACEPTA_ENCABEZADO.includes('image/*'));
  assert.ok(ACEPTA_ENCABEZADO.includes('image/png'));
  assert.ok(ACEPTA_ENCABEZADO.includes('image/jpeg'));
  assert.ok(!ACEPTA_ENCABEZADO.includes('webp'));
});

test('el mensaje dice qué formato usar, no solo que está mal', () => {
  assert.match(MENSAJE_FORMATO, /JPG|PNG/);
});

/** ESTÁ CABLEADO — la lección del velo: probado pero sin llamar es lo mismo que roto. */
test('el panel valida antes de subir y muestra el formato', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/CampaniasPanel.tsx', import.meta.url), 'utf8');
  assert.match(src, /formatoEncabezadoOk\(file\.name\)/, 'no valida el archivo elegido');
  assert.match(src, /\{AYUDA_FORMATO\}/, 'no dice el formato en pantalla');
  // Los DOS inputs (campaña y plantilla) dejaban elegir cualquier imagen.
  assert.doesNotMatch(src, /accept="image\/\*"/, 'quedó un input con el comodín');
  assert.equal((src.match(/accept=\{ACEPTA_ENCABEZADO\}/g) || []).length, 2);
});
