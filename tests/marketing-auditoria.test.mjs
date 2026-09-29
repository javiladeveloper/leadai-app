import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montar, texto, diferido } from './marketing-render.helper.mjs';

const ad = (adId, nombre, extra = {}) => ({ adId, nombre, campania: 'Lima', estado: 'ACTIVE', gastoCentavos: 2000, personas: 100, impresiones: 200, clics: 10, ctr: 5, frecuencia: 2, interacciones: 0, clicsAlLink: 3, ...extra });
const periodo = { desde: '2026-08-30', hasta: '2026-09-29', dias: 30 };
const metricas = (anuncios) => ({ periodo, moneda: 'PEN', actualizadoEn: '2026-09-29T12:00:00Z', cuenta: { gastoCentavos: 4000, impresiones: 400, clics: 20 }, anuncios, campanias: [] });
const panel = (nombre, api, props) => montar(`components/panel/${nombre}.tsx`, nombre, api, props);
const boton = (h, patron) => h.buscar((n) => n.type === 'button' && patron.test(texto(n)));

test('listado filtra nombre/campaña/estado y ordena gasto sin sumar personas únicas', async () => {
  const h = panel('MetricasAnuncios', { metricasAds: async () => metricas([ad('a', 'Clínica', { gastoCentavos: 3000 }), ad('b', 'Dental', { campania: 'Cusco', gastoCentavos: 1000, estado: 'PAUSED' })]) });
  await h.flush();
  assert.doesNotMatch(h.texto().replace(/\s+/g, ' '), /200 personas/);
  const buscar = h.buscar((n) => n.type === 'input' && n.props.type === 'search');
  assert.ok(buscar, 'búsqueda disponible');
  boton(h, /Todos/).props.onClick(); await h.flush();
  buscar.props.onChange({ target: { value: 'CUSCO' } }); await h.flush();
  assert.match(h.texto(), /Dental/); assert.doesNotMatch(h.texto(), /Clínica/);
});

test('campaña solicita confirmación de gasto y conserva tenant en la mutación', async () => {
  const llamadas = [];
  const h = panel('MetricasAnuncios', { metricasAds: async () => metricas([ad('a', 'Dental', { estado: 'CAMPAIGN_PAUSED', campaniaId: 'c1' })]), cambiarEstadoCampania: async (...args) => { llamadas.push(args); return { ok: true }; } }, { tenant: 't1' });
  await h.flush(); boton(h, /Todos/).props.onClick(); await h.flush();
  boton(h, /Dental/).props.onClick(); await h.flush();
  boton(h, /^Reactivar campaña$/).props.onClick(); await h.flush();
  assert.equal(llamadas.length, 0);
  assert.match(h.texto(), /presupuesto|gasto|gastar/);
  const confirmar = boton(h, /Sí, reactivar/); assert.ok(confirmar);
  confirmar.props.onClick(); await h.flush();
  assert.deepEqual(llamadas, [['c1', 'ACTIVE', 't1']]);
});

const reporte = { periodo: { desde: '2026-08-30', hasta: '2026-09-29', dias: 30 }, ventasMedidas: false, resultado: { tipo: 'leads', etiqueta: 'Leads registrados' }, actualizadoEn: null, aviso: null, sinGasto: false, gastoTotalCentavos: 1000, organicos: { leads: 0, compradores: 0, ventasCentavos: 0 }, filas: [{ origen: 'ad:a', nombre: 'Dental', leads: 2, compradores: 0, ventasCentavos: 0, conversion: 0, gastoCentavos: 0, gastoConocido: false, roas: 0, costoPorVentaCentavos: null }] };
test('reporte respeta DTO: gasto desconocido y ventas no medidas nunca son cero ni pérdida', async () => {
  const llamadas = [];
  const h = panel('ReporteAnuncios', { obtenerReporteAnuncios: async (...args) => { llamadas.push(args); return reporte; } }, { tenant: 't1' });
  await h.flush();
  assert.deepEqual(llamadas, [[30, 't1']]);
  assert.match(h.texto(), /No medid[oa]|Sin medir/); assert.doesNotMatch(h.texto(), /S\/0[.,]00|pierde|rinde|justo/);
  assert.match(h.texto(), /Leads registrados/);
});

