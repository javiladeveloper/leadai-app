"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, leerEmpresaActiva, guardarEmpresaActiva } from "@/lib/auth";
import { SkeletonLista, SkeletonChat } from "@/components/Skeletons";
import {
  listarBandejaGlobal,
  obtenerLead,
  accionLead,
  calcularComision,
  type LeadGlobal,
  type LeadDetalle,
  type Mensaje as MensajeApi,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDictado } from "@/lib/useDictado";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { Burbuja } from "@/components/Burbuja";
import { ChipTemp } from "@/components/ChipTemp";
import { IconoMic, IconoEnviar } from "@/components/Iconos";
import type { Mensaje as MensajeUI } from "@/lib/tipos";

type Estado = "cargando" | "ok" | "error";

// "hace X" legible en español, a partir de minutos.
function haceTexto(min: number): string {
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

// Convierte un timestamp ISO en minutos transcurridos hasta ahora.
function minutosDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
}

// Adapta el LeadGlobal (lib/api) al shape mínimo que TarjetaLead necesita.
// `conEtiquetaNegocio`: con 2+ negocios cada tarjeta dice de qué negocio viene.
function aTarjeta(lead: LeadGlobal, conEtiquetaNegocio: boolean): TarjetaLeadProps {
  return {
    id: lead.id,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    empresa: conEtiquetaNegocio ? lead.negocioNombre : undefined,
    temperatura: lead.nivelInteres,
    urgente: lead.nivelInteres === "caliente" && lead.estado === "nuevo",
    resumenIA: lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead.",
    haceMinutos: minutosDesde(lead.actualizadoEn),
  };
}

// Adapta un Mensaje real (lib/api: direccion/contenido/creadoEn) al shape que
// Burbuja espera (lib/tipos: autor/texto/haceMinutos). "saliente" es lo que
// mandamos nosotros (o la IA en automático) → se muestra a la derecha, "tu".
// "entrante" es lo que escribió el lead → izquierda.
function aBurbuja(m: MensajeApi): MensajeUI {
  return {
    id: m.id,
    autor: m.direccion === "saliente" ? "tu" : "lead",
    texto: m.contenido,
    haceMinutos: minutosDesde(m.creadoEn),
  };
}

