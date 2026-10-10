import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorDia, avisoConfirmacionCalendario, volverTrasLoginCalendario, inicioDelDiaLima } from '../lib/agenda.ts';

test('agrupa por día de Lima y ordena por hora', () => {
  const citas = [
    { id: 'b', inicio: '2026-09-29T01:00:00.000Z' }, // lunes 28 20:00 Lima
    { id: 'a', inicio: '2026-09-28T15:00:00.000Z' }, // lunes 28 10:00 Lima
    { id: 'c', inicio: '2026-09-29T15:00:00.000Z' }, // martes 29
  ];
  const g = agruparPorDia(citas);
  assert.deepEqual(g.map((d) => d.dia), ['2026-09-28', '2026-09-29']);
  assert.deepEqual(g[0].citas.map((c) => c.id), ['a', 'b']);
});

test('confirmar calendario: cada status da el mensaje que corresponde', () => {
  assert.equal(avisoConfirmacionCalendario(404, 'x'), 'La conexión venció. Vuelve a conectar tu calendario.');
  assert.equal(
    avisoConfirmacionCalendario(403, 'x'),
    'Esta conexión la inició otra cuenta de LeadAI. Entra con la cuenta correcta y vuelve a conectar.',
  );
  assert.equal(avisoConfirmacionCalendario(401, 'x'), 'Tu sesión venció. Vuelve a entrar y conecta tu calendario de nuevo.');
  // Cualquier otro error: el mensaje del backend, o uno genérico si no hay.
  assert.equal(avisoConfirmacionCalendario(500, 'Google no respondió'), 'Google no respondió');
  assert.equal(avisoConfirmacionCalendario(0), 'No se pudo conectar tu calendario. Inténtalo de nuevo.');
});

test('login sin sesión: vuelve a confirmar el calendario pendiente', () => {
  assert.equal(
    volverTrasLoginCalendario('/configuracion', '?tab=calendario&pendiente=abc123'),
    '/configuracion?tab=calendario&pendiente=abc123',
  );
  // El id se re-codifica: nunca se arma una URL con lo que venga crudo.
  assert.equal(
    volverTrasLoginCalendario('/configuracion', '?tab=calendario&pendiente=a%26b'),
    '/configuracion?tab=calendario&pendiente=a%26b',
  );
  // Sin pendiente, u otra ruta: nada que recordar (el login decide como siempre).
  assert.equal(volverTrasLoginCalendario('/configuracion', '?tab=calendario&calendario=cancelado'), null);
  assert.equal(volverTrasLoginCalendario('/inicio', '?pendiente=abc'), null);
  assert.equal(volverTrasLoginCalendario('/configuracion', ''), null);
});

test('el "hoy" de la agenda empieza a las 00:00 de Lima, no del navegador', () => {
  // 23:30 del lunes 28 en Lima = 04:30Z del martes 29: sigue siendo lunes.
  assert.equal(inicioDelDiaLima(new Date('2026-09-29T04:30:00.000Z')).toISOString(), '2026-09-28T05:00:00.000Z');
  // 00:10 del martes 29 en Lima.
  assert.equal(inicioDelDiaLima(new Date('2026-09-29T05:10:00.000Z')).toISOString(), '2026-09-29T05:00:00.000Z');
});

test('filtrar por quién atiende usa el id cuando la cita lo trae', async () => {
  const { citaDeQuien } = await import('../lib/agenda.ts');
  const ana1 = { atiende: 'Ana', atiendeId: 'u1' };
  const ana2 = { atiende: 'Ana', atiendeId: 'u2' };
  const vieja = { atiende: 'Ana', atiendeId: null };
  assert.equal(citaDeQuien(ana1, { id: 'u1', nombre: 'Ana' }), true);
  assert.equal(citaDeQuien(ana2, { id: 'u1', nombre: 'Ana' }), false, 'homónima: otra persona');
  assert.equal(citaDeQuien(vieja, { id: 'u1', nombre: 'Ana' }), true, 'sin id en la cita, por nombre');
  assert.equal(citaDeQuien(ana2, { id: null, nombre: 'Ana' }), true, 'link viejo: por nombre');
  assert.equal(citaDeQuien(ana1, null), true);
});

test('el filtro aprende el id (o el nombre) de las citas', async () => {
  const { completarFiltroAtiende } = await import('../lib/agenda.ts');
  const citas = [{ atiende: 'Ana', atiendeId: 'u1' }, { atiende: 'Luis', atiendeId: 'u3' }];
  assert.deepEqual(completarFiltroAtiende({ id: null, nombre: 'Ana' }, citas), { id: 'u1', nombre: 'Ana' });
  assert.deepEqual(completarFiltroAtiende({ id: 'u3', nombre: '' }, citas), { id: 'u3', nombre: 'Luis' });
  const homonimas = [...citas, { atiende: 'Ana', atiendeId: 'u2' }];
  const f = { id: null, nombre: 'Ana' };
  assert.equal(completarFiltroAtiende(f, homonimas), f, 'con dos Anas no adivina');
});
