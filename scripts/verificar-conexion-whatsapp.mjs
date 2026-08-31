/**
 * CONECTAR WHATSAPP SIN SER TECNICO (2026-08-30).
 *
 * Jonathan, en vivo con una clienta trabada: "este problema puede pasar a
 * muchas personas que intenten entrar a nuestra herramienta... necesito que la
 * conexion de dispositivos sea lo mas sencilla posible, recuerda que no son
 * personas tecnicas".
 *
 * QUE PASABA. El boton grande naranja abria el flujo de numeros NUEVOS, y la
 * coexistencia —el caso de casi todo negocio peruano, que ya usa WhatsApp
 * Business en el celular— vivia abajo como un link gris subrayado. La clienta
 * toco el grande, Meta le pidio crear un perfil de empresa, y termino en "el
 * numero ya esta asociado con otra empresa (#3441062)". En su cabeza: LeadAI
 * esta roto. Abandono.
 *
 * Si la conexion falla, el cliente nunca llega a usar el producto: todo lo
 * demas que construimos no importa.
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 */
import { readFileSync } from 'node:fs';

const leerSinComentarios = (rel) =>
  readFileSync(new URL(rel, import.meta.url), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const comp = leerSinComentarios('../components/ConectarWhatsApp.tsx');
const compCrudo = readFileSync(new URL('../components/ConectarWhatsApp.tsx', import.meta.url), 'utf8');

let fallas = 0;
const check = (nombre, ok, detalle) => {
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${nombre}`);
  if (!ok) {
    fallas++;
    if (detalle) console.log(`       ${detalle}`);
  }
};

// ── 1. Se PREGUNTA antes de abrir Meta ───────────────────────────────────
// La correccion de fondo: nadie tiene que adivinar cual de los dos flujos le
// toca.
check(
  'hay un paso de pregunta antes de abrir el dialogo',
  /useState<"pregunta" \| "aviso">\("pregunta"\)/.test(comp),
  'sin esto se vuelve al boton que elegia el flujo por el usuario',
);
check(
  'las dos opciones se ofrecen con el mismo peso visual',
  (compCrudo.match(/ring-1 ring-linea transition hover:ring-orbita/g) ?? []).length >= 2,
  'si una es un boton grande y la otra un link gris, se vuelve al bug original',
);
check(
  'la opcion de coexistencia dice que NO pierde la app ni los chats',
  /sin borrar la app ni perder tus chats/.test(compCrudo),
  'es el miedo que frena a quien ya usa WhatsApp Business',
);

// ── 2. Se AVISA que van a entrar a Meta ──────────────────────────────────
// Cada pantalla del asistente que aparece sin aviso se siente un error nuestro.
check(
  'antes de abrir se explica que pide Meta',
  /asistente de Meta/.test(compCrudo) && /cuenta de Facebook/.test(compCrudo),
);
check(
  'se aclara que el tramite es de Meta, no de LeadAI',
  /no de LeadAI/.test(compCrudo),
  'sin esto, un error de Meta se lee como un producto roto',
);
check(
  'se avisa que se hace una sola vez',
  /una sola vez/.test(compCrudo),
);

// ── 3. El celular avisa, pero no bloquea ─────────────────────────────────
check(
  'detecta el celular',
  /android\|iphone\|ipad\|ipod/i.test(comp),
);
check(
  'en celular sugiere la computadora SIN bloquear',
  /funciona mucho mejor/.test(compCrudo) && !/disabled=\{enCelular/.test(comp),
  'bloquear al que solo tiene celular seria perderlo entero',
);

// ── 4. Los errores de Meta, traducidos ───────────────────────────────────
const errores = leerSinComentarios('../lib/errores-meta.ts');
const erroresCrudo = readFileSync(new URL('../lib/errores-meta.ts', import.meta.url), 'utf8');

check(
  'el componente traduce el error en vez de mostrarlo crudo',
  /traducirErrorMeta\(error\)/.test(comp),
  'el texto de Meta ("#3441062") no le dice nada al dueno',
);
check(
  'el caso de la clienta esta cubierto: numero ya vinculado',
  /3441062/.test(errores) && /desvincular de la plataforma/.test(erroresCrudo),
);
check(
  'cada error trae PASOS concretos, no "contacta soporte"',
  /pasos: \[/.test(errores) && !/contacta a soporte/i.test(erroresCrudo),
);
check(
  'siempre devuelve algo: nunca deja al dueno sin mensaje',
  /return GENERICO;/.test(errores) &&
    (errores.match(/return GENERICO;/g) ?? []).length === 2,
  'un error sin traduccion tiene que caer al generico, no a pantalla vacia',
);
check(
  'se puede reintentar desde el error',
  /Intentar de nuevo/.test(compCrudo) && /setPaso\("pregunta"\)/.test(comp),
  'el error mas comun se arregla y se reintenta: sin boton hay que recargar',
);

// ── 5. Lo que NO se puede romper ─────────────────────────────────────────
// El modo decide `featureType`, que es lo que le dice al backend que NO
// desregistre el numero. Si se pierde, la app del celular del dueno se apaga.
// LAS DOS VECES: una al abrir el dialogo de Meta y otra al canjear el code en
// el backend. Buscarlo suelto daba ok con una sola, y basta que falte la del
// dialogo para que Meta trate el numero como nuevo y lo desregistre.
check(
  'el modo coexistencia manda su featureType a Meta Y al backend',
  (comp.match(/modo === "coexistencia"/g) ?? []).length >= 2 &&
    (comp.match(/whatsapp_business_app_onboarding/g) ?? []).length >= 2,
  'sin esto el numero se desregistra y el dueno pierde su app de WhatsApp Business',
);
check(
  'el modo elegido es el que se conecta',
  /conectar\(modo\)/.test(comp),
  'si se pasa un literal, la pregunta al usuario no sirve de nada',
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
