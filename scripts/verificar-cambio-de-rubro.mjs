/**
 * CAMBIAR DE RUBRO PUEDE CAMBIAR EL PLAYBOOK (2026-08-30).
 *
 * Caso real, en vivo con Guisella: creo una inmobiliaria, eligio "Ventas /
 * Comercio / Tienda" —donde cae casi todo— y el bot quedo preguntandole a
 * quien busca casa "¿cuantas unidades necesita?" y "¿hay stock?".
 *
 * Al corregir el rubro NO pasaba nada: `completarConPlantilla` solo rellena
 * listas VACIAS (para no pisar lo que escribio el dueno) y el boton "Completar
 * con lo tipico de mi rubro" solo aparece si las cuatro estan vacias. Las dos
 * protecciones son correctas por separado; juntas dejaban al usuario ATRAPADO
 * con la plantilla equivocada, sin mas salida que borrar item por item.
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 *
 * LO QUE MAS SE CUIDA: que NUNCA se le ofrezca reemplazar listas que el dueno
 * escribio. Perder el playbook que alguien redacto a mano es mucho peor que
 * dejarlo con la plantilla equivocada, que al menos puede corregir.
 */
import { readFileSync } from 'node:fs';

const ruta = new URL('../components/panel/PlaybookEditor.tsx', import.meta.url);
const src = readFileSync(ruta, 'utf8');

// Sin comentarios: el codigo cita el problema para explicarlo, y buscar sobre
// el texto crudo daria falsos positivos contra la propia explicacion.
const codigo = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

let fallas = 0;
const check = (nombre, ok, detalle) => {
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${nombre}`);
  if (!ok) {
    fallas++;
    if (detalle) console.log(`       ${detalle}`);
  }
};

// ── 1. La comparacion existe y es por CONTENIDO ──────────────────────────
// Es lo que separa "esto lo pusimos nosotros" de "esto lo escribio el dueno".
check(
  'existe el comparador contra la plantilla',
  /function esLaPlantilla/.test(codigo),
);
check(
  'compara las CUATRO listas, no solo una',
  ['preguntasClave', 'senalesCaliente', 'senalesFrio', 'objeciones']
    .every((l) => new RegExp(`plantilla\\.${l}`).test(codigo)),
  'si una queda afuera, se le ofreceria pisar una lista que el dueno edito',
);
// Las DOS veces: perfil y plantilla. Comparar un lado con respuesta y el otro
// sin ella da siempre distinto, y entonces nunca se ofrece nada — el bug es
// silencioso, que es el peor tipo.
check(
  'las objeciones se comparan con su respuesta en AMBOS lados',
  (codigo.match(/objecion\}→\$\{o\.respuesta\}/g) ?? []).length === 2,
  'dos objeciones pueden llamarse igual y tener respuestas distintas',
);
check(
  'compara tambien el LARGO de cada lista',
  /a\.length === b\.length/.test(codigo),
  'sin esto, agregar un item al final no contaria como edicion',
);

// ── 2. El ofrecimiento esta condicionado ─────────────────────────────────
check(
  'solo se ofrece si las listas son la plantilla vieja',
  /if \(!esLaPlantilla\(perfil, vieja\)\) return;/.test(codigo),
  'sin esta guarda se le ofreceria reemplazar lo que escribio a mano',
);
check(
  'no se ofrece si el rubro no cambio',
  /nuevo === anterior\) return;/.test(codigo),
);
check(
  'no se ofrece si las cuatro listas estan vacias',
  /todoVacio\) return;/.test(codigo),
  'ese caso ya lo cubre el bloque de "¿Empezamos con lo tipico?"',
);
check(
  'si falta alguna plantilla, se calla en vez de proponer a ciegas',
  /if \(!vieja \|\| !nueva\) return;/.test(codigo),
);

// ── 3. Se OFRECE, no se aplica solo ──────────────────────────────────────
// Cambiar cuatro listas sin preguntar es exactamente lo que da miedo.
check(
  'hay boton de aceptar y de rechazar',
  /Sí, actualizar/.test(src) && /Dejar las mías/.test(src),
);
check(
  'rechazar limpia el ofrecimiento sin tocar el perfil',
  /onClick=\{\(\) => setOferta\(null\)\}/.test(codigo),
);

// ── 4. El pedido al backend lleva el rubro ───────────────────────────────
// Sin el parametro, el endpoint devuelve la plantilla del perfil GUARDADO y
// las dos consultas darian lo mismo: nunca se detectaria el cambio.
check(
  'pide la plantilla del rubro viejo Y la del nuevo',
  /obtenerSugerenciasPlaybook\(anterior/.test(codigo) &&
    /obtenerSugerenciasPlaybook\(nuevo\)/.test(codigo),
);

// ── 5. El cliente de API pasa el rubro por query ─────────────────────────
// Sin comentarios tambien aca: el comentario de esa funcion menciona `rubro`
// para explicar por que existe el parametro, y buscarlo crudo daba un falso ok
// aunque el codigo hubiera dejado de mandarlo.
const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
// Acotado a ESA funcion: `encodeURIComponent(rubro)` aparece tambien en otra
// del mismo archivo, y buscarlo en todo `api.ts` daba ok aunque esta hubiera
// dejado de mandar el parametro.
const fn = api.slice(
  api.indexOf('export async function obtenerSugerenciasPlaybook'),
  api.indexOf('export async function obtenerPerfil'),
);
check(
  'obtenerSugerenciasPlaybook manda ?rubro= cuando se lo pasan',
  /\?rubro=\$\{encodeURIComponent\(rubro\)\}/.test(fn),
  'sin esto ambas llamadas devuelven la plantilla del perfil guardado',
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