test('embudo no interpreta clics al enlace como aperturas de WhatsApp ni imprime ratios entre fuentes', async () => {
  const h = panel('EmbudoAnuncios', { api: async () => ({ periodo, moneda: 'PEN', actualizadoEn: null, embudos: [{ anuncioId: 'a', nombre: 'Dental', gastoCentavos: 1000, pasos: [{ etiqueta: 'Vieron', cantidad: 100, porcentaje: null }, { etiqueta: 'Tocaron', cantidad: 10, porcentaje: 10 }, { etiqueta: 'Fueron al WhatsApp', cantidad: 5, porcentaje: 50 }, { etiqueta: 'Escribieron', cantidad: 1, porcentaje: 20 }], problema: 'no_escribe', consejo: 'Cambia el texto', costoPorConversacionCentavos: 1000 }] }) });
  await h.flush();
  assert.match(h.texto(), /Clics al enlace/); assert.match(h.texto(), /CRM/);
  assert.doesNotMatch(h.texto(), /50%|20%|Fueron al WhatsApp|Cambia el texto/);
});

test('rendimiento muestra las 24 horas y tabs accesibles', async () => {
  const h = panel('RendimientoAnuncios', { rendimientoAds: async () => ({ periodo, moneda: 'PEN', ranking: [], desgloses: { porHora: Array.from({ length: 24 }, (_, i) => ({ etiqueta: `${i}:00`, ctr: 1, gastoCentavos: 100, impresiones: 100, clics: 1 })), porEdad: [], porRed: [], porZona: [] } }) });
  await h.flush(); assert.match(h.texto(), /23:00/);
  assert.ok(h.buscar((n) => n.props.role === 'tablist'));
  assert.doesNotMatch(h.texto(), /Conviene concentrar el presupuesto/);
});

test('métricas distinguen error recuperable y descartan respuestas de otro tenant', async () => {
  const antigua = diferido(); let intentos = 0;
  const h = panel('MetricasAnuncios', { metricasAds: async (tenant) => { if (tenant === 'viejo') return antigua.promise; if (++intentos === 1) throw new Error('Sin conexión'); return metricas([ad('b', 'Nuevo')]); } }, { tenant: 'viejo' });
  await h.flush(); await h.props({ tenant: 'nuevo' });
  assert.ok(h.buscar((n) => n.props.role === 'alert'));
  boton(h, /Reintentar/).props.onClick(); await h.flush();
  antigua.resolve(metricas([ad('a', 'Viejo')])); await h.flush();
  assert.match(h.texto(), /Nuevo/); assert.doesNotMatch(h.texto(), /Viejo/);
});

const publicoApi = {
  listarPublicos: async () => [], publicosEnMeta: async () => [{ id: 'p1', nombre: 'Clientes', tipo: 'CUSTOM', personas: 100, listo: true, estado: 'Listo' }],
  contarLeadsParaPublico: async () => ({ contactos: 0, alcanza: false, minimo: 100 }),
  revisarPublico: async () => ({ contactos: 1, descartados: 0, alcanza: false, alcanzaParaSimilar: false, minimo: 100, minimoSimilar: 100 }),
};
const archivo = (name = 'telefonos.csv') => ({ name, arrayBuffer: async () => new TextEncoder().encode('987654321').buffer });

test('CSV pequeño permite elegir público existente y agregar sin crear uno nuevo', async () => {
  const llamadas = [];
  const h = panel('PublicosMeta', { ...publicoApi, agregarAPublico: async (...args) => { llamadas.push(args); return { ok: true, mensaje: 'Agregado' }; } }, { tenant: 't1' });
  await h.flush();
  const input = h.buscar((n) => n.type === 'input' && n.props.type === 'file');
  assert.notEqual(input.props.className, 'hidden', 'archivo alcanzable mediante teclado');
  input.props.onChange({ target: { files: [archivo()], value: 'telefonos.csv' } }); await h.flush();
  const destino = h.buscar((n) => n.type === 'select'); assert.ok(destino, 'selector disponible aunque no alcance el mínimo');
  destino.props.onChange({ target: { value: 'p1' } }); await h.flush();
  const agregar = boton(h, /Agregar 1 contactos/); assert.ok(agregar); assert.equal(agregar.props.disabled, false);
  agregar.props.onClick(); await h.flush();
  assert.equal(llamadas.length, 1); assert.equal(llamadas[0][0], 'p1'); assert.equal(llamadas[0][2], 't1');
});

