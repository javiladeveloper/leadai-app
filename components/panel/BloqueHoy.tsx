"use client";

import { useState } from "react";
import Link from "next/link";
import {
  actualizarTarea, claveHoy, descartarOportunidad, obtenerHoy,
  type Hoy, type OportunidadDia, type ReunionHoy, type SinRespuestaHoy, type TareaHoy,
} from "@/lib/api";
import { guardarCache, invalidar } from "@/lib/cache-datos";
import { useDatos } from "@/lib/useDatos";
import { guardarEmpresaActiva } from "@/lib/auth";
import { LinkLead } from "@/components/LinkLead";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { AgendarReunion } from "@/components/agenda/AgendarReunion";
import { diaLima, horaLima, hoyLima } from "@/lib/agenda";
import { reunionUnible, telefonoDe, urlAgenda } from "@/lib/enlaces";
import {
  ATAJOS_POSPONER, agruparHoy, conTareaMovida, cuandoTarea, esperandoTexto, nombreDia, pospuesta,
  sinTarea, tareaAtrasada, tipoTareaDe, tituloTarea, type Atajo,
} from "@/lib/crm";
import { accionDeOportunidad, cierraEn, iconoOportunidad, sinOportunidad } from "@/lib/oportunidades-dia";

/**
 * "HOY": LO QUE TOCA HACER, ARRIBA DE TODO (CRM fase 1, 2026-10-13).
 *
 * Pedido de Jonathan: un CRM "fácil y que realmente sea ÚTIL". Inicio
 * mostraba números (cuántos leads, cuántos calientes) pero no la lista de
 * lo que la vendedora tiene que hacer HOY: con quién se reúne, a quién
 * prometió llamar y quién le escribió y sigue esperando.
 *
 * UNA SOLA LLAMADA (`GET /hoy`): el servidor junta las tres listas en
 * paralelo (la BD está en California y el servidor en Finlandia; tres
 * llamadas en serie serían medio segundo de espera). La misma clave de caché
 * la usan Inicio, la vista global y la campana: sale una petición y las tres
 * dicen lo mismo.
 *
 * Si el backend todavía no tiene `/hoy` (404) o este puesto no lo ve (403),
 * el bloque no se pinta: la pantalla queda como estaba.
 *
 * `tenantId`: el negocio (Inicio de un negocio). Sin él, todos los negocios de
 * la persona (vista global), y cada renglón lleva el chip de su negocio.
 */
