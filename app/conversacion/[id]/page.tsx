"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion } from "@/lib/auth";
import {
  obtenerLead,
  accionLead,
  obtenerPerfil,
  obtenerFrasesRapidas,
  type LeadDetalle,
  type Mensaje as MensajeApi,
  type PerfilNegocio,
} from "@/lib/api";
import { usePolling } from "@/lib/usePolling";
import { useDictado } from "@/lib/useDictado";
import { ChipTemp } from "@/components/ChipTemp";
import { BadgeCanal } from "@/components/BadgeCanal";
import { AccionesContacto } from "@/components/AccionesContacto";
import { NotaLead } from "@/components/panel/NotaLead";
import { Burbuja } from "@/components/Burbuja";
import { IconoChevron, IconoMic, IconoEnviar } from "@/components/Iconos";
import type { Mensaje as MensajeUI } from "@/lib/tipos";

type Estado = "cargando" | "ok" | "error" | "no-encontrado";

// Estado del lead en lenguaje simple (mismo criterio que la pantalla de Leads).
const ESTADO_SIMPLE: Record<string, string> = {
  nuevo: "Nuevo",
  nutriendo: "En seguimiento",
  escalado: "Para atender",
  ganado: "Ganado",
  perdido: "Perdido",
};

// Convierte un timestamp ISO en minutos transcurridos hasta ahora.
function minutosDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 60000));
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

