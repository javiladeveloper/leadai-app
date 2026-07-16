"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import {
  listarLeads,
  accionLead,
  type Lead,
  type EstadoLead,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BadgeCanal } from "@/components/BadgeCanal";
import PopupLead from "@/components/panel/PopupLead";

type Estado = "cargando" | "ok" | "error";

// Las etapas del pipeline en orden de avance. Los `estado` son los valores
// reales del backend; los `titulo` son en lenguaje simple (mismos que en Leads).
const ETAPAS: {
  estado: EstadoLead;
  titulo: string;
  ayuda: string;
  acento: string; // clase de color para el punto/encabezado de la columna
}[] = [
  { estado: "nuevo", titulo: "Nuevos", ayuda: "Recién llegaron", acento: "bg-brasa" },
  { estado: "nutriendo", titulo: "En seguimiento", ayuda: "El bot los está trabajando", acento: "bg-tibio" },
  { estado: "escalado", titulo: "Para atender", ayuda: "Listos para que entres vos", acento: "bg-brasa-hondo" },
  { estado: "ganado", titulo: "Ganados", ayuda: "Cerraste la venta", acento: "bg-ok" },
  { estado: "perdido", titulo: "Perdidos", ayuda: "No avanzaron", acento: "bg-frio" },
];

const NIVEL_ETIQUETA: Record<Lead["nivelInteres"], { texto: string; clase: string }> = {
  caliente: { texto: "🔴 Caliente", clase: "bg-brasa-suave text-brasa-hondo" },
  tibio: { texto: "🟡 Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "⚪ Frío", clase: "bg-arena text-frio" },
};

// Cuántas tarjetas se muestran por columna de arranque y cuántas suma cada
// "ver más". La columna tiene scroll interno, así que nunca crece infinito.
const PAGINA_ETAPA = 12;

// Seguimiento: tablero por etapas de venta. Cada columna es un estado del lead;
// las tarjetas se pueden marcar como ganado o descartar sin salir de la vista.
export default function SeguimientoPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Lead abierto en el popup de vista rápida (1 click). El doble click entra a
  // la conversación directamente. Usamos un timer para distinguir 1 de 2 clicks.
  const [leadAbierto, setLeadAbierto] = useState<Lead | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cuántas tarjetas mostrar por etapa (paginación en cliente con "ver más").
  // Cada columna arranca mostrando PAGINA_ETAPA y crece de a tandas.
  const [visiblePorEtapa, setVisiblePorEtapa] = useState<Record<string, number>>({});

  // 1 click abre el popup; 2 clicks entran a la conversación (cancela el popup).
  const alHacerClick = useCallback(
    (lead: Lead) => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current = setTimeout(() => {
        setLeadAbierto(lead);
        clickTimer.current = null;
      }, 220);
    },
    [],
  );
  const alDobleClick = useCallback(
    (lead: Lead) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
      router.push(`/conversacion/${lead.id}`);
    },
    [router],
  );

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const r = await listarLeads();
      setLeads(r);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  // Agrupa los leads por etapa y, dentro de cada una, ordena por temperatura:
  // los calientes arriba (lo más urgente), luego tibios, luego fríos.
  const porEtapa = useMemo(() => {
    const ORDEN_NIVEL: Record<Lead["nivelInteres"], number> = { caliente: 0, tibio: 1, frio: 2 };
    const mapa = new Map<EstadoLead, Lead[]>();
    for (const et of ETAPAS) mapa.set(et.estado, []);
    for (const l of leads) mapa.get(l.estado)?.push(l);
    for (const lista of mapa.values()) {
      lista.sort((a, b) => ORDEN_NIVEL[a.nivelInteres] - ORDEN_NIVEL[b.nivelInteres]);
    }
    return mapa;
  }, [leads]);

  async function mover(
    lead: Lead,
    accion: { tipo: "marcar_ganado" | "descartar" },
  ) {
    setOcupado(lead.id);
    const r = await accionLead(lead.id, accion);
    setOcupado(null);
    if (r.ok) {
      // Actualización optimista local: movemos el lead a la etapa destino
      // sin recargar toda la lista.
      const destino: EstadoLead = accion.tipo === "marcar_ganado" ? "ganado" : "perdido";
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, estado: destino } : l)),
      );
    } else {
      // Si falla, recargamos para volver al estado real del servidor.
      cargar();
    }
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Tu pipeline</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Seguimiento</h1>
          <p className="mt-1 text-[0.92rem] text-frio">
            Mirá en qué etapa está cada venta y movela cuando cierres o descartes.
          </p>
        </div>
        <button
          onClick={cargar}
          className="rounded-chip bg-carta px-4 py-2 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
        >
          Actualizar
        </button>
      </header>

      {estado === "cargando" && <SkeletonLista filas={5} />}

      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar tu pipeline. Recargá.</p>
        </div>
      )}

      {estado === "ok" && leads.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Todavía no hay ventas en tu pipeline
          </p>
          <p className="mt-1 text-[0.9rem] text-frio">
            Cuando lleguen leads por WhatsApp, van a ir apareciendo acá por etapa.
          </p>
          <Link
            href="/configuracion"
            className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition active:scale-[0.99]"
          >
            Conectar WhatsApp
          </Link>
        </div>
      )}

      {estado === "ok" && leads.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {ETAPAS.map((et) => {
            const items = porEtapa.get(et.estado) ?? [];
            const cerrable = et.estado !== "ganado" && et.estado !== "perdido";
            const visible = visiblePorEtapa[et.estado] ?? PAGINA_ETAPA;
            const mostrados = items.slice(0, visible);
            const restantes = items.length - mostrados.length;
            return (
              <section key={et.estado} className="flex min-w-0 flex-col">
                {/* Encabezado de columna */}
                <div className="flex items-center gap-2 px-1 pb-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${et.acento}`} />
                  <h2 className="text-[0.95rem] font-bold text-tinta">{et.titulo}</h2>
                  <span className="ml-auto rounded-full bg-arena px-2 py-0.5 text-xs font-bold tabular-nums text-tinta-2">
                    {items.length}
                  </span>
                </div>

                {/* Columna con altura máxima y scroll interno: nunca crece
                    infinito por más leads que tenga la etapa. */}
                <div className="flex max-h-[calc(100vh-13rem)] flex-col gap-2.5 overflow-y-auto pr-0.5">
                  {items.length === 0 && (
                    <p className="rounded-tarjeta border border-dashed border-linea px-3 py-6 text-center text-[0.8rem] text-frio">
                      {et.ayuda}
                    </p>
                  )}

                  {mostrados.map((lead) => {
                    const nivel = NIVEL_ETIQUETA[lead.nivelInteres];
                    const trabajando = ocupado === lead.id;
                    return (
                      <article
                        key={lead.id}
                        onClick={() => alHacerClick(lead)}
                        onDoubleClick={() => alDobleClick(lead)}
                        title="Un click: ver detalle · Doble click: abrir conversación"
                        className="cursor-pointer rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="block min-w-0 flex-1 truncate font-semibold text-tinta">
                            {lead.nombre ?? lead.contactoExterno}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${nivel.clase}`}
                          >
                            {nivel.texto}
                          </span>
                        </div>

                        {lead.resumenIA && (
                          <p className="mt-1.5 line-clamp-2 text-[0.82rem] text-tinta-2">
                            {lead.resumenIA}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <BadgeCanal canal={lead.canalOrigen} tamano="chico" />
                          {lead.origenEtiqueta === "comentario" && (
                            <span className="rounded-full bg-tibio-suave px-2 py-0.5 text-[0.66rem] font-bold text-tibio">
                              💬 vino de un comentario
                            </span>
                          )}
                          {lead.origenEtiqueta?.startsWith("ad:") && (
                            <span className="rounded-full bg-brasa-suave px-2 py-0.5 text-[0.66rem] font-bold text-brasa-hondo">
                              📣 {lead.origenEtiqueta.slice(3)}
                            </span>
                          )}
                        </div>

                        {/* Acciones de cierre — solo en etapas activas.
                            stopPropagation: no abrir el popup al usar los botones. */}
                        {cerrable && (
                          <div className="mt-3 flex gap-2">
                            <button
                              disabled={trabajando}
                              onClick={(e) => { e.stopPropagation(); mover(lead, { tipo: "marcar_ganado" }); }}
                              className="flex-1 rounded-chip bg-ok/12 px-2.5 py-1.5 text-[0.78rem] font-bold text-ok transition hover:bg-ok/20 disabled:opacity-50"
                            >
                              Gané
                            </button>
                            <button
                              disabled={trabajando}
                              onClick={(e) => { e.stopPropagation(); mover(lead, { tipo: "descartar" }); }}
                              className="flex-1 rounded-chip bg-arena px-2.5 py-1.5 text-[0.78rem] font-bold text-frio transition hover:bg-linea disabled:opacity-50"
                            >
                              Descartar
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {/* Ver más: carga otra tanda de esta etapa (sin recargar). */}
                  {restantes > 0 && (
                    <button
                      onClick={() =>
                        setVisiblePorEtapa((prev) => ({
                          ...prev,
                          [et.estado]: visible + PAGINA_ETAPA,
                        }))
                      }
                      className="rounded-chip bg-arena px-3 py-2 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-linea"
                    >
                      Ver más ({restantes})
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Popup de vista rápida (1 click sobre una tarjeta): resumen +
          conversación completa + responder, sin salir del tablero. Doble click
          en la tarjeta entra directo a la conversación. */}
      {leadAbierto && (
        <PopupLead
          lead={leadAbierto}
          onCerrar={() => setLeadAbierto(null)}
          onCambio={(tipo) => mover(leadAbierto, { tipo })}
        />
      )}
    </div>
  );
}
