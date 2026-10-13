import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

// Lo que devuelve el módulo nace en otro contexto (vm): se compara como JSON.
const igual = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

/** CRM FASE 1 (2026-10-13): "Hoy", próximo paso e historial del lead. */
const crm = cargarModulo('lib/crm.ts');

// Martes 13 de octubre de 2026, 10:00 de Lima (15:00Z).
const AHORA = new Date('2026-10-13T15:00:00.000Z');

test('los atajos de "¿cuándo?" cuentan en días de Lima', () => {
  assert.equal(crm.diaDeAtajo('hoy', AHORA), '2026-10-13');
  assert.equal(crm.diaDeAtajo('manana', AHORA), '2026-10-14');
  assert.equal(crm.diaDeAtajo('dos_dias', AHORA), '2026-10-15');
  // El próximo lunes.
  assert.equal(crm.diaDeAtajo('lunes', AHORA), '2026-10-19');
  // Un lunes, "lunes" es el de la semana que viene (para hoy está "Hoy").
  assert.equal(crm.diaDeAtajo('lunes', new Date('2026-10-19T15:00:00.000Z')), '2026-10-26');
  // Domingo → al día siguiente.
  assert.equal(crm.diaDeAtajo('lunes', new Date('2026-10-18T15:00:00.000Z')), '2026-10-19');
  // A las 11 p. m. de Lima ya es el día siguiente en UTC, pero sigue siendo "hoy" en Lima.
  assert.equal(crm.diaDeAtajo('hoy', new Date('2026-10-14T04:00:00.000Z')), '2026-10-13');
});

test('venceEn: con hora a esa hora de Lima; sin hora, "ese día" a las 9:00', () => {
  igual(crm.venceEnDe('2026-10-14', '15:30'), { venceEn: '2026-10-14T20:30:00.000Z', conHora: true });
  igual(crm.venceEnDe('2026-10-14', null), { venceEn: '2026-10-14T14:00:00.000Z', conHora: false });
  igual(crm.venceEnDe('2026-10-14', ''), { venceEn: '2026-10-14T14:00:00.000Z', conHora: false });
});

test('posponer mueve el día desde HOY y conserva la hora si la tenía', () => {
  // Vencía el viernes pasado a las 16:00: "mañana" es mañana, a las 16:00.
  const conHora = { venceEn: '2026-10-09T21:00:00.000Z', conHora: true };
  igual(crm.pospuesta(conHora, 'manana', AHORA), { venceEn: '2026-10-14T21:00:00.000Z', conHora: true });
  igual(crm.pospuesta(conHora, 'lunes', AHORA), { venceEn: '2026-10-19T21:00:00.000Z', conHora: true });
  const sinHora = { venceEn: '2026-10-13T14:00:00.000Z', conHora: false };
  igual(crm.pospuesta(sinHora, 'dos_dias', AHORA), { venceEn: '2026-10-15T14:00:00.000Z', conHora: false });
});

test('atrasado: con hora desde esa hora; "ese día" recién al día siguiente', () => {
  assert.equal(crm.tareaAtrasada({ venceEn: '2026-10-13T14:00:00.000Z', conHora: true }, AHORA), true);
  assert.equal(crm.tareaAtrasada({ venceEn: '2026-10-13T16:00:00.000Z', conHora: true }, AHORA), false);
  // "Llamar hoy" no está atrasado a las 10 de la mañana.
  assert.equal(crm.tareaAtrasada({ venceEn: '2026-10-13T14:00:00.000Z', conHora: false }, AHORA), false);
  assert.equal(crm.tareaAtrasada({ venceEn: '2026-10-12T14:00:00.000Z', conHora: false }, AHORA), true);
});

test('cuándo se lee como lo diría una persona', () => {
  assert.equal(crm.cuandoTarea({ venceEn: '2026-10-13T20:00:00.000Z', conHora: true }, AHORA), 'Hoy · 15:00');
  assert.equal(crm.cuandoTarea({ venceEn: '2026-10-14T14:00:00.000Z', conHora: false }, AHORA), 'Mañana');
  assert.equal(crm.cuandoTarea({ venceEn: '2026-10-12T14:00:00.000Z', conHora: false }, AHORA), 'Atrasado · ayer');
  assert.equal(crm.cuandoTarea({ venceEn: '2026-10-16T14:00:00.000Z', conHora: false }, AHORA), 'Vie 16 oct');
  assert.equal(crm.cuandoTarea({ venceEn: '2027-01-04T14:00:00.000Z', conHora: false }, AHORA), 'Lun 4 ene 2027');
});

test('el título del paso: el detalle si lo hay, si no "Llamar a Ana"', () => {
  assert.equal(crm.tituloTarea({ tipo: 'llamar', titulo: null }, 'Ana'), 'Llamar a Ana');
  assert.equal(crm.tituloTarea({ tipo: 'mandar_info', titulo: '  ' }, null), 'Mandarle info a este cliente');
  assert.equal(crm.tituloTarea({ tipo: 'otro', titulo: 'Pasarle la cotización' }, 'Ana'), 'Pasarle la cotización');
  assert.equal(crm.tituloTarea({ tipo: 'raro' }, 'Ana'), 'Pendiente con Ana');
});

