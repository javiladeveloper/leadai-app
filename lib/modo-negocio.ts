// ¿QUÉ PUEDE ESTE NEGOCIO? (2026-08-19)
//
// Un restaurante, una clínica y un negocio de captación usan LeadAI para cosas
// distintas, y el panel lo tiene que reflejar: al de comida no le sirven
// Anuncios ni Flujos, y a la clínica no le sirve el embudo de leads porque el
// estado real de su paciente es la CITA.
//
// ANTES esto se decidía con `modoPedidos`, un booleano. Alcanzaba para separar
// restaurante de captación, pero con cuatro rubros miente: una clínica tiene
// `modoPedidos: false` y por eso caía en el balde de "captación genérica".
//
// Ahora la fuente es `GET /capacidades`, que devuelve lo que el negocio HACE
// (tieneCarta, tieneEmbudo, calificaLeads…). La tabla que decide vive en el
// backend, en `core/capacidades-rubro.ts`: una sola verdad para la UI y para
// las reglas de negocio. Agregar un rubro es una fila allá, no una cacería de
// `if` acá.

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { leerEmpresaActiva } from "./auth";

/** Lo que el negocio puede hacer. Espejo de `CapacidadesRubro` del backend. */
export interface Capacidades {
  tieneEmbudo: boolean;
  calificaLeads: boolean;
  cierreManualDeVenta: boolean;
  altaManualDeLead: boolean;
  nutreLeads: boolean;
  redactaRespuestas: boolean;
  redactaResumenes: boolean;
  tieneCarta: boolean;
  validaPagos: boolean;
  tieneCocina: boolean;
  tieneReservas: boolean;
  agendaCitas: boolean;
  matriculaSocios: boolean;
  iaInterpretaItems: boolean;
  iaRespondePreguntas: boolean;
  /** Crecimiento (2026-08-22): existen para TODOS los rubros, restaurantes incluidos. */
  tieneAnuncios: boolean;
  tieneCampanias: boolean;
}

/** Cómo se llama al contacto en este rubro. */
export interface Vocabulario {
  contacto: string;
  contactos: string;
  buscar: string;
}

export interface EstadoNegocio {
  objetivo: string;
  capacidades: Capacidades;
  vocabulario: Vocabulario;
  /** Derivado en el backend. Sigue viajando para el código que aún lo usa. */
  modoPedidos: boolean;
  /**
   * ¿Tiene alguna placa NFC activa? (2026-08-27)
   *
   * Va APARTE de `capacidades`: esas son del RUBRO y no cambian solas; esta es
   * un estado del negocio que cambia el día que activa su primera placa.
   *
   * Opcional: un backend viejo no lo manda, y ahí se asume `false` — esconder
   * un ítem de más es mejor que mostrar una pantalla vacía a todos.
   */
  tienePlacas?: boolean;
}

/**
 * Lo que se asume mientras no se sabe nada, y si el backend falla.
 *
 * Es el rubro MÁS COMPLETO (captación genérica) a propósito: dejar a alguien
 * sin sus secciones por un error de red es peor que mostrarle una de más. Lo
 * primero le saca su trabajo, lo segundo solo confunde.
 */
const TODO_ENCENDIDO: EstadoNegocio = {
  objetivo: "captar_y_derivar",
  capacidades: {
    tieneEmbudo: true, calificaLeads: true, cierreManualDeVenta: true,
    altaManualDeLead: true, nutreLeads: true,
    redactaRespuestas: true, redactaResumenes: true,
    tieneCarta: false, validaPagos: false, tieneCocina: false, tieneReservas: false,
    agendaCitas: false, matriculaSocios: false,
    iaInterpretaItems: false, iaRespondePreguntas: true,
    tieneAnuncios: true, tieneCampanias: true,
  },
  vocabulario: { contacto: "lead", contactos: "Leads", buscar: "Buscar leads o mensajes…" },
  modoPedidos: false,
  // Sin saber, NO se muestra Placas: casi ningún negocio tiene, y la pantalla
  // vacía confunde más que la ausencia del ítem.
  tienePlacas: false,
};

/**
 * Cache por tenant: el sidebar se remonta en cada navegación y no puede pedir
 * esto de nuevo cada vez (parpadeo del menú entero).
 *
 * Y se PERSISTE en localStorage (2026-08-19): en memoria se perdía con cada
 * F5, así que al recargar el restaurante veía las trece secciones de captación
 * —Anuncios, Campañas, Flujos, Leads…— y un segundo después el menú se
 * acortaba de golpe. Recordarlo hace que el F5 pinte el menú correcto de una.
 *
 * El valor guardado NO es autoridad: igual se pregunta al backend y se
 * corrige si cambió. Solo evita el parpadeo del primer render.
 */
const CLAVE = "leadai.capacidades";
const cache = new Map<string, EstadoNegocio>();

function leerGuardado(tenant: string): EstadoNegocio | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(`${CLAVE}.${tenant}`);
  if (!v) return null;
  try {
    return JSON.parse(v) as EstadoNegocio;
  } catch {
    // JSON viejo o corrupto: se ignora y se pregunta de nuevo. Nunca romper
    // el panel por algo que solo estaba para evitar un parpadeo.
    return null;
  }
}

