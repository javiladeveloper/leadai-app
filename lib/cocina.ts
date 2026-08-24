// LA COCINA EN LA WEB (2026-08-19).
//
// Hasta hoy la cocina —ver los pedidos y despacharlos— SOLO existía en la app
// móvil. Un dueño con la computadora en el mostrador tenía que agarrar el
// celular para marcar un pedido como listo, con las manos ocupadas.
//
// La máquina de estados es la MISMA del backend y de la app. No se reinventa
// acá: si los dos clientes discreparan, uno de los dos mandaría un estado que
// el backend rechaza y el dueño vería un error sin entender por qué.

import { api } from "./api";

/**
 * Lo que quedó registrado de la captura de pago (2026-08-21).
 *
 * `capturaUrl` puede venir null: si Storage estaba caído cuando llegó la
 * imagen, igual se guardó lo que el modelo leyó y qué se decidió — perder el
 * registro entero por no poder guardar una foto sería peor.
 *
 * Todo opcional: un backend viejo no manda `validaciones` y la Cocina tiene
 * que seguir andando igual.
 */
export interface ValidacionPago {
  id: string;
  capturaUrl: string | null;
  montoCentavos: number | null;
  nroOperacion: string | null;
  metodo: string | null;
  /** validado | rechazado | ilegible */
  resultado: string;
  /** monto | receptor | fecha | sin_operacion | metodo */
  motivo: string | null;
  /** 'ia' o 'humano' */
  decidioPor: string;
  revisadoPor: string | null;
  revisadoEn: string | null;
  revisionOk: boolean | null;
  creadoEn: string;
}

export interface PedidoCocina {
  id: string;
  estado: string;
  modalidad: string;
  totalCentavos: number;
  creadoEn: string;
  direccion: string | null;
  /** "Casa del fondo", "portón verde": lo que el pin no dice (2026-08-20). */
  referencia?: string | null;
  notas: string | null;
  items: { nombre: string; cantidad: number; precioCentavos?: number; subtotalCentavos?: number }[] | null;
  etaMinutos: number | null;
  /** En qué mesa se sirve. Null = mostrador, delivery o recojo (2026-08-21). */
  mesa?: string | null;
  /** Quién lo anotó, cuando lo tomó una persona en el local. */
  tomadoPor?: string | null;
  /** La última validación de pago. El backend manda solo una. */
  validaciones?: ValidacionPago[];
  /** pendiente | por_confirmar | validado | rechazado */
  pago?: string | null;
  pagoMetodo?: string | null;
}

/** La validación que decidió el estado actual del pedido, si hay alguna. */
export function validacionDe(p: PedidoCocina): ValidacionPago | null {
  return p.validaciones?.[0] ?? null;
}

/**
 * Cómo se lee un motivo de rechazo, en palabras del dueño.
 *
 * Los códigos del backend son para el log; acá tiene que decir qué mirar en
 * la captura. "receptor" no le dice nada a nadie a las ocho de la noche.
 */
export function motivoLegible(motivo: string | null): string {
  switch (motivo) {
    case 'monto': return 'El monto no coincide con el pedido';
    case 'receptor': return 'El número o el nombre no son los tuyos';
    case 'fecha': return 'La fecha no es de hoy';
    case 'sin_operacion': return 'No se ve el número de operación';
    case 'metodo': return 'Pagó por una billetera que no aceptás';
    default: return 'No se pudo validar';
  }
}

/**
 * Las columnas de la cocina, en el orden en que avanza un pedido.
 *
 * `pagado` va primero: es lo que ENTRÓ y nadie tocó todavía, y es donde el
 * dueño mira cuando suena el teléfono.
 */
export const COLUMNAS = [
  // `vacia`: qué dice la columna cuando no tiene nada. Cuatro "Nada acá"
  // iguales no informan; cada columna vacía significa una cosa distinta.
  { estado: "pagado", titulo: "Por preparar", emoji: "🧾", vacia: "Sin pedidos nuevos" },
  { estado: "preparando", titulo: "En cocina", emoji: "🍳", vacia: "Nada en el fuego" },
  { estado: "listo", titulo: "Listos", emoji: "🛎️", vacia: "Nada esperando salir" },
  { estado: "en_camino", titulo: "En camino", emoji: "🛵", vacia: "Sin entregas en curso" },
] as const;

