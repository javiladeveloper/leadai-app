"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerResumen } from "@/lib/api";

// Campana de avisos en el header: muestra cuántos leads calientes hay sin
// atender (del /resumen del tenant activo). Se refresca sola cada 30s para que
// aparezca sin recargar. Al tocarla, lleva a la lista de leads.
export function CampanaAlertas() {
  const router = useRouter();
  const [calientes, setCalientes] = useState(0);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      obtenerResumen().then((r) => {
        if (vivo && r) setCalientes(r.calientesSinAtender);
      });
    };
    cargar();
    const id = setInterval(cargar, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const hay = calientes > 0;

  return (
    <button
      type="button"
      onClick={() => router.push("/leads")}
      aria-label={hay ? `${calientes} leads calientes sin atender` : "Sin avisos"}
      title={hay ? `${calientes} caliente(s) sin atender — tocá para verlos` : "Sin avisos"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-arena/60"
    >
      {/* Campana */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${hay ? "text-brasa" : "text-frio"}`}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {/* Badge con el número */}
      {hay && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brasa px-1 text-[0.62rem] font-bold text-carta">
          {calientes > 9 ? "9+" : calientes}
        </span>
      )}
    </button>
  );
}