function guardar(tenant: string, estado: EstadoNegocio): void {
  cache.set(tenant, estado);
  if (typeof window !== "undefined") {
    localStorage.setItem(`${CLAVE}.${tenant}`, JSON.stringify(estado));
  }
}

/**
 * Precalienta el caché de capacidades (2026-09-04, reporte de Jonathan:
 * "demora mucho en cargar el panel lateral al comienzo").
 *
 * El menú no se dibuja hasta saber qué puede el negocio, y en el PRIMER login
 * de un navegador no hay nada guardado: el Sidebar esperaba su propia llamada
 * (~1s desde Perú) DESPUÉS de montar. Esto dispara la consulta apenas hay
 * sesión —mientras el navegador todavía está redirigiendo al panel— para que
 * al montar el menú la respuesta ya esté en el caché.
 *
 * Fire-and-forget: si falla o llega tarde, el hook hace su consulta de
 * siempre y no cambia nada.
 */
export function precalentarCapacidades(): void {
  const tenant = typeof window !== "undefined" ? leerEmpresaActiva() : null;
  if (!tenant || cache.has(tenant) || leerGuardado(tenant)) return;
  api<EstadoNegocio>("/capacidades")
    .then((r) => guardar(tenant, r))
    .catch(() => undefined);
}

/**
 * Qué puede el negocio activo.
 *
 * Devuelve `null` mientras no se sabe — quien lo use tiene que tratar ese
 * caso, porque asumir un rubro haría parpadear el menú antes de corregirse.
 */
export function useCapacidades(): EstadoNegocio | null {
  const tenant = typeof window !== "undefined" ? leerEmpresaActiva() : null;
  const [estado, setEstado] = useState<EstadoNegocio | null>(
    tenant ? (cache.get(tenant) ?? leerGuardado(tenant)) : null,
  );

  useEffect(() => {
    if (!tenant) { setEstado(null); return; }
    // Se pregunta IGUAL aunque haya valor guardado: el dueño pudo cambiar el
    // modo en Configuración desde otro dispositivo.
    const guardado = cache.get(tenant) ?? leerGuardado(tenant);
    if (guardado) setEstado(guardado);

    let vivo = true;
    api<EstadoNegocio>("/capacidades")
      .then((r) => {
        guardar(tenant, r);
        if (vivo) setEstado(r);
      })
      // Si falla, NO se acorta el menú: se asume el rubro más completo.
      .catch(() => { if (vivo) setEstado(TODO_ENCENDIDO); });

    return () => { vivo = false; };
  }, [tenant]);

  return estado;
}

/**
 * Las capacidades, SIN el `null` intermedio.
 *
 * Mientras no se sabe devuelve el rubro más completo, así una pantalla que
 * pregunta `caps.tieneEmbudo` muestra el bloque desde el primer render en vez
 * de hacerlo aparecer de golpe medio segundo después.
 *
 * POR QUÉ HACE FALTA (2026-08-19): con `useCapacidades()` a secas el patrón
 * natural es `caps?.tieneEmbudo && <Bloque/>`, y `null && X` NO RENDERIZA. O
 * sea que el default silencioso era "ocultar todo", justo al revés de lo que
 * queremos: el formulario arrancaba corto y CRECÍA de golpe al llegar la
 * respuesta. Jonathan lo reportó como "carga una cosa y al ratito otra".
 *
 * Cuándo NO usar este: el MENÚ (`Sidebar`, `NavInferior`). Ahí sí conviene
 * esperar y dibujar placeholders, porque mostrar trece secciones y acortarlas
 * a cuatro es más violento que un menú que tarda un instante en aparecer.
 */
export function useCapacidadesOptimista(): Capacidades {
  return useCapacidades()?.capacidades ?? TODO_ENCENDIDO.capacidades;
}

/**
 * `true` si el negocio activo toma pedidos (restaurante).
 *
 * QUEDA COMO PUENTE: su firma y su semántica de `null` son EXACTAMENTE las de
 * antes, así que las pantallas que todavía no migraron a capacidades siguen
 * funcionando sin tocarse. Lo único que cambió es de dónde sale el dato.
 *
 * Para código nuevo, usar `useCapacidades()` y preguntar por la capacidad
 * concreta: `tieneCarta`, `tieneEmbudo`, etc. Preguntar "¿es restaurante?"
 * para esconder el embudo es justamente lo que dejaba a las clínicas mal.
 */
export function useModoPedidos(): boolean | null {
  const estado = useCapacidades();
  return estado === null ? null : estado.modoPedidos;
}

/** Se llama al cambiar de negocio o al cambiar el modo en Configuración. */
export function olvidarModoPedidos(tenant?: string): void {
  if (tenant) {
    cache.delete(tenant);
    if (typeof window !== "undefined") localStorage.removeItem(`${CLAVE}.${tenant}`);
  }
  else cache.clear();
}
