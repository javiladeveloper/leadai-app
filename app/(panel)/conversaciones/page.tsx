"use client";

import { OrigenLead } from "@/components/panel/OrigenLead";
import { VentaLead } from "@/components/panel/VentaLead";
import { CierreLead } from "@/components/panel/CierreLead";
import { NotaLead } from "@/components/panel/NotaLead";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  haySesion, esModoGlobal, guardarEmpresaActiva, leerSesion, filtroInicialDeBandeja, leerEmpresaActiva,
  empresasVisibles, puedeAbrirConversacion,
} from "@/lib/auth";
import { SkeletonLista, SkeletonChat } from "@/components/Skeletons";
import {
  obtenerLead,
  paginaLeads,
  paginaBandejaGlobal,
  accionLead,
  actualizarLead,
  reiniciarLead,
  obtenerEtapas,
  obtenerEquipo,
  obtenerFrasesRapidas,
  obtenerPerfil,
  tieneCanalActivo,
  etapaVisibleDe,
  ETAPAS_DEFAULT,
  type MiembroEquipo,
  type EtapaEmbudo,
  type Lead,
  type LeadDetalle,
  type CitaAgenda,
  type Mensaje as MensajeApi,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { BarraNegociosGlobal } from "@/components/panel/GlobalNegocios";
import type { NegocioBandeja } from "@/lib/api";
import { useDictado } from "@/lib/useDictado";
import { TarjetaLead, type TarjetaLeadProps } from "@/components/TarjetaLead";
import { Burbuja } from "@/components/Burbuja";
import { ChipTemp } from "@/components/ChipTemp";
import { IconoMic, IconoEnviar, IconoChevron } from "@/components/Iconos";
import { AdjuntarMedia } from "@/components/AdjuntarMedia";
import { AccionesContacto } from "@/components/AccionesContacto";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { AgendarReunion } from "@/components/agenda/AgendarReunion";
import { AvisoVentanaCerrada, ChipVentana } from "@/components/VentanaWhatsApp";
import { ventanaWhatsApp } from "@/lib/ventana-whatsapp";
import type { Mensaje as MensajeUI } from "@/lib/tipos";
import { useCapacidades } from "@/lib/modo-negocio";
import { MENSAJES_A_PEDIR, MENSAJES_SONDEO, MENSAJES_VISIBLES, tramoVisible, verAnteriores } from "@/lib/chat-tramos";
import { useChatAlFinal } from "@/lib/useChatAlFinal";
import { agregarPaginaVieja, horaDe, mezclarMensajesRecientes, mezclarPaginaReciente, separadorDeDia } from "@/lib/bandeja-rapida";
import { useEsEscritorio } from "@/lib/useEsEscritorio";
import { useDatos } from "@/lib/useDatos";
import { rutaPrevia, nombreDeRuta } from "@/lib/historial";
import { diaLima, hoyLima, horaLima, nombreDelDia } from "@/lib/agenda";
import { URL_CONECTAR_CANALES, telefonoDe } from "@/lib/enlaces";
import { ProximaCita } from "@/components/panel/ProximaCita";
import { PUNTO_ETAPA } from "@/lib/etapas";

type Estado = "cargando" | "ok" | "error" | "no-encontrado";

// En modo global cada lead trae de qué negocio viene; en modo empresa esos
// campos van `undefined` y todo se comporta como siempre.
type LeadLista = Lead & { tenantId?: string; negocioNombre?: string };

// Color de cada etapa: el mismo mapa que Seguimiento (lib/etapas.ts).
const PUNTO = PUNTO_ETAPA;

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
    tenant: lead.tenantId,
    nombre: lead.nombre ?? lead.contactoExterno,
    canal: lead.canalOrigen,
    empresa: conEtiqueta ? lead.negocioNombre : undefined,
    temperatura: lead.nivelInteres,
    urgente: lead.nivelInteres === "caliente" && lead.estado === "nuevo",
    resumenIA: lead.resumenIA ?? "Todavía no hay resumen de la IA para este lead.",
    haceMinutos: minutosDesde(lead.ultimoMensajeEn ?? lead.creadoEn),
  };
}

// Adapta un Mensaje real (lib/api: direccion/contenido/creadoEn) al shape que
// Burbuja espera (lib/tipos: autor/texto/haceMinutos). "saliente" es lo que
// mandamos nosotros (o la IA en automático) → se muestra a la derecha, "tu".
// "entrante" es lo que escribió el lead → izquierda.
/**
 * QUIÉN ESCRIBIÓ CADA SALIENTE (2026-09-22, pedido de Jonathan). Antes todo
 * saliente era "tu": el mensaje que mandaste desde tu celular y el que
 * respondió la IA se veían iguales, y en una conversación escalada nadie sabía
 * quién había dicho qué. El backend guarda `origen`: una persona (panel,
 * celular por coexistencia, o un borrador que aprobó) es "tu"; la IA y los
 * textos fijos son "bot". Sin origen (mensajes viejos) se deja como estaba.
 */
const ORIGENES_PERSONA = new Set(["humano", "ia_aprobada", "ia_editada"]);
function autorDe(m: { direccion: string; origen?: string | null }): MensajeUI["autor"] {
  if (m.direccion !== "saliente") return "lead";
  return !m.origen || ORIGENES_PERSONA.has(m.origen) ? "tu" : "bot";
}

function aBurbuja(m: MensajeApi): MensajeUI {
  return {
    id: m.id,
    autor: autorDe(m),
    texto: m.contenido,
    haceMinutos: minutosDesde(m.creadoEn),
    hora: horaDe(m.creadoEn),
    enviando: m.estado === "enviando",
  };
}

type Buzon = "" | "mios" | "sin";
const esBuzon = (v: string | null): v is Buzon => v === "" || v === "mios" || v === "sin";

/**
 * Busca un lead en los OTROS negocios de la persona (2026-10-09).
 *
 * Los avisos de WhatsApp del backend mandan links a /conversacion/{id}, sin
 * decir de qué negocio es. Con varios negocios, la empresa activa puede ser
 * otra y la ficha decía "No encontramos esta conversación" aunque existiera.
 * Antes de rendirse, se pregunta en cada uno de sus negocios.
 */
async function buscarEnOtrosNegocios(
  id: string,
  yaProbado: string | undefined,
): Promise<{ tenant: string; lead: LeadDetalle } | null> {
  const probado = yaProbado ?? leerEmpresaActiva() ?? undefined;
  for (const e of empresasVisibles()) {
    if (e.tenantId === probado) continue;
    try {
      const r = await obtenerLead(id, e.tenantId, MENSAJES_A_PEDIR);
      if (r) return { tenant: e.tenantId, lead: r };
    } catch {
      // Sin permiso en ese negocio, o caído: se sigue con el próximo.
    }
  }
  return null;
}

/**
 * CONVERSACIONES: LA ÚNICA FICHA DEL LEAD (rediseño 2026-08-04, unificada
 * 2026-10-09).
 *
 * Escritorio: bandeja con embudo + buscador | chat con toggle del chatbot |
 * ficha del contacto. Celular: la lista, y al tocar un lead el chat a pantalla
 * completa con "volver" y la ficha en una hoja.
 *
 * ANTES HABÍA DOS FICHAS (2026-10-09, pedido de Jonathan: "una sola ficha, con
 * todo"). `/conversacion/[id]` vivía fuera del panel —sin menú ni cabecera— y
 * le faltaba la mitad: etapa, asignación, etiquetas, bot ON/OFF, de dónde vino,
 * "Marcar que pagó". Los links de toda la web (Agenda, Reportes, Comentarios,
 * la campana) llevaban a esa versión recortada. Ahora todo llega acá con
 * `?lead=<id>` y `/conversacion/[id]` solo redirige (los avisos de WhatsApp del
 * backend siguen mandando ese link).
 *
 * LA URL ES LA FUENTE DE VERDAD de qué está abierto: `?lead=`, `?negocio=`,
 * `?etapa=`, `?buzon=` y `?asignado=`. Se puede compartir, y en el celular el
 * botón "atrás" del teléfono vuelve del chat a la lista.
 */
