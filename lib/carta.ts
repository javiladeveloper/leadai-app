// Cliente de la carta del restaurante (2026-08-17).
//
// El dueño configura acá lo que el cliente ve en /c/[tenantId] y lo que el bot
// lee cuando alguien pide por chat. La app móvil YA NO trae este editor: cargar
// 40 platos con el pulgar es donde el dueño abandona, así que la entrada de
// Ajustes abre esta pantalla en el navegador.
//
// PRECIOS EN CÉNTIMOS ENTEROS, siempre. Un `19.90` en float termina en
// 19.899999 y el cliente ve S/19.89. La conversión vive en `aCentavos`/`aSoles`
// y no se hace a mano en ningún otro lado.

import { api } from "./api";
import { leerSesion, leerEmpresaActiva } from "./auth";

export interface CategoriaCarta {
  id: string;
  nombre: string;
  orden: number;
}

export interface ProductoCarta {
  id: string;
  categoriaId: string | null;
  nombre: string;
  descripcion: string | null;
  precioCentavos: number;
  /** El precio ANTES, para mostrarlo tachado. null = sin descuento. */
  precioAntesCentavos: number | null;
  disponible: boolean;
  orden: number;
  alias: string[];
  fotoUrl: string | null;
  grupos: { grupoId: string; orden: number }[];
}

export interface OpcionCarta {
  id: string;
  nombre: string;
  precioCentavos: number;
  fotoUrl: string | null;
  orden: number;
}

/**
 * Un grupo de extras: "Cremas", "Término de la carne", "Tamaño".
 *
 * `minSelec`/`maxSelec` es lo que separa un obligatorio de un opcional: el
 * término de la carne es min 1 / max 1 (hay que elegir uno y solo uno), las
 * cremas son min 0 / max 3. `maxSelec: null` = sin tope.
 */
export interface GrupoOpciones {
  id: string;
  nombre: string;
  minSelec: number;
  maxSelec: number | null;
  orden: number;
  opciones: OpcionCarta[];
}

export interface ComboCarta {
  id: string;
  nombre: string;
  descripcion: string | null;
  precioCentavos: number;
  disponible: boolean;
  fotoUrl: string | null;
  orden: number;
  productos: { productoId: string; cantidad: number }[];
}

/** En minúscula: es el enum tal cual lo valida el backend. */
export type TipoDescuento = "porcentaje" | "monto";
export type AlcanceDescuento = "todo" | "categoria" | "producto";

/**
 * Un descuento con su ventana de vigencia.
 *
 * `dias` son números 0–6 (domingo = 0, como `Date.getDay()`); vacío = todos los
 * días. Las horas son texto "HH:MM" y pueden cruzar la medianoche — una promo
 * de "22:00" a "02:00" tiene desde > hasta, y el backend la resuelve como
 * "o…o" en vez de "y…y" (ver core/precios-carrito.ts).
 */
export interface DescuentoCarta {
  id: string;
  nombre: string;
  tipo: TipoDescuento;
  valor: number;
  alcance: AlcanceDescuento;
  alcanceId: string | null;
  dias: number[];
  horaDesde: string | null;
  horaHasta: string | null;
  desde: string | null;
  hasta: string | null;
  activo: boolean;
  fotoUrl: string | null;
}

export interface Carta {
  categorias: CategoriaCarta[];
  productos: ProductoCarta[];
  grupos: GrupoOpciones[];
  combos: ComboCarta[];
  descuentos: DescuentoCarta[];
}

/** La carta entera de un saque: son cientos de filas como mucho. */
export async function obtenerCarta(tenant?: string): Promise<Carta | null> {
  try {
    return await api<Carta>("/carta", { tenant });
  } catch {
    return null;
  }
}

// ── Precios ───────────────────────────────────────────────────────────
//
// El dueño escribe "19.90" y la BD guarda 1990. Nunca al revés a mano.

