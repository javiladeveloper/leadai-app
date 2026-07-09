"use client";

import { useEffect, useState } from "react";
import {
  obtenerUso,
  obtenerCatalogo,
  obtenerMiPlan,
  guardarMiPlan,
  type Uso,
  type Catalogo,
} from "@/lib/api";
import { precioRecargaCentavos, soles } from "@/lib/precio";
import CheckoutCulqi from "@/components/panel/CheckoutCulqi";

const PRESETS = [500, 1000, 5000];

const NOMBRE_PLAN: Record<string, string> = {
  free: "Gratis",
  light: "Light",
  pro: "Pro",
  business: "Business",
};

// Bloque skeleton reutilizable, mismo estilo que Skeletons.tsx (pulso sobre
// arena-2), para no depender de un "Cargando…" plano en ninguna tarjeta.
function SkeletonBloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-arena-2/70 ${className}`} />;
}

// ─── Tarjeta 1: Tu saldo ────────────────────────────────────────────────
function TarjetaSaldo({ uso, cargando, error }: { uso: Uso | null; cargando: boolean; error: boolean }) {
  if (cargando) {
    return (
      <div className="space-y-3">
        <SkeletonBloque className="h-4 w-28" />
        <SkeletonBloque className="h-2.5 w-full" />
        <SkeletonBloque className="h-3 w-40" />
        <SkeletonBloque className="h-3 w-32" />
      </div>
    );
  }

  if (error || !uso) {
    return (
      <p className="text-sm text-brasa">
        No pudimos cargar tu saldo. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  const { bolsa } = uso;
  const restante = bolsa.totalDisponible;
  const totalMensual = bolsa.mensual.total;
  const usadoMensual = bolsa.mensual.usado;
  const pctMensual = totalMensual > 0 ? Math.min(1, usadoMensual / totalMensual) : 0;
  const pctRestanteDelTotal =
    totalMensual + bolsa.prepago.total > 0
      ? restante / (totalMensual + bolsa.prepago.total)
      : 0;
  const color =
    pctRestanteDelTotal > 0.4 ? "bg-ok" : pctRestanteDelTotal >= 0.15 ? "bg-tibio" : "bg-brasa";
  const dias = Math.max(
    0,
    Math.ceil((new Date(bolsa.seResetea).getTime() - Date.now()) / 86_400_000),
  );
  const hayPrepago = bolsa.prepago.total > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-frio">Plan actual</p>
          <p className="text-[1.1rem] font-bold text-tinta">
            {NOMBRE_PLAN[uso.plan] ?? uso.plan}
          </p>
        </div>
        <span className="rounded-chip bg-arena px-3 py-1 text-[0.78rem] font-semibold text-tinta-2 ring-1 ring-linea">
          {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
        </span>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[0.82rem] font-semibold text-tinta-2">Respuestas del mes</p>
          <p className="text-[0.82rem] text-frio">
            {usadoMensual.toLocaleString("es-PE")} / {totalMensual.toLocaleString("es-PE")}
          </p>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-arena">
          <div
            className={`h-full rounded-full ${color} transition-[width] duration-500`}
            style={{ width: `${Math.round(pctMensual * 100)}%` }}
          />
        </div>
      </div>

      {hayPrepago && (
        <div className="flex items-center justify-between rounded-xl bg-arena px-4 py-3">
          <p className="text-[0.82rem] font-semibold text-tinta-2">Respuestas prepago</p>
          <p className="text-[0.9rem] font-bold text-tinta">
            {bolsa.prepago.restante.toLocaleString("es-PE")}{" "}
            <span className="font-normal text-frio">/ {bolsa.prepago.total.toLocaleString("es-PE")}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-arena px-4 py-3">
        <p className="text-[0.82rem] font-semibold text-tinta-2">Total disponible</p>
        <p className="text-[1rem] font-bold text-tinta">{restante.toLocaleString("es-PE")}</p>
      </div>
    </div>
  );
}

// ─── Tarjeta 2: Comprar más respuestas ─────────────────────────────────
function TarjetaComprar({
  catalogo,
  cargando,
  onExito,
}: {
  catalogo: Catalogo | null;
  cargando: boolean;
  onExito: () => void;
}) {
  const minHits = catalogo?.recargaDinamica.minHits ?? 100;
  const [hits, setHits] = useState(1000);
  const [textoHits, setTextoHits] = useState("1000");

  // Cuando llega el catálogo, aseguramos que el valor inicial respete el mínimo.
  useEffect(() => {
    if (catalogo && hits < minHits) {
      setHits(minHits);
      setTextoHits(String(minHits));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogo]);

  if (cargando) {
    return (
      <div className="space-y-3">
        <SkeletonBloque className="h-9 w-full" />
        <SkeletonBloque className="h-9 w-full" />
        <SkeletonBloque className="h-16 w-full" />
      </div>
    );
  }

  if (!catalogo) {
    return (
      <p className="text-sm text-brasa">
        No pudimos cargar los precios de recarga. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  const tramos = catalogo.recargaDinamica.tramos;
  const hitsValidos = Math.max(minHits, hits || 0);
  const precio = precioRecargaCentavos(hitsValidos, tramos);
  const centavosPorHit = hitsValidos > 0 ? precio / hitsValidos : 0;

  // Ahorro por volumen: comparamos contra el tramo de menor volumen (el más
  // caro por respuesta), que es el precio "de entrada" sin descuento.
  const tramoMasCaro = [...tramos].sort((a, b) => b.centavosPorHit - a.centavosPorHit)[0];
  const precioSinDescuento = tramoMasCaro ? hitsValidos * tramoMasCaro.centavosPorHit : precio;
  const ahorro = Math.round(precioSinDescuento - precio);
  const hayAhorro = ahorro > 0;

  function elegirPreset(n: number) {
    setHits(n);
    setTextoHits(String(n));
  }

  function onCambiarInput(v: string) {
    setTextoHits(v);
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) setHits(n);
  }

  const bajoMinimo = (hits || 0) > 0 && hits < minHits;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => elegirPreset(n)}
            className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition ${
              hits === n
                ? "bg-brasa text-carta"
                : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-arena-2"
            }`}
          >
            {n.toLocaleString("es-PE")}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="hits-libres" className="mb-1 block text-[0.82rem] font-semibold text-tinta-2">
          O elegí una cantidad
        </label>
        <input
          id="hits-libres"
          type="number"
          min={minHits}
          step={100}
          value={textoHits}
          onChange={(e) => onCambiarInput(e.target.value)}
          className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-[0.95rem] text-tinta outline-none focus-visible:border-brasa"
        />
        {bajoMinimo ? (
          <p className="mt-1 text-[0.78rem] text-brasa">
            El mínimo por compra es {minHits.toLocaleString("es-PE")} respuestas.
          </p>
        ) : (
          <p className="mt-1 text-[0.78rem] text-frio">
            Mínimo {minHits.toLocaleString("es-PE")} respuestas por compra.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-arena px-4 py-3.5">
        <p className="text-[1.05rem] font-bold text-tinta">
          {hitsValidos.toLocaleString("es-PE")} respuestas = {soles(precio)}
        </p>
        <p className="text-[0.78rem] text-frio">
          {(centavosPorHit).toFixed(1)} centavos por respuesta
          {hayAhorro && (
            <span className="ml-1 font-semibold text-ok">· Ahorrás {soles(ahorro)}</span>
          )}
        </p>
      </div>

      <CheckoutCulqi
        key={hitsValidos}
        hits={hitsValidos}
        montoCentavos={precio}
        onExito={onExito}
      />
    </div>
  );
}

