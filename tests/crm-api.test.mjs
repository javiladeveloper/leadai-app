import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

// Lo que devuelve el módulo nace en otro contexto (vm): se compara como JSON.
const igual = (a, b) => assert.deepEqual(JSON.parse(JSON.stringify(a)), b);

/** CRM FASE 1: los contratos con el backend (diseño, sección 1.3). */
function cliente(respuesta = {}, status = 200) {
  const peticiones = [];
  const api = cargarModulo('lib/api.ts', {
    './auth': { leerSesion: () => ({ token: 'sesion-test' }), leerEmpresaActiva: () => 'negocio-A', EMPRESA_GLOBAL: '__global__' },
  }, { fetch: async (url, opciones) => {
    peticiones.push({ url, ...opciones });
    return { ok: status < 400, status, json: async () => respuesta };
  } });
  return { api, peticiones };
}

test('/hoy sin negocio pide TODOS los negocios y no manda X-Tenant-Id', async () => {
  const { api, peticiones } = cliente({ reuniones: [], tareas: [], sinRespuesta: [], generadoEn: 'x' });
  const hoy = await api.obtenerHoy();
  assert.equal(peticiones[0].url, 'http://api.test/hoy');
  assert.equal(peticiones[0].headers['X-Tenant-Id'], undefined);
  // `oportunidades` puede no venir todavía: llega como lista vacía.
  igual(hoy.oportunidades, []);
});

test('/hoy de un negocio lo pide por querystring', async () => {
  const { api, peticiones } = cliente({ reuniones: [], tareas: [], sinRespuesta: [], oportunidades: [], generadoEn: 'x' });
  await api.obtenerHoy('T9');
  assert.equal(peticiones[0].url, 'http://api.test/hoy?tenantId=T9');
});

test('un backend sin la ruta (404) o un puesto sin permiso (403) da null, no error', async () => {
  assert.equal(await cliente({ error: 'Route GET:/hoy not found' }, 404).api.obtenerHoy(), null);
  assert.equal(await cliente({}, 403).api.obtenerHoy(), null);
  assert.equal(await cliente({}, 404).api.historialLead('L1'), null);
  assert.equal(await cliente({}, 404).api.tareasLead('L1'), null);
  await assert.rejects(() => cliente({ error: 'boom' }, 500).api.obtenerHoy());
});

test('historial: paginado con antesDe y limit, con el negocio del lead', async () => {
  const { api, peticiones } = cliente({ items: [], hayMas: false });
  await api.historialLead('L1', { antesDe: '2026-10-13T10:00:00.000Z', limit: 500 }, 'T2');
  assert.equal(peticiones[0].url, 'http://api.test/leads/L1/historial?antesDe=2026-10-13T10%3A00%3A00.000Z&limit=100');
  assert.equal(peticiones[0].headers['X-Tenant-Id'], 'T2');
});

test('crear y cambiar una tarea mandan exactamente el contrato', async () => {
  const { api, peticiones } = cliente({ tarea: { id: 'k1' } });
  await api.crearTarea('L1', { tipo: 'llamar', venceEn: '2026-10-14T14:00:00.000Z', conHora: false }, 'T2');
  assert.equal(peticiones[0].url, 'http://api.test/leads/L1/tareas');
  assert.equal(peticiones[0].method, 'POST');
  igual(JSON.parse(peticiones[0].body), { tipo: 'llamar', venceEn: '2026-10-14T14:00:00.000Z', conHora: false });
  await api.actualizarTarea('k1', { estado: 'hecha' }, 'T3');
  assert.equal(peticiones[1].url, 'http://api.test/tareas/k1');
  assert.equal(peticiones[1].method, 'PATCH');
  assert.equal(peticiones[1].headers['X-Tenant-Id'], 'T3');
  igual(JSON.parse(peticiones[1].body), { estado: 'hecha' });
});

test('apunte: POST /apuntes con el texto recortado', async () => {
  const { api, peticiones } = cliente({ item: { id: 'act_1' } });
  const it = await api.agregarApunte('L1', '  Quiere el plan de 3  ');
  assert.equal(it.id, 'act_1');
  assert.equal(peticiones[0].url, 'http://api.test/leads/L1/apuntes');
  igual(JSON.parse(peticiones[0].body), { texto: 'Quiere el plan de 3' });
});
