// Tipos del dominio de la app (vista de la fuerza de ventas).

export type Temperatura = "caliente" | "tibio" | "frio";

export type EstadoLead =
  | "sin_atender"
  | "en_conversacion"
  | "seguimiento"
  | "ganado"
  | "perdido";

export interface Lead {
  id: string;
  nombre: string;
  canal: "whatsapp" | "instagram" | "messenger" | "tiktok";
  empresa: string; // nombre de la empresa/producto que consulta
  temperatura: Temperatura;
  estado: EstadoLead;
  // resumen que la IA arma del lead: qué quiere, en una línea.
  resumenIA: string;
  ultimoMensaje: string;
  haceMinutos: number;
  // señales que la IA detectó (presupuesto, urgencia, etc.)
  quiere?: string;
  presupuesto?: string;
  urgencia?: string;
}

export type Autor = "lead" | "bot" | "tu";

export interface Mensaje {
  id: string;
  autor: Autor;
  texto: string;
  haceMinutos: number;
  // nota de voz transcripta
  esVoz?: boolean;
}

export interface Conversacion {
  lead: Lead;
  mensajes: Mensaje[];
  // borradores que la IA propone para que vos toques y envíes.
  borradores: string[];
}

export interface EmpresaConfig {
  id: string;
  nombre: string;
  comision: number; // % que cobra la vendedora
  whatsapp: string;
  productos: { nombre: string; precio: string }[];
}

export interface Reporte {
  comisionesGanadas: number; // soles
  comisionesPendientes: number;
  leads: number;
  calientes: number;
  ventas: number;
  // funnel simple
  funnel: { etapa: string; cantidad: number }[];
  porEmpresa: { empresa: string; ventas: number; comision: number; pagada: boolean }[];
}
