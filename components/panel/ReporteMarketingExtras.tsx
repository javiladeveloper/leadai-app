"use client";

import { useMemo, useState } from "react";
import {
  activarReporteSemanal, borrarNotaMarketing, crearNotaMarketing, crearPublicoConLeads, guardarMetasMarketing,
  type AtencionReporte, type DiaMarketing, type MetasMarketing, type NotaMarketing,
} from "@/lib/api";

/**
 * LAS PIEZAS NUEVAS DEL REPORTE DE MARKETING (2026-10-07, Jonathan: "me
 * encantan, ve con las 10"). Viven aparte de ReporteMarketing.tsx para que
 * ese archivo siga leyéndose de arriba a abajo.
 */

export const soles = (c: number | null | undefined) =>
  typeof c === "number" && Number.isFinite(c)
    ? `S/${(c / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "—";
const fechaCorta = (v: string) => {
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
};
const hoyLima = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

// ── 1. Comparación con el período anterior ───────────────────────────

/**
 * "↓18 %" en verde o rojo según convenga. En un COSTO bajar es bueno; en una
 * CANTIDAD (leads, demos) subir es bueno. Sin dato anterior no se pinta nada:
 * un "+100 %" contra cero no le dice nada a nadie.
 */
export function Cambio({ actual, previo, menosEsMejor = false }: { actual: number | null | undefined; previo: number | null | undefined; menosEsMejor?: boolean }) {
  if (actual == null || !previo) return null;
  const p = Math.round(((actual - previo) / previo) * 100);
  if (p === 0) return <span className="text-[0.7rem] font-semibold text-frio">= anterior</span>;
  const bueno = menosEsMejor ? p < 0 : p > 0;
  return (
    <span className={`text-[0.7rem] font-bold tabular-nums ${bueno ? "text-ok" : "text-calor-hondo"}`} title="Contra el período anterior del mismo largo">
      {p > 0 ? "↑" : "↓"}{Math.abs(p)} %
    </span>
  );
}

// ── 2. Gráfico diario + bitácora ─────────────────────────────────────

/**
 * Barras de leads por día, la línea del gasto encima, y una marca vertical en
 * cada cambio anotado. Es SVG a mano: un gráfico, no una librería.
 */
export function GraficoDiario({ dias, notas }: { dias: DiaMarketing[]; notas: NotaMarketing[] }) {
  const [foco, setFoco] = useState<number | null>(null);
  if (dias.length === 0) return null;
  const W = 720, H = 180, PAD = 22;
  const maxLeads = Math.max(1, ...dias.map((d) => d.leads));
  const maxGasto = Math.max(1, ...dias.map((d) => d.gastoCentavos));
  const paso = (W - PAD * 2) / dias.length;
  const x = (i: number) => PAD + i * paso + paso / 2;
  const yLeads = (n: number) => H - PAD - (n / maxLeads) * (H - PAD * 2);
  const yGasto = (c: number) => H - PAD - (c / maxGasto) * (H - PAD * 2);
  const linea = dias.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yGasto(d.gastoCentavos).toFixed(1)}`).join(" ");
  const indice = new Map(dias.map((d, i) => [d.fecha, i]));
  const d = foco !== null ? dias[foco] : null;

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Día por día</p>
        <p className="flex flex-wrap items-center gap-3 text-[0.72rem] text-frio">
          <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-brasa/50" /> Leads</span>
          <span className="flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-sm bg-ok" /> Con demo</span>
          <span className="flex items-center gap-1"><span aria-hidden className="h-0.5 w-3 bg-calor" /> Gasto</span>
          <span className="flex items-center gap-1"><span aria-hidden className="h-3 w-0.5 bg-tinta" /> Cambio anotado</span>
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[34rem]" role="img" aria-label="Leads, demos y gasto por día" onMouseLeave={() => setFoco(null)}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={PAD} x2={W - PAD} y1={PAD + (H - PAD * 2) * f} y2={PAD + (H - PAD * 2) * f} className="stroke-linea" strokeWidth={1} />
          ))}
          {dias.map((dd, i) => (
            <g key={dd.fecha} onMouseEnter={() => setFoco(i)}>
              <rect x={x(i) - paso / 2} y={PAD} width={paso} height={H - PAD * 2} fill="transparent" />
              <rect x={x(i) - paso * 0.32} y={yLeads(dd.leads)} width={paso * 0.64} height={H - PAD - yLeads(dd.leads)} rx={2} className={foco === i ? "fill-brasa/80" : "fill-brasa/45"} />
              {dd.demos > 0 && <rect x={x(i) - paso * 0.32} y={yLeads(dd.demos)} width={paso * 0.64} height={H - PAD - yLeads(dd.demos)} rx={2} className="fill-ok" />}
            </g>
          ))}
          <path d={linea} fill="none" className="stroke-calor" strokeWidth={2} strokeLinejoin="round" />
          {notas.map((n) => {
            const i = indice.get(n.fecha);
            if (i === undefined) return null;
            return (
              <g key={n.id}>
                <line x1={x(i) - paso / 2} x2={x(i) - paso / 2} y1={PAD - 8} y2={H - PAD} className="stroke-tinta" strokeWidth={1.5} strokeDasharray="3 3" />
                <circle cx={x(i) - paso / 2} cy={PAD - 8} r={4} className="fill-tinta"><title>{`${fechaCorta(n.fecha)}: ${n.texto}`}</title></circle>
              </g>
            );
          })}
          <text x={PAD} y={H - 6} className="fill-frio text-[10px]">{fechaCorta(dias[0].fecha)}</text>
          <text x={W - PAD} y={H - 6} textAnchor="end" className="fill-frio text-[10px]">{fechaCorta(dias[dias.length - 1].fecha)}</text>
        </svg>
      </div>
      <p className="mt-1 min-h-[1.2rem] text-[0.8rem] text-tinta-2" aria-live="polite">
        {d ? <>{fechaCorta(d.fecha)}: <b>{d.leads}</b> leads, <b>{d.demos}</b> con demo, {soles(d.gastoCentavos)} invertidos</> : <span className="text-frio">Pasa el cursor por un día para ver el detalle.</span>}
      </p>
    </div>
  );
}

