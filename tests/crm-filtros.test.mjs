import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

// Lo que devuelve el módulo nace en otro contexto (vm): se compara como JSON.
const igual = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

/** CRM FASE 2 (2026-10-13): filtros en la URL, búsqueda, filas y embudo. */
const f = cargarModulo('lib/crm-filtros.ts');
const enlaces = cargarModulo('lib/enlaces.ts');
const etapas = cargarModulo('lib/etapas.ts');

// Martes 13 de octubre de 2026, 10:00 de Lima (15:00Z).
const AHORA = new Date('2026-10-13T15:00:00.000Z');
const haceMin = (m) => new Date(AHORA.getTime() - m * 60_000).toISOString();

const lead = (extra = {}) => ({
  id: 'L1', nombre: 'Ana Pérez', contactoExterno: '51987654321', canalOrigen: 'whatsapp', nivelInteres: 'tibio',
  estado: 'nutriendo', resumenIA: null, borradorIA: null, nota: null, origenEtiqueta: null,
  creadoEn: '2026-10-01T15:00:00.000Z', actualizadoEn: '2026-10-01T15:00:00.000Z', ultimoMensajeEn: haceMin(30),
  ...extra,
});

test('los filtros van y vuelven por la URL sin perder lo demás', () => {
  const filtros = {
    q: 'ana', etiquetas: ['VIP', 'Odontología'], asignado: 'yo', sinRespuesta: true,
    origen: 'ad:123', fecha: '7d', orden: 'esperando',
  };
  const qs = f.escribirFiltrosCrm(filtros, new URLSearchParams('lead=L9&negocio=T1&nivel=caliente'));
  // Lo que no es de los filtros se queda.
  assert.equal(qs.get('lead'), 'L9');
  assert.equal(qs.get('negocio'), 'T1');
  assert.equal(qs.get('nivel'), 'caliente');
  // La etiqueta se repite.
  igual(qs.getAll('etiqueta'), ['VIP', 'Odontología']);
  igual(f.leerFiltrosCrm(qs), filtros);
});

test('lo que está por defecto no se escribe: sin filtros, URL limpia', () => {
  assert.equal(f.escribirFiltrosCrm(f.FILTROS_CRM_VACIOS).toString(), '');
  igual(f.leerFiltrosCrm(new URLSearchParams('')), JSON.parse(JSON.stringify(f.FILTROS_CRM_VACIOS)));
  assert.equal(f.hayFiltrosCrm(f.FILTROS_CRM_VACIOS), false);
  // El orden no saca a nadie: no cuenta como filtro.
  assert.equal(f.hayFiltrosCrm({ ...f.FILTROS_CRM_VACIOS, orden: 'esperando' }), false);
  assert.equal(f.hayFiltrosCrm({ ...f.FILTROS_CRM_VACIOS, etiquetas: ['VIP'] }), true);
});

test('los links viejos siguen abriendo lo mismo (buscar, buzon) y lo inválido se ignora', () => {
  const viejo = f.leerFiltrosCrm(new URLSearchParams('buscar=Rosa&buzon=mios&orden=raro&fecha=ayer'));
  assert.equal(viejo.q, 'Rosa');
  assert.equal(viejo.asignado, 'yo');
  assert.equal(viejo.orden, 'reciente');
  assert.equal(viejo.fecha, '');
  assert.equal(f.leerFiltrosCrm(new URLSearchParams('buzon=sin')).asignado, 'sin');
  // `asignado` manda sobre `buzon`.
  assert.equal(f.leerFiltrosCrm(new URLSearchParams('buzon=mios&asignado=U7')).asignado, 'U7');
  // Al escribir, las claves viejas se van.
  const qs = f.escribirFiltrosCrm({ ...viejo, orden: 'reciente', fecha: '' }, new URLSearchParams('buscar=Rosa&buzon=mios'));
  assert.equal(qs.get('buscar'), null);
  assert.equal(qs.get('buzon'), null);
  assert.equal(qs.get('q'), 'Rosa');
  assert.equal(qs.get('asignado'), 'yo');
});

test('etiquetas: sin repetidas (mayúsculas), sin vacías y hasta 10', () => {
  igual(f.limpiarEtiquetas([' VIP ', 'vip', '', 'Tacna']), ['VIP', 'Tacna']);
  const muchas = Array.from({ length: 14 }, (_, i) => `e${i}`);
  assert.equal(f.limpiarEtiquetas(muchas).length, 10);
  // Tocar el chip dos veces lo quita.
  const una = f.alternarEtiqueta(f.FILTROS_CRM_VACIOS, 'VIP');
  igual(una.etiquetas, ['VIP']);
  igual(f.alternarEtiqueta(una, 'vip').etiquetas, []);
});