// Pantalla principal del panel: bandeja + chat + contexto IA en 3 columnas
// (desktop). En mobile se muestra solo la lista de leads; tocar un lead
// navega a la conversación de la app (misma ruta que usa la fuerza de ventas
// en el teléfono), vía el propio <Link> de TarjetaLead.
export default function ConversacionesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  const [estadoLista, setEstadoLista] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<LeadGlobal[]>([]);
  const [cantidadNegocios, setCantidadNegocios] = useState(0);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);

  const [estadoLead, setEstadoLead] = useState<Estado>("cargando");
  const [lead, setLead] = useState<LeadDetalle | null>(null);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dictado = useDictado((fragmento) =>
    setTexto((t) => (t ? `${t} ${fragmento}` : fragmento)),
  );

  // Carga el borrador en el campo de respuesta y enfoca el cursor al final,
  // para que el usuario vea que ya puede editarlo antes de enviar.
  function editarBorrador(borrador: string) {
    setTexto(borrador);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(borrador.length, borrador.length);
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }
  const [ventaAbierta, setVentaAbierta] = useState(false);
  const [montoVenta, setMontoVenta] = useState("");
  const [comisionCalc, setComisionCalc] = useState<number | null>(null);
  const [accionError, setAccionError] = useState<string | null>(null);

  // Calcula la comisión sugerida según la config del negocio cuando cambia el
  // monto (debounce corto para no llamar en cada tecla).
  useEffect(() => {
    const monto = Number(montoVenta);
    if (!ventaAbierta || !monto || monto <= 0) { setComisionCalc(null); return; }
    const t = setTimeout(() => { calcularComision(monto).then(setComisionCalc); }, 350);
    return () => clearTimeout(t);
  }, [montoVenta, ventaAbierta]);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  const cargarLista = useCallback(async () => {
    try {
      // Bandeja GLOBAL: conversaciones de todos los negocios de captación del
      // usuario en una sola lista (los restaurantes quedan fuera — sus
      // pedidos viven en la app de Cocina).
      const r = await listarBandejaGlobal();
      setLeads(r.leads);
      setCantidadNegocios(r.negocios.length);
      setEstadoLista("ok");
    } catch (e) {
      void e;
      setEstadoLista("error");
    }
  }, []);

  // Selecciona un lead para el chat. Si es de OTRO negocio, la empresa activa
  // cambia a la del lead ANTES de cargar el detalle — obtenerLead/accionLead/
  // frases usan X-Tenant-Id de la empresa activa, así el chat y sus acciones
  // funcionan sin que el usuario pase por el switcher.
  const seleccionar = useCallback((l: LeadGlobal) => {
    if (l.tenantId !== leerEmpresaActiva()) guardarEmpresaActiva(l.tenantId);
    setSeleccionadoId(l.id);
  }, []);

  const cargarLead = useCallback(async (id: string) => {
    try {
      const r = await obtenerLead(id);
      setLead(r);
      setEstadoLead("ok");
      // Si el backend ya no encuentra este lead (404 → null), no dejamos la
      // selección atascada apuntando a algo que nunca va a cargar.
      if (!r) setSeleccionadoId(null);
    } catch (e) {
      void e;
      setEstadoLead("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargarLista();
  }, [listo, cargarLista]);

  // Selecciona el primer lead de la lista automáticamente si no hay nada
  // elegido — con `seleccionar` (no un simple setSeleccionadoId): en la
  // bandeja global el primer lead puede ser de otro negocio y sin el cambio
  // de empresa activa su detalle daría 404 en un bucle de reintentos.
  useEffect(() => {
    if (leads.length > 0 && !seleccionadoId) {
      seleccionar(leads[0]);
    }
  }, [leads, seleccionadoId, seleccionar]);

  useEffect(() => {
    if (!seleccionadoId) return;
    setEstadoLead("cargando");
    setVentaAbierta(false);
    setAccionError(null);
    cargarLead(seleccionadoId);
  }, [seleccionadoId, cargarLead]);

  // Polling: refresca la lista y, si hay un lead seleccionado, su detalle.
  // Si hay una acción en curso (enviando) no refrescamos el lead seleccionado
  // para no pisar el estado optimista mientras la acción todavía no terminó.
  usePolling(() => {
    cargarLista();
    if (seleccionadoId && !enviando) cargarLead(seleccionadoId);
  }, 10000);

  async function enviarRespuesta() {
    if (!seleccionadoId || !texto.trim() || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "responder", texto: texto.trim() });
    if (r.ok) {
      setTexto("");
      await cargarLead(seleccionadoId);
    } else {
      setAccionError(r.error ?? "No se pudo enviar la respuesta.");
    }
    setEnviando(false);
  }

  async function aprobarBorrador() {
    if (!seleccionadoId || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "aprobar_borrador" });
    if (r.ok) {
      await cargarLead(seleccionadoId);
    } else {
      setAccionError(r.error ?? "No se pudo aprobar el borrador.");
    }
    setEnviando(false);
  }

  async function registrarVenta() {
    if (!seleccionadoId || enviando) return;
    const monto = Number(montoVenta);
    if (!montoVenta || Number.isNaN(monto) || monto <= 0) {
      setAccionError("Ingresá un monto válido.");
      return;
    }
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "marcar_ganado", monto });
    if (r.ok) {
      setVentaAbierta(false);
      setMontoVenta("");
      await cargarLead(seleccionadoId);
      await cargarLista();
    } else {
      setAccionError(r.error ?? "No se pudo registrar la venta.");
    }
    setEnviando(false);
  }

  if (!listo) return null;

  const listaVacia = estadoLista === "ok" && leads.length === 0;

  return (
    <div className="flex min-h-full flex-col">
      {/* Mobile (<lg): solo la lista, a ancho completo. Tocar un lead navega
          a /conversacion/[id] (el TarjetaLead ya es un Link). */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:hidden">
        {estadoLista === "cargando" && <SkeletonLista filas={5} />}
        {estadoLista === "error" && (
          <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="font-semibold text-tinta">No pudimos cargar tus conversaciones. Recargá.</p>
          </div>
        )}
        {listaVacia && (
          <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <p className="text-[1.05rem] font-bold text-tinta">
              Aún no tenés conversaciones. Conectá WhatsApp para empezar
            </p>
            <Link
              href="/configuracion"
              className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition active:scale-[0.99]"
            >
              Conectar WhatsApp
            </Link>
          </div>
        )}
        {estadoLista === "ok" &&
          leads.map((l) => (
            // onClickCapture corre antes de la navegación del Link: cambia la
            // empresa activa a la del lead para que /conversacion/[id] cargue.
            <div
              key={l.id}
              onClickCapture={() => {
                if (l.tenantId !== leerEmpresaActiva()) guardarEmpresaActiva(l.tenantId);
              }}
            >
              <TarjetaLead lead={aTarjeta(l, cantidadNegocios > 1)} />
            </div>
          ))}
      </div>

      {/* Desktop (lg+): 3 columnas */}
      <div className="hidden flex-1 overflow-hidden lg:grid lg:grid-cols-[320px_1fr_300px]">
        {/* Columna 1: lista de leads. Acá el clic selecciona (no navega), por
            eso interceptamos el click del Link con preventDefault. */}
        <div className="flex flex-col gap-2.5 overflow-y-auto border-r border-linea p-3">
          {estadoLista === "cargando" && <SkeletonLista filas={5} />}
          {estadoLista === "error" && (
            <div className="rounded-tarjeta bg-carta p-4 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <p className="text-[0.9rem] font-semibold text-tinta">No pudimos cargar la lista.</p>
            </div>
          )}
          {listaVacia && (
            <div className="rounded-tarjeta bg-carta p-4 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <p className="text-[0.9rem] font-bold text-tinta">
                Aún no tenés conversaciones. Conectá WhatsApp para empezar
              </p>
              <Link
                href="/configuracion"
                className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-4 py-2 text-[0.85rem] font-semibold text-carta transition active:scale-[0.99]"
              >
                Conectar WhatsApp
              </Link>
            </div>
          )}
          {estadoLista === "ok" &&
            leads.map((l) => {
              const activo = l.id === seleccionadoId;
              return (
                <div
                  key={l.id}
                  onClick={(e) => {
                    e.preventDefault();
                    seleccionar(l);
                  }}
                  className={activo ? "rounded-tarjeta ring-2 ring-brasa" : ""}
                >
                  <TarjetaLead lead={aTarjeta(l, cantidadNegocios > 1)} />
                </div>
              );
            })}
        </div>

        {/* Columna 2: chat */}
        <div className="flex min-w-0 flex-col overflow-hidden bg-arena">
          {estadoLead === "cargando" && <SkeletonChat />}
          {estadoLead === "error" && (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-frio">
              No pudimos cargar esta conversación.
            </div>
          )}
          {estadoLead === "ok" && lead ? (
            <>
              {/* Resumen de la IA */}
              {lead.resumenIA && (
                <section className="border-b border-linea bg-tibio-suave/60 px-4 py-3">
                  <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-tibio">
                    Lo que la IA entendió
                  </p>
                  <p className="text-[0.9rem] text-tinta">{lead.resumenIA}</p>
                </section>
              )}

              {/* Burbujas del chat */}
              <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {lead.mensajes.length === 0 && (
                  <p className="text-center text-frio">Todavía no hay mensajes en esta conversación.</p>
                )}
                {lead.mensajes.map((m) => (
                  <Burbuja key={m.id} m={aBurbuja(m)} />
                ))}

                {/* Borrador listo para enviar */}
                {lead.borradorIA && (
                  <div className="mt-2 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-brasa">
                      ✦ Respuesta lista para enviar
                    </p>
                    <button
                      onClick={() => editarBorrador(lead.borradorIA ?? "")}
                      className="w-full rounded-xl bg-arena/70 px-3 py-2.5 text-left text-[0.92rem] leading-snug text-tinta-2 ring-1 ring-linea transition hover:bg-arena active:scale-[0.99]"
                    >
                      {lead.borradorIA}
                    </button>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-[0.72rem] text-frio">Tocá el texto para editarlo abajo antes de enviar</p>
                      <button
                        onClick={aprobarBorrador}
                        disabled={enviando}
                        className="shrink-0 rounded-chip bg-brasa px-3 py-1.5 text-[0.78rem] font-bold text-carta transition active:scale-[0.99] disabled:opacity-60"
                      >
                        o aprobar y enviar tal cual
                      </button>
                    </div>
                  </div>
                )}
              </main>

              {accionError && (
                <p className="px-4 pb-1 text-[0.8rem] font-semibold text-brasa">{accionError}</p>
              )}

              {/* Campo de envío */}
              <div className="border-t border-linea bg-carta px-3 py-2.5">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        enviarRespuesta();
                      }
                    }}
                    rows={1}
                    placeholder={dictado.soportado ? "Escribí o tocá 🎤 para hablar…" : "Escribí tu mensaje…"}
                    className="max-h-28 flex-1 resize-none rounded-2xl bg-arena px-3.5 py-2.5 text-[0.98rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                  />
                  {dictado.soportado && (
                    <button
                      type="button"
                      onClick={dictado.escuchando ? dictado.parar : dictado.empezar}
                      aria-label={dictado.escuchando ? "Detener dictado" : "Dictar por voz"}
                      title={dictado.escuchando ? "Tocá para parar" : "Hablá y lo escribo por vos"}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                        dictado.escuchando
                          ? "animate-pulse bg-brasa text-carta ring-4 ring-brasa/30"
                          : "bg-tinta text-carta"
                      }`}
                    >
                      <IconoMic className="h-6 w-6" />
                    </button>
                  )}
                  {texto.trim() && (
                    <button
                      aria-label="Enviar"
                      onClick={enviarRespuesta}
                      disabled={enviando}
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brasa text-carta disabled:opacity-60"
                    >
                      <IconoEnviar className="h-6 w-6" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : estadoLead === "ok" ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-frio">
              Elegí un lead de la lista para ver la conversación.
            </div>
          ) : null}
        </div>

        {/* Columna 3: contexto IA + acciones */}
        <div className="flex flex-col overflow-y-auto border-l border-linea p-4">
          {estadoLead === "ok" && lead ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[1.05rem] font-bold text-tinta">
                  {lead.nombre ?? lead.contactoExterno}
                </h2>
                <ChipTemp t={lead.nivelInteres} />
              </div>
              <p className="mt-0.5 text-[0.8rem] text-frio">{lead.contactoExterno}</p>

              <div className="mt-4 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-tibio">
                  Contexto IA
                </p>
                <p className="text-[0.85rem] text-tinta">
                  {lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead."}
                </p>
                <p className="mt-2 text-[0.75rem] text-frio">
                  Actualizado {haceTexto(minutosDesde(lead.actualizadoEn))}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                {lead.estado === "ganado" ? (
                  <div className="rounded-tarjeta bg-ok/10 p-3.5 ring-1 ring-ok/30">
                    <p className="text-[0.9rem] font-bold text-ok">✓ Venta registrada</p>
                    <p className="text-[0.8rem] text-tinta-2">La verás en Reportes.</p>
                  </div>
                ) : ventaAbierta ? (
                  <div className="flex flex-col gap-2 rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
                    <label className="text-[0.8rem] font-bold text-tinta-2">Monto de la venta (S/)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoVenta}
                      onChange={(e) => setMontoVenta(e.target.value)}
                      placeholder="0.00"
                      className="rounded-xl bg-arena px-3 py-2 text-[0.95rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                    />
                    {comisionCalc !== null && (
                      <p className="text-[0.82rem] text-tinta-2">
                        Tu comisión: <b className="text-ok">S/{comisionCalc.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</b>
                        <span className="text-frio"> (según tu config)</span>
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={registrarVenta}
                        disabled={enviando}
                        className="flex-1 rounded-chip bg-ok py-2 text-[0.85rem] font-bold text-carta transition active:scale-[0.99] disabled:opacity-60"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => {
                          setVentaAbierta(false);
                          setMontoVenta("");
                        }}
                        className="flex-1 rounded-chip bg-arena-2 py-2 text-[0.85rem] font-bold text-tinta-2 transition active:scale-[0.99]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setVentaAbierta(true)}
                    className="rounded-chip border-2 border-ok/40 bg-carta py-2.5 text-[0.9rem] font-bold text-ok transition active:scale-[0.99]"
                  >
                    Registrar venta
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-frio">Sin conversación seleccionada.</p>
          )}
        </div>
      </div>
    </div>
  );
}
