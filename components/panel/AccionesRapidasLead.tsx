"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  accionLead, actualizarLead, claveEtiquetas, listarEtiquetas, obtenerEquipo, obtenerEtapas,
  type EtapaEmbudo, type Lead,
} from "@/lib/api";
import { leerEmpresaActiva, leerSesion } from "@/lib/auth";
import { hoyLima } from "@/lib/agenda";
import { accionParaEtapa } from "@/lib/crm-filtros";
import { etapaVisibleDe } from "@/lib/etapas";
import { telefonoDe } from "@/lib/enlaces";
import { useDatos } from "@/lib/useDatos";
import { AgendarReunion } from "@/components/agenda/AgendarReunion";
import { ProximoPaso } from "@/components/panel/ProximoPaso";

type LeadFila = Lead & { tenantId?: string; negocioNombre?: string };
type Vista = "menu" | "etapa" | "asignar" | "etiqueta";

/** Las etiquetas del vendedor: hasta 10, de hasta 20 letras (las mismas reglas de la ficha). */
const MAX_ETIQUETAS = 10;
const LARGO_ETIQUETA = 20;

/**
 * ACCIONES RÁPIDAS SIN ENTRAR A LA FICHA (CRM fase 2, 2026-10-13).
 *
 * Pedido de Jonathan: un CRM "fácil y que realmente sea ÚTIL". Para mover a
 * alguien de etapa, asignarlo o anotarle el próximo paso había que abrir su
 * chat, esperar que cargue y buscar el bloque en la ficha. Ahora, desde la
 * fila: WhatsApp, llamar, mover de etapa, asignar, etiquetar, agendar y
 * próximo paso.
 *
 * Es autosuficiente: pide las etapas, el equipo y las etiquetas de SU negocio
 * recién cuando se abre esa parte del menú (nada por fila al pintar la
 * lista). `onCambio` recibe lo que cambió para que la lista lo muestre al
 * instante; `onRecargar` para volver a pedir lo que el servidor calcula.
 */
