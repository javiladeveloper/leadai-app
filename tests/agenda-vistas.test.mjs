import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diaLima, hoyLima, sumarDias, diaDeSemana, inicioDeDiaUtc, minutosLima, horaLima,
  diasDeCuadriculaMes, diasDeSemana, rangoDeVista, moverPeriodo, tituloDePeriodo,
  posicionarEnDia, rangoDeHoras, tipoDeCita, coloresDeNegocios, resumenDelDia, esVista,
} from '../lib/agenda.ts';

test('diaLima / hoyLima: el día se lee en Lima (UTC-5), no en el huso del proceso', () => {
  // 23:30 del lunes 28 en Lima = 04:30Z del martes 29.
  assert.equal(diaLima('2026-09-29T04:30:00.000Z'), '2026-09-28');
  assert.equal(diaLima('2026-09-29T05:00:00.000Z'), '2026-09-29');
  assert.equal(hoyLima(new Date('2026-09-29T04:59:59.000Z')), '2026-09-28');
  assert.equal(minutosLima('2026-09-28T15:30:00.000Z'), 10 * 60 + 30);
  assert.equal(horaLima('2026-09-28T15:05:00.000Z'), '10:05');
  assert.equal(horaLima('2026-09-29T04:30:00.000Z'), '23:30');
});

test('sumarDias y diaDeSemana (lunes = 0) cruzan meses y años', () => {
  assert.equal(sumarDias('2026-12-31', 1), '2027-01-01');
  assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(diaDeSemana('2026-09-28'), 0); // lunes
  assert.equal(diaDeSemana('2026-10-04'), 6); // domingo
  assert.equal(inicioDeDiaUtc('2026-09-28').toISOString(), '2026-09-28T05:00:00.000Z');
});

test('cuadrícula de mes: sep 2026 empieza martes → la primera fila arranca el lunes 31 ago; 42 días', () => {
  const dias = diasDeCuadriculaMes('2026-09-17');
  assert.equal(dias.length, 42);
  assert.equal(dias[0], '2026-08-31');
  assert.equal(dias[1], '2026-09-01');
  assert.equal(dias[41], '2026-10-11');
  for (let i = 0; i < 42; i += 7) assert.equal(diaDeSemana(dias[i]), 0);
  // Un mes que empieza lunes arranca ese mismo día (junio 2026).
  assert.equal(diasDeCuadriculaMes('2026-06-10')[0], '2026-06-01');
});

test('semana: lunes a domingo, aunque la fecha sea domingo', () => {
  assert.deepEqual(diasDeSemana('2026-10-04'), [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  ]);
  assert.equal(diasDeSemana('2026-09-28')[0], '2026-09-28');
});

test('rangoDeVista: desde/hasta en 00:00 de Lima, y nunca más de 92 días', () => {
  const mes = rangoDeVista('mes', '2026-09-17');
  assert.equal(mes.desde.toISOString(), '2026-08-31T05:00:00.000Z');
  assert.equal(mes.hasta.toISOString(), '2026-10-12T05:00:00.000Z');
  assert.equal(mes.dias.length, 42);

  const semana = rangoDeVista('semana', '2026-10-01');
  assert.equal(semana.desde.toISOString(), '2026-09-28T05:00:00.000Z');
  assert.equal(semana.hasta.toISOString(), '2026-10-05T05:00:00.000Z');

  const dia = rangoDeVista('dia', '2026-10-01');
  assert.equal(dia.desde.toISOString(), '2026-10-01T05:00:00.000Z');
  assert.equal(dia.hasta.toISOString(), '2026-10-02T05:00:00.000Z');
  assert.deepEqual(dia.dias, ['2026-10-01']);

  const lista = rangoDeVista('lista', '2026-09-27');
  assert.equal(lista.desde.toISOString(), '2026-09-27T05:00:00.000Z');
  assert.equal(lista.dias.length, 30);
  assert.equal(lista.dias[29], '2026-10-26');

  for (const v of ['mes', 'semana', 'dia', 'lista']) {
    const r = rangoDeVista(v, '2026-02-15');
    const dias = (r.hasta.getTime() - r.desde.getTime()) / 86_400_000;
    assert.ok(dias > 0 && dias <= 92, `${v}: ${dias} días`);
  }
});

