"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, esModoGlobal, guardarEmpresaActiva, leerSesion } from "@/lib/auth";
import { SkeletonLista, SkeletonChat } from "@/components/Skeletons";
import {
  listarLeads,
  listarBandejaGlobal,
  obtenerLead,
  accionLead,
  actualizarLead,
  calcularComision,
  obtenerEtapas,
  obtenerEquipo,
  etapaVisibleDe,
  ETAPAS_DEFAULT,
  type MiembroEquipo,
  type EtapaEmbudo,
  type Lead,
  type LeadDetalle,
  type Mensaje as MensajeApi,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { BarraNegociosGlobal } from "@/components/panel/GlobalNegocios";
import type { NegocioBandeja } from "@/lib/api";
import { useDictado } from "@/lib/useDictado";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { Burbuja } from "@/components/Burbuja";
import { ChipTemp } from "@/components/ChipTemp";
import { IconoMic, IconoEnviar } from "@/components/Iconos";
import type { Mensaje as MensajeUI } from "@/lib/tipos";
import { useCapacidades } from "@/lib/modo-negocio";

type Estado = "cargando" | "ok" | "error";

// En modo global cada lead trae de qué negocio viene; en modo empresa esos
// campos van `undefined` y todo se comporta como siempre.
type LeadLista = Lead & { tenantId?: string; negocioNombre?: string };

// Color de cada etapa (tokens curados del design system) → clase del punto.
const PUNTO: Record<EtapaEmbudo["color"], string> = {
  brasa: "bg-brasa",
  tibio: "bg-tibio",
  calor: "bg-calor",
  ok: "bg-ok",
  frio: "bg-frio",
};

const NOMBRE_CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  tiktok: "TikTok",
  externo: "Manual",
};

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

