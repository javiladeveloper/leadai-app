/**
 * EL ALTA TIENE DOS RECORRIDOS Y ES FÁCIL ROMPER UNO (2026-08-31).
 *
 * El bug que motiva esto: cuando se agregó el paso de conectar WhatsApp, se
 * agregó SOLO a la rama de restaurantes. Un negocio de captación terminaba el
 * alta sin canal —leía "¡Todo listo!" y su bot no atendía a nadie, porque no
 * había por dónde— y tenía que descubrir solo que existe Configuración →
 * Canales. Nada fallaba: el alta se completaba perfecto y el producto no servía.
 *
 * Los números de paso NO siguen el orden de pantalla (el 6 va segundo, el 7
 * anteúltimo), así que el recorrido no se lee de un vistazo. Por eso se calcula
 * acá con la misma lógica del componente y se comprueba contra lo esperado.
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../app/bienvenida/page.tsx', import.meta.url), 'utf8');
const sinComentarios = src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

let fallas = 0;
const check = (nombre, ok, detalle) => {
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${nombre}`);
  if (!ok) { fallas++; if (detalle) console.log(`       ${detalle}`); }
};

// ── El recorrido, reconstruido del código ────────────────────────────────
const mapa = /const POSICION: Record<number, number> = \{([^}]*)\}/.exec(sinComentarios);
const POSICION = Object.fromEntries(
  (mapa?.[1] ?? '').split(',').map((p) => p.split(':').map((x) => Number(x.trim()))),
);
// EL RECORRIDO SALE DE LOS REQUISITOS, no de una lista de números por rubro:
// cada paso declara qué capacidad necesita, y el rubro decide cuáles tiene.
const iniReq = sinComentarios.indexOf('const REQUISITO');
const finReq = sinComentarios.indexOf('};', iniReq);
const REQUISITO = Object.fromEntries(
  sinComentarios
    .slice(iniReq, finReq)
    .split(String.fromCharCode(10))
    .map((l) => /^\s*(\d+):\s*('?\w+'?|null)/.exec(l))
    .filter(Boolean)
    .map((m) => [Number(m[1]), m[2] === 'null' ? null : m[2].replace(/'/g, '')]),
);

// Las capacidades de cada rubro, como las declara `capacidadesDe`.
const CAPS = {
  restaurante: { tieneCarta: true, tieneCocina: true },
  captacion: { tieneCarta: false, tieneCocina: false },
};

const recorrido = (caps) =>
  Object.entries(POSICION)
    .filter(([n]) => {
      const req = REQUISITO[Number(n)];
      return req === null || caps[req];
    })
    .sort((a, b) => a[1] - b[1])
    .map(([n]) => Number(n));

const resto = recorrido(CAPS.restaurante);
const capt = recorrido(CAPS.captacion);

// ── 1. Los DOS terminan conectando su WhatsApp ───────────────────────────
// Es el bug que motiva este verificador. Conectar el WhatsApp no tiene nada de
// específico de un rubro: es por donde escriben los clientes de cualquiera.
check('el restaurante pasa por conectar WhatsApp', resto.includes(7));
check(
  'el negocio de captación TAMBIÉN pasa por conectar WhatsApp',
  capt.includes(7),
  'sin esto termina el alta sin canal y su bot no atiende a nadie',
);
// EL AVANCE SALE DEL RECORRIDO, no de un `esComida ?` escrito a mano: cada
// bifurcación a mano es una que puede quedar a medias, y una ya quedó — la que
// dejaba a captación sin conectar su WhatsApp.
check(
  'se avanza por el recorrido, no bifurcando por rubro',
  /function pasoSiguiente/.test(sinComentarios) &&
    /setPaso\(pasoSiguiente\(1, caps\)\)/.test(sinComentarios),
  'un setPaso(esComida ? x : y) vuelve a dejar un rubro sin pasos',
);
check(
  'ningún paso se decide preguntando por el rubro',
  !/setPaso\(esComida \?/.test(sinComentarios),
  'es la cacería de ifs que las capacidades vinieron a eliminar',
);

// ── 2. El resumen va último en los dos ───────────────────────────────────
check('el resumen es el último paso', resto.at(-1) === 5 && capt.at(-1) === 5);

// ── 3. Captación NO ve los pasos que no le corresponden ──────────────────
// Mostrarle "carga tu carta" a una inmobiliaria es peor que no preguntarle nada.
for (const [paso, que] of [[2, 'la carta'], [3, 'los platos'], [4, 'la marca'], [6, 'cómo trabajás']]) {
  check(`captación no ve ${que} (paso ${paso})`, !capt.includes(paso));
}

// ── 4. El contador no puede mentir ───────────────────────────────────────
// Se calcula sobre el recorrido REAL: leerlo de POSICION daba "paso 6 de 2" en
// captación, porque esa tabla tiene las posiciones del recorrido largo.
check(
  'la posición se calcula sobre el recorrido, no se lee de la tabla',
  /function posicionEnPantalla/.test(sinComentarios) &&
    /actual=\{posicionEnPantalla\(paso, caps\)\}/.test(sinComentarios),
  'con POSICION[paso] directo, captación mostraba "paso 6 de 2"',
);
check(
  'y el total sale de la misma lista',
  /total=\{rubro === "" \? null : pasosVisibles\(caps\)\.length - 1\}/.test(sinComentarios),
  'un total escrito a mano se desincroniza al mover un paso',
);
check(
  'el último paso antes del resumen es el total exacto',
  resto.indexOf(7) + 1 === resto.length - 1 && capt.indexOf(7) + 1 === capt.length - 1,
  'si no coinciden, la barra dice "paso 3 de 2"',
);

// ── 5. Se puede volver, y sin caer en pantallas ajenas ───────────────────
check(
  'hay navegación hacia atrás',
  /function pasoAnterior/.test(sinComentarios),
);
check(
  'atrás usa el MISMO recorrido que el contador',
  /const visibles = pasosVisibles\(caps\)/.test(sinComentarios),
  'con dos listas distintas, "Atrás" lleva a un paso que la barra dice que no existe',
);

// EL PASO DE LA CONEXIÓN NO PUEDE PEDIR UNA CAPACIDAD. Es por donde le escriben
// los clientes a CUALQUIER negocio; atarlo a un rubro es exactamente el bug que
// dejó a captación sin canal.
check(
  'conectar WhatsApp no depende de ninguna capacidad',
  REQUISITO[7] === null,
  'si pide una, el rubro que no la tenga vuelve a quedarse sin canal',
);

// ── 6. El resumen tampoco puede atarse al rubro ──────────────────────────
// MISMO BUG, UN PASO MAS ADELANTE: el item "WhatsApp conectado" vivia dentro de
// un `esComida ?`, asi que captacion pasaba por el paso de conectar pero su
// resumen no le decia si le faltaba — "¡Todo listo!" sobre un bot mudo.
const resumen = sinComentarios.slice(sinComentarios.indexOf('clave: "negocio"'));
const itemConexion = resumen.slice(0, resumen.indexOf('clave: "whatsappConectado"'));
check(
  'el resumen avisa de la conexion a TODOS los rubros',
  !/\.\.\.\(esComida[\s\S]{0,80}$/.test(itemConexion),
  'dentro de un esComida, captacion termina sin saber que su bot no atiende',
);
check(
  'y lo que SI es de un rubro se pide por capacidad',
  /\.\.\.\(caps\.tieneCocina/.test(sinComentarios) && /\.\.\.\(caps\.tieneCarta/.test(sinComentarios),
  'el horario y la carta son de quien tiene cocina y carta, no de "gastronomia"',
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
