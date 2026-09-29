import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarModulo } from './helpers/cargar-modulo-marketing.mjs';
import { renderer, texto, diferida } from './helpers/render-marketing.mjs';

function almacen() {
  const datos = new Map();
  return { datos, getItem: k => datos.get(k) ?? null, setItem: (k, v) => datos.set(k, v), removeItem: k => datos.delete(k) };
}
async function pantalla({ storage = almacen(), api = {}, tenant = 'B', confirmar = () => false } = {}) {
  const r = renderer();
  const lecturas = [];
  let globals = 0;
  const navegar = { replace() {} };
  const modulo = cargarModulo('components/panel/AnunciosPanel.tsx', {
    react: r.hooks,
    'next/navigation': { useRouter: () => navegar },
    '@/lib/auth': { haySesion: () => true, leerEmpresaActiva: () => 'A', empresasVisibles: () => [{ tenantId: 'A', nombre: 'Alfa' }] },
    '@/components/panel/GlobalNegocios': {
      useSeccionGlobal: () => { globals++; return { tenantLista: 'A', listaLista: true, resuelto: true, modoGlobal: false, negocios: [] }; },
      BarraNegociosGlobal: () => null,
    },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, AnuncioIlustracion: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
    '@/lib/api': {
      listarAnuncios: async t => { lecturas.push(t); return []; },
      objetivosAd: async () => [
        { id: 'mensajes', pregunta: 'Recibir mensajes', porque: 'Conversar', recomendado: true },
        { id: 'trafico', pregunta: 'Visitas web', porque: 'Visitar' },
      ],
      bolsaAnuncios: async () => null,
      publicoSugeridoAd: async () => ({ edadMin: 18, edadMax: 55, intereses: [] }),
      publicosEnMeta: async () => [], canalesAd: async () => [],
      presupuestoAd: async () => ({ diario: 10, minimoOk: true, aviso: 'Presupuesto válido', minimoSugeridoDiario: 5, mensajesEstimados: { min: 1, max: 5 } }),
      crearAnuncio: async () => ({ ok: true, id: 'borrador-1' }),
      publicarAnuncioMeta: async () => ({ ok: true }),
      ...api,
    },
  }, { window: { localStorage: storage, confirm: confirmar }, localStorage: storage });
  r.montar(modulo.default, { embebido: true, tenant, nombreNegocio: 'Beta' }); await r.flush();
  return { r, storage, lecturas, get globals() { return globals; } };
}
const boton = (r, patron) => r.nodos(n => n.type === 'button' && patron.test(texto(n)))[0];
async function abrir(r) { boton(r, /Crear anuncio|Retomar borrador/).props.onClick(); await r.flush(); }
async function siguiente(r) { boton(r, /^Siguiente$/).props.onClick(); await r.flush(); }
async function escribir(r, placeholder, value) {
  r.nodos(n => n.type === 'input' && n.props.placeholder?.includes(placeholder))[0].props.onChange({ target: { value } }); await r.flush();
}

test('el creador embebido sólo consulta el negocio del padre y no crea otro selector global', async () => {
  const p = await pantalla();
  assert.deepEqual(p.lecturas, ['B']);
  assert.equal(p.globals, 0);
});

test('objetivos que Meta aún no admite aparecen deshabilitados', async () => {
  const { r } = await pantalla(); await abrir(r);
  assert.equal(boton(r, /Visitas web/).props.disabled, true);
  assert.match(texto(boton(r, /Visitas web/)), /disponible/i);
});

test('el borrador se recupera después de desmontar y recargar, separado por negocio', async () => {
  const storage = almacen();
  const { r } = await pantalla({ storage }); await abrir(r); await siguiente(r);
  await escribir(r, 'Promo', 'Campaña Beta'); r.desmontar();
  const b = await pantalla({ storage });
  assert.ok(boton(b.r, /Retomar borrador/));
  await abrir(b.r);
  assert.ok(b.r.nodos(n => n.type === 'input' && n.props.value === 'Campaña Beta').length);
  const a = await pantalla({ storage, tenant: 'A' });
  assert.equal(boton(a.r, /Retomar borrador/), undefined);
  assert.ok([...storage.datos.keys()].some(k => /v1/.test(k)), 'Almacenamiento versionado');
});

test('subir imagen es alcanzable por teclado y tiene nombre accesible', async () => {
  const { r } = await pantalla(); await abrir(r); await siguiente(r);
  const input = r.nodos(n => n.type === 'input' && n.props.type === 'file')[0];
  assert.ok(input.props['aria-label']);
  assert.equal(/(^|\s)hidden(\s|$)/.test(input.props.className ?? ''), false);
});

