"use client";

import { useEffect, useRef, useState } from "react";
import { obtenerMiPlan, guardarMiPlan, type MiPlan } from "@/lib/api";

/**
 * LO QUE EL SISTEMA HACE SOLO (2026-09-18, pedido de Jonathan tras auditar
 * marketing: "qué más podemos agregar").
 *
 * Hasta hoy estas cuatro automatizaciones existían en el backend pero se
 * prendían por script — el dueño no las podía tocar. Acá las junta en un solo
 * lugar, cada una con su interruptor y lo mínimo para entenderla:
 *
 *  1. RESCATE: al que preguntó y no volvió, un recordatorio a las ~20h.
 *  2. SEGUIMIENTO DEL ESCALADO: al que un humano tomó y no agendó, uno a las 36h.
 *  3. ALERTAS DE ANUNCIOS: aviso por WhatsApp al dueño cuando un anuncio se cae.
 *  4. TOPE DE GASTO: el máximo que un anuncio puede gastar al crearlo.
 *
 * Las dos primeras ESCRIBEN a clientes reales, así que arrancan apagadas y con
 * un aviso claro: prenderlas es decisión del dueño.
 */
export function AjustesMarketing({ tenant }: { tenant?: string }) {
  return <AjustesDelNegocio key={tenant ?? "activa"} tenant={tenant} />;
}

type CambiosPlan = Parameters<typeof guardarMiPlan>[0];

function AjustesDelNegocio({ tenant }: { tenant?: string }) {
  const [p, setP] = useState<MiPlan | null>(null);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const ocupado = useRef(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true); setError("");
    void obtenerMiPlan(tenant).then((plan) => {
      if (!vigente) return;
      if (!plan) setError("No pudimos cargar las automatizaciones de este negocio.");
      setP(plan);
    }).catch(() => {
      if (vigente) setError("No pudimos cargar las automatizaciones de este negocio.");
    }).finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [tenant, intento]);

  async function guardar(cambios: CambiosPlan) {
    if (ocupado.current || !p) return false;
    ocupado.current = true;
    const anterior = p;
    setGuardando(true); setOk(false); setError("");
    setP({ ...p, ...cambios });
    try {
      const resultado = await guardarMiPlan(cambios, tenant);
      if (!vivo.current) return false;
      if (!resultado.ok) {
        setP(anterior);
        setError(resultado.error ?? "No se pudo guardar. Tus cambios anteriores siguen vigentes.");
        return false;
      }
      setOk(true);
      return true;
    } catch {
      if (vivo.current) {
        setP(anterior);
        setError("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
      }
      return false;
    } finally {
      ocupado.current = false;
      if (vivo.current) setGuardando(false);
    }
  }

  if (cargando) return <div role="status" aria-label="Cargando automatizaciones" className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;
  if (!p) return <div role="alert" className="space-y-3 rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
    <p>{error}</p>
    <button type="button" onClick={() => setIntento(i => i + 1)} className={btnCls}>Reintentar</button>
  </div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[1.15rem] font-bold text-tinta">Lo que el sistema hace solo</h2>
        <p className="mt-0.5 text-[0.86rem] text-frio">
          Automatizaciones que trabajan por ti sin que tengas que estar encima. Prende las que quieras.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-alerta-hondo">{error}</p>}
      <p role="status" className="text-sm text-frio">{guardando ? "Guardando…" : ok ? "Cambios guardados" : ""}</p>
      <fieldset disabled={guardando} aria-busy={guardando} className="min-w-0 space-y-4">
        <RescateCard plan={p} guardar={guardar} guardando={guardando} />
        <SeguimientoCard plan={p} guardar={guardar} guardando={guardando} />
        <AlertasCard plan={p} guardar={guardar} guardando={guardando} />
        <TopeGastoCard plan={p} guardar={guardar} guardando={guardando} />
      </fieldset>
    </div>
  );
}

// ── Tarjeta base con interruptor ─────────────────────────────────────────────

