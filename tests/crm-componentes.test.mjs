import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto } from './helpers/render-marketing.mjs';

/** CRM FASE 1: "Hoy", el próximo paso y el historial, montados de verdad. */
const crm = cargarModulo('lib/crm.ts');
const agenda = cargarModulo('lib/agenda.ts');
const igual = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

const LinkFalso = ({ children, href }) => ({ type: 'a', props: { href, children } });
const comunes = (r) => ({
  react: r.hooks,
  'next/link': { __esModule: true, default: LinkFalso },
  '@/components/LinkLead': { LinkLead: ({ children, id }) => ({ type: 'a', props: { href: `/conversaciones?lead=${id}`, children } }) },
  '@/components/ErrorConReintento': { ErrorConReintento: ({ mensaje }) => ({ type: 'p', props: { children: mensaje } }) },
  '@/lib/auth': { guardarEmpresaActiva() {} },
});

const ahora = new Date();
const hoy = agenda.hoyLima(ahora);
const tarea = (id, venceEn, extra = {}) => ({
  id, leadId: `L-${id}`, tenantId: 'T1', tipo: 'llamar', titulo: null, venceEn, conHora: false,
  asignadoA: null, asignadoNombre: null, estado: 'pendiente', vencida: false, hechaEn: null, creadoEn: venceEn,
  lead: { id: `L-${id}`, nombre: `Cliente ${id}`, telefono: '51987654321', tenantId: 'T1', negocio: 'Sania' },
  ...extra,
});

function montarHoy(datos, api = {}) {
  const r = renderer();
  const guardados = [];
  const llamadas = [];
  const modulo = cargarModulo('components/panel/BloqueHoy.tsx', {
    ...comunes(r),
    '@/lib/useDatos': { useDatos: () => ({ datos, error: null, cargando: false, recargar: async () => {} }) },
    '@/lib/cache-datos': { guardarCache: (clave, valor) => guardados.push({ clave, valor }), invalidar() {} },
    '@/lib/api': {
      claveHoy: (t) => `hoy@${t || 'todos'}`,
      obtenerHoy: async () => datos,
      actualizarTarea: async (id, cambios, tenant) => { llamadas.push({ id, cambios, tenant }); return { id }; },
      ...api,
    },
  });
  r.montar(modulo.BloqueHoy, { conNegocio: true });
  return { r, guardados, llamadas };
}

test('"Hoy" sin la ruta en el backend (null) no pinta nada', () => {
  const { r } = montarHoy(null);
  assert.equal(r.arbol, null);
});

test('"Hoy" muestra reuniones, pasos (atrasado primero) y quién espera, con el chip del negocio', () => {
  const ayer = crm.venceEnDe(agenda.sumarDias(hoy, -1), null).venceEn;
  const deHoy = crm.venceEnDe(hoy, null).venceEn;
  const { r } = montarHoy({
    reuniones: [{
      citaId: 'c1', leadId: 'L-r', tenantId: 'T1', negocio: 'Sania', nombre: 'Rosa', telefono: '51911111111',
      inicio: new Date(ahora.getTime() + 3_600_000).toISOString(), fin: new Date(ahora.getTime() + 5_400_000).toISOString(),
      meetLink: 'https://meet.google.com/x', estado: 'confirmada', resultado: null,
    }],
    tareas: [tarea('hoy', deHoy), tarea('ayer', ayer, { titulo: 'Pasarle la cotización' })],
    sinRespuesta: [{ leadId: 'L-s', tenantId: 'T1', negocio: 'Sania', nombre: 'Pedro', telefono: null, nivelInteres: 'caliente', ultimoEntranteEn: ayer, esperandoMin: 1500, ultimoMensaje: '¿Precio?' }],
    oportunidades: [],
    generadoEn: ahora.toISOString(),
  });
  const t = texto(r.arbol);
  assert.match(t, /Reuniones de hoy/);
  assert.match(t, /Rosa/);
  assert.match(t, /Unirse/);
  assert.match(t, /Próximos pasos/);
  assert.match(t, /1 atrasado/);
  assert.ok(t.indexOf('Cliente ayer') < t.indexOf('Cliente hoy'), 'lo atrasado va primero');
  assert.match(t, /Pasarle la cotización/);
  assert.match(t, /Te escribieron y nadie respondió/);
  assert.match(t, /Esperando hace 1 día/);
  assert.match(t, /Sania/);
  // Oportunidades: vacías, el bloque no aparece.
  assert.doesNotMatch(t, /Oportunidades/);
});

test('✓ Hecho se ve al instante y manda {estado: hecha} con el negocio de la tarea', async () => {
  const deHoy = crm.venceEnDe(hoy, null).venceEn;
  const { r, guardados, llamadas } = montarHoy({
    reuniones: [], tareas: [tarea('k1', deHoy)], sinRespuesta: [], oportunidades: [], generadoEn: ahora.toISOString(),
  });
  const hecho = r.nodos((n) => n.type === 'button' && texto(n).trim() === '✓ Hecho')[0];
  hecho.props.onClick();
  await r.flush();
  igual(guardados[0].valor.tareas, []);
  assert.equal(guardados[0].clave, 'hoy@todos');
  igual(llamadas, [{ id: 'k1', cambios: { estado: 'hecha' }, tenant: 'T1' }]);
  r.desmontar();
});