test('CSV descarta revisión tardía del archivo anterior', async () => {
  const vieja = diferido(); let n = 0;
  const h = panel('PublicosMeta', { ...publicoApi, revisarPublico: async () => ++n === 1 ? vieja.promise : { contactos: 2, alcanza: false, descartados: 0, minimo: 100, minimoSimilar: 100, alcanzaParaSimilar: false } });
  await h.flush();
  const elegir = (name) => h.buscar((x) => x.type === 'input' && x.props.type === 'file').props.onChange({ target: { files: [archivo(name)] } });
  elegir('viejo.csv'); await h.flush(); elegir('nuevo.csv'); await h.flush();
  vieja.resolve({ contactos: 700, alcanza: true, descartados: 0, minimo: 100, minimoSimilar: 100, alcanzaParaSimilar: true }); await h.flush();
  assert.doesNotMatch(h.texto(), /700/); assert.match(h.texto(), /nuevo.csv/);
});

const post = (id) => ({ id, texto: `Post ${id}`, estado: 'publicada', mediaUrls: [], destinos: [], tipoMedia: 'imagen' });
const router = { replace() {} };
const globalNegocios = { modoGlobal: false, negocios: [], tenantLista: 't1', listaLista: true, enfocado: 't1' };
function publicador(api) {
  globalThis.window = { addEventListener() {}, removeEventListener() {}, confirm: () => false };
  return montar('components/panel/PublicarPanel.tsx', 'default', { plantillasPost: async () => [], listarCanales: async () => [{ activo: true, tipo: 'messenger' }], ...api }, { embebido: true, tenant: 't1' }, {
    'next/navigation': { useRouter: () => router },
    '@/lib/auth': { haySesion: () => true, empresasVisibles: () => [], leerEmpresaActiva: () => 't1' },
    '@/components/panel/GlobalNegocios': { useSeccionGlobal: () => globalNegocios, BarraNegociosGlobal: () => null },
    '@/components/panel/HeroSeccion': { HeroSeccion: () => null, CabeceraFormulario: () => null, PublicarIlustracion: () => null },
    '@/components/panel/PreviewRedes': { PreviewRedes: () => null },
    '@/components/panel/RendimientoPosts': { RendimientoPosts: () => null },
    '@/components/Skeletons': { SkeletonLista: () => null },
  });
}

test('publicaciones conserva posts, cursor y borrador tras fallar página siguiente; reintenta el mismo cursor', async () => {
  const llamadas = []; let fallar = true;
  const h = publicador({ listarPublicaciones: async (tenant, cursor) => { llamadas.push([tenant, cursor]); if (cursor && fallar) throw new Error('Sin conexión'); return cursor ? { items: [post('2')], siguiente: null } : { items: [post('1')], siguiente: 'c1' }; } });
  await h.flush();
  const textarea = h.buscar((n) => n.type === 'textarea');
  textarea.props.onChange({ target: { value: 'Borrador conservado' } }); await h.flush();
  await Promise.resolve(boton(h, /Ver más publicaciones/).props.onClick()).catch(() => {}); await h.flush();
  assert.match(h.texto(), /Post 1/); assert.ok(h.buscar((n) => n.props.role === 'alert'));
  assert.equal(h.buscar((n) => n.type === 'textarea').props.value, 'Borrador conservado');
  fallar = false; await boton(h, /Ver más publicaciones|Reintentar.*publicaciones/).props.onClick(); await h.flush();
  assert.deepEqual(llamadas.at(-1), ['t1', 'c1']); assert.match(h.texto(), /Post 2/);
  const campo = h.buscar((n) => n.type === 'textarea');
  assert.ok(campo.props.id && h.buscar((n) => n.type === 'label' && n.props.htmlFor === campo.props.id));
  h.unmount();
});

