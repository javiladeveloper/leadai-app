"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { soles } from "@/lib/precio";

/**
 * CUÁNTO CONSUME CADA EMPRESA (2026-08-27, pedido de Jonathan).
 *
 * "Si Guisella se registra, ELLA, SU CUENTA tiene un plan de consumo de
 * acuerdo al plan que adquirió... y si decide tener más empresas, pues su
 * consumo será mayor. Ahora, que ese plan y consumo separe por qué empresa
 * consume más o menos, ahí sí podría ser."
 *
 * La pantalla de Plan mostraba UN negocio con selector: para quien maneja
 * cinco, contestaba la pregunta equivocada. Lo que quiere saber es cuánto
 * paga en total y cuál de sus negocios se lo come.
 *
 * NO reemplaza a `PlanConsumo` (el detalle del negocio elegido): lo antecede.
 * Primero el panorama, después el detalle.
 */
interface UsoEmpresa {
  tenantId: string;
  nombre: string;
  plan: string;
  clientes: number;
  /** `null` = su plan no cuenta pedidos (captación). */
  pedidos: number | null;
  precioCentavos: number;
}

interface UsoCuenta {
  empresas: UsoEmpresa[];
  totalMensualCentavos: number;
  totalClientes: number;
  totalPedidos: number;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free", light: "Emprende", pro: "Pro", business: "Business",
  pedidos: "Arranque", arranque: "Arranque", crecer: "Crecer", full: "Full",
  resto_gratis: "Gratis", flujos: "Flujos",
};

export function ConsumoDeCuenta() {
  const [uso, setUso] = useState<UsoCuenta | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    // `conEmpresa: false`: la pregunta es de la CUENTA, no de un negocio.
    api<UsoCuenta>("/uso/cuenta", { conEmpresa: false })
      .then((r) => { if (vivo) { setUso(r); setCargando(false); } })
      // Si falla no se muestra nada: el detalle del negocio (`PlanConsumo`)
      // va debajo y sigue contestando lo suyo. Un error acá no puede tapar eso.
      .catch(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, []);

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  // CON UNA SOLA EMPRESA NO APORTA NADA: el desglose de una fila repite lo que
  // dice la tarjeta de abajo. Aparece cuando de verdad hay algo que comparar.
  if (!uso || uso.empresas.length < 2) return null;

  // El que más consume manda la escala de las barras: comparar contra el
  // total daría barras diminutas cuando uno solo se lleva casi todo.
  const tope = Math.max(...uso.empresas.map((e) => (e.pedidos ?? 0) + e.clientes), 1);

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.05rem] font-bold text-tinta">Tus {uso.empresas.length} negocios</h2>
          <p className="mt-1 text-[0.86rem] text-frio">
            Cuánto consume cada uno este mes.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">Pagas al mes</p>
          <p className="text-[1.3rem] font-bold text-tinta tabular-nums">
            {soles(uso.totalMensualCentavos)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3.5">
        {uso.empresas.map((e) => {
          const consumo = (e.pedidos ?? 0) + e.clientes;
          const unidad = e.pedidos !== null ? "pedidos" : "clientes";
          return (
            <div key={e.tenantId}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-[0.9rem] font-semibold text-tinta">
                  {e.nombre}
                  <span className="ml-2 rounded-chip bg-arena px-2 py-0.5 text-[0.68rem] font-bold text-frio">
                    {PLAN_LABEL[e.plan] ?? e.plan}
                  </span>
                </p>
                <p className="text-[0.84rem] text-tinta-2 tabular-nums">
                  <b className="text-tinta">{consumo}</b> {unidad}
                  {e.precioCentavos > 0 && (
                    <span className="ml-2 text-frio">· {soles(e.precioCentavos)}/mes</span>
                  )}
                </p>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-arena">
                <div
                  className="h-2 rounded-full bg-brasa transition-[width] duration-700"
                  style={{ width: `${Math.max(3, (consumo / tope) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 border-t border-linea pt-3 text-[0.82rem] text-frio">
        Cada negocio tiene su propio plan y se factura aparte. Abajo eliges cuál
        quieres ver en detalle.
      </p>
    </div>
  );
}

export default ConsumoDeCuenta;
