// Lista canónica de rubros. Fuente única de verdad para el selector al crear/
// editar un negocio. IMPORTANTE: el `id` es el valor que se guarda (estable) y
// alimenta el RAG y el dataset de entrenamiento por rubro. Usar el id fijo evita
// que "contable"/"contabilidad"/"contador" fragmenten el dataset del mismo rubro.
export interface Rubro {
  id: string;
  label: string;
  emoji: string;
}

/**
 * TODOS los rubros que existen. NO se borra ninguno aunque deje de ofrecerse:
 * los negocios ya creados guardan su id, y sacarlo de acá los dejaría con la
 * etiqueta cruda ("mascotas") en vez de su nombre.
 */
export const RUBROS: Rubro[] = [
  { id: "contable", label: "Contabilidad / Tributario", emoji: "📊" },
  { id: "ventas", label: "Ventas / Comercio / Tienda", emoji: "🛒" },
  { id: "inmobiliaria", label: "Inmobiliaria / Bienes raíces", emoji: "🏠" },
  { id: "construccion", label: "Arquitectura / Construcción", emoji: "🏗️" },
  { id: "salud", label: "Salud / Clínica / Consultorio", emoji: "🩺" },
  { id: "estetica", label: "Estética / Belleza / Spa", emoji: "💅" },
  { id: "gimnasio", label: "Gimnasio / Fitness / Deporte", emoji: "💪" },
  { id: "educacion", label: "Educación / Cursos / Academia", emoji: "🎓" },
  { id: "gastronomia", label: "Gastronomía / Restaurante", emoji: "🍽️" },
  { id: "legal", label: "Legal / Abogados / Notaría", emoji: "⚖️" },
  { id: "tecnologia", label: "Software / Tecnología", emoji: "💻" },
  { id: "marketing", label: "Marketing / Publicidad / Diseño", emoji: "📣" },
  { id: "turismo", label: "Turismo / Viajes / Hotelería", emoji: "✈️" },
  { id: "automotriz", label: "Automotriz / Taller / Repuestos", emoji: "🚗" },
  { id: "eventos", label: "Eventos / Fotografía / Catering", emoji: "🎉" },
  { id: "mascotas", label: "Mascotas / Veterinaria", emoji: "🐾" },
  { id: "seguros", label: "Seguros / Finanzas", emoji: "🛡️" },
  { id: "logistica", label: "Logística / Transporte / Envíos", emoji: "📦" },
  { id: "moda", label: "Moda / Ropa / Textil", emoji: "👗" },
  { id: "hogar", label: "Hogar / Muebles / Decoración", emoji: "🛋️" },
  { id: "otro", label: "Otro", emoji: "💼" },
];

/**
 * LOS QUE SE OFRECEN HOY (2026-08-18).
 *
 * El alcance se cerró a dos: gastronomía —donde el producto está terminado
 * (carta, cocina, extras, combos, pedidos)— y ventas, que es el caso de
 * captación con el que trabaja Guisella.
 *
 * El resto no se borró, se dejó de ofrecer: darle "Carta" a una veterinaria
 * cuando su caso no está pensado es prometer algo a medias, y eso se paga más
 * caro que no ofrecerlo. Se van sumando de a uno, cuando cada caso esté
 * resuelto de verdad (ver lib/catalogo-por-rubro.ts).
 *
 * Quien YA tiene otro rubro lo conserva: `RUBROS` sigue completo y su etiqueta
 * se resuelve igual.
 */
const OFRECIDOS = ['gastronomia', 'ventas'];

export const RUBROS_DISPONIBLES: Rubro[] = RUBROS.filter((r) => OFRECIDOS.includes(r.id));

/**
 * La etiqueta legible de un rubro. Busca en la lista COMPLETA, no en la de
 * ofrecidos: un negocio con rubro viejo tiene que seguir viéndose bien.
 */
export function etiquetaRubro(id: string): string {
  return RUBROS.find((r) => r.id === id)?.label ?? id;
}
