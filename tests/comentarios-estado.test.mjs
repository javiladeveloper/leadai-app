import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redesDeComentarios, textoRedes, fusionarComentarios, describirEnvio } from '../lib/comentarios-estado.ts';

/**
 * COMENTARIOS: EL AVISO DE "CONECTA TUS REDES" NO PUEDE SER FIJO (2026-09-18).
 *
 * Jonathan, con Instagram y Facebook conectados en Sania: "ya tengo conectado
 * mis redes pero me sigue apareciendo este mensaje". El aviso amarillo, la
 * nota del simulador y el vacío con el botón "Conectar mis redes" estaban
 * escritos en la página sin mirar los canales. Esto decide qué redes cuentan
 * para comentarios: solo Instagram y la página de Facebook, y solo activas.
 */

test('solo Instagram y Facebook cuentan: WhatsApp y TikTok no reciben comentarios', () => {
  const canales = [
    { tipo: 'whatsapp', activo: true },
    { tipo: 'tiktok', activo: true },
    { tipo: 'instagram', activo: true },
    { tipo: 'messenger', activo: true },
  ];
  assert.deepEqual(redesDeComentarios(canales), ['Instagram', 'Facebook']);
});

test('un canal apagado no cuenta como conectado', () => {
  assert.deepEqual(redesDeComentarios([{ tipo: 'instagram', activo: false }, { tipo: 'messenger', activo: true }]), ['Facebook']);
});

test('sin redes de comentarios la lista queda vacía (el aviso de conectar sigue)', () => {
  assert.deepEqual(redesDeComentarios([{ tipo: 'whatsapp', activo: true }]), []);
  assert.deepEqual(redesDeComentarios([]), []);
});

test('el orden es fijo aunque los canales vengan al revés', () => {
  assert.deepEqual(redesDeComentarios([{ tipo: 'messenger', activo: true }, { tipo: 'instagram', activo: true }]), ['Instagram', 'Facebook']);
});

test('las redes se nombran como las dice la gente', () => {
  assert.equal(textoRedes(['Instagram', 'Facebook']), 'Instagram y Facebook');
  assert.equal(textoRedes(['Instagram']), 'Instagram');
  assert.equal(textoRedes([]), '');
});

test('refrescar 100 comentarios conserva páginas antiguas y actualiza IDs repetidos', () => {
  const antiguos = Array.from({ length: 120 }, (_, i) => ({ id: `c${i}`, creadoEn: `2026-09-29T10:${String(59 - (i % 60)).padStart(2, '0')}:00Z`, texto: 'antes' }));
  const recientes = [{ ...antiguos[0], texto: 'actualizado' }, { id: 'nuevo', creadoEn: '2026-09-30T12:00:00Z', texto: 'nuevo' }];
  const fusion = fusionarComentarios(antiguos, recientes);
  assert.equal(fusion.length, 121);
  assert.equal(fusion.find((c) => c.id === 'c0').texto, 'actualizado');
  assert.ok(fusion.some((c) => c.id === 'c119'));
});

test('un timeout nunca se describe como enviado y los dos resultados se separan', () => {
  assert.deepEqual(describirEnvio({ id: 'c', creadoEn: '', respondido: false, dmAbierto: true, estadoPublico: 'incierto', estadoPrivado: 'enviado' }), {
    publico: 'Revisar en Meta', privado: 'Enviado', requiereRevision: true,
  });
});

test('un registro de simulación histórico no se presenta como entregado', () => {
  assert.deepEqual(describirEnvio({ id: 'sim', creadoEn: '', respondido: true, dmAbierto: true, esPrueba: true }), {
    publico: 'Vista previa', privado: 'Vista previa', requiereRevision: false,
  });
});
