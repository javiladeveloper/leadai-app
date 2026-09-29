import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

function cliente(respuesta = {}, status = 200) {
  const peticiones = [];
  const api = cargarModulo('lib/api.ts', {
    './auth': { leerSesion: () => ({ token: 'sesion-test' }), leerEmpresaActiva: () => 'negocio-A', EMPRESA_GLOBAL: 'global' },
  }, { fetch: async (url, opciones) => {
    peticiones.push({ url, ...opciones });
    return { ok: status < 400, status, json: async () => respuesta };
  } });
  return { api, peticiones };
}

test('guardar automatizaciones usa el negocio visible aunque otra empresa esté activa', async () => {
  const { api, peticiones } = cliente();
  await api.guardarMiPlan({ rescateActivo: true }, 'negocio-B');
  assert.equal(peticiones[0].headers['X-Tenant-Id'], 'negocio-B');
  assert.deepEqual(JSON.parse(peticiones[0].body), { rescateActivo: true });
});

test('métricas y embudo comparten el período explícito y default de 30 días', async () => {
  const { api, peticiones } = cliente({ metricas: null, embudos: [] });
  await api.metricasAds('negocio-B', 7);
  await api.embudoAnuncios('negocio-B', 90);
  await api.metricasAds('negocio-B');
  assert.deepEqual(peticiones.map(p => p.url), [
    'http://api.test/anuncios/metricas?dias=7',
    'http://api.test/anuncios/embudo?dias=90',
    'http://api.test/anuncios/metricas?dias=30',
  ]);
  assert.ok(peticiones.every(p => p.headers['X-Tenant-Id'] === 'negocio-B'));
});

for (const [nombre, args] of [
  ['metricasAds', ['negocio-B', 30]], ['embudoAnuncios', ['negocio-B', 30]],
  ['obtenerReporteAnuncios', [30, 'negocio-B']], ['rendimientoAds', [30, 'negocio-B']],
  ['listarAnuncios', ['negocio-B']], ['publicosEnMeta', ['negocio-B']],
  ['listarPublicos', ['negocio-B']], ['contarLeadsParaPublico', ['todos', 30, 'negocio-B']],
  ['origenDeLeads', [7, 'negocio-B']],
  ['listarPublicaciones', ['negocio-B', 'pagina-2', 10]],
]) {
  test(`${nombre}: un fallo HTTP no parece una lista vacía ni ausencia de cuenta`, async () => {
    const { api } = cliente({ error: 'Sin permiso' }, 403);
    await assert.rejects(api[nombre](...args), e => e.status === 403 && e.message === 'Sin permiso');
  });
}

test('el reporte sin período explícito también usa 30 días', async () => {
  const { api, peticiones } = cliente();
  await api.obtenerReporteAnuncios(undefined, 'negocio-B');
  assert.equal(peticiones[0].url, 'http://api.test/reportes/anuncios?dias=30');
});

test('publicaciones conserva el cursor y negocio al paginar; una página vacía exitosa sigue siendo válida', async () => {
  const { api, peticiones } = cliente({ items: [], siguiente: null });
  const pagina = await api.listarPublicaciones('negocio-B', 'pagina/2+fin', 20);
  assert.deepEqual(pagina, { items: [], siguiente: null });
  assert.equal(peticiones[0].url, 'http://api.test/publicaciones?limit=20&cursor=pagina%2F2%2Bfin');
  assert.equal(peticiones[0].headers['X-Tenant-Id'], 'negocio-B');
});

test('controles y públicos conservan tenant y cuerpo de objeto en las mutaciones', async () => {
  const { api, peticiones } = cliente({ ok: true });
  await api.cambiarEstadoAnuncio('ad1', 'PAUSED', 'negocio-B');
  await api.cambiarEstadoCampania('camp1', 'ACTIVE', 'negocio-B');
  await api.revisarPublico(['51999999999'], 'negocio-B');
  await api.crearPublico({ nombre: 'Clientes', telefonos: ['51999999999'], origen: 'propio', conSimilar: false }, 'negocio-B');
  assert.ok(peticiones.every(p => p.headers['X-Tenant-Id'] === 'negocio-B'));
  assert.deepEqual(JSON.parse(peticiones[0].body), { estado: 'PAUSED' });
  assert.deepEqual(JSON.parse(peticiones[2].body), { telefonos: ['51999999999'] });
  assert.equal(typeof JSON.parse(peticiones[3].body), 'object');
});
