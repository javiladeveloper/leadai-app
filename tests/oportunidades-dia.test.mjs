import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

const igual = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

/** CRM FASE 3 (2026-10-13): cada oportunidad del día y su acción de un toque. */
const o = cargarModulo('lib/oportunidades-dia.ts');

const AHORA = new Date('2026-10-13T15:00:00.000Z');
const op = (extra = {}) => ({
  id: 'no_show:L1', tipo: 'no_show', leadId: 'L1', tenantId: 'T1', negocio: 'Sania', nombre: 'Ana',
  telefono: '51987654321', titulo: 'No llegó a la reunión del lunes', detalle: '', prioridad: 80, accion: 'whatsapp',
  ...extra,
});

test('whatsapp abre la ficha con el mensaje sugerido para ESE motivo', () => {
  igual(o.accionDeOportunidad(op()), {
    tipo: 'whatsapp', texto: 'Escribirle', href: '/conversaciones?lead=L1&negocio=T1&sugerir=no_show',
  });
  // Un tipo que esta web no conoce: abre el chat igual, sin motivo.
  assert.equal(o.accionDeOportunidad(op({ tipo: 'otro_nuevo' })).href, '/conversaciones?lead=L1&negocio=T1');
});

test('llamar va a tel: (y sin número, a la ficha)', () => {
  igual(o.accionDeOportunidad(op({ accion: 'llamar', tipo: 'caliente_callado' })), { tipo: 'llamar', texto: 'Llamar', href: 'tel:+51987654321' });
  // Un número de 9 dígitos sin el 51 se completa.
  assert.equal(o.accionDeOportunidad(op({ accion: 'llamar', telefono: '987654321' })).href, 'tel:+51987654321');
  igual(o.accionDeOportunidad(op({ accion: 'llamar', telefono: null })), { tipo: 'ficha', texto: 'Abrir ficha', href: '/conversaciones?lead=L1&negocio=T1' });
});

test('agendar abre el modal; resultado lleva a la Agenda en esa cita', () => {
  igual(o.accionDeOportunidad(op({ accion: 'agendar', tipo: 'registrado' })), { tipo: 'agendar', texto: 'Agendar' });
  igual(o.accionDeOportunidad(op({ accion: 'resultado', tipo: 'reunion_sin_resultado', citaId: 'C9' })), {
    tipo: 'resultado', texto: 'Anotar cómo le fue', href: '/agenda?cita=C9',
  });
  // Sin cita no hay a dónde ir en la agenda: la ficha.
  assert.equal(o.accionDeOportunidad(op({ accion: 'resultado' })).tipo, 'ficha');
  // Una acción desconocida tampoco rompe.
  assert.equal(o.accionDeOportunidad(op({ accion: 'magia' })).tipo, 'ficha');
});

test('la ventana de 24 h dice cuánto le queda', () => {
  assert.equal(o.cierraEn('2026-10-13T20:30:00.000Z', AHORA), 'se cierra en 5 h');
  assert.equal(o.cierraEn('2026-10-13T15:40:00.000Z', AHORA), 'se cierra en 40 min');
  assert.equal(o.cierraEn('2026-10-13T15:00:20.000Z', AHORA), 'se cierra en 1 min');
  assert.equal(o.cierraEn('2026-10-13T14:00:00.000Z', AHORA), null);
  assert.equal(o.cierraEn(undefined, AHORA), null);
});

test('íconos por tipo, sin romper con uno nuevo', () => {
  assert.equal(o.iconoOportunidad('ventana_24h'), '⏳');
  assert.equal(o.iconoOportunidad('promesa'), '🤝');
  assert.equal(o.iconoOportunidad('desconocido'), '💡');
  assert.ok(o.esTipoOportunidad('precio_sin_respuesta'));
  assert.ok(!o.esTipoOportunidad('x'));
  assert.ok(!o.esTipoOportunidad(null));
});

test('descartar la saca de "Hoy" sin tocar lo demás', () => {
  const hoy = { reuniones: [], tareas: [], sinRespuesta: [], oportunidades: [op(), op({ id: 'promesa:L2', tipo: 'promesa' })], generadoEn: '' };
  igual(o.sinOportunidad(hoy, 'no_show:L1').oportunidades.map((x) => x.id), ['promesa:L2']);
  assert.equal(hoy.oportunidades.length, 2, 'no muta el original');
});