export function AccionesRapidasLead({
  lead, conEtapas = true, onCambio, onRecargar, alPasar = false,
}: {
  lead: LeadFila;
  /** Solo donde hay embudo (un restaurante no mueve a nadie de etapa). */
  conEtapas?: boolean;
  onCambio?: (cambios: Partial<Lead>) => void;
  onRecargar?: () => void;
  /** Los íconos aparecen al pasar el mouse por la fila (`group`). */
  alPasar?: boolean;
}) {
  const tenant = lead.tenantId;
  const claveNegocio = tenant || leerEmpresaActiva() || "-";
  const tel = telefonoDe(lead.canalOrigen, lead.contactoExterno);
  const miUsuarioId = leerSesion()?.usuario?.id ?? null;
  const idLista = useId();
  const boton = useRef<HTMLButtonElement>(null);

  const [vista, setVista] = useState<Vista | null>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [etiquetaNueva, setEtiquetaNueva] = useState("");
  const [agendando, setAgendando] = useState(false);
  const [paso, setPaso] = useState(false);

  // Lo de su negocio, solo cuando se abre esa parte del menú (con caché compartida).
  const { datos: etapas } = useDatos<EtapaEmbudo[]>(
    vista === "etapa" ? `etapas-rapidas@${claveNegocio}` : null,
    () => obtenerEtapas(tenant),
    { maxEdadMs: 60_000 },
  );
  const { datos: equipo } = useDatos(
    vista === "asignar" ? `equipo@${claveNegocio}` : null,
    () => obtenerEquipo(tenant),
    { maxEdadMs: 60_000 },
  );
  const { datos: etiquetasUso } = useDatos(
    vista === "etiqueta" ? claveEtiquetas(tenant) : null,
    () => listarEtiquetas(tenant),
    { maxEdadMs: 60_000 },
  );

  // El menú va FLOTANDO sobre la página (portal): dentro de una columna con
  // scroll quedaba cortado. Se abre hacia abajo, o hacia arriba si no entra.
  function abrir() {
    const r = boton.current?.getBoundingClientRect();
    if (r) {
      const right = Math.max(8, window.innerWidth - r.right);
      setPos(r.bottom + 380 > window.innerHeight && r.top > 380
        ? { bottom: window.innerHeight - r.top + 4, right }
        : { top: r.bottom + 4, right });
    }
    setError(null);
    setVista("menu");
  }
  function cerrar() {
    setVista(null);
    setEtiquetaNueva("");
  }

  // Escape cierra; un scroll de la página también (el menú quedaría flotando lejos de su fila).
  useEffect(() => {
    if (!vista) return;
    const alTeclado = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    const alScroll = () => cerrar();
    window.addEventListener("keydown", alTeclado);
    window.addEventListener("scroll", alScroll, true);
    return () => {
      window.removeEventListener("keydown", alTeclado);
      window.removeEventListener("scroll", alScroll, true);
    };
  }, [vista]);

  async function hacer(trabajo: () => Promise<{ ok: boolean; error?: string }>, cambios: Partial<Lead>, falla: string) {
    if (ocupado) return;
    setOcupado(true);
    setError(null);
    const r = await trabajo();
    setOcupado(false);
    if (!r.ok) {
      setError(r.error ?? falla);
      return;
    }
    onCambio?.(cambios);
    onRecargar?.();
    cerrar();
  }

  function moverA(et: EtapaEmbudo) {
    void hacer(
      () => accionLead(lead.id, accionParaEtapa(et, true), tenant),
      { estado: et.motor, etapaEmbudo: et.id },
      "No se pudo mover de etapa.",
    );
  }

  function asignar(usuarioId: string | null) {
    void hacer(
      () => accionLead(lead.id, { tipo: "asignar", asignarA: usuarioId }, tenant),
      { asignadoA: usuarioId },
      "No se pudo cambiar la asignación.",
    );
  }

  function guardarEtiquetas(nuevas: string[]) {
    void hacer(
      () => actualizarLead(lead.id, { etiquetas: nuevas }, tenant),
      { etiquetas: nuevas },
      "No se pudieron guardar las etiquetas.",
    );
  }

  const actuales = lead.etiquetas ?? [];
  function agregarEtiqueta(nombre: string) {
    const e = nombre.replace(/\s+/g, " ").trim().slice(0, LARGO_ETIQUETA);
    if (!e) return;
    if (actuales.some((x) => x.toLowerCase() === e.toLowerCase())) { setEtiquetaNueva(""); return; }
    guardarEtiquetas([...actuales, e]);
  }

  const visible = alPasar ? "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100" : "";
  const icono = "grid h-8 w-8 min-h-0 shrink-0 place-items-center rounded-full bg-carta text-[0.9rem] ring-1 ring-linea transition hover:bg-arena";
  const item = "flex min-h-0 w-full items-center gap-2 px-3 py-2 text-left text-[0.84rem] font-semibold text-tinta transition hover:bg-arena disabled:opacity-60";
  const etapaActual = etapas ? etapaVisibleDe(lead, etapas).id : null;

  const menu = vista && pos && (
    <>
      <div className="fixed inset-0 z-40" onClick={cerrar} aria-hidden />
      <div
        role="menu"
        aria-label={`Acciones para ${lead.nombre ?? lead.contactoExterno}`}
        style={{ top: pos.top, bottom: pos.bottom, right: pos.right }}
        className="fixed z-50 max-h-[22rem] w-64 overflow-y-auto rounded-xl bg-carta py-1 shadow-[var(--sombra-flotante)] ring-1 ring-linea"
        onClick={(e) => e.stopPropagation()}
      >
        {vista === "menu" && (
          <>
            {tel && (
              <a role="menuitem" href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" onClick={cerrar} className={item}>
                💬 Abrir su WhatsApp
              </a>
            )}
            {tel && (
              <a role="menuitem" href={`tel:+${tel}`} onClick={cerrar} className={item}>📞 Llamar</a>
            )}
            {conEtapas && (
              <button type="button" role="menuitem" onClick={() => setVista("etapa")} className={item}>➡️ Mover de etapa…</button>
            )}
            <button type="button" role="menuitem" onClick={() => setVista("asignar")} className={item}>👤 Asignar…</button>
            <button type="button" role="menuitem" onClick={() => setVista("etiqueta")} className={item}>🏷️ Etiquetar…</button>
            <button type="button" role="menuitem" onClick={() => { cerrar(); setAgendando(true); }} className={item}>📅 Agendar reunión</button>
            <button type="button" role="menuitem" onClick={() => { cerrar(); setPaso(true); }} className={item}>🗓️ Próximo paso</button>
          </>
        )}

        {vista !== "menu" && (
          <button type="button" onClick={() => { setVista("menu"); setError(null); }} className="min-h-0 px-3 pb-1 pt-1.5 text-[0.75rem] font-bold text-brasa-texto hover:underline">
            ← Volver
          </button>
        )}

        {vista === "etapa" && (
          !etapas ? <p className="px-3 py-2 text-[0.8rem] text-frio">Cargando etapas…</p> : etapas.map((et) => (
            <button
              key={et.id}
              type="button"
              role="menuitemradio"
              aria-checked={et.id === etapaActual}
              disabled={ocupado || et.id === etapaActual}
              onClick={() => moverA(et)}
              className={item}
            >
              {et.id === etapaActual ? "✓" : "•"} {et.nombre}
            </button>
          ))
        )}

        {vista === "asignar" && (
          <>
            {miUsuarioId && lead.asignadoA !== miUsuarioId && (
              <button type="button" role="menuitem" disabled={ocupado} onClick={() => asignar(miUsuarioId)} className={item}>🙋 Tomarlo yo</button>
            )}
            {lead.asignadoA && (
              <button type="button" role="menuitem" disabled={ocupado} onClick={() => asignar(null)} className={item}>Dejarlo sin asignar</button>
            )}
            {!equipo ? (
              <p className="px-3 py-2 text-[0.8rem] text-frio">Cargando el equipo…</p>
            ) : equipo.miembros.filter((m) => m.usuarioId !== miUsuarioId).map((m) => (
              <button
                key={m.usuarioId}
                type="button"
                role="menuitemradio"
                aria-checked={lead.asignadoA === m.usuarioId}
                disabled={ocupado || lead.asignadoA === m.usuarioId}
                onClick={() => asignar(m.usuarioId)}
                className={item}
              >
                {lead.asignadoA === m.usuarioId ? "✓" : "•"} {m.nombre ?? m.email}
              </button>
            ))}
          </>
        )}

        {vista === "etiqueta" && (
          <div className="space-y-2 px-3 pb-2">
            {actuales.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {actuales.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-chip bg-brasa/10 px-2 py-0.5 text-[0.72rem] font-bold text-brasa-texto">
                    {e}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => guardarEtiquetas(actuales.filter((x) => x !== e))}
                      aria-label={`Quitar la etiqueta ${e}`}
                      className="min-h-0 text-brasa-texto/60 hover:text-brasa-texto"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {actuales.length < MAX_ETIQUETAS ? (
              <>
                <input
                  autoFocus
                  value={etiquetaNueva}
                  list={idLista}
                  disabled={ocupado}
                  onChange={(e) => {
                    const v = e.target.value;
                    if ((etiquetasUso ?? []).some((x) => x.nombre === v)) agregarEtiqueta(v);
                    else setEtiquetaNueva(v.slice(0, LARGO_ETIQUETA));
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarEtiqueta(etiquetaNueva); } }}
                  placeholder="Escribe y Enter"
                  aria-label="Etiqueta nueva"
                  className="w-full rounded-lg bg-arena px-2.5 py-1.5 text-[0.84rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                />
                <datalist id={idLista}>
                  {(etiquetasUso ?? [])
                    .filter((x) => !actuales.some((a) => a.toLowerCase() === x.nombre.toLowerCase()))
                    .slice(0, 40)
                    .map((x) => <option key={x.nombre} value={x.nombre.slice(0, LARGO_ETIQUETA)} />)}
                </datalist>
              </>
            ) : (
              <p className="text-[0.78rem] text-frio">Ya tiene 10 etiquetas: quita una para sumar otra.</p>
            )}
          </div>
        )}

        {error && <p role="alert" className="px-3 pb-2 text-[0.78rem] font-semibold text-alerta">{error}</p>}
      </div>
    </>
  );

  return (
    <div className={`flex shrink-0 items-center gap-1 ${visible}`} onClick={(e) => e.stopPropagation()}>
      {tel && (
        <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir su WhatsApp" title="Abrir su WhatsApp" className={icono}>
          💬
        </a>
      )}
      {tel && (
        <a href={`tel:+${tel}`} aria-label="Llamar" title="Llamar" className={icono}>📞</a>
      )}
      <button
        ref={boton}
        type="button"
        onClick={(e) => { e.preventDefault(); if (vista) cerrar(); else abrir(); }}
        aria-haspopup="menu"
        aria-expanded={!!vista}
        aria-label="Más acciones"
        title="Mover de etapa, asignar, etiquetar, agendar, próximo paso"
        className={`${icono} font-bold text-tinta-2`}
      >
        ⋯
      </button>
      {menu && typeof document !== "undefined" ? createPortal(menu, document.body) : null}

      {agendando && (
        <AgendarReunion
          dia={hoyLima()}
          hora=""
          variosNegocios={false}
          colores={new Map()}
          lead={{
            id: lead.id,
            tenantId: tenant ?? leerEmpresaActiva() ?? "",
            negocio: lead.negocioNombre ?? "",
            nombre: lead.nombre,
            telefono: tel,
            canal: lead.canalOrigen,
          }}
          onCerrar={() => setAgendando(false)}
          onAgendada={(c) => {
            setAgendando(false);
            onCambio?.({ proximaCitaEn: c.inicio });
            onRecargar?.();
          }}
        />
      )}

      {paso && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/40 p-4 backdrop-blur-sm" onClick={() => setPaso(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Próximo paso con ${lead.nombre ?? "este cliente"}`}
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[0.95rem] font-bold text-carta">{lead.nombre ?? lead.contactoExterno}</p>
            <ProximoPaso
              leadId={lead.id}
              tenant={tenant}
              nombre={lead.nombre}
              tarea={null}
              abrirFormulario
              onCambio={() => {
                setPaso(false);
                onRecargar?.();
              }}
            />
            <button type="button" onClick={() => setPaso(false)} className="mt-2 w-full rounded-chip bg-carta/90 py-2 text-[0.82rem] font-semibold text-tinta-2">
              Cerrar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
