"use client";

import { useEffect, useState } from "react";
import { embudoAnuncios, type EmbudoAnuncio, type PasoEmbudo } from "@/lib/api";

/**
 * DÓNDE SE PIERDE LA PLATA DE CADA ANUNCIO (2026-09-17, pedido de Jonathan).
 *
 * El panel decía "25 clics, 3 leads" y eso se leía como un embudo malísimo. Al
 * mirar las acciones de Meta apareció otra cosa: la mayoría de esos clics nunca
 * fue al WhatsApp —eran likes, reacciones y vistas de video.
 *
 * Eso cambia QUÉ hay que arreglar, y por eso la pantalla muestra los pasos por
 * separado en vez de un porcentaje final. Un anuncio donde reaccionan pero no
 * tocan el botón tiene un problema de OFERTA; uno donde tocan y no escriben,
 * de PROMESA. Son arreglos opuestos.
 */

const COLOR: Record<string, string> = {
  no_toca: "bg-tibio-suave text-tibio",
  no_abre: "bg-tibio-suave text-tibio",
  no_escribe: "bg-tibio-suave text-tibio",
  sano: "bg-ok/12 text-ok",
};

const ETIQUETA: Record<string, string> = {
  no_toca: "No lo tocan",
  no_abre: "No van al chat",
  no_escribe: "No escriben",
  sano: "Funciona",
};

function soles(centavos: number): string {
  return `S/${(centavos / 100).toLocaleString("es-PE", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export function EmbudoAnuncios({ tenant }: { tenant?: string } = {}) {
  const [filas, setFilas] = useState<EmbudoAnuncio[] | null>(null);

  useEffect(() => {
    let vivo = true;
    setFilas(null);
    void embudoAnuncios(tenant).then((f) => { if (vivo) setFilas(f); });
    return () => { vivo = false; };
  }, [tenant]);

  if (filas === null) return <div className="h-52 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (filas.length === 0) return null;

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <h3 className="text-[1.05rem] font-bold text-tinta">Dónde se te pierde la gente</h3>
      <p className="mt-1 text-[0.85rem] text-frio">
        No todos los que tocan tu anuncio llegan al WhatsApp: muchos solo dan
        like o miran el video. Acá ves en qué paso se caen y qué conviene
        cambiar.
      </p>

      <div className="mt-5 space-y-3">
        {filas.map((f) => (
          <Fila key={f.anuncioId} f={f} />
        ))}
      </div>
    </div>
  );
}

function Fila({ f }: { f: EmbudoAnuncio }) {
  // El primer paso es la base de las barras: todo se compara contra cuántos lo
  // vieron, que es lo que hace visible la caída real.
  const base = Math.max(f.pasos[0]?.cantidad ?? 0, 1);

  return (
    <div className="rounded-lg bg-arena/40 px-4 py-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="truncate text-[0.88rem] font-semibold text-tinta">{f.nombre}</span>
        <span className="flex items-center gap-2">
          {f.problema && (
            <span className={`rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${COLOR[f.problema]}`}>
              {ETIQUETA[f.problema]}
            </span>
          )}
          <span className="text-[0.8rem] tabular-nums text-frio">{soles(f.gastoCentavos)}</span>
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {f.pasos.map((p) => <Paso key={p.etiqueta} p={p} base={base} />)}
      </div>

      {/* El costo por conversación es el número que decide presupuesto: "gasté
          S/10" no dice si conviene; "cada persona que te escribió costó S/10"
          sí. Se omite cuando no hubo ninguna, en vez de mostrar un S/0.00 que
          se leería como "salió gratis". */}
      {f.costoPorConversacionCentavos !== null && (
        <p className="mt-2 text-[0.78rem] text-tinta-2">
          Cada conversación te costó{" "}
          <strong className="text-tinta">{soles(f.costoPorConversacionCentavos)}</strong>
        </p>
      )}

      <p className="mt-2.5 text-[0.82rem] text-frio">{f.consejo}</p>
    </div>
  );
}

/**
 * Un paso del embudo.
 *
 * El porcentaje es sobre el paso ANTERIOR y no sobre el total: "25% de los que
 * lo tocaron fueron al chat" dice dónde está la fuga; "0.4% de los que lo
 * vieron" no le dice nada a nadie.
 */
function Paso({ p, base }: { p: PasoEmbudo; base: number }) {
  const ancho = Math.max(2, Math.round((p.cantidad / base) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 truncate text-[0.8rem] text-tinta-2">{p.etiqueta}</span>
      <div className="h-3.5 flex-1 overflow-hidden rounded bg-arena">
        <div className="h-full rounded bg-brasa/70" style={{ width: `${ancho}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-[0.76rem] tabular-nums text-frio">
        {p.cantidad.toLocaleString("es-PE")}
        {p.porcentaje !== null && ` · ${p.porcentaje}%`}
      </span>
    </div>
  );
}