/**
 * A qué estado pasa este pedido, y qué dice el botón.
 *
 * Espejo de `EstadoPedido.kt` en la app. `listo` bifurca por modalidad: un
 * delivery sale con el motorizado, uno de recojo lo retira el cliente — y
 * mandarle "Ya salió 🛵" a quien viene a buscar su comida no tiene sentido.
 */
export function siguientePaso(p: PedidoCocina): { estado: string; etiqueta: string } | null {
  switch (p.estado) {
    case "pagado":
      return { estado: "preparando", etiqueta: "Empezar a preparar" };
    case "preparando":
      return { estado: "listo", etiqueta: "Marcar listo" };
    case "listo":
      // UNA MESA NO SALE A NINGÚN LADO (2026-08-21). Un pedido de local va de
      // "Listo" directo a servido, igual que uno de recojo: nunca pasa por
      // "En camino". Por eso la columna existe para todos pero solo los
      // delivery caen en ella.
      if (p.modalidad === "local") return { estado: "entregado", etiqueta: "Servido ✓" };
      return p.modalidad === "delivery"
        ? { estado: "en_camino", etiqueta: "Ya salió 🛵" }
        : { estado: "entregado", etiqueta: "Entregado ✓" };
    case "en_camino":
      return { estado: "entregado", etiqueta: "Entregado ✓" };
    default:
      return null;
  }
}

/**
 * ¿Se puede soltar este pedido en esta columna? (2026-08-21)
 *
 * `siguientePaso` responde "a dónde va si toco el botón". Arrastrar pregunta
 * al revés: "¿puede ir ACÁ?". Es la misma máquina de estados, pero un pedido
 * solo avanza de a un paso: soltar `pagado` en "En camino" saltearía la
 * cocina, y el backend lo rechazaría con un error que el dueño no entendería.
 *
 * Devuelve false para la columna donde YA está: no es un error, simplemente
 * no hay nada que mover.
 */
export function puedeSoltarseEn(p: PedidoCocina, estadoColumna: string): boolean {
  const paso = siguientePaso(p);
  return paso?.estado === estadoColumna;
}

