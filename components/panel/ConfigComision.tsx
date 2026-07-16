"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlan, guardarMiPlan } from "@/lib/api";

// Configuración de la comisión del negocio: define cómo se calcula la comisión
// por venta cerrada (un % del monto, o un monto fijo). Así, al cerrar una venta,
// la comisión se calcula sola en vez de escribirla a mano cada vez.
export function ConfigComision() {
  const [tipo, setTipo] = useState<"porcentaje" | "fijo">("porcentaje");
  const [valor, setValor] = useState<string>("");
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    obtenerMiPlan().then((p) => {
      if (p) {
        setTipo(p.comisionTipo);
        setValor(p.comisionValor > 0 ? String(p.comisionValor) : "");
      }
      setCargado(true);
    });
  }, []);

  async function guardar() {
    setGuardando(true);
    setOk(false);
    const r = await guardarMiPlan({ comisionTipo: tipo, comisionValor: Number(valor) || 0 });
    setGuardando(false);
    if (r.ok) { setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  if (!cargado) return null;

  return (
    <div className="mt-6 border-t border-linea pt-6">
      <h3 className="text-[0.98rem] font-bold text-tinta">Comisión por venta</h3>
      <p className="mt-1 text-[0.82rem] text-frio">
        Configurala una vez y, al cerrar una venta, se calcula sola. Podés cambiarla en cualquier momento.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {/* Tipo */}
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-tinta-2">Tipo</label>
          <div className="flex gap-1.5">
            {(["porcentaje", "fijo"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`rounded-chip px-3.5 py-2 text-[0.84rem] font-semibold transition ${
                  tipo === t ? "bg-brasa text-carta" : "bg-arena/70 text-tinta-2 hover:bg-arena"
                }`}
              >
                {t === "porcentaje" ? "% del monto" : "Monto fijo"}
              </button>
            ))}
          </div>
        </div>

        {/* Valor */}
        <div>
          <label className="mb-1 block text-[0.8rem] font-semibold text-tinta-2">
            {tipo === "porcentaje" ? "Porcentaje" : "Monto por venta"}
          </label>
          <div className="flex items-center gap-1.5">
            {tipo === "fijo" && <span className="text-[0.9rem] text-frio">S/</span>}
            <input
              type="number"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              min={0}
              placeholder={tipo === "porcentaje" ? "10" : "50"}
              className="w-24 rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
            {tipo === "porcentaje" && <span className="text-[0.9rem] text-frio">%</span>}
          </div>
        </div>

        <button
          onClick={guardar}
          disabled={guardando}
          className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-50"
        >
          {guardando ? "…" : "Guardar"}
        </button>
        {ok && <span className="text-[0.82rem] font-semibold text-ok">✓ Guardado</span>}
      </div>

      <p className="mt-3 text-[0.78rem] text-frio">
        Ejemplo: {tipo === "porcentaje"
          ? `si vendés S/1,000, tu comisión sería S/${((Number(valor) || 0) * 10).toFixed(0)}.`
          : `cada venta cerrada suma S/${Number(valor) || 0} de comisión.`}
        {" "}Dejá el valor en 0 para ingresar la comisión a mano cada vez.
      </p>
    </div>
  );
}
