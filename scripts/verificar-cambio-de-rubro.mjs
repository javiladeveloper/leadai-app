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

// ── 6. El onboarding pide el rubro REAL dentro de Ventas ─────────────────
//
// La causa raiz del caso de Guisella: el alta ofrece dos opciones que son las
// MODALIDADES del producto (gastronomia con carta y cocina, ventas que es
// captacion). Eso esta bien. Pero "Ventas / Comercio / Tienda" terminaba
// siendo tambien el RUBRO guardado, y de ahi sale el playbook: una
// inmobiliaria no tenia forma de decir que lo era.
const alta = readFileSync(new URL('../app/bienvenida/page.tsx', import.meta.url), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

check(
  'el alta separa la MODALIDAD del rubro',
  /const \[modalidad, setModalidad\]/.test(alta),
);
check(
  'al elegir Ventas se pide el rubro real',
  /modalidad === "ventas" &&/.test(alta) && /RUBROS_CAPTACION\.map/.test(alta),
);
check(
  'en gastronomia la modalidad ES el rubro (no se pregunta dos veces)',
  /m === "gastronomia" \? "gastronomia" : ""/.test(alta),
  'sin esto un restaurante quedaria con el rubro vacio y perderia Carta y Cocina',
);
check(
  'no se puede avanzar en Ventas sin elegir rubro',
  /modalidad === "ventas" && !rubro/.test(alta),
  'sin la guarda el negocio nace con el playbook generico, que es el bug original',
);

// La lista de captacion tiene que cubrir los rubros con plantilla propia: si
// falta uno, ese negocio no puede elegirse a si mismo y cae en la generica.
const rubros = readFileSync(new URL('../lib/rubros.ts', import.meta.url), 'utf8');
check(
  'los rubros con plantilla propia se pueden elegir en Ventas',
  ['inmobiliaria', 'contable', 'legal', 'salud', 'automotriz', 'mascotas', 'eventos', 'seguros']
    .every((r) => new RegExp(`'${r}'`).test(rubros.slice(rubros.indexOf('RUBROS_DE_VENTAS')))),
  'un rubro con plantilla que no se puede elegir es una plantilla que nadie usa',
);

// ── 7. El playbook, partido en identidad y guion ─────────────────────────
//
// Jonathan (2026-08-30): "toooooda esta configuracion debe estar en la seccion
// bot". El criterio: si cambiarlo cambia lo que el bot DICE, es del bot.
//
// El 27 se habia movido ENTERO y "Tu negocio" quedo vacio para captacion, asi
// que volvio entero — y quedo peor, con el nombre del negocio conviviendo con
// las objeciones del bot. Este bloque cuida que no se vuelva a ninguno de los
// dos extremos.
const cfg = readFileSync(new URL('../app/(panel)/configuracion/page.tsx', import.meta.url), 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

check(
  'la identidad se edita en "Tu negocio"',
  /<PlaybookEditor parte="identidad" \/>/.test(cfg),
  'sin esto "Tu negocio" queda vacio para captacion — ya paso el 27',
);
check(
  'el guion del bot se edita en la pestana Bot',
  /<PlaybookEditor parte="guion" \/>/.test(cfg),
);
check(
  'el nombre y el rubro NO se muestran en la parte del guion',
  /\{esIdentidad && \(/.test(codigo),
  'duplicarlos deja al usuario sin saber cual manda',
);
check(
  'los bloques del guion NO se muestran en la parte de identidad',
  (codigo.match(/\{esGuion && /g) ?? []).length >= 5,
  'si un bloque se escapa, "Tu negocio" vuelve a mezclar identidad con guion',
);

// LO QUE NO SE PUEDE ROMPER: el PUT de /perfil es full-replace, asi que cada
// mitad tiene que mandar el perfil ENTERO. Si mandara solo lo suyo, guardar
// desde Bot borraria el nombre del negocio.
check(
  'guardar manda el perfil completo, no solo la mitad visible',
  /guardarPerfil\(perfil\.rubro \|\| "general", perfil\)/.test(codigo),
  'el PUT es full-replace: mandar media mitad borra la otra',
);

// ── 8. Lo que el bot HACE es lista cerrada, no texto libre ───────────────
//
// Jonathan (2026-08-30): "te pueden escribir que agende citas... eso el bot no
// lo hace, lo que hacemos es escalar con una persona".
//
// La distincion: lo que el bot SABE puede ser texto libre (si se equivoca dice
// un dato mal); lo que el bot HACE, nunca (si se equivoca le promete al
// cliente algo que no va a pasar).
const acciones = readFileSync(new URL('../components/panel/AccionesDelBot.tsx', import.meta.url), 'utf8');

check(
  'la lista de acciones se muestra en la pestana Bot',
  /<AccionesDelBot \/>/.test(cfg),
);
check(
  'las acciones NO se editan: no hay input ni textarea',
  !/<input|<textarea|onChange/.test(acciones),
  'si se puede escribir, vuelve el problema: el dueno promete lo que el bot no hace',
);
// ACOTADO A ESA ACCION: buscar `activa: false` suelto pasaba igual, porque hay
// otras apagadas en la lista que lo hacian matchear. Se mira el bloque que
// arranca en su titulo.
const iAgendar = acciones.indexOf('Agendar citas');
const bloqueAgendar = acciones.slice(
  iAgendar,
  // Hasta el cierre de ESA entrada. Un tope fijo de caracteres se pasaba a la
  // accion siguiente —que tambien esta apagada— y la hacia pasar igual.
  iAgendar === -1 ? 0 : acciones.indexOf('\n    },', iAgendar),
);
check(
  'agendar citas figura APAGADA y dice que escala a una persona',
  acciones.includes('Agendar citas') &&
    /activa: false/.test(bloqueAgendar) &&
    /te lo pasa a ti|pasa a ti para que lo agendes/.test(bloqueAgendar),
  'es la que motivo todo esto: verla apagada responde la pregunta antes de que la hagan',
);
check(
  'cada accion apagada dice que hace el bot en su lugar',
  (acciones.match(/enSuLugar:/g) ?? []).length >= 3,
  'una capacidad apagada sin alternativa deja al dueno sin saber que esperar',
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
