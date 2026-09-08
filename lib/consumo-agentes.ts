export type AgenteConsumo = 'sania' | 'leadai' | 'fitcore' | 'sin_clasificar';
export interface NegocioConsumo { id: string; nombre: string; producto?: string }
export const AGENTES_CONSUMO: { id: AgenteConsumo; nombre: string }[] = [
  { id: 'sania', nombre: 'Sania' }, { id: 'leadai', nombre: 'LeadAI' },
  { id: 'fitcore', nombre: 'FitCore' }, { id: 'sin_clasificar', nombre: 'Sin clasificar' },
];
const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function filtrarNegocios<T extends NegocioConsumo>(negocios: T[], agente: AgenteConsumo, busqueda: string): T[] {
  return negocios.filter(n => {
    const producto = ['sania', 'leadai', 'fitcore'].includes(n.producto ?? '') ? n.producto : 'sin_clasificar';
    return producto === agente && normalizar(n.nombre).includes(normalizar(busqueda));
  });
}
export function importePresupuesto(valor: string, sinPresupuesto: boolean): string | null {
  if (sinPresupuesto) return null;
  const limpio = valor.trim();
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(limpio)) throw new Error('Usa un importe USD no negativo, con punto y hasta seis decimales.');
  return limpio;
}
export function usdVisible(valor: string | null): string {
  if (valor === null) return 'No calculable';
  // Solo presentación: no redondear ni recalcular el dinero recibido del servidor.
  return `USD ${valor.includes('.') ? valor.replace(/0+$/, '').replace(/\.$/, '') : valor}`;
}
export interface ConfiguracionPresupuesto {
  tenantId: string; mes: string; presupuestoUsd: string | null; vigenteDesde: string | null;
  revisionVigente: number; revisionMes: number; actualizadoEn: string | null;
}
interface DesgloseConsumo {
  gastoConocidoUsd: string | null; eventosRegistrados: number; eventosCalculables: number; eventosNoCalculables: number;
}
export interface InformeConsumo {
  version: number; generadoEn: string; configuracion: ConfiguracionPresupuesto;
  resumen: DesgloseConsumo & {
    tenantId: string; mes: string; moneda: 'USD'; presupuestoUsd: string | null;
    cobertura: 'sin_datos' | 'parcial' | 'completa_eventos';
    estado: 'sin_presupuesto' | 'sin_datos' | 'incompleto' | 'normal' | 'advertencia' | 'excedido';
    porcentajeUsado: string | null; umbralesAlcanzados: number[]; llamadasHistoricasSinDetalle: number;
    porOrigen: Record<'bot_real' | 'prueba' | 'panel' | 'desconocido', DesgloseConsumo>;
  };
  alertasImplementadas: boolean;
  avisos: { umbral: number; entregado: boolean; gastoUsd: string; creadoEn: string }[] | null;
}