export default function ConversacionesPanel() {
  return (
    <Suspense fallback={null}>
      <ConversacionesInner />
    </Suspense>
  );
}

function ConversacionesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const leadParam = params.get("lead");
  const negocioParam = params.get("negocio");
  const esEscritorio = useEsEscritorio();
  const [listo, setListo] = useState(false);

  const [estadoLista, setEstadoLista] = useState<"cargando" | "ok" | "error">("cargando");
  const [leads, setLeads] = useState<LeadLista[]>([]);
  const [negocios, setNegocios] = useState<NegocioBandeja[]>([]);
  // Filtros de la bandeja: negocio ("" = todos), buzón (todos/míos/sin
  // asignar), etapa (id custom; "" = todas), asignado a alguien y búsqueda.
  const [filtroNegocio, setFiltroNegocio] = useState("");
  // ARRANCA EN EL PREDETERMINADO (2026-09-22, pedido de Jonathan: "si pongo
  // Sania por defecto, todo debe filtrar correctamente en todas las partes").
  // La bandeja abría siempre en "Todos"; ahora, si el dueño fijó un negocio,
  // abre filtrada por ese. Una sola vez: después manda el chip que toque. Si
  // el link trae el negocio del lead (`?negocio=`), manda ese: el lead que se
  // abrió tiene que verse en la lista.
  const filtroInicializado = useRef(false);
  useEffect(() => {
    if (filtroInicializado.current || negocios.length === 0) return;
    filtroInicializado.current = true;
    const delLink = negocioParam && negocios.some((n) => n.tenantId === negocioParam) ? negocioParam : null;
    setFiltroNegocio(delLink ?? filtroInicialDeBandeja(negocios, ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocios]);
  const [filtroBuzon, setFiltroBuzon] = useState<Buzon>(() => {
    const b = params.get("buzon");
    return esBuzon(b) ? b : "";
  });
  const [filtroEtapa, setFiltroEtapa] = useState(() => params.get("etapa") ?? "");
  // CONVERSACIONES DE UNA PERSONA DEL EQUIPO (2026-10-09): desde Equipo, "Ver
  // sus conversaciones" abre la bandeja filtrada por quién la tiene asignada.
  const [filtroAsignado, setFiltroAsignado] = useState(() => params.get("asignado") ?? "");
  // `?buscar=` (2026-10-09): el buscador del header manda acá cuando el
  // negocio no tiene lista de Leads (un restaurante). Si ya se está acá y se
  // busca otra cosa, la URL cambia y la búsqueda la sigue.
  const buscarParam = params.get("buscar");
  const [busqueda, setBusqueda] = useState(() => buscarParam ?? "");
  useEffect(() => {
    if (buscarParam !== null) setBusqueda(buscarParam);
  }, [buscarParam]);
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
  const [etapasBandeja, setEtapasBandeja] = useState<EtapaEmbudo[]>(ETAPAS_DEFAULT);
  const [etapasFicha, setEtapasFicha] = useState<EtapaEmbudo[]>(ETAPAS_DEFAULT);
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const miUsuarioId = leerSesion()?.usuario?.id ?? null;
  // Tono del compositor (aplica al Asistente IA y a Corregir).
  const [tono, setTono] = useState<"" | "formal" | "cercano" | "directo" | "alegre">("");
  const [corrigiendo, setCorrigiendo] = useState(false);
  const [etiquetaNueva, setEtiquetaNueva] = useState("");
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(leadParam);
  // Tenant del lead seleccionado (solo en modo global): viaja explícito en
  // obtenerLead/accionLead/calcularComision, SIN cambiar la empresa activa —
  // así el usuario sigue en la vista global mientras chatea.
  const [tenantSel, setTenantSel] = useState<string | undefined>(negocioParam ?? undefined);

  const [estadoLead, setEstadoLead] = useState<Estado>(leadParam ? "cargando" : "ok");
  const [lead, setLead] = useState<LeadDetalle | null>(null);

  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [reiniciarConfirm, setReiniciarConfirm] = useState(false);
  const [copiado, setCopiado] = useState(false);
  // Celular: la ficha abre como hoja sobre el chat.
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [agendando, setAgendando] = useState(false);
  const [agendada, setAgendada] = useState<CitaAgenda | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // El chat por tramos y abierto en el último mensaje (ver lib/chat-tramos.ts).
  const [mostrar, setMostrar] = useState(MENSAJES_VISIBLES);
  const pedidosRef = useRef(MENSAJES_A_PEDIR);
  const abiertoRef = useRef<string | null>(null);
  const chatRef = useRef<HTMLElement>(null);
  const finRef = useRef<HTMLDivElement>(null);
  // En el celular, si el chat se abrió desde la lista de acá mismo, "volver"
  // es simplemente atrás: la entrada anterior del historial es la lista.
  const abiertoDesdeLista = useRef(false);
  // A qué sección vuelve el "← Volver" de escritorio cuando se llegó con un
  // link (Agenda, Reportes…). Se lee una vez, al entrar.
  const [volverA] = useState(() => (leadParam ? nombreDeRuta(rutaPrevia("/conversaciones")) : null));
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
  const [accionError, setAccionError] = useState<string | null>(null);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // MARKETING NO ABRE CONVERSACIONES (2026-09-18): ve la lista de leads para
    // medir su publicidad, pero no los mensajes. Un link viejo o escrito a
    // mano lo dejaba frente a un 403; se lo manda a la lista.
    if (!puedeAbrirConversacion()) {
      router.replace("/leads");
      return;
    }
    setListo(true);
  }, [router]);

  /** Reescribe la URL con estos cambios, sin perder los demás parámetros. */
  const escribirUrl = useCallback((cambios: Record<string, string | null | undefined>, modo: "push" | "replace") => {
    const qs = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    const s = qs.toString();
    const url = `/conversaciones${s ? `?${s}` : ""}`;
    if (modo === "push") router.push(url, { scroll: false });
    else router.replace(url, { scroll: false });
  }, [router]);

  // ¿YA HAY UN WHATSAPP CONECTADO? (2026-08-27, Jonathan: "en mi
  // configuración ya tengo un WhatsApp conectado, ¿por qué cuando voy a
  // conversaciones me aparece nuevamente conectar WhatsApp?").
  //
  // El estado vacío ofrecía conectar SIEMPRE que no hubiera chats, sin mirar
  // si ya había canal. `undefined` = todavía no se sabe: hasta que responda no
  // se muestra ningún botón. Sigue al FILTRO DE NEGOCIO; sin filtro, la
  // empresa activa. Va por la caché compartida (lib/useDatos): las demás
  // secciones preguntan lo mismo.
  const { datos: tieneCanal } = useDatos(
    listo ? `tiene-canal@${filtroNegocio || leerEmpresaActiva() || "-"}` : null,
    () => tieneCanalActivo(filtroNegocio || undefined),
    { maxEdadMs: 60_000 },
  );

  // LA BANDEJA POR PÁGINAS (2026-09-25, ver lib/bandeja-rapida.ts): antes se
  // bajaban hasta 20 páginas en serie antes de mostrar nada, y otra vez en
  // cada sondeo de 4 s.
  // Modo global: conversaciones de TODOS los negocios de captación con su
  // etiqueta. Modo empresa: solo la activa, como siempre.
  const pedirPagina = useCallback(async (cursor: string | null, limite?: number) => {
    if (esModoGlobal()) {
      const r = await paginaBandejaGlobal(cursor, limite);
      setNegocios(r.negocios);
      return r as { items: LeadLista[]; siguienteCursor: string | null };
    }
    return (await paginaLeads(cursor, limite)) as { items: LeadLista[]; siguienteCursor: string | null };
  }, []);

  // Una carga completa nueva cancela la anterior (p. ej. al volver a entrar).
  const cargaRef = useRef(0);

  /** Todo: la primera página al toque y el resto detrás, sin bloquear. */
  const cargarLista = useCallback(async () => {
    const gen = ++cargaRef.current;
    try {
      let r = await pedirPagina(null);
      if (gen !== cargaRef.current) return;
      setLeads(r.items);
      setEstadoLista("ok");
      for (let pagina = 1; pagina < 20 && r.siguienteCursor; pagina++) {
        r = await pedirPagina(r.siguienteCursor);
        if (gen !== cargaRef.current) return;
        const nuevos = r.items;
        setLeads((prev) => agregarPaginaVieja(prev, nuevos));
      }
    } catch (e) {
      void e;
      if (gen === cargaRef.current) setEstadoLista((prev) => (prev === "ok" ? "ok" : "error"));
    }
  }, [pedirPagina]);

  /**
   * Sondeo y tras cada acción: solo lo que se movió. Una página CORTA (2026-10-05):
   * cada 4 s se bajaban 100 conversaciones enteras (~110 KB, ~2,5 s) para
   * enterarse de las dos o tres que cambiaron. Las demás ya están en pantalla.
   */
  const cargarReciente = useCallback(async () => {
    try {
      const r = await pedirPagina(null, 25);
      setLeads((prev) => mezclarPaginaReciente(prev, r.items));
      setEstadoLista("ok");
    } catch (e) {
      void e;
    }
  }, [pedirPagina]);

  // CAMBIAR DE CHAT AL INSTANTE (2026-09-25, mismo arreglo que Sania): lo ya
  // abierto se pinta desde memoria mientras se actualiza, y pasar el mouse por
  // una conversación la precarga.
  const cacheRef = useRef(new Map<string, LeadDetalle>());
  const guardarEnCache = useCallback((id: string, l: LeadDetalle) => {
    const cache = cacheRef.current;
    cache.delete(id);
    cache.set(id, l);
    if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  }, []);
  const precargar = useCallback((l: LeadLista) => {
    if (cacheRef.current.has(l.id)) return;
    void obtenerLead(l.id, l.tenantId, MENSAJES_A_PEDIR)
      .then((r) => { if (r) guardarEnCache(l.id, r); })
      .catch(() => {});
  }, [guardarEnCache]);

  const cargarLead = useCallback(async (id: string, tenant?: string) => {
    try {
      const r = await obtenerLead(id, tenant, pedidosRef.current);
      // Una respuesta lenta de OTRO chat no pisa al que está abierto (mismo
      // arreglo que la bandeja de Sania).
      if (r) guardarEnCache(id, r);
      if (abiertoRef.current && abiertoRef.current !== id) return;
      if (r) {
        setLead(r);
        setEstadoLead("ok");
        return;
      }
      // NO ESTÁ EN ESTE NEGOCIO: antes de decir "no existe", se busca en los
      // otros negocios de la persona (link de un aviso de WhatsApp, pestaña
      // nueva con otra empresa activa).
      const otro = await buscarEnOtrosNegocios(id, tenant);
      if (abiertoRef.current && abiertoRef.current !== id) return;
      if (otro) {
        guardarEnCache(id, otro.lead);
        guardarEmpresaActiva(otro.tenant);
        setTenantSel(otro.tenant);
        setLead(otro.lead);
        setEstadoLead("ok");
        return;
      }
      setLead(null);
      setEstadoLead("no-encontrado");
    } catch (e) {
      void e;
      if (abiertoRef.current && abiertoRef.current !== id) return;
      setEstadoLead("error");
    }
  }, [guardarEnCache]);

  /**
   * SONDEO DEL CHAT ABIERTO (2026-10-05): trae solo los últimos mensajes y los
   * pega a los que ya están (lib/bandeja-rapida.ts). Antes cada 4 s volvían a
   * bajar los últimos 150.
   */
  const cargarLeadSondeo = useCallback(async (id: string, tenant?: string) => {
    try {
      const r = await obtenerLead(id, tenant, MENSAJES_SONDEO);
      if (abiertoRef.current && abiertoRef.current !== id) return;
      if (!r) return; // un 404 en un sondeo no cierra el chat que ya se ve
      setLead((prev) => {
        const junto = prev && prev.id === id
          ? { ...r, mensajes: mezclarMensajesRecientes(prev.mensajes, r.mensajes) }
          : r;
        guardarEnCache(id, junto);
        return junto;
      });
      setEstadoLead("ok");
    } catch (e) {
      void e; // un sondeo fallido no tumba el chat que ya se ve
    }
  }, [guardarEnCache]);

  /**
   * Abrir un lead de la lista. En escritorio la URL se REEMPLAZA (cambiar de
   * chat no llena el historial); en el celular se EMPUJA, para que el "atrás"
   * del teléfono vuelva a la lista. `sinUrl`: la selección automática del
   * primer chat en escritorio, que no es una decisión del usuario.
   */
  const seleccionar = useCallback((l: LeadLista, opciones: { sinUrl?: boolean } = {}) => {
    setTenantSel(l.tenantId);
    setSeleccionadoId(l.id);
    if (opciones.sinUrl) return;
    if (!esEscritorio) abiertoDesdeLista.current = true;
    escribirUrl({ lead: l.id, negocio: l.tenantId ?? null }, esEscritorio ? "replace" : "push");
  }, [esEscritorio, escribirUrl]);

  // ATRÁS / ADELANTE DEL NAVEGADOR: la URL manda. Si cambia el `?lead=` sin
  // que lo haya cambiado esta pantalla (botón atrás del celular, un link de
  // otra sección con la página ya montada), se sigue a la URL.
  useEffect(() => {
    if (leadParam) {
      if (leadParam !== abiertoRef.current) {
        setSeleccionadoId(leadParam);
        setTenantSel(negocioParam ?? undefined);
      }
    } else if (!esEscritorio) {
      setSeleccionadoId(null);
      setFichaAbierta(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadParam, negocioParam]);

  useEffect(() => {
    if (!listo) return;
    cargarLista();
  }, [listo, cargarLista]);

  // Escritorio: si no hay nada elegido, se abre el primero de la lista (en el
  // celular no: ahí la pantalla ES la lista hasta que se toque uno).
  useEffect(() => {
    if (esEscritorio && leads.length > 0 && !seleccionadoId) {
      seleccionar(leads[0], { sinUrl: true });
    }
  }, [leads, seleccionadoId, seleccionar, esEscritorio]);

  useEffect(() => {
    if (!seleccionadoId || !listo) return;
    abiertoRef.current = seleccionadoId;
    pedidosRef.current = MENSAJES_A_PEDIR;
    setMostrar(MENSAJES_VISIBLES);
    const guardado = cacheRef.current.get(seleccionadoId);
    if (guardado) {
      setLead(guardado);
      setEstadoLead("ok");
    } else {
      setEstadoLead("cargando");
    }
    // El cierre (CierreLead) se remonta solo con `key={lead.id}`.
    setAccionError(null);
    setReiniciarConfirm(false);
    setAgendada(null);
    cargarLead(seleccionadoId, tenantSel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccionadoId, listo, cargarLead]);

  // Etapas de la BANDEJA: siguen al filtro de negocio. En "Todos" del modo
  // global no hay un negocio concreto → default del motor. La PRIMERA vez no
  // se limpia el filtro de etapa: puede venir del link (`?etapa=`).
  const primeraEtapas = useRef(true);
  useEffect(() => {
    if (!listo) return;
    const limpiar = !primeraEtapas.current;
    primeraEtapas.current = false;
    if (esModoGlobal() && !filtroNegocio) {
      setEtapasBandeja(ETAPAS_DEFAULT);
      return;
    }
    obtenerEtapas(filtroNegocio || undefined).then(setEtapasBandeja);
    if (limpiar) elegirEtapa(""); // las etapas de otro negocio no aplican al filtro viejo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, filtroNegocio]);

  // Etapas de la FICHA + miembros del equipo: los del negocio del lead elegido.
  useEffect(() => {
    if (!listo) return;
    obtenerEtapas(tenantSel).then(setEtapasFicha);
    obtenerEquipo(tenantSel).then((r) => setMiembros(r.miembros)).catch(() => setMiembros([]));
  }, [listo, tenantSel]);

  // Respuestas de un toque (las frases que más usa) y lo que ofrece el
  // negocio: del negocio del lead, y una vez por negocio (caché compartida).
  const claveNegocioFicha = tenantSel || leerEmpresaActiva() || "-";
  const { datos: frases } = useDatos(
    listo ? `frases@${claveNegocioFicha}` : null,
    () => obtenerFrasesRapidas(tenantSel),
    { maxEdadMs: 5 * 60_000 },
  );
  const { datos: perfil } = useDatos(
    listo ? `perfil@${claveNegocioFicha}` : null,
    () => obtenerPerfil(tenantSel).catch(() => null),
    { maxEdadMs: 5 * 60_000 },
  );

  // Polling: refresca la lista y, si hay un lead seleccionado, su detalle.
  // Si hay una acción en curso (enviando) no refrescamos el lead seleccionado
  // para no pisar el estado optimista mientras la acción todavía no terminó.
  // 4s: que el mensaje entrante y la respuesta del bot se sientan EN VIVO
  // (con 10s la conversación se percibía congelada — feedback 2026-08-04).
  usePolling(() => {
    if (!listo) return;
    cargarReciente();
    if (seleccionadoId && !enviando && estadoLead === "ok") cargarLeadSondeo(seleccionadoId, tenantSel);
  }, 4000);

  function elegirEtapa(id: string) {
    setFiltroEtapa(id);
    escribirUrl({ etapa: id || null }, "replace");
  }
  function elegirBuzon(id: Buzon) {
    setFiltroBuzon(id);
    escribirUrl({ buzon: id || null }, "replace");
  }
  function quitarAsignado() {
    setFiltroAsignado("");
    escribirUrl({ asignado: null }, "replace");
  }

  /**
   * "Volver" del chat en el celular. Si se abrió desde la lista de acá, atrás
   * (la lista está en el historial). Si se llegó desde otra sección, atrás
   * también: vuelve a esa sección. Si se entró directo (link de WhatsApp, F5),
   * no hay a dónde volver y se muestra la lista.
   */
  function volverDelChat() {
    if (abiertoDesdeLista.current || rutaPrevia("/conversaciones")) {
      router.back();
      return;
    }
    setSeleccionadoId(null);
    escribirUrl({ lead: null, negocio: null }, "replace");
  }

  async function enviarRespuesta() {
    if (!seleccionadoId || !texto.trim() || enviando) return;
    const escrito = texto.trim();
    setEnviando(true);
    setAccionError(null);
    // Se ve en el chat apenas se manda, sin esperar al servidor (2026-09-25).
    const provisional: MensajeApi = {
      id: `enviando-${Date.now()}`, direccion: "saliente", contenido: escrito,
      canal: lead?.canalOrigen ?? "whatsapp", creadoEn: new Date().toISOString(), origen: "humano", estado: "enviando",
    };
    setLead((l) => (l && l.id === seleccionadoId ? { ...l, mensajes: [...l.mensajes, provisional] } : l));
    setTexto("");
    const r = await accionLead(seleccionadoId, { tipo: "responder", texto: escrito }, tenantSel);
    if (r.ok) {
      await cargarLead(seleccionadoId, tenantSel);
    } else {
      setLead((l) => (l ? { ...l, mensajes: l.mensajes.filter((m) => m.id !== provisional.id) } : l));
      setTexto(escrito);
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
    const r = await actualizarLead(seleccionadoId, { etiquetas: nuevas }, tenantSel);
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

  // Reiniciar el chat (2026-08-20): dejar al lead como si escribiera por
  // primera vez — para probar el bot con el propio número. Borra la
  // conversación y cancela los pedidos vivos; las ventas cerradas quedan.
  async function reiniciarChat() {
    if (!lead || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await reiniciarLead(lead.id, tenantSel);
    if (r.ok) {
      setReiniciarConfirm(false);
      await Promise.all([cargarLead(lead.id, tenantSel), cargarReciente()]);
    } else {
      setAccionError(r.error ?? "No se pudo reiniciar el chat.");
    }
    setEnviando(false);
  }

  // Mover a una etapa PERSONALIZADA del negocio (el backend sincroniza el
  // estado del motor mapeado).
  async function moverEtapa(etapaId: string) {
    if (!seleccionadoId || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(seleccionadoId, { tipo: "mover_etapa", etapaId }, tenantSel);
    if (r.ok) {
      await Promise.all([cargarLead(seleccionadoId, tenantSel), cargarReciente()]);
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
      await Promise.all([cargarLead(lead.id, tenantSel), cargarReciente()]);
    } else {
      setAccionError(r.error ?? "No se pudo cambiar la asignación.");
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

  const leadAbierto = lead && lead.id === seleccionadoId ? lead : null;
  useChatAlFinal(seleccionadoId, leadAbierto?.mensajes.at(-1)?.id, finRef, chatRef);
  const tramo = leadAbierto ? tramoVisible(leadAbierto.mensajes, mostrar, leadAbierto.totalMensajes) : null;
  // La ventana de 24 h de WhatsApp (caso Edith): cerrada, el chat lo dice.
  const ventana = leadAbierto ? ventanaWhatsApp(leadAbierto, leadAbierto.ultimoEntranteEn) : null;
  const ventanaCerrada = Boolean(ventana && !ventana.abierta);

  /** "Ver mensajes anteriores": más de lo que llegó y, si no alcanza, más del backend. */
  async function cargarAnteriores() {
    if (!leadAbierto || !seleccionadoId) return;
    const r = verAnteriores({ mostrar, cargados: leadAbierto.mensajes.length, pedidos: pedidosRef.current, total: leadAbierto.totalMensajes });
    setMostrar(r.mostrar);
    if (r.pedir) {
      pedidosRef.current = r.pedir;
      await cargarLead(seleccionadoId, tenantSel);
    }
  }

  if (!listo) return null;

  const listaVacia = estadoLista === "ok" && leads.length === 0;
  // Filtros en cliente: negocio → buzón/asignado → etapa → búsqueda (los
  // contadores del embudo se calculan DESPUÉS del filtro de negocio, para que
  // cuadren con lo visible).
  const porNegocio = filtroNegocio
    ? leads.filter((l) => l.tenantId === filtroNegocio)
    : leads;
  // Buzón (estilo Clinera): Todos / Míos (asignados a mí) / Sin asignar.
  const porBuzon = porNegocio.filter((l) =>
    filtroAsignado ? l.asignadoA === filtroAsignado
    : filtroBuzon === "mios" ? l.asignadoA === miUsuarioId
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
  const nombreAsignado = filtroAsignado
    ? (() => {
        const m = miembros.find((x) => x.usuarioId === filtroAsignado);
        return m ? (m.nombre ?? m.email) : "esa persona";
      })()
    : "";
  const hayFiltros = !!(filtroEtapa || filtroBuzon || filtroAsignado || q);
  function quitarFiltros() {
    setBusqueda("");
    setFiltroEtapa("");
    setFiltroBuzon("");
    setFiltroAsignado("");
    escribirUrl({ etapa: null, buzon: null, asignado: null }, "replace");
  }

  // Estado vacío de la lista: con "Conectar WhatsApp" SOLO si no hay canal.
  const vacioLista = (compacto: boolean) => (
    <div className={compacto ? "p-4 text-center" : "rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"}>
      <p className={`font-bold text-tinta ${compacto ? "text-[0.9rem]" : "text-[0.95rem]"}`}>
        {tieneCanal === false
          ? "Aún no tienes conversaciones. Conecta WhatsApp para empezar"
          : "Aún no tienes conversaciones."}
      </p>
      {tieneCanal === true && (
        <p className="mt-1 text-[0.82rem] text-frio">
          Tu WhatsApp está conectado: los chats aparecen acá cuando te escriban.
        </p>
      )}
      {tieneCanal === false && (
        <Link
          href={URL_CONECTAR_CANALES}
          className="mt-3 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-4 py-2 text-[0.85rem] font-semibold text-sobre-brasa transition active:scale-[0.99]"
        >
          Conectar WhatsApp
        </Link>
      )}
    </div>
  );

  const sinResultados = (
    <div className="px-1 py-3 text-center">
      <p className="text-[0.85rem] text-frio">Ninguna conversación con estos filtros.</p>
      <button
        type="button"
        onClick={quitarFiltros}
        className="mt-2 rounded-chip bg-carta px-3 py-1.5 text-[0.78rem] font-bold text-brasa-texto ring-1 ring-linea transition hover:bg-arena"
      >
        Quitar filtros
      </button>
    </div>
  );

  const chipAsignado = filtroAsignado ? (
    <div className="flex items-center justify-between gap-2 rounded-chip bg-brasa-suave px-3 py-1.5 text-[0.78rem] font-semibold text-brasa-texto">
      <span className="truncate">Asignadas a {nombreAsignado}</span>
      <button type="button" onClick={quitarAsignado} aria-label="Quitar filtro de asignación" className="shrink-0 text-[1rem] leading-none">
        ×
      </button>
    </div>
  ) : null;

  // Bandeja del CELULAR: buscador + embudo + chips de negocio + tarjetas. Tocar
  // una tarjeta abre el chat acá mismo, a pantalla completa.
  const bandejaMovil = (
    <>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        className="w-full rounded-xl bg-carta px-3.5 py-2 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
      />

      {/* Embudo con contadores: clic filtra por etapa (clic de nuevo = quitar) */}
      {caps?.tieneEmbudo && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => elegirEtapa("")}
            className={`rounded-chip px-2.5 py-1 text-[0.75rem] font-bold transition ${
              filtroEtapa === "" ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea"
            }`}
          >
            Todos {porNegocio.length}
          </button>
          {etapasBandeja.map((e) => (
            <button
              key={e.id}
              onClick={() => elegirEtapa(filtroEtapa === e.id ? "" : e.id)}
              className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[0.75rem] font-bold transition ${
                filtroEtapa === e.id ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[e.color]}`} />
              {e.nombre} {conteoEtapa(e.id)}
            </button>
          ))}
        </div>
      )}

      <BarraNegociosGlobal
        negocios={negocios}
        enfocado={filtroNegocio}
        onElegir={setFiltroNegocio}
        todosLabel="Todos"
      />
      {chipAsignado}
      {estadoLista === "cargando" && <SkeletonLista filas={5} />}
      {estadoLista === "error" && (
        <ErrorConReintento mensaje="No pudimos cargar tus conversaciones." reintentar={() => { setEstadoLista("cargando"); void cargarLista(); }} />
      )}
      {listaVacia && vacioLista(false)}
      {estadoLista === "ok" && !listaVacia && leadsVisibles.length === 0 && sinResultados}
      {estadoLista === "ok" &&
        leadsVisibles.map((l) => (
          <div
            key={l.id}
            // CAPTURA (no bubble): el preventDefault corre ANTES del onClick
            // interno del <Link> de TarjetaLead, así el chat se abre acá
            // mismo (con su entrada en el historial) en vez de navegar.
            onClickCapture={(e) => {
              e.preventDefault();
              e.stopPropagation();
              seleccionar(l);
            }}
          >
            <TarjetaLead lead={aTarjeta(l, negocios.length > 1)} />
          </div>
        ))}
    </>
  );

  // Colores del avatar por temperatura (mismo lenguaje visual del Inicio).
  const AVATAR: Record<string, string> = { caliente: "bg-calor", tibio: "bg-tibio", frio: "bg-frio" };

  // ── EL CHAT (columna del medio en escritorio, pantalla entera en el celular) ──
  const vistaChat = (enMovil: boolean) => (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-arena">
      {estadoLead === "cargando" && (
        <>
          {enMovil && (
            <header className="flex items-center gap-2 border-b border-linea bg-carta px-2 py-2">
              <BotonVolver onClick={volverDelChat} />
              <span className="h-4 w-32 animate-pulse rounded bg-arena-2/70" />
            </header>
          )}
          <SkeletonChat />
        </>
      )}
      {estadoLead === "error" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
          {enMovil && <div className="self-start"><BotonVolver onClick={volverDelChat} /></div>}
          <ErrorConReintento
            mensaje="No pudimos cargar esta conversación."
            reintentar={() => { if (seleccionadoId) { setEstadoLead("cargando"); void cargarLead(seleccionadoId, tenantSel); } }}
          />
        </div>
      )}
      {estadoLead === "no-encontrado" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-semibold text-tinta">No encontramos esta conversación.</p>
          <p className="max-w-sm text-[0.85rem] text-frio">
            Puede que la hayan reiniciado, o que sea de un negocio al que ya no tienes acceso.
          </p>
          <button
            type="button"
            onClick={() => { setSeleccionadoId(null); setLead(null); setEstadoLead("ok"); escribirUrl({ lead: null, negocio: null }, "replace"); }}
            className="rounded-chip bg-tinta px-5 py-2.5 text-[0.88rem] font-bold text-carta"
          >
            Ver todas las conversaciones
          </button>
        </div>
      )}
      {estadoLead === "ok" && leadAbierto ? (
        <>
          {/* Header del chat: quién es + etapa + toggle del chatbot */}
          <header className="flex items-center justify-between gap-2 border-b border-linea bg-carta px-2 py-2 lg:px-4 lg:py-2.5">
            <div className="flex min-w-0 items-center gap-1.5 lg:gap-2.5">
              {enMovil && <BotonVolver onClick={volverDelChat} />}
              {!enMovil && volverA && (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="shrink-0 rounded-chip px-2 py-1 text-[0.75rem] font-bold text-brasa-texto transition hover:bg-arena"
                >
                  ← {volverA}
                </button>
              )}
              <button
                type="button"
                onClick={() => enMovil && setFichaAbierta(true)}
                className={`min-w-0 text-left ${enMovil ? "" : "cursor-default"}`}
                aria-label={enMovil ? "Ver la ficha del contacto" : undefined}
              >
                <p className="truncate text-[0.98rem] font-bold text-tinta">
                  {leadAbierto.nombre ?? leadAbierto.contactoExterno}
                </p>
                <p className="flex items-center gap-1.5 text-[0.75rem] text-frio">
                  {/* La ETAPA solo donde hay embudo: si no, el canal alcanza. */}
                  {caps?.tieneEmbudo && (
                    <>
                      <span className={`h-1.5 w-1.5 rounded-full ${PUNTO[etapaVisibleDe(leadAbierto, etapasFicha).color]}`} />
                      {etapaVisibleDe(leadAbierto, etapasFicha).nombre}
                      <span aria-hidden>·</span>
                    </>
                  )}
                  <span>{NOMBRE_CANAL[leadAbierto.canalOrigen] ?? leadAbierto.canalOrigen}</span>
                  {enMovil && <span className="font-semibold text-brasa-texto">· Ver ficha</span>}
                </p>
                {ventana && <span className="mt-1 block"><ChipVentana ventana={ventana} /></span>}
              </button>
              {/* La TEMPERATURA es de quien CALIFICA: un cliente que
                  pide comida no está "frío" ni "caliente", está pidiendo.
                  Una clínica sí califica —hay que saber quién viene a
                  consulta—, así que ella lo conserva. */}
              {caps?.calificaLeads && !enMovil && <ChipTemp t={leadAbierto.nivelInteres} />}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {enMovil && <AccionesContacto canal={leadAbierto.canalOrigen} contacto={leadAbierto.contactoExterno} compacto />}
              <button
                onClick={alternarBot}
                disabled={togglingBot}
                title={
                  leadAbierto.botPausado
                    ? "Lidia está en pausa en este chat: lo atiendes tú. Toca para reactivarla."
                    : "Lidia responde sola en este chat. Toca para tomarlo tú."
                }
                className={`flex shrink-0 items-center gap-2 rounded-chip px-3 py-1.5 text-[0.78rem] font-bold transition active:scale-[0.98] ${
                  leadAbierto.botPausado
                    ? "bg-arena-2 text-tinta-2 ring-1 ring-linea"
                    : "bg-brasa text-sobre-brasa"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${leadAbierto.botPausado ? "bg-frio" : "bg-sobre-brasa animate-pulse"}`}
                />
                {leadAbierto.botPausado ? (enMovil ? "Bot OFF" : "Chatbot OFF") : (enMovil ? "Bot ON" : "Chatbot ON")}
              </button>
            </div>
          </header>

          {/* Aviso cuando el humano tomó el chat */}
          {leadAbierto.botPausado && (
            <p className="border-b border-linea bg-arena-2/70 px-4 py-1.5 text-[0.75rem] font-semibold text-tinta-2">
              Estás atendiendo esta conversación — Lidia no responde hasta que la reactives.
            </p>
          )}

          {/* Celular: la próxima reunión arriba del chat, que es donde se mira. */}
          {enMovil && leadAbierto.proximaCita && (
            <div className="border-b border-linea bg-carta px-3 py-2">
              <ProximaCita cita={leadAbierto.proximaCita} compacta />
            </div>
          )}

          {/* Burbujas del chat */}
          <main ref={chatRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {leadAbierto.mensajes.length === 0 && (
              <p className="text-center text-frio">Todavía no hay mensajes en esta conversación.</p>
            )}
            {tramo && tramo.anteriores > 0 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => void cargarAnteriores()}
                  className="rounded-chip bg-carta px-3 py-1 text-[0.76rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
                >
                  ↑ Ver mensajes anteriores ({tramo.anteriores} más)
                </button>
              </div>
            )}
            {(tramo?.visibles ?? leadAbierto.mensajes).map((m, i, lista) => (
              <div key={m.id}>
                {separadorDeDia(m.creadoEn, lista[i - 1]?.creadoEn) && (
                  <p className="my-1 text-center">
                    <span className="rounded-full bg-carta px-3 py-0.5 text-[0.72rem] font-bold text-frio ring-1 ring-linea">
                      {separadorDeDia(m.creadoEn, lista[i - 1]?.creadoEn)}
                    </span>
                  </p>
                )}
                <Burbuja m={aBurbuja(m)} />
                {m.direccion === "saliente" && m.estado === "fallido" && (
                  <p className="mt-0.5 text-right text-[0.72rem] font-semibold text-calor">
                    ⚠️ {m.motivoFallo ?? "No se pudo entregar — revisa el canal en Configuración"}
                  </p>
                )}
              </div>
            ))}

            {/* Borrador listo para enviar */}
            {leadAbierto.borradorIA && (
              <div className="mt-2 rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-2 flex items-center gap-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-brasa-texto">
                  ✦ Respuesta lista para enviar
                </p>
                <button
                  onClick={() => editarBorrador(leadAbierto.borradorIA ?? "")}
                  className="w-full rounded-xl bg-arena/70 px-3 py-2.5 text-left text-[0.92rem] leading-snug text-tinta-2 ring-1 ring-linea transition hover:bg-arena active:scale-[0.99]"
                >
                  {leadAbierto.borradorIA}
                </button>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[0.72rem] text-frio">Toca el texto para editarlo abajo antes de enviar</p>
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
            <div ref={finRef} />
          </main>

          {accionError && (
            <p className="px-4 pb-1 text-[0.8rem] font-semibold text-brasa-texto">{accionError}</p>
          )}

          {/* Compositor en DOS filas: herramientas de IA arriba (compactas),
              campo de escribir abajo a TODO el ancho. */}
          {ventana && <AvisoVentanaCerrada ventana={ventana} />}
          <div className="space-y-2 border-t border-linea bg-carta px-3 py-2.5">
            {/* RESPUESTAS DE UN TOQUE (vivían solo en la ficha vieja,
                2026-10-09): las frases que más usa, para mandar sin escribir.
                Se esconden apenas hay texto: ahí estorban. */}
            {(frases?.length ?? 0) > 0 && !texto.trim() && !ventanaCerrada && (
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {frases!.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => editarBorrador(f.texto)}
                    className="shrink-0 rounded-chip bg-arena px-3 py-1 text-[0.78rem] font-medium text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2 hover:text-tinta"
                  >
                    {f.texto.length > 40 ? f.texto.slice(0, 38) + "…" : f.texto}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 overflow-x-auto">
              {/* "Asistente IA" solo donde la IA REDACTA (2026-08-19).
                  En un restaurante el bot no conversa: manda el link y el
                  cliente arma su pedido con botones en la carta web. El
                  borrador sería para una charla que no va a existir, y
                  además gasta de la misma bolsa con la que el bot lee las
                  capturas de pago.

                  "Corregir" (más abajo) SÍ queda para todos: corrige lo
                  que el dueño escribió a mano, y eso sirve en cualquier
                  rubro. */}
              {caps?.redactaRespuestas && (
              <button
                type="button"
                onClick={pedirSugerencia}
                disabled={sugiriendo}
                title="La IA escribe un borrador con todo el contexto; lo editas antes de enviar"
                className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-tibio-suave px-3 text-[0.78rem] font-bold text-tibio ring-1 ring-tibio/30 transition hover:brightness-95 active:scale-[0.98] disabled:opacity-60"
              >
                ✦ {sugiriendo ? "Pensando…" : "Asistente IA"}
              </button>
              )}
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
              <AdjuntarMedia
                leadId={leadAbierto.id}
                tenant={tenantSel}
                canal={leadAbierto.canalOrigen}
                caption={texto}
                bloqueado={ventanaCerrada ? "La ventana de WhatsApp está cerrada: no le va a llegar" : undefined}
                alEnviar={() => { setTexto(""); if (seleccionadoId) void cargarLead(seleccionadoId, tenantSel); }}
              />
              <textarea
                ref={textareaRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  // En el celular Enter es salto de línea (el teclado no
                  // tiene Shift a mano): se manda con el botón.
                  if (e.key === "Enter" && !e.shiftKey && !enMovil) {
                    e.preventDefault();
                    enviarRespuesta();
                  }
                }}
                rows={1}
                disabled={ventanaCerrada}
                placeholder={ventanaCerrada ? "Ventana cerrada: WhatsApp no se lo va a entregar" : dictado.soportado ? "Escribe o toca 🎤 para hablar…" : "Escribe tu mensaje…"}
                className="max-h-28 flex-1 resize-none rounded-2xl bg-arena px-3.5 py-2.5 text-[1rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa disabled:opacity-60 lg:text-[0.98rem]"
              />
              {dictado.soportado && (
                <button
                  type="button"
                  onClick={dictado.escuchando ? dictado.parar : dictado.empezar}
                  aria-label={dictado.escuchando ? "Detener dictado" : "Dictar por voz"}
                  title={dictado.escuchando ? "Toca para parar" : "Habla y lo escribo por ti"}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition ${
                    dictado.escuchando
                      ? "animate-pulse bg-brasa text-sobre-brasa ring-4 ring-brasa/30"
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
      ) : estadoLead === "ok" && !enMovil ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-frio">
          Elige un lead de la lista para ver la conversación.
        </div>
      ) : null}
    </div>
  );

  // ── LA FICHA DEL CONTACTO (columna derecha en escritorio, hoja en el celular) ──
  const ficha = leadAbierto && estadoLead === "ok" ? (
    <>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[1.05rem] font-bold text-tinta">
            {leadAbierto.nombre ?? leadAbierto.contactoExterno}
          </h2>
          {caps?.calificaLeads && <ChipTemp t={leadAbierto.nivelInteres} />}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p className="truncate text-[0.82rem] text-frio">{leadAbierto.contactoExterno}</p>
          <button
            onClick={copiarContacto}
            className="shrink-0 rounded-chip bg-arena px-2 py-0.5 text-[0.7rem] font-bold text-tinta-2 ring-1 ring-linea transition active:scale-[0.97]"
          >
            {copiado ? "✓ Copiado" : "Copiar"}
          </button>
        </div>
        <p className="mt-1 text-[0.75rem] text-frio">
          {NOMBRE_CANAL[leadAbierto.canalOrigen] ?? leadAbierto.canalOrigen}
          {(leadAbierto as LeadLista).negocioNombre ? ` · ${(leadAbierto as LeadLista).negocioNombre}` : ""}
        </p>
        {/* CONTACTAR DIRECTO (estaba solo en la ficha vieja): llamar o abrir su
            WhatsApp, cuando el contacto es un número. */}
        <div className="mt-2">
          <AccionesContacto canal={leadAbierto.canalOrigen} contacto={leadAbierto.contactoExterno} />
        </div>
        {/* DE DONDE VINO, CON NOMBRE Y COSTO (2026-09-17). Antes esta
            linea decia "vino de: ad:120255972775720311" -- el dato era
            correcto pero ilegible. */}
        <div className="mt-2">
          <OrigenLead lead={leadAbierto} />
        </div>
        {/* LA VENTA REAL (2026-10-07): "ganado" es "agendó la demo";
            esto es "pagó", y alimenta el costo por cliente del reporte. */}
        <div className="mt-2">
          <VentaLead key={leadAbierto.id} leadId={leadAbierto.id} ventaEn={leadAbierto.ventaEn} ventaCentavos={leadAbierto.ventaCentavos} tenant={tenantSel} />
        </div>
      </div>

      {/* LA REUNIÓN DESDE EL LEAD (2026-10-09): la próxima, con "Unirse" y
          "Ver en agenda", y agendar una sin ir a la Agenda a buscarlo. */}
      <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">Reunión</p>
        {agendada && (
          <p className="mb-2 rounded-lg bg-brasa-suave px-2.5 py-1.5 text-[0.78rem] font-semibold text-tinta" role="status">
            Listo: {nombreDelDia(diaLima(agendada.inicio))} a las {horaLima(agendada.inicio)}. Ya está en tu Google Calendar.
          </p>
        )}
        {leadAbierto.proximaCita ? (
          <ProximaCita cita={leadAbierto.proximaCita} />
        ) : !agendada ? (
          <p className="text-[0.82rem] text-frio">Sin reuniones agendadas con esta persona.</p>
        ) : null}
        <button
          type="button"
          onClick={() => setAgendando(true)}
          className="mt-2 w-full rounded-chip bg-arena py-2 text-[0.82rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2"
        >
          + Agendar reunión
        </button>
      </div>

      {/* Etapa del embudo (las del NEGOCIO, personalizables en
          Configuración → Tu negocio). Mover aquí sincroniza el motor.

          Solo donde hay embudo: quien pide comida no pasa por uno, y
          el selector invitaba a mover a "Ganado"/"Perdido" a alguien
          que solo pidió una hamburguesa. */}
      {caps?.tieneEmbudo && (
      <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
        <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">
          Etapa del embudo
        </p>
        <select
          value={etapaVisibleDe(leadAbierto, etapasFicha).id}
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
            value={leadAbierto.asignadoA ?? ""}
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
            {leadAbierto.asignadoA && !miembros.some((m) => m.usuarioId === leadAbierto.asignadoA) && (
              <option value={leadAbierto.asignadoA}>Miembro anterior</option>
            )}
          </select>
          {leadAbierto.asignadoA !== miUsuarioId && miUsuarioId && (
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
          {(leadAbierto.etiquetas ?? []).map((et) => (
            <span
              key={et}
              className="flex items-center gap-1 rounded-chip bg-brasa/10 px-2 py-0.5 text-[0.75rem] font-bold text-brasa-texto"
            >
              {et}
              <button
                onClick={() => guardarEtiquetas((leadAbierto.etiquetas ?? []).filter((x) => x !== et))}
                aria-label={`Quitar ${et}`}
                className="text-brasa-texto/60 hover:text-brasa-texto"
              >
                ×
              </button>
            </span>
          ))}
          {(leadAbierto.etiquetas ?? []).length < 10 && (
            <input
              value={etiquetaNueva}
              onChange={(e) => setEtiquetaNueva(e.target.value.slice(0, 20))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && etiquetaNueva.trim()) {
                  const nueva = etiquetaNueva.trim();
                  if (!(leadAbierto.etiquetas ?? []).includes(nueva)) {
                    guardarEtiquetas([...(leadAbierto.etiquetas ?? []), nueva]);
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
          {leadAbierto.resumenIA ?? "Todavía no hay resumen de la IA para este lead."}
        </p>
        <p className="mt-2 text-[0.75rem] text-frio">
          Actualizado {haceTexto(minutosDesde(leadAbierto.actualizadoEn))}
        </p>
      </div>
      )}

      {/* Nombre editable + nota privada (la ficha vieja dejaba corregir el
          nombre: los leads entran como "+51 9xx…"). Va con el negocio del
          lead, que puede no ser la empresa activa. */}
      <NotaLead
        key={leadAbierto.id}
        leadId={leadAbierto.id}
        nombre={leadAbierto.nombre}
        nota={leadAbierto.nota}
        tenant={tenantSel}
        onGuardado={() => { if (seleccionadoId) void cargarLead(seleccionadoId, tenantSel); }}
      />

      {/* LO QUE OFRECE EL NEGOCIO (estaba solo en la ficha vieja): para
          contestar un precio sin salir del chat. Plegado: se abre cuando hace
          falta. */}
      {(perfil?.catalogo?.length ?? 0) > 0 && (
        <details className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <summary className="cursor-pointer text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Lo que ofreces ({perfil!.catalogo.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {perfil!.catalogo.map((item, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2 text-[0.85rem]">
                <span className="truncate text-tinta">{item.nombre}</span>
                {item.precio && <span className="shrink-0 font-semibold text-tinta-2">{item.precio}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Cierre: GANADO / DESCARTAR. Solo donde se cierra A MANO
          (2026-08-19): en pedidos la venta la registra el PEDIDO y en
          una clínica la CITA; pedirle al dueño que además la anote es
          hacerle cargar dos veces lo mismo. Y "descartar este lead" no
          tiene sentido con alguien que acaba de pedir comida.

          EL MISMO FLUJO QUE SEGUIMIENTO (2026-10-09): acá decía "Registrar
          venta" con monto obligatorio y en el tablero "Gané" sin monto. Ahora
          es CierreLead en los tres lugares: "Ganado" con monto opcional (para
          la comisión) y "Descartar" con confirmación. "Pagó" va arriba. */}
      {caps?.cierreManualDeVenta && (
        <CierreLead
          key={leadAbierto.id}
          leadId={leadAbierto.id}
          estado={leadAbierto.estado}
          tenant={tenantSel}
          onCambio={() => {
            if (seleccionadoId) void Promise.all([cargarLead(seleccionadoId, tenantSel), cargarReciente()]);
          }}
        />
      )}

      {/* REINICIAR EL CHAT (2026-08-20, pedido de Jonathan): probar el
          bot con el propio número como si fuera la primera vez. Borra
          la conversación y cancela los pedidos vivos; las ventas
          cerradas quedan (reportes). Doble toque para confirmar,
          igual que "descartar": es destructivo. */}
      {reiniciarConfirm ? (
        <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-alerta/40">
          <p className="mb-2 text-[0.82rem] text-tinta-2">
            Se borra esta conversación y se cancelan sus pedidos sin pagar.
            El cliente vuelve a empezar de cero. ¿Seguro?
          </p>
          <div className="flex gap-2">
            <button
              onClick={reiniciarChat}
              disabled={enviando}
              className="flex-1 rounded-chip bg-calor py-2 text-[0.82rem] font-bold text-carta active:scale-[0.99] disabled:opacity-60"
            >
              Sí, reiniciar
            </button>
            <button
              onClick={() => setReiniciarConfirm(false)}
              className="flex-1 rounded-chip bg-arena-2 py-2 text-[0.82rem] font-bold text-tinta-2 active:scale-[0.99]"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReiniciarConfirm(true)}
          className="rounded-chip py-2 text-[0.82rem] font-bold text-frio transition hover:text-alerta"
        >
          🔄 Reiniciar chat (probar como cliente nuevo)
        </button>
      )}
    </>
  ) : null;

  // Agendar con ESTE lead ya elegido (sirve en las dos pantallas).
  const modalAgendar = agendando && leadAbierto ? (
    <AgendarReunion
      dia={hoyLima()}
      hora=""
      variosNegocios={false}
      colores={new Map()}
      lead={{
        id: leadAbierto.id,
        tenantId: tenantSel ?? leerEmpresaActiva() ?? "",
        negocio: (leadAbierto as LeadLista).negocioNombre ?? "",
        nombre: leadAbierto.nombre,
        telefono: telefonoDe(leadAbierto.canalOrigen, leadAbierto.contactoExterno),
        canal: leadAbierto.canalOrigen,
      }}
      onCerrar={() => setAgendando(false)}
      onAgendada={(c) => {
        setAgendando(false);
        setAgendada(c);
        if (seleccionadoId) void cargarLead(seleccionadoId, tenantSel);
      }}
    />
  ) : null;

  // ── CELULAR: la lista, o el chat a pantalla completa ──
  if (!esEscritorio) {
    if (!seleccionadoId) {
      return <div className="h-full space-y-3 overflow-y-auto p-4">{bandejaMovil}</div>;
    }
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {vistaChat(true)}
        {fichaAbierta && ficha && (
          <div className="fixed inset-0 z-40 flex flex-col bg-arena" role="dialog" aria-modal="true" aria-label="Ficha del contacto">
            <header className="flex items-center gap-2 border-b border-linea bg-carta px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
              <BotonVolver onClick={() => setFichaAbierta(false)} etiqueta="Volver al chat" />
              <p className="truncate text-[0.98rem] font-bold text-tinta">Ficha del contacto</p>
            </header>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{ficha}</div>
          </div>
        )}
        {modalAgendar}
      </div>
    );
  }

  // ── ESCRITORIO: negocios arriba + [Buzón | Conversaciones | Chat | Ficha] ──
  return (
    // h-full (no min-h): la pantalla se ancla al alto de la ventana y cada
    // columna scrollea POR DENTRO — el compositor queda siempre a la vista.
    <div className="flex h-full flex-col overflow-hidden">
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

      <div className="grid flex-1 grid-cols-[210px_300px_1fr_290px] overflow-hidden">
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
              onClick={() => { if (filtroAsignado) quitarAsignado(); elegirBuzon(id); }}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold transition ${
                filtroBuzon === id && !filtroAsignado ? "bg-brasa/10 text-brasa-texto" : "text-tinta-2 hover:bg-arena"
              }`}
            >
              <span>{label}</span>
              <span className="text-[0.78rem] tabular-nums">{n}</span>
            </button>
          ))}
          {chipAsignado && <div className="mt-1">{chipAsignado}</div>}
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
              onClick={() => elegirEtapa(filtroEtapa === e.id ? "" : e.id)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[0.85rem] font-semibold transition ${
                filtroEtapa === e.id ? "bg-brasa/10 text-brasa-texto" : "text-tinta-2 hover:bg-arena"
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
              <div className="p-3">
                <ErrorConReintento compacto mensaje="No pudimos cargar la lista." reintentar={() => { setEstadoLista("cargando"); void cargarLista(); }} />
              </div>
            )}
            {listaVacia && vacioLista(true)}
            {estadoLista === "ok" && !listaVacia && leadsVisibles.length === 0 && (hayFiltros ? sinResultados : (
              <p className="p-4 text-center text-[0.85rem] text-frio">Nada por aquí en este negocio.</p>
            ))}
            {estadoLista === "ok" &&
              leadsVisibles.map((l) => {
                const activo = l.id === seleccionadoId;
                const inicial = (l.nombre ?? l.contactoExterno).trim().charAt(0).toUpperCase() || "?";
                const et = etapaVisibleDe(l, etapasBandeja);
                return (
                  <button
                    key={l.id}
                    onClick={() => seleccionar(l)}
                    onMouseEnter={() => precargar(l)}
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
                          {haceTexto(minutosDesde(l.ultimoMensajeEn ?? l.creadoEn))}
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
                      {/* DE QUE ANUNCIO VINO (2026-09-17). En la lista
                          alcanza con el nombre: el costo se mira en la ficha,
                          cuando ya se decidio abrirlo. */}
                      {l.origen && l.origen.tipo !== "otro" && (
                        <span className="mt-1 flex">
                          <OrigenLead lead={l} compacto />
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>

        {/* Columna 3: chat */}
        {vistaChat(false)}

        {/* Columna 4: ficha del contacto */}
        <div className="flex flex-col gap-4 overflow-y-auto border-l border-linea p-4">
          {ficha ?? <p className="text-frio">Sin conversación seleccionada.</p>}
        </div>
      </div>
      {modalAgendar}
    </div>
  );
}

/** El "‹" de volver, con su área de toque de 44 px. */
function BotonVolver({ onClick, etiqueta = "Volver a la lista" }: { onClick: () => void; etiqueta?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tinta-2 transition hover:bg-arena"
    >
      <IconoChevron className="h-6 w-6 rotate-90" />
    </button>
  );
}
