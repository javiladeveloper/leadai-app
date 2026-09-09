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

/**
 * LA CAUSA REAL: el backend convertía a WebP (2026-09-09).
 *
 * La primera sospecha fue el formato del archivo original, y era falsa —
 * probado contra Meta: un JPG con el mismo cuerpo se acepta. El problema está
 * DESPUÉS de elegir: `subirImagen` comprime toda imagen a WebP (para que la
 * carta pese poco) y Meta rechaza WebP en encabezados. Daba igual qué formato
 * eligiera el dueño: al storage entraba JPG y salía WebP.
 */
test('la imagen del encabezado se sube SIN comprimir, o Meta la rechaza siempre', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/CampaniasPanel.tsx', import.meta.url), 'utf8');
  assert.match(src, /subirMediaPost\(.*,\s*false\)/,
    'la imagen del encabezado se está comprimiendo a WebP y Meta la va a rechazar');
});

/**
 * NINGUNA ESPERA SIN ANIMACIÓN — tampoco al enviar la plantilla (2026-09-09).
 *
 * Jonathan: "cuando puse enviar a revisión... se queda sin hacer nada, no
 * sabes si funcionó, el botón no tiene animación de presionado, no sale loop
 * de carga, te quedas ahí esperando no sabes si se colgó".
 *
 * Crear una plantilla con imagen NO es rápido: el backend descarga el archivo,
 * abre una sesión de subida con Meta, manda los bytes y recién ahí crea la
 * plantilla. Son varios segundos con el botón idéntico a como estaba.
 *
 * Y sin bloquearlo se puede tocar dos veces: la segunda petición choca con la
 * primera y Meta responde "Content in This Language Already Exists" — el
 * error que vio después de tocar de nuevo creyendo que no había pasado nada.
 */
test('el botón de enviar a Meta muestra que está trabajando', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/CampaniasPanel.tsx', import.meta.url), 'utf8');
  // Un estado propio del envío, distinto del de subir la imagen (pSubiendo).
  assert.match(src, /pEnviando/, 'no hay estado de envío: el botón no puede avisar que trabaja');
  // Y una animación, no solo texto.
  assert.match(src, /pEnviando[\s\S]{0,400}animate-spin/,
    'la espera va sin animación (regla de la casa)');
});

test('no se puede enviar dos veces: la segunda choca y Meta la rechaza', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/CampaniasPanel.tsx', import.meta.url), 'utf8');
  // El guard de reentrada y el botón deshabilitado mientras viaja.
  assert.match(src, /if \(pEnviando/, 'falta el guard de reentrada');
  assert.match(src, /disabled=\{[^}]*pEnviando/, 'el botón sigue clickeable mientras envía');
});

/**
 * "CONTENT IN THIS LANGUAGE ALREADY EXISTS" EN CASTELLANO (2026-09-09).
 *
 * Meta responde eso cuando ya hay una plantilla con ese nombre en ese idioma.
 * Le pasó a Jonathan al tocar "Enviar" de nuevo creyendo que no había pasado
 * nada: la primera SÍ había funcionado. El mensaje en inglés no dice ni que
 * su plantilla ya está creada ni qué hacer.
 */
test('el choque de nombre se explica: ya existe, y qué hacer', async () => {
  const { traducirErrorPlantilla } = await import('../lib/errores-plantilla.ts');
  const t = traducirErrorPlantilla(
    'Content in This Language Already Exists: There is already Spanish content for this template. You can create a new template and try again.',
  );
  assert.match(t, /ya (existe|tienes)/i);
  // Y lo más importante: que NO perdió su trabajo.
  assert.match(t, /revisión|lista/i);
  assert.doesNotMatch(t, /Already Exists/);
});

test('el formato no soportado también se explica', async () => {
  const { traducirErrorPlantilla } = await import('../lib/errores-plantilla.ts');
  const t = traducirErrorPlantilla('File Type Not Supported: The type of file is not supported.');
  assert.match(t, /JPG|PNG/);
});

test('lo que no sabemos traducir se pasa tal cual, no se traga', async () => {
  const { traducirErrorPlantilla } = await import('../lib/errores-plantilla.ts');
  assert.equal(traducirErrorPlantilla('Algo rarísimo de Meta'), 'Algo rarísimo de Meta');
  assert.match(traducirErrorPlantilla(''), /No se pudo/);
});

test('el traductor está CABLEADO en el panel, no es código muerto', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../components/panel/CampaniasPanel.tsx', import.meta.url), 'utf8');
  assert.match(src, /traducirErrorPlantilla\(/);
});
