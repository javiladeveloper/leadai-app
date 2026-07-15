"use client";

import Link from "next/link";

// Tarjeta que se muestra cuando una feature no está en el plan del negocio.
// Candado + mensaje + botón "Mejora tu plan" (lleva a Configuración).
export function BloqueoPlan({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <div className="mx-auto max-w-md rounded-tarjeta bg-carta p-8 text-center ring-1 ring-linea">
      <span className="text-4xl">🔒</span>
      <h2 className="mt-4 text-[1.15rem] font-bold text-tinta">{titulo}</h2>
      <p className="mt-2 text-[0.92rem] text-frio">{descripcion}</p>
      <Link
        href="/configuracion"
        className="mt-6 inline-flex rounded-tarjeta bg-brasa px-6 py-3 text-sm font-semibold text-carta transition hover:bg-brasa-hondo"
      >
        Mejorá tu plan
      </Link>
    </div>
  );
}