test('esperando hace X', () => {
  assert.equal(crm.esperandoTexto(25), 'Esperando hace 25 min');
  assert.equal(crm.esperandoTexto(130), 'Esperando hace 2 h');
  assert.equal(crm.esperandoTexto(60 * 24), 'Esperando hace 1 día');
  assert.equal(crm.esperandoTexto(60 * 24 * 3 + 5), 'Esperando hace 3 días');
});

test('fecha relativa del historial', () => {
  assert.equal(crm.fechaRelativa('2026-10-13T14:59:40.000Z', AHORA), 'recién');
  assert.equal(crm.fechaRelativa('2026-10-13T14:35:00.000Z', AHORA), 'hace 25 min');
  assert.equal(crm.fechaRelativa('2026-10-13T12:00:00.000Z', AHORA), 'hace 3 h');
  assert.equal(crm.fechaRelativa('2026-10-12T20:30:00.000Z', AHORA), 'ayer 15:30');
  assert.equal(crm.fechaRelativa('2026-10-05T20:30:00.000Z', AHORA), 'lun 5 oct');
  // Lo que todavía no pasa (una reunión agendada): día y hora.
  assert.equal(crm.fechaRelativa('2026-10-14T15:00:00.000Z', AHORA), 'mañana 10:00');
});

function hoyDe(parcial = {}) {
  return { reuniones: [], tareas: [], sinRespuesta: [], oportunidades: [], generadoEn: AHORA.toISOString(), ...parcial };
}
const tarea = (id, venceEn, conHora = false, estado = 'pendiente') => ({
  id, leadId: `L${id}`, tenantId: 'T1', tipo: 'llamar', titulo: null, venceEn, conHora,
  asignadoA: null, asignadoNombre: null, estado, vencida: false, hechaEn: null, creadoEn: venceEn,
  lead: { id: `L${id}`, nombre: `Lead ${id}`, telefono: null, tenantId: 'T1', negocio: 'Sania' },
});

test('"Hoy" agrupado: atrasado antes que lo de hoy, reuniones por hora, el que espera más primero', () => {
  const g = crm.agruparHoy(hoyDe({
    reuniones: [
      { citaId: 'c2', inicio: '2026-10-13T20:00:00.000Z', fin: '2026-10-13T20:30:00.000Z', estado: 'confirmada' },
      { citaId: 'c1', inicio: '2026-10-13T16:00:00.000Z', fin: '2026-10-13T16:30:00.000Z', estado: 'confirmada' },
      { citaId: 'c3', inicio: '2026-10-13T17:00:00.000Z', fin: '2026-10-13T17:30:00.000Z', estado: 'cancelada' },
    ],
    tareas: [
      tarea('hoy-tarde', '2026-10-13T21:00:00.000Z', true),
      tarea('ayer', '2026-10-12T14:00:00.000Z'),
      tarea('hoy-dia', '2026-10-13T14:00:00.000Z'),
      tarea('hace-rato', '2026-10-13T13:00:00.000Z', true),
      tarea('hecha', '2026-10-12T14:00:00.000Z', false, 'hecha'),
    ],
    sinRespuesta: [
      { leadId: 'b', ultimoEntranteEn: '2026-10-13T14:00:00.000Z', esperandoMin: 60 },
      { leadId: 'a', ultimoEntranteEn: '2026-10-12T14:00:00.000Z', esperandoMin: 1500 },
    ],
  }), AHORA);
  igual(g.reuniones.map((r) => r.citaId), ['c1', 'c2']);
  igual(g.atrasadas.map((t) => t.id), ['ayer', 'hace-rato']);
  igual(g.deHoy.map((t) => t.id), ['hoy-dia', 'hoy-tarde']);
  igual(g.sinRespuesta.map((s) => s.leadId), ['a', 'b']);
  assert.equal(g.vacio, false);
  assert.equal(crm.agruparHoy(hoyDe(), AHORA).vacio, true);
  igual(crm.tareasAtrasadas(null, AHORA), []);
});

test('posponer en "Hoy": si sale de hoy desaparece; si sigue hoy, cambia la hora', () => {
  const h = hoyDe({ tareas: [tarea('x', '2026-10-13T14:00:00.000Z', true), tarea('y', '2026-10-13T14:00:00.000Z')] });
  const movida = crm.conTareaMovida(h, { id: 'x', venceEn: '2026-10-14T14:00:00.000Z', conHora: true }, AHORA);
  igual(movida.tareas.map((t) => t.id), ['y']);
  const tarde = crm.conTareaMovida(h, { id: 'x', venceEn: '2026-10-13T22:00:00.000Z', conHora: true }, AHORA);
  assert.equal(tarde.tareas.find((t) => t.id === 'x').venceEn, '2026-10-13T22:00:00.000Z');
  igual(crm.sinTarea(h, 'y').tareas.map((t) => t.id), ['x']);
});

