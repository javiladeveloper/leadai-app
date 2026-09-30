import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';

function cliente(respuesta = {}, status = 200) {
  const peticiones = [];
  const api = cargarModulo('lib/api.ts', {
    './auth': { leerSesion: () => ({ token: 'sesion' }), leerEmpresaActiva: () => 'negocio-A', EMPRESA_GLOBAL: 'global' },
  }, { fetch: async (url, opciones) => {
    peticiones.push({ url, ...opciones });
    return { ok: status < 400, status, json: async () => respuesta };
  } });
  return { api, peticiones };
}

test('Comentarios carga y guarda ajustes del negocio visible, no el activo de otra sección', async () => {
  const { api, peticiones } = cliente({ comentariosActivo: true });
  await api.obtenerMiPlanComentarios('negocio-B');
  await api.guardarMiPlan({ comentariosActivo: false }, 'negocio-B');
  assert.ok(peticiones.every((p) => p.headers['X-Tenant-Id'] === 'negocio-B'));
});

test('fallos de comentarios, canales y ajustes se muestran como error, no como lista vacía', async () => {
  const { api } = cliente({ error: 'Sin permiso' }, 403);
  await assert.rejects(api.listarComentarios('negocio-B'), (e) => e.status === 403);
  await assert.rejects(api.listarCanalesComentarios('negocio-B'), (e) => e.status === 403);
  await assert.rejects(api.obtenerMiPlanComentarios('negocio-B'), (e) => e.status === 403);
});

test('respuesta parcial conserva ambos resultados y el error', async () => {
  const { api, peticiones } = cliente({ comentario: { id: 'c1' }, publica: false, privada: true, error: 'Pública rechazada' });
  const r = await api.responderComentario('c1', { texto: 'Hola', privado: true, tenant: 'negocio-B' });
  assert.equal(r.ok, true);
  assert.equal(r.comentario.id, 'c1');
  assert.equal(r.publica, false);
  assert.equal(r.privada, true);
  assert.equal(r.error, 'Pública rechazada');
  assert.equal(peticiones[0].headers['X-Tenant-Id'], 'negocio-B');
});

test('la vista previa conserva destinos previstos sin atribuir entrega real', async () => {
  const { api } = cliente({ intencion: 'compra', respuesta: 'Hola', enviado: false, destinosPrevistos: { publica: true, privada: true } });
  const r = await api.simularComentario({ texto: 'Precio', tenant: 'negocio-B' });
  assert.equal(r.enviado, false);
  assert.deepEqual(r.destinosPrevistos, { publica: true, privada: true });
});