// ─── Tarjeta 3: Tus límites ─────────────────────────────────────────────
type EstadoGuardado = "idle" | "guardando" | "ok" | "error";

function TarjetaLimites({ cargando, limiteInicial, pausarInicial, error }: {
  cargando: boolean;
  limiteInicial: number | null;
  pausarInicial: boolean;
  error: boolean;
}) {
  const [limiteTexto, setLimiteTexto] = useState("");
  const [pausar, setPausar] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!cargando) {
      setLimiteTexto(limiteInicial ? String(limiteInicial) : "");
      setPausar(pausarInicial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, limiteInicial, pausarInicial]);

  if (cargando) {
    return (
      <div className="space-y-3">
        <SkeletonBloque className="h-9 w-full" />
        <SkeletonBloque className="h-9 w-full" />
        <SkeletonBloque className="h-9 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-brasa">
        No pudimos cargar tus límites. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  async function guardar() {
    setEstadoGuardado("guardando");
    setErrorMsg("");
    const n = parseInt(limiteTexto, 10);
    const limite = !limiteTexto || Number.isNaN(n) || n <= 0 ? null : n;
    const r = await guardarMiPlan({ limiteRespuestasDia: limite, pausarAlLimite: pausar });
    if (r.ok) {
      setEstadoGuardado("ok");
    } else {
      setEstadoGuardado("error");
      setErrorMsg(r.error ?? "No se pudo guardar.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="limite-dia" className="mb-1 block text-[0.82rem] font-semibold text-tinta-2">
          Máximo de respuestas por día
        </label>
        <input
          id="limite-dia"
          type="number"
          min={0}
          placeholder="Sin límite"
          value={limiteTexto}
          onChange={(e) => setLimiteTexto(e.target.value)}
          className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-[0.95rem] text-tinta outline-none placeholder:text-frio focus-visible:border-brasa"
        />
        <p className="mt-1 text-[0.78rem] text-frio">Dejalo vacío para no tener límite diario.</p>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl bg-arena px-4 py-3.5">
        <div>
          <p className="text-[0.88rem] font-semibold text-tinta">Pausar el bot al llegar al tope</p>
          <p className="mt-0.5 text-[0.78rem] text-frio">
            {pausar
              ? "El bot deja de responder al llegar al límite (protegés tu gasto)."
              : "Solo te avisamos, el bot sigue respondiendo."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={pausar}
          onClick={() => setPausar((v) => !v)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${
            pausar ? "bg-brasa" : "bg-arena-2 ring-1 ring-linea"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-carta shadow transition-transform ${
              pausar ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={estadoGuardado === "guardando"}
          className="rounded-full bg-brasa px-5 py-2.5 text-sm font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {estadoGuardado === "guardando" ? "Guardando…" : "Guardar"}
        </button>
        {estadoGuardado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
        {estadoGuardado === "error" && <p className="text-sm text-brasa">{errorMsg}</p>}
      </div>
    </div>
  );
}

// ─── Componente principal ───────────────────────────────────────────────
export function PlanConsumo() {
  const [uso, setUso] = useState<Uso | null>(null);
  const [cargandoUso, setCargandoUso] = useState(true);
  const [errorUso, setErrorUso] = useState(false);

  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  const [cargandoPlan, setCargandoPlan] = useState(true);
  const [limiteInicial, setLimiteInicial] = useState<number | null>(null);
  const [pausarInicial, setPausarInicial] = useState(false);
  const [errorPlan, setErrorPlan] = useState(false);

  function recargarSaldo() {
    setCargandoUso(true);
    obtenerUso().then((u) => {
      setUso(u);
      setErrorUso(!u);
      setCargandoUso(false);
    });
  }

  useEffect(() => {
    recargarSaldo();
    obtenerCatalogo().then((c) => {
      setCatalogo(c);
      setCargandoCatalogo(false);
    });
    obtenerMiPlan().then((p) => {
      if (p) {
        setLimiteInicial(p.limiteRespuestasDia);
        setPausarInicial(p.pausarAlLimite);
      } else {
        setErrorPlan(true);
      }
      setCargandoPlan(false);
    });
  }, []);

  return (
    <div className="grid gap-6">
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <h3 className="text-[0.95rem] font-bold text-tinta">Tu saldo</h3>
        <p className="mb-4 text-[0.8rem] text-frio">Cuántas respuestas te quedan y cuándo se renuevan.</p>
        <TarjetaSaldo uso={uso} cargando={cargandoUso} error={errorUso} />
      </div>

      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <h3 className="text-[0.95rem] font-bold text-tinta">Comprar más respuestas</h3>
        <p className="mb-4 text-[0.8rem] text-frio">
          Sumá respuestas prepago que no vencen con el mes. Cuanto más comprás, más barato sale.
        </p>
        <TarjetaComprar catalogo={catalogo} cargando={cargandoCatalogo} onExito={recargarSaldo} />
      </div>

      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <h3 className="text-[0.95rem] font-bold text-tinta">Tus límites</h3>
        <p className="mb-4 text-[0.8rem] text-frio">
          Poné un tope diario para controlar el gasto, aunque no cambies de plan.
        </p>
        <TarjetaLimites
          cargando={cargandoPlan}
          limiteInicial={limiteInicial}
          pausarInicial={pausarInicial}
          error={errorPlan}
        />
      </div>
    </div>
  );
}

export default PlanConsumo;
