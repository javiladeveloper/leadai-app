"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { PlanConsumo } from "@/components/panel/PlanConsumo";

/**
 * MI PLAN, EN EL MENÚ (2026-09-01).
 *
 * Pedido de Jonathan: "debemos tener una sección mi plan donde vemos el plan
 * actual y podemos pensar en cambiar de plan también".
 *
 * TODO ESTO YA ESTABA CONSTRUIDO —consumo del mes, plan vigente, comparar y
 * cambiar de plan, saldo, historial de pagos— pero vivía como una PESTAÑA
 * dentro de Configuración. Nadie busca cuánto paga en "Ajustes": va a mirar su
 * plan, que es una pregunta de plata, no de configuración.
 *
 * Y ES LA PANTALLA QUE MÁS IMPORTA QUE SE ENCUENTRE: es donde el dueño sube de
 * plan. Esconderla es esconder el único lugar donde nos paga más.
 *
 * NO SE DUPLICA NADA: se monta el mismo `PlanConsumo` que usa Configuración.
 * Dos copias de una pantalla de facturación divergen, y la que se lee termina
 * siendo la equivocada.
 */
export default function MiPlanPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu cuenta</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Mi plan</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Qué incluye lo que pagas, cuánto llevas usado y cómo cambiarlo.
        </p>
      </header>

      <PlanConsumo />
    </div>
  );
}
