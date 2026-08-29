/**
 * LA VUELTA AL CHAT DESPUES DE CONFIRMAR (2026-08-29).
 *
 * Jonathan: "antes me sacaban de la pantalla luego de confirmar mi pedido y
 * me volvian al chat... ahora se quedo pegada en pedido enviado y aparece el
 * boton volver al chat".
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 *
 * QUE SE VERIFICA. La pantalla `PedidoEnChat` tiene tres niveles, y el orden
 * importa porque cada uno tapa la falla del anterior:
 *
 *   1. `window.close()`  -> el caso del cliente real (navegador embebido de
 *                           WhatsApp). Cero toques: ni ve la pantalla.
 *   2. la pantalla       -> si close() fue bloqueado (Chrome normal).
 *   3. el boton          -> un toque, y SIEMPRE funciona: es una navegacion
 *                           con gesto del usuario, que ningun navegador bloquea.
 *
 * Lo que se saco fue un redirect automatico a wa.me que estaba entre el 2 y
 * el 3: los navegadores bloquean navegar sin gesto del usuario, asi que no
 * salvaba a nadie y sumaba 700ms de espera al que ya estaba varado.
 */
import { readFileSync } from 'node:fs';

const ruta = new URL('../app/c/[tenantId]/page.tsx', import.meta.url);
const src = readFileSync(ruta, 'utf8');

// Solo el cuerpo de PedidoEnChat: el archivo entero tiene otras pantallas
// (PedidoListo, el QR de mesa) que tambien hablan de wa.me.
const desde = src.indexOf('function PedidoEnChat');
const hasta = src.indexOf('function PedidoListo');
if (desde === -1 || hasta === -1) {
  console.error('FALLO: no se encontro PedidoEnChat (se renombro?)');
  process.exit(1);
}
const bruto = src.slice(desde, hasta);

/**
 * SIN COMENTARIOS: se verifica el CODIGO, no lo que el codigo dice de si
 * mismo. Los comentarios de esta pantalla nombran `window.close()` y citan la
 * frase vieja para explicar el cambio — buscando sobre el texto crudo, borrar
 * el `window.close()` de verdad pasaba desapercibido porque su mencion seguia
 * ahi al lado. Se quitan los bloques enteros y no las lineas que empiezan con
 * `//`: la cita vive en la segunda linea de un `{/* ... *​/}`, sin marca propia.
 */
const bloque = bruto
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')  // comentarios JSX
  .replace(/\/\*[\s\S]*?\*\//g, '')      // comentarios de bloque
  .replace(/^\s*\/\/.*$/gm, '');         // comentarios de linea

let fallas = 0;
const check = (nombre, ok, detalle) => {
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${nombre}`);
  if (!ok) {
    fallas++;
    if (detalle) console.log(`       ${detalle}`);
  }
};

// 1. EL CAMINO DE CERO TOQUES SIGUE INTACTO. Es el del cliente real, y el
//    unico que no le pide nada: si esto se borra, TODOS ven la pantalla.
check(
  'window.close() sigue siendo el primer intento',
  /window\.close\(\)/.test(bloque),
  'sin esto el cliente que entra desde el chat tambien tendria que tocar',
);

// 2. NO QUEDA NINGUN REDIRECT AUTOMATICO. Es lo que se saco: prometia una
//    vuelta que el navegador bloqueaba.
check(
  'ya no hay location.href automatico a wa.me',
  !/location\.href\s*=/.test(bloque),
  'un redirect sin gesto del usuario lo bloquea el navegador: no salva a nadie',
);

// 3. LA ESPERA ES CORTA. El numero exacto importa poco; lo que no puede pasar
//    es que alguien mire un fondo vacio casi un segundo antes de ver la salida.
const espera = /setSigueAbierta\(true\),\s*(\d+)\)/.exec(bloque);
check(
  'la pantalla aparece rapido si close() fallo',
  espera != null && Number(espera[1]) <= 400,
  espera ? `espera ${espera[1]}ms, se esperaba <= 400` : 'no se encontro el timeout',
);

// 4. EL BOTON SIGUE AHI. Es el ultimo recurso y el unico que no depende de
//    que el navegador coopere.
check(
  'el boton de volver al chat sigue presente',
  /wa\.me\/\$\{whatsapp\}/.test(bloque) && /Volver al chat/.test(bloque),
);

// 5. EL TEXTO NO PROMETE LO QUE YA NO HACE. Decia "te llevamos de vuelta al
//    chat..." mientras el redirect estaba bloqueado: el cliente esperaba algo
//    que no iba a pasar.
check(
  'el texto ya no promete un redirect automatico',
  !/vuelta al chat…|vuelta al chat\.\.\./.test(bloque),
  'esa frase deja al cliente esperando una navegacion que no ocurre',
);

// 6. EL BOTON SOLO SI HAY NUMERO. Un `wa.me/null` abre WhatsApp en la nada.
check(
  'el boton se esconde si el negocio no tiene WhatsApp',
  /\{whatsapp\s*&&/.test(bloque),
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
