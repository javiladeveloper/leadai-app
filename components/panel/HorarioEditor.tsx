"use client";

import { useEffect, useState } from "react";
import { Seccion } from "@/components/panel/Seccion";
import {
  obtenerHorario, guardarHorario, resumenHorario, DIAS_SEMANA,
  type ConfigHorario,
} from "@/lib/horario";

/**
 * CUÁNDO ATIENDE EL RESTAURANTE (2026-08-19).
 *
 * Esto solo se editaba desde la app móvil, así que un dueño en su computadora
 * no podía cerrar la cocina ni cambiar su horario sin buscar el celular. Y los
 * DÍAS DE CIERRE no existían en ninguna parte: un local que descansa los lunes
 * igual recibía pedidos, y alguien terminaba cancelándolos a mano.
 *
 * El switch de cocina va PRIMERO y aparte del horario porque son cosas
 * distintas: el horario es la regla de siempre, el switch es "hoy no doy
 * abasto, corten" — la decisión urgente de un sábado a las 9 de la noche.
 */
export function HorarioEditor() {
  const [cfg, setCfg] = useState<ConfigHorario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  /**
   * El mínimo se escribe como texto y se guarda al SALIR del campo, no en cada
   * tecla: guardando por tecla, escribir "30" mandaría primero un mínimo de
   * S/3 —y si el cliente pide en ese segundo, se le rechaza por una regla que
   * el dueño no terminó de escribir.
   */
  const [minimoTexto, setMinimoTexto] = useState("");

  useEffect(() => {
    let vivo = true;
    void obtenerHorario().then((r) => {
      if (!vivo) return;
      setCfg(r);
      setMinimoTexto(r && r.minimoDeliveryCentavos > 0 ? (r.minimoDeliveryCentavos / 100).toFixed(2) : "");
      setCargando(false);
    });
    return () => { vivo = false; };
  }, []);

  /**
   * Guarda al instante, sin botón.
   *
   * Es un puñado de toggles, no un formulario: pedirle "Guardar" a alguien que
   * acaba de apagar su cocina un sábado lleno agrega un paso justo donde menos
   * tiempo tiene. El estado local se actualiza primero para que el switch no
   * quede "pensando".
   */
  async function aplicar(cambios: Partial<ConfigHorario>) {
    if (!cfg) return;
    const previo = cfg;
    setCfg({ ...cfg, ...cambios });
    setGuardando(true);
    setError("");
    const r = await guardarHorario(cambios);
    setGuardando(false);
    if (!r.ok) {
      // Se revierte: dejar el switch en la posición nueva cuando el backend lo
      // rechazó le haría creer al dueño que su cocina está cerrada y no lo está.
      setCfg(previo);
      setError(r.error ?? "No se pudo guardar");
      return;
    }
    setGuardado(true);
    setTimeout(() => setGuardado(false), 1800);
  }

  async function guardarMinimo() {
    if (!cfg) return;
    const limpio = minimoTexto.trim().replace(",", ".");
    // Vacío = sin mínimo. Es lo que el dueño espera al borrar el campo, y
    // tratarlo como "no cambió" dejaría el mínimo viejo puesto para siempre.
    if (limpio === "") {
      if (cfg.minimoDeliveryCentavos !== 0) await aplicar({ minimoDeliveryCentavos: 0 });
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(limpio)) {
      setError("Poné un monto como 30 o 30.00.");
      setMinimoTexto(cfg.minimoDeliveryCentavos > 0 ? (cfg.minimoDeliveryCentavos / 100).toFixed(2) : "");
      return;
    }
    const centavos = Math.round(parseFloat(limpio) * 100);
    if (centavos === cfg.minimoDeliveryCentavos) return;
    await aplicar({ minimoDeliveryCentavos: centavos });
  }

  if (cargando) {
    return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  }
  if (!cfg) return null;

  const sinHorarioFijo = cfg.horaAbre == null || cfg.horaCierra == null;

  return (
    <Seccion
      titulo="Cuándo atiendes"
      bajada={resumenHorario(cfg)}
      tono="claro"
      acento
    >
      <div className="space-y-5">
        {/* LA COCINA, AHORA. Lo más urgente arriba: es lo que alguien busca
            un sábado a las 9 cuando no da abasto. */}
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-tarjeta bg-arena/50 p-4">
          <span className="min-w-0">
            <span className="block font-bold text-tinta">Cocina abierta</span>
            <span className="mt-0.5 block text-[0.84rem] text-frio">
              Apágala para dejar de recibir pedidos ahora mismo, sin tocar tu horario.
            </span>
          </span>
          <input
            type="checkbox"
            checked={cfg.cocinaAbierta}
            onChange={(e) => aplicar({ cocinaAbierta: e.target.checked })}
            className="mt-1 size-5 shrink-0 accent-[var(--color-brasa)]"
          />
        </label>

        {/* QUÉ DÍAS. Es lo que no existía: un lunes de descanso no se podía
            declarar en ningún lado. */}
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Días que abres
          </p>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Los que apagues, el bot avisa que no atiendes y no toma pedidos.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {DIAS_SEMANA.map((d) => {
              const abierto = !cfg.diasCerrado.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() =>
                    aplicar({
                      diasCerrado: abierto
                        ? [...cfg.diasCerrado, d.n]
                        : cfg.diasCerrado.filter((x) => x !== d.n),
                    })
                  }
                  aria-pressed={abierto}
                  className={`rounded-chip px-3.5 py-2 text-[0.85rem] font-bold transition ${
                    abierto
                      ? "bg-brasa text-sobre-brasa"
                      : "bg-arena text-frio ring-1 ring-linea hover:bg-arena-2"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* DE QUÉ HORA A QUÉ HORA. */}
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Horario
          </p>
          <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-[0.88rem] text-tinta-2">
            <input
              type="checkbox"
              checked={sinHorarioFijo}
              onChange={(e) =>
                aplicar(
                  e.target.checked
                    ? { horaAbre: null, horaCierra: null }
                    : { horaAbre: 12, horaCierra: 23 },
                )
              }
              className="size-4 accent-[var(--color-brasa)]"
            />
            Sin horario fijo (atiendo a cualquier hora)
          </label>

          {!sinHorarioFijo && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SelectorHora
                etiqueta="Abre"
                valor={cfg.horaAbre ?? 12}
                onChange={(h) => aplicar({ horaAbre: h })}
              />
              <span className="text-frio">a</span>
              <SelectorHora
                etiqueta="Cierra"
                valor={cfg.horaCierra ?? 23}
                onChange={(h) => aplicar({ horaCierra: h })}
              />
              {/* Un horario que cruza medianoche es normal en un restaurante
                  —abre 19:00 y cierra 02:00— y el backend lo resuelve. Se
                  explica para que nadie crea que se equivocó al cargarlo. */}
              {cfg.horaAbre != null && cfg.horaCierra != null && cfg.horaAbre > cfg.horaCierra && (
                <span className="text-[0.8rem] text-frio">cierra al día siguiente 🌙</span>
              )}
            </div>
          )}
        </div>

        {/* PEDIDO MÍNIMO. Va con el horario porque son las dos reglas de
            "cuándo y cómo tomo pedidos", y un dueño las piensa juntas. */}
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Pedido mínimo para delivery
          </p>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Mandar un motorizado por un pedido chico da pérdida. El cliente lo ve
            mientras arma su pedido, no al final. Quien pasa a recoger no tiene mínimo.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-frio">S/</span>
            <input
              value={minimoTexto}
              onChange={(e) => setMinimoTexto(e.target.value)}
              onBlur={guardarMinimo}
              inputMode="decimal"
              placeholder="0.00"
              aria-label="Pedido mínimo para delivery"
              className="w-28 rounded-lg border border-linea bg-arena/40 px-3 py-2 tabular-nums text-tinta placeholder:text-frio"
            />
            <span className="text-[0.84rem] text-frio">
              {cfg.minimoDeliveryCentavos > 0 ? "" : "0 = sin mínimo"}
            </span>
          </div>
        </div>

        <div className="min-h-[1.2rem] text-[0.84rem]">
          {error && <span className="font-semibold text-alerta">{error}</span>}
          {!error && guardando && <span className="text-frio">Guardando…</span>}
          {!error && !guardando && guardado && <span className="font-semibold text-ok">Guardado ✓</span>}
        </div>
      </div>
    </Seccion>
  );
}

function SelectorHora({
  etiqueta, valor, onChange,
}: { etiqueta: string; valor: number; onChange: (h: number) => void }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-[0.84rem] text-frio">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-lg border border-linea bg-arena/40 px-3 py-2 tabular-nums text-tinta"
      >
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}

export default HorarioEditor;
