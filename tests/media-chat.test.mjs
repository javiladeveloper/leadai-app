import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaDelTexto, revisarAdjunto, pesoLegible } from '../lib/media-chat.ts';

/** FOTOS Y VIDEOS EN EL CHAT (2026-09-25): "quiero enviar videos demos". */
test('solo fotos o videos, hasta 50 MB (el servidor comprime después)', () => {
  assert.equal(revisarAdjunto({ type: 'video/quicktime', size: 40 * 1048576 }), null);
  assert.equal(revisarAdjunto({ type: 'image/png', size: 2 * 1048576 }), null);
  assert.match(revisarAdjunto({ type: 'application/pdf', size: 100 }), /fotos o videos/);
  assert.match(revisarAdjunto({ type: 'video/mp4', size: 80 * 1048576 }), /80 MB/);
});

test('el mensaje del historial se reconoce como video o foto', () => {
  assert.deepEqual(mediaDelTexto('🎥 Video: Demo de Sania\nhttps://x.supabase.co/v.mp4'), { tipo: 'video', url: 'https://x.supabase.co/v.mp4', caption: 'Demo de Sania' });
  assert.deepEqual(mediaDelTexto('📷 Foto\nhttps://x.supabase.co/f.jpg'), { tipo: 'imagen', url: 'https://x.supabase.co/f.jpg' });
});

test('un texto normal sigue siendo texto', () => {
  assert.equal(mediaDelTexto('Hola, te mando el video mañana'), null);
  assert.equal(mediaDelTexto('🎥 [Video]'), null);
});

test('el peso se dice en MB o KB', () => {
  assert.equal(pesoLegible(14.5 * 1048576), '14.5 MB');
  assert.equal(pesoLegible(300 * 1024), '300 KB');
});
