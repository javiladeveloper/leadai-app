"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  obtenerAlertas, obtenerResumen, paginaLeadsFiltrada, paginaBandejaGlobalFiltrada, negociosGlobal,
  type Alerta, type Lead, type Resumen,
} from "@/lib/api";
import { tieneVariosNegocios } from "@/lib/auth";
import { useAbrirLead } from "@/components/LinkLead";
import {
  esCalienteSinAtender, urlCalientesSinAtender, URL_MI_PLAN, TEXTO_MEJORAR_PLAN,
  reunionEnLaProximaHora, reunionUnible, urlAgenda,
} from "@/lib/enlaces";
import { diaLima, horaLima } from "@/lib/agenda";

type Reunion = NonNullable<NonNullable<Resumen["reuniones"]>["proxima"]> & { tenantId: string | undefined };

// La campana es GLOBAL en el panel unificado (decisión 2026-07-22): con 2+
// negocios junta los calientes y los avisos de saldo de TODOS.
type LeadCampana = Lead & { tenantId?: string };

// Campana de avisos del header. Junta dos cosas:
//  1) leads calientes sin atender (del /resumen) — el número del badge.
//  2) avisos de saldo del backend (/alertas): cuota por agotarse o, lo más
//     crítico, "sin saldo → el bot se pausó". Ese aviso es lo más importante:
//     si no, Guisella no se entera de que su bot dejó de responder.
// Se refresca sola cada 30s. Al tocarla abre un panel con los avisos.
export function CampanaAlertas() {
  const router = useRouter();
  const abrirLead = useAbrirLead();
  // EL NÚMERO SALE DE /resumen (2026-10-09). Antes, cada 30 s, la campana
  // bajaba TODOS los leads calientes —hasta 20 páginas de 100— solo para
  // contarlos. Ahora pide el conteo que el backend ya calcula (la misma regla
  // que el número de Inicio: caliente y ni ganado ni perdido), y los NOMBRES
  // recién cuando se abre el panel, una sola página.
  const [calientes, setCalientes] = useState(0);
  const [calientesLeads, setCalientesLeads] = useState<LeadCampana[] | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  // LA REUNIÓN QUE VIENE (2026-10-09): /resumen ya trae la próxima; si es
  // dentro de la hora, la campana la avisa con "Unirse" y "Ver cita". Con
  // varios negocios, la más cercana de todos.
  const [reunion, setReunion] = useState<Reunion | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [abierto, setAbierto] = useState(false);
  const [agita, setAgita] = useState(false);
  const previo = useRef<number>(-1);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      const varios = tieneVariosNegocios();
      // Los resúmenes (uno por negocio): de ahí salen el conteo y la reunión.
      const traerResumenes: Promise<{ r: Resumen; tenantId?: string }[]> = varios
        ? negociosGlobal().then((ns) =>
            Promise.all(ns.map((n) => obtenerResumen(n.tenantId).then((r) => ({ r, tenantId: n.tenantId })).catch(() => null)))
              .then((xs) => xs.filter((x): x is { r: Resumen; tenantId: string } => x !== null)),
          )
        : obtenerResumen().then((r) => [{ r }]);
      traerResumenes.then((resumenes) => {
        if (!vivo) return;
        setAhora(Date.now());
        const proximas = resumenes
          .map(({ r, tenantId }) => (r.reuniones?.proxima ? { ...r.reuniones.proxima, tenantId } : null))
          .filter((x): x is Reunion => x !== null)
          .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
        setReunion(proximas[0] ?? null);
        return resumenes.reduce((a, { r }) => a + r.calientesSinAtender, 0);
      }).then((nuevo) => {
        if (nuevo === undefined) return;
        if (!vivo) return;
        if (previo.current >= 0 && nuevo > previo.current) {
          sonarAviso();
          setAgita(true);
          setTimeout(() => setAgita(false), 900);
        }
        // Cambió el número: los nombres que se vieron ya no son los de ahora.
        if (nuevo !== previo.current) setCalientesLeads(null);
        previo.current = nuevo;
        setCalientes(nuevo);
      }).catch(() => undefined);
      // Avisos de saldo: con varios negocios se juntan los de todos.
      const traerAlertas: Promise<Alerta[]> = varios
        ? negociosGlobal().then((ns) =>
            Promise.all(ns.map((n) => obtenerAlertas(n.tenantId))).then((r) => r.flat()),
          )
        : obtenerAlertas();
      traerAlertas.then((a) => {
        if (vivo) setAlertas(a);
      });
    };
    cargar();
    const id = setInterval(cargar, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  // Los nombres, al abrir el panel (y si el número cambió desde la última vez).
  useEffect(() => {
    if (!abierto || calientesLeads !== null || calientes === 0) return;
    let vivo = true;
    const pagina: Promise<LeadCampana[]> = tieneVariosNegocios()
      ? paginaBandejaGlobalFiltrada({ nivel: "caliente" }, null, 25).then((r) => r.items)
      : paginaLeadsFiltrada({ nivel: "caliente" }, null, 25).then((r) => r.items);
    pagina
      .then((ls) => { if (vivo) setCalientesLeads(ls.filter(esCalienteSinAtender)); })
      .catch(() => { if (vivo) setCalientesLeads([]); });
    return () => { vivo = false; };
  }, [abierto, calientesLeads, calientes]);

  // La alerta más grave que exista: "bloqueo" (sin saldo, bot pausado) manda.
  const bloqueo = alertas.find((a) => a.tipo === "bloqueo");
  const umbral = !bloqueo ? alertas.find((a) => a.tipo === "umbral") : undefined;
  const reunionCerca = reunion && reunionEnLaProximaHora(reunion, new Date(ahora)) ? reunion : null;
  // Cada aviso con su link suma: calientes, el tope de clientes, la cuota por
  // agotarse y la reunión que viene.
  const totalAvisos = calientes + (bloqueo ? 1 : 0) + (umbral ? 1 : 0) + (reunionCerca ? 1 : 0);
  const hay = totalAvisos > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={hay ? `${totalAvisos} avisos` : "Sin avisos"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 ${bloqueo ? "text-alerta" : hay ? "text-orbita" : "text-arena/60"} ${agita ? "animate-campana" : ""}`}
          style={{ transformOrigin: "top center" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {hay && (
          <span className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.62rem] font-bold text-carta ${bloqueo ? "bg-alerta" : "bg-orbita"}`}>
            {totalAvisos > 9 ? "9+" : totalAvisos}
          </span>
        )}
      </button>

      {/* Panel de avisos */}
      {abierto && (
        <>
          {/* Fondo para cerrar al tocar afuera */}
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-tarjeta bg-carta shadow-[var(--sombra-flotante)] ring-1 ring-linea">
            <p className="border-b border-linea px-4 py-2.5 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Avisos</p>

            {/* Aviso crítico de saldo */}
            {bloqueo && (
              <div className="border-b border-linea bg-calor-suave px-4 py-3">
                <p className="text-[0.9rem] font-bold text-calor-hondo">⚠️ Llegaste al tope de clientes del mes</p>
                <p className="mt-0.5 text-[0.82rem] text-tinta-2">
                  El bot dejó de atender nuevos clientes. Amplía tu plan para reactivarlo.
                </p>
                <button
                  onClick={() => { setAbierto(false); router.push(URL_MI_PLAN); }}
                  className="mt-2 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
                >
                  {TEXTO_MEJORAR_PLAN}
                </button>
              </div>
            )}

            {/* Aviso de cuota por agotarse (umbral), si no hay bloqueo. Toda
                la tarjeta lleva a Mi plan (2026-10-09): antes solo el textito. */}
            {umbral && (
              <button
                type="button"
                onClick={() => { setAbierto(false); router.push(URL_MI_PLAN); }}
                className="block min-h-0 w-full border-b border-linea bg-tibio-suave px-4 py-3 text-left transition hover:bg-tibio-suave/70"
              >
                <span className="block text-[0.88rem] font-semibold text-tibio">Se te están por acabar los clientes del mes</span>
                <span className="mt-1 block text-[0.8rem] font-semibold text-brasa-texto">{TEXTO_MEJORAR_PLAN} →</span>
              </button>
            )}

            {/* La reunión de la próxima hora (2026-10-09). */}
            {reunionCerca && (
              <div className="border-b border-linea bg-brasa-suave/60 px-4 py-3">
                <p className="text-[0.88rem] font-bold text-tinta">
                  📅 Reunión {new Date(reunionCerca.inicio).getTime() <= ahora ? "en curso" : `a las ${horaLima(reunionCerca.inicio)}`}
                  {reunionCerca.nombre ? ` con ${reunionCerca.nombre}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {reunionCerca.meetLink && reunionUnible(reunionCerca, new Date(ahora)) && (
                    <a
                      href={reunionCerca.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setAbierto(false)}
                      className="rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
                    >
                      Unirse
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAbierto(false);
                      router.push(urlAgenda({ fecha: diaLima(reunionCerca.inicio), cita: reunionCerca.id, vista: "dia" }));
                    }}
                    className="min-h-0 rounded-chip bg-carta px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
                  >
                    Ver cita
                  </button>
                </div>
              </div>
            )}

            {/* Leads calientes sin atender: lista con nombres, cada uno lleva
                a su conversación. Mostramos hasta 5 y un "ver todos" si hay más. */}
            {calientes > 0 && (
              <div>
                <p className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[0.78rem] font-bold text-calor-hondo">
                  🔴 {calientes} {calientes === 1 ? "lead caliente sin atender" : "leads calientes sin atender"}
                </p>
                {calientesLeads === null && (
                  <p className="px-4 py-2 text-[0.8rem] text-frio" aria-busy="true">Buscando quiénes son…</p>
                )}
                {(calientesLeads ?? []).slice(0, 5).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setAbierto(false);
                      // A la ficha única, con el negocio del lead.
                      abrirLead(l.id, l.tenantId);
                    }}
                    className="flex w-full flex-col gap-0.5 px-4 py-2 text-left transition hover:bg-arena/50"
                  >
                    <span className="text-[0.9rem] font-semibold text-tinta">
                      {l.nombre ?? l.contactoExterno}
                    </span>
                    {l.resumenIA && (
                      <span className="line-clamp-1 text-[0.78rem] text-frio">{l.resumenIA}</span>
                    )}
                  </button>
                ))}
                {calientes > 5 && (
                  <button
                    onClick={() => { setAbierto(false); router.push(urlCalientesSinAtender()); }}
                    className="w-full px-4 py-2 text-left text-[0.8rem] font-semibold text-brasa-texto transition hover:bg-arena/50"
                  >
                    Ver los {calientes} →
                  </button>
                )}
              </div>
            )}

            {/* Nada */}
            {!hay && (
              <p className="px-4 py-6 text-center text-[0.85rem] text-frio">No tienes avisos por ahora 👌</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Beep corto de aviso usando la Web Audio API — sin archivos de audio externos.
// Defensivo: si el navegador bloquea audio (sin interacción previa) o no soporta
// la API, falla en silencio sin romper la campana.
function sonarAviso() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notas = [
      { freq: 880, inicio: 0, dur: 0.14 },
      { freq: 1175, inicio: 0.13, dur: 0.2 },
    ];
    for (const n of notas) {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const t0 = ctx.currentTime + n.inicio;
      gan.gain.setValueAtTime(0.0001, t0);
      gan.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gan);
      gan.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Silencio: el aviso visual sigue funcionando.
  }
}