test('al servidor: q con el teléfono en dígitos, etiqueta repetida, fecha como días', () => {
  const pares = f.paresServidor({
    q: '987 654 321', etiquetas: ['VIP', 'Tacna'], asignado: 'sin', sinRespuesta: true,
    origen: 'ad:1', fecha: 'sin60', orden: 'esperando',
  });
  igual(pares, [
    ['q', '987654321'], ['etiqueta', 'VIP'], ['etiqueta', 'Tacna'], ['asignadoA', 'sin'],
    ['sinRespuesta', 'true'], ['inactivoDias', '60'], ['orden', 'esperando'],
  ]);
  // Conversaciones cuenta el buzón sobre la lista: el asignado no viaja.
  const sinAsignado = f.paresServidor({ ...f.FILTROS_CRM_VACIOS, asignado: 'yo', fecha: 'hoy' }, { incluirAsignado: false });
  igual(sinAsignado, [['dias', '1']]);
});

test('la búsqueda en pantalla mira lo mismo que el servidor (y no saca a quien el servidor trajo)', () => {
  const l = lead({ nota: 'Quiere el plan de 3 doctores', empresa: 'Clínica Sonrisas', correo: 'ana@sonrisas.pe', etiquetas: ['VIP'], etiquetasIA: ['Odontología'] });
  assert.ok(f.coincideBusquedaAmplia(l, 'ana'));
  assert.ok(f.coincideBusquedaAmplia(l, '987 654'));
  assert.ok(f.coincideBusquedaAmplia(l, 'doctores'));
  assert.ok(f.coincideBusquedaAmplia(l, 'clinica sonrisas'));
  assert.ok(f.coincideBusquedaAmplia(l, 'sonrisas.pe'));
  assert.ok(f.coincideBusquedaAmplia(l, 'odonto'));
  assert.ok(!f.coincideBusquedaAmplia(l, 'pediatría'));
});

