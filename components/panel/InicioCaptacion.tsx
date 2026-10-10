"use client";

import { useMemo } from "react";
import Link from "next/link";
import { leerSesion, leerEmpresaActiva, rolEnEmpresaActiva } from "@/lib/auth";
import {
  obtenerResumen, obtenerUso, leadsRecientes, obtenerReporteNegocio, tieneCanalActivo, listarAgenda,
  type Resumen, type Uso, type Lead, type ReporteNegocio,
} from "@/lib/api";
import { IconoRayo, IconoConversaciones, IconoBandeja, IconoSeguimiento, IconoReportes } from "@/components/Iconos";
import { SkeletonMetricas } from "@/components/Skeletons";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { LinkLead } from "@/components/LinkLead";
import { SECCIONES } from "@/components/panel/Sidebar";
import { useCapacidades } from "@/lib/modo-negocio";
import { seccionesDe } from "@/lib/secciones";
import { useDatos } from "@/lib/useDatos";
import { horaLima, inicioDelDiaLima } from "@/lib/agenda";
import {
  ESTADO_ABIERTOS, URL_CONECTAR_CANALES, reunionUnible, urlAgenda, urlCalientesSinAtender, urlLeads,
} from "@/lib/enlaces";

// Accesos rápidos — tarjetas compactas con ícono arriba (diseño Stitch).
// AGENDA ENTRA (2026-10-09) y la lista se filtra igual que el menú: un
// negocio sin embudo no ve "Pipeline", y un puesto que no ve una sección
// tampoco la ve acá (antes se ofrecían puertas que el menú no tenía).
const ACCESOS = [
  { href: "/conversaciones", titulo: "Conversaciones", Icono: IconoConversaciones },
  { href: "/seguimiento", titulo: "Seguimiento", Icono: IconoSeguimiento },
  { href: "/leads", titulo: "Leads", Icono: IconoBandeja },
  { href: "/agenda", titulo: "Agenda", Icono: IconoSeguimiento },
  { href: "/reportes", titulo: "Reportes", Icono: IconoReportes },
];

const NIVEL_PUNTO: Record<string, string> = {
  caliente: "bg-calor",
  tibio: "bg-tibio",
  frio: "bg-frio",
};

