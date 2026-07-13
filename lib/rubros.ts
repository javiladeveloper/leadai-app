// Lista canónica de rubros. Fuente única de verdad para el selector al crear/
// editar un negocio. IMPORTANTE: el `id` es el valor que se guarda (estable) y
// alimenta el RAG y el dataset de entrenamiento por rubro. Usar el id fijo evita
// que "contable"/"contabilidad"/"contador" fragmenten el dataset del mismo rubro.
export interface Rubro {
  id: string;
  label: string;
  emoji: string;
}

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

// Devuelve la etiqueta legible de un rubro por su id (fallback: el id crudo).
export function etiquetaRubro(id: string): string {
  return RUBROS.find((r) => r.id === id)?.label ?? id;
}