test('la lista fallida muestra recuperación y no afirma que no hay anuncios', async () => {
  const { r } = await pantalla({ api: { listarAnuncios: async () => { throw new Error('Sin red'); } } });
  assert.ok(boton(r, /Reintentar/));
  assert.doesNotMatch(texto(r.arbol), /Todavía no creaste/);
});

test('al cambiar de negocio se descarta una respuesta anterior del creador', async () => {
  const a = diferida();
  const { r } = await pantalla({ tenant: 'A', api: { listarAnuncios: t => t === 'A' ? a.promise : Promise.resolve([]) } });
  r.actualizar({ embebido: true, tenant: 'B', nombreNegocio: 'Beta' }); await r.flush();
  a.resolve([{ id: 'ad-a', estado: 'borrador', campaniaNombre: 'Campaña ajena', texto: 'A', presupuestoTotal: 100, dias: 7, objetivo: 'mensajes', mediaUrl: null }]); await r.flush();
  assert.doesNotMatch(texto(r.arbol), /Campaña ajena/);
});

const borrador = { paso: 3, objetivo: 'mensajes', campania: 'Promo Beta', texto: 'Escríbenos', mediaUrl: 'https://media.test/imagen.jpg', zona: 'Lima', edadMin: '18', edadMax: '55', total: '100', dias: '7', canal: 'todos', incluir: [], excluir: [], intereses: [] };
function guardarFixture(storage, campos = {}, tenant = 'B') {
  storage.setItem(`leadai:anuncio:v1:${tenant}`, JSON.stringify({ version: 1, tenant, borrador: { ...borrador, ...campos } }));
}

test('no persiste imágenes base64 ni campos desconocidos al retomar un borrador', async () => {
  const storage = almacen(); guardarFixture(storage, { mediaUrl: 'data:image/png;base64,AAAA', imagenbase64: 'AAAA', encender: true });
  const { r } = await pantalla({ storage });
  assert.ok(boton(r, /Retomar borrador/)); await abrir(r);
  const guardado = storage.getItem('leadai:anuncio:v1:B');
  assert.doesNotMatch(guardado, /base64|AAAA|encender/);
});

test('una recomendación vieja no pisa el presupuesto más reciente', async () => {
  const storage = almacen(); guardarFixture(storage);
  const primero = diferida(), segundo = diferida();
  const { r } = await pantalla({ storage, api: { presupuestoAd: total => total === 100 ? primero.promise : segundo.promise } });
  await abrir(r); await new Promise(resolve => setTimeout(resolve, 320));
  r.nodos(n => n.type === 'input' && n.props.value === '100')[0].props.onChange({ target: { value: '200' } }); await r.flush();
  await new Promise(resolve => setTimeout(resolve, 320));
  segundo.resolve({ diario: 28, minimoOk: true, aviso: 'Recomendación nueva' }); await r.flush();
  primero.resolve({ diario: 14, minimoOk: true, aviso: 'Recomendación vieja' }); await r.flush();
  assert.match(texto(r.arbol), /Recomendación nueva/);
  assert.doesNotMatch(texto(r.arbol), /Recomendación vieja/);
});

test('reintentar una publicación fallida confirmada como borrador reutiliza el ID y bloquea doble envío', async () => {
  const storage = almacen(); guardarFixture(storage, { paso: 4 });
  let creaciones = 0, publicaciones = 0;
  const pendiente = diferida();
  const { r } = await pantalla({ storage, api: {
    listarAnuncios: async () => creaciones ? [anuncioRemoto('remoto-B', 'borrador')] : [],
    crearAnuncio: async () => { creaciones++; return { ok: true, id: 'remoto-B' }; },
    publicarAnuncioMeta: async () => { publicaciones++; return pendiente.promise; },
  } });
  await abrir(r);
  const publicar = boton(r, /^Publicar anuncio$/);
  assert.ok(publicar, 'El borrador recuperado debe permitir publicar desde el resumen');
  publicar.props.onClick(); publicar.props.onClick(); await r.flush();
  assert.equal(creaciones, 1); assert.equal(publicaciones, 1);
  pendiente.resolve({ ok: false, error: 'Zona no admitida' }); await r.flush();
  assert.match(texto(r.arbol), /Zona no admitida/);
  boton(r, /Reintentar publicación/).props.onClick(); await r.flush();
  assert.equal(creaciones, 1); assert.equal(publicaciones, 2);
  assert.equal(JSON.parse(storage.getItem('leadai:anuncio:v1:B')).borrador.id, 'remoto-B');
});

