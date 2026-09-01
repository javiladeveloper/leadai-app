"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { obtenerUso, type Uso } from "@/lib/api";

// Hits que consume atender a UN cliente de punta a punta (calificar + responder
// por cada mensaje, ~4 mensajes hasta categorizar). La unidad que ve el negocio
// es "clientes atendidos", no hits internos. 1 cliente ≈ 8 hits.
const HITS_POR_CLIENTE = 8;
const aClientes = (hits: number) => Math.floor(hits / HITS_POR_CLIENTE);

// Saldo de "clientes atendidos" del plan, siempre visible en el sidebar. El
// backend cuenta en clientes; acá se muestra usados/límite. Se refresca al
// montar, cada 30s, al volver el foco a la ventana, y cuando otra parte del
// panel emite "leadai:uso-cambio" (ej. el simulador tras atender un cliente).
export function ContadorHits() {
  const [uso, setUso] = useState<Uso | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    const refrescar = () => obtenerUso().then((u) => { if (vivo && u) { setUso(u); setCargando(false); } });
    refrescar();
    const id = setInterval(refrescar, 30_000);
    const alFoco = () => { if (document.visibilityState === "visible") refrescar(); };
    document.addEventListener("visibilitychange", alFoco);
    window.addEventListener("leadai:uso-cambio", refrescar);
    return () => {
      vivo = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", alFoco);
      window.removeEventListener("leadai:uso-cambio", refrescar);
    };
  }, []);

  if (cargando) {
    return (
      <div className="border-t border-white/10 px-5 py-4">
        <div className="h-2 w-full animate-pulse rounded-full bg-arena/15" />
        <div className="mt-2 h-2 w-24 animate-pulse rounded bg-arena/10" />
      </div>
    );
  }
  if (!uso) return null;

  // Un RESTAURANTE cuenta pedidos, no "clientes atendidos por la IA". Mostrarle
  // la unidad de captación acá es pedirle que traduzca cada vez que mira el
  // menú — y el número que le importa no aparece en ninguna parte.
  if (uso.pedidos) return <ContadorPedidos pedidos={uso.pedidos} seResetea={uso.bolsa.seResetea} />;

  const { bolsa } = uso;
  // Conteo REAL de clientes (nuevo backend). Fallback al estimado hits÷8 si el
  // backend aún no expone `clientes` (durante el deploy).
  const restante = uso.clientes ? uso.clientes.restante : aClientes(bolsa.totalDisponible);
  const total = uso.clientes ? uso.clientes.limite : aClientes(bolsa.mensual.total + bolsa.prepago.total);
  const usados = uso.clientes ? uso.clientes.usados : total - restante;
  // La barra crece con lo USADO; el color pasa a alerta cuando queda poco.
  const pctRestante = total > 0 ? restante / total : 0;
  const pctUsado = total > 0 ? Math.min(100, Math.round((usados / total) * 100)) : 0;
  const color = pctRestante > 0.4 ? "bg-ok" : pctRestante >= 0.15 ? "bg-tibio" : "bg-brasa";
  const dias = Math.max(
    0,
    Math.ceil((new Date(bolsa.seResetea).getTime() - Date.now()) / 86_400_000),
  );
  const bajo = pctRestante < 0.15;

  return (
    <div className="border-t border-white/10 px-5 py-4">
      {/* El naranja PURO del logo (`orbita`) y no `calor`: sobre el sidebar
          oscuro se invierte la relación — el hex del logo da 7.4:1 y el
          oscurecido para fondo claro apenas 3.7:1. */}
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
        Clientes este mes
      </p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-arena/15">
        {/* La barra crece con lo USADO. */}
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500`}
          style={{ width: `${pctUsado}%` }}
        />
      </div>
      <p className="mt-1.5 text-[0.9rem] font-semibold text-arena">
        {usados.toLocaleString("es-PE")}{" "}
        <span className="text-arena/50">de {total.toLocaleString("es-PE")} atendidos</span>
      </p>
      <p className="text-[0.72rem] text-arena/60">Te quedan {restante.toLocaleString("es-PE")}</p>
      <p className="text-[0.72rem] text-arena/50">
        {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
      </p>
      <Link
        href="/configuracion"
        className={`mt-2 inline-block rounded-chip px-3 py-1 text-[0.72rem] font-bold transition ${
          bajo ? "bg-brasa text-carta" : "text-arena/60 underline hover:text-arena"
        }`}
      >
        Comprar más
      </Link>
    </div>
  );
}

/**
 * El contador del sidebar para planes de restaurante: PEDIDOS del mes.
 *
 * Misma estructura que el de clientes (etiqueta naranja, barra, cifra, días
 * para el corte) para que el sidebar no cambie de forma según el plan. Lo que
 * cambia es la unidad y el remate: acá no hay "Comprar más" porque no se
 * compran pedidos sueltos — si te pasás, seguís vendiendo y subís de plan.
 */
function ContadorPedidos({
  pedidos, seResetea,
}: { pedidos: NonNullable<Uso["pedidos"]>; seResetea: string }) {
  const { usados, limite } = pedidos;
  const ilimitado = limite === 0;
  const pct = ilimitado ? 0 : Math.min(100, Math.round((usados / limite) * 100));
  const pasado = !ilimitado && usados > limite;
  // Igual que la tarjeta de Configuración: naranja del 80% en adelante. No es
  // rojo porque pasarse no es un error — se sigue vendiendo.
  const color = pasado || pct >= 80 ? "bg-orbita" : "bg-ok";
  const dias = Math.max(0, Math.ceil((new Date(seResetea).getTime() - Date.now()) / 86_400_000));

  return (
    <div className="border-t border-white/10 px-5 py-4">
      <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
        Pedidos este mes
      </p>
      {!ilimitado && (
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-arena/15">
          <div
            className={`h-full rounded-full ${color} transition-[width] duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <p className="mt-1.5 text-[0.9rem] font-semibold text-arena">
        {usados.toLocaleString("es-PE")}{" "}
        <span className="text-arena/50">
          {ilimitado ? "pedidos" : `de ${limite.toLocaleString("es-PE")} incluidos`}
        </span>
      </p>
      {!ilimitado && (
        <p className="text-[0.72rem] text-arena/60">
          {pasado ? "Sigues vendiendo igual" : `Te quedan ${(limite - usados).toLocaleString("es-PE")}`}
        </p>
      )}
      <p className="text-[0.72rem] text-arena/50">
        {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
      </p>
      {pasado && (
        <Link
          href="/mi-plan"
          className="mt-2 inline-block rounded-chip bg-orbita px-3 py-1 text-[0.72rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo"
        >
          Subir de plan
        </Link>
      )}
    </div>
  );
}