test('cumpleFiltrosCrm: etiquetas (manuales o IA), asignado, sin respuesta, fecha y origen', () => {
  const ctx = { miUsuarioId: 'U1', ahora: AHORA };
  const base = { ...f.FILTROS_CRM_VACIOS };
  const l = lead({ etiquetas: ['VIP'], etiquetasIA: ['Tacna'], asignadoA: 'U1', ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(30) });
  assert.ok(f.cumpleFiltrosCrm(l, { ...base, etiquetas: ['vip', 'TACNA'] }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(l, { ...base, etiquetas: ['VIP', 'Lima'] }, ctx));
  assert.ok(f.cumpleFiltrosCrm(l, { ...base, asignado: 'yo' }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(l, { ...base, asignado: 'sin' }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(l, { ...base, asignado: 'U2' }, ctx));
  assert.ok(f.cumpleFiltrosCrm(l, { ...base, sinRespuesta: true }, ctx));
  // Le respondimos: ya no espera.
  assert.ok(!f.cumpleFiltrosCrm({ ...l, ultimoDireccion: 'saliente' }, { ...base, sinRespuesta: true }, ctx));
  // Escribió hace 3 minutos: todavía no cuenta como "sin respuesta".
  assert.ok(!f.cumpleFiltrosCrm({ ...l, ultimoEntranteEn: haceMin(3) }, { ...base, sinRespuesta: true }, ctx));
  // Un backend que no manda la dirección no esconde a nadie.
  assert.ok(f.cumpleFiltrosCrm(lead(), { ...base, sinRespuesta: true }, ctx));
  // Fecha: escribió hace 30 min → "hoy" sí, "sin escribir hace 30 días" no.
  assert.ok(f.cumpleFiltrosCrm(l, { ...base, fecha: 'hoy' }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(l, { ...base, fecha: 'sin30' }, ctx));
  const viejo = lead({ ultimoMensajeEn: '2026-08-01T15:00:00.000Z' });
  assert.ok(f.cumpleFiltrosCrm(viejo, { ...base, fecha: 'sin60' }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(viejo, { ...base, fecha: '30d' }, ctx));
  assert.ok(f.cumpleFiltrosCrm(lead({ origenEtiqueta: 'ad:55' }), { ...base, origen: 'ad:55' }, ctx));
  assert.ok(!f.cumpleFiltrosCrm(lead({ origenEtiqueta: 'ad:55' }), { ...base, origen: 'comentario' }, ctx));
});

test('"Los que más esperan": quien escribió último y hace más, arriba', () => {
  const a = lead({ id: 'a', ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(20), ultimoMensajeEn: haceMin(20) });
  const b = lead({ id: 'b', ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(300), ultimoMensajeEn: haceMin(300) });
  const c = lead({ id: 'c', ultimoDireccion: 'saliente', ultimoMensajeEn: haceMin(1) });
  const d = lead({ id: 'd', ultimoDireccion: 'saliente', ultimoMensajeEn: haceMin(100) });
  igual(f.ordenarLista([a, c, b, d], 'esperando').map((l) => l.id), ['b', 'a', 'c', 'd']);
  igual(f.ordenarLista([d, b, c, a], 'reciente').map((l) => l.id), ['c', 'a', 'd', 'b']);
  const viejo = lead({ id: 'v', creadoEn: '2026-01-01T00:00:00.000Z' });
  igual(f.ordenarLista([viejo, a], 'creado').map((l) => l.id), ['a', 'v']);
});

test('"Te escribió hace X · esperando" solo si el último mensaje es del cliente', () => {
  const e = f.esperandoDeFila({ ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(150) }, AHORA);
  igual(e, { texto: 'Te escribió hace 2 h · esperando', minutos: 150, urgente: true });
  igual(f.esperandoDeFila({ ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(25) }, AHORA), { texto: 'Te escribió hace 25 min · esperando', minutos: 25, urgente: false });
  assert.equal(f.esperandoDeFila({ ultimoDireccion: 'entrante', ultimoEntranteEn: AHORA.toISOString() }, AHORA).texto, 'Te escribió recién · esperando');
  assert.equal(f.esperandoDeFila({ ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(3 * 1440) }, AHORA).texto, 'Te escribió hace 3 días · esperando');
  // Le respondimos, o la fila no lo dice: nada.
  assert.equal(f.esperandoDeFila({ ultimoDireccion: 'saliente', ultimoEntranteEn: haceMin(150) }, AHORA), null);
  assert.equal(f.esperandoDeFila({ ultimoEntranteEn: haceMin(150) }, AHORA), null);
});

test('días sin contacto, próxima reunión y próximo paso, en palabras', () => {
  assert.equal(f.diasSinContacto({ ultimoMensajeEn: haceMin(30), creadoEn: '2026-01-01T00:00:00.000Z' }, AHORA), 0);
  assert.equal(f.diasSinContacto({ ultimoMensajeEn: null, creadoEn: haceMin(3 * 1440 + 5) }, AHORA), 3);
  assert.equal(f.textoSinContacto(0), 'Habló hoy');
  assert.equal(f.textoSinContacto(1), '1 día sin contacto');
  assert.equal(f.textoSinContacto(12), '12 días sin contacto');
  // Mañana 10:00 de Lima.
  assert.equal(f.textoProximaReunion('2026-10-14T15:00:00.000Z', AHORA), 'Reunión mañana 10:00');
  assert.equal(f.textoProximaReunion(null, AHORA), null);
  igual(f.textoProximoPaso('2026-10-14T14:00:00.000Z', AHORA), { texto: 'Próximo paso: mañana', atrasado: false });
  igual(f.textoProximoPaso('2026-10-12T14:00:00.000Z', AHORA), { texto: 'Paso atrasado · ayer', atrasado: true });
});

test('etiquetas de la fila: las del vendedor primero, las de la IA sin repetir', () => {
  igual(f.etiquetasDe({ etiquetas: ['VIP', 'Tacna'], etiquetasIA: ['tacna', 'Odontología', ''] }), [
    { nombre: 'VIP', ia: false }, { nombre: 'Tacna', ia: false }, { nombre: 'Odontología', ia: true },
  ]);
  igual(f.etiquetasDe({}), []);
  igual(f.etiquetasDeLista([
    { etiquetas: ['VIP'], etiquetasIA: ['Tacna'] },
    { etiquetas: ['vip'] },
    { etiquetas: [], etiquetasIA: ['Lima'] },
  ]), [{ nombre: 'VIP', cuenta: 2 }, { nombre: 'Lima', cuenta: 1 }, { nombre: 'Tacna', cuenta: 1 }]);
});

test('los orígenes de la lista, con nombre y los que más trajeron primero', () => {
  igual(f.origenesDeLista([
    { origenEtiqueta: null },
    { origenEtiqueta: 'ad:9', origen: { etiqueta: 'Video odontología', tipo: 'anuncio' } },
    { origenEtiqueta: 'ad:9', origen: null },
    { origenEtiqueta: 'directo' },
    { origenEtiqueta: 'comentario' },
    { origenEtiqueta: 'directo' },
  ]), [
    { id: 'directo', etiqueta: 'Mensaje directo', cuenta: 3 },
    { id: 'ad:9', etiqueta: 'Video odontología', cuenta: 2 },
    { id: 'comentario', etiqueta: 'Comentarios', cuenta: 1 },
  ]);
  assert.equal(f.listaConCamposCrm([lead()]), false);
  assert.equal(f.listaConCamposCrm([lead({ ultimoDireccion: null })]), true);
});

test('datos de contacto: vacío borra, correo en minúsculas, profesionales 1–999', () => {
  igual(f.validarDatoContacto('correo', '  Ana@Clinica.PE '), { ok: true, valor: 'ana@clinica.pe' });
  assert.equal(f.validarDatoContacto('correo', 'ana@').ok, false);
  igual(f.validarDatoContacto('empresa', ''), { ok: true, valor: null });
  igual(f.validarDatoContacto('empresa', 'Clínica   Sonrisas'), { ok: true, valor: 'Clínica Sonrisas' });
  assert.equal(f.validarDatoContacto('empresa', 'x'.repeat(121)).ok, false);
  assert.equal(f.validarDatoContacto('ciudad', 'y'.repeat(81)).ok, false);
  igual(f.validarDatoContacto('profesionales', '3'), { ok: true, valor: 3 });
  assert.equal(f.validarDatoContacto('profesionales', '0').ok, false);
  assert.equal(f.validarDatoContacto('profesionales', '2.5').ok, false);
  assert.equal(f.validarDatoContacto('profesionales', '1000').ok, false);
  assert.match(f.validarDatoContacto('profesionales', 'tres').error, /número/);
});

test('el embudo: una columna por etapa, con su total y los calientes arriba', () => {
  const E = etapas.ETAPAS_DEFAULT;
  const cols = f.agruparPorColumna([
    lead({ id: 'f', estado: 'nuevo', nivelInteres: 'frio' }),
    lead({ id: 'c', estado: 'nuevo', nivelInteres: 'caliente' }),
    lead({ id: 'e1', estado: 'nuevo', nivelInteres: 'caliente', ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(10) }),
    lead({ id: 'e2', estado: 'nuevo', nivelInteres: 'caliente', ultimoDireccion: 'entrante', ultimoEntranteEn: haceMin(500) }),
    lead({ id: 'g', estado: 'ganado' }),
    // Una etapa propia que no coincide con el estado: manda el estado.
    lead({ id: 'x', estado: 'perdido', etapaEmbudo: 'nuevo' }),
  ], E);
  igual(cols.map((c) => [c.etapa.id, c.total]), [['nuevo', 4], ['nutriendo', 0], ['escalado', 0], ['ganado', 1], ['perdido', 1]]);
  igual(cols[0].leads.map((l) => l.id), ['e2', 'e1', 'c', 'f']);
  assert.equal(cols[0].esperando, 2);
});

test('mover a una etapa: por id con las del negocio; por estado (y cierres) con las de siempre', () => {
  const propia = { id: 'demo', nombre: 'Agendó demo', color: 'calor', motor: 'escalado' };
  igual(f.accionParaEtapa(propia, true), { tipo: 'mover_etapa', etapaId: 'demo' });
  igual(f.accionParaEtapa(propia, false), { tipo: 'mover_etapa', etapa: 'escalado' });
  igual(f.accionParaEtapa(etapas.ETAPAS_DEFAULT[3], false), { tipo: 'marcar_ganado' });
  igual(f.accionParaEtapa(etapas.ETAPAS_DEFAULT[4], false), { tipo: 'descartar' });
});

test('un chip de etiqueta lleva a la lista filtrada', () => {
  assert.equal(enlaces.urlLeads({ etiqueta: 'VIP', negocio: 'T1' }), '/leads?negocio=T1&etiqueta=VIP');
  assert.equal(enlaces.urlLead('L1', { tenant: 'T1', sugerir: 'no_show' }), '/conversaciones?lead=L1&negocio=T1&sugerir=no_show');
  // Sin sugerencia, el link de siempre.
  assert.equal(enlaces.urlLead('L1', { tenant: 'T1' }), '/conversaciones?lead=L1&negocio=T1');
});