function Switch({ activo, onToggle, nombre, disabled }: { activo: boolean; onToggle: () => void; nombre: string; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      type="button"
      disabled={disabled}
      aria-label={nombre}
      role="switch"
      aria-checked={activo}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? "bg-brasa" : "bg-linea"}`}
    >
      <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-carta transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Tarjeta({ titulo, bajada, activo, onToggle, children, aviso, guardando, mostrarCampos }: {
  titulo: string; bajada: string; activo: boolean; onToggle: () => void;
  children?: React.ReactNode; aviso?: string; guardando?: boolean; mostrarCampos?: boolean;
}) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.02rem] font-bold text-tinta">{titulo}</h3>
          <p className="mt-0.5 text-[0.82rem] text-frio">{bajada}</p>
        </div>
        <Switch activo={activo} onToggle={onToggle} nombre={titulo} disabled={guardando} />
      </div>
      {activo && aviso && (
        <p className="mt-3 rounded-tarjeta bg-tibio-suave px-3 py-2 text-[0.8rem] text-tibio">{aviso}</p>
      )}
      {(activo || mostrarCampos) && children && <div className="mt-4 border-t border-linea pt-4">{children}</div>}
    </div>
  );
}

const inputCls =
  "w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40";
const btnCls =
  "shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50";

type CardProps = { plan: MiPlan; guardar: (cambios: CambiosPlan) => Promise<boolean>; guardando: boolean };

// ── 1. Rescate ───────────────────────────────────────────────────────────────

function RescateCard({ plan, guardar: guardarPlan, guardando }: CardProps) {
  const [mensaje, setMensaje] = useState(plan.rescateMensaje ?? "");
  const [nivel, setNivel] = useState<"caliente" | "tibio">(plan.rescateNivelMinimo ?? "caliente");

  async function toggle() {
    const activo = !plan.rescateActivo;
    await guardarPlan({ rescateActivo: activo });
  }
  async function guardar() {
    await guardarPlan({ rescateMensaje: mensaje.trim(), rescateNivelMinimo: nivel });
  }

  return (
    <Tarjeta
      titulo="Rescatar al que preguntó y no volvió"
      bajada="Si alguien preguntó, le respondiste y no escribió más, le mandamos un recordatorio a las ~20 horas. Una sola vez."
      activo={!!plan.rescateActivo}
      guardando={guardando}
      onToggle={toggle}
      aviso="Le escribe a clientes reales de forma automática. Nunca a los que solo dijeron 'hola' y se fueron."
    >
      <label className="text-[0.86rem] font-bold text-tinta">¿A quién?</label>
      <div className="mt-1.5 flex gap-2">
        {(["caliente", "tibio"] as const).map((n) => (
          <button
            key={n}
            onClick={() => setNivel(n)}
            className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
              nivel === n ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
            }`}
          >
            {n === "caliente" ? "Solo los muy interesados" : "También los tibios"}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[0.76rem] text-frio">
        {nivel === "caliente"
          ? "Solo a quien mostró intención clara de comprar."
          : "A los que preguntaron el precio y no volvieron (lo más común). Incluye también a los muy interesados."}
      </p>

      <label className="mt-3 block text-[0.86rem] font-bold text-tinta">
        Mensaje <span className="font-normal text-frio">(opcional)</span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={mensaje}
          aria-label="Mensaje de rescate"
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={300}
          placeholder="Vacío = usamos uno por defecto"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
    </Tarjeta>
  );
}

// ── 2. Seguimiento del escalado ──────────────────────────────────────────────

function SeguimientoCard({ plan, guardar: guardarPlan, guardando }: CardProps) {
  const [mensaje, setMensaje] = useState(plan.seguimientoEscaladoMensaje ?? "");

  async function toggle() {
    const activo = !plan.seguimientoEscaladoActivo;
    await guardarPlan({ seguimientoEscaladoActivo: activo });
  }
  async function guardar() {
    await guardarPlan({ seguimientoEscaladoMensaje: mensaje.trim() });
  }

  return (
    <Tarjeta
      titulo="Seguir al que escalaste y no agendó"
      bajada="Cuando tú o tu equipo toman una conversación a mano y el cliente no llega a agendar, le mandamos un recordatorio a las 36 horas. Una sola vez, y nunca si ya tiene una cita."
      activo={!!plan.seguimientoEscaladoActivo}
      guardando={guardando}
      onToggle={toggle}
      aviso="Le escribe al cliente de forma automática. Solo si la última palabra fue tuya y pasaron 36h — no te pisa mientras negocias."
    >
      <label className="block text-[0.86rem] font-bold text-tinta">
        Mensaje <span className="font-normal text-frio">(opcional)</span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={mensaje}
          aria-label="Mensaje de seguimiento"
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={300}
          placeholder="Vacío = '¿pudiste ver la agenda? …'"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
    </Tarjeta>
  );
}