test('moverPeriodo: mes salta al día 1, semana ±7, día ±1, lista ±30; cruza años', () => {
  assert.equal(moverPeriodo('mes', '2026-12-15', 1), '2027-01-01');
  assert.equal(moverPeriodo('mes', '2027-01-31', -1), '2026-12-01');
  assert.equal(moverPeriodo('mes', '2026-01-31', 1), '2026-02-01');
  assert.equal(moverPeriodo('semana', '2026-12-30', 1), '2027-01-06');
  assert.equal(moverPeriodo('dia', '2026-12-31', 1), '2027-01-01');
  assert.equal(moverPeriodo('dia', '2026-03-01', -1), '2026-02-28');
  assert.equal(moverPeriodo('lista', '2026-09-27', 1), '2026-10-27');
});

test('tituloDePeriodo en español', () => {
  assert.equal(tituloDePeriodo('mes', '2026-10-15'), 'octubre 2026');
  assert.equal(tituloDePeriodo('semana', '2026-09-30'), '28 sep – 4 oct 2026');
  assert.equal(tituloDePeriodo('semana', '2026-12-30'), '28 dic 2026 – 3 ene 2027');
  assert.equal(tituloDePeriodo('semana', '2026-10-07'), '5 – 11 oct 2026');
  assert.equal(tituloDePeriodo('dia', '2026-09-28'), 'lunes 28 de septiembre');
  assert.equal(tituloDePeriodo('lista', '2026-09-27'), '27 sep – 26 oct 2026');
});

const cita = (id, inicioLima, finLima, extra = {}) => ({
  id,
  inicio: new Date(`${inicioLima}-05:00`).toISOString(),
  fin: new Date(`${finLima}-05:00`).toISOString(),
  ...extra,
});

test('posicionarEnDia: minutos desde la hora de arranque y alto por duración', () => {
  const [p] = posicionarEnDia([cita('a', '2026-09-28T10:00:00', '2026-09-28T10:30:00')], '2026-09-28', 7);
  assert.equal(p.desdeMin, 180);
  assert.equal(p.hastaMin, 210);
  assert.equal(p.columna, 0);
  assert.equal(p.columnas, 1);
});

test('posicionarEnDia: las que se solapan van lado a lado; las que no, a ancho completo', () => {
  const pos = posicionarEnDia([
    cita('a', '2026-09-28T10:00:00', '2026-09-28T11:00:00'),
    cita('b', '2026-09-28T10:30:00', '2026-09-28T11:30:00'),
    cita('c', '2026-09-28T11:00:00', '2026-09-28T11:15:00'), // solapa con b, no con a → reusa la columna 0
    cita('d', '2026-09-28T15:00:00', '2026-09-28T15:30:00'), // sola
  ], '2026-09-28', 7);
  const por = Object.fromEntries(pos.map((p) => [p.cita.id, p]));
  assert.equal(por.a.columna, 0);
  assert.equal(por.b.columna, 1);
  assert.equal(por.c.columna, 0);
  assert.equal(por.a.columnas, 2);
  assert.equal(por.b.columnas, 2);
  assert.equal(por.c.columnas, 2);
  assert.equal(por.d.columna, 0);
  assert.equal(por.d.columnas, 1);
});

