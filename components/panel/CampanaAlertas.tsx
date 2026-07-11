"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { obtenerResumen } from "@/lib/api";

// Campana de avisos en el header: muestra cuántos leads calientes hay sin
// atender (del /resumen del tenant activo). Se refresca sola cada 30s para que
// aparezca sin recargar. Al tocarla, lleva a la lista de leads.
// Cuando el número SUBE (entró un caliente nuevo), suena un aviso y la campana
// se agita, para que se note aunque no estés mirando la pantalla.
export function CampanaAlertas() {
  const router = useRouter();
  const [calientes, setCalientes] = useState(0);
  const [agita, setAgita] = useState(false);
  // Valor anterior para detectar subidas. Arranca en -1 para NO sonar en la
  // primera carga (solo cuando entra uno nuevo estando ya abierto el panel).
  const previo = useRef<number>(-1);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      obtenerResumen().then((r) => {
        if (!vivo || !r) return;
        const nuevo = r.calientesSinAtender;
        // Solo avisamos si ya teníamos un valor conocido y el nuevo es mayor.
        if (previo.current >= 0 && nuevo > previo.current) {
          sonarAviso();
          setAgita(true);
          setTimeout(() => setAgita(false), 900);
        }
        previo.current = nuevo;
        setCalientes(nuevo);
      });
    };
    cargar();
    const id = setInterval(cargar, 30_000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, []);

  const hay = calientes > 0;

  return (
    <button
      type="button"
      onClick={() => router.push("/leads")}
      aria-label={hay ? `${calientes} leads calientes sin atender` : "Sin avisos"}
      title={hay ? `${calientes} caliente(s) sin atender — tocá para verlos` : "Sin avisos"}
      className="relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-arena/60"
    >
      {/* Campana */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-5 w-5 ${hay ? "text-brasa" : "text-frio"} ${agita ? "animate-campana" : ""}`}
        style={{ transformOrigin: "top center" }}
      >
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {/* Badge con el número */}
      {hay && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brasa px-1 text-[0.62rem] font-bold text-carta">
          {calientes > 9 ? "9+" : calientes}
        </span>
      )}
    </button>
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
    // Dos tonos ascendentes cortos, tipo "ding-dong" suave.
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
      // Envolvente suave para que no "clickee".
      gan.gain.setValueAtTime(0.0001, t0);
      gan.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
      osc.connect(gan);
      gan.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + n.dur + 0.02);
    }
    // Cierra el contexto cuando termina para no acumular recursos.
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // Silencio: el aviso visual (badge + agitar) sigue funcionando.
  }
}
