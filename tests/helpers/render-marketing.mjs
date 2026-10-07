import React from 'react';

// Renderer de componentes para node:test sin DOM: ejecuta el TSX real y sus
// efectos. Los eventos se disparan por las props del elemento renderizado.
export function renderer() {
  const instancias = new Map();
  let actual, cursor, raiz, props, arbol, sucio = true;
  let efectos = [];
  const igual = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const hooks = {
    ...React,
    useState(inicial) {
      const i = cursor++, slots = actual.slots;
      if (!(i in slots)) slots[i] = typeof inicial === 'function' ? inicial() : inicial;
      return [slots[i], valor => {
        const nuevo = typeof valor === 'function' ? valor(slots[i]) : valor;
        if (!Object.is(nuevo, slots[i])) { slots[i] = nuevo; sucio = true; }
      }];
    },
    useRef(inicial) {
      const i = cursor++;
      return actual.slots[i] ??= { current: inicial };
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!igual(actual.slots[i]?.deps, deps)) actual.slots[i] = { deps, valor: fn() };
      return actual.slots[i].valor;
    },
    useEffect(fn, deps) {
      const i = cursor++, instancia = actual;
      if (!igual(instancia.slots[i]?.deps, deps)) efectos.push(() => {
        instancia.slots[i]?.limpiar?.();
        instancia.slots[i] = { deps, limpiar: fn() };
      });
    },
    useId() { const i = cursor++; return `campo-${actual.ruta}-${i}`; },
    // En el cliente devuelve el valor actual de la fuente (rol, sesión...).
    useSyncExternalStore(_suscribir, leer) { return leer(); },
  };
  function visitar(nodo, ruta, vivos) {
    if (nodo == null || typeof nodo === 'boolean') return null;
    if (Array.isArray(nodo)) return nodo.map((n, i) => visitar(n, `${ruta}.${n?.key ?? i}`, vivos));
    if (typeof nodo !== 'object') return nodo;
    if (typeof nodo.type === 'function') {
      const id = `${ruta}/${nodo.type.name}:${nodo.key ?? ''}`;
      const instancia = instancias.get(id) ?? { slots: [], ruta: id };
      instancias.set(id, instancia); vivos.add(id);
      actual = instancia; cursor = 0;
      return visitar(nodo.type(nodo.props), id, vivos);
    }
    return { ...nodo, props: { ...nodo.props, children: visitar(nodo.props.children, `${ruta}.h`, vivos) } };
  }
  function pintar() {
    const vivos = new Set();
    sucio = false; efectos = [];
    arbol = visitar(React.createElement(raiz, props), 'raiz', vivos);
    for (const [id, instancia] of instancias) if (!vivos.has(id)) {
      instancia.slots.forEach(s => s?.limpiar?.()); instancias.delete(id);
    }
    efectos.forEach(e => e());
  }
  return {
    hooks,
    montar(componente, nuevasProps = {}) { raiz = componente; props = nuevasProps; pintar(); },
    actualizar(nuevasProps) { props = nuevasProps; pintar(); },
    desmontar() { instancias.forEach(i => i.slots.forEach(s => s?.limpiar?.())); instancias.clear(); },
    async flush() {
      for (let i = 0; i < 30; i++) { await Promise.resolve(); if (sucio) pintar(); }
    },
    nodos(predicado) {
      const encontrados = [];
      function recorrer(n) {
        if (Array.isArray(n)) return n.forEach(recorrer);
        if (!n || typeof n !== 'object') return;
        if (predicado(n)) encontrados.push(n);
        recorrer(n.props?.children);
      }
      recorrer(arbol); return encontrados;
    },
    get arbol() { return arbol; },
  };
}

export function texto(n) {
  if (n == null || typeof n === 'boolean') return '';
  if (Array.isArray(n)) return n.map(texto).join(' ');
  return typeof n === 'object' ? texto(n.props?.children) : String(n);
}
export function diferida() {
  let resolve, reject;
  const promise = new Promise((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