const item = (parcial) => ({ id: 'act_1', tipo: 'apunte', fecha: '2026-10-13T14:35:00.000Z', texto: null, autor: null, datos: null, ...parcial });

test('historial: cada tipo dice qué pasó, quién y a dónde lleva', () => {
  const ctx = { ahora: AHORA, etapas: new Map([['e-demo', 'Agendó demo']]), personas: new Map([['u1', 'Guisella']]) };

  const apunte = crm.describirItem(item({ texto: 'Quiere el plan de 3 doctores', autor: { id: 'u1', nombre: 'Guisella' } }), ctx);
  assert.equal(apunte.icono, '📝');
  assert.equal(apunte.titulo, 'Apunte');
  assert.equal(apunte.detalle, 'Quiere el plan de 3 doctores');
  assert.equal(apunte.autor, 'Guisella');
  assert.equal(apunte.fecha, 'hace 25 min');

  const etapa = crm.describirItem(item({ tipo: 'etapa', datos: { de: 'nuevo', a: 'escalado', etapaId: 'e-demo' } }), ctx);
  assert.equal(etapa.titulo, 'Pasó de Nuevo a Agendó demo');
  assert.equal(etapa.autor, 'Automático');

  assert.equal(crm.describirItem(item({ tipo: 'asignado', datos: { a: 'u1' } }), ctx).titulo, 'Se le asignó a Guisella');
  assert.equal(crm.describirItem(item({ tipo: 'asignado', datos: { a: null } }), ctx).titulo, 'Quedó sin asignar');
  assert.equal(crm.describirItem(item({ tipo: 'pago', datos: { centavos: 29900 } }), ctx).titulo, 'Pagó S/299.00');
  assert.equal(
    crm.describirItem(item({ tipo: 'etiquetas', datos: { agregadas: ['VIP'], quitadas: ['Frío'] } }), ctx).detalle,
    '+ VIP · − Frío',
  );

  const reunion = crm.describirItem(item({
    id: 'cita_c9', tipo: 'reunion', fecha: '2026-10-14T15:00:00.000Z',
    datos: { citaId: 'c9', inicio: '2026-10-14T15:00:00.000Z', fin: '2026-10-14T15:30:00.000Z', estado: 'confirmada', resultado: null },
  }), ctx);
  assert.equal(reunion.titulo, 'Reunión el miércoles 14 de octubre a las 10:00');
  assert.equal(reunion.enlace.href, '/agenda?fecha=2026-10-14&cita=c9&vista=dia');
  assert.equal(reunion.autor, null);

  const pasada = crm.describirItem(item({
    tipo: 'reunion', datos: { citaId: 'c8', inicio: '2026-10-12T15:00:00.000Z', resultado: 'no_contesto', notaResultado: 'Llamar el jueves' },
  }), ctx);
  assert.equal(pasada.titulo, 'Reunión del lunes 12 de octubre');
  assert.equal(pasada.detalle, 'No contestó · Llamar el jueves');

  const campania = crm.describirItem(item({ id: 'camp_e1', tipo: 'campania', datos: { campaniaId: 'k1', nombre: 'Promo octubre', estado: 'enviado' } }), ctx);
  assert.equal(campania.titulo, 'Le llegó la campaña "Promo octubre"');
  assert.equal(campania.enlace.href, '/marketing?t=campanias&campania=k1');

  const comentario = crm.describirItem(item({ tipo: 'comentario', datos: { red: 'instagram', texto: '¿Precio?', permalink: 'https://instagram.com/p/x' } }), ctx);
  assert.equal(comentario.titulo, 'Comentó en Instagram');
  assert.equal(comentario.enlace.externo, true);
  // Un permalink que no es http(s) no se vuelve link.
  assert.equal(crm.describirItem(item({ tipo: 'comentario', datos: { permalink: 'javascript:alert(1)' } }), ctx).enlace, null);

  assert.equal(crm.describirItem(item({ tipo: 'tarea_creada', datos: { tipo: 'llamar', venceEn: '2026-10-14T14:00:00.000Z' } }), ctx).detalle, 'Para mañana');

  // Un tipo que esta web no conoce se muestra con su texto, sin romper.
  const raro = crm.describirItem(item({ tipo: 'algo_nuevo', texto: 'Pasó algo' }), ctx);
  assert.equal(raro.titulo, 'Pasó algo');
  assert.equal(raro.icono, '•');
});

test('"Ver más" junta las páginas sin repetidos y de lo más nuevo a lo más viejo', () => {
  const a = item({ id: 'a', fecha: '2026-10-13T10:00:00.000Z' });
  const b = item({ id: 'b', fecha: '2026-10-12T10:00:00.000Z' });
  const c = item({ id: 'c', fecha: '2026-10-11T10:00:00.000Z' });
  igual(crm.juntarHistorial([a, b], [b, c]).map((x) => x.id), ['a', 'b', 'c']);
});
