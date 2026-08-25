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
import { useCapacidadesOptimista } from "@/lib/modo-negocio";
import CheckoutCulqi from "@/components/panel/CheckoutCulqi";
import { Seccion } from "@/components/panel/Seccion";
import { PlanRestaurante } from "@/components/panel/PlanRestaurante";

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
  // Planes de restaurante. `pedidos` es el nombre viejo de `arranque`.
  resto_gratis: "Gratis",
  pedidos: "Arranque",
  arranque: "Arranque",
  crecer: "Crecer",
  full: "Full",
};

// Bloque skeleton reutilizable, mismo estilo que Skeletons.tsx (pulso sobre
// arena-2), para no depender de un "Cargando…" plano en ninguna tarjeta.
function SkeletonBloque({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-arena-2/70 ${className}`} />;
}

// ─── Tarjeta 1: Tu saldo ────────────────────────────────────────────────
function TarjetaSaldo({ uso, cargando, error }: { uso: Uso | null; cargando: boolean; error: boolean }) {
  // Esta tarjeta va sobre el VERDE HONDO: el skeleton gris y el texto de error
  // en verde oscuro serían invisibles ahí.
  if (cargando) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded-xl bg-arena/15" />
        <div className="h-9 w-24 animate-pulse rounded-xl bg-arena/15" />
        <div className="h-2.5 w-full animate-pulse rounded-full bg-arena/15" />
        <div className="h-3 w-40 animate-pulse rounded-xl bg-arena/15" />
      </div>
    );
  }

  if (error || !uso) {
    return (
      <p className="text-sm text-arena/80">
        No pudimos cargar tu saldo. Recarga la página para intentar de nuevo.
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
  // Sobre el verde hondo: menta mientras sobra saldo, ámbar cuando aprieta,
  // naranja cuando queda poco. `ok` acá casi no se distingue del fondo.
  const color = pctRestante > 0.4 ? "bg-brasa" : pctRestante >= 0.15 ? "bg-tibio" : "bg-orbita";
  const dias = Math.max(
    0,
    Math.ceil((new Date(bolsa.seResetea).getTime() - Date.now()) / 86_400_000),
  );
  const hayPrepago = bolsa.prepago.total > 0;

  // Misma estructura que la tarjeta de pedidos, para que las dos versiones de
  // esta pantalla —captación y restaurante— se lean igual: plan arriba, el
  // número grande en naranja, la barra, y el detalle abajo.
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">Plan actual</p>
          <p className="text-[1.1rem] font-bold text-arena">
            {NOMBRE_PLAN[uso.plan] ?? uso.plan}
          </p>
        </div>
        <span className="rounded-chip bg-arena/10 px-3 py-1 text-[0.78rem] font-semibold text-arena/80 ring-1 ring-arena/15">
          {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[2.6rem] font-bold leading-none tabular-nums text-orbita">
          {usadosCli.toLocaleString("es-PE")}
        </p>
        <p className="text-[0.82rem] text-arena/60">
          de {totalCli.toLocaleString("es-PE")} clientes atendidos
        </p>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-arena/15">
        {/* La barra crece con lo USADO. */}
        <div
          className={`h-full rounded-full ${color} transition-[width] duration-500`}
          style={{ width: `${pctUsado}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.82rem]">
        <p className="text-arena/75">
          Te quedan <b className="font-bold text-arena">{restanteCli.toLocaleString("es-PE")}</b> este mes
        </p>
        {hayPrepago && (
          <p className="text-arena/75">
            Extra (prepago):{" "}
            <b className="font-bold text-arena">
              {aClientes(bolsa.prepago.restante).toLocaleString("es-PE")}
            </b>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Pedidos del mes (solo restaurantes) ───────────────────────────────
/**
 * Los PEDIDOS del mes contra el cupo del plan.
 *
 * Va arriba del saldo de clientes porque es el número que el dueño de un
 * restaurante reconoce: "clientes atendidos por la IA" no le dice nada, los
 * pedidos del mes los sabe de memoria.
 *
 * Nunca dice "te quedaste sin": pasarse del cupo no corta las ventas, se cobra
 * con upgrade. Por eso pasado el tope el mensaje es "seguimos tomando todos",
 * no una alarma.
 */
function TarjetaPedidos({
  pedidos, plan, seResetea,
}: { pedidos: NonNullable<Uso["pedidos"]>; plan: string; seResetea: string }) {
  const { usados, limite } = pedidos;
  // El plan y el corte se muestran ACÁ porque en un restaurante esta tarjeta
  // reemplaza a "Tu saldo", que era donde vivían.
  const dias = Math.max(0, Math.ceil((new Date(seResetea).getTime() - Date.now()) / 86_400_000));
  const ilimitado = limite === 0;
  const pct = ilimitado ? 0 : Math.min(100, Math.round((usados / limite) * 100));
  const pasado = !ilimitado && usados > limite;
  // Verde hasta el 80%, NARANJA de ahí en más: el naranja es "hacé algo", y a
  // partir del 80% lo que hay para hacer es decidir si subís de plan.
  //
  // `orbita`, no `brasa`: pese al nombre, `brasa` es el MENTA del logo (lo
  // dice globals.css — se llama así por historia). El naranja para fondos es
  // `orbita`. No es rojo a propósito: el rojo es alerta, y pasarse del cupo no
  // es un error, se sigue vendiendo igual.
  // Sobre el verde hondo el `ok` (#1e5c22) casi no se distingue del fondo: el
  // menta del logo sí, y es el color de marca para "vas bien".
  const color = pasado || pct >= 80 ? "bg-orbita" : "bg-brasa";

  // Va sobre el VERDE HONDO, así que los colores son los de fondo oscuro: el
  // menta y el naranja del logo se usan pelados (sobre oscuro dan 7.1:1 y
  // 7.7:1), no las variantes oscurecidas que existen para fondo claro.
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">Plan actual</p>
          <p className="text-[1.1rem] font-bold text-arena">{NOMBRE_PLAN[plan] ?? plan}</p>
        </div>
        <span className="rounded-chip bg-arena/10 px-3 py-1 text-[0.78rem] font-semibold text-arena/80 ring-1 ring-arena/15">
          {dias === 0 ? "Se renueva hoy" : `Se renueva en ${dias} ${dias === 1 ? "día" : "días"}`}
        </span>
      </div>

      {/* El número en NARANJA y grande: es el dato por el que se entra acá. */}
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[2.6rem] font-bold leading-none tabular-nums text-orbita">
          {usados.toLocaleString("es-PE")}
        </p>
        <p className="text-[0.82rem] text-arena/60">
          {ilimitado ? "sin tope" : `de ${limite.toLocaleString("es-PE")} incluidos`}
        </p>
      </div>

      {!ilimitado && (
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-arena/15">
          <div
            className={`h-full rounded-full ${color} transition-[width] duration-500`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <p className="text-[0.82rem] text-arena/75">
        {ilimitado
          ? "Tu plan no tiene tope de pedidos."
          : pasado
            ? `Pasaste los ${limite.toLocaleString("es-PE")} de tu plan y seguimos tomando todos. Sube cuando quieras.`
            : `Te quedan ${(limite - usados).toLocaleString("es-PE")} este mes. Si te pasas, sigues vendiendo igual.`}
      </p>
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
      <p className="text-sm text-brasa-texto">
        No pudimos cargar los precios. Recarga la página para intentar de nuevo.
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
          O elige una cantidad
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
            <span className="ml-1 font-semibold text-ok">· Ahorras {soles(ahorro)}</span>
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
      <p className="text-sm text-brasa-texto">
        No pudimos cargar tu configuración. Recarga la página para intentar de nuevo.
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
        {estadoGuardado === "error" && <p className="mt-1 text-[0.8rem] text-brasa-texto">{errorMsg}</p>}
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
      <p className="text-sm text-brasa-texto">
        No pudimos cargar tu configuración. Recarga la página para intentar de nuevo.
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
          className="rounded-full bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {estadoGuardado === "guardando" ? "Guardando…" : "Guardar"}
        </button>
        {estadoGuardado === "ok" && <p className="text-sm font-medium text-ok">Guardado ✓</p>}
        {estadoGuardado === "error" && <p className="text-sm text-brasa-texto">{errorMsg}</p>}
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

  // EL RUBRO SALE DE LAS CAPACIDADES, no del fetch de uso (2026-08-19).
  //
  // Antes era `!!uso?.pedidos`, o sea que se descubría a mitad de camino:
  // mientras `uso` era null, `esRestaurante` daba false y a un restaurante se
  // le pintaban "Tu saldo" y "Comprar más clientes" —con sus skeletons y todo—
  // que desaparecían al llegar la respuesta. Dos tarjetas prometiendo
  // contenido que nunca iba a llegar. Reportado por Jonathan.
  //
  // Las capacidades vienen cacheadas en localStorage, así que el primer render
  // ya sabe el rubro y no hay nada que corregir después.
  const caps = useCapacidadesOptimista();
  const esRestaurante = caps.tieneCarta;

  return (
    // El ORDEN cuenta (2026-08-18): primero lo que el dueño vino a ver —cuánto
    // lleva usado de su plan—, después los ajustes. El interruptor del bot
    // estaba arriba de todo, y es lo que menos se toca en esta pantalla.
    <div className="space-y-5">
      {/* Solo si el plan cuenta pedidos. A un negocio de captación un contador
          de pedidos le sería ruido, y por eso el backend manda `null`. */}
      {/* Con skeleton (2026-08-19): es lo PRIMERO de la página y era lo único
          sin placeholder, así que aparecía de golpe y empujaba todo lo de
          abajo. El `esRestaurante` viene de capacidades, ya cacheadas, así que
          se sabe si va antes de tener el dato. */}
      {esRestaurante && cargandoUso && (
        <Seccion titulo="Pedidos de este mes" bajada="Lo que llevas vendido contra lo que incluye tu plan." tono="hondo">
          <div className="h-24 animate-pulse rounded-tarjeta bg-arena-2/60" />
        </Seccion>
      )}
      {!cargandoUso && uso?.pedidos && (
        <Seccion
          titulo="Pedidos de este mes"
          bajada="Lo que llevas vendido contra lo que incluye tu plan."
          tono="hondo"
        >
          <TarjetaPedidos pedidos={uso.pedidos} plan={uso.plan} seResetea={uso.bolsa.seResetea} />
        </Seccion>
      )}

      {/* Contratar o cambiar el plan (2026-08-24: ya no es solo restaurantes).
          Con Culqi LIVE y los planes de captación contratables, la misma
          pantalla sirve para las dos escaleras: el backend decide qué planes
          ofrecer según el rubro (GET /suscripcion → disponibles) y las
          tarjetas muestran la unidad que corresponde (pedidos o clientes). */}
      <PlanRestaurante />

      {/* "Clientes atendidos por la IA" y "comprar clientes extra" son de los
          planes de CAPTACIÓN. En un plan de restaurante la unidad es el pedido
          —ya está arriba— y no se compran clientes sueltos: si te pasas del
          cupo sigues vendiendo y subes de plan. Mostrarlas aquí sería pedirle al
          dueño que ignore dos tarjetas cada vez que entra. */}
      {!esRestaurante && (
        <>
          <Seccion
            titulo="Tu saldo"
            bajada="Cuántos clientes puedes atender este mes y cuándo se renueva."
            tono="hondo"
          >
            <TarjetaSaldo uso={uso} cargando={cargandoUso} error={errorUso} />
          </Seccion>

          <Seccion
            titulo="Comprar más clientes"
            bajada="Suma clientes extra que no vencen con el mes. Cuantos más compras, más barato sale."
          >
            <TarjetaComprar catalogo={catalogo} cargando={cargandoCatalogo} onExito={recargarSaldo} />
          </Seccion>
        </>
      )}

      <Seccion
        titulo="¿El bot está atendiendo?"
        bajada="El interruptor principal: prende o apaga al bot cuando quieras."
      >
        <TarjetaSwitch
          cargando={cargandoPlan} valorInicial={botActivoInicial} error={errorPlan} campo="botActivo"
          aria="¿El bot está atendiendo?"
          textoOn="Activo — el bot responde a tus clientes"
          textoOff="Pausado — el bot no responde (atiendes tú)"
          subtextoOn="Apágalo un momento si quieres atender tú mismo, sin que el bot conteste."
          subtextoOff="Los mensajes se siguen guardando; el bot no va a contestar hasta que lo actives de nuevo."
        />
      </Seccion>

      <Seccion
        titulo="¿Hasta dónde quieres que el bot insista?"
        bajada="Define cuánto conversa el bot con cada cliente antes de avisarte que necesita atención tuya."
      >
        <TarjetaInsistencia
          cargando={cargandoPlan}
          valorInicial={insistenciaInicial}
          error={errorPlan}
        />
      </Seccion>
    </div>
  );
}

export default PlanConsumo;