test('reporte USD separa compras PEN sin ROAS y sin ventas medidas muestra interesados reales', async () => {
  const dto = { ...reporte, moneda: 'USD', ventasMedidas: true, resultado: { tipo: 'pedidos', etiqueta: 'Pedidos registrados' }, filas: [{ ...reporte.filas[0], gastoConocido: true, gastoCentavos: 1250, ventasCentavos: 5500, compradores: 2, interesados: 9, roas: 4.4 }] };
  const h = panel('ReporteAnuncios', { obtenerReporteAnuncios: async () => dto }); await h.flush();
  assert.match(h.texto(), /12.50 USD/); assert.match(h.texto(), /55.00 PEN/); assert.doesNotMatch(h.texto(), /4.40x|S\//);
  const h2 = panel('ReporteAnuncios', { obtenerReporteAnuncios: async () => ({ ...dto, ventasMedidas: false, resultado: { tipo: 'leads', etiqueta: 'Interesados' } }) }); await h2.flush();
  assert.match(h2.texto(), /9/); assert.doesNotMatch(h2.texto(), /55.00|Ventas registradas \(PEN\)/); assert.match(h2.texto(), /no acreditan citas/);
});

test('métricas solicita 7 días, muestra su moneda y rechaza una caché de otro periodo', async () => {
  const llamadas = [];
  const h = panel('MetricasAnuncios', { metricasAds: async (...args) => { llamadas.push(args); return { ...metricas([ad('a', 'Semana')]), moneda: 'USD', periodo: { desde: '2026-09-22', hasta: '2026-09-29', dias: 7 } }; } }, { tenant: 't1', dias: 7 });
  await h.flush(); assert.deepEqual(llamadas, [['t1', 7]]); assert.match(h.texto(), /Semana/); assert.match(h.texto(), /USD/); assert.doesNotMatch(h.texto(), /S\//);
  const mala = panel('MetricasAnuncios', { metricasAds: async () => ({ ...metricas([ad('a', 'Cache vieja')]), periodo: { desde: '2026-08-30', hasta: '2026-09-29', dias: 30 } }) }, { dias: 7 });
  await mala.flush(); assert.doesNotMatch(mala.texto(), /Cache vieja/); assert.match(mala.texto(), /periodo/);
});

test('orígenes recibe días del padre y actualiza consulta sin selector independiente', async () => {
  const llamadas = [];
  const api = { origenDeLeads: async (...args) => { llamadas.push(args); return [{ etiqueta: 'Dental', tipo: 'anuncio', leads: 2, calientes: 1, costoPorLeadCentavos: 1000 }]; } };
  const h = panel('OrigenDeLeads', api, { tenant: 't1', dias: 7 }); await h.flush();
  assert.deepEqual(llamadas, [[7, 't1']]); assert.doesNotMatch(h.texto(), /S\//);
  assert.equal(h.nodos().filter((n) => n.type === 'button' && /días/.test(texto(n))).length, 0);
  await h.props({ tenant: 't1', dias: 90 }); assert.deepEqual(llamadas.at(-1), [90, 't1']);
});

test('reporte resume gasto e interesados de todas las filas pero muestra solo 20 hasta ver más', async () => {
  const dto = { ...reporte, moneda: 'USD', gastoTotalCentavos: 123400, filas: Array.from({ length: 28 }, (_, i) => ({ ...reporte.filas[0], origen: `a${i}`, nombre: `Anuncio ${i}`, interesados: 2 })) };
  const h = panel('ReporteAnuncios', { obtenerReporteAnuncios: async () => dto }); await h.flush();
  assert.match(h.texto(), /1,234.00 USD/); assert.match(h.texto(), /56\s+interesados/);
  assert.equal(h.nodos().filter((n) => n.type === 'tr').length, 21);
  assert.doesNotMatch(h.texto(), /El retorno registrado relaciona/);
  boton(h, /Ver más/).props.onClick(); await h.flush();
  assert.equal(h.nodos().filter((n) => n.type === 'tr').length, 29);
});

test('métricas limita filas a 20 y reinicia límite al cambiar filtros', async () => {
  const h = panel('MetricasAnuncios', { metricasAds: async () => metricas(Array.from({ length: 45 }, (_, i) => ad(`a${i}`, `Anuncio ${i}`))) }); await h.flush();
  const filas = () => h.nodos().filter((n) => n.type === 'button' && n.props['aria-expanded'] !== undefined);
  assert.equal(filas().length, 20); boton(h, /Ver más/).props.onClick(); await h.flush(); assert.equal(filas().length, 40);
  h.buscar((n) => n.type === 'input' && n.props.type === 'search').props.onChange({ target: { value: 'Anuncio' } }); await h.flush();
  assert.equal(filas().length, 20);
});

test('orden por gasto/costo usa conversaciones atribuidas por Meta, conserva cero y envía desconocido al final', async () => {
  const h = panel('MetricasAnuncios', { metricasAds: async () => metricas([
    ad('a', 'Alto', { gastoCentavos: 5000, conversaciones: 5 }),
    ad('b', 'Cero', { gastoCentavos: 0, conversaciones: 1 }),
    ad('c', 'Desconocido', { gastoCentavos: 9000 }),
  ]) }); await h.flush();
  const nombres = () => h.nodos().filter((n) => n.type === 'button' && n.props['aria-expanded'] !== undefined).map(texto);
  assert.match(nombres()[0], /Desconocido/);
  h.buscar((n) => n.type === 'select' && n.props.value === 'gasto').props.onChange({ target: { value: 'costo' } }); await h.flush();
  assert.match(nombres()[0], /Cero/); assert.match(nombres()[2], /Desconocido/);
});

test('embudo conserva metadatos: moneda USD, periodo solicitado y fuentes separadas', async () => {
  const llamadas = [];
  const datos = { periodo: { ...periodo, dias: 7 }, moneda: 'USD', actualizadoEn: '2026-09-29T13:00:00Z', embudos: [{ anuncioId: 'a', nombre: 'Semana', gastoCentavos: 1200, problema: 'sano', consejo: 'Actividad', costoPorConversacionCentavos: 600, pasos: [{ etiqueta: 'Conversaciones atribuidas por Meta', cantidad: 2, porcentaje: null }, { etiqueta: 'Contactos nuevos en LeadAI', cantidad: 1, porcentaje: null }] }] };
  const h = panel('EmbudoAnuncios', { api: async (...args) => { llamadas.push(args); return datos; }, embudoAnuncios: async () => datos.embudos }, { tenant: 't1', dias: 7 }); await h.flush();
  assert.deepEqual(llamadas, [['/anuncios/embudo?dias=7', { tenant: 't1' }]]);
  assert.match(h.texto(), /12.00 USD/); assert.match(h.texto(), /Actividad registrada/); assert.doesNotMatch(h.texto(), /Funciona|S\//);
  assert.ok(h.buscar((n) => n.type === 'div' && texto(n).includes('Meta · actividad') && texto(n).includes('Conversaciones atribuidas por Meta')));
});

test('encender anuncio requiere confirmar, cancelar no muta y doble clic no duplica', async () => {
  const pendiente = diferido(); const llamadas = [];
  const h = panel('MetricasAnuncios', { metricasAds: async () => metricas([ad('a', 'Pausado', { estado: 'PAUSED' })]), cambiarEstadoAnuncio: async (...args) => { llamadas.push(args); return pendiente.promise; } }, { tenant: 't2' }); await h.flush();
  boton(h, /Todos/).props.onClick(); await h.flush(); boton(h, /Pausado/).props.onClick(); await h.flush();
  boton(h, /^Encender$/).props.onClick(); await h.flush(); boton(h, /^Cancelar$/).props.onClick(); await h.flush(); assert.equal(llamadas.length, 0);
  boton(h, /^Encender$/).props.onClick(); await h.flush(); const confirmar = boton(h, /Sí, empezar a gastar/);
  confirmar.props.onClick(); confirmar.props.onClick(); await h.flush();
  assert.deepEqual(llamadas, [['a', 'ACTIVE', 't2']]); pendiente.resolve({ ok: true }); await h.flush();
});

test('tabs de rendimiento omiten desgloses vacíos al navegar con flechas', async () => {
  const fila = [{ etiqueta: 'Facebook', ctr: 1, gastoCentavos: 100, clics: 1, impresiones: 100 }];
  const h = panel('RendimientoAnuncios', { rendimientoAds: async () => ({ periodo, moneda: 'USD', ranking: [], desgloses: { porHora: fila, porEdad: [], porRed: fila, porZona: [] } }) }); await h.flush();
  h.buscar((n) => n.props.role === 'tab' && n.props['aria-selected']).props.onKeyDown({ key: 'ArrowRight', preventDefault() {} }); await h.flush();
  assert.equal(texto(h.buscar((n) => n.props.role === 'tab' && n.props['aria-selected'])), 'Por red');
  assert.match(h.texto(), /USD/); assert.doesNotMatch(h.texto(), /S\//);
});

test('error al enviar publicación conserva texto y recupera el botón sin publicar automáticamente', async () => {
  let publicaciones = 0;
  const h = publicador({ listarPublicaciones: async () => ({ items: [], siguiente: null }), crearPublicacion: async () => { publicaciones++; throw new Error('Sin conexión'); } }); await h.flush();
  assert.equal(publicaciones, 0);
  h.buscar((n) => n.type === 'textarea').props.onChange({ target: { value: 'Mi borrador' } }); await h.flush();
  await Promise.resolve(boton(h, /^Publicar ahora$/).props.onClick()).catch(() => {}); await h.flush();
  assert.equal(h.buscar((n) => n.type === 'textarea').props.value, 'Mi borrador');
  assert.match(h.texto(), /Sin conexión/); assert.equal(boton(h, /^Publicar ahora$/).props.disabled, false);
  assert.equal(publicaciones, 1); h.unmount();
});

test('fallo de retargeting se anuncia y permite volver a intentarlo', async () => {
  const h = panel('PublicosMeta', { ...publicoApi, crearRetargeting: async () => { throw new Error('No se pudo crear'); } }); await h.flush();
  boton(h, /^Crear este público$/).props.onClick(); await h.flush();
  assert.match(h.texto(), /No se pudo crear/); assert.equal(boton(h, /^Crear este público$/).props.disabled, false);
});

test('publicación parcial conserva borrador y reintenta solo Instagram sin duplicar Facebook', async (t) => {
  const anteriores = { Image: globalThis.Image, FileReader: globalThis.FileReader };
  globalThis.Image = class {
    naturalWidth = 1080; naturalHeight = 1080;
    set src(_valor) { queueMicrotask(() => this.onload()); }
  };
  globalThis.FileReader = class {
    readAsDataURL() { this.result = 'data:image/png;base64,AA=='; queueMicrotask(() => this.onload()); }
  };
  t.after(() => {
    for (const [nombre, valor] of Object.entries(anteriores)) {
      if (valor === undefined) delete globalThis[nombre]; else globalThis[nombre] = valor;
    }
  });
  const llamadas = [];
  const h = publicador({
    listarCanales: async () => [{ activo: true, tipo: 'messenger' }, { activo: true, tipo: 'instagram' }],
    listarPublicaciones: async () => ({ items: [], siguiente: null }),
    subirMediaPost: async () => ({ ok: true, url: 'https://media.test/foto.png', tipoMedia: 'imagen' }),
    crearPublicacion: async (datos, tenant) => {
      llamadas.push({ datos: structuredClone(datos), tenant });
      return { ok: true, publicacion: { ...post('parcial'), destinos: llamadas.length === 1
        ? [{ id: 'fb', canal: 'messenger', formato: 'post', estado: 'publicada', postExterno: 'fb-1' }, { id: 'ig', canal: 'instagram', formato: 'post', estado: 'fallida', error: 'Instagram no disponible' }]
        : [{ id: 'ig-reintento', canal: 'instagram', formato: 'post', estado: 'publicada', postExterno: 'ig-1' }] } };
    },
  });
  t.after(() => h.unmount());
  await h.flush();
  h.buscar((n) => n.type === 'textarea').props.onChange({ target: { value: 'Oferta de hoy' } });
  await h.buscar((n) => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [new File(['foto'], 'foto.png', { type: 'image/png' })], value: '' } });
  await h.flush();
  assert.equal(llamadas.length, 0);
  assert.equal(boton(h, /^Publicar ahora$/).props.disabled, false);
  await boton(h, /^Publicar ahora$/).props.onClick(); await h.flush();
  // La actualización del historial ya terminó: tampoco debe reactivar Facebook.
  assert.equal(h.buscar((n) => n.type === 'textarea').props.value, 'Oferta de hoy');
  const avisoParcial = h.texto();
  const facebookBloqueado = boton(h, /Página de Facebook/).props.disabled;
  await boton(h, /^(Publicar ahora|Reintentar.*)$/).props.onClick(); await h.flush();
  assert.deepEqual(llamadas.map((x) => x.datos.canales), [['instagram', 'messenger'], ['instagram']]);
  assert.match(avisoParcial, /[Pp]ublicaci[oó]n parcial/);
  assert.match(avisoParcial, /Facebook.*publicad|publicad.*Facebook/);
  assert.equal(facebookBloqueado, true);
  assert.deepEqual(llamadas.map((x) => x.tenant), ['t1', 't1']);
  assert.equal(llamadas[1].datos.texto, 'Oferta de hoy');
  assert.deepEqual(llamadas[1].datos.mediaUrls, ['https://media.test/foto.png']);
  assert.equal(h.buscar((n) => n.type === 'textarea').props.value, '');
  assert.equal(boton(h, /Página de Facebook/).props.disabled, false);
});
