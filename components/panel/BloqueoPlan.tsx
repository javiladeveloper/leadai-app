"use client";

import Link from "next/link";
import { TEXTO_MEJORAR_PLAN, URL_MI_PLAN } from "@/lib/enlaces";

// Tarjeta que se muestra cuando una feature no está en el plan del negocio.
// Candado + mensaje + "Mejorar mi plan". Lleva a Mi plan (2026-10-09): iba a
// Configuración, donde el plan no se cambia.
export function BloqueoPlan({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mx-auto max-w-md rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
      <span className="text-4xl">🔒</span>
      <h2 className="mt-4 text-[1.15rem] font-bold text-tinta">{titulo}</h2>
      <p className="mt-2 text-[0.92rem] text-frio">{descripcion}</p>
      <Link
        href={URL_MI_PLAN}
        className="mt-6 inline-flex rounded-tarjeta bg-brasa px-6 py-3 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
      >
        {TEXTO_MEJORAR_PLAN}
      </Link>
    </div>
  );
}
