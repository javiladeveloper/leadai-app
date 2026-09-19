/**
 * REGLAS DE QUÉ SE PUEDE SUBIR EN UN POST (2026-09-19).
 *
 * Nació cuando Jonathan fue a publicar las piezas de Sania y preguntó "¿puedo
 * subir varias imágenes?": el backend ya aceptaba hasta 10 en `mediaUrls`,
 * pero el panel mandaba siempre una sola, así que un carrusel de 5 láminas
 * —la pieza mejor armada que tenía— no se podía publicar desde LeadAI.
 *
 * Vive acá y no dentro del componente para poder probarlo sin navegador: son
 * decisiones de negocio (qué mezcla acepta cada red), no de pintado.
 */

/** Tope de imágenes por carrusel: el del backend, que coincide con el de Instagram. */
export const MAX_MEDIA = 10;

export interface ArchivoElegido {
  nombre: string;
  tipoMime: string;
  pesoMB: number;
}

export type Veredicto = { ok: true } | { ok: false; motivo: string };

export const esVideoMime = (m: string): boolean => m.startsWith('video/');

const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];

/**
 * ¿Este archivo, por sí solo, se puede subir? Tipo y peso se saben en el
 * navegador: un video de 80MB no debe tardar un minuto en subir para nada.
 */
export function revisarArchivo(a: ArchivoElegido): Veredicto {
  if (!TIPOS_OK.includes(a.tipoMime)) {
    return { ok: false, motivo: `"${a.nombre}": formato no permitido. Usa JPG, PNG, WebP, MP4 o MOV.` };
  }
  if (esVideoMime(a.tipoMime) && a.pesoMB > 50) {
    return {
      ok: false,
      motivo: `"${a.nombre}" pesa ${a.pesoMB.toFixed(0)}MB y el máximo es 50MB. Comprímelo antes de subirlo: TikTok e Instagram lo vuelven a comprimir igual, así que exportarlo a 1080p con menos calidad no se nota.`,
    };
  }
  if (!esVideoMime(a.tipoMime) && a.pesoMB > 8) {
    return { ok: false, motivo: `"${a.nombre}" pesa ${a.pesoMB.toFixed(1)}MB y el máximo es 8MB.` };
  }
  return { ok: true };
}

/**
 * ¿Esta tanda se puede AGREGAR a lo que ya hay en el post?
 *
 * UN VIDEO VA SOLO. No es una regla nuestra: Instagram no mezcla video e
 * imágenes en un carrusel por API, y TikTok solo publica video. Dejar armar
 * la mezcla acá sería dejar que el post falle recién al publicar, cuando el
 * dueño ya cree que lo mandó.
 */
export function revisarTanda(
  nuevos: ArchivoElegido[],
  yaHay: { cantidad: number; esVideo: boolean },
): Veredicto {
  if (nuevos.length === 0) return { ok: true };

  const hayVideo = nuevos.some((a) => esVideoMime(a.tipoMime));
  if (hayVideo && (nuevos.length > 1 || yaHay.cantidad > 0)) {
    return { ok: false, motivo: 'Un video va solo en el post: no se puede mezclar con imágenes ni subir dos videos.' };
  }
  if (yaHay.esVideo && yaHay.cantidad > 0) {
    return { ok: false, motivo: 'Ya hay un video en este post. Quítalo si quieres subir imágenes.' };
  }
  if (yaHay.cantidad + nuevos.length > MAX_MEDIA) {
    return { ok: false, motivo: `Un carrusel admite hasta ${MAX_MEDIA} imágenes (llevas ${yaHay.cantidad}).` };
  }
  for (const a of nuevos) {
    const v = revisarArchivo(a);
    if (!v.ok) return v;
  }
  return { ok: true };
}

/**
 * El `tipoMedia` que viaja al backend. "carrusel" SOLO con más de una: con una
 * sola, el tipo real (imagen/video) es el que cada red necesita para
 * publicarla bien.
 */
export function tipoMediaDe(cantidad: number, esVideo: boolean): 'imagen' | 'video' | 'carrusel' {
  if (cantidad > 1) return 'carrusel';
  return esVideo ? 'video' : 'imagen';
}

/** Mueve una lámina: en un carrusel el orden ES el contenido. */
export function moverEn<T>(lista: T[], i: number, delta: number): T[] {
  const j = i + delta;
  if (i < 0 || i >= lista.length || j < 0 || j >= lista.length) return lista;
  const q = [...lista];
  [q[i], q[j]] = [q[j], q[i]];
  return q;
}

/**
 * QUÉ FALTA PARA PODER PUBLICAR (2026-09-19).
 *
 * El botón se apagaba en silencio: Jonathan armó su carrusel, vio "Publicar"
 * gris y tuvo que preguntar qué faltaba ("¿tengo que poner un texto arriba?").
 * Si le pasa a quien conoce el sistema, a un cliente lo deja atascado.
 *
 * Devuelve la lista de lo que falta, en el orden en que se llena la pantalla,
 * para decirlo en vez de dejarlo adivinar. Vacía = se puede publicar.
 */
export function faltaParaPublicar(estado: {
  texto: string;
  cantidadMedia: number;
  redes: string[];
  programar: boolean;
  fecha: string;
}): string[] {
  const falta: string[] = [];
  if (!estado.texto.trim()) falta.push('escribe el texto del post');
  if (estado.redes.length === 0) falta.push('elige al menos una red');
  // Instagram no publica sin imagen ni video; se nombra la red para que se
  // entienda que es requisito de ella y no un capricho nuestro.
  if (estado.redes.includes('instagram') && estado.cantidadMedia === 0) {
    falta.push('agrega una imagen o video (Instagram lo exige)');
  }
  if (estado.redes.includes('tiktok') && estado.cantidadMedia === 0) {
    falta.push('agrega un video (TikTok solo publica videos)');
  }
  if (estado.programar && !estado.fecha) falta.push('pon la fecha y hora');
  return falta;
}

/**
 * EL PROGRESO DE LA SUBIDA (2026-09-19).
 *
 * "Cuando coloco guardar... no sé si está subiendo o si se colgó". Antes el
 * botón decía "Subiendo…" y ese texto no se movía: con 5 imágenes se veía
 * igual el segundo 1 que el 40, así que no había forma de distinguir una
 * subida lenta de una caída.
 *
 * `hechos` son los que YA terminaron; el que está en curso es `hechos + 1`.
 */
export interface ProgresoSubida {
  hechos: number;
  total: number;
}

/** "Subiendo 2 de 5…" — con un solo archivo no se numera, sería ruido. */
export function textoProgreso(p: ProgresoSubida | null): string {
  if (!p || p.total === 0) return 'Subiendo…';
  if (p.total === 1) return 'Subiendo…';
  return `Subiendo ${Math.min(p.hechos + 1, p.total)} de ${p.total}…`;
}

/**
 * Porcentaje para la barra. Arranca en 8% aunque no haya terminado ninguno:
 * una barra en cero se lee como "no pasó nada" justo cuando sí empezó.
 */
export function porcentajeProgreso(p: ProgresoSubida | null): number {
  if (!p || p.total === 0) return 0;
  const crudo = (p.hechos / p.total) * 100;
  return Math.max(8, Math.round(crudo));
}
