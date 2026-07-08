"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { IconoSeguimiento } from "@/components/Iconos";

// Seguimiento del panel de escritorio: placeholder hasta implementar el
// pipeline de etapas de venta.
export default function SeguimientoPanel() {
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
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu pipeline</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Seguimiento</h1>
      </header>

      <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-carta px-6 py-16 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-tibio-suave text-tinta">
          <IconoSeguimiento className="h-7 w-7" />
        </span>
        <p className="max-w-xs text-[1rem] font-semibold text-tinta">
          Muy pronto vas a poder ver tus ventas avanzar por etapas acá
        </p>
        <p className="max-w-xs text-[0.88rem] text-frio">
          Estamos preparando el pipeline de Seguimiento para esta sección.
        </p>
      </div>
    </div>
  );
}