/**
 * LA BITÁCORA: "8-oct entra el video nuevo". Cada nota trae la semana de
 * antes contra la de después, que es lo que dice si el cambio sirvió.
 */
export function Bitacora({ notas, recargar, tenant }: { notas: NotaMarketing[]; recargar: () => void; tenant?: string }) {
  const [fecha, setFecha] = useState(hoyLima());
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (texto.trim().length < 3) return;
    setEnviando(true); setError(null);
    try {
      await crearNotaMarketing(fecha, texto.trim(), tenant);
      setTexto("");
      recargar();
    } catch {
      setError("No se pudo guardar la nota. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }
  async function borrar(id: string) {
    try { await borrarNotaMarketing(id, tenant); recargar(); } catch { setError("No se pudo borrar la nota."); }
  }

  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Bitácora de cambios</p>
      <p className="mt-1 text-[0.8rem] text-frio">Anota cada cambio en los anuncios. Aparece en el gráfico y, a los 3 días, compara la semana de antes con la de después.</p>
      <form onSubmit={guardar} className="mt-3 flex flex-wrap gap-2">
        <input type="date" value={fecha} max={hoyLima()} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha del cambio"
          className="rounded-chip bg-arena/60 px-3 py-1.5 text-[0.82rem] text-tinta ring-1 ring-linea focus:outline-none focus:ring-brasa" />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={280} aria-label="Qué cambió"
          placeholder="Ej.: entra el video nuevo y se pausa el duplicado"
          className="min-w-[14rem] flex-1 rounded-chip bg-arena/60 px-3 py-1.5 text-[0.82rem] text-tinta ring-1 ring-linea focus:outline-none focus:ring-brasa" />
        <button type="submit" disabled={enviando || texto.trim().length < 3}
          className="rounded-chip bg-brasa px-4 py-1.5 text-[0.82rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50">
          {enviando ? "Guardando…" : "Anotar"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-[0.8rem] text-calor-hondo">{error}</p>}
      {notas.length > 0 && (
        <ul className="mt-4 space-y-2">
          {[...notas].reverse().map((n) => (
            <li key={n.id} className="rounded-lg bg-arena/40 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[0.86rem] text-tinta"><b>{fechaCorta(n.fecha)}</b> · {n.texto}</p>
                <button type="button" onClick={() => borrar(n.id)} aria-label={`Borrar la nota del ${fechaCorta(n.fecha)}`}
                  className="shrink-0 rounded px-1.5 text-[0.9rem] text-frio hover:text-calor-hondo">×</button>
              </div>
              {n.efecto ? (
                <p className="mt-1 text-[0.76rem] text-tinta-2">
                  Semana antes: {n.efecto.antes.leads} leads, {n.efecto.antes.demos} demos, {soles(n.efecto.antes.costoPorLeadCentavos)} por lead ·
                  {" "}después ({n.efecto.despues.dias} días): <b>{n.efecto.despues.leads} leads, {n.efecto.despues.demos} demos, {soles(n.efecto.despues.costoPorLeadCentavos)} por lead</b>
                  {" "}<Cambio actual={n.efecto.despues.costoPorLeadCentavos} previo={n.efecto.antes.costoPorLeadCentavos} menosEsMejor />
                </p>
              ) : (
                <p className="mt-1 text-[0.74rem] text-frio">El antes y después aparece a los 3 días del cambio.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 4. ¿Falló el anuncio o la atención? ──────────────────────────────

const minutos = (m: number | null) => (m === null ? "—" : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`);
export { minutos as tiempoRespuesta };

export function TarjetaAtencion({ a }: { a: AtencionReporte }) {
  if (a.alEquipo === 0) return null;
  const lento = (a.medianaRespuestaMin ?? 0) >= 60;
  return (
    <div className={`rounded-tarjeta bg-carta p-5 ring-1 ${a.seEnfriaron || lento ? "ring-calor/40" : "ring-linea"}`}>
      <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">¿Falló el anuncio o la atención?</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato n={a.alEquipo} titulo="Pidieron a una persona" />
        <Dato n={minutos(a.medianaRespuestaMin)} titulo="Tardó el equipo (mediana)" alerta={lento} />
        <Dato n={a.seEnfriaron} titulo="Nadie les contestó" alerta={a.seEnfriaron > 0} />
        <Dato n={a.esperando} titulo="Esperando ahora" alerta={a.esperando > 0} />
      </div>
      <p className="mt-3 text-[0.78rem] text-frio">
        Un lead caliente que espera horas se enfría aunque el anuncio haya sido perfecto. Esto separa lo que es de publicidad de lo que es de ventas.
      </p>
    </div>
  );
}

function Dato({ n, titulo, alerta = false }: { n: number | string; titulo: string; alerta?: boolean }) {
  return (
    <div>
      <p className={`text-[1.5rem] font-bold leading-none tabular-nums ${alerta ? "text-calor-hondo" : "text-tinta"}`}>{n}</p>
      <p className="mt-1 text-[0.74rem] text-frio">{titulo}</p>
    </div>
  );
}

// ── 6. Qué los frena y qué preguntan ─────────────────────────────────

export function FrenosYTemas({ objeciones, temas, total }: { objeciones: { clave: string; leads: number }[]; temas: { clave: string; leads: number }[]; total: number }) {
  if (!objeciones.length && !temas.length) return null;
  const lista = (xs: { clave: string; leads: number }[], color: string) => {
    const max = Math.max(1, ...xs.map((x) => x.leads));
    return (
      <ul className="mt-3 space-y-2">
        {xs.slice(0, 6).map((x) => (
          <li key={x.clave}>
            <div className="flex items-baseline justify-between gap-2 text-[0.85rem]">
              <span className="truncate text-tinta">{x.clave}</span>
              <span className="shrink-0 tabular-nums text-frio"><b className="text-tinta">{x.leads}</b> de {total}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-arena"><div className={`h-full rounded ${color}`} style={{ width: `${Math.round((x.leads / max) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    );
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Qué los frena</p>
        {objeciones.length ? lista(objeciones, "bg-calor/70") : <p className="mt-2 text-[0.85rem] text-frio">Ningún motivo claro en los resúmenes del período.</p>}
      </div>
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Qué preguntan</p>
        {temas.length ? lista(temas, "bg-brasa/70") : <p className="mt-2 text-[0.85rem] text-frio">Sin temas claros en los resúmenes del período.</p>}
      </div>
      <p className="text-[0.74rem] text-frio lg:col-span-2">Se lee de las palabras del resumen que arma la IA de cada conversación: sirve para el texto del próximo anuncio.</p>
    </div>
  );
}

// ── 7. Hora del día ──────────────────────────────────────────────────

export function PorHora({ horas }: { horas: { hora: number; leads: number; calientes: number; demos: number }[] }) {
  const max = Math.max(1, ...horas.map((h) => h.leads));
  const mejor = [...horas].sort((a, b) => b.demos - a.demos || b.calientes - a.calientes)[0];
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">A qué hora escriben</p>
        {mejor && mejor.demos > 0 && <p className="text-[0.76rem] text-tinta-2">Las demos salen más a las <b>{mejor.hora}:00</b></p>}
      </div>
      <div className="mt-4 flex items-end gap-[3px]" style={{ height: 110 }}>
        {horas.map((h) => (
          <div key={h.hora} className="relative flex-1 overflow-hidden rounded-t bg-brasa/50"
            style={{ height: `${Math.round((h.leads / max) * 100)}%`, minHeight: h.leads ? 3 : 0 }}
            title={`${h.hora}:00 — ${h.leads} leads, ${h.calientes} calientes, ${h.demos} demos`}>
            <div className="absolute inset-x-0 bottom-0 bg-ok" style={{ height: h.leads ? `${Math.round((h.demos / h.leads) * 100)}%` : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[0.68rem] text-frio"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
      <p className="mt-2 text-[0.74rem] text-frio">Verde = los que terminaron en demo. Sirve para programar los anuncios y para saber cuándo tiene que haber alguien atendiendo.</p>
    </div>
  );
}

// ── 8. Metas + 5. reporte semanal ────────────────────────────────────

export function MetasYAvisos({ metas, semanal, recargar, tenant }: { metas: MetasMarketing; semanal: boolean; recargar: () => void; tenant?: string }) {
  const aSoles = (c?: number | null) => (c ? String(c / 100) : "");
  const [lead, setLead] = useState(aSoles(metas.costoLeadCentavos));
  const [demo, setDemo] = useState(aSoles(metas.costoDemoCentavos));
  const [estado, setEstado] = useState<"" | "guardando" | "listo" | "error">("");
  const [activo, setActivo] = useState(semanal);

  const aCentavos = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  };
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("guardando");
    try {
      await guardarMetasMarketing({ costoLeadCentavos: aCentavos(lead), costoDemoCentavos: aCentavos(demo) }, tenant);
      setEstado("listo");
      recargar();
    } catch { setEstado("error"); }
  }
  async function alternar() {
    const nuevo = !activo;
    setActivo(nuevo);
    try { await activarReporteSemanal(nuevo, tenant); } catch { setActivo(!nuevo); }
  }

  const campo = "w-24 rounded-chip bg-arena/60 px-3 py-1.5 text-right text-[0.85rem] tabular-nums text-tinta ring-1 ring-linea focus:outline-none focus:ring-brasa";
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={guardar} className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Tus metas de costo</p>
        <p className="mt-1 text-[0.8rem] text-frio">Con esto cada anuncio sale en verde, amarillo o rojo. Manda la de demo; la de lead se usa si no hay de demo.</p>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.85rem] text-tinta-2">
          <label className="flex items-center gap-2">Una demo, máximo S/<input inputMode="decimal" value={demo} onChange={(e) => setDemo(e.target.value)} className={campo} aria-label="Meta de costo por demo en soles" /></label>
          <label className="flex items-center gap-2">Un lead, máximo S/<input inputMode="decimal" value={lead} onChange={(e) => setLead(e.target.value)} className={campo} aria-label="Meta de costo por lead en soles" /></label>
          <button type="submit" disabled={estado === "guardando"} className="rounded-chip bg-brasa px-4 py-1.5 text-[0.82rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50">
            {estado === "guardando" ? "Guardando…" : "Guardar metas"}
          </button>
        </div>
        {estado === "listo" && <p role="status" className="mt-2 text-[0.78rem] text-ok">Metas guardadas.</p>}
        {estado === "error" && <p role="alert" className="mt-2 text-[0.78rem] text-calor-hondo">No se pudieron guardar. Inténtalo de nuevo.</p>}
      </form>
      <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">Reporte semanal</p>
            <p className="mt-1 text-[0.8rem] text-frio">
              Los lunes a las 8 a. m.: lo invertido, cuánto costó cada demo, el mejor y el peor anuncio y lo que dicen los números.
              Llega por correo al dueño, administradores y marketing, y por WhatsApp al número de alertas.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={activo} onClick={alternar} aria-label="Reporte semanal"
            className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition ${activo ? "bg-brasa" : "bg-arena-2"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-carta shadow transition-all ${activo ? "left-[1.4rem]" : "left-0.5"}`} />
          </button>
        </div>
        <p className="mt-2 text-[0.78rem] font-semibold text-tinta-2">{activo ? "Activo: el próximo lunes te llega." : "Apagado."}</p>
      </div>
    </div>
  );
}

// ── 9. Del reporte a un público de Meta ──────────────────────────────

/**
 * Los leads filtrados como público de Meta, para retargeting. Solo el dueño o
 * un administrador (decisión de Jonathan del 17-sep: son teléfonos de
 * terceros). Al marketero se le explica en vez de esconderle la idea.
 */
export function CrearPublico({ ids, puede, tenant }: { ids: string[]; puede: boolean; tenant?: string }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [similar, setSimilar] = useState(false);
  const [estado, setEstado] = useState<{ tipo: "" | "enviando" | "ok" | "error"; texto?: string }>({ tipo: "" });
  const sugerido = useMemo(() => `Leads del reporte ${new Date().toLocaleDateString("es-PE", { day: "numeric", month: "short" })}`, []);

  if (!puede) {
    return <p className="text-[0.76rem] text-frio">¿Quieres un público de Meta con estos leads? Pídeselo al dueño del negocio: crearlo sube sus teléfonos.</p>;
  }
  if (!abierto) {
    return (
      <button type="button" onClick={() => { setAbierto(true); setNombre(sugerido); }} disabled={ids.length === 0}
        className="rounded-chip bg-arena px-3 py-1.5 text-[0.78rem] font-semibold text-tinta-2 transition hover:bg-arena-2 disabled:opacity-50">
        Crear público en Meta con estos {ids.length}
      </button>
    );
  }
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEstado({ tipo: "enviando" });
    try {
      const r = await crearPublicoConLeads(ids, nombre.trim(), similar, tenant);
      setEstado({ tipo: "ok", texto: `Público creado${r.contactos ? ` con ${r.contactos} contactos` : ""}. Lo encuentras en Meta y en Marketing → Públicos.` });
    } catch (err) {
      setEstado({ tipo: "error", texto: (err as Error).message || "No se pudo crear el público." });
    }
  }
  return (
    <form onSubmit={crear} className="flex flex-wrap items-center gap-2 rounded-lg bg-arena/50 px-3 py-2">
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} minLength={3} maxLength={80} aria-label="Nombre del público"
        className="min-w-[12rem] flex-1 rounded-chip bg-carta px-3 py-1.5 text-[0.82rem] text-tinta ring-1 ring-linea focus:outline-none focus:ring-brasa" />
      <label className="flex items-center gap-1.5 text-[0.78rem] text-tinta-2">
        <input type="checkbox" checked={similar} onChange={(e) => setSimilar(e.target.checked)} /> y uno similar
      </label>
      <button type="submit" disabled={estado.tipo === "enviando" || nombre.trim().length < 3}
        className="rounded-chip bg-brasa px-3 py-1.5 text-[0.78rem] font-semibold text-sobre-brasa disabled:opacity-50">
        {estado.tipo === "enviando" ? "Creando…" : `Crear con ${ids.length} leads`}
      </button>
      <button type="button" onClick={() => setAbierto(false)} className="text-[0.78rem] text-frio hover:text-tinta">Cancelar</button>
      {estado.texto && <p role={estado.tipo === "error" ? "alert" : "status"} className={`w-full text-[0.76rem] ${estado.tipo === "error" ? "text-calor-hondo" : "text-ok"}`}>{estado.texto}</p>}
      <p className="w-full text-[0.72rem] text-frio">Meta pide al menos 100 contactos que pueda reconocer; los que pidieron no ser contactados no se suben.</p>
    </form>
  );
}

// ── 8 y 10 en la fila del anuncio ────────────────────────────────────

const SEMAFORO: Record<string, { clase: string; texto: string }> = {
  verde: { clase: "bg-ok", texto: "Dentro de tu meta" },
  amarillo: { clase: "bg-tibio", texto: "Un poco por encima de tu meta" },
  rojo: { clase: "bg-calor-hondo", texto: "Muy por encima de tu meta" },
};
export function PuntoSemaforo({ s }: { s?: string | null }) {
  const x = s ? SEMAFORO[s] : undefined;
  if (!x) return null;
  return <span role="img" aria-label={x.texto} title={x.texto} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${x.clase}`} />;
}
export function ChipCansancio({ nivel, motivo }: { nivel?: "alto" | "medio" | null; motivo?: string | null }) {
  if (!nivel) return null;
  return (
    <span title={motivo ?? undefined} className={`rounded-chip px-1.5 py-px font-bold ${nivel === "alto" ? "bg-calor/15 text-calor-hondo" : "bg-tibio-suave text-tinta-2"}`}>
      {nivel === "alto" ? "Cansado" : "Cansándose"}
    </span>
  );
}