// ── 3. Alertas de anuncios ───────────────────────────────────────────────────

function AlertasCard({ plan, guardar: guardarPlan, guardando }: CardProps) {
  const [numero, setNumero] = useState(plan.alertasAnunciosA ?? "");
  const [error, setError] = useState("");

  const activo = !!plan.alertasAnunciosA;

  async function toggle() {
    if (activo) {
      // Apagar = borrar el número.
      if (await guardarPlan({ alertasAnunciosA: null })) setNumero("");
    } else {
      await guardar();
    }
    // Activar requiere el número válido que se muestra también estando apagado.
  }
  async function guardar() {
    const limpio = numero.replace(/\D/g, "");
    if (limpio.length < 9 || limpio.length > 15) { setError("Escribe un número de WhatsApp válido (9 a 15 dígitos)."); return; }
    setError("");
    await guardarPlan({ alertasAnunciosA: limpio });
  }

  return (
    <Tarjeta
      titulo="Avisarme si un anuncio se cae"
      bajada="Te mandamos un WhatsApp cuando un anuncio deja de rendir (gasta y no trae gente), y un resumen los lunes. Al dueño, no al marketero: quien decide el presupuesto es quien pone la plata."
      activo={activo}
      guardando={guardando}
      mostrarCampos
      onToggle={toggle}
    >
      <label className="block text-[0.86rem] font-bold text-tinta">¿A qué WhatsApp te avisamos?</label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={numero}
          aria-label="WhatsApp para alertas"
          onChange={(e) => setNumero(e.target.value)}
          inputMode="numeric"
          placeholder="Ej: 51987654321"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "Guardando…" : activo ? "Guardar" : "Activar alertas"}</button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-[0.8rem] font-semibold text-alerta-hondo">{error}</p>}
    </Tarjeta>
  );
}

// ── 4. Tope de gasto ─────────────────────────────────────────────────────────

function TopeGastoCard({ plan, guardar: guardarPlan, guardando }: CardProps) {
  const [tope, setTope] = useState(plan.adsTopeMax ? String(plan.adsTopeMax) : "");
  const [error, setError] = useState("");

  async function guardar() {
    const valor = tope.trim().replace(",", ".");
    const n = Number(valor);
    if (!/^\d+(\.\d{1,2})?$/.test(valor) || !Number.isFinite(n)) {
      setError("Escribe un importe válido, mayor o igual a cero. Usa 0 para quitar el tope."); return;
    }
    setError("");
    await guardarPlan({ adsTopeMax: n });
  }

  const sinTope = !plan.adsTopeMax;

  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <h3 className="text-[1.02rem] font-bold text-tinta">Tope de gasto en publicidad</h3>
      <p className="mt-0.5 text-[0.82rem] text-frio">
        Al crear un anuncio no te deja poner un presupuesto mayor a este monto.
        Si activas las alertas por WhatsApp, te avisamos cuando el gasto real alcanza
        el 80% o supera el tope. Este aviso no pausa los anuncios automáticamente:
        debes pausarlos tú. {sinTope && "Ahora no hay tope."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[0.9rem] font-semibold text-tinta-2">S/</span>
        <input
          value={tope}
          aria-label="Tope de gasto en soles"
          onChange={(e) => setTope(e.target.value)}
          inputMode="decimal"
          placeholder="0 = sin tope"
          className={`${inputCls} max-w-[140px]`}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
      {error && <p role="alert" className="mt-1.5 text-sm text-alerta-hondo">{error}</p>}
    </div>
  );
}
