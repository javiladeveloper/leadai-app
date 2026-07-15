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
  // Conteo REAL de clientes (del backend). Fallback al estimado hits÷8 solo si
  // el backend viejo aún no expone `clientes` (durante un deploy).
  const usadosCli = uso.clientes ? uso.clientes.usados : aClientes(bolsa.mensual.usado);
  const totalCli = uso.clientes ? uso.clientes.limite : aClientes(bolsa.mensual.total);
  const restanteCli = uso.clientes ? uso.clientes.restante : aClientes(bolsa.totalDisponible);
  const pctUsado = totalCli > 0 ? Math.min(100, Math.round((usadosCli / totalCli) * 100)) : 0;
  const pctRestante = totalCli > 0 ? restanteCli / totalCli : 0;
  const color = pctRestante > 0.4 ? "bg-ok" : pctRestante >= 0.15 ? "bg-tibio" : "bg-brasa";
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
            {usadosCli.toLocaleString("es-PE")} de {totalCli.toLocaleString("es-PE")}
          </p>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-arena">
          {/* La barra crece con lo USADO. */}
          <div
            className={`h-full rounded-full ${color} transition-[width] duration-500`}
            style={{ width: `${pctUsado}%` }}
          />
        </div>
      </div>

      {hayPrepago && (
        <div className="flex items-center justify-between rounded-xl bg-arena px-4 py-3">
          <p className="text-[0.82rem] font-semibold text-tinta-2">Clientes extra (prepago)</p>
          <p className="text-[0.9rem] font-bold text-tinta">
            Te quedan {aClientes(bolsa.prepago.restante).toLocaleString("es-PE")}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl bg-arena px-4 py-3">
        <p className="text-[0.82rem] font-semibold text-tinta-2">Clientes que te quedan</p>
        <p className="text-[1rem] font-bold text-tinta">{restanteCli.toLocaleString("es-PE")}</p>
      </div>
    </div>
  );
}

// ─── Tarjeta 2: Comprar más clientes ───────────────────────────────────
// Se vende en CLIENTES (la unidad que entiende el negocio). Por dentro se
// convierte a hits (1 cliente ≈ 8) para el backend/catálogo, que trabaja en hits.
function TarjetaComprar({
  catalogo,
  cargando,
  onExito,
}: {
  catalogo: Catalogo | null;
  cargando: boolean;
  onExito: () => void;
}) {
  // Mínimo del catálogo (en hits) → mínimo en clientes.
  const minClientes = Math.max(10, aClientes(catalogo?.recargaDinamica.minHits ?? 100));
  const PRESETS_CLIENTES = [50, 150, 500]; // clientes extra
  const [clientes, setClientes] = useState(150);
  const [texto, setTexto] = useState("150");

  useEffect(() => {
    if (catalogo && clientes < minClientes) {
      setClientes(minClientes);
      setTexto(String(minClientes));
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
        No pudimos cargar los precios. Recargá la página para intentar de nuevo.
      </p>
    );
  }

  const tramos = catalogo.recargaDinamica.tramos;
  const clientesValidos = Math.max(minClientes, clientes || 0);
  const hits = clientesValidos * HITS_POR_CLIENTE; // conversión a la unidad del backend
  const precio = precioRecargaCentavos(hits, tramos);
  const centavosPorCliente = clientesValidos > 0 ? precio / clientesValidos : 0;

  // Ahorro por volumen vs. el tramo más caro por hit (precio "de entrada").
  const tramoMasCaro = [...tramos].sort((a, b) => b.centavosPorHit - a.centavosPorHit)[0];
  const precioSinDescuento = tramoMasCaro ? hits * tramoMasCaro.centavosPorHit : precio;
  const ahorro = Math.round(precioSinDescuento - precio);
  const hayAhorro = ahorro > 0;

  function elegirPreset(n: number) {
    setClientes(n);
    setTexto(String(n));
  }
  function onCambiarInput(v: string) {
    setTexto(v);
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) setClientes(n);
  }

  const bajoMinimo = (clientes || 0) > 0 && clientes < minClientes;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS_CLIENTES.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => elegirPreset(n)}
            className={`rounded-chip px-4 py-2 text-[0.85rem] font-semibold transition ${
              clientes === n
                ? "bg-brasa text-carta"
                : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-arena-2"
            }`}
          >
            {n.toLocaleString("es-PE")}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="clientes-libres" className="mb-1 block text-[0.82rem] font-semibold text-tinta-2">
          O elegí una cantidad
        </label>
        <input
          id="clientes-libres"
          type="number"
          min={minClientes}
          step={10}
          value={texto}
          onChange={(e) => onCambiarInput(e.target.value)}
          className="w-full rounded-xl border border-linea bg-carta px-4 py-2.5 text-[0.95rem] text-tinta outline-none focus-visible:border-brasa"
        />
        <p className={`mt-1 text-[0.78rem] ${bajoMinimo ? "text-brasa" : "text-frio"}`}>
          {bajoMinimo ? "El mínimo por compra es" : "Mínimo"} {minClientes.toLocaleString("es-PE")} clientes.
        </p>
      </div>

      <div className="rounded-xl bg-arena px-4 py-3.5">
        <p className="text-[1.05rem] font-bold text-tinta">
          {clientesValidos.toLocaleString("es-PE")} clientes = {soles(precio)}
        </p>
        <p className="text-[0.78rem] text-frio">
          {soles(centavosPorCliente)} por cliente
          {hayAhorro && (
            <span className="ml-1 font-semibold text-ok">· Ahorrás {soles(ahorro)}</span>
          )}
        </p>
      </div>

      <CheckoutCulqi
        key={hits}
        hits={hits}
        clientes={clientesValidos}
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
    descripcion: "Responde lo justo y te avisa. Aprovecha mejor tus clientes.",
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
        <h3 className="text-[0.95rem] font-bold text-tinta">Comprar más clientes</h3>
        <p className="mb-4 text-[0.8rem] text-frio">
          Sumá clientes extra que no vencen con el mes. Cuantos más comprás, más barato sale.
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