test('posicionarEnDia: una cita muy corta ocupa al menos 15 min y una que pasa medianoche se corta', () => {
  const pos = posicionarEnDia([
    cita('corta', '2026-09-28T09:00:00', '2026-09-28T09:05:00'),
    cita('tarde', '2026-09-28T23:30:00', '2026-09-29T00:30:00'),
  ], '2026-09-28', 0);
  const por = Object.fromEntries(pos.map((p) => [p.cita.id, p]));
  assert.equal(por.corta.hastaMin - por.corta.desdeMin, 15);
  assert.equal(por.tarde.hastaMin, 24 * 60);
});

test('rangoDeHoras: 7–22 por defecto, se amplía si hay citas fuera', () => {
  assert.deepEqual(rangoDeHoras([]), { desde: 7, hasta: 22 });
  assert.deepEqual(rangoDeHoras([cita('a', '2026-09-28T10:00:00', '2026-09-28T11:00:00')]), { desde: 7, hasta: 22 });
  assert.deepEqual(
    rangoDeHoras([
      cita('a', '2026-09-28T06:30:00', '2026-09-28T07:00:00'),
      cita('b', '2026-09-28T22:15:00', '2026-09-28T22:45:00'),
    ]),
    { desde: 6, hasta: 23 },
  );
  assert.deepEqual(rangoDeHoras([cita('c', '2026-09-28T23:30:00', '2026-09-29T00:30:00')]), { desde: 7, hasta: 24 });
});

test('tipoDeCita: ≤15 min o link de cal.com → demo; si no, llamada', () => {
  assert.equal(tipoDeCita(cita('a', '2026-09-28T10:00:00', '2026-09-28T10:15:00', { meetLink: null })), 'demo');
  assert.equal(tipoDeCita(cita('b', '2026-09-28T10:00:00', '2026-09-28T10:30:00', { meetLink: 'https://app.cal.com/video/x' })), 'demo');
  assert.equal(tipoDeCita(cita('b2', '2026-09-28T10:00:00', '2026-09-28T10:30:00', { meetLink: 'https://cal.com/video/x' })), 'demo');
  assert.equal(tipoDeCita(cita('c', '2026-09-28T10:00:00', '2026-09-28T10:30:00', { meetLink: 'https://meet.google.com/abc' })), 'llamada');
  assert.equal(tipoDeCita(cita('d', '2026-09-28T10:00:00', '2026-09-28T11:00:00', { meetLink: null })), 'llamada');
  // Un dominio que solo "contiene" cal.com no cuenta.
  assert.equal(tipoDeCita(cita('e', '2026-09-28T10:00:00', '2026-09-28T11:00:00', { meetLink: 'https://notcal.com.evil.io/x' })), 'llamada');
  assert.equal(tipoDeCita(cita('f', '2026-09-28T10:00:00', '2026-09-28T11:00:00', { meetLink: 'no es url' })), 'llamada');
});

test('coloresDeNegocios: el color depende del orden del tenantId, no del orden de llegada', () => {
  const a = coloresDeNegocios(['t-b', 't-a', 't-c', 't-a']);
  const b = coloresDeNegocios(['t-c', 't-a', 't-b']);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
  assert.equal(a.get('t-a'), 0);
  assert.equal(a.get('t-b'), 1);
  assert.equal(a.get('t-c'), 2);
  // Da la vuelta a la paleta.
  const muchos = coloresDeNegocios(Array.from({ length: 10 }, (_, i) => `t${i}`), 8);
  assert.equal(muchos.get('t8'), 0);
});

test('resumenDelDia: hasta 3 y el resto como "+N más"', () => {
  assert.deepEqual(resumenDelDia([1, 2], 3), { mostradas: [1, 2], resto: 0 });
  assert.deepEqual(resumenDelDia([1, 2, 3, 4, 5], 3), { mostradas: [1, 2, 3], resto: 2 });
});

test('esVista valida lo que venga de localStorage', () => {
  assert.equal(esVista('mes'), true);
  assert.equal(esVista('lista'), true);
  assert.equal(esVista('anio'), false);
  assert.equal(esVista(null), false);
});