/** Cuántos minutos lleva esperando. Es el dato que decide a qué se atiende. */
export function minutosDesde(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

/**
 * ¿Este pedido lleva demasiado tiempo?
 *
 * 25 minutos sin salir de la cocina. No es el ETA prometido: es el punto donde
 * un pedido dejó de ser "en curso" y pasó a ser "se nos está pasando".
 */
export function esUrgente(p: PedidoCocina): boolean {
  return p.estado !== "en_camino" && minutosDesde(p.creadoEn) >= 25;
}

/** Recién entrado: la tarjeta destella una vez para que no pase de largo. */
export const MINUTOS_RECIEN_LLEGADO = 3;

export function esRecienLlegado(p: PedidoCocina): boolean {
  return p.estado === "pagado" && minutosDesde(p.creadoEn) <= MINUTOS_RECIEN_LLEGADO;
}

/**
 * EL SEMÁFORO DE ESPERA (2026-08-21).
 *
 * Antes solo había dos estados: normal, y urgente a los 25 minutos. El salto
 * era de golpe — un pedido de 24 minutos se veía igual que uno de 2, y al
 * minuto siguiente gritaba. Con un escalón intermedio el dueño ve venir el
 * problema antes de tenerlo encima.
 *
 * `en_camino` nunca marca: ya salió, los minutos ahí son del motorizado y no
 * hay nada que la cocina pueda hacer.
 */
export type NivelEspera = "fresco" | "atencion" | "urgente";

export function nivelEspera(p: PedidoCocina): NivelEspera {
  if (p.estado === "en_camino") return "fresco";
  const m = minutosDesde(p.creadoEn);
  if (m >= 25) return "urgente";
  if (m >= 15) return "atencion";
  return "fresco";
}

/**
 * Los minutos, escritos como los diría una persona.
 *
 * A los 707 minutos (un pedido real que quedó colgado 11 horas) "707′" no se
 * lee: hay que dividir mentalmente. Pasada la hora se muestra "11 h 47".
 */
export function esperaLegible(minutos: number): string {
  if (minutos < 60) return `${minutos}′`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  // Los minutos con cero adelante: "12 h 2" se lee ambiguo, "12 h 02" no.
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

export async function listarPedidos(): Promise<PedidoCocina[]> {
  try {
    const r = await api<{ items: PedidoCocina[] }>("/pedidos");
    return r.items ?? [];
  } catch {
    // Una cocina que se queda en blanco por un error de red es peor que una
    // que muestra lo último que sabía: quien llama lo hace en un intervalo.
    return [];
  }
}

/**
 * Edita los ITEMS de un pedido — incluso ya pagado (2026-08-21). El backend
 * resuelve la plata: si el total sube, el bot le pide la diferencia al
 * cliente por WhatsApp; si baja, avisa el vuelto. `aviso` dice cuál fue.
 */
export async function editarItemsPedido(
  id: string,
  items: { nombre: string; cantidad: number; precioCentavos: number; nota?: string }[],
): Promise<{ ok: boolean; error?: string; aviso?: string; diferenciaCentavos?: number }> {
  try {
    const r = await api<{ ok: true; aviso: string; diferenciaCentavos: number }>(
      `/pedidos/${id}/items`,
      { method: "PATCH", body: { items } },
    );
    return { ok: true, aviso: r.aviso, diferenciaCentavos: r.diferenciaCentavos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo editar el pedido" };
  }
}

export async function avanzarPedido(id: string, estado: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/pedidos/${id}/estado`, { method: "PATCH", body: { estado } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo actualizar" };
  }
}

/**
 * UN PEDIDO TOMADO EN EL LOCAL (2026-08-21).
 *
 * En WhatsApp el cliente escribe y el bot anota. Acá la relación está
 * invertida: el cliente dicta y alguien anota — en el mostrador o en la mesa.
 *
 * Se mandan ids y cantidades, nunca precios: cuánto cuesta cada cosa lo decide
 * el servidor contra la carta. Un ítem libre (algo que no está en la carta) sí
 * lleva su precio, porque no hay contra qué compararlo.
 */
export interface ItemNuevoPedido {
  productoId?: string;
  /** Un combo se cobra a SU precio, no por la suma de sus platos. */
  comboId?: string;
  nombre?: string;
  precioCentavos?: number;
  cantidad: number;
  nota?: string;
  /**
   * Las opciones elegidas (2026-08-24): sabores, término, toppings. Solo los
   * IDS — el precio y las que van sin cargo los calcula el servidor.
   */
  opcionIds?: string[];
}

export interface SalaConfigurada {
  sala: string;
  mesas: string[];
}

export async function crearPedidoLocal(datos: {
  modalidad: "local" | "recojo";
  items: ItemNuevoPedido[];
  mesa?: string | null;
  tomadoPor?: string | null;
  cliente?: string | null;
  notas?: string | null;
}): Promise<{ ok: boolean; pedidoId?: string; error?: string }> {
  try {
    const r = await api<{ pedidoId: string }>("/pedidos/local", { method: "POST", body: datos });
    return { ok: true, pedidoId: r.pedidoId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo crear el pedido" };
  }
}

/**
 * EL TOTAL REAL, CON PROMOS (2026-08-22).
 *
 * La pantalla sumaba los precios a mano, así que un "3x2" activo no se veía:
 * tres rolls de S/27 mostraban S/81 aunque el servidor iba a cobrar S/54.
 * Ahora el número sale del MISMO motor que cobra.
 */
export async function cotizarPedidoLocal(datos: {
  modalidad: "local" | "recojo";
  items: ItemNuevoPedido[];
}): Promise<{ totalCentavos: number } | null> {
  try {
    return await api<{ totalCentavos: number }>("/pedidos/local/cotizar", {
      method: "POST", body: datos,
    });
  } catch {
    // Sin cotización se cae al total local: es aproximado (no aplica promos)
    // pero es mejor que un cero o un guion mientras el mozo arma el pedido.
    return null;
  }
}

/** Las salas y mesas que el dueño configuró. Vacío = solo mostrador. */
export async function obtenerSalas(): Promise<SalaConfigurada[]> {
  try {
    const r = await api<{ config: { salas?: SalaConfigurada[] } | null }>("/pedidos-config");
    return r.config?.salas ?? [];
  } catch {
    // Sin mesas se puede tomar igual: es un pedido de mostrador.
    return [];
  }
}

/**
 * LAS PROMOS QUE CORREN AHORA (2026-08-22).
 *
 * Espejo de `detalleDePromo`/`promosVigentes` del backend (core/promos-visibles).
 * Está duplicado porque `GET /carta` devuelve los descuentos CRUDOS —es la
 * pantalla de edición, que necesita todos los campos—, mientras la carta
 * pública recibe las promos ya traducidas.
 *
 * Si las frases divergieran, el mozo leería una cosa y el cliente otra sobre
 * la MISMA promo. Al tocar una, tocar las dos.
 */
export interface PromoVisibleCarta {
  id: string;
  nombre: string;
  detalle: string;
}

/** ¿Esta promo corre en este momento? Días y franja horaria, hora de Lima. */
function promoCorreAhora(d: DescuentoCartaMin, ahora: Date): boolean {
  if (!d.activo) return false;
  // Hora de LIMA calculada a mano (UTC-5): `getHours()` daría la del navegador,
  // y un dueño mirando desde otra zona vería promos que no corren.
  const lima = new Date(ahora.getTime() - 5 * 3600_000);
  const dia = lima.getUTCDay();
  if (d.dias?.length && !d.dias.includes(dia)) return false;
  if (d.desde && lima.toISOString().slice(0, 10) < d.desde.slice(0, 10)) return false;
  if (d.hasta && lima.toISOString().slice(0, 10) > d.hasta.slice(0, 10)) return false;
  if (d.horaDesde || d.horaHasta) {
    const hhmm = lima.toISOString().slice(11, 16);
    if (d.horaDesde && hhmm < d.horaDesde) return false;
    if (d.horaHasta && hhmm > d.horaHasta) return false;
  }
  return true;
}

interface DescuentoCartaMin {
  id: string; nombre: string; tipo: string; valor: number;
  dias?: number[]; horaDesde?: string | null; horaHasta?: string | null;
  desde?: string | null; hasta?: string | null; activo: boolean;
  minUnidades?: number; unidadesEnPromo?: number;
}

/** La regla en una línea, dicha como la diría un mozo. */
export function detalleDePromo(d: DescuentoCartaMin): string {
  const min = d.minUnidades ?? 0;
  const enPromo = d.unidadesEnPromo ?? 1;
  const porcentaje = d.tipo === "porcentaje";
  if (min >= 2) {
    if (porcentaje && d.valor === 100) return `Llevando ${min} pagas ${min - enPromo}`;
    if (porcentaje && d.valor === 50 && min === 2) return "La 2ª a mitad de precio";
    if (porcentaje) return `Llevando ${min}, ${d.valor}% en ${enPromo}`;
    return `Llevando ${min}, S/${(d.valor / 100).toFixed(2)} de descuento`;
  }
  return porcentaje
    ? `${d.valor}% de descuento`
    : `S/${(d.valor / 100).toFixed(2)} de descuento`;
}

export function promosVigentes(
  descuentos: DescuentoCartaMin[],
  ahora: Date = new Date(),
): PromoVisibleCarta[] {
  return descuentos
    .filter((d) => promoCorreAhora(d, ahora))
    .map((d) => ({ id: d.id, nombre: d.nombre, detalle: detalleDePromo(d) }));
}

/**
 * LOS MÉTODOS DE COBRO DEL LOCAL (2026-08-22).
 *
 * Espejo de `METODOS_COBRO` del backend. Sin pasarela: el mozo o la caja
 * cobran de verdad y esto registra con qué, para poder cuadrar el turno.
 */
export const METODOS_COBRO = [
  { id: "efectivo", nombre: "Efectivo", icono: "💵" },
  { id: "yape", nombre: "Yape", icono: "📱" },
  { id: "plin", nombre: "Plin", icono: "📱" },
  { id: "tarjeta", nombre: "Tarjeta", icono: "💳" },
  { id: "transferencia", nombre: "Transferencia", icono: "🏦" },
] as const;

export type MetodoCobro = (typeof METODOS_COBRO)[number]["id"];

/** ¿Este pedido ya se cobró? `pago: 'validado'` es el sí. */
export function estaCobrado(p: PedidoCocina): boolean {
  return p.pago === "validado";
}

export async function cobrarPedido(
  id: string,
  metodo: MetodoCobro,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await api(`/pedidos/${id}/cobrar`, { method: "POST", body: { metodo } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo cobrar" };
  }
}
