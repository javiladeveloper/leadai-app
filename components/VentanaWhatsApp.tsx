"use client";
import { useEffect, useState } from "react";
import { enviarPlantillaLead, listarPlantillasLead, type PlantillaLead } from "@/lib/api";
import { rellenar, variablesDe, type Ventana } from "@/lib/ventana-whatsapp";

/**
 * EL AVISO DE LA VENTANA CERRADA Y LA PLANTILLA PARA REABRIRLA (2026-09-25,
 * caso Edith: "debería avisarme").
 *
 * Cuando el cliente no escribe hace más de 24 h, WhatsApp no entrega mensajes
 * normales. En vez de dejar escribir algo que no va a llegar, el chat lo dice
 * y ofrece una plantilla aprobada: si el cliente contesta, la ventana se
 * vuelve a abrir y se le puede escribir normal.
 */
export function VentanaWhatsApp({
  ventana, leadId, tenant, nombre, alEnviar,
}: {
  ventana: Ventana;
  leadId: string;
  tenant?: string;
  /** Nombre del cliente, para prellenar la primera variable. */
  nombre?: string | null;
  alEnviar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [plantillas, setPlantillas] = useState<PlantillaLead[] | null>(null);
  const [elegida, setElegida] = useState<PlantillaLead | null>(null);
  const [valores, setValores] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!abierto || plantillas) return;
    let vivo = true;
    void listarPlantillasLead(leadId, tenant).then((p) => { if (vivo) setPlantillas(p); });
    return () => { vivo = false; };
  }, [abierto, plantillas, leadId, tenant]);

  function elegir(p: PlantillaLead) {
    setElegida(p);
    setError(null);
    const primerNombre = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
    setValores(Array.from({ length: variablesDe(p.cuerpo) }, (_, i) => (i === 0 ? primerNombre : "")));
  }

  async function enviar() {
    if (!elegida || enviando) return;
    if (valores.some((v) => !v.trim())) { setError("Completa los datos de la plantilla antes de enviarla."); return; }
    setEnviando(true);
    setError(null);
    const r = await enviarPlantillaLead(leadId, {
      nombre: elegida.nombre, idioma: elegida.idioma, parametros: valores.map((v) => v.trim()), cuerpo: elegida.cuerpo,
    }, tenant);
    setEnviando(false);
    if (r.ok) {
      setListo(true);
      setAbierto(false);
      setElegida(null);
      alEnviar();
    } else {
      setError(r.error ?? "No se pudo enviar la plantilla.");
    }
  }

  if (ventana.abierta) return null;

  return (
    <div className="border-t border-linea bg-tibio-suave/60 px-4 py-2.5">
      <p className="text-[0.84rem] font-semibold text-tinta">
        ⏳ Te escribió por última vez {ventana.desde}: WhatsApp no le va a entregar mensajes normales ni archivos.
      </p>
      <p className="mt-0.5 text-[0.78rem] text-tinta-2">
        {listo
          ? "Plantilla enviada. Cuando te conteste, vas a poder escribirle normal."
          : `Pasadas ${ventana.horas} h solo llega una plantilla aprobada. Si te contesta, se vuelve a abrir la conversación.`}
      </p>
      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="mt-2 rounded-chip bg-brasa px-3.5 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition active:scale-[0.98]"
        >
          📨 Mandar una plantilla
        </button>
      ) : (
        <div className="mt-2 space-y-2 rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
          {plantillas === null && (
            <p className="flex items-center gap-2 text-[0.8rem] text-tinta-2" role="status">
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brasa/30 border-t-brasa" />
              Buscando tus plantillas aprobadas…
            </p>
          )}
          {plantillas?.length === 0 && (
            <p className="text-[0.8rem] text-tinta-2">
              No tienes plantillas aprobadas por Meta todavía. Créalas en Campañas → Plantillas (Meta tarda unos minutos en aprobarlas).
            </p>
          )}
          {plantillas && plantillas.length > 0 && !elegida && (
            <div className="max-h-56 space-y-1.5 overflow-y-auto">
              {plantillas.map((p) => (
                <button
                  key={`${p.nombre}-${p.idioma}`}
                  type="button"
                  onClick={() => elegir(p)}
                  className="w-full rounded-xl bg-arena/60 px-3 py-2 text-left ring-1 ring-linea transition hover:bg-arena"
                >
                  <span className="block text-[0.78rem] font-bold text-tinta">
                    {p.nombre} <span className="font-semibold text-frio">· {p.categoria === "UTILITY" ? "servicio" : "marketing"}</span>
                  </span>
                  <span className="line-clamp-2 text-[0.78rem] text-tinta-2">{p.cuerpo}</span>
                </button>
              ))}
            </div>
          )}
          {elegida && (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-xl bg-arena/60 px-3 py-2 text-[0.82rem] text-tinta ring-1 ring-linea">
                {rellenar(elegida.cuerpo, valores)}
              </p>
              {valores.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => setValores((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={`Dato {{${i + 1}}}`}
                  className="w-full rounded-xl bg-arena/60 px-3 py-2 text-[0.84rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              ))}
              <p className="text-[0.72rem] text-frio">Meta cobra cada plantilla al negocio (marketing ~S/0.23, servicio menos).</p>
              {enviando ? (
                <p className="flex items-center gap-2 text-[0.8rem] font-semibold text-tinta-2" role="status" aria-live="polite">
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brasa/30 border-t-brasa" />
                  Enviando la plantilla…
                </p>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void enviar()}
                    className="flex-1 rounded-chip bg-brasa px-3 py-2 text-[0.82rem] font-bold text-sobre-brasa transition active:scale-[0.98]"
                  >
                    Enviar plantilla
                  </button>
                  <button
                    type="button"
                    onClick={() => setElegida(null)}
                    className="rounded-chip px-3 py-2 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
                  >
                    Elegir otra
                  </button>
                </div>
              )}
            </div>
          )}
          {error && <p className="text-[0.78rem] font-semibold text-alerta-hondo" role="alert">{error}</p>}
          {!elegida && (
            <button type="button" onClick={() => setAbierto(false)} className="text-[0.76rem] font-semibold text-frio underline">
              Cerrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