export default function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [listo, setListo] = useState(false);

  const [estado, setEstado] = useState<Estado>("cargando");
  const [lead, setLead] = useState<LeadDetalle | null>(null);

  const [resumenAbierto, setResumenAbierto] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Dictado por voz: al hablar, agrega lo dicho al final del mensaje.
  const dictado = useDictado((fragmento) =>
    setTexto((t) => (t ? `${t} ${fragmento}` : fragmento)),
  );
  // Respuestas de un toque (las frases que más usa). Se cargan una vez.
  const [frases, setFrases] = useState<{ id: string; texto: string }[]>([]);
  useEffect(() => { obtenerFrasesRapidas().then(setFrases); }, []);

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
  const [accionError, setAccionError] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<PerfilNegocio["catalogo"]>([]);

  useEffect(() => {
    if (!haySesion()) router.replace("/");
    else setListo(true);
  }, [router]);

  // Panel de contexto (desktop): catálogo del negocio desde el playbook.
  useEffect(() => {
    obtenerPerfil()
      .then((p) => setCatalogo(p?.catalogo ?? []))
      .catch(() => setCatalogo([]));
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await obtenerLead(id);
      if (r) {
        setLead(r);
        setEstado("ok");
      } else {
        setEstado("no-encontrado");
      }
    } catch (e) {
      void e;
      setEstado("error");
    }
  }, [id]);

  useEffect(() => {
    if (!listo) return;
    setEstado("cargando");
    cargar();
  }, [listo, cargar]);

  // Polling: refresca el lead mientras no haya una acción en curso.
  usePolling(() => {
    if (enviando) return;
    cargar();
  }, 10000);

  async function enviarRespuesta() {
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(id, { tipo: "responder", texto: texto.trim() });
    if (r.ok) {
      setTexto("");
      await cargar();
    } else {
      setAccionError(r.error ?? "No se pudo enviar la respuesta.");
    }
    setEnviando(false);
  }

  async function aprobarBorrador() {
    if (enviando) return;
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(id, { tipo: "aprobar_borrador" });
    if (r.ok) {
      await cargar();
    } else {
      setAccionError(r.error ?? "No se pudo aprobar el borrador.");
    }
    setEnviando(false);
  }

  async function registrarVenta() {
    if (enviando) return;
    const monto = Number(montoVenta);
    if (!montoVenta || Number.isNaN(monto) || monto <= 0) {
      setAccionError("Ingresá un monto válido.");
      return;
    }
    setEnviando(true);
    setAccionError(null);
    const r = await accionLead(id, { tipo: "marcar_ganado", monto });
    if (r.ok) {
      setVentaAbierta(false);
      setMontoVenta("");
      await cargar();
    } else {
      setAccionError(r.error ?? "No se pudo registrar la venta.");
    }
    setEnviando(false);
  }

  if (!listo) return null;

  if (estado === "cargando") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-frio">Cargando conversación…</p>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-frio">No pudimos cargar esta conversación.</p>
        <Link href="/leads" className="rounded-chip bg-tinta px-5 py-2.5 font-bold text-carta">
          Volver a leads
        </Link>
      </div>
    );
  }

  if (estado === "no-encontrado" || !lead) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-frio">No encontramos esta conversación.</p>
        <Link href="/leads" className="rounded-chip bg-tinta px-5 py-2.5 font-bold text-carta">
          Volver a leads
        </Link>
      </div>
    );
  }

  const nombre = lead.nombre ?? lead.contactoExterno;

  // Bloque de "Registrar venta" — se usa tanto en mobile (debajo del chat)
  // como en el panel de contexto de desktop. Misma lógica, sin duplicarla.
  const bloqueVenta =
    lead.estado === "ganado" ? (
      <div className="rounded-tarjeta bg-ok/10 p-3.5 ring-1 ring-ok/30">
        <p className="text-[0.95rem] font-bold text-ok">✓ Venta registrada</p>
        <p className="text-[0.85rem] text-tinta-2">La verás en Reportes.</p>
      </div>
    ) : ventaAbierta ? (
      <div className="flex flex-col gap-2 rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
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
        className="w-full rounded-chip border-2 border-ok/40 bg-carta py-2.5 text-[0.95rem] font-bold text-ok transition active:scale-[0.99]"
      >
        Registrar venta de este lead
      </button>
    );

  // Composición (textarea + enviar/mic) — compartida entre mobile y desktop.
  const composicion = (
    <div className="space-y-2">
      {/* Respuestas de un toque: tocá una y se pone en el mensaje, listo para
          enviar o editar. Se aprenden de lo que más usás. */}
      {frases.length > 0 && !texto.trim() && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {frases.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTexto(f.texto)}
              className="shrink-0 rounded-chip bg-arena px-3 py-1.5 text-[0.82rem] font-medium text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2 hover:text-tinta"
            >
              {f.texto.length > 40 ? f.texto.slice(0, 38) + "…" : f.texto}
            </button>
          ))}
        </div>
      )}
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
      {/* Botón de dictado por voz (hablar en vez de escribir). Solo si el
          navegador lo soporta. Mientras escucha, pulsa en coral. */}
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
  );

  return (
    <div className="flex min-h-dvh flex-col bg-arena lg:flex-row">
      {/* Columna del chat (mobile: única columna; desktop: acotada a la izquierda) */}
      <div className="flex min-h-dvh flex-1 flex-col lg:min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-linea bg-carta/95 px-3 py-2.5 pt-[max(0.6rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="mx-auto flex items-center gap-2 lg:max-w-[640px]">
            <Link
              href="/leads"
              aria-label="Volver"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-tinta-2"
            >
              <IconoChevron className="h-6 w-6 rotate-90" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[1.1rem] font-bold text-tinta">{nombre}</h1>
              <div className="mt-0.5 flex items-center gap-2">
                <BadgeCanal canal={lead.canalOrigen} tamano="chico" />
                <p className="truncate text-[0.78rem] text-frio">{lead.contactoExterno}</p>
              </div>
            </div>
            <AccionesContacto canal={lead.canalOrigen} contacto={lead.contactoExterno} compacto />
            <ChipTemp t={lead.nivelInteres} />
          </div>
        </header>

        {/* Resumen de la IA, colapsable — solo mobile. En desktop vive en el panel de contexto. */}
        {lead.resumenIA && (
          <section className="border-b border-linea bg-tibio-suave/60 lg:hidden">
            <button
              onClick={() => setResumenAbierto((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5"
            >
              <span className="text-[0.8rem] font-bold uppercase tracking-wide text-tibio">
                Lo que la IA entendió
              </span>
              <IconoChevron
                className={`h-5 w-5 text-tibio transition-transform ${resumenAbierto ? "" : "-rotate-90"}`}
              />
            </button>
            {resumenAbierto && (
              <div className="px-4 pb-3.5 text-[0.92rem] text-tinta">{lead.resumenIA}</div>
            )}
          </section>
        )}

        {/* Chat */}
        <main className="flex flex-1 flex-col gap-3 px-4 py-4 lg:mx-auto lg:w-full lg:max-w-[640px]">
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
                className="w-full rounded-xl bg-arena/70 px-3 py-2.5 text-left text-[0.92rem] leading-snug text-tinta-2 transition hover:bg-arena active:scale-[0.99] ring-1 ring-linea"
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
          <p className="px-4 pb-1 text-[0.8rem] font-semibold text-brasa lg:mx-auto lg:w-full lg:max-w-[640px] lg:px-0">
            {accionError}
          </p>
        )}

        {/* Registrar venta — solo mobile. En desktop vive en el panel de contexto. */}
        <div className="mx-4 mb-2 lg:hidden">{bloqueVenta}</div>

        {/* Composición */}
        <div className="sticky bottom-0 border-t border-linea bg-carta px-3 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="lg:mx-auto lg:max-w-[640px]">{composicion}</div>
        </div>
      </div>

      {/* Panel de contexto — solo desktop */}
      <aside className="hidden shrink-0 flex-col gap-3 overflow-y-auto border-l border-linea bg-carta/60 p-4 lg:flex lg:w-[340px]">
        {/* Lo que la IA entendió */}
        {lead.resumenIA && (
          <div className="rounded-tarjeta bg-tibio-suave/60 p-3.5 ring-1 ring-linea">
            <p className="mb-1.5 text-[0.78rem] font-bold uppercase tracking-wide text-tibio">
              Lo que la IA entendió
            </p>
            <p className="text-[0.9rem] text-tinta">{lead.resumenIA}</p>
          </div>
        )}

        {/* Datos del lead */}
        <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
          <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Datos del lead</p>
          <dl className="flex flex-col gap-1.5 text-[0.88rem]">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-frio">Nombre</dt>
              <dd className="truncate text-right font-semibold text-tinta">{nombre}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-frio">Contacto</dt>
              <dd className="truncate text-right text-tinta-2">{lead.contactoExterno}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-frio">Canal</dt>
              <dd><BadgeCanal canal={lead.canalOrigen} tamano="chico" /></dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-frio">Nivel</dt>
              <dd>
                <ChipTemp t={lead.nivelInteres} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-frio">Estado</dt>
              <dd className="truncate text-right text-tinta-2">{ESTADO_SIMPLE[lead.estado] ?? lead.estado}</dd>
            </div>
          </dl>
          {/* Contactar directo: llamar o abrir WhatsApp (solo si hay número). */}
          <div className="mt-3">
            <AccionesContacto canal={lead.canalOrigen} contacto={lead.contactoExterno} />
          </div>
        </div>

        {/* Nombre editable + nota privada de la vendedora */}
        <NotaLead leadId={lead.id} nombre={lead.nombre} nota={lead.nota} onGuardado={cargar} />

        {/* Lo que ofrecés */}
        {catalogo.length > 0 ? (
          <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
            <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Lo que ofrecés</p>
            <ul className="flex flex-col gap-2">
              {catalogo.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-2 text-[0.88rem]">
                  <span className="truncate text-tinta">{item.nombre}</span>
                  {item.precio && <span className="shrink-0 font-semibold text-tinta-2">{item.precio}</span>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
            <p className="mb-1 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Lo que ofrecés</p>
            <p className="text-[0.85rem] text-frio">Sin productos cargados</p>
          </div>
        )}

        {/* Acciones */}
        <div className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
          <p className="mb-2 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Acciones</p>
          {bloqueVenta}
        </div>
      </aside>
    </div>
  );
}
