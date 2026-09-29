"use client";

import { useCallback } from "react";
import { api, type EmbudoAnuncio } from "@/lib/api";
import { ErrorMarketing, importeMarketing, periodoCoincide, type MetadatosMarketing, useLecturaMarketing } from "./marketing-lectura";

type ReporteEmbudo = MetadatosMarketing & { embudos: EmbudoAnuncio[] };

export function EmbudoAnuncios({ tenant, dias = 30 }: { tenant?: string; dias?: number } = {}) {
  // El helper legacy devuelve solo el array y descarta moneda/periodo. Reusar
  // el cliente común conserva la respuesta completa y su manejo de errores.
  const cargar = useCallback(() => api<ReporteEmbudo>(`/anuncios/embudo?dias=${dias}`, { tenant }), [tenant, dias]);
  const { datos: reporte, cargando, error, reintentar } = useLecturaMarketing<ReporteEmbudo>(`${tenant}:${dias}`, cargar);
  if (error) return <ErrorMarketing mensaje={error} reintentar={reintentar} />;
  if (cargando) return <div role="status" aria-label="Cargando métricas Meta y CRM" className="h-52 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!reporte || !periodoCoincide(reporte, dias)) return <ErrorMarketing mensaje="No se pudo confirmar el periodo de la actividad. Vuelve a consultarla." reintentar={reintentar} />;
  const filas = reporte.embudos;
  return <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
    <h3 className="text-[1.05rem] font-bold text-tinta">Actividad de anuncios y contactos</h3>
    <p className="mt-1 text-sm text-frio">Últimos {dias} días. Meta registra exposición y clics; el CRM registra contactos atribuidos. Son mediciones separadas, no pasos consecutivos de las mismas personas. Un clic al enlace no confirma una apertura de WhatsApp.</p>
    {!filas.length ? <p className="mt-4 text-sm text-frio">Sin actividad registrada para este periodo.</p> : <div className="mt-5 space-y-3">{filas.map((f) => <Fila key={f.anuncioId} f={f} moneda={reporte.moneda} />)}</div>}
    <p className="mt-3 text-sm text-frio">{reporte.actualizadoEn ? `Actualizado: ${new Date(reporte.actualizadoEn).toLocaleString("es-PE")}` : "Fecha de actualización no disponible."}</p>
  </div>;
}

function Fila({ f, moneda }: { f: EmbudoAnuncio; moneda?: string | null }) {
  // Compatibilidad con el DTO anterior: sus etiquetas del enlace eran una
  // inferencia. No mostrar porcentajes ni diagnósticos de ese embudo.
  const pasos = f.pasos.map((p) => ({ ...p,
    etiqueta: /whatsapp|fueron al chat/i.test(p.etiqueta) ? "Clics al enlace" : p.etiqueta,
    crm: /escrib|leadai|contact|crm/i.test(p.etiqueta) && !/meta/i.test(p.etiqueta),
  }));
  return <div className="rounded-lg bg-arena/40 px-4 py-3.5">
    <h4 className="break-words text-[0.88rem] font-semibold text-tinta">{f.nombre}</h4>
    <p className="mt-1 text-sm text-frio">Gasto Meta: {importeMarketing(f.gastoCentavos, moneda)}</p>
    {f.problema === "sano" && <p className="mt-1 text-sm text-frio">Actividad registrada</p>}
    {([false, true] as const).map((crm) => <div key={String(crm)} className="mt-3">
      <p className="text-sm font-semibold text-tinta-2">{crm ? "CRM · contactos atribuidos" : "Meta · actividad del anuncio"}</p>
      <dl className="mt-2 space-y-2">{pasos.filter((p) => p.crm === crm).map((p) => <div key={p.etiqueta} className="flex flex-wrap justify-between gap-2 text-sm">
        <dt className="text-tinta-2">{p.etiqueta}</dt><dd className="tabular-nums text-tinta">{Number.isFinite(p.cantidad) ? p.cantidad.toLocaleString("es-PE") : "No disponible"}</dd>
      </div>)}</dl>
    </div>)}
  </div>;
}
