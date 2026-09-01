"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlan, reportePedidos, type ReportePedidos } from "@/lib/api";
import { soles } from "@/lib/precio";
import { Cargando } from "@/components/Cargando";
import { PlanBloqueado } from "@/components/panel/PlanBloqueado";

/**
 * LOS REPORTES DE UN RESTAURANTE (2026-09-01).
 *
 * Reporte de Jonathan: "restaurantes no tiene una sección de reportes... ya la
 * agregamos y podemos meterla al plan más alto".
 *
 * NO EXISTÍA EN EL PANEL, pero el backend la servía desde julio en
 * `GET /reportes/pedidos`: ventas por día, ticket promedio, top platos y el
 * embudo de dónde se caen las conversaciones. Estaba todo calculado y nadie
 * podía verlo.
 *
 * La sección `/reportes` que ya existía pide `calificaLeads` —una capacidad que
 * un restaurante no tiene— y muestra leads y comisiones: para un restaurante
 * sería una pantalla de datos que no le corresponden.
 */

const PRESETS = [
  { id: "hoy" as const, label: "Hoy" },
  { id: "semana" as const, label: "7 días" },
  { id: "mes" as const, label: "30 días" },
];

export function ReportesRestaurante() {
  const [preset, setPreset] = useState<"hoy" | "semana" | "mes">("semana");
  const [rep, setRep] = useState<ReportePedidos | null>(null);
  const [tiene, setTiene] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    // LAS DOS JUNTAS: si el plan llegara después, se vería el reporte y un
    // instante más tarde el candado — o al revés. Mismo criterio que PlanConsumo.
    void Promise.all([reportePedidos(preset), obtenerMiPlan()]).then(([r, p]) => {
      if (!vivo) return;
      setRep(r);
      setTiene(p?.features?.reportesAvanzados ?? true);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, [preset]);

  if (cargando) return <Cargando que="tus reportes" />;

  if (tiene === false) {
    return (
      <PlanBloqueado
        plan="Crecer"
        titulo="Mira cómo va tu negocio de verdad"
        bajada="Los números que no se ven en el día a día: qué se vende más, cuánto gasta cada cliente y dónde se te caen los pedidos."
        beneficios={[
          { titulo: "Cuánto vendiste", detalle: "Por día, por semana o por mes, con el ticket promedio de cada pedido." },
          { titulo: "Qué se vende más", detalle: "Tus platos ordenados por cuánto salen, para saber qué reponer y qué sacar." },
          { titulo: "Dónde se caen los pedidos", detalle: "Cuántos empezaron a pedir y se fueron, y en qué punto: eligiendo o al pagar." },
          { titulo: "Delivery contra local", detalle: "Cuánto entra por cada canal, para saber dónde poner el esfuerzo." },
        ]}
      />
    );
  }

  if (!rep) {
    return (
      <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
        <p className="font-semibold text-tinta">No pudimos cargar tus reportes. Recarga.</p>
      </div>
    );
  }

  const t = rep.totales;
  const maxDia = Math.max(1, ...rep.serie.map((p) => p.totalCentavos));

  return (
    <div className="space-y-5">
      {/* EL RANGO PRIMERO: lo primero que hace el dueño es cambiarlo, y tenerlo
          abajo obliga a leer todo antes de poder elegir qué está leyendo. */}
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={`rounded-full px-4 py-1.5 text-[0.86rem] font-semibold transition ${
              preset === p.id
                ? "bg-tinta text-carta"
                : "bg-carta text-tinta-2 ring-1 ring-linea hover:ring-brasa/40"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* LO VENDIDO, EN GRANDE. Es la pregunta con la que el dueño entra acá. */}
      <section className="entra rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)] lg:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">Vendido</p>
        <p className="mt-1 text-[2.6rem] font-bold leading-none tabular-nums">
          {soles(t.totalCentavos)}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[0.88rem] text-arena/75">
          <span>
            <b className="tabular-nums text-arena">{t.pedidos}</b> pedidos
          </span>
          <span>
            ticket promedio{" "}
            <b className="tabular-nums text-arena">{soles(t.ticketPromedioCentavos)}</b>
          </span>
          {t.cancelados > 0 && (
            <span>
              <b className="tabular-nums text-arena">{t.cancelados}</b> cancelados
            </span>
          )}
        </div>
      </section>

      {/* VENTA POR DÍA. Barras y no una tabla: acá se busca el pico y el hueco,
          no el número exacto de cada día. */}
      {rep.serie.length > 1 && (
        <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[0.95rem] font-bold text-tinta">Venta por día</p>
          <div className="mt-4 flex items-end gap-1.5" style={{ height: 120 }}>
            {rep.serie.map((p) => (
              <div key={p.dia} className="group flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t bg-brasa/80 transition group-hover:bg-brasa"
                  style={{ height: `${Math.max(3, (p.totalCentavos / maxDia) * 100)}%` }}
                  title={`${p.dia}: ${soles(p.totalCentavos)} · ${p.pedidos} pedidos`}
                />
                <span className="text-[0.62rem] tabular-nums text-frio">{p.dia.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* QUÉ SE VENDE MÁS: sirve para reponer y para decidir qué sacar. */}
        {rep.topPlatos.length > 0 && (
          <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.95rem] font-bold text-tinta">Lo más vendido</p>
            <ul className="mt-3 space-y-2.5">
              {rep.topPlatos.slice(0, 5).map((p, i) => (
                <li key={p.nombre} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-arena text-[0.78rem] font-bold text-tinta-2">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9rem] text-tinta">{p.nombre}</span>
                  <span className="shrink-0 text-[0.86rem] font-bold tabular-nums text-tinta">
                    {p.cantidad}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* DELIVERY CONTRA LOCAL. */}
        {rep.porModalidad.length > 0 && (
          <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[0.95rem] font-bold text-tinta">Por dónde venden</p>
            <ul className="mt-3 space-y-2.5">
              {rep.porModalidad.map((m) => (
                <li key={m.modalidad} className="flex items-center justify-between gap-3">
                  <span className="text-[0.9rem] capitalize text-tinta">{m.modalidad}</span>
                  <span className="text-[0.86rem] tabular-nums text-tinta-2">
                    <b className="text-tinta">{soles(m.totalCentavos)}</b> · {m.pedidos}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* EL EMBUDO: lo único de esta pantalla que dice QUÉ ARREGLAR. No es lo
          mismo perder gente eligiendo (carta confusa) que al pagar (el Yape no
          convence). */}
      {rep.embudo.length > 0 && (
        <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[0.95rem] font-bold text-tinta">Dónde se caen los pedidos</p>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Cuántos empezaron a pedir y hasta dónde llegaron.
          </p>
          <ul className="mt-4 space-y-3">
            {rep.embudo.map((e) => {
              const pct = e.llegaron > 0 ? Math.round((e.siguieron / e.llegaron) * 100) : 0;
              return (
                <li key={e.etapa}>
                  <div className="flex items-baseline justify-between text-[0.85rem]">
                    <span className="capitalize text-tinta">{e.etapa}</span>
                    <span className="tabular-nums text-tinta-2">
                      {e.siguieron} de {e.llegaron}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-arena">
                    <div
                      className={`h-full rounded-full ${pct < 50 ? "bg-calor" : "bg-brasa"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {t.preguntasAMano > 0 && (
        <p className="text-center text-[0.84rem] text-frio">
          Respondiste <b className="text-tinta-2">{t.preguntasAMano}</b> preguntas a mano en este
          período.
        </p>
      )}
    </div>
  );
}
