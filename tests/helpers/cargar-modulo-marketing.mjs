import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Ejecuta los módulos reales; sólo sustituye los límites externos indicados.
export function cargarModulo(ruta, dobles = {}, globales = {}) {
  const absoluto = path.resolve(ruta);
  const require = createRequire(absoluto);
  const module = { exports: {} };
  const codigo = ts.transpileModule(fs.readFileSync(absoluto, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(codigo, {
    module, exports: module.exports, console, setTimeout, clearTimeout, URL, URLSearchParams,
    process: { env: { NEXT_PUBLIC_API_URL: 'http://api.test' } },
    require: (id) => {
      if (Object.hasOwn(dobles, id)) return dobles[id];
      if (id.startsWith('.') || id.startsWith('@/')) {
        const base = id.startsWith('@/') ? path.resolve(id.slice(2)) : path.resolve(path.dirname(absoluto), id);
        const archivo = ['', '.ts', '.tsx'].map(ext => base + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        return cargarModulo(archivo, dobles, globales);
      }
      return require(id);
    },
    ...globales,
  }, { filename: absoluto });
  return module.exports;
}