// Adapta el Lead real (lib/api) al shape mínimo que TarjetaLead necesita.
// La etiqueta del negocio solo con 2+ negocios (con uno solo es ruido —
// auditoría responsive 2026-07-23).
function aTarjeta(lead: LeadLista, conEtiqueta: boolean): TarjetaLeadProps {
  return {
    id: lead.id,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    empresa: conEtiqueta ? lead.negocioNombre : undefined,
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

// Pantalla principal del panel (rediseño 2026-08-04, referencia Clinera):
// bandeja con embudo + buscador | chat con toggle del chatbot | ficha del
// contacto. En mobile se muestra solo la lista; tocar un lead navega a la
// conversación de la app (misma ruta que la fuerza de ventas en el teléfono).
export default function ConversacionesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

  const [estadoLista, setEstadoLista] = useState<Estado>("cargando");
  const [leads, setLeads] = useState<LeadLista[]>([]);
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  // Filtros de la bandeja: negocio ("" = todos), buzón (todos/míos/sin
  // asignar), etapa (id custom; "" = todas) y búsqueda.
  const [filtroNegocio, setFiltroNegocio] = useState("");
  const [filtroBuzon, setFiltroBuzon] = useState<"" | "mios" | "sin">("");
  const [filtroEtapa, setFiltroEtapa] = useState("");
  const [busqueda, setBusqueda] = useState("");
  // Etapas del negocio: las de la bandeja siguen al filtro de negocio (en
  // "Todos" del modo global se usan las default — cada negocio tiene las
  // suyas y no se pueden mezclar); las de la ficha siguen al lead elegido.
  // Un RESTAURANTE no tiene embudo (2026-08-19): sus contactos son gente que
  // pide comida, no leads que se califican. Lo de captación se oculta.
  // Cada bloque de abajo pregunta por la capacidad que le corresponde, no por
  // "¿es restaurante?". Son preguntas distintas: el embudo es de quien mueve
  // contactos por etapas, la temperatura de quien los califica. Una clínica
  // dice que NO al embudo —el estado de su paciente es la CITA— pero SÍ a
  // calificar, y con un solo booleano se le escondían las dos.
  const negocio = useCapacidades();
  const caps = negocio?.capacidades ?? null;
  const modoPedidos = negocio === null ? null : negocio.modoPedidos;
  const [etapasBandeja, setEtapasBandeja] = useState<EtapaEmbudo[]>(ETAPAS_DEFAULT);
  const [etapasFicha, setEtapasFicha] = useState<EtapaEmbudo[]>(ETAPAS_DEFAULT);
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const miUsuarioId = leerSesion()?.usuario?.id ?? null;
  // Tono del compositor (aplica al Asistente IA y a Corregir).
  const [tono, setTono] = useState<"" | "formal" | "cercano" | "directo" | "alegre">("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [etiquetaNueva, setEtiquetaNueva] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  // Tenant del lead seleccionado (solo en modo global): viaja explícito en
  // obtenerLead/accionLead/calcularComision, SIN cambiar la empresa activa —
  // así el usuario sigue en la vista global mientras chatea.
  const [tenantSel, setTenantSel] = useState<string | undefined>(undefined);

  const [estadoLead, setEstadoLead] = useState<Estado>("cargando");
  const [lead, setLead] = useState<LeadDetalle | null>(null);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [notaEdit, setNotaEdit] = useState<string | null>(null); // null = no editando
  const [descartarConfirm, setDescartarConfirm] = useState(false);
  const [copiado, setCopiado] = useState(false);
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
    const t = setTimeout(() => { calcularComision(monto, tenantSel).then(setComisionCalc); }, 350);
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
      // Modo global: conversaciones de TODOS los negocios de captación con su
      // etiqueta. Modo empresa: solo la activa, como siempre.
      if (esModoGlobal()) {
        const r = await listarBandejaGlobal();
        setLeads(r.leads);
        setNegocios(r.negocios);
      } else {
        setLeads(await listarLeads());
      }
      setEstadoLista("ok");
    } catch (e) {
      void e;
      setEstadoLista("error");
    }
  }, []);

  const cargarLead = useCallback(async (id: string, tenant?: string) => {
    try {
      const r = await obtenerLead(id, tenant);
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

  // Selección desde la columna izquierda (desktop). En modo global guarda
  // también el tenant del lead para las llamadas del chat.
  const seleccionar = useCallback((l: LeadLista) => {
    setTenantSel(l.tenantId);
    setSeleccionadoId(l.id);
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargarLista();
  }, [listo, cargarLista]);

  // Selecciona el primer lead de la lista automáticamente si no hay nada
  // elegido (vía `seleccionar`: en modo global también fija su tenant).
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
    setNotaEdit(null);
    setDescartarConfirm(false);
    cargarLead(seleccionadoId, tenantSel);
  }, [seleccionadoId, tenantSel, cargarLead]);

  // Etapas de la BANDEJA: siguen al filtro de negocio. En "Todos" del modo
  // global no hay un negocio concreto → default del motor.
  useEffect(() => {
    if (!listo) return;
    if (esModoGlobal() && !filtroNegocio) {
      setEtapasBandeja(ETAPAS_DEFAULT);
      return;
    }
    obtenerEtapas(filtroNegocio || undefined).then(setEtapasBandeja);
    setFiltroEtapa(""); // las etapas de otro negocio no aplican al filtro viejo
  }, [listo, filtroNegocio]);

  // Etapas de la FICHA + miembros del equipo: los del negocio del lead elegido.
  useEffect(() => {
    if (!listo) return;
    obtenerEtapas(tenantSel).then(setEtapasFicha);
    obtenerEquipo(tenantSel).then((r) => setMiembros(r.miembros));
  }, [listo, tenantSel]);

  // Polling: refresca la lista y, si hay un lead seleccionado, su detalle.
  // Si hay una acción en curso (enviando) no refrescamos el lead seleccionado
  // para no pisar el estado optimista mientras la acción todavía no terminó.
  // 4s: que el mensaje entrante y la respuesta del bot se sientan EN VIVO
  // (con 10s la conversación se percibía congelada — feedback 2026-08-04).
  usePolling(() => {
    cargarLista();
    if (seleccionadoId && !enviando && notaEdit === null) cargarLead(seleccionadoId, tenantSel);
  }, 4000);

  async function enviarRespuesta() {
    if (!seleccionadoId || !texto.trim() || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "responder", texto: texto.trim() }, tenantSel);
    if (r.ok) {
      setTexto("");
      await cargarLead(seleccionadoId, tenantSel);
    } else {
      setAccionError(r.error ?? "No se pudo enviar la respuesta.");
    }
    setEnviando(false);
  }

  async function aprobarBorrador() {
    if (!seleccionadoId || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "aprobar_borrador" }, tenantSel);
    if (r.ok) {
      await cargarLead(seleccionadoId, tenantSel);
    } else {
      setAccionError(r.error ?? "No se pudo aprobar el borrador.");
    }
    setEnviando(false);
  }

  // "Asistente IA" del compositor: pide un borrador al motor y lo deja en el
  // campo de texto para editar antes de enviar (gasta 1 respuesta de IA).
  async function pedirSugerencia() {
    if (!seleccionadoId || sugiriendo) return;
    setSugiriendo(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "sugerir_respuesta", ...(tono ? { tono } : {}) }, tenantSel);
    if (r.ok && r.borrador) {
      editarBorrador(r.borrador);
    } else {
      setAccionError(r.error ?? "No se pudo generar la sugerencia.");
    }
    setSugiriendo(false);
  }

  // "Corregir": la IA reescribe lo que el humano tiene en el campo (ortografía,
  // claridad, tono elegido) y lo deja listo para revisar antes de enviar.
  async function corregir() {
    if (!seleccionadoId || !texto.trim() || corrigiendo) return;
    setCorrigiendo(true);
    setAccionError(null);
    const r = await accionLead(
      seleccionadoId,
      { tipo: "corregir_texto", texto: texto.trim(), ...(tono ? { tono } : {}) },
      tenantSel,
    );
    if (r.ok && r.texto) {
      editarBorrador(r.texto);
    } else {
      setAccionError(r.error ?? "No se pudo corregir el texto.");
    }
    setCorrigiendo(false);
  }

  // Etiquetas del contacto (chips de la ficha).
  async function guardarEtiquetas(nuevas: string[]) {
    if (!seleccionadoId) return;
    const r = await actualizarLead(seleccionadoId, { etiquetas: nuevas });
    if (r.ok) await cargarLead(seleccionadoId, tenantSel);
    else setAccionError("No se pudieron guardar las etiquetas.");
  }

  // Chatbot ON/OFF de ESTA conversación (optimista: el toggle cambia al toque).
  async function alternarBot() {
    if (!lead || togglingBot) return;
    const pausar = !lead.botPausado;
    setTogglingBot(true);
    setLead({ ...lead, botPausado: pausar });
    const r = await accionLead(lead.id, { tipo: pausar ? "pausar_bot" : "activar_bot" }, tenantSel);
    if (!r.ok) {
      setLead({ ...lead, botPausado: !pausar });
      setAccionError(r.error ?? "No se pudo cambiar el chatbot.");
    }
    setTogglingBot(false);
  }

  // Mover a una etapa PERSONALIZADA del negocio (el backend sincroniza el
  // estado del motor mapeado).
  async function moverEtapa(etapaId: string) {
    if (!seleccionadoId || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "mover_etapa", etapaId }, tenantSel);
    if (r.ok) {
      await Promise.all([cargarLead(seleccionadoId, tenantSel), cargarLista()]);
    } else {
      setAccionError(r.error ?? "No se pudo mover de etapa.");
    }
    setEnviando(false);
  }

  // Asignar la conversación a un miembro (o soltar con null).
  async function asignarA(usuarioId: string | null) {
    if (!lead || enviando) return;
    setEnviando(true);
    const r = await accionLead(lead.id, { tipo: "asignar", asignarA: usuarioId }, tenantSel);
    if (r.ok) {
      await Promise.all([cargarLead(lead.id, tenantSel), cargarLista()]);
    } else {
      setAccionError(r.error ?? "No se pudo cambiar la asignación.");
    }
    setEnviando(false);
  }

  async function descartar() {
    if (!seleccionadoId || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "descartar" }, tenantSel);
    if (r.ok) {
      setDescartarConfirm(false);
      await Promise.all([cargarLead(seleccionadoId, tenantSel), cargarLista()]);
    } else {
      setAccionError(r.error ?? "No se pudo descartar.");
    }
    setEnviando(false);
  }

  async function guardarNota() {
    if (!seleccionadoId || notaEdit === null) return;
    const r = await actualizarLead(seleccionadoId, { nota: notaEdit.trim() || null });
    if (r.ok) {
      setNotaEdit(null);
      await cargarLead(seleccionadoId, tenantSel);
    } else {
      setAccionError("No se pudo guardar la nota.");
    }
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
    const r = await accionLead(seleccionadoId, { tipo: "marcar_ganado", monto }, tenantSel);
    if (r.ok) {
      setVentaAbierta(false);
      setMontoVenta("");
      await cargarLead(seleccionadoId, tenantSel);
      await cargarLista();
    } else {
      setAccionError(r.error ?? "No se pudo registrar la venta.");
    }
    setEnviando(false);
  }

  function copiarContacto() {
    if (!lead) return;
    navigator.clipboard?.writeText(lead.contactoExterno).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  if (!listo) return null;

  const listaVacia = estadoLista === "ok" && leads.length === 0;
  // Filtros en cliente: negocio → etapa → búsqueda (los contadores del embudo
  // se calculan DESPUÉS del filtro de negocio, para que cuadren con lo visible).
  const porNegocio = filtroNegocio
    ? leads.filter((l) => l.tenantId === filtroNegocio)
    : leads;
  // Buzón (estilo Clinera): Todos / Míos (asignados a mí) / Sin asignar.
  const porBuzon = porNegocio.filter((l) =>
    filtroBuzon === "mios" ? l.asignadoA === miUsuarioId
    : filtroBuzon === "sin" ? !l.asignadoA
    : true,
  );
  const conteoBuzon = {
    todos: porNegocio.length,
    mios: porNegocio.filter((l) => l.asignadoA === miUsuarioId).length,
    sin: porNegocio.filter((l) => !l.asignadoA).length,
  };
  // Contadores por etapa VISIBLE (custom del negocio filtrado, o default).
  const conteoEtapa = (id: string) =>
    porBuzon.filter((l) => etapaVisibleDe(l, etapasBandeja).id === id).length;
  const q = busqueda.trim().toLowerCase();
  const leadsVisibles = porBuzon
    .filter((l) => (filtroEtapa ? etapaVisibleDe(l, etapasBandeja).id === filtroEtapa : true))
    .filter((l) =>
      q
        ? (l.nombre ?? "").toLowerCase().includes(q) || l.contactoExterno.toLowerCase().includes(q)
        : true,
    );

  // Bandeja (columna 1 desktop / pantalla completa mobile): buscador + embudo +
  // chips de negocio + tarjetas. `enMobile` cambia el destino del clic.
  const bandeja = (enMobile: boolean) => (
    <>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        className="w-full rounded-xl bg-carta px-3.5 py-2 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
      />

      {/* Embudo con contadores: clic filtra por etapa (clic de nuevo = quitar) */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setFiltroEtapa("")}
          className={`rounded-chip px-2.5 py-1 text-[0.75rem] font-bold transition ${
            filtroEtapa === "" ? "bg-tinta text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
          }`}
        >
          Todos {porNegocio.length}
        </button>
        {etapasBandeja.map((e) => (
          <button
            key={e.id}
            onClick={() => setFiltroEtapa(filtroEtapa === e.id ? "" : e.id)}
            className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[0.75rem] font-bold transition ${
              filtroEtapa === e.id ? "bg-tinta text-carta" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[e.color]}`} />
            {e.nombre} {conteoEtapa(e.id)}
          </button>
        ))}
      </div>

      <BarraNegociosGlobal
        negocios={negocios}
        enfocado={filtroNegocio}
        onElegir={setFiltroNegocio}
        todosLabel="Todos"
      />
      {estadoLista === "cargando" && <SkeletonLista filas={5} />}
      {estadoLista === "error" && (
        <div className="rounded-tarjeta bg-carta p-4 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[0.9rem] font-semibold text-tinta">No pudimos cargar la lista. Recargá.</p>
        </div>
      )}
      {listaVacia && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[0.95rem] font-bold text-tinta">
            Aún no tenés conversaciones. Conectá WhatsApp para empezar
          </p>
          <Link
            href="/configuracion"
            className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-4 py-2 text-[0.85rem] font-semibold text-sobre-brasa transition active:scale-[0.99]"
          >
            Conectar WhatsApp
          </Link>
        </div>
      )}
      {estadoLista === "ok" && !listaVacia && leadsVisibles.length === 0 && (
        <p className="px-1 py-3 text-center text-[0.85rem] text-frio">
          Nada por acá con esos filtros.
        </p>
      )}
      {estadoLista === "ok" &&
        leadsVisibles.map((l) => {
          const activo = !enMobile && l.id === seleccionadoId;
          return (
            <div
              key={l.id}
              // Desktop: CAPTURA (no bubble) — el preventDefault corre ANTES
              // del onClick interno del <Link> de TarjetaLead; en bubble el
              // Link ya navegó. Mobile: navega (adoptando la empresa del lead).
              onClickCapture={(e) => {
                if (enMobile) {
                  if (l.tenantId) guardarEmpresaActiva(l.tenantId);
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                seleccionar(l);
              }}
              className={activo ? "rounded-tarjeta ring-2 ring-brasa" : ""}
            >
              <TarjetaLead lead={aTarjeta(l, negocios.length > 1)} />
            </div>
          );
        })}
    </>
  );

  // Colores del avatar por temperatura (mismo lenguaje visual del Inicio).
  const AVATAR: Record<string, string> = { caliente: "bg-calor", tibio: "bg-tibio", frio: "bg-frio" };

  return (
    // h-full (no min-h): la pantalla se ancla al alto de la ventana y cada
    // columna scrollea POR DENTRO — el compositor queda siempre a la vista.
    <div className="flex h-full flex-col overflow-hidden">
      {/* Mobile (<lg): solo la bandeja, a ancho completo. */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4 lg:hidden">{bandeja(true)}</div>

      {/* Desktop (lg+): negocios ARRIBA + [Buzón | Conversaciones | Chat | Ficha]
          — estructura de la referencia (2026-08-04). */}
      <div className="hidden flex-1 flex-col overflow-hidden lg:flex">
        {/* Barra superior: los negocios, para no comerse la bandeja */}
        {negocios.length > 1 && (
          <div className="border-b border-linea bg-carta px-4 py-2">
            <BarraNegociosGlobal
              negocios={negocios}
              enfocado={filtroNegocio}
              onElegir={setFiltroNegocio}
              todosLabel="Todos"
            />
          </div>
        )}

        <div className="grid flex-1 overflow-hidden lg:grid-cols-[210px_300px_1fr_290px]">
          {/* Columna 1: BUZÓN — etapas del embudo en vertical con contadores */}
          <div className="flex flex-col gap-1 overflow-y-auto border-r border-linea bg-carta p-3">
            <p className="px-2 pb-1 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
              Buzón
            </p>
            {([
              ["", "Todos", conteoBuzon.todos],
              ["mios", "Míos", conteoBuzon.mios],
              ["sin", "Sin asignar", conteoBuzon.sin],
            ] as const).map(([id, label, n]) => (
              <button
                key={id || "todos"}
                onClick={() => setFiltroBuzon(id)}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold transition ${
                  filtroBuzon === id ? "bg-brasa/10 text-brasa" : "text-tinta-2 hover:bg-arena"
                }`}
              >
                <span>{label}</span>
                <span className="text-[0.78rem] tabular-nums">{n}</span>
              </button>
            ))}
            {/* El EMBUDO es de quien mueve contactos por etapas: "En
                seguimiento", "Escalados", "Ganados" y "Perdidos" son etapas de
                una venta que se trabaja, no de un pedido de comida ni de una
                cita que ya está agendada. */}
            {caps?.tieneEmbudo && (
              <p className="px-2 pb-1 pt-3 text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                Etapas del embudo
              </p>
            )}
            {caps?.tieneEmbudo && etapasBandeja.map((e) => (
              <button
                key={e.id}
                onClick={() => setFiltroEtapa(filtroEtapa === e.id ? "" : e.id)}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold transition ${
                  filtroEtapa === e.id ? "bg-brasa/10 text-brasa" : "text-tinta-2 hover:bg-arena"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${PUNTO[e.color]}`} />
                  {e.nombre}
                </span>
                <span className="text-[0.78rem] tabular-nums">{conteoEtapa(e.id)}</span>
              </button>
            ))}
          </div>

          {/* Columna 2: CONVERSACIONES — buscador + filas compactas */}
          <div className="flex flex-col overflow-hidden border-r border-linea">
            <div className="border-b border-linea p-2.5">
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar conversación…"
                className="w-full rounded-xl bg-arena px-3 py-2 text-[0.85rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {estadoLista === "cargando" && <div className="p-3"><SkeletonLista filas={6} /></div>}
              {estadoLista === "error" && (
                <p className="p-4 text-center text-[0.85rem] font-semibold text-tinta">
                  No pudimos cargar la lista. Recargá.
                </p>
              )}
              {listaVacia && (
                <div className="p-4 text-center">
                  <p className="text-[0.9rem] font-bold text-tinta">
                    Aún no tenés conversaciones.
                  </p>
                  <Link
                    href="/configuracion"
                    className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-4 py-2 text-[0.85rem] font-semibold text-sobre-brasa"
                  >
                    Conectar WhatsApp
                  </Link>
                </div>
              )}
              {estadoLista === "ok" && !listaVacia && leadsVisibles.length === 0 && (
                <p className="p-4 text-center text-[0.85rem] text-frio">Nada por acá con esos filtros.</p>
              )}
              {estadoLista === "ok" &&
                leadsVisibles.map((l) => {
                  const activo = l.id === seleccionadoId;
                  const inicial = (l.nombre ?? l.contactoExterno).trim().charAt(0).toUpperCase() || "?";
                  const et = etapaVisibleDe(l, etapasBandeja);
                  return (
                    <button
                      key={l.id}
                      onClick={() => seleccionar(l)}
                      className={`flex w-full items-start gap-2.5 border-b border-linea/60 px-3 py-2.5 text-left transition ${
                        activo ? "bg-brasa/10" : "hover:bg-arena/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.9rem] font-bold text-carta ${AVATAR[l.nivelInteres] ?? "bg-frio"}`}
                      >
                        {inicial}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[0.88rem] font-bold text-tinta">
                            {l.nombre ?? l.contactoExterno}
                          </span>
                          <span className="shrink-0 text-[0.7rem] text-frio">
                            {haceTexto(minutosDesde(l.actualizadoEn))}
                          </span>
                        </span>
                        {/* El resumen solo donde la IA lo genera: en pedidos
                            no se genera nunca y la fila decía "Sin resumen
                            todavía" para siempre — una línea de ruido en cada
                            conversación. Ahí simplemente no se muestra. */}
                        {caps?.redactaResumenes && (
                          <span className="mt-0.5 block truncate text-[0.78rem] text-tinta-2">
                            {l.resumenIA ?? "Sin resumen todavía"}
                          </span>
                        )}
                        <span className="mt-1 flex items-center gap-1.5 text-[0.7rem] font-semibold text-frio">
                          {caps?.tieneEmbudo && (
                            <>
                              <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[et.color]}`} />
                              {et.nombre}
                            </>
                          )}
                          {negocios.length > 1 && l.negocioNombre ? (
                            <span className="truncate">
                              {caps?.tieneEmbudo && "· "}{l.negocioNombre}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Columna 3: chat */}
        <div className="flex min-w-0 flex-col overflow-hidden bg-arena">
          {estadoLead === "cargando" && <SkeletonChat />}
          {estadoLead === "error" && (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-frio">
              No pudimos cargar esta conversación.
            </div>
          )}
          {estadoLead === "ok" && lead ? (
            <>
              {/* Header del chat: quién es + etapa + toggle del chatbot */}
              <header className="flex items-center justify-between gap-3 border-b border-linea bg-carta px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[0.98rem] font-bold text-tinta">
                      {lead.nombre ?? lead.contactoExterno}
                    </p>
                    <p className="flex items-center gap-1.5 text-[0.75rem] text-frio">
                      {/* La ETAPA solo donde hay embudo: si no, el canal alcanza. */}
                      {caps?.tieneEmbudo && (
                        <>
                          <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[etapaVisibleDe(lead, etapasFicha).color]}`} />
                          {etapaVisibleDe(lead, etapasFicha).nombre}
                          <span aria-hidden>·</span>
                        </>
                      )}
                      <span>{NOMBRE_CANAL[lead.canalOrigen] ?? lead.canalOrigen}</span>
                    </p>
                  </div>
                  {/* La TEMPERATURA es de quien CALIFICA: un cliente que
                      pide comida no está "frío" ni "caliente", está pidiendo.
                      Una clínica sí califica —hay que saber quién viene a
                      consulta—, así que ella lo conserva. */}
                  {caps?.calificaLeads && <ChipTemp t={lead.nivelInteres} />}
                </div>
                <button
                  onClick={alternarBot}
                  disabled={togglingBot}
                  title={
                    lead.botPausado
                      ? "Lidia está en pausa en este chat: lo atendés vos. Tocá para reactivarla."
                      : "Lidia responde sola en este chat. Tocá para tomarlo vos."
                  }
                  className={`flex shrink-0 items-center gap-2 rounded-chip px-3 py-1.5 text-[0.78rem] font-bold transition active:scale-[0.98] ${
                    lead.botPausado
                      ? "bg-arena-2 text-tinta-2 ring-1 ring-linea"
                      : "bg-brasa text-carta"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${lead.botPausado ? "bg-frio" : "bg-carta animate-pulse"}`}
                  />
                  {lead.botPausado ? "Chatbot OFF" : "Chatbot ON"}
                </button>
              </header>

              {/* Aviso cuando el humano tomó el chat */}
              {lead.botPausado && (
                <p className="border-b border-linea bg-arena-2/70 px-4 py-1.5 text-[0.75rem] font-semibold text-tinta-2">
                  Estás atendiendo esta conversación — Lidia no responde hasta que la reactives.
                </p>
              )}

              {/* Burbujas del chat */}
              <main className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {lead.mensajes.length === 0 && (
                  <p className="text-center text-frio">Todavía no hay mensajes en esta conversación.</p>
                )}
                {lead.mensajes.map((m) => (
                  <div key={m.id}>
                    <Burbuja m={aBurbuja(m)} />
                    {m.direccion === "saliente" && m.estado === "fallido" && (
                      <p className="mt-0.5 text-right text-[0.72rem] font-semibold text-calor">
                        ⚠️ No se pudo entregar — revisá el canal en Configuración
                      </p>
                    )}
                  </div>
                ))}

                {/* Borrador listo para enviar */}
                {lead.borradorIA && (
                  <div className="mt-2 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-brasa-texto">
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
                        className="shrink-0 rounded-chip bg-brasa px-3 py-1.5 text-[0.78rem] font-bold text-sobre-brasa transition active:scale-[0.99] disabled:opacity-60"
                      >
                        o aprobar y enviar tal cual
                      </button>
                    </div>
                  </div>
                )}
              </main>

              {accionError && (
                <p className="px-4 pb-1 text-[0.8rem] font-semibold text-brasa-texto">{accionError}</p>
              )}

              {/* Compositor en DOS filas: herramientas de IA arriba (compactas),
                  campo de escribir abajo a TODO el ancho. */}
              <div className="space-y-2 border-t border-linea bg-carta px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={pedirSugerencia}
                    disabled={sugiriendo}
                    title="La IA escribe un borrador con todo el contexto; lo editás antes de enviar"
                    className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-tibio-suave px-3 text-[0.78rem] font-bold text-tibio ring-1 ring-tibio/30 transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
                  >
                    ✦ {sugiriendo ? "Pensando…" : "Asistente IA"}
                  </button>
                  <select
                    value={tono}
                    onChange={(e) => setTono(e.target.value as typeof tono)}
                    title="Tono del Asistente IA y de Corregir"
                    className="h-8 shrink-0 rounded-full bg-arena px-2 text-[0.76rem] font-semibold text-tinta-2 outline-none ring-1 ring-linea"
                  >
                    <option value="">Tono del negocio</option>
                    <option value="formal">Formal</option>
                    <option value="cercano">Cercano</option>
                    <option value="directo">Directo</option>
                    <option value="alegre">Alegre</option>
                  </select>
                  {texto.trim() && (
                    <button
                      type="button"
                      onClick={corregir}
                      disabled={corrigiendo}
                      title="La IA corrige ortografía y claridad de lo que escribiste (con el tono elegido)"
                      className="flex h-8 shrink-0 items-center rounded-full px-2.5 text-[0.78rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena active:scale-[0.98] disabled:opacity-60"
                    >
                      {corrigiendo ? "Corrigiendo…" : "✓ Corregir"}
                    </button>
                  )}
                </div>
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
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brasa text-sobre-brasa disabled:opacity-60"
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

        {/* Columna 4: ficha del contacto */}
        <div className="flex flex-col gap-4 overflow-y-auto border-l border-linea p-4">
          {estadoLead === "ok" && lead ? (
            <>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[1.05rem] font-bold text-tinta">
                    {lead.nombre ?? lead.contactoExterno}
                  </h2>
                  {/* La TEMPERATURA es de quien CALIFICA: un cliente que
                      pide comida no está "frío" ni "caliente", está pidiendo.
                      Una clínica sí califica —hay que saber quién viene a
                      consulta—, así que ella lo conserva. */}
                  {caps?.calificaLeads && <ChipTemp t={lead.nivelInteres} />}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-[0.82rem] text-frio">{lead.contactoExterno}</p>
                  <button
                    onClick={copiarContacto}
                    className="rounded-chip bg-arena px-2 py-0.5 text-[0.7rem] font-bold text-tinta-2 ring-1 ring-linea transition active:scale-[0.97]"
                  >
                    {copiado ? "✓ Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="mt-1 text-[0.75rem] text-frio">
                  {NOMBRE_CANAL[lead.canalOrigen] ?? lead.canalOrigen}
                  {(lead as LeadLista).negocioNombre ? ` · ${(lead as LeadLista).negocioNombre}` : ""}
                  {lead.origenEtiqueta ? ` · vino de: ${lead.origenEtiqueta}` : ""}
                </p>
              </div>

              {/* Etapa del embudo (las del NEGOCIO, personalizables en
                  Configuración → Tu negocio). Mover acá sincroniza el motor.

                  Solo donde hay embudo: quien pide comida no pasa por uno, y
                  el selector invitaba a mover a "Ganado"/"Perdido" a alguien
                  que solo pidió una hamburguesa. */}
              {caps?.tieneEmbudo && (
              <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">
                  Etapa del embudo
                </p>
                <select
                  value={etapaVisibleDe(lead, etapasFicha).id}
                  onChange={(e) => {
                    if (e.target.value) moverEtapa(e.target.value);
                  }}
                  disabled={enviando}
                  className="w-full rounded-xl bg-arena px-3 py-2 text-[0.9rem] font-semibold text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                >
                  {etapasFicha.map((e) => (
                    <option key={e.id} value={e.id}>{e.nombre}</option>
                  ))}
                </select>
              </div>
              )}

              {/* Asignación (Buzón: Míos / Sin asignar) — con nombres reales */}
              <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">
                  Asignación
                </p>
                <div className="flex items-center gap-2">
                  <select
                    value={lead.asignadoA ?? ""}
                    onChange={(e) => asignarA(e.target.value || null)}
                    disabled={enviando}
                    className="w-full flex-1 rounded-xl bg-arena px-3 py-2 text-[0.88rem] font-semibold text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                  >
                    <option value="">Sin asignar</option>
                    {miembros.map((m) => (
                      <option key={m.usuarioId} value={m.usuarioId}>
                        {(m.nombre ?? m.email) + (m.usuarioId === miUsuarioId ? " (yo)" : "")}
                      </option>
                    ))}
                    {lead.asignadoA && !miembros.some((m) => m.usuarioId === lead.asignadoA) && (
                      <option value={lead.asignadoA}>Miembro anterior</option>
                    )}
                  </select>
                  {lead.asignadoA !== miUsuarioId && miUsuarioId && (
                    <button
                      onClick={() => asignarA(miUsuarioId)}
                      disabled={enviando}
                      className="shrink-0 rounded-chip bg-brasa px-3 py-1.5 text-[0.78rem] font-bold text-sobre-brasa transition active:scale-[0.98] disabled:opacity-60"
                    >
                      Tomarla yo
                    </button>
                  )}
                </div>
              </div>

              {/* Etiquetas del contacto (chips, estilo Clinera) */}
              <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-frio">
                  Etiquetas
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(lead.etiquetas ?? []).map((et) => (
                    <span
                      key={et}
                      className="flex items-center gap-1 rounded-chip bg-brasa/10 px-2 py-0.5 text-[0.75rem] font-bold text-brasa-texto"
                    >
                      {et}
                      <button
                        onClick={() => guardarEtiquetas((lead.etiquetas ?? []).filter((x) => x !== et))}
                        aria-label={`Quitar ${et}`}
                        className="text-brasa-texto/60 hover:text-brasa-texto"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {(lead.etiquetas ?? []).length < 10 && (
                    <input
                      value={etiquetaNueva}
                      onChange={(e) => setEtiquetaNueva(e.target.value.slice(0, 20))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && etiquetaNueva.trim()) {
                          const nueva = etiquetaNueva.trim();
                          if (!(lead.etiquetas ?? []).includes(nueva)) {
                            guardarEtiquetas([...(lead.etiquetas ?? []), nueva]);
                          }
                          setEtiquetaNueva("");
                        }
                      }}
                      placeholder="＋ agregar y Enter"
                      className="w-32 rounded-chip bg-arena px-2 py-0.5 text-[0.75rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                    />
                  )}
                </div>
              </div>

              {/* Contexto IA, solo donde se REDACTA (2026-08-19): en pedidos
                  las respuestas son determinísticas y nunca se genera un
                  resumen, así que el bloque mostraba "todavía no hay resumen"
                  para siempre. */}
              {caps?.redactaResumenes && (
              <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-wide text-tibio">
                  Lo que la IA entendió
                </p>
                <p className="text-[0.85rem] text-tinta">
                  {lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead."}
                </p>
                <p className="mt-2 text-[0.75rem] text-frio">
                  Actualizado {haceTexto(minutosDesde(lead.actualizadoEn))}
                </p>
              </div>
              )}

              {/* Nota privada de la vendedora */}
              <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
                    Tu nota (privada)
                  </p>
                  {notaEdit === null && (
                    <button
                      onClick={() => setNotaEdit(lead.nota ?? "")}
                      className="text-[0.75rem] font-bold text-brasa-texto"
                    >
                      {lead.nota ? "Editar" : "Agregar"}
                    </button>
                  )}
                </div>
                {notaEdit === null ? (
                  <p className="text-[0.85rem] text-tinta-2">
                    {lead.nota ?? "Sin nota. El cliente nunca la ve."}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={notaEdit}
                      onChange={(e) => setNotaEdit(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-xl bg-arena px-3 py-2 text-[0.85rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={guardarNota}
                        className="flex-1 rounded-chip bg-brasa py-1.5 text-[0.8rem] font-bold text-sobre-brasa active:scale-[0.99]"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setNotaEdit(null)}
                        className="flex-1 rounded-chip bg-arena-2 py-1.5 text-[0.8rem] font-bold text-tinta-2 active:scale-[0.99]"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Cierre: venta / descartar. NO en restaurantes (2026-08-19):
                  la venta la registra el PEDIDO, no el dueño a mano, y
                  "descartar este lead" no tiene sentido con alguien que acaba
                  de pedir comida. */}
              {!modoPedidos && (
              <div className="flex flex-col gap-2">
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

                {lead.estado !== "perdido" && lead.estado !== "ganado" && (
                  descartarConfirm ? (
                    <div className="flex gap-2">
                      <button
                        onClick={descartar}
                        disabled={enviando}
                        className="flex-1 rounded-chip bg-calor py-2 text-[0.82rem] font-bold text-carta active:scale-[0.99] disabled:opacity-60"
                      >
                        Sí, descartar
                      </button>
                      <button
                        onClick={() => setDescartarConfirm(false)}
                        className="flex-1 rounded-chip bg-arena-2 py-2 text-[0.82rem] font-bold text-tinta-2 active:scale-[0.99]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDescartarConfirm(true)}
                      className="rounded-chip py-2 text-[0.82rem] font-bold text-frio transition hover:text-alerta"
                    >
                      Descartar este lead
                    </button>
                  )
                )}
              </div>
              )}
            </>
          ) : (
            <p className="text-frio">Sin conversación seleccionada.</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
