"use client";

import { useEffect, useState } from "react";
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
export function AjustesMarketing() {
  const [p, setP] = useState<MiPlan | null>(null);

  useEffect(() => {
    void obtenerMiPlan().then(setP);
  }, []);

  if (!p) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[1.15rem] font-bold text-tinta">Lo que el sistema hace solo</h2>
        <p className="mt-0.5 text-[0.86rem] text-frio">
          Automatizaciones que trabajan por ti sin que tengas que estar encima. Prende las que quieras.
        </p>
      </div>

      <RescateCard plan={p} onChange={setP} />
      <SeguimientoCard plan={p} onChange={setP} />
      <AlertasCard plan={p} onChange={setP} />
      <TopeGastoCard plan={p} onChange={setP} />
    </div>
  );
}

// ── Tarjeta base con interruptor ─────────────────────────────────────────────

function Switch({ activo, onToggle }: { activo: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="switch"
      aria-checked={activo}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${activo ? "bg-brasa" : "bg-linea"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-carta transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

function Tarjeta({ titulo, bajada, activo, onToggle, children, aviso }: {
  titulo: string; bajada: string; activo: boolean; onToggle: () => void;
  children?: React.ReactNode; aviso?: string;
}) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[1.02rem] font-bold text-tinta">{titulo}</h3>
          <p className="mt-0.5 text-[0.82rem] text-frio">{bajada}</p>
        </div>
        <Switch activo={activo} onToggle={onToggle} />
      </div>
      {activo && aviso && (
        <p className="mt-3 rounded-tarjeta bg-tibio-suave px-3 py-2 text-[0.8rem] text-tibio">{aviso}</p>
      )}
      {activo && children && <div className="mt-4 border-t border-linea pt-4">{children}</div>}
    </div>
  );
}

function Guardado({ visible }: { visible: boolean }) {
  return visible ? <p className="mt-1.5 text-[0.8rem] font-semibold text-ok">✓ Guardado</p> : null;
}

const inputCls =
  "w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.88rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40";
const btnCls =
  "shrink-0 rounded-chip bg-brasa px-4 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50";

type CardProps = { plan: MiPlan; onChange: (p: MiPlan) => void };

// ── 1. Rescate ───────────────────────────────────────────────────────────────

function RescateCard({ plan, onChange }: CardProps) {
  const [mensaje, setMensaje] = useState(plan.rescateMensaje ?? "");
  const [nivel, setNivel] = useState<"caliente" | "tibio">(plan.rescateNivelMinimo ?? "caliente");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function toggle() {
    const activo = !plan.rescateActivo;
    onChange({ ...plan, rescateActivo: activo });
    await guardarMiPlan({ rescateActivo: activo });
  }
  async function guardar() {
    setGuardando(true); setOk(false);
    const r = await guardarMiPlan({ rescateMensaje: mensaje.trim(), rescateNivelMinimo: nivel });
    setGuardando(false);
    if (r.ok) { onChange({ ...plan, rescateMensaje: mensaje.trim(), rescateNivelMinimo: nivel }); setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  return (
    <Tarjeta
      titulo="Rescatar al que preguntó y no volvió"
      bajada="Si alguien preguntó, le respondiste y no escribió más, le mandamos un recordatorio a las ~20 horas. Una sola vez."
      activo={!!plan.rescateActivo}
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
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={300}
          placeholder="Vacío = usamos uno por defecto"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
      <Guardado visible={ok} />
    </Tarjeta>
  );
}

// ── 2. Seguimiento del escalado ──────────────────────────────────────────────

function SeguimientoCard({ plan, onChange }: CardProps) {
  const [mensaje, setMensaje] = useState(plan.seguimientoEscaladoMensaje ?? "");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function toggle() {
    const activo = !plan.seguimientoEscaladoActivo;
    onChange({ ...plan, seguimientoEscaladoActivo: activo });
    await guardarMiPlan({ seguimientoEscaladoActivo: activo });
  }
  async function guardar() {
    setGuardando(true); setOk(false);
    const r = await guardarMiPlan({ seguimientoEscaladoMensaje: mensaje.trim() });
    setGuardando(false);
    if (r.ok) { onChange({ ...plan, seguimientoEscaladoMensaje: mensaje.trim() }); setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  return (
    <Tarjeta
      titulo="Seguir al que escalaste y no agendó"
      bajada="Cuando tú o tu equipo toman una conversación a mano y el cliente no llega a agendar, le mandamos un recordatorio a las 36 horas. Una sola vez, y nunca si ya tiene una cita."
      activo={!!plan.seguimientoEscaladoActivo}
      onToggle={toggle}
      aviso="Le escribe al cliente de forma automática. Solo si la última palabra fue tuya y pasaron 36h — no te pisa mientras negocias."
    >
      <label className="block text-[0.86rem] font-bold text-tinta">
        Mensaje <span className="font-normal text-frio">(opcional)</span>
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          maxLength={300}
          placeholder="Vacío = '¿pudiste ver la agenda? …'"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
      <Guardado visible={ok} />
    </Tarjeta>
  );
}

// ── 3. Alertas de anuncios ───────────────────────────────────────────────────

function AlertasCard({ plan, onChange }: CardProps) {
  const [numero, setNumero] = useState(plan.alertasAnunciosA ?? "");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  const activo = !!plan.alertasAnunciosA;

  async function toggle() {
    if (activo) {
      // Apagar = borrar el número.
      onChange({ ...plan, alertasAnunciosA: null });
      setNumero("");
      await guardarMiPlan({ alertasAnunciosA: null });
    }
    // Prender no se hace con el switch: se hace guardando un número válido abajo.
  }
  async function guardar() {
    const limpio = numero.replace(/\D/g, "");
    if (limpio.length < 9) { setError("Escribe un número de WhatsApp válido (9 a 15 dígitos)."); return; }
    setError(""); setGuardando(true); setOk(false);
    const r = await guardarMiPlan({ alertasAnunciosA: limpio });
    setGuardando(false);
    if (r.ok) { onChange({ ...plan, alertasAnunciosA: limpio }); setOk(true); setTimeout(() => setOk(false), 2000); }
    else setError(r.error ?? "No se pudo guardar.");
  }

  return (
    <Tarjeta
      titulo="Avisarme si un anuncio se cae"
      bajada="Te mandamos un WhatsApp cuando un anuncio deja de rendir (gasta y no trae gente), y un resumen los lunes. Al dueño, no al marketero: quien decide el presupuesto es quien pone la plata."
      activo={activo}
      onToggle={toggle}
    >
      <label className="block text-[0.86rem] font-bold text-tinta">¿A qué WhatsApp te avisamos?</label>
      <div className="mt-1.5 flex gap-2">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          inputMode="numeric"
          placeholder="Ej: 51987654321"
          className={inputCls}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
      {error && <p className="mt-1.5 text-[0.8rem] font-semibold text-alerta-hondo">{error}</p>}
      <Guardado visible={ok} />
    </Tarjeta>
  );
}

// ── 4. Tope de gasto ─────────────────────────────────────────────────────────

function TopeGastoCard({ plan, onChange }: CardProps) {
  const [tope, setTope] = useState(plan.adsTopeMax ? String(plan.adsTopeMax) : "");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function guardar() {
    const n = Number(tope.replace(/[^\d.]/g, "")) || 0;
    setGuardando(true); setOk(false);
    const r = await guardarMiPlan({ adsTopeMax: n });
    setGuardando(false);
    if (r.ok) { onChange({ ...plan, adsTopeMax: n }); setOk(true); setTimeout(() => setOk(false), 2000); }
  }

  const sinTope = !plan.adsTopeMax;

  return (
    <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <h3 className="text-[1.02rem] font-bold text-tinta">Tope de gasto en publicidad</h3>
      <p className="mt-0.5 text-[0.82rem] text-frio">
        Tu límite de gasto. Hace dos cosas: al crear un anuncio no te deja poner un
        presupuesto mayor, y si el gasto real se acerca (te avisamos al 80%) o pasa
        este monto, te llega un WhatsApp. {sinTope && "Ahora no hay tope."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-[0.9rem] font-semibold text-tinta-2">S/</span>
        <input
          value={tope}
          onChange={(e) => setTope(e.target.value)}
          inputMode="decimal"
          placeholder="0 = sin tope"
          className={`${inputCls} max-w-[140px]`}
        />
        <button onClick={guardar} disabled={guardando} className={btnCls}>{guardando ? "…" : "Guardar"}</button>
      </div>
      <Guardado visible={ok} />
    </div>
  );
}
