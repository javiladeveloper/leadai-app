"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerAlertas, listarLeads, listarBandejaGlobal, negociosGlobal, type Alerta, type Lead } from "@/lib/api";
import { tieneVariosNegocios, guardarEmpresaActiva } from "@/lib/auth";

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
  const [calientesLeads, setCalientesLeads] = useState<LeadCampana[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [agita, setAgita] = useState(false);
  const previo = useRef<number>(-1);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      const varios = tieneVariosNegocios();
      // Traemos los leads calientes REALES (no solo el número) y nos quedamos
      // con los "sin atender" (no ganados/perdidos): son los que hay que
      // llamar. Con varios negocios, de TODOS (bandeja global).
      const traerCalientes: Promise<LeadCampana[]> = varios
        ? listarBandejaGlobal({ nivel: "caliente" }).then((r) => r.leads)
        : listarLeads({ nivel: "caliente" });
      traerCalientes.then((leads) => {
        if (!vivo) return;
        const sinAtender = leads.filter((l) => l.estado !== "ganado" && l.estado !== "perdido");
        const nuevo = sinAtender.length;
        if (previo.current >= 0 && nuevo > previo.current) {
          sonarAviso();
          setAgita(true);
          setTimeout(() => setAgita(false), 900);
        }
        previo.current = nuevo;
        setCalientesLeads(sinAtender);
      });
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

  // La alerta más grave que exista: "bloqueo" (sin saldo, bot pausado) manda.
  const bloqueo = alertas.find((a) => a.tipo === "bloqueo");
  const calientes = calientesLeads.length;
  const totalAvisos = calientes + (bloqueo ? 1 : 0);
  const hay = totalAvisos > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={hay ? `${totalAvisos} avisos` : "Sin avisos"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-arena/60"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 ${bloqueo ? "text-calor-hondo" : hay ? "text-calor" : "text-frio"} ${agita ? "animate-campana" : ""}`}
          style={{ transformOrigin: "top center" }}
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {hay && (
          <span className={`absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.62rem] font-bold text-carta ${bloqueo ? "bg-calor-hondo" : "bg-calor"}`}>
            {totalAvisos > 9 ? "9+" : totalAvisos}
          </span>
        )}
      </button>

      {/* Panel de avisos */}
      {abierto && (
        <>
          {/* Fondo para cerrar al tocar afuera */}
          <div className="fixed inset-0 z-30" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-tarjeta bg-carta shadow-[0_8px_24px_rgba(51,40,31,0.18)] ring-1 ring-linea">
            <p className="border-b border-linea px-4 py-2.5 text-[0.78rem] font-bold uppercase tracking-wide text-frio">Avisos</p>

            {/* Aviso crítico de saldo */}
            {bloqueo && (
              <div className="border-b border-linea bg-calor-suave px-4 py-3">
                <p className="text-[0.9rem] font-bold text-calor-hondo">⚠️ Llegaste al tope de clientes del mes</p>
                <p className="mt-0.5 text-[0.82rem] text-tinta-2">
                  El bot dejó de atender nuevos clientes. Ampliá tu plan para reactivarlo.
                </p>
                <button
                  onClick={() => { setAbierto(false); router.push("/configuracion"); }}
                  className="mt-2 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-carta transition hover:bg-brasa-hondo"
                >
                  Ampliar plan
                </button>
              </div>
            )}

            {/* Aviso de cuota por agotarse (umbral), si no hay bloqueo */}
            {!bloqueo && alertas.find((a) => a.tipo === "umbral") && (
              <div className="border-b border-linea bg-tibio-suave px-4 py-3">
                <p className="text-[0.88rem] font-semibold text-tibio">Se te están por acabar los clientes del mes</p>
                <button
                  onClick={() => { setAbierto(false); router.push("/configuracion"); }}
                  className="mt-2 text-[0.8rem] font-semibold text-brasa-hondo"
                >
                  Ver mi saldo →
                </button>
              </div>
            )}

            {/* Leads calientes sin atender: lista con nombres, cada uno lleva
                a su conversación. Mostramos hasta 5 y un "ver todos" si hay más. */}
            {calientes > 0 && (
              <div>
                <p className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[0.78rem] font-bold text-calor-hondo">
                  🔴 {calientes} {calientes === 1 ? "lead caliente sin atender" : "leads calientes sin atender"}
                </p>
                {calientesLeads.slice(0, 5).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setAbierto(false);
                      // El lead puede ser de otro negocio: la conversación
                      // completa adopta su empresa ("clavado").
                      if (l.tenantId) guardarEmpresaActiva(l.tenantId);
                      router.push(`/conversacion/${l.id}`);
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
                    onClick={() => { setAbierto(false); router.push("/leads"); }}
                    className="w-full px-4 py-2 text-left text-[0.8rem] font-semibold text-brasa-hondo transition hover:bg-arena/50"
                  >
                    Ver los {calientes} →
                  </button>
                )}
              </div>
            )}

            {/* Nada */}
            {!hay && !alertas.find((a) => a.tipo === "umbral") && (
              <p className="px-4 py-6 text-center text-[0.85rem] text-frio">No tenés avisos por ahora 👌</p>
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
