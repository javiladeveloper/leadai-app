/**
 * CHIPS Y AVISOS PARA LOS CAMPOS DE TEXTO LIBRE (2026-08-30).
 *
 * Jonathan: "podríamos crear algunos chips más para ayudar a las personas a
 * ser más claras... no son personas técnicas... mientras menos configuraciones
 * libres queden, trabajará mejor el bot".
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 *
 * LO QUE MÁS SE CUIDA: los FALSOS POSITIVOS del aviso. Un cartel de advertencia
 * sobre una política perfectamente normal ("atendemos con cita previa") le
 * enseña al dueño a ignorar los avisos — y ahí perdemos también el que sí
 * importaba.
 */
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../lib/chips-playbook.ts', import.meta.url), 'utf8');

let fallas = 0;
const check = (nombre, ok, detalle) => {
  console.log(`${ok ? 'ok  ' : 'FALLA'}  ${nombre}`);
  if (!ok) {
    fallas++;
    if (detalle) console.log(`       ${detalle}`);
  }
};

/**
 * Se evalúa el MÓDULO ENTERO, no solo su lista de patrones.
 *
 * La primera versión copiaba el bucle acá, y una mutación de control lo
 * demostró inútil: vaciar el `for` del archivo real no rompía ningún check,
 * porque los checks corrían sobre la copia. Un verificador que no ejecuta el
 * código real no verifica nada.
 *
 * Se le sacan los tipos a mano (el archivo es TS y esto corre con `node`
 * pelado) y se usa la función tal como está escrita.
 */
const moduloJs = src
  .replace(/^export /gm, '')
  .replace(/^\/\*\*[\s\S]*?\*\/$/gm, '')
  .replace(/: \{ patron: RegExp; aviso: string \}\[\]/g, '')
  .replace(/: Record<FormaDeVender, ChipsDeCampo>/g, '')
  .replace(/^type FormaDeVender[^\n]*$/gm, '')
  .replace(/^interface ChipsDeCampo \{[\s\S]*?^\}$/gm, '')
  .replace('function chipsDeCampo(tieneCarta: boolean | null): ChipsDeCampo', 'function chipsDeCampo(tieneCarta)')
  .replace('function avisoDeAccionImposible(texto: string): string | null', 'function avisoDeAccionImposible(texto)')
  + '\nglobalThis.__avisar = avisoDeAccionImposible;';
eval(moduloJs);

const avisar = globalThis.__avisar;

// ── 1. Avisa cuando promete algo que el bot no hace ──────────────────────
const DEBEN_AVISAR = [
  'Que agende una cita conmigo',
  'Que les reserve el cupo',
  'Que llames a cada interesado',
  'Que cobre por adelantado el 50%',
  'que envie un correo con la propuesta',
];
for (const t of DEBEN_AVISAR) {
  check(`avisa: "${t}"`, avisar(t) !== null, 'el dueño lo escribe, no funciona y nunca se entera');
}

// ── 2. NO avisa con textos normales ──────────────────────────────────────
// Es el lado que más importa: un aviso de más entrena a ignorarlos todos.
const NO_DEBEN_AVISAR = [
  'Que dejen su nombre y qué necesitan',
  'Que pidan una cotización',
  'Que hagan su pedido por aquí',
  'Que visiten nuestra oficina',
  'Que cuenten su caso por aquí',
  'Atendemos con cita previa',
  'Mínimo S/20 para delivery',
  'Emitimos factura y boleta',
  'Que miren la carta y elijan',
  'Que me llamen al 999888777',
  'Que reserven su cupo con anticipacion',
];
for (const t of NO_DEBEN_AVISAR) {
  check(`no avisa: "${t}"`, avisar(t) === null, 'un aviso de más enseña a ignorarlos todos');
}

// ── 3. Ningún chip promete una acción imposible ──────────────────────────
// Sería el peor error: sugerirle nosotros lo que después el bot no cumple.
// Es exactamente lo que hacía el placeholder viejo ("Ej: Que agenden una
// llamada").
const chips = [...src.matchAll(/^\s+"([^"]{10,})",$/gm)].map((m) => m[1]);
check(
  'hay chips para los tres campos',
  chips.length >= 20,
  `solo se encontraron ${chips.length}`,
);
const chipMalo = chips.find((c) => avisar(c) !== null);
check(
  'ningún chip sugiere una acción que el bot no puede hacer',
  chipMalo === undefined,
  chipMalo ? `el chip "${chipMalo}" promete algo imposible` : '',
);

// ── 4. El placeholder viejo ya no está ───────────────────────────────────
const editor = readFileSync(new URL('../components/panel/PlaybookEditor.tsx', import.meta.url), 'utf8');
check(
  'el placeholder ya no sugiere "agenden una llamada"',
  !/Que agenden una llamada/.test(editor),
  'lo proponíamos nosotros y después el bot no lo cumplía',
);
check(
  'los tres campos largos reciben chips',
  (editor.match(/chips=\{chips\./g) ?? []).length === 3,
);
check(
  'el campo muestra el aviso mientras escriben',
  /avisoDeAccionImposible\(value\)/.test(editor),
);
check(
  'el aviso NO bloquea: no deshabilita ni borra',
  !/disabled=\{aviso/.test(editor) && !/onChange\(""\)/.test(editor),
  'puede quererlo igual para que el bot tome el dato',
);

console.log(fallas === 0 ? '\nTodo ok.' : `\n${fallas} falla(s).`);
process.exit(fallas === 0 ? 0 : 1);
