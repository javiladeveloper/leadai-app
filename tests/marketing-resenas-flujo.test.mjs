import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montar, diferido } from './marketing-render.helper.mjs';

function editor(guardados, enlaceInicial = '', obtener, guardar, guardarNegocio) {
  return montar('components/panel/PresenciaEditor.tsx', 'PresenciaEditor', {}, { tenant: 'clinica-demo' }, {
    '@/lib/horario': {
      obtenerHorario: obtener ?? (async () => ({ googleReviewUrl: enlaceInicial, slug: '', instagramUrl: '', facebookUrl: '', tiktokUrl: '', metaPixelId: '', googleAnalyticsId: '', capiDatasetId: '' })),
      guardarHorario: guardar ?? (async (cambios, tenant) => { guardados.push([cambios, tenant]); return { ok: true }; }),
    },
    '@/lib/negocio': { guardarDatosNegocio: guardarNegocio ?? (async () => ({ ok: true })) },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null },
    '@/components/panel/LinksDeOrigen': { LinksDeOrigen: () => null },
  });
}

function campoResena(h) {
  return h.buscar((n) => n.type === 'input' && n.props.inputMode === 'url');
}

test('un enlace de compartir la ficha de Maps no se guarda como formulario de reseñas', async () => {
  const guardados = [];
  const h = editor(guardados);
  await h.flush();
  const campo = campoResena(h);
  assert.ok(campo);
  campo.props.onChange({ target: { value: 'https://maps.app.goo.gl/ejemplo' } });
  await h.flush();
  campoResena(h).props.onBlur();
  await h.flush();
  assert.deepEqual(guardados, []);
  assert.equal(campoResena(h).props['aria-invalid'], true);
  assert.ok(h.buscar((n) => n.props.role === 'alert' && /ficha de Maps/.test(String(n.props.children))));
  assert.match(h.texto(), /enlace.*reseña|reseña.*enlace/i);
  h.unmount();
});

test('un guardado tardío de redes no borra la red del negocio nuevo', async () => {
  const pendiente = diferido();
  const h = editor([], '', async (tenant) => ({ googleReviewUrl: '', instagramUrl: tenant === 'clinica-demo'
    ? 'https://instagram.com/anterior' : 'https://instagram.com/nuevo' }), undefined, async () => pendiente.promise);
  await h.flush();
  const instagram = () => h.buscar((n) => n.type === 'input' && n.props.placeholder === 'https://instagram.com/tunegocio');
  instagram().props.onChange({ target: { value: 'https://instagram.com/editado' } });
  await h.flush();
  instagram().props.onBlur();
  await h.props({ tenant: 'negocio-nuevo' });
  pendiente.resolve({ ok: false, error: 'Error antiguo' });
  await h.flush();
  assert.equal(instagram().props.value, 'https://instagram.com/nuevo');
  assert.doesNotMatch(h.texto(), /Error antiguo/);
  h.unmount();
});

test('un guardado tardío del negocio anterior no altera la pantalla del negocio nuevo', async () => {
  const pendiente = diferido();
  const h = editor([], '', async (tenant) => ({ googleReviewUrl: tenant === 'clinica-demo'
    ? 'https://g.page/r/ANTERIOR/review' : 'https://g.page/r/NUEVO/review' }),
  async () => pendiente.promise);
  await h.flush();
  campoResena(h).props.onChange({ target: { value: 'https://g.page/r/EDITADO/review' } });
  await h.flush();
  campoResena(h).props.onBlur();
  await h.props({ tenant: 'negocio-nuevo' });
  pendiente.resolve({ ok: false, error: 'Guardado anterior falló' });
  await h.flush();
  assert.equal(campoResena(h).props.value, 'https://g.page/r/NUEVO/review');
  assert.doesNotMatch(h.texto(), /Guardado anterior falló/);
  h.unmount();
});

test('al cambiar de negocio no muestra ni permite editar la configuración del anterior mientras carga', async () => {
  const pendiente = diferido();
  const h = editor([], '', async (tenant) => tenant === 'clinica-demo'
    ? { googleReviewUrl: 'https://g.page/r/ANTERIOR/review' }
    : pendiente.promise);
  await h.flush();
  assert.ok(campoResena(h));
  await h.props({ tenant: 'negocio-nuevo' });
  assert.equal(campoResena(h), undefined);
  assert.doesNotMatch(h.texto(), /ANTERIOR/);
  pendiente.resolve({ googleReviewUrl: 'https://g.page/r/NUEVO/review' });
  await h.flush();
  assert.equal(campoResena(h).props.value, 'https://g.page/r/NUEVO/review');
  h.unmount();
});

test('si no carga la configuración muestra un error y permite reintentar sin recargar la página', async () => {
  let intentos = 0;
  const h = editor([], '', async () => ++intentos === 1 ? null : { googleReviewUrl: '' });
  await h.flush();
  assert.ok(h.buscar((n) => n.props.role === 'alert'));
  const reintentar = h.buscar((n) => n.type === 'button' && /Reintentar/.test(h.texto?.(n) ?? n.props.children));
  assert.ok(reintentar);
  reintentar.props.onClick();
  await h.flush();
  assert.ok(campoResena(h));
  h.unmount();
});

test('un enlace antiguo a la ficha se señala como pendiente de reemplazar, sin pedir crear otra ficha', async () => {
  const h = editor([], 'https://maps.app.goo.gl/ficha-antigua');
  await h.flush();
  assert.match(h.texto(), /enlace.*ficha.*reseñas|ficha.*enlace.*reseñas/i);
  assert.doesNotMatch(h.texto(), /¿Tu negocio todavía no está en Google\?/);
  h.unmount();
});

test('el flujo enseña a obtener y comprobar el enlace directo; guarda el del negocio enfocado', async () => {
  const guardados = [];
  const h = editor(guardados);
  await h.flush();
  assert.match(h.texto(), /Consigue más reseñas/i);
  assert.doesNotMatch(h.texto(), /4\s*o\s*5 estrellas|califican bajo/i);
  campoResena(h).props.onChange({ target: { value: 'https://g.page/r/CQabc123/review' } });
  await h.flush();
  campoResena(h).props.onBlur();
  await h.flush();
  assert.deepEqual(guardados, [[{ googleReviewUrl: 'https://g.page/r/CQabc123/review' }, 'clinica-demo']]);
  assert.ok(h.buscar((n) => n.type === 'a' && n.props.href === 'https://g.page/r/CQabc123/review'), 'el enlace guardado se puede abrir para comprobarlo');
  h.unmount();
});
