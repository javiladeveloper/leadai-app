import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * LA NAVEGACIÓN DEL PANEL DE PLATAFORMA EN EL CELULAR (2026-09-09).
 *
 * El caso real (Jonathan): "tengo un panel plataforma que solo funciona en
 * web... cuando abro en web mobile se pierde por el responsive". `AdminSidebar`
 * es `hidden lg:flex`: por debajo de 1024px la ÚNICA navegación desaparecía y
 * no había reemplazo, así que desde el celular solo se podía cambiar de
 * sección escribiendo la URL a mano.
 *
 * Estos tests miran el fuente porque lo que se rompió no es una función sino
 * una DECISIÓN de layout: que exista una barra para móvil, que no duplique la
 * lista de secciones, y que las tablas anchas puedan scrollear.
 */

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), 'utf8');

test('hay una navegación de móvil y el layout la monta', () => {
  const barra = leer('../components/admin/AdminNavInferior.tsx');
  // Se esconde en escritorio (ahí manda el sidebar) y aparece en móvil.
  assert.match(barra, /lg:hidden/);
  // Respeta el notch del teléfono, igual que la barra del panel de negocio.
  assert.match(barra, /env\(safe-area-inset-bottom\)/);

  const layout = leer('../app/admin/layout.tsx');
  assert.match(layout, /<AdminNavInferior \/>/);
});

test('la barra NO duplica la lista de secciones: la importa del sidebar', () => {
  // Dos listas paralelas es cómo el panel de negocio se desincronizó antes:
  // agregar una sección obligaba a acordarse de dos archivos.
  const barra = leer('../components/admin/AdminNavInferior.tsx');
  assert.match(barra, /import \{ SECCIONES_ADMIN \}/);
  // Y no define ninguna lista propia de rutas.
  assert.doesNotMatch(barra, /href: "\/admin/);
});

test('el sidebar exporta las secciones y sigue oculto en móvil', () => {
  const sidebar = leer('../components/admin/AdminSidebar.tsx');
  assert.match(sidebar, /export const SECCIONES_ADMIN/);
  assert.match(sidebar, /hidden lg:flex/);
});

test('salir al panel de negocio es alcanzable en móvil', () => {
  // Ese enlace vivía SOLO dentro del sidebar oculto: en el celular no había
  // forma de volver al panel del negocio sin escribir la URL.
  const layout = leer('../app/admin/layout.tsx');
  assert.match(layout, /href="\/inicio"/);
  assert.match(layout, /lg:hidden/);
});

test('las tablas anchas pueden scrollear en vez de comprimirse', () => {
  // `overflow-x-auto` + `w-full` sin ancho mínimo es un scroll INERTE: la
  // tabla se encoge hasta ser ilegible en vez de desbordar. El `min-w` es lo
  // que activa el scroll que el wrapper ya tenía preparado.
  const anchas = [
    ['../app/admin/negocios/page.tsx', 'negocios y ventas'],
    ['../app/admin/negocios/[id]/page.tsx', 'movimientos del negocio'],
    ['../app/admin/placas/page.tsx', 'inventario de placas'],
  ];
  for (const [ruta, que] of anchas) {
    const src = leer(ruta);
    assert.match(src, /overflow-x-auto/, `${que}: falta el wrapper de scroll`);
    assert.match(src, /min-w-\[\d+px\]/, `${que}: la tabla se comprime en vez de scrollear`);
  }
});

test('no quedan anchos mínimos que desborden un teléfono angosto', () => {
  // El input del tenantId tenía `min-w-[220px]` fijo, que en un teléfono de
  // 320px no deja margen. Ahora crece y encoge dentro del flex.
  const placas = leer('../app/admin/placas/page.tsx');
  assert.doesNotMatch(placas, /className="min-w-\[220px\]/);
  assert.match(placas, /sm:min-w-\[220px\]/);
});
