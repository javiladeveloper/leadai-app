// CACHÉ DE DATOS EN MEMORIA (2026-10-09, tanda "velocidad").
//
// Cada pantalla pedía todo al montar, y varias pedían LO MISMO al mismo
// tiempo: `/capacidades` salía tres o cuatro veces por carga (menú, barra de
// abajo, la pantalla), `/canales` en cada sección, `/mi-plan` dos veces en
// Conversaciones (etapas de la bandeja y de la ficha). Al volver a una sección
// ya visitada se esperaba de nuevo todo, con esqueletos.
//
// Esto hace dos cosas, nada más:
//  1. DEDUPLICA: si ya hay una petición en vuelo con la misma clave, quien
//     llega después se cuelga de esa promesa en vez de salir otra.
//  2. RECUERDA la última respuesta por clave, para que una pantalla pinte lo
//     que ya sabía al instante y refresque por detrás (stale-while-revalidate,
//     en `useDatos`).
//
// POR QUÉ NO SWR: el checkout comparte `node_modules` con otros agentes y la
// máquina está corta de RAM; sumar una dependencia para ~80 líneas no se
// justifica, y esto sigue el mismo patrón de memoria que ya usaba
// `useCapacidades` (lib/modo-negocio.ts).
//
// Es PURO (sin React): lo prueban los tests de node. El hook vive en
// `lib/useDatos.ts`.

interface Entrada {
  valor?: unknown;
  tiene: boolean;
  /** Cuándo llegó el valor (ms). 0 = invalidado: se sirve, pero se revalida. */
  en: number;
  promesa?: Promise<unknown>;
}

const almacen = new Map<string, Entrada>();
const oyentes = new Map<string, Set<() => void>>();

function avisar(clave: string): void {
  for (const fn of oyentes.get(clave) ?? []) fn();
}

/** Se suscribe a los cambios de una clave. Devuelve la función para soltarse. */
export function escucharClave(clave: string, fn: () => void): () => void {
  let set = oyentes.get(clave);
  if (!set) { set = new Set(); oyentes.set(clave, set); }
  set.add(fn);
  return () => { set!.delete(fn); if (set!.size === 0) oyentes.delete(clave); };
}

/** Lo último que se supo de esta clave, o `undefined`. No dispara nada. */
export function leerCache<T>(clave: string): T | undefined {
  const e = almacen.get(clave);
  return e?.tiene ? (e.valor as T) : undefined;
}

/** ¿Lo guardado es más nuevo que `maxEdadMs`? */
export function cacheFresca(clave: string, maxEdadMs: number): boolean {
  const e = almacen.get(clave);
  return !!e?.tiene && e.en > 0 && Date.now() - e.en < maxEdadMs;
}

/** Guarda un valor a mano (p. ej. tras una escritura que ya devolvió el dato nuevo). */
export function guardarCache<T>(clave: string, valor: T): void {
  const prev = almacen.get(clave);
  almacen.set(clave, { valor, tiene: true, en: Date.now(), promesa: prev?.promesa });
  avisar(clave);
}

/**
 * Pide un dato pasando por la caché.
 *
 *  - Si hay una petición EN VUELO con esa clave, devuelve esa misma promesa.
 *  - Si lo guardado tiene menos de `maxEdadMs`, lo devuelve sin pedir nada.
 *  - Si no, pide, guarda y avisa a quien esté escuchando la clave.
 *
 * Un error NO borra lo guardado: el que ya tenía el dato lo sigue viendo, y
 * el error le llega solo a quien esperaba esta petición.
 */
export function pedir<T>(clave: string, cargador: () => Promise<T>, opciones: { maxEdadMs?: number } = {}): Promise<T> {
  const { maxEdadMs = 0 } = opciones;
  const e = almacen.get(clave);
  if (e?.promesa) return e.promesa as Promise<T>;
  if (e?.tiene && maxEdadMs > 0 && e.en > 0 && Date.now() - e.en < maxEdadMs) {
    return Promise.resolve(e.valor as T);
  }
  const promesa = cargador().then(
    (valor) => {
      almacen.set(clave, { valor, tiene: true, en: Date.now() });
      avisar(clave);
      return valor;
    },
    (error: unknown) => {
      const actual = almacen.get(clave);
      if (actual?.promesa === promesa) {
        if (actual.tiene) almacen.set(clave, { valor: actual.valor, tiene: true, en: actual.en });
        else almacen.delete(clave);
      }
      throw error;
    },
  );
  almacen.set(clave, { valor: e?.valor, tiene: !!e?.tiene, en: e?.en ?? 0, promesa });
  return promesa;
}

/**
 * Marca como viejas las claves que empiezan con `prefijo`: se siguen sirviendo
 * para pintar al instante, pero la próxima lectura vuelve a preguntar. Se
 * llama después de escribir (guardar el plan, conectar un canal…).
 */
export function invalidar(prefijo: string): void {
  for (const [clave, e] of almacen) {
    if (!clave.startsWith(prefijo)) continue;
    almacen.set(clave, { ...e, en: 0 });
    avisar(clave);
  }
}

/** Olvida todo (al cerrar sesión: los datos de una cuenta no pueden verse en otra). */
export function vaciarCache(): void {
  almacen.clear();
}
