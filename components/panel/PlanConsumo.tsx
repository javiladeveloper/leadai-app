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

// Un cliente atendido de punta a punta ≈ 8 hits (calificar + responder por
// mensaje). La unidad que ve el negocio es "clientes", no hits internos.
const HITS_POR_CLIENTE = 8;
const aClientes = (hits: number) => Math.floor(hits / HITS_POR_CLIENTE);

const NOMBRE_PLAN: Record<string, string> = {
  free: "Gratis",
  flujos: "Flujos",
  light: "Emprende",
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
          <p className="text-[0.82rem] font-semibold text-tinta-2">Clientes atendidos este mes</p>
          <p className="text-[0.82rem] text-frio">
            {aClientes(usadoMensual).toLocaleString("es-PE")} / {aClientes(totalMensual).toLocaleString("es-PE")}
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
          <p className="text-[0.82rem] font-semibold text-tinta-2">Clientes extra (prepago)</p>
          <p className="text-[0.9rem] font-bold text-tinta">
            {aClientes(bolsa.prepago.restante).toLocaleString("es-PE")}{" "}
            <span className="font-normal text-frio">/ {aClientes(bolsa.prepago.total).toLocaleString("es-PE")}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-arena px-4 py-3">
        <p className="text-[0.82rem] font-semibold text-tinta-2">Clientes disponibles</p>
        <p className="text-[1rem] font-bold text-tinta">{aClientes(restante).toLocaleString("es-PE")}</p>
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

// ─── Tarjeta de interruptor genérica (bot activo, IA activa, etc.) ───────
function TarjetaSwitch({
  cargando,
  valorInicial,
  error,
  campo,
  textoOn,
  textoOff,
  subtextoOn,
  subtextoOff,
  aria,
}: {
  cargando: boolean;
  valorInicial: boolean;
  error: boolean;
  campo: "botActivo" | "iaActiva";
  textoOn: string;
  textoOff: string;
  subtextoOn: string;
  subtextoOff: string;
  aria: string;
}) {
  const [activo, setActivo] = useState(valorInicial);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!cargando) setActivo(valorInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, valorInicial]);

  if (cargando) {
    return <SkeletonBloque className="h-16 w-full" />;
  }

  if (error) {
    return (
      <p className="text-sm text-brasa">
        No pudimos cargar tu configuración. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  async function alternar() {
    const nuevo = !activo;
    setActivo(nuevo);
    setEstadoGuardado("guardando");
    setErrorMsg("");
    const r = await guardarMiPlan({ [campo]: nuevo });
    if (r.ok) {
      setEstadoGuardado("ok");
    } else {
      // si falló el guardado, volvemos al valor anterior para no mentirle al usuario
      setActivo(!nuevo);
      setEstadoGuardado("error");
      setErrorMsg(r.error ?? "No se pudo guardar.");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-[0.95rem] font-bold text-tinta">{activo ? textoOn : textoOff}</p>
        <p className="text-[0.8rem] text-frio">{activo ? subtextoOn : subtextoOff}</p>
        {estadoGuardado === "error" && <p className="mt-1 text-[0.8rem] text-brasa">{errorMsg}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={activo}
        aria-label={aria}
        onClick={alternar}
        disabled={estadoGuardado === "guardando"}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
          activo ? "bg-ok" : "bg-arena-2 ring-1 ring-linea"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-carta shadow transition-transform ${
            activo ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Tarjeta 3: ¿Hasta dónde insiste el bot? ───────────────────────────
type EstadoGuardado = "idle" | "guardando" | "ok" | "error";
type Insistencia = "poca" | "normal" | "mucha";

interface OpcionInsistencia {
  clave: Insistencia;
  emoji: string;
  etiqueta: string;
  descripcion: string;
}

const OPCIONES_INSISTENCIA: OpcionInsistencia[] = [
  {
    clave: "poca",
    emoji: "🌱",
    etiqueta: "Poco",
    descripcion: "Responde lo justo y te avisa. Ahorra respuestas.",
  },
  {
    clave: "normal",
    emoji: "⚖️",
    etiqueta: "Normal",
    descripcion: "Conversa hasta entender bien qué necesita. Recomendado.",
  },
  {
    clave: "mucha",
    emoji: "🔥",
    etiqueta: "Al máximo",
    descripcion: "Insiste hasta cerrar o que el cliente deje de responder.",
  },
];

function TarjetaInsistencia({
  cargando,
  valorInicial,
  error,
}: {
  cargando: boolean;
  valorInicial: Insistencia;
  error: boolean;
}) {
  const [valor, setValor] = useState(valorInicial);
  const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!cargando) setValor(valorInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, valorInicial]);

  if (cargando) {
    return (
      <div className="space-y-3">
        <SkeletonBloque className="h-20 w-full" />
        <SkeletonBloque className="h-20 w-full" />
        <SkeletonBloque className="h-20 w-full" />
        <SkeletonBloque className="h-9 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-brasa">
        No pudimos cargar tu configuración. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  async function guardar() {
    setEstadoGuardado("guardando");
    setErrorMsg("");
    const r = await guardarMiPlan({ insistencia: valor });
    if (r.ok) {
      setEstadoGuardado("ok");
    } else {
      setEstadoGuardado("error");
      setErrorMsg(r.error ?? "No se pudo guardar.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {OPCIONES_INSISTENCIA.map((op) => {
          const activo = valor === op.clave;
          return (
            <button
              key={op.clave}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => {
                setValor(op.clave);
                setEstadoGuardado("idle");
              }}
              className={`flex flex-col items-start gap-1 rounded-xl px-4 py-3.5 text-left transition ${
                activo
                  ? "bg-brasa-suave ring-2 ring-brasa"
                  : "bg-arena ring-1 ring-linea hover:bg-arena-2"
              }`}
            >
              <p className="text-[0.88rem] font-semibold text-tinta">
                <span className="mr-1.5">{op.emoji}</span>
                {op.etiqueta}
              </p>
              <p className="text-[0.78rem] text-frio">{op.descripcion}</p>
            </button>
          );
        })}
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
  const [insistenciaInicial, setInsistenciaInicial] = useState<"poca" | "normal" | "mucha">("normal");
  const [botActivoInicial, setBotActivoInicial] = useState(true);
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
        setInsistenciaInicial(p.insistencia);
        setBotActivoInicial(p.botActivo);
      } else {
        setErrorPlan(true);
      }
      setCargandoPlan(false);
    });
  }, []);

  return (
    <div className="grid gap-6">
      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-2 ring-brasa/30 lg:p-6">
        <h3 className="text-[0.95rem] font-bold text-tinta">¿El bot está atendiendo?</h3>
        <p className="mb-4 text-[0.8rem] text-frio">
          El interruptor principal: prendé o apagá al bot cuando quieras.
        </p>
        <TarjetaSwitch
          cargando={cargandoPlan} valorInicial={botActivoInicial} error={errorPlan} campo="botActivo"
          aria="¿El bot está atendiendo?"
          textoOn="Activo — el bot responde a tus clientes"
          textoOff="Pausado — el bot no responde (atendés vos)"
          subtextoOn="Apagalo un momento si querés atender vos mismo, sin que el bot conteste."
          subtextoOff="Los mensajes se siguen guardando; el bot no va a contestar hasta que lo actives de nuevo."
        />
      </div>

      <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <h3 className="text-[0.95rem] font-bold text-tinta">Tu saldo</h3>
        <p className="mb-4 text-[0.8rem] text-frio">Cuántos clientes podés atender este mes y cuándo se renueva.</p>
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
        <h3 className="text-[0.95rem] font-bold text-tinta">
          ¿Hasta dónde querés que el bot insista con cada cliente?
        </h3>
        <p className="mb-4 text-[0.8rem] text-frio">
          Definí cuánto conversa el bot antes de avisarte que un cliente necesita atención tuya.
        </p>
        <TarjetaInsistencia
          cargando={cargandoPlan}
          valorInicial={insistenciaInicial}
          error={errorPlan}
        />
      </div>
    </div>
  );
}

export default PlanConsumo;
