import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto } from './helpers/render-marketing.mjs';

async function montarMarketing({ inicial = 'anuncios', anuncios = true, campanias = true, entorno = {} } = {}) {
  const r = renderer();
  let params = new URLSearchParams(`t=${inicial}`);
  let capacidades = { tieneAnuncios: anuncios, tieneCampanias: campanias };
  const navegaciones = [];
  let montajesCampania = 0;
  const vacio = () => null;
  const mod = cargarModulo('app/(panel)/marketing/page.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => ({
      push: (url) => navegaciones.push(['push', url]),
      replace: (url) => navegaciones.push(['replace', url]),
    }), useSearchParams: () => params },
    '@/lib/auth': { haySesion: () => true, leerEmpresaActiva: () => 'T', empresasVisibles: () => [] },
    '@/lib/api': { obtenerMiPlan: async () => ({ features: { marketing: true } }) },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => capacidades },
    '@/components/panel/GlobalNegocios': { BarraNegociosGlobal: vacio, useSeccionGlobal: () => ({ resuelto: true, listaLista: true, modoGlobal: true, enfocado: 'T', tenantLista: 'T', negocios: [{ tenantId: 'T', nombre: 'Demo' }] }) },
    '@/components/panel/AjustesMarketing': { AjustesMarketing: vacio },
    '@/components/panel/MarketingBloqueado': { MarketingBloqueado: vacio },
    '@/components/panel/CampaniasPanel': { __esModule: true, default: () => {
      const [borrador, setBorrador] = r.hooks.useState('');
      r.hooks.useEffect(() => { montajesCampania++; }, []);
      return createElement('label', {}, 'Contenido campañas', createElement('input', {
        'aria-label': 'Borrador de campaña', value: borrador, onChange: e => setBorrador(e.target.value),
      }));
    } },
    '@/components/panel/PublicarPanel': { __esModule: true, default: () => createElement('span', {}, 'Contenido publicar') },
    '@/components/panel/PresenciaEditor': { PresenciaEditor: () => createElement('span', {}, 'Contenido presencia') },
    '@/components/panel/SeccionAnuncios': { SeccionAnuncios: () => createElement('span', {}, 'Contenido anuncios') },
    '@/components/panel/HeroSeccion': { HeroSeccion: vacio, MarketingIlustracion: vacio },
  }, { Cargando: () => createElement('p', {}, 'Cargando'), ...entorno });
  r.montar(mod.default); await r.flush();
  return {
    r, navegaciones,
    tab(id) { return r.nodos(n => n.props.role === 'tab' && texto(n).includes(id))[0]; },
    async url(t) { params = new URLSearchParams(`t=${t}`); r.actualizar({}); await r.flush(); },
    async capacidades(a, c) { capacidades = { tieneAnuncios: a, tieneCampanias: c }; r.actualizar({}); await r.flush(); },
    get montajesCampania() { return montajesCampania; },
  };
}

test('las pestañas registran navegación y Atrás restaura la pestaña desde la URL', async () => {
  const m = await montarMarketing();
  m.tab('Campañas').props.onClick(); await m.r.flush();
  assert.deepEqual(m.navegaciones.at(-1), ['push', '/marketing?t=campanias']);
  assert.equal(m.tab('Campañas').props['aria-selected'], true);
  await m.url('presencia');
  assert.equal(m.tab('Presencia').props['aria-selected'], true);
  assert.match(texto(m.r.arbol), /Contenido presencia/);
  m.r.desmontar();
});

test('si anuncios y campañas no están disponibles, abre una pestaña útil y corrige la URL', async () => {
  const m = await montarMarketing({ anuncios: false, campanias: false });
  assert.equal(m.tab('Presencia').props['aria-selected'], true);
  assert.match(texto(m.r.arbol), /Contenido presencia/);
  assert.deepEqual(m.navegaciones.at(-1), ['replace', '/marketing?t=presencia']);
  m.r.desmontar();
});

test('al visitar campañas, salir y volver, conserva su formulario montado para el mismo negocio', async () => {
  const m = await montarMarketing({ inicial: 'campanias' });
  assert.equal(m.montajesCampania, 1);
  const borrador = () => m.r.nodos(n => n.type === 'input' && n.props['aria-label'] === 'Borrador de campaña')[0];
  borrador().props.onChange({ target: { value: 'Campaña de septiembre' } }); await m.r.flush();
  m.tab('Publicar').props.onClick(); await m.r.flush();
  m.tab('Campañas').props.onClick(); await m.r.flush();
  assert.equal(m.montajesCampania, 1);
  assert.equal(borrador().props.value, 'Campaña de septiembre');
  m.r.desmontar();
});

test('las pestañas exponen nombre, panel y navegación de teclado', async () => {
  const m = await montarMarketing();
  assert.ok(m.r.nodos(n => n.props.role === 'tablist' && n.props['aria-label']));
  const anuncios = m.tab('Anuncios');
  assert.ok(anuncios.props.id && anuncios.props['aria-controls']);
  assert.equal(anuncios.props.tabIndex, 0);
  anuncios.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} }); await m.r.flush();
  assert.equal(m.tab('Campañas').props['aria-selected'], true);
  m.r.desmontar();
});

test('al abrir una pestaña profunda en móvil, la navegación la deja visible', async () => {
  const desplazamientos = [];
  const document = {
    getElementById(id) {
      if (id === 'marketing-tablist') return { scrollWidth: 800, clientWidth: 320 };
      if (id === 'marketing-tab-automatico') return { scrollIntoView: opciones => desplazamientos.push(opciones) };
      return null;
    },
  };
  const m = await montarMarketing({ inicial: 'automatico', entorno: { document } });
  assert.equal(m.tab('Automático').props['aria-selected'], true);
  assert.equal(desplazamientos.length, 1);
  assert.equal(desplazamientos[0].block, 'nearest');
  assert.equal(desplazamientos[0].inline, 'nearest');
  m.r.desmontar();
});

test('en escritorio el menú vertical anuncia su orientación y acepta flecha abajo', async () => {
  const window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  const m = await montarMarketing({ entorno: { window } });
  assert.equal(m.r.nodos(n => n.props.role === 'tablist')[0].props['aria-orientation'], 'vertical');
  m.tab('Anuncios').props.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  await m.r.flush();
  assert.equal(m.tab('Campañas').props['aria-selected'], true);
  m.r.desmontar();
});