export function BloqueHoy({
  tenantId, conNegocio = false, ocultarSiVacio = false,
}: {
  tenantId?: string;
  conNegocio?: boolean;
  /** Una cuenta recién creada ya tiene su propio vacío ("Aún no tienes leads"): no se repite "Todo al día". */
  ocultarSiVacio?: boolean;
}) {
  const clave = claveHoy(tenantId);
  const { datos, error, cargando, recargar } = useDatos<Hoy | null>(clave, () => obtenerHoy(tenantId), { maxEdadMs: 30_000 });
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);

  // Sin la ruta en el backend, o un puesto que no la ve: no se pinta nada.
  if (datos === null) return null;
  if (datos === undefined) {
    if (error) return <ErrorConReintento compacto mensaje="No pudimos cargar lo de hoy." reintentar={() => void recargar()} />;
    if (!cargando) return null;
    return (
      <div className="h-28 animate-pulse rounded-tarjeta bg-carta ring-1 ring-linea" aria-busy="true" aria-label="Cargando lo de hoy" />
    );
  }

  const ahora = new Date();
  const g = agruparHoy(datos, ahora);
  const pasos = [...g.atrasadas, ...g.deHoy];
  if (g.vacio && ocultarSiVacio) return null;

  function mostrarAviso(texto: string, esError = false) {
    setAviso({ texto, error: esError });
    setTimeout(() => setAviso((a) => (a?.texto === texto ? null : a)), 3500);
  }

  /**
   * ✓ HECHO Y POSPONER SE VEN AL INSTANTE: se saca (o se mueve) en la caché
   * de "Hoy" antes de esperar al servidor. Si el servidor dice que no, se
   * vuelve a pedir la lista verdadera y se avisa.
   */
  async function marcarHecha(t: TareaHoy) {
    if (ocupada) return;
    setOcupada(t.id);
    const antes = datos!;
    guardarCache(clave, sinTarea(antes, t.id));
    try {
      await actualizarTarea(t.id, { estado: "hecha" }, t.tenantId);
      mostrarAviso(`Listo ✓ ${tituloTarea(t, t.lead.nombre)}`);
    } catch {
      guardarCache(clave, antes);
      mostrarAviso("No se pudo marcar como hecho. Intenta de nuevo.", true);
      invalidar("hoy@");
    } finally {
      setOcupada(null);
    }
  }

  async function posponer(t: TareaHoy, atajo: Exclude<Atajo, "hoy">) {
    if (ocupada) return;
    setOcupada(t.id);
    const antes = datos!;
    const nueva = pospuesta(t, atajo, new Date());
    guardarCache(clave, conTareaMovida(antes, { id: t.id, ...nueva }));
    try {
      await actualizarTarea(t.id, nueva, t.tenantId);
      mostrarAviso(`Lo pasamos para ${nombreDia(diaLima(nueva.venceEn))}.`);
    } catch {
      guardarCache(clave, antes);
      mostrarAviso("No se pudo posponer. Intenta de nuevo.", true);
      invalidar("hoy@");
    } finally {
      setOcupada(null);
    }
  }

  /**
   * DESCARTAR UNA OPORTUNIDAD (CRM fase 3): sale al instante; si el servidor
   * dice que no, vuelve y se avisa. El servidor la esconde 7 días para esta
   * persona.
   */
  async function descartar(o: OportunidadDia) {
    const antes = datos!;
    guardarCache(clave, sinOportunidad(antes, o.id));
    try {
      await descartarOportunidad(o.id);
    } catch {
      guardarCache(clave, antes);
      mostrarAviso("No se pudo descartar. Intenta de nuevo.", true);
    }
  }

  /** Agendó desde una oportunidad: sale de la lista y "Hoy" se vuelve a pedir (la reunión puede ser hoy). */
  function agendadaDesde(o: OportunidadDia, inicio: string) {
    guardarCache(clave, sinOportunidad(datos!, o.id));
    invalidar("hoy@");
    mostrarAviso(`Listo: reunión ${nombreDia(diaLima(inicio))} a las ${horaLima(inicio)}.`);
  }

  const resumen = [
    g.oportunidades.length ? `${g.oportunidades.length} ${g.oportunidades.length === 1 ? "oportunidad" : "oportunidades"}` : "",
    g.reuniones.length ? `${g.reuniones.length} ${g.reuniones.length === 1 ? "reunión" : "reuniones"}` : "",
    pasos.length ? `${pasos.length} ${pasos.length === 1 ? "pendiente" : "pendientes"}` : "",
    g.sinRespuesta.length ? `${g.sinRespuesta.length} sin respuesta` : "",
  ].filter(Boolean).join(" · ");

  return (
    <section aria-labelledby="titulo-hoy" className="space-y-3 rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="titulo-hoy" className="text-[1.15rem] font-bold text-tinta">Hoy</h2>
        {resumen && <p className="text-[0.82rem] text-frio">{resumen}</p>}
      </header>

      {aviso && (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-[0.82rem] font-semibold ${aviso.error ? "bg-alerta-suave text-alerta-hondo" : "bg-brasa-suave text-brasa-texto"}`}
        >
          {aviso.texto}
        </p>
      )}

      {g.vacio && (
        <p className="rounded-xl bg-arena/60 px-3 py-3 text-[0.9rem] text-tinta-2">
          Todo al día ✓ — no tienes reuniones, pendientes ni clientes esperando respuesta.
        </p>
      )}

      {/* OPORTUNIDADES DEL DÍA (CRM fase 3): los clientes que se están por
          perder, cada uno con su acción de un toque. Llegan vacías hasta que
          el servidor las calcule, y entonces el grupo no aparece. */}
      {g.oportunidades.length > 0 && (
        <GrupoOportunidades
          lista={g.oportunidades}
          conNegocio={conNegocio}
          ahora={ahora}
          onDescartar={(o) => void descartar(o)}
          onAgendada={agendadaDesde}
        />
      )}

      {g.reuniones.length > 0 && (
        <Grupo titulo="Reuniones de hoy" cuenta={g.reuniones.length}>
          {g.reuniones.map((r) => <FilaReunion key={r.citaId} r={r} conNegocio={conNegocio} ahora={ahora} />)}
        </Grupo>
      )}

      {pasos.length > 0 && (
        <Grupo titulo="Próximos pasos" cuenta={pasos.length} nota={g.atrasadas.length ? `${g.atrasadas.length} atrasado${g.atrasadas.length === 1 ? "" : "s"}` : undefined}>
          {pasos.map((t) => (
            <FilaPaso
              key={t.id}
              t={t}
              conNegocio={conNegocio}
              ahora={ahora}
              ocupada={ocupada === t.id}
              onHecha={() => void marcarHecha(t)}
              onPosponer={(a) => void posponer(t, a)}
            />
          ))}
        </Grupo>
      )}

      {g.sinRespuesta.length > 0 && <GrupoSinRespuesta lista={g.sinRespuesta} conNegocio={conNegocio} />}
    </section>
  );
}

function Grupo({ titulo, cuenta, nota, children }: { titulo: string; cuenta: number; nota?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-baseline gap-2 text-[0.72rem] font-bold uppercase tracking-wider text-frio">
        {titulo} <span className="tabular-nums">({cuenta})</span>
        {nota && <span className="normal-case tracking-normal text-alerta">· {nota}</span>}
      </p>
      <ul className="divide-y divide-linea">{children}</ul>
    </div>
  );
}

function Fila({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">{children}</li>;
}

function Acciones({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div>;
}

function NombreLead({ id, tenant, nombre }: { id: string; tenant: string; nombre: string | null }) {
  return (
    <LinkLead id={id} tenant={tenant} className="font-semibold text-tinta underline-offset-2 hover:text-brasa-texto hover:underline" claseSinPermiso="font-semibold text-tinta">
      {nombre?.trim() || "Sin nombre"}
    </LinkLead>
  );
}

function ChipNegocio({ nombre }: { nombre: string }) {
  if (!nombre) return null;
  return (
    <span className="ml-1.5 inline-block max-w-[10rem] truncate rounded-chip bg-arena px-2 py-px align-middle text-[0.68rem] font-bold text-tinta-2 ring-1 ring-linea">
      {nombre}
    </span>
  );
}

const BOTON = "inline-flex min-h-0 items-center justify-center rounded-chip px-3 py-1.5 text-[0.78rem] font-bold transition active:scale-[0.98] disabled:opacity-60";
const BOTON_NEUTRO = `${BOTON} bg-carta text-tinta-2 ring-1 ring-linea hover:bg-arena`;

function BotonLlamar({ tel }: { tel: string }) {
  return <a href={`tel:+${tel}`} className={`${BOTON} text-ok ring-1 ring-ok/30 hover:bg-ok/10`}>Llamar</a>;
}

function BotonWhatsApp({ tel }: { tel: string }) {
  return <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer" className={BOTON_NEUTRO}>WhatsApp</a>;
}

function BotonFicha({ id, tenant, texto = "Ficha" }: { id: string; tenant: string; texto?: string }) {
  return (
    <LinkLead id={id} tenant={tenant} className={BOTON_NEUTRO} claseSinPermiso="hidden">
      {texto}
    </LinkLead>
  );
}

/** Una reunión: la hora (abre la Agenda en esa cita), con quién, y Unirse / Llamar / Ficha. */
function FilaReunion({ r, conNegocio, ahora }: { r: ReunionHoy; conNegocio: boolean; ahora: Date }) {
  const tel = telefonoDe("whatsapp", r.telefono);
  const termino = new Date(r.fin).getTime() < ahora.getTime();
  const unible = !!r.meetLink && reunionUnible(r, ahora);
  return (
    <Fila>
      <Link
        href={urlAgenda({ fecha: diaLima(r.inicio), cita: r.citaId, vista: "dia" })}
        title="Ver en la agenda"
        className={`w-14 shrink-0 text-[0.95rem] font-bold tabular-nums hover:underline ${termino ? "text-frio" : "text-tinta"}`}
      >
        {horaLima(r.inicio)}
      </Link>
      <div className="min-w-0 flex-1 text-[0.9rem]">
        <NombreLead id={r.leadId} tenant={r.tenantId} nombre={r.nombre} />
        {conNegocio && <ChipNegocio nombre={r.negocio} />}
        {termino && <span className="block text-[0.75rem] text-frio">{r.resultado ? "Ya anotaste cómo le fue" : "Ya pasó · anota cómo le fue en la agenda"}</span>}
      </div>
      <Acciones>
        {r.meetLink && !termino && (
          <a
            href={r.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className={unible ? `${BOTON} bg-brasa text-sobre-brasa hover:bg-brasa-hondo` : BOTON_NEUTRO}
          >
            Unirse
          </a>
        )}
        {tel && <BotonLlamar tel={tel} />}
        <BotonFicha id={r.leadId} tenant={r.tenantId} />
      </Acciones>
    </Fila>
  );
}

/** Un próximo paso: qué, con quién y cuándo, con ✓ Hecho, Posponer, WhatsApp y Llamar. */
function FilaPaso({
  t, conNegocio, ahora, ocupada, onHecha, onPosponer,
}: {
  t: TareaHoy; conNegocio: boolean; ahora: Date; ocupada: boolean;
  onHecha: () => void; onPosponer: (a: Exclude<Atajo, "hoy">) => void;
}) {
  const [menu, setMenu] = useState(false);
  const tipo = tipoTareaDe(t.tipo);
  const cuando = cuandoTarea(t, ahora);
  const atrasada = tareaAtrasada(t, ahora);
  const tel = telefonoDe("whatsapp", t.lead.telefono);
  return (
    <Fila>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-arena text-[0.95rem]" aria-hidden>{tipo.icono}</span>
      <div className="min-w-0 flex-1 text-[0.9rem]">
        <p className="text-tinta">
          {tipo.verbo} <NombreLead id={t.lead.id} tenant={t.lead.tenantId} nombre={t.lead.nombre} />
          {conNegocio && <ChipNegocio nombre={t.lead.negocio} />}
        </p>
        <p className="text-[0.76rem]">
          <span className={atrasada ? "font-semibold text-alerta" : "text-frio"}>{cuando}</span>
          {t.titulo?.trim() && <span className="text-tinta-2"> · {t.titulo.trim()}</span>}
        </p>
      </div>
      <Acciones>
        <button type="button" onClick={onHecha} disabled={ocupada} className={`${BOTON} bg-brasa text-sobre-brasa hover:bg-brasa-hondo`}>
          ✓ Hecho
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenu((v) => !v)}
            disabled={ocupada}
            aria-expanded={menu}
            aria-haspopup="menu"
            className={BOTON_NEUTRO}
          >
            Posponer ▾
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div role="menu" className="absolute right-0 top-9 z-40 w-36 overflow-hidden rounded-xl bg-carta shadow-[var(--sombra-flotante)] ring-1 ring-linea">
                {ATAJOS_POSPONER.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenu(false); onPosponer(a.id); }}
                    className="block min-h-0 w-full px-3 py-2 text-left text-[0.84rem] font-semibold text-tinta transition hover:bg-arena"
                  >
                    {a.etiqueta}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {tel && <BotonWhatsApp tel={tel} />}
        {tel && <BotonLlamar tel={tel} />}
      </Acciones>
    </Fila>
  );
}

/** "Te escribieron y nadie respondió": el que espera hace más, primero. Cinco a la vista y "ver todos". */
function GrupoSinRespuesta({ lista, conNegocio }: { lista: SinRespuestaHoy[]; conNegocio: boolean }) {
  const [todos, setTodos] = useState(false);
  const visibles = todos ? lista : lista.slice(0, 5);
  return (
    <Grupo titulo="Te escribieron y nadie respondió" cuenta={lista.length}>
      {visibles.map((s) => (
        <Fila key={s.leadId}>
          <div className="min-w-0 flex-1 text-[0.9rem]">
            <p>
              <NombreLead id={s.leadId} tenant={s.tenantId} nombre={s.nombre} />
              {s.nivelInteres === "caliente" && <span className="ml-1" title="Caliente">🔥</span>}
              {conNegocio && <ChipNegocio nombre={s.negocio} />}
            </p>
            <p className="line-clamp-2 text-[0.76rem]">
              <span className={s.esperandoMin >= 60 ? "font-semibold text-calor" : "text-frio"}>
                {esperandoTexto(s.esperandoMin)}
              </span>
              {s.ultimoMensaje && <span className="text-tinta-2"> · “{s.ultimoMensaje}”</span>}
            </p>
          </div>
          <Acciones>
            <BotonFicha id={s.leadId} tenant={s.tenantId} texto="Responder" />
          </Acciones>
        </Fila>
      ))}
      {lista.length > 5 && (
        <li className="pt-2">
          <button
            type="button"
            onClick={() => setTodos((v) => !v)}
            className="min-h-0 text-[0.8rem] font-bold text-brasa-texto hover:underline"
          >
            {todos ? "Ver menos" : `Ver los ${lista.length}`}
          </button>
        </li>
      )}
    </Grupo>
  );
}

/**
 * OPORTUNIDADES DEL DÍA (CRM fase 3, 2026-10-13): el que no llegó a la
 * reunión, el caliente que dejó de escribir, la ventana de WhatsApp que se
 * cierra, lo que se le prometió… Cada una con su ícono, por qué importa y UNA
 * acción de un toque:
 *  · Escribirle → abre el chat con un mensaje sugerido para ESE motivo;
 *  · Llamar → el marcador del teléfono;
 *  · Agendar → el "Agendar reunión" de siempre, con el cliente ya elegido;
 *  · Anotar cómo le fue → la Agenda en esa cita.
 * "Descartar" la saca (el servidor no la vuelve a mostrar en 7 días).
 */
function GrupoOportunidades({
  lista, conNegocio, ahora, onDescartar, onAgendada,
}: {
  lista: OportunidadDia[];
  conNegocio: boolean;
  ahora: Date;
  onDescartar: (o: OportunidadDia) => void;
  onAgendada: (o: OportunidadDia, inicio: string) => void;
}) {
  const [todas, setTodas] = useState(false);
  const [agendando, setAgendando] = useState<OportunidadDia | null>(null);
  const visibles = todas ? lista : lista.slice(0, 5);
  const principal = `${BOTON} bg-brasa text-sobre-brasa hover:bg-brasa-hondo`;
  return (
    <Grupo titulo="Oportunidades" cuenta={lista.length}>
      {visibles.map((o) => {
        const accion = accionDeOportunidad(o);
        const cierra = o.tipo === "ventana_24h" ? cierraEn(o.venceEn, ahora) : null;
        return (
          <Fila key={o.id}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-arena text-[0.95rem]" aria-hidden>
              {iconoOportunidad(o.tipo)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9rem] font-semibold text-tinta">
                {o.titulo}
                {cierra && (
                  <span className="ml-1.5 inline-block rounded-chip bg-calor-suave px-2 py-px align-middle text-[0.7rem] font-bold text-calor-hondo">
                    {cierra}
                  </span>
                )}
              </p>
              <p className="text-[0.8rem] text-tinta-2">
                <NombreLead id={o.leadId} tenant={o.tenantId} nombre={o.nombre} />
                {conNegocio && <ChipNegocio nombre={o.negocio} />}
              </p>
              {o.detalle && <p className="line-clamp-2 text-[0.76rem] text-frio">{o.detalle}</p>}
            </div>
            <Acciones>
              {accion.tipo === "whatsapp" && (
                <Link
                  href={accion.href}
                  onClick={() => guardarEmpresaActiva(o.tenantId)}
                  title="Abre el chat con un mensaje sugerido para revisar y enviar"
                  className={principal}
                >
                  {accion.texto}
                </Link>
              )}
              {accion.tipo === "llamar" && (
                <a href={accion.href} className={`${BOTON} text-ok ring-1 ring-ok/30 hover:bg-ok/10`}>{accion.texto}</a>
              )}
              {accion.tipo === "agendar" && (
                <button type="button" onClick={() => setAgendando(o)} className={principal}>{accion.texto}</button>
              )}
              {accion.tipo === "resultado" && (
                <Link href={accion.href} className={principal}>{accion.texto}</Link>
              )}
              {accion.tipo === "ficha" && <BotonFicha id={o.leadId} tenant={o.tenantId} texto={accion.texto} />}
              <button
                type="button"
                onClick={() => onDescartar(o)}
                title="No mostrar esta oportunidad por 7 días"
                className={`${BOTON} text-frio hover:text-alerta`}
              >
                Descartar
              </button>
            </Acciones>
          </Fila>
        );
      })}
      {lista.length > 5 && (
        <li className="pt-2">
          <button type="button" onClick={() => setTodas((v) => !v)} className="min-h-0 text-[0.8rem] font-bold text-brasa-texto hover:underline">
            {todas ? "Ver menos" : `Ver las ${lista.length}`}
          </button>
        </li>
      )}
      {agendando && (
        <AgendarReunion
          dia={hoyLima()}
          hora=""
          variosNegocios={conNegocio}
          colores={new Map()}
          lead={{
            id: agendando.leadId,
            tenantId: agendando.tenantId,
            negocio: agendando.negocio,
            nombre: agendando.nombre,
            telefono: telefonoDe("whatsapp", agendando.telefono),
            canal: "whatsapp",
          }}
          onCerrar={() => setAgendando(null)}
          onAgendada={(c) => {
            const o = agendando;
            setAgendando(null);
            onAgendada(o, c.inicio);
          }}
        />
      )}
    </Grupo>
  );
}