// Tiempo relativo corto para "Actividad reciente".
function haceTexto(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

interface DatosInicio {
  resumen: Resumen | null;
  uso: Uso | null;
  recientes: Lead[];
  rep: ReporteNegocio | null;
}

interface ReunionesHoy {
  hoy: number;
  proxima: { id: string; inicio: string; fin: string; meetLink: string | null; leadId: string; nombre: string | null; tenantId?: string } | null;
}

// Inicio del panel — rediseño "Warm Human CRM" (Stitch): saludo + alerta de
// calientes + métricas + accesos rápidos + progreso del mes + actividad reciente.
/**
 * EL INICIO DE UN NEGOCIO QUE CAPTA LEADS.
 *
 * Leads activos, calientes sin atender, ventas cerradas y actividad reciente.
 * Lo ven la inmobiliaria, el estudio contable, la clínica de Sania y el
 * gimnasio de FitCore — todo lo que no vende por carta.
 *
 * ES UNA PANTALLA ENTERA, no un `if` dentro de otra: no comparte con el inicio
 * de restaurante ni las métricas, ni las llamadas, ni los accesos rápidos. Ver
 * `page.tsx` para por qué eso es un Strategy y no un ternario.
 *
 * TODO LLEVA A ALGÚN LADO (2026-10-09): cada número abre la lista de esos
 * leads, la alerta de calientes abre ESOS calientes (con la misma regla que
 * el backend usa para contarlos) y las reuniones de hoy están a un toque.
 */
export function InicioCaptacion() {
  const tenant = leerEmpresaActiva() || "-";
  const negocio = useCapacidades();
  const caps = negocio?.capacidades ?? null;

  /**
   * NINGUNA LLAMADA TUMBA LA PANTALLA (2026-09-18, reporte de Jonathan: su
   * marketero entro por primera vez y vio "No pudimos cargar tus datos").
   *
   * `obtenerResumen()` era la unica sin `.catch`, asi que un 403 -un rol sin
   * permiso para esa ruta- dejaba Inicio en ERROR, no degradado. Ahora todo
   * es best-effort y la pantalla se arma con lo que si pudo traer. El error
   * queda para cuando NADA cargo, que es el unico caso donde reintentar sirve.
   *
   * LO DE LA ÚLTIMA VEZ AL INSTANTE (2026-10-09): al volver a Inicio se pinta
   * lo que ya se sabía y se actualiza por detrás (lib/useDatos).
   */
  const { datos, error, cargando, recargar } = useDatos<DatosInicio>(`inicio@${tenant}`, async () => {
    const [resumen, uso, recientes, rep] = await Promise.all([
      obtenerResumen().catch(() => null),
      obtenerUso().catch(() => null),
      leadsRecientes(3).catch(() => [] as Lead[]),
      obtenerReporteNegocio().catch(() => null), // best-effort (gated por plan)
    ]);
    if (resumen === null && uso === null && recientes.length === 0 && rep === null) {
      throw new Error("Inicio sin datos");
    }
    return { resumen, uso, recientes, rep };
  });

  // ¿HAY WHATSAPP CONECTADO? (2026-09-06, captura de Jonathan en J&V: el
  // canal estaba conectado y el vacío igual gritaba "Conecta WhatsApp").
  // Si la consulta falla se asume que SÍ (ver `tieneCanalActivo`).
  const { datos: tieneCanal } = useDatos(`tiene-canal@${tenant}`, () => tieneCanalActivo(), { maxEdadMs: 60_000 });

  /**
   * LAS REUNIONES DE HOY (2026-10-09). Si el backend ya manda
   * `resumen.reuniones`, se usa eso; si no, se arma con la agenda del día
   * (la de la persona, en todos sus negocios: son SUS reuniones).
   */
  const muestraAgenda = !!caps?.calificaLeads;
  const reunionesDelResumen = datos?.resumen?.reuniones ?? null;
  const { datos: reunionesAgenda } = useDatos<ReunionesHoy>(
    muestraAgenda && datos && !reunionesDelResumen ? `reuniones-hoy@${new Date().toDateString()}` : null,
    async () => {
      const desde = inicioDelDiaLima();
      const hasta = new Date(desde.getTime() + 86_400_000);
      const citas = (await listarAgenda(desde, hasta)).filter((c) => c.estado !== "cancelada");
      const ahora = Date.now();
      const proxima = citas
        .filter((c) => new Date(c.fin).getTime() >= ahora)
        .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
      return {
        hoy: citas.length,
        proxima: proxima
          ? { id: proxima.id, inicio: proxima.inicio, fin: proxima.fin, meetLink: proxima.meetLink, leadId: proxima.leadId, nombre: proxima.cliente, tenantId: proxima.tenantId }
          : null,
      };
    },
    { maxEdadMs: 60_000 },
  );
  const reuniones: ReunionesHoy | null = reunionesDelResumen ?? reunionesAgenda ?? null;

  const accesos = useMemo(() => {
    if (!negocio) return ACCESOS;
    const visibles = new Set(
      seccionesDe(SECCIONES, negocio.capacidades, rolEnEmpresaActiva(), { tienePlacas: negocio.tienePlacas }).map((s) => s.href),
    );
    return ACCESOS.filter((a) => visibles.has(a.href));
  }, [negocio]);

  const sesion = leerSesion();
  const nombre = sesion?.usuario.nombre?.split(" ")[0] ?? "";
  const resumen = datos?.resumen ?? null;
  const uso = datos?.uso ?? null;
  const recientes = datos?.recientes ?? [];
  const rep = datos?.rep ?? null;
  const ok = !!datos;

  const vacio =
    ok &&
    !!resumen &&
    resumen.leadsActivos === 0 &&
    resumen.ventasCerradas === 0 &&
    resumen.calientesSinAtender === 0;

  const clientes = uso?.clientes ?? null;
  const pctClientes = clientes && clientes.limite > 0 ? Math.min(100, Math.round((clientes.usados / clientes.limite) * 100)) : 0;

  // Las tarjetas de métricas son LINKS a la lista de esos leads.
  const KPIS = resumen
    ? [
        { titulo: "Leads activos", valor: resumen.leadsActivos, clase: "text-tinta", href: urlLeads({ estado: ESTADO_ABIERTOS }) },
        { titulo: "Calientes 🔥", valor: resumen.calientesSinAtender, clase: "text-calor", href: urlCalientesSinAtender() },
        { titulo: "Ventas cerradas ✓", valor: resumen.ventasCerradas, clase: "text-ok", href: urlLeads({ estado: "ganado" }) },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[1.8rem] font-bold text-tinta">
          Hola{nombre ? `, ${nombre}` : ""} 👋
        </h1>
        <p className="mt-0.5 text-[0.95rem] text-frio">Así va tu negocio hoy.</p>
      </header>

      {cargando && !datos && <SkeletonMetricas />}

      {!!error && !datos && (
        <ErrorConReintento mensaje="No pudimos cargar tus datos." reintentar={() => void recargar()} />
      )}

      {ok && vacio && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            {tieneCanal === false
              ? "Aún no tienes leads. Conecta WhatsApp para empezar a recibirlos"
              : "Aún no tienes leads."}
          </p>
          {tieneCanal !== false && (
            <p className="mt-1 text-[0.9rem] text-frio">
              Tu WhatsApp está conectado: cuando alguien te escriba, su lead aparece acá solito.
            </p>
          )}
          {tieneCanal === false && (
            <Link
              href={URL_CONECTAR_CANALES}
              className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-sobre-brasa transition active:scale-[0.99]"
            >
              Conectar WhatsApp
            </Link>
          )}
        </div>
      )}

      {ok && resumen && !vacio && (
        <>
          {/* Alerta: calientes sin atender (ícono en círculo + chevron, estilo
              Stitch). Abre ESOS calientes, no la lista entera. */}
          {resumen.calientesSinAtender > 0 && (
            <Link
              href={urlCalientesSinAtender()}
              className="sube flex items-center gap-4 rounded-tarjeta bg-calor px-5 py-4 text-carta shadow-[0_8px_24px_rgba(179,92,0,0.3)] transition hover:shadow-[0_10px_28px_rgba(179,92,0,0.38)] active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-carta/20">
                <IconoRayo className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1.12rem] font-bold leading-tight">
                  {resumen.calientesSinAtender}{" "}
                  {resumen.calientesSinAtender === 1 ? "lead caliente" : "leads calientes"} sin atender
                </p>
                <p className="text-[0.86rem] text-carta/85">Toca para verlos — están listos para cerrar</p>
              </div>
              <span className="shrink-0 text-2xl leading-none text-carta/80">›</span>
            </Link>
          )}

          {/* Métricas: etiqueta arriba, número grande abajo (estilo Stitch).
              Las tarjetas ENTRAN escalonadas (2026-08-22) y cada una abre su
              lista (2026-10-09): un número que no se puede tocar obliga a ir
              a buscar a mano quiénes son. */}
          <div className="grid gap-4 sm:grid-cols-3">
            {KPIS.map((k) => (
              <Link
                key={k.titulo}
                href={k.href}
                className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:-translate-y-0.5 hover:ring-brasa/40 active:scale-[0.99]"
              >
                <p className="text-[0.72rem] font-bold uppercase tracking-wider text-frio">{k.titulo}</p>
                <p className={`mt-2 text-[2.3rem] font-bold leading-none ${k.clase}`}>{k.valor}</p>
                <p className="mt-2 text-[0.74rem] font-semibold text-brasa-texto">Ver la lista ›</p>
              </Link>
            ))}
          </div>

          {/* REUNIONES DE HOY (2026-10-09): la próxima a la vista, con
              "Unirse" cuando está por empezar. */}
          {muestraAgenda && reuniones && <BloqueReuniones r={reuniones} />}

          {/* Accesos rápidos: tarjetas compactas con ícono arriba (estilo Stitch) */}
          {accesos.length > 0 && (
            <div>
              <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Accesos rápidos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {accesos.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="entra flex flex-col items-center gap-2.5 rounded-tarjeta bg-carta px-3 py-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(51,40,31,0.10)] hover:ring-brasa/40 active:scale-[0.98]"
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-arena text-tinta">
                      <a.Icono className="h-5 w-5" />
                    </span>
                    <span className="text-[0.85rem] font-bold text-tinta">{a.titulo}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Progreso del mes + actividad reciente (estilo Stitch) */}
          <div className="grid gap-4 sm:grid-cols-2">
            {clientes && clientes.limite > 0 && (
              <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.85rem] font-bold text-tinta">Clientes atendidos este mes</p>
                  <p className="text-[0.85rem] font-bold tabular-nums text-brasa-texto">
                    {clientes.usados.toLocaleString("es-PE")} <span className="font-normal text-frio">de {clientes.limite.toLocaleString("es-PE")}</span>
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-arena">
                  <div className="h-full rounded-full bg-brasa transition-all" style={{ width: `${pctClientes}%` }} />
                </div>
                <p className="mt-2 text-[0.78rem] text-frio">
                  Te quedan {clientes.restante.toLocaleString("es-PE")} clientes en tu plan.
                </p>
              </div>
            )}

            {recientes.length > 0 && (
              <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold text-tinta">Actividad reciente</p>
                <div className="space-y-2">
                  {recientes.map((l) => {
                    const inicial = (l.nombre ?? l.contactoExterno).trim().charAt(0).toUpperCase();
                    return (
                      <LinkLead
                        key={l.id}
                        id={l.id}
                        className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-arena/50"
                        claseSinPermiso="flex items-center gap-3 rounded-xl px-1 py-1"
                      >
                        {/* Avatar con inicial, teñido por el nivel (diseño Stitch) */}
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.85rem] font-bold text-carta ${NIVEL_PUNTO[l.nivelInteres] ?? "bg-frio"}`}>
                          {inicial}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.88rem] font-semibold leading-tight text-tinta">
                            {l.nombre ?? l.contactoExterno}
                          </span>
                          <span className="block text-[0.72rem] text-frio">{haceTexto(l.actualizadoEn)}</span>
                        </span>
                        <span className="shrink-0 text-lg leading-none text-frio">›</span>
                      </LinkLead>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Línea de ventas + ayuda (fila final del diseño Stitch) */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Mini gráfico de ventas (datos reales de reportes). Sin ventas
                todavía, el recuadro EXPLICA y nada más: llevaba a /flujos,
                que no tiene nada que ver con ventas (2026-10-09). */}
            {rep && rep.evolucion.some((e) => e.ventas > 0) ? (
              <Link
                href="/reportes?t=ventas"
                className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
              >
                <p className="mb-3 text-[0.85rem] font-bold text-tinta">Tus ventas, últimos 6 meses</p>
                <div className="flex h-24 items-end gap-2">
                  {rep.evolucion.map((e) => {
                    const max = Math.max(1, ...rep.evolucion.map((x) => x.ventas));
                    const alto = Math.max(6, Math.round((e.ventas / max) * 100));
                    return (
                      <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t-md bg-brasa/80 transition-all" style={{ height: `${alto}%` }} title={`${e.ventas} ventas`} />
                        <span className="text-[0.62rem] text-frio">{e.mes.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </Link>
            ) : (
              <div className="grid place-items-center rounded-tarjeta border-2 border-dashed border-linea bg-carta/50 p-6 text-center">
                <div>
                  <p className="text-[0.9rem] font-bold text-tinta-2">📈 Línea de tiempo de ventas</p>
                  <p className="mt-1 text-[0.8rem] text-frio">
                    Cuando cierres tus primeras ventas, aquí vas a ver cómo evolucionan mes a mes.
                  </p>
                </div>
              </div>
            )}

            {/* Tarjeta de ayuda (slate navy, como el mock). SOLO si NO hay
                canal (2026-10-09): a quien ya conectó le preguntaba si
                todavía no había conectado. */}
            {tieneCanal === false && (
              <div className="flex flex-col justify-between rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)]">
                <div>
                  <p className="text-[1rem] font-bold leading-snug">¿Todavía no conectaste tus redes?</p>
                  <p className="mt-1 text-[0.84rem] text-arena/70">
                    Conecta tu WhatsApp y deja todo listo — o prueba tu bot mientras tanto.
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={URL_CONECTAR_CANALES}
                    className="inline-flex w-fit items-center rounded-chip bg-brasa px-4 py-2 text-sm font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
                  >
                    Conectar mis redes
                  </Link>
                  <Link
                    href="/probar-bot"
                    className="inline-flex w-fit items-center rounded-chip px-4 py-2 text-sm font-bold text-arena ring-1 ring-arena/30 transition hover:bg-arena/10"
                  >
                    Probar mi bot
                  </Link>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** "Reuniones de hoy": cuántas, la próxima y "Unirse" si está por empezar. */
function BloqueReuniones({ r }: { r: ReunionesHoy }) {
  const p = r.proxima;
  const unible = !!p?.meetLink && reunionUnible(p);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] font-bold uppercase tracking-wider text-frio">Reuniones de hoy</p>
        {r.hoy === 0 ? (
          <p className="mt-1 text-[0.95rem] font-semibold text-tinta">No tienes reuniones hoy.</p>
        ) : p ? (
          <p className="mt-1 text-[0.95rem] text-tinta">
            <b>{r.hoy}</b> {r.hoy === 1 ? "reunión" : "reuniones"} · la próxima a las <b>{horaLima(p.inicio)}</b>
            {p.nombre ? <> con <LinkLead id={p.leadId} tenant={p.tenantId} className="font-semibold text-brasa-texto hover:underline" claseSinPermiso="font-semibold">{p.nombre}</LinkLead></> : null}
          </p>
        ) : (
          <p className="mt-1 text-[0.95rem] text-tinta">
            <b>{r.hoy}</b> {r.hoy === 1 ? "reunión" : "reuniones"} hoy · ya no quedan más.
          </p>
        )}
      </div>
      {unible && (
        <a
          href={p!.meetLink!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-chip bg-brasa px-4 py-2 text-[0.85rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
        >
          Unirse
        </a>
      )}
      <Link
        href={urlAgenda({ fecha: "hoy", vista: "dia" })}
        className="shrink-0 rounded-chip bg-arena px-4 py-2 text-[0.85rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2"
      >
        Ver la agenda de hoy
      </Link>
    </div>
  );
}
