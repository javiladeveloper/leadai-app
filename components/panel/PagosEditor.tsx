"use client";

import { useEffect, useState } from "react";
import { Seccion } from "@/components/panel/Seccion";
import { obtenerHorario, guardarHorario, type ConfigHorario } from "@/lib/horario";

/**
 * A DÓNDE LE PAGAN AL NEGOCIO (2026-08-19).
 *
 * Esto solo se editaba desde la app móvil. Un dueño sentado en su computadora
 * —que es donde carga su carta, sus precios y sus promos— no podía poner su
 * número de Yape.
 *
 * Y sin número el bot no tiene a dónde mandar al cliente: el pedido llega
 * hasta el momento de pagar y muere ahí, sin que nadie se entere. Pasó con la
 * carta de Shiro y salió en un WhatsApp real ("Yapea o plinea al ** ()").
 *
 * Por eso esta sección avisa cuando el número falta, en vez de esperar a que
 * el dueño lo descubra por un cliente perdido.
 */
export function PagosEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  // El número y el nombre se escriben como texto y se guardan al SALIR del
  // campo: guardando por tecla, un número a medio escribir queda publicado y
  // el cliente que pida en ese segundo yapea a otro lado.
  const [numero, setNumero] = useState("");
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    let vivo = true;
    void obtenerHorario().then((r) => {
      if (!vivo) return;
      setCfg(r);
      setNumero(r?.yapeNumero ?? "");
      setNombre(r?.yapeNombre ?? "");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  async function aplicar(cambios: Partial<ConfigHorario>) {
    if (!cfg) return;
    const previo = cfg;
    setCfg({ ...cfg, ...cambios });
    setError("");
    const r = await guardarHorario(cambios);
    if (!r.ok) {
      // Se revierte: un switch que quedó donde el backend no lo aceptó le hace
      // creer al dueño que acepta Plin cuando no.
      setCfg(previo);
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!cfg) return null;

  const sinNumero = !cfg.yapeNumero.trim();

  return (
    <Seccion
      titulo="Cómo te pagan"
      bajada={
        sinNumero
          ? "Falta tu número: el bot no puede cobrarle a nadie."
          : `Te pagan al ${cfg.yapeNumero}${cfg.yapeNombre ? ` · ${cfg.yapeNombre}` : ""}`
      }
      tono="claro"
      acento
    >
      <div className="space-y-4">
        {/* EL AVISO. Sin número, cada pedido llega hasta el pago y se cae —y el
            dueño no se entera porque el cliente simplemente no vuelve. */}
        {sinNumero && (
          <p className="rounded-tarjeta bg-calor-suave px-4 py-3 text-[0.86rem] font-semibold text-calor-hondo">
            Sin tu número, el bot le pide al cliente que coordine el pago contigo por
            chat. Cárgalo y cobra solo.
          </p>
        )}

        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Número donde te pagan
          </span>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            onBlur={() => {
              const v = numero.trim();
              if (v !== cfg.yapeNumero) void aplicar({ yapeNumero: v });
            }}
            inputMode="numeric"
            placeholder="940202780"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 tabular-nums text-tinta placeholder:text-frio"
          />
        </label>

        <label className="block">
          <span className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Nombre del titular
          </span>
          <span className="mt-0.5 block text-[0.82rem] text-frio">
            Lo ve el cliente antes de pagar, para saber a quién le manda la plata.
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => {
              const v = nombre.trim();
              if (v !== cfg.yapeNombre) void aplicar({ yapeNombre: v });
            }}
            placeholder="Nombre y apellido"
            className="mt-1.5 w-full rounded-lg border border-linea bg-arena/40 px-3 py-2.5 text-tinta placeholder:text-frio"
          />
        </label>

        {/* En Perú hay locales que solo reciben una de las dos apps. El bot
            manda al cliente a la correcta y rechaza la captura de la otra. */}
        <div className="flex flex-wrap gap-2">
          <Chip
            activo={cfg.aceptaYape}
            onClick={() => aplicar({ aceptaYape: !cfg.aceptaYape })}
            label="Acepto Yape"
          />
          <Chip
            activo={cfg.aceptaPlin}
            onClick={() => aplicar({ aceptaPlin: !cfg.aceptaPlin })}
            label="Acepto Plin"
          />
        </div>

        {!cfg.aceptaYape && !cfg.aceptaPlin && (
          <p className="text-[0.84rem] text-frio">
            Sin ninguna marcada, el bot nombra las dos: es preferible a dejar al
            cliente sin saber a dónde pagar.
          </p>
        )}

        <div className="min-h-[1.2rem] text-[0.84rem]">
          {error && <span className="font-semibold text-alerta">{error}</span>}
          {!error && guardado && <span className="font-semibold text-ok">Guardado ✓</span>}
        </div>
      </div>
    </Seccion>
  );
}

function Chip({ activo, onClick, label }: { activo: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`rounded-chip px-4 py-2 text-[0.85rem] font-bold transition ${
        activo ? "bg-brasa text-sobre-brasa" : "bg-arena text-frio ring-1 ring-linea hover:bg-arena-2"
      }`}
    >
      {label}
    </button>
  );
}

export default PagosEditor;
