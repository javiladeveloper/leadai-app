/**
 * NADIE PREGUNTA POR EL RUBRO, SE PREGUNTA POR LA CAPACIDAD (2026-08-31).
 *
 * La regla que Jonathan pidió desde el diseño: "usemos Strategy para no mezclar
 * nada y tener todas las funcionalidades separadas". El plan lo dice más corto:
 * **agregar el rubro nº5 es una FILA, no una cacería de ifs**.
 *
 * POR QUÉ HACE FALTA UN VERIFICADOR Y NO ALCANZA CON ACORDARSE: un
 * `modoPedidos ? a : b` nuevo compila, pasa los tests y no rompe nada — hasta
 * que alguien agrega una funcionalidad y se olvida de la otra rama. Pasó tres
 * veces en un mismo día:
 *
 *   1. el paso de conectar WhatsApp se agregó solo a restaurantes, y captación
 *      terminaba el alta SIN CANAL (su bot no atendía a nadie)
 *   2. el contador de pasos decía "paso 6 de 2"
 *   3. el resumen no le avisaba a captación que le faltaba conectar
 *
 * Las tres son el mismo bug, y ninguna falló nada.
 *
 * Y PESA MÁS DE LO QUE PARECE: `leadai-app` es el ÚNICO panel web de los tres
 * productos, así que estas pantallas las ven también las clínicas de Sania y
 * los gimnasios de FitCore.
 *
 * El panel no tiene runner de tests: esto se corre con `node`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// El único lugar donde SÍ se puede nombrar el rubro: es quien traduce el rubro
// a capacidades. Si se prohibiera acá, no habría de dónde salieran.
const PERMITIDOS = [
  'lib/modo-negocio.ts',
  // El alta es el otro caso legítimo: el rubro se ELIGE en ese formulario, así
  // que cuando se dibuja el paso 1 el negocio todavía no existe y no hay a
  // quién preguntarle. Tiene su propio verificador (verificar-alta.mjs) que
  // cuida que los pasos se decidan por capacidad igual.
  'app/bienvenida/page.tsx',
];

const PATRONES = [
  { re: /\bmodoPedidos\s*(\?|&&|\|\|)/, que: 'modoPedidos como condición' },
  { re: /!\s*modoPedidos\b/, que: '!modoPedidos' },
  { re: /\besComida\s*(\?|&&|\|\|)/, que: 'esComida como condición' },
  { re: /===\s*["']gastronomia["']/, que: 'comparación con "gastronomia"' },
  { re: /objetivo\s*===\s*["'](vender_pedidos|agendar_citas|matricular_socio)["']/, que: 'comparación con un objetivo' },
];

function archivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) return [];
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

const hallazgos = [];
for (const dir of ['app', 'components', 'lib']) {
  for (const f of archivos(dir)) {
    const rel = f.split(String.fromCharCode(92)).join('/');
    if (PERMITIDOS.some((p) => rel.endsWith(p))) continue;
    // Se mira el CÓDIGO, no los comentarios: explicar por qué algo ya NO se
    // decide por rubro es correcto y no debe fallar.
    const codigo = readFileSync(f, 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    codigo.split('\n').forEach((linea, i) => {
      for (const { re, que } of PATRONES) {
        if (re.test(linea)) hallazgos.push({ archivo: rel, linea: i + 1, que, texto: linea.trim() });
      }
    });
  }
}

if (hallazgos.length === 0) {
  console.log('ok    nadie decide por rubro: todo pasa por capacidades');
  console.log('\nTodo ok.');
  process.exit(0);
}

console.log(`FALLA  ${hallazgos.length} lugar(es) deciden por RUBRO en vez de por capacidad:\n`);
for (const h of hallazgos) {
  console.log(`  ${h.archivo}:${h.linea}  — ${h.que}`);
  console.log(`     ${h.texto.slice(0, 90)}`);
}
console.log(`
Qué hacer: preguntá por la CAPACIDAD que necesitás, no por el rubro.

  antes:   modoPedidos ? <Carta/> : <Leads/>
  después: caps.tieneCarta ? <Carta/> : <Leads/>

Las capacidades salen de useCapacidades() (lib/modo-negocio.ts) y su tabla vive
en el backend, capacidades-rubro.ts. Si la que necesitás no existe, se agrega
ahí — es una fila, y el compilador obliga a completarla para todos los rubros.

Si dos ramas comparten el layout y cambian un texto, es un if. Si cambian la
pantalla entera, son dos componentes y un dispatcher (ver app/(panel)/inicio).`);
process.exit(1);
