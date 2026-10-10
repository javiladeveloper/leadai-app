import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  urlLead, urlLeads, urlCalientesSinAtender, esCalienteSinAtender, cumpleEstado, cumpleOrigen,
  urlAgenda, urlGestionarAnuncio, urlLeadsDeAnuncio, reunionUnible, telefonoDe, correoDe,
  URL_CONECTAR_CANALES, URL_MI_PLAN,
} from '../lib/enlaces.ts';

/** TODO CONECTADO (2026-10-09): un solo destino por cosa en toda la web. */

test('la ficha de un lead es Conversaciones con ?lead= (y el negocio si viene)', () => {
  assert.equal(urlLead('L1'), '/conversaciones?lead=L1');
  assert.equal(urlLead('L1', { tenant: 'T9' }), '/conversaciones?lead=L1&negocio=T9');
  assert.equal(urlLead('L1', { tenant: null }), '/conversaciones?lead=L1');
});

test('la lista de leads lleva solo los filtros que vienen', () => {
  assert.equal(urlLeads(), '/leads');
  assert.equal(urlLeads({ nivel: 'caliente', estado: '' }), '/leads?nivel=caliente');
  assert.equal(urlLeadsDeAnuncio('123'), '/leads?origen=ad%3A123');
  assert.equal(urlLeadsDeAnuncio('ad:123'), '/leads?origen=ad%3A123');
});

test('calientes sin atender = la regla del backend: caliente y ni ganado ni perdido', () => {
  assert.equal(urlCalientesSinAtender(), '/leads?nivel=caliente&estado=abiertos');
  assert.equal(esCalienteSinAtender({ nivelInteres: 'caliente', estado: 'escalado' }), true);
  assert.equal(esCalienteSinAtender({ nivelInteres: 'caliente', estado: 'ganado' }), false);
  assert.equal(esCalienteSinAtender({ nivelInteres: 'tibio', estado: 'nuevo' }), false);
  assert.equal(cumpleEstado({ estado: 'nutriendo' }, 'abiertos'), true);
  assert.equal(cumpleEstado({ estado: 'perdido' }, 'abiertos'), false);
  assert.equal(cumpleEstado({ estado: 'perdido' }, 'todos'), true);
});

test('el origen se filtra por etiqueta, por id de anuncio y "directo" = sin etiqueta', () => {
  assert.equal(cumpleOrigen({ origenEtiqueta: 'ad:55' }, 'ad:55'), true);
  assert.equal(cumpleOrigen({ origenEtiqueta: null, origen: { adId: '55' } }, 'ad:55'), true);
  assert.equal(cumpleOrigen({ origenEtiqueta: 'comentario' }, 'directo'), false);
  assert.equal(cumpleOrigen({ origenEtiqueta: null }, 'directo'), true);
  assert.equal(cumpleOrigen({ origenEtiqueta: 'ad:1' }, undefined), true);
});

test('agenda, anuncios, plan y canales tienen un solo destino', () => {
  assert.equal(urlAgenda({ fecha: '2026-10-09', cita: 'c1' }), '/agenda?fecha=2026-10-09&cita=c1');
  assert.equal(urlGestionarAnuncio('ad:77'), '/marketing?t=anuncios&ad=77');
  assert.equal(URL_CONECTAR_CANALES, '/configuracion?tab=canales');
  assert.equal(URL_MI_PLAN, '/mi-plan');
});

test('"Unirse" aparece 15 minutos antes y mientras dura la reunión', () => {
  const r = { inicio: '2026-10-09T15:00:00.000Z', fin: '2026-10-09T15:30:00.000Z' };
  assert.equal(reunionUnible(r, new Date('2026-10-09T14:40:00.000Z')), false);
  assert.equal(reunionUnible(r, new Date('2026-10-09T14:46:00.000Z')), true);
  assert.equal(reunionUnible(r, new Date('2026-10-09T15:20:00.000Z')), true);
  assert.equal(reunionUnible(r, new Date('2026-10-09T15:31:00.000Z')), false);
});

test('contacto: teléfono solo donde es un número, correo donde hay uno', () => {
  assert.equal(telefonoDe('whatsapp', '51987654321'), '51987654321');
  assert.equal(telefonoDe('externo', '987 654 321'), '51987654321');
  assert.equal(telefonoDe('instagram', '17841400000000000'), null);
  assert.equal(telefonoDe(undefined, 'ana@correo.pe'), null);
  assert.equal(correoDe('Escribir a ana@correo.pe'), 'ana@correo.pe');
  assert.equal(correoDe('987654321'), null);
});
