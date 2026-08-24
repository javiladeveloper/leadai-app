import type { Capacidades } from "./modo-negocio";

/**
 * LAS SECCIONES DEL PANEL, EN UN SOLO LUGAR (2026-08-19).
 *
 * Antes esta lista estaba copiada en `Sidebar.tsx` (escritorio) y en
 * `NavInferior.tsx` (móvil), y cada copia traía además sus propias listas de
 * "qué ve un restaurante" y "qué NO ve el que no lo es". Cuatro listas para
 * una sola pregunta: agregar una sección obligaba a acordarse de las cuatro.
 *
 * Ahora cada sección declara la capacidad que necesita para existir, y la
 * tabla que decide qué capacidades tiene cada rubro vive en el backend
 * (`core/capacidades-rubro.ts`). Agregar un rubro no toca este archivo.
 */

export interface Seccion {
  href: string;
  label: string;
  /** Nombre corto para la barra de móvil, donde no entra el largo. */
  corto?: string;
  Icono: (props: { className?: string }) => React.ReactElement;
  /**
   * La capacidad sin la cual esta sección no tiene sentido. Sin `requiere`, la
   * sección la ve todo el mundo (Inicio, Reportes, Configuración).
   */
  requiere?: keyof Capacidades;
  /**
   * ALTERNATIVA A `requiere`: basta UNA de estas capacidades (2026-08-24).
   *
   * Marketing junta Anuncios y Campanias en pestanias. Colgarla de una sola
   * capacidad la haria desaparecer entera para un negocio que tenga la otra;
   * con `requiereAlguna`, la seccion existe si al menos una pestania tiene
   * sentido, y adentro cada pestania se muestra segun la suya.
   */
  requiereAlguna?: (keyof Capacidades)[];
  /**
   * Prioridad en la barra inferior de móvil, donde solo entran cuatro. Menor
   * es antes. Las demás viven en el menú "Más", que nunca se filtra por esto.
   */
  rapido?: number;
  /**
   * EL GRUPO BAJO EL QUE SE LISTA (2026-08-24).
   *
   * "Anuncios" y "Campanias" eran dos items sueltos que, sueltos, no se leen
   * como lo mismo: uno trae clientes nuevos y el otro le vuelve a escribir a
   * los que ya vinieron. Juntos bajo Marketing, el dueno encuentra "lo de
   * traer gente" en un solo lugar.
   *
   * Sin `grupo`, la seccion va suelta como siempre.
   */
  grupo?: string;
}

/**
 * Las secciones agrupadas, en el orden en que aparecen.
 *
 * Las sueltas salen como un grupo sin titulo, asi el que dibuja el menu
 * recorre una sola lista en vez de mezclar dos casos.
 */
export function agruparSecciones(
  secciones: readonly Seccion[],
): { titulo?: string; items: Seccion[] }[] {
  const salida: { titulo?: string; items: Seccion[] }[] = [];
  for (const s of secciones) {
    const ultimo = salida[salida.length - 1];
    // Se agrupa solo con el bloque INMEDIATAMENTE anterior: asi el orden de la
    // lista manda, y un grupo partido en dos se ve partido en vez de saltar
    // secciones de lugar por su cuenta.
    if (ultimo && ultimo.titulo === s.grupo) ultimo.items.push(s);
    else salida.push({ titulo: s.grupo, items: [s] });
  }
  return salida;
}

/**
 * ¿Qué secciones ve este negocio?
 *
 * Las que no aplican se OCULTAN, no se muestran con candado: no hay un plan
 * que ofrecer todavía, y un candado que no lleva a ningún lado es peor que la
 * ausencia. Cuando SÍ haya algo que vender, eso es una feature de PLAN, que es
 * el otro eje (`featuresDe` en el backend).
 */
/**
 * LO ÚNICO QUE UN MOZO VE EN EL MENÚ (2026-08-21).
 *
 * Espejo de `RUTAS_DEL_MOZO` en el backend. Están duplicadas a propósito y en
 * ese orden de importancia: el backend es el que MANDA —bloquea con 403 aunque
 * la UI falle—, y esta lista existe solo para no mostrarle al mozo puertas que
 * al abrirlas le dan error.
 *
 * Si las dos se desincronizan, el peor caso es cosmético: una sección que se
 * ve y no abre. Nunca al revés — el backend no depende de esto.
 */
const RUTAS_DEL_MOZO = ["/cocina", "/carta"] as const;

/**
 * Las secciones que este usuario puede ver.
 *
 * Dos filtros encadenados, y el orden importa: primero qué EXISTE en este
 * negocio (capacidades del rubro), después qué puede tocar ESTA persona (su
 * rol). Un mozo de restaurante ve Cocina; uno de un negocio sin cocina, no.
 */
export function seccionesDe(
  secciones: readonly Seccion[],
  caps: Capacidades,
  rol?: string,
): Seccion[] {
  const porCapacidad = secciones.filter((s) => {
    if (s.requiere && !caps[s.requiere]) return false;
    if (s.requiereAlguna && !s.requiereAlguna.some((c) => caps[c])) return false;
    return true;
  });
  if (rol !== "mozo") return porCapacidad;
  return porCapacidad.filter((s) => RUTAS_DEL_MOZO.some((r) => s.href === r));
}

/**
 * Los cuatro accesos rápidos de la barra de móvil.
 *
 * Se eligen entre las secciones que este negocio SÍ tiene, por prioridad. Así
 * un restaurante recibe Carta y Ajustes en vez de Pipeline y Leads —que no
 * abre nunca— sin necesidad de una segunda lista hecha a mano.
 */
export function rapidosDe(
  secciones: readonly Seccion[],
  caps: Capacidades,
  rol?: string,
): Seccion[] {
  return seccionesDe(secciones, caps, rol)
    .filter((s) => s.rapido !== undefined)
    .sort((a, b) => a.rapido! - b.rapido!)
    .slice(0, 4);
}
