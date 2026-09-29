import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto, diferida } from './helpers/render-marketing.mjs';

const plan = { rescateActivo: false, seguimientoEscaladoActivo: false, alertasAnunciosA: null, adsTopeMax: 100 };
async function pantalla(api, tenant = 'B') {
  const r = renderer();
  const { AjustesMarketing } = cargarModulo('components/panel/AjustesMarketing.tsx', {
    react: r.hooks, '@/lib/api': { obtenerMiPlan: async () => plan, guardarMiPlan: async () => ({ ok: true }), ...api },
  });
  r.montar(AjustesMarketing, { tenant }); await r.flush(); return r;
}

test('lee y guarda el plan del tenant visible; dos clics no duplican el PATCH', async () => {
  const carga = [], guardados = [], espera = diferida();
  const r = await pantalla({
    obtenerMiPlan: async tenant => { carga.push(tenant); return plan; },
    guardarMiPlan: (cfg, tenant) => { guardados.push({ cfg, tenant }); return espera.promise; },
  });
  assert.deepEqual(carga, ['B']);
  const control = r.nodos(n => n.props.role === 'switch')[0];
  control.props.onClick(); control.props.onClick(); await r.flush();
  assert.equal(guardados.length, 1);
  assert.equal(guardados[0].tenant, 'B');
  assert.equal(guardados[0].cfg.rescateActivo, true);
  assert.equal(r.nodos(n => n.props.role === 'switch')[0].props.disabled, true);
  espera.resolve({ ok: true }); await r.flush();
  assert.equal(r.nodos(n => n.props.role === 'switch')[0].props['aria-checked'], true);
});

test('un PATCH rechazado revierte el interruptor y muestra el error', async () => {
  const espera = diferida();
  const r = await pantalla({ guardarMiPlan: () => espera.promise });
  r.nodos(n => n.props.role === 'switch')[0].props.onClick(); await r.flush();
  espera.resolve({ ok: false, error: 'No tienes permiso' }); await r.flush();
  assert.equal(r.nodos(n => n.props.role === 'switch')[0].props['aria-checked'], false);
  assert.match(texto(r.arbol), /No tienes permiso/);
});

test('una lectura fallida termina la carga y ofrece reintentar', async () => {
  let intentos = 0;
  const r = await pantalla({ obtenerMiPlan: async () => ++intentos === 1 ? null : plan });
  const reintentar = r.nodos(n => n.type === 'button' && /Reintentar/.test(texto(n)))[0];
  assert.ok(reintentar, 'La lectura fallida debe ser recuperable');
  reintentar.props.onClick(); await r.flush();
  assert.equal(r.nodos(n => n.props.role === 'switch').length, 3);
});

test('las alertas apagadas permiten escribir un número y activarlas', async () => {
  const guardados = [];
  const r = await pantalla({ guardarMiPlan: async cfg => { guardados.push(cfg); return { ok: true }; } });
  const numero = r.nodos(n => n.type === 'input' && n.props.inputMode === 'numeric')[0];
  assert.ok(numero, 'El campo no puede quedar escondido detrás de un switch que no hace nada');
  numero.props.onChange({ target: { value: '51987654321' } }); await r.flush();
  const activar = r.nodos(n => n.type === 'button' && /Activar alertas/.test(texto(n)))[0];
  activar.props.onClick(); await r.flush();
  assert.equal(guardados[0].alertasAnunciosA, '51987654321');
});

test('el tope inválido no borra el límite de gasto guardado', async () => {
  const guardados = [];
  const r = await pantalla({ guardarMiPlan: async cfg => { guardados.push(cfg); return { ok: true }; } });
  r.nodos(n => n.type === 'input' && n.props.inputMode === 'decimal')[0].props.onChange({ target: { value: 'abc' } }); await r.flush();
  r.nodos(n => n.type === 'button' && /Guardar/.test(texto(n))).at(-1).props.onClick(); await r.flush();
  assert.equal(guardados.length, 0);
  assert.match(texto(r.arbol), /válido/);
});

test('una lectura tardía del negocio A no cambia el plan del B', async () => {
  const a = diferida();
  const r = await pantalla({ obtenerMiPlan: tenant => tenant === 'A' ? a.promise : Promise.resolve(plan) }, 'A');
  r.actualizar({ tenant: 'B' }); await r.flush();
  a.resolve({ ...plan, rescateActivo: true }); await r.flush();
  assert.equal(r.nodos(n => n.props.role === 'switch')[0].props['aria-checked'], false);
});