test('publicar el borrador desde la lista elimina también su copia local', async () => {
  const storage = almacen(); guardarFixture(storage, { paso: 4, id: 'remoto-B' });
  const { r } = await pantalla({ storage, api: {
    listarAnuncios: async () => [{ id: 'remoto-B', estado: 'borrador', objetivo: 'mensajes', campaniaNombre: 'Promo Beta', texto: 'Escríbenos', mediaUrl: 'https://media.test/imagen.jpg', presupuestoTotal: 100, dias: 7 }],
  } });
  boton(r, /^Publicar en Meta$/).props.onClick(); await r.flush();
  assert.equal(storage.getItem('leadai:anuncio:v1:B'), null);
  assert.equal(boton(r, /Retomar borrador/), undefined);
});

test('abrir el historial muestra borradores remotos y conserva el local sin crear otro anuncio', async () => {
  let creaciones = 0;
  const { r } = await pantalla({ api: {
    crearAnuncio: async () => { creaciones++; return { ok: true, id: 'no-debe-crearse' }; },
    listarAnuncios: async () => [{ id: 'remoto-B', estado: 'borrador', objetivo: 'mensajes', campaniaNombre: 'Borrador remoto Beta', texto: 'Escríbenos', mediaUrl: 'https://media.test/imagen.jpg', presupuestoTotal: 100, dias: 7 }],
  } });
  await abrir(r); await siguiente(r); await escribir(r, 'Promo', 'Borrador local Beta');
  r.actualizar({ embebido: true, tenant: 'B', nombreNegocio: 'Beta', solicitudHistorial: 1 }); await r.flush();
  assert.match(texto(r.arbol), /Borrador remoto Beta/);
  assert.ok(boton(r, /^Retomar borrador$/));
  assert.equal(boton(r, /^Siguiente$/), undefined, 'El acceso abre historial, no el wizard');
  await abrir(r);
  assert.ok(r.nodos(n => n.type === 'input' && n.props.value === 'Borrador local Beta').length);
  assert.equal(creaciones, 0);
});

test('cancelar el descarte conserva el ID remoto y el borrador tras recargar', async () => {
  const storage = almacen(); guardarFixture(storage, { paso: 4, id: 'remoto-rechazado' });
  let confirmaciones = 0, mutaciones = 0;
  const { r } = await pantalla({ storage, confirmar: () => { confirmaciones++; return false; }, api: {
    listarAnuncios: async () => [anuncioRemoto('remoto-rechazado', 'borrador')],
    crearAnuncio: async () => { mutaciones++; return { ok: true, id: 'otro' }; },
    publicarAnuncioMeta: async () => { mutaciones++; return { ok: true }; },
  } });
  const descartar = boton(r, /^Descartar borrador local y crear otro$/);
  assert.ok(descartar, 'La salida también debe estar disponible después de cerrar o recargar');
  descartar.props.onClick(); await r.flush();
  assert.equal(confirmaciones, 1);
  assert.equal(mutaciones, 0);
  assert.equal(JSON.parse(storage.getItem('leadai:anuncio:v1:B')).borrador.id, 'remoto-rechazado');
  assert.ok(boton(r, /^Retomar borrador$/));
});

