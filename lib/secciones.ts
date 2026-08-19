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
   * Prioridad en la barra inferior de móvil, donde solo entran cuatro. Menor
   * es antes. Las demás viven en el menú "Más", que nunca se filtra por esto.
   */
  rapido?: number;
}

/**
 * ¿Qué secciones ve este negocio?
 *
 * Las que no aplican se OCULTAN, no se muestran con candado: no hay un plan
 * que ofrecer todavía, y un candado que no lleva a ningún lado es peor que la
 * ausencia. Cuando SÍ haya algo que vender, eso es una feature de PLAN, que es
 * el otro eje (`featuresDe` en el backend).
 */
export function seccionesDe(secciones: readonly Seccion[], caps: Capacidades): Seccion[] {
  return secciones.filter((s) => !s.requiere || caps[s.requiere]);
}

/**
 * Los cuatro accesos rápidos de la barra de móvil.
 *
 * Se eligen entre las secciones que este negocio SÍ tiene, por prioridad. Así
 * un restaurante recibe Carta y Ajustes en vez de Pipeline y Leads —que no
 * abre nunca— sin necesidad de una segunda lista hecha a mano.
 */
export function rapidosDe(secciones: readonly Seccion[], caps: Capacidades): Seccion[] {
  return seccionesDe(secciones, caps)
    .filter((s) => s.rapido !== undefined)
    .sort((a, b) => a.rapido! - b.rapido!)
    .slice(0, 4);
}
