import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto } from './helpers/render-marketing.mjs';

async function marketing(inicial = 'anuncios') {
  const r = renderer(), lecturas = [], router = { replace() {}, push() {} };
  let tenant = 'A';
  const vacio = () => null;
  // Root y PublicarPanel reales; sólo las API y vistas ajenas al flujo son dobles.
  const mod = cargarModulo('app/(panel)/marketing/page.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => router, useSearchParams: () => new URLSearchParams(`t=${inicial}`) },
    '@/lib/auth': { haySesion: () => true, leerEmpresaActiva: () => tenant, empresasVisibles: () => [{ tenantId: tenant, nombre: tenant }] },
    '@/lib/api': {
      obtenerMiPlan: async () => ({ features: { marketing: true } }),
      listarPublicaciones: async t => { lecturas.push(t); return { items: [], siguiente: null }; },
      plantillasPost: async () => [],
      listarCanales: async () => [{ id: 'facebook', tipo: 'messenger', activo: true }],
    },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneAnuncios: true, tieneCampanias: true }) },
    '@/components/panel/GlobalNegocios': { BarraNegociosGlobal: vacio, useSeccionGlobal: () => ({ resuelto: true, listaLista: true, modoGlobal: false, enfocado: tenant, tenantLista: tenant, negocios: [], setEnfocado() {} }) },
    '@/components/panel/AjustesMarketing': { AjustesMarketing: vacio },
    '@/components/panel/MarketingBloqueado': { MarketingBloqueado: vacio },
    '@/components/panel/CampaniasPanel': { __esModule: true, default: vacio },
    '@/components/panel/PresenciaEditor': { PresenciaEditor: vacio },
    '@/components/panel/SeccionAnuncios': { SeccionAnuncios: vacio },
    '@/components/panel/HeroSeccion': { HeroSeccion: vacio, MarketingIlustracion: vacio, PublicarIlustracion: vacio, CabeceraFormulario: vacio },
    '@/components/panel/PreviewRedes': { PreviewRedes: vacio },
    '@/components/panel/RendimientoPosts': { RendimientoPosts: vacio },
    '@/components/Skeletons': { SkeletonLista: vacio },
  }, { window: { addEventListener() {}, removeEventListener() {} } });
  r.montar(mod.default); await r.flush();
  return { r, lecturas, async cambiarNegocio(t) { tenant = t; r.actualizar({}); await r.flush(); } };
}
async function elegir(r, nombre) {
  r.nodos(n => n.type === 'button' && n.props.role === 'tab' && texto(n).trim().startsWith(nombre))[0].props.onClick();
  await r.flush();
}
const editor = r => r.nodos(n => n.type === 'textarea')[0];
async function escribir(r, value) { editor(r).props.onChange({ target: { value } }); await r.flush(); }
function contieneEditor(n) {
  if (Array.isArray(n)) return n.some(contieneEditor);
  return !!n && typeof n === 'object' && (n.type === 'textarea' || contieneEditor(n.props?.children));
}

test('Publicar se monta al visitarlo y conserva el borrador al navegar entre pestañas raíz', async () => {
  const { r, lecturas } = await marketing();
  assert.equal(editor(r), undefined); assert.deepEqual(lecturas, []);
  await elegir(r, 'Publicar'); await escribir(r, 'Borrador pendiente del negocio A');
  for (const pestaña of ['Anuncios', 'Automático', 'Presencia']) {
    await elegir(r, pestaña);
    assert.ok(r.nodos(n => n.props.hidden === true && contieneEditor(n)).length, 'El editor debe quedar montado, pero oculto');
    await elegir(r, 'Publicar');
    assert.equal(editor(r).props.value, 'Borrador pendiente del negocio A');
  }
  assert.deepEqual(lecturas, ['A'], 'Cambiar pestañas no remonta ni vuelve a cargar Publicar');
  r.desmontar();
});

test('Publicar abierto directamente por URL también conserva el texto al volver', async () => {
  const { r } = await marketing('publicar');
  await escribir(r, 'Texto desde enlace directo');
  await elegir(r, 'Anuncios'); await elegir(r, 'Publicar');
  assert.equal(editor(r).props.value, 'Texto desde enlace directo');
  r.desmontar();
});

test('cambiar negocio con Publicar oculto no mezcla el borrador ni monta otro editor antes de visitarlo', async () => {
  const { r, lecturas, cambiarNegocio } = await marketing('publicar');
  await escribir(r, 'Sólo para A'); await elegir(r, 'Anuncios');
  await cambiarNegocio('B');
  assert.equal(editor(r), undefined); assert.deepEqual(lecturas, ['A']);
  await elegir(r, 'Publicar');
  assert.equal(editor(r).props.value, ''); assert.deepEqual(lecturas, ['A', 'B']);
  await escribir(r, 'Sólo para B');
  await cambiarNegocio('A');
  assert.equal(editor(r).props.value, '', 'La instancia visible tampoco conserva texto de otro tenant');
  r.desmontar();
});