test('tras un rechazo se puede confirmar otro borrador, corregir la zona y publicar con un ID nuevo', async () => {
  const storage = almacen(); guardarFixture(storage, { paso: 4 });
  const creados = [], publicados = [], remotos = new Map();
  const { r } = await pantalla({ storage, confirmar: () => true, api: {
    listarAnuncios: async () => [...remotos].map(([id, datos]) => ({ ...datos, id, estado: 'borrador' })),
    crearAnuncio: async (datos, tenant) => {
      const id = `remoto-${creados.length + 1}`;
      creados.push({ datos, tenant }); remotos.set(id, datos);
      return { ok: true, id };
    },
    publicarAnuncioMeta: async (id, tenant, encender) => {
      publicados.push({ id, tenant, encender });
      return id === 'remoto-1' ? { ok: false, error: 'Zona no admitida' } : { ok: true };
    },
  } });
  await abrir(r);
  r.nodos(n => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } }); await r.flush();
  boton(r, /^Publicar anuncio$/).props.onClick(); await r.flush();
  assert.match(texto(r.arbol), /Zona no admitida/);
  const descartar = boton(r, /^Descartar borrador local y crear otro$/);
  assert.ok(descartar, 'Un borrador rechazado debe permitir corregir sus datos como otro anuncio');
  descartar.props.onClick(); await r.flush();
  assert.equal(creados.length, 1, 'Descartar no crea nada en el servidor');
  assert.equal(publicados.length, 1, 'Descartar no publica nada');
  assert.equal(remotos.has('remoto-1'), true, 'El borrador remoto se conserva');
  assert.equal(JSON.parse(storage.getItem('leadai:anuncio:v1:B')).borrador.id, undefined);
  assert.ok(r.nodos(n => n.type === 'input' && n.props.value === 'Promo Beta').length);
  await siguiente(r);
  r.nodos(n => n.type === 'select' && n.props['aria-label'] === 'Zona del anuncio')[0].props.onChange({ target: { value: 'Tacna' } }); await r.flush();
  await siguiente(r); await siguiente(r);
  assert.equal(creados.length, 1, 'Editar y avanzar no crea automáticamente el reemplazo');
  assert.equal(r.nodos(n => n.type === 'input' && n.props.type === 'checkbox')[0].props.checked, false);
  boton(r, /^Publicar anuncio$/).props.onClick(); await r.flush();
  assert.equal(creados.length, 2);
  assert.equal(creados[1].datos.publico.zona, 'Tacna');
  assert.equal(creados[1].tenant, 'B');
  assert.deepEqual(publicados[1], { id: 'remoto-2', tenant: 'B', encender: false });
  assert.equal(remotos.get('remoto-1').publico.zona, 'Lima');
});

function anuncioRemoto(id, estado) {
  return { id, estado, objetivo: 'mensajes', campaniaNombre: 'Promo Beta', texto: 'Escríbenos', mediaUrl: borrador.mediaUrl, presupuestoTotal: 100, dias: 7 };
}

for (const estadoRemoto of ['publicando', 'sin verificar', 'lectura fallida']) {
  test(`un ID remoto ${estadoRemoto} no permite publicar ni descartar para clonar`, async () => {
    const storage = almacen(); guardarFixture(storage, { paso: 4, id: 'remoto-B' });
    let mutaciones = 0;
    const { r } = await pantalla({ storage, confirmar: () => true, api: {
      listarAnuncios: async () => {
        if (estadoRemoto === 'lectura fallida') throw new Error('Sin conexión');
        return estadoRemoto === 'sin verificar' ? [] : [anuncioRemoto('remoto-B', estadoRemoto)];
      },
      crearAnuncio: async () => { mutaciones++; return { ok: true, id: 'otro' }; },
      publicarAnuncioMeta: async () => { mutaciones++; return { ok: true }; },
    } });
    if (estadoRemoto === 'publicando') assert.match(texto(r.arbol), /En proceso · requiere verificar/);
    assert.equal(boton(r, /^Publicar en Meta$/), undefined);
    assert.equal(boton(r, /^Descartar borrador local y crear otro$/), undefined);
    await abrir(r);
    assert.equal(boton(r, /Reintentar publicación|^Publicar anuncio$/), undefined);
    assert.ok(boton(r, /^Verificar estado$/));
    assert.equal(mutaciones, 0);
    assert.equal(JSON.parse(storage.getItem('leadai:anuncio:v1:B')).borrador.id, 'remoto-B');
  });
}

test('un fallo ambiguo refresca estado y conserva el ID publicando sin reintentar ni clonar', async () => {
  const storage = almacen(); guardarFixture(storage, { paso: 4 });
  let creaciones = 0, publicaciones = 0;
  const { r } = await pantalla({ storage, confirmar: () => true, api: {
    listarAnuncios: async () => creaciones ? [anuncioRemoto('remoto-B', 'publicando')] : [],
    crearAnuncio: async () => { creaciones++; return { ok: true, id: 'remoto-B' }; },
    publicarAnuncioMeta: async () => { publicaciones++; return { ok: false, error: 'Resultado ambiguo; requiere revisión' }; },
  } });
  await abrir(r);
  boton(r, /^Publicar anuncio$/).props.onClick(); await r.flush();
  assert.match(texto(r.arbol), /En proceso · requiere verificar/);
  assert.equal(boton(r, /Reintentar publicación|^Publicar anuncio$|Descartar borrador local/), undefined);
  boton(r, /^Verificar estado$/).props.onClick(); await r.flush();
  assert.equal(creaciones, 1); assert.equal(publicaciones, 1);
  assert.equal(JSON.parse(storage.getItem('leadai:anuncio:v1:B')).borrador.id, 'remoto-B');
});