test('Posponer "El lunes" manda el día del próximo lunes y saca el paso de hoy', async () => {
  const deHoy = crm.venceEnDe(hoy, null).venceEn;
  const { r, guardados, llamadas } = montarHoy({
    reuniones: [], tareas: [tarea('k2', deHoy)], sinRespuesta: [], oportunidades: [], generadoEn: ahora.toISOString(),
  });
  r.nodos((n) => n.type === 'button' && texto(n).trim() === 'Posponer ▾')[0].props.onClick();
  await r.flush();
  r.nodos((n) => n.type === 'button' && texto(n).trim() === 'El lunes')[0].props.onClick();
  await r.flush();
  const esperado = JSON.parse(JSON.stringify(crm.venceEnDe(crm.diaDeAtajo("lunes"), null)));
  igual(llamadas[0].cambios, esperado);
  igual(guardados[0].valor.tareas, []);
  r.desmontar();
});

test('Próximo paso: crear "Llamar · Mañana" manda el contrato y avisa al padre', async () => {
  const r = renderer();
  const creadas = [];
  let cambios = 0;
  const modulo = cargarModulo('components/panel/ProximoPaso.tsx', {
    ...comunes(r),
    '@/lib/cache-datos': { invalidar() {} },
    '@/lib/api': {
      crearTarea: async (leadId, t, tenant) => { creadas.push({ leadId, t, tenant }); return { ...tarea('n1', t.venceEn), ...t }; },
      actualizarTarea: async () => ({}),
    },
  });
  r.montar(modulo.ProximoPaso, { leadId: 'L1', tenant: 'T1', nombre: 'Ana', tarea: null, onCambio: () => { cambios++; } });
  const boton = (nombre) => r.nodos((n) => n.type === 'button' && texto(n).trim() === nombre)[0];
  boton('+ Próximo paso').props.onClick(); await r.flush();
  boton('Guardar paso').props.onClick(); await r.flush();
  const { venceEn, conHora } = crm.venceEnDe(crm.diaDeAtajo('manana'), null);
  igual(creadas, [{ leadId: 'L1', t: { tipo: 'llamar', titulo: null, venceEn, conHora }, tenant: 'T1' }]);
  assert.equal(cambios, 1);
  assert.match(texto(r.arbol), /Llamar a Ana/);
  r.desmontar();
});

test('Historial: sin la ruta no se pinta; con ítems los cuenta y "Ver más" pide con antesDe', async () => {
  const r0 = renderer();
  const m0 = cargarModulo('components/panel/HistorialLead.tsx', {
    ...comunes(r0),
    '@/lib/useDatos': { useDatos: () => ({ datos: null, error: null, cargando: false, recargar: async () => {} }) },
    '@/lib/cache-datos': { guardarCache() {} },
    '@/lib/api': { claveHistorial: () => 'h', historialLead: async () => null, agregarApunte: async () => ({}) },
  });
  r0.montar(m0.HistorialLead, { leadId: 'L1' });
  assert.equal(r0.arbol, null);

  const r = renderer();
  const pedidos = [];
  const pagina = {
    items: [
      { id: 'act_1', tipo: 'apunte', fecha: '2026-10-13T14:00:00.000Z', texto: 'Decide el lunes', autor: { id: 'u1', nombre: 'Guisella' }, datos: null },
      { id: 'cita_c1', tipo: 'reunion', fecha: '2026-10-12T15:00:00.000Z', texto: null, autor: null, datos: { citaId: 'c1', inicio: '2026-10-12T15:00:00.000Z' } },
    ],
    hayMas: true,
  };
  const m = cargarModulo('components/panel/HistorialLead.tsx', {
    ...comunes(r),
    '@/lib/useDatos': { useDatos: () => ({ datos: pagina, error: null, cargando: false, recargar: async () => {} }) },
    '@/lib/cache-datos': { guardarCache() {} },
    '@/lib/api': {
      claveHistorial: () => 'h',
      historialLead: async (id, opciones, tenant) => { pedidos.push({ id, opciones, tenant }); return { items: [], hayMas: false }; },
      agregarApunte: async () => ({}),
    },
  });
  r.montar(m.HistorialLead, { leadId: 'L1', tenant: 'T1' });
  const t = texto(r.arbol);
  assert.match(t, /Decide el lunes/);
  assert.match(t, /Guisella/);
  assert.match(t, /Reunión del lunes 12 de octubre/);
  assert.match(t, /Ver en la agenda/);
  r.nodos((n) => n.type === 'button' && texto(n).trim() === 'Ver más')[0].props.onClick();
  await r.flush();
  igual(pedidos, [{ id: 'L1', opciones: { antesDe: '2026-10-12T15:00:00.000Z', limit: 20 }, tenant: 'T1' }]);
  // Ya no hay más: el botón desaparece.
  assert.equal(r.nodos((n) => n.type === 'button' && texto(n).trim() === 'Ver más').length, 0);
  r.desmontar();
});
