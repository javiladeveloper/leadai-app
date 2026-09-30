import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto } from './helpers/render-marketing.mjs';
import { createElement } from 'react';

async function seccion(api = {}) {
  const r = renderer(), recibidas = {};
  const componente = nombre => props => { recibidas[nombre] = props; return null; };
  let montajes = 0;
  const Creador = props => {
    recibidas.creador = props;
    r.hooks.useEffect(() => { montajes++; }, []);
    return null;
  };
  const { SeccionAnuncios } = cargarModulo('components/panel/SeccionAnuncios.tsx', {
    react: r.hooks,
    '@/lib/api': { estadoAnuncios: async () => ({ conectada: true }), ...api },
    '@/components/panel/ReporteAnuncios': { ReporteAnuncios: componente('reporte') },
    '@/components/panel/MetricasAnuncios': { MetricasAnuncios: componente('metricas') },
    '@/components/panel/EmbudoAnuncios': { EmbudoAnuncios: componente('embudo') },
    '@/components/panel/RendimientoAnuncios': { RendimientoAnuncios: componente('rendimiento') },
    '@/components/panel/AnunciosPanel': { __esModule: true, default: Creador },
    '@/components/panel/PublicosMeta': { PublicosMeta: componente('publicos') },
    '@/components/panel/OrigenDeLeads': { OrigenDeLeads: componente('origen') },
    '@/components/panel/AnunciosSinConectar': { AnunciosSinConectar: () => null },
  });
  r.montar(SeccionAnuncios, { tenant: 'B', nombreNegocio: 'Beta' }); await r.flush();
  return { r, recibidas, get montajes() { return montajes; } };
}
async function elegir(r, nombre) {
  r.nodos(n => n.type === 'button' && texto(n) === nombre)[0].props.onClick(); await r.flush();
}

test('las cuatro vistas reciben el período común de 30 días y sus cambios', async () => {
  const { r, recibidas } = await seccion();
  assert.equal(recibidas.reporte.dias, 30);
  assert.equal(recibidas.origen.dias, 30);
  await elegir(r, 'Tus anuncios');
  for (const n of ['metricas', 'embudo', 'rendimiento']) assert.equal(recibidas[n].dias, 30);
  const selector = r.nodos(n => n.type === 'select')[0];
  assert.ok(selector);
  selector.props.onChange({ target: { value: '7' } }); await r.flush();
  for (const n of ['metricas', 'embudo', 'rendimiento']) assert.equal(recibidas[n].dias, 7);
  await elegir(r, 'Resumen'); assert.equal(recibidas.reporte.dias, 7);
  assert.equal(recibidas.origen.dias, 7);
});

test('el creador recibe tenant y nombre y permanece montado al cambiar de solapa', async () => {
  const s = await seccion();
  await elegir(s.r, 'Crear anuncio');
  assert.equal(s.recibidas.creador.tenant, 'B');
  assert.equal(s.recibidas.creador.nombreNegocio, 'Beta');
  await elegir(s.r, 'Resumen'); await elegir(s.r, 'Crear anuncio');
  assert.equal(s.montajes, 1);
});

test('el período del reporte no estorba al crear anuncios ni administrar públicos', async () => {
  const { r } = await seccion();
  assert.equal(r.nodos(n => n.type === 'select' && n.props['aria-label'] === 'Período del reporte').length, 1);
  await elegir(r, 'A quién le llega');
  assert.equal(r.nodos(n => n.type === 'select' && n.props['aria-label'] === 'Período del reporte').length, 0);
  await elegir(r, 'Crear anuncio');
  assert.equal(r.nodos(n => n.type === 'select' && n.props['aria-label'] === 'Período del reporte').length, 0);
  await elegir(r, 'Resumen');
  assert.equal(r.nodos(n => n.type === 'select' && n.props['aria-label'] === 'Período del reporte').length, 1);
});

test('Tus anuncios ofrece Ver borradores y solicita el historial sin remontar el creador', async () => {
  const s = await seccion();
  await elegir(s.r, 'Tus anuncios');
  assert.ok(s.r.nodos(n => n.type === 'button' && texto(n) === 'Ver borradores').length);
  await elegir(s.r, 'Ver borradores');
  assert.equal(s.recibidas.creador.tenant, 'B');
  assert.equal(s.recibidas.creador.solicitudHistorial, 1);
  assert.equal(s.r.nodos(n => n.type === 'button' && texto(n) === 'Crear anuncio')[0].props['aria-pressed'], true);
  await elegir(s.r, 'Tus anuncios'); await elegir(s.r, 'Ver borradores');
  assert.equal(s.recibidas.creador.solicitudHistorial, 2);
  assert.equal(s.montajes, 1);
});

test('un error consultando la conexión permite reintentar sin asumir cuenta conectada', async () => {
  const { r } = await seccion({ estadoAnuncios: async () => null });
  assert.ok(r.nodos(n => n.type === 'button' && /Reintentar/.test(texto(n))).length);
});

test('Marketing propaga su tenant visible a Automatizaciones', async () => {
  const r = renderer();
  let recibido;
  const vacio = () => null;
  const router = { replace() {} };
  const mod = cargarModulo('app/(panel)/marketing/page.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams('t=automatico') },
    '@/lib/auth': { haySesion: () => true, leerEmpresaActiva: () => 'A', empresasVisibles: () => [] },
    '@/lib/api': { obtenerMiPlan: async () => ({ features: { marketing: true } }) },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneAnuncios: true, tieneCampanias: true }) },
    '@/components/panel/GlobalNegocios': { BarraNegociosGlobal: vacio, useSeccionGlobal: () => ({ resuelto: true, listaLista: true, modoGlobal: true, enfocado: 'B', tenantLista: 'B', negocios: [{ tenantId: 'B', nombre: 'Beta' }] }) },
    '@/components/panel/AjustesMarketing': { AjustesMarketing: props => { recibido = props; return null; } },
    '@/components/panel/MarketingBloqueado': { MarketingBloqueado: vacio },
    '@/components/panel/CampaniasPanel': { __esModule: true, default: vacio },
    '@/components/panel/PublicarPanel': { __esModule: true, default: vacio },
    '@/components/panel/PresenciaEditor': { PresenciaEditor: vacio },
    '@/components/panel/SeccionAnuncios': { SeccionAnuncios: vacio },
    '@/components/panel/HeroSeccion': { HeroSeccion: vacio, MarketingIlustracion: vacio },
  }, { Cargando: () => createElement('p', {}, 'Cargando') });
  r.montar(mod.default); await r.flush();
  assert.equal(recibido.tenant, 'B');
});
