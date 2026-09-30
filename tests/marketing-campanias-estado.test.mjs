import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto, diferida } from './helpers/render-marketing.mjs';

function panelParaCambioDeNegocio(listarLeads = async () => []) {
  const r = renderer();
  const modulo = cargarModulo('components/panel/CampaniasPanel.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/lib/auth': { haySesion: () => true },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneCarta: false }) },
    '@/components/panel/GlobalNegocios': { useSeccionGlobal: () => ({ tenantLista: 'A', listaLista: true, resuelto: true }), BarraNegociosGlobal: () => null },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, CampaniaIlustracion: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
    '@/lib/api': {
      ciudadesDeLeads: async () => [], listarLeads,
      listarCampanias: async () => [], listarPlantillasHSM: async () => ({ ok: true, plantillas: [] }),
      cupoCampanias: async () => null, estadoPagoCampanias: async () => null,
    },
  });
  r.montar(modulo.default, { embebido: true, tenant: 'A' });
  const boton = nombre => r.nodos(n => n.type === 'button' && texto(n).trim() === nombre)[0];
  const contactos = () => r.nodos(n => n.type === 'textarea' && n.props.rows === 6)[0];
  return { r, boton, contactos };
}

test('al cambiar de negocio se vacía la lista de destinatarios del borrador anterior', async () => {
  const { r, boton, contactos } = panelParaCambioDeNegocio();
  await r.flush();
  boton('+ Nueva campaña').props.onClick(); await r.flush();
  contactos().props.onChange({ target: { value: '51999111222, Ana' } }); await r.flush();
  r.actualizar({ embebido: true, tenant: 'B' }); await r.flush();
  assert.ok(!contactos() || contactos().props.value === '');
  r.desmontar();
});

test('una audiencia tardía del negocio anterior no añade destinatarios al nuevo', async () => {
  const pendiente = diferida();
  const { r, boton, contactos } = panelParaCambioDeNegocio(async () => pendiente.promise);
  await r.flush();
  boton('+ Nueva campaña').props.onClick(); await r.flush();
  boton('Ya son clientes').props.onClick(); await r.flush();
  r.actualizar({ embebido: true, tenant: 'B' }); await r.flush();
  pendiente.resolve([{ contactoExterno: '51999111222', nombre: 'Ana' }]); await r.flush();
  assert.ok(!contactos() || contactos().props.value === '');
  r.desmontar();
});

test('un fallo al pausar no aparenta éxito ni oculta el error', async () => {
  const r = renderer();
  const modulo = cargarModulo('components/panel/CampaniasPanel.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/lib/auth': { haySesion: () => true },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneCarta: false }) },
    '@/components/panel/GlobalNegocios': { useSeccionGlobal: () => ({ tenantLista: 'T', listaLista: true, resuelto: true }), BarraNegociosGlobal: () => null },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, CampaniaIlustracion: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
    '@/lib/api': {
      ciudadesDeLeads: async () => [],
      listarCampanias: async () => [{ id: 'c1', nombre: 'Oferta', estado: 'enviando', enviados: 0, fallidos: 0, respondieron: 0, totalDestinatarios: 1 }],
      listarPlantillasHSM: async () => ({ ok: true, plantillas: [] }),
      cupoCampanias: async () => null,
      estadoPagoCampanias: async () => null,
      pausarCampania: async () => ({ ok: false, error: 'Meta no respondió' }),
    },
  });
  r.montar(modulo.default, { embebido: true, tenant: 'T' }); await r.flush();
  const boton = r.nodos(n => n.type === 'button' && /Pausar/.test(texto(n)))[0];
  assert.ok(boton);
  await boton.props.onClick(); await r.flush();
  assert.match(texto(r.arbol), /Meta no respondió/);
});

test('consultar Plantillas y volver a Envíos conserva el borrador de campaña', async () => {
  const r = renderer();
  const modulo = cargarModulo('components/panel/CampaniasPanel.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/lib/auth': { haySesion: () => true },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneCarta: false }) },
    '@/components/panel/GlobalNegocios': { useSeccionGlobal: () => ({ tenantLista: 'T', listaLista: true, resuelto: true }), BarraNegociosGlobal: () => null },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, CampaniaIlustracion: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
    '@/lib/api': {
      ciudadesDeLeads: async () => [],
      listarCampanias: async () => [],
      listarPlantillasHSM: async () => ({ ok: true, plantillas: [] }),
      cupoCampanias: async () => null,
      estadoPagoCampanias: async () => null,
    },
  });
  r.montar(modulo.default, { embebido: true, tenant: 'T' }); await r.flush();
  const boton = nombre => r.nodos(n => n.type === 'button' && texto(n).trim() === nombre)[0];
  boton('+ Nueva campaña').props.onClick(); await r.flush();
  const nombre = () => r.nodos(n => n.type === 'input' && n.props.placeholder === 'Ej: Promo agosto — clientes antiguos')[0];
  nombre().props.onChange({ target: { value: 'Clientes frecuentes' } }); await r.flush();
  boton('Plantillas').props.onClick(); await r.flush();
  boton('Envíos').props.onClick(); await r.flush();
  assert.equal(nombre()?.props.value, 'Clientes frecuentes');
  r.desmontar();
});

test('sin plantilla aprobada hay un acceso directo para crearla sin perder la campaña', async () => {
  const { r, boton } = panelParaCambioDeNegocio();
  await r.flush();
  boton('+ Nueva campaña').props.onClick(); await r.flush();
  assert.ok(boton('Crear plantilla'));
  boton('Crear plantilla').props.onClick(); await r.flush();
  assert.ok(r.nodos(n => n.type === 'input' && n.props.placeholder === 'Ej: promo agosto')[0]);
  boton('Envíos').props.onClick(); await r.flush();
  assert.ok(r.nodos(n => n.type === 'input' && n.props.placeholder === 'Ej: Promo agosto — clientes antiguos')[0]);
  r.desmontar();
});

test('los atajos de audiencia y ciudades usan el negocio enfocado en Campañas', async () => {
  const r = renderer(), consultas = [];
  const modulo = cargarModulo('components/panel/CampaniasPanel.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/lib/auth': { haySesion: () => true },
    '@/lib/modo-negocio': { useCapacidadesOptimista: () => ({ tieneCarta: false }) },
    '@/components/panel/GlobalNegocios': { useSeccionGlobal: () => ({ tenantLista: 'OTRO', listaLista: true, resuelto: true }), BarraNegociosGlobal: () => null },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, CampaniaIlustracion: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
    '@/lib/api': {
      ciudadesDeLeads: async tenant => { consultas.push(['ciudades', tenant]); return []; },
      listarLeads: async (filtro, tenant) => { consultas.push(['leads', filtro, tenant]); return []; },
      listarCampanias: async () => [], listarPlantillasHSM: async () => ({ ok: true, plantillas: [] }),
      cupoCampanias: async () => null, estadoPagoCampanias: async () => null,
    },
  });
  r.montar(modulo.default, { embebido: true, tenant: 'ENFOCADO' }); await r.flush();
  const boton = nombre => r.nodos(n => n.type === 'button' && texto(n).trim() === nombre)[0];
  boton('+ Nueva campaña').props.onClick(); await r.flush();
  boton('Ya son clientes').props.onClick(); await r.flush();
  assert.ok(consultas.some(c => c[0] === 'ciudades' && c[1] === 'ENFOCADO'));
  assert.ok(consultas.some(c => c[0] === 'leads' && c[1].estado === 'ganado' && c[2] === 'ENFOCADO'));
  r.desmontar();
});