/**
 * "19.90" → 1990. Devuelve null si no es un precio válido.
 *
 * Acepta coma o punto (el teclado peruano da coma) y tolera espacios y el
 * "S/" que el dueño a veces escribe adelante. Redondea porque `19.999` no
 * puede quedar en 1999.9 céntimos.
 */
export function aCentavos(texto: string): number | null {
  const limpio = texto.trim().replace(/^S\/\s*/i, "").replace(",", ".");
  if (!limpio || !/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  return Math.round(parseFloat(limpio) * 100);
}

/** 1990 → "19.90", para mostrar. */
export function aSoles(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** 1990 → "S/19.90". */
export function precioTexto(centavos: number): string {
  return `S/${aSoles(centavos)}`;
}

/**
 * El % de descuento entre dos precios: 1590 → 1290 da 19.
 *
 * Se CALCULA y no se guarda: guardarlo sería tener dos verdades que se
 * desincronizan en cuanto alguien cambia un precio. Devuelve null si no hay
 * descuento real, así quien lo llama no muestra "-0%".
 */
export function porcentajeDescuento(antes: number, ahora: number): number | null {
  if (antes <= ahora || antes <= 0) return null;
  const pct = Math.round(((antes - ahora) / antes) * 100);
  return pct > 0 ? pct : null;
}

// ── Resultado de una escritura ────────────────────────────────────────
//
// El backend devuelve el mensaje real del error ("El porcentaje no puede pasar
// de 100", "Esa sección no existe"). Tragárselo y mostrar "algo salió mal"
// deja al dueño adivinando qué campo corregir, así que viaja hasta la UI.

export interface Resultado<T = void> {
  ok: boolean;
  dato?: T;
  error?: string;
}

async function escribir<T>(
  ruta: string,
  method: string,
  body?: unknown,
  tenant?: string,
  extraer?: (r: unknown) => T,
): Promise<Resultado<T>> {
  try {
    const r = await api<unknown>(ruta, { method, body, tenant });
    return { ok: true, dato: extraer ? extraer(r) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

// ── Categorías ────────────────────────────────────────────────────────

export function crearCategoria(nombre: string, tenant?: string) {
  return escribir<CategoriaCarta>(
    "/carta/categorias", "POST", { nombre }, tenant,
    (r) => (r as { categoria: CategoriaCarta }).categoria,
  );
}

export function renombrarCategoria(id: string, nombre: string, tenant?: string) {
  return escribir(`/carta/categorias/${id}`, "PATCH", { nombre }, tenant);
}

export function eliminarCategoria(id: string, tenant?: string) {
  return escribir(`/carta/categorias/${id}`, "DELETE", undefined, tenant);
}

// ── Productos ─────────────────────────────────────────────────────────

export interface ProductoEntrada {
  nombre: string;
  precioCentavos: number;
  precioAntesCentavos?: number | null;
  descripcion?: string;
  categoriaId?: string | null;
  disponible?: boolean;
  alias?: string[];
  grupoIds?: string[];
}

export function crearProducto(datos: ProductoEntrada, tenant?: string) {
  return escribir<ProductoCarta>(
    "/carta/productos", "POST", datos, tenant,
    (r) => (r as { producto: ProductoCarta }).producto,
  );
}

export function actualizarProducto(id: string, datos: Partial<ProductoEntrada>, tenant?: string) {
  return escribir(`/carta/productos/${id}`, "PATCH", datos, tenant);
}

/**
 * Agotar/reponer un plato. Endpoint aparte del PATCH general a propósito:
 * es la acción más frecuente del día (se acabó el lomo a las 8pm) y así el
 * botón manda un body de un solo campo en vez del producto entero.
 */
export function marcarDisponible(id: string, disponible: boolean, tenant?: string) {
  return escribir(`/carta/productos/${id}/disponible`, "PATCH", { disponible }, tenant);
}

export function eliminarProducto(id: string, tenant?: string) {
  return escribir(`/carta/productos/${id}`, "DELETE", undefined, tenant);
}

// ── Fotos de los platos ───────────────────────────────────────────────
//
// Una carta sin fotos vende menos: el cliente elige con los ojos.

/**
 * Sube la foto de un plato y devuelve su URL pública.
 *
 * Va en base64 y no multipart: es lo mismo desde el navegador que desde la app
 * móvil, y el backend ya tenía este camino armado para la foto de perfil.
 */
/** Lo que puede llevar foto. El backend expone la misma ruta para los cuatro. */
export type ConFoto = "productos" | "opciones" | "combos" | "descuentos";

export function subirFoto(tipo: ConFoto, id: string, imagenBase64: string, tenant?: string) {
  return escribir<string>(
    `/carta/${tipo}/${id}/foto`, "POST", { imagen: imagenBase64 }, tenant,
    (r) => (r as { fotoUrl: string }).fotoUrl,
  );
}

export function quitarFoto(tipo: ConFoto, id: string, tenant?: string) {
  return escribir(`/carta/${tipo}/${id}/foto`, "DELETE", undefined, tenant);
}

// Los nombres viejos, para no tocar los llamados que ya andan.
export const subirFotoProducto = (id: string, img: string, tenant?: string) =>
  subirFoto("productos", id, img, tenant);
export const quitarFotoProducto = (id: string, tenant?: string) =>
  quitarFoto("productos", id, tenant);

/** Lo que el backend acepta. Se valida acá para no gastar la subida. */
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];
const MAX_FOTO = 5 * 1024 * 1024;

/**
 * Lee el archivo elegido y lo deja listo para subir.
 *
 * Devuelve el error en palabras y no un throw: quien llama lo muestra tal cual
 * al lado del botón.
 */
export function leerFoto(archivo: File): Promise<{ ok: true; datos: string } | { ok: false; error: string }> {
  if (!TIPOS_FOTO.includes(archivo.type)) {
    return Promise.resolve({ ok: false, error: "Tiene que ser una foto JPG, PNG o WebP." });
  }
  if (archivo.size > MAX_FOTO) {
    return Promise.resolve({ ok: false, error: "La foto es muy pesada (máximo 5MB)." });
  }
  return new Promise((resolver) => {
    const lector = new FileReader();
    lector.onload = () => resolver({ ok: true, datos: String(lector.result) });
    lector.onerror = () => resolver({ ok: false, error: "No pudimos leer esa foto." });
    lector.readAsDataURL(archivo);
  });
}

// ── Grupos de extras ──────────────────────────────────────────────────

export interface GrupoEntrada {
  nombre: string;
  minSelec?: number;
  maxSelec?: number | null;
  opciones?: { nombre: string; precioCentavos: number }[];
}

export function crearGrupo(datos: GrupoEntrada, tenant?: string) {
  return escribir<GrupoOpciones>(
    "/carta/grupos", "POST", datos, tenant,
    (r) => (r as { grupo: GrupoOpciones }).grupo,
  );
}

export function actualizarGrupo(id: string, datos: Partial<GrupoEntrada>, tenant?: string) {
  return escribir(`/carta/grupos/${id}`, "PATCH", datos, tenant);
}

export function eliminarGrupo(id: string, tenant?: string) {
  return escribir(`/carta/grupos/${id}`, "DELETE", undefined, tenant);
}

// ── Combos ────────────────────────────────────────────────────────────

export interface ComboEntrada {
  nombre: string;
  precioCentavos: number;
  descripcion?: string;
  productos: { productoId: string; cantidad?: number }[];
}

export function crearCombo(datos: ComboEntrada, tenant?: string) {
  return escribir<ComboCarta>(
    "/carta/combos", "POST", datos, tenant,
    (r) => (r as { combo: ComboCarta }).combo,
  );
}

export function actualizarCombo(id: string, datos: Partial<ComboEntrada>, tenant?: string) {
  return escribir(`/carta/combos/${id}`, "PATCH", datos, tenant);
}

export function eliminarCombo(id: string, tenant?: string) {
  return escribir(`/carta/combos/${id}`, "DELETE", undefined, tenant);
}

// ── Descuentos ────────────────────────────────────────────────────────

export interface DescuentoEntrada {
  nombre: string;
  tipo: TipoDescuento;
  /** Entero: el porcentaje va 1–100, el monto va en céntimos. */
  valor: number;
  alcance?: AlcanceDescuento;
  alcanceId?: string | null;
  dias?: number[];
  horaDesde?: string | null;
  horaHasta?: string | null;
  desde?: string | null;
  hasta?: string | null;
  activo?: boolean;
}

export function crearDescuento(datos: DescuentoEntrada, tenant?: string) {
  return escribir<DescuentoCarta>(
    "/carta/descuentos", "POST", datos, tenant,
    (r) => (r as { descuento: DescuentoCarta }).descuento,
  );
}

export function actualizarDescuento(id: string, datos: Partial<DescuentoEntrada>, tenant?: string) {
  return escribir(`/carta/descuentos/${id}`, "PATCH", datos, tenant);
}

export function eliminarDescuento(id: string, tenant?: string) {
  return escribir(`/carta/descuentos/${id}`, "DELETE", undefined, tenant);
}

/** Los días como los escribe la gente, para armar el resumen de un descuento. */
export const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/**
 * "10% · Mar y Jue · 18:00–22:00" — la línea que resume un descuento.
 *
 * Sin esto el dueño ve "10%" cuatro veces en la lista y no distingue cuál es
 * cuál.
 */
export function resumenDescuento(d: DescuentoCarta): string {
  const partes: string[] = [d.tipo === "porcentaje" ? `${d.valor}%` : precioTexto(d.valor)];

  if (d.dias.length > 0 && d.dias.length < 7) {
    partes.push(d.dias.map((n) => DIAS[n]).join(" y "));
  }
  if (d.horaDesde && d.horaHasta) partes.push(`${d.horaDesde}–${d.horaHasta}`);
  return partes.join(" · ");
}

// ── La marca del negocio en su carta ──────────────────────────────────
//
// Sin logo ni banner el link parece un formulario, no un restaurante.

export interface NegocioCarta {
  nombre: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  direccion: string | null;
  instagramUrl: string | null;
  entregaMinutos: number | null;
  /** A dónde llega el pedido de la carta. Solo dígitos con código de país. */
  whatsappCarta: string | null;
  /** Cómo se pinta la carta pública: 'claro' | 'oscuro'. */
  temaCarta?: string | null;
  /** Color de acento en hex (#RRGGBB). null = el menta de LeadAI. */
  colorCarta?: string | null;
  /** Las otras redes del negocio. Todas opcionales. */
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  webUrl?: string | null;
}

export async function obtenerNegocio(tenant?: string): Promise<NegocioCarta | null> {
  try {
    const r = await api<{ negocio: NegocioCarta | null }>("/carta/negocio", { tenant });
    return r.negocio;
  } catch {
    return null;
  }
}

export function guardarNegocio(
  datos: Partial<Pick<NegocioCarta,
    "direccion" | "instagramUrl" | "entregaMinutos" | "whatsappCarta" | "temaCarta" | "colorCarta"
    | "facebookUrl" | "tiktokUrl" | "webUrl">>,
  tenant?: string,
) {
  return escribir("/carta/negocio", "PATCH", datos, tenant);
}

/** El logo y el banner van por su propia ruta: son del negocio, no de un id. */
export function subirImagenNegocio(cual: "logo" | "banner", imagenBase64: string, tenant?: string) {
  return escribir<string>(
    `/carta/negocio/${cual}`, "POST", { imagen: imagenBase64 }, tenant,
    (r) => (r as { url: string }).url,
  );
}

export function quitarImagenNegocio(cual: "logo" | "banner", tenant?: string) {
  return escribir(`/carta/negocio/${cual}`, "DELETE", undefined, tenant);
}

// ── Importar la carta ─────────────────────────────────────────────────
//
// Muchos restaurantes ya tienen su carta en una foto, un PDF o un Excel.
// Retipearla plato por plato es donde abandonan.

/** Un plato leído de un archivo, antes de que el dueño lo confirme. */
export interface ItemImportado {
  nombre: string;
  precioCentavos: number;
  precioAntesCentavos?: number;
  descripcion?: string;
  seccion?: string;
}

export interface LecturaExcel {
  items: ItemImportado[];
  /** Filas que no se pudieron leer. El dueño las corrige a mano. */
  errores: { fila: number; motivo: string }[];
}

/** Lee un Excel y devuelve los platos SIN guardarlos: primero se revisan. */
export function leerExcel(archivoBase64: string, tenant?: string) {
  return escribir<LecturaExcel>(
    "/carta/leer-excel", "POST", { archivo: archivoBase64 }, tenant,
    (r) => r as LecturaExcel,
  );
}

/**
 * Lee una foto o un PDF con IA. Mismo formato de vuelta que el Excel para que
 * la pantalla de revisión sea una sola.
 */
export async function leerFotoOPdf(
  archivo: { imagenBase64?: string; imagenMime?: string; pdfBase64?: string },
  tenant?: string,
): Promise<Resultado<LecturaExcel>> {
  const r = await escribir<{ items: { nombre: string; precio?: string; descripcion?: string; categoria?: string }[] }>(
    "/perfil/carta-importar", "POST", archivo, tenant,
    (x) => x as { items: { nombre: string; precio?: string; descripcion?: string; categoria?: string }[] },
  );
  if (!r.ok || !r.dato) return { ok: false, error: r.error };

  // El endpoint viejo devuelve el precio como TEXTO libre ("S/ 12.90"): viene
  // de lo que la IA leyó en la imagen. Se normaliza acá para que la pantalla
  // de revisión trate igual las tres fuentes.
  const items: ItemImportado[] = [];
  const errores: { fila: number; motivo: string }[] = [];
  r.dato.items.forEach((i, n) => {
    const centavos = i.precio ? aCentavos(i.precio) : null;
    if (centavos == null) {
      errores.push({ fila: n + 1, motivo: `No se entendió el precio de "${i.nombre}"` });
      return;
    }
    items.push({
      nombre: i.nombre,
      precioCentavos: centavos,
      ...(i.descripcion ? { descripcion: i.descripcion } : {}),
      ...(i.categoria ? { seccion: i.categoria } : {}),
    });
  });
  return { ok: true, dato: { items, errores } };
}

/** Guarda los platos revisados. `reemplazar` borra la carta anterior. */
export function importarCarta(
  items: ItemImportado[],
  modo: "agregar" | "reemplazar" = "agregar",
  tenant?: string,
) {
  return escribir<{ creados: number; salteados: number; secciones: number }>(
    "/carta/importar", "POST", { items, modo }, tenant,
    (r) => r as { creados: number; salteados: number; secciones: number },
  );
}

/**
 * Baja la plantilla de Excel y la guarda.
 *
 * Con `fetch` y no un `<a href>`: la ruta pide autenticación, así que un link
 * directo devolvería 401 y el dueño se quedaría mirando una pantalla de error
 * sin entender por qué.
 */
export async function descargarPlantilla(tenant?: string): Promise<boolean> {
  const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const sesion = leerSesion();
  const empresa = tenant ?? leerEmpresaActiva();
  try {
    const res = await fetch(`${API}/carta/plantilla`, {
      headers: {
        ...(sesion?.token ? { Authorization: `Bearer ${sesion.token}` } : {}),
        ...(empresa ? { "X-Tenant-Id": empresa } : {}),
      },
    });
    if (!res.ok) return false;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carta-leadai.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
