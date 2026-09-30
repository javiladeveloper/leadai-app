import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto } from './helpers/render-marketing.mjs';

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
