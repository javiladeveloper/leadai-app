import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

// Ejecuta componentes TSX y sus handlers sin red ni DOM. No sustituye la
// comprobación de foco/layout en navegador; permite probar estado y contratos.
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
export function montar(archivo, nombre, api, props = {}, extras = {}) {
  const instancias = new Map();
  const cache = new Map();
  let actual, indice, sucio = true, arbol, propiedades = props;
  const pendientes = [];
  const iguales = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  function slot(inicial) {
    const i = indice++;
    if (!(i in actual.slots)) actual.slots[i] = inicial();
    return [actual.slots, i];
  }
  const react = {
    ...require('react'),
    useState(inicial) {
      const [s, i] = slot(() => typeof inicial === 'function' ? inicial() : inicial);
      return [s[i], (v) => { const n = typeof v === 'function' ? v(s[i]) : v; if (!Object.is(n, s[i])) { s[i] = n; sucio = true; } }];
    },
    useRef: (v) => { const [s, i] = slot(() => ({ current: v })); return s[i]; },
    useId: () => { const [s, i] = slot(() => `id-${actual.id}-${indice}`); return s[i]; },
    useEffect(fn, deps) {
      const [s, i] = slot(() => ({}));
      if (!iguales(s[i].deps, deps)) { s[i].deps = deps; pendientes.push(() => { s[i].limpiar?.(); s[i].limpiar = fn(); }); }
    },
    useMemo(fn, deps) {
      const [s, i] = slot(() => ({}));
      if (!iguales(s[i].deps, deps)) s[i] = { deps, valor: fn() };
      return s[i].valor;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  };
  function cargar(f) {
    if (cache.has(f)) return cache.get(f).exports;
    const mod = { exports: {} }; cache.set(f, mod);
    const code = ts.transpileModule(readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const localRequire = (id) => {
      if (id === 'react') return react;
      if (id === '@/lib/api') return api;
      if (Object.hasOwn(extras, id)) return extras[id];
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, id.slice(2)) : path.resolve(path.dirname(f), id);
        const encontrado = [base, `${base}.ts`, `${base}.tsx`].find((x) => existsSync(x));
        return cargar(encontrado);
      }
      return require(id);
    };
    new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  const C = cargar(path.join(root, archivo))[nombre];
  function resolver(n, ruta = 'root') {
    if (Array.isArray(n)) return n.map((v, i) => resolver(v, `${ruta}.${v?.key ?? i}`));
    if (!n || typeof n !== 'object') return n;
    if (typeof n.type === 'function') {
      const clave = `${ruta}:${n.type.name}:${n.key ?? ''}`;
      let inst = instancias.get(clave);
      if (!inst) { inst = { slots: [], id: instancias.size }; instancias.set(clave, inst); }
      inst.vista = true; actual = inst; indice = 0;
      return resolver(n.type(n.props), `${clave}.child`);
    }
    return { ...n, props: { ...n.props, children: resolver(n.props.children, `${ruta}.children`) } };
  }
  function render() {
    sucio = false;
    for (const inst of instancias.values()) inst.vista = false;
    arbol = resolver({ type: C, props: propiedades });
    for (const [key, inst] of instancias) if (!inst.vista) { for (const s of inst.slots) s?.limpiar?.(); instancias.delete(key); }
    pendientes.splice(0).forEach((fn) => fn());
  }
  async function flush() {
    for (let i = 0; i < 12; i++) { if (sucio) render(); await new Promise((r) => setImmediate(r)); }
    if (sucio) throw new Error('El componente no estabilizó');
  }
  function nodos(n) {
    if (Array.isArray(n)) return n.flatMap((v) => nodos(v));
    if (!n || typeof n !== 'object') return [];
    return [n, ...nodos(n.props.children)];
  }
  return {
    flush, nodos: () => nodos(arbol), texto: () => texto(arbol),
    buscar: (fn) => nodos(arbol).find(fn),
    async props(p) { propiedades = p; sucio = true; await flush(); },
    unmount() { for (const inst of instancias.values()) for (const s of inst.slots) s?.limpiar?.(); },
  };
}
export function texto(n) {
  if (Array.isArray(n)) return n.map(texto).join(' ');
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  return typeof n === 'object' ? texto(n.props.children) : String(n);
}
export const diferido = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
