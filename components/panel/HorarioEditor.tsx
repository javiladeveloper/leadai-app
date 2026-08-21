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
      setError("Pon un monto como 30 o 30.00.");
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

        {/* CUÁNTO PUEDE LA COCINA (2026-08-19). Solo se editaba desde la app.
            Estos dos números son los que arman el "listo en 35-50 min" que el
            cliente ve antes de pagar: si están mal, el bot promete un tiempo
            que la cocina no puede cumplir. */}
        <div>
          <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">
            Capacidad de la cocina
          </p>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Con esto el bot calcula el tiempo de espera que le promete al cliente.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            <Numero
              etiqueta="Pedidos a la vez"
              valor={cfg.capacidadSimultanea}
              min={1}
              max={20}
              onChange={(n) => aplicar({ capacidadSimultanea: n })}
            />
            <Numero
              etiqueta="Minutos por pedido"
              valor={cfg.minutosPorPedido}
              min={5}
              max={120}
              paso={5}
              onChange={(n) => aplicar({ minutosPorPedido: n })}
            />
          </div>
        </div>

        {/* RESERVAS. Local físico vs solo delivery: controla si la pestaña
            Reservas existe en la app y si el bot las toma. */}
        {/* PRIMERO EL LOCAL, DESPUÉS LAS RESERVAS (2026-08-20, Jonathan: "si no
            tengo local físico esa opción está de más").

            Antes había UNA sola pregunta, "Acepto reservas de mesa", que un
            dark kitchen tenía que descubrir y apagar. Está al revés: la
            pregunta de fondo es si hay local, y solo si lo hay tiene sentido
            hablar de reservas. Un restaurante con mesas, además, puede no
            querer tomarlas por WhatsApp — son dos decisiones distintas y
            antes compartían un campo. */}
        <div className="space-y-2">
          <Interruptor
            titulo="Tengo local físico"
            ayuda="Apágalo si atiendes solo por delivery, sin mesas para tus clientes."
            activo={cfg.tieneLocal}
            onCambiar={(v) =>
              // Sin local no hay reservas posibles: se apagan juntas para que
              // no quede un "acepto reservas" encendido que el bot ignora.
              aplicar(v ? { tieneLocal: true } : { tieneLocal: false, aceptaReservas: false })
            }
          />

          {/* Anidada: margen y línea a la izquierda para que se lea "dentro
              de" la respuesta anterior, no como otra pregunta del mismo nivel. */}
          {cfg.tieneLocal && (
            <div className="surge ml-3 space-y-2 border-l-2 border-linea pl-3">
              <Interruptor
                titulo="Acepto reservas de mesa"
                ayuda="El bot le ofrece reservar mesa a quien te escribe."
                activo={cfg.aceptaReservas}
                onCambiar={(v) => aplicar({ aceptaReservas: v })}
              />
              {/* LAS MESAS (2026-08-21). Van acá dentro y no en su propia
                  sección: sin local físico no existen, y quien acaba de decir
                  que tiene local es exactamente quien las va a cargar. */}
              <EditorSalas salas={cfg.salas} onCambiar={(salas) => aplicar({ salas })} />
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
          {error && <span className="fila-entra font-semibold text-alerta">{error}</span>}
          {!error && guardando && <span className="text-frio">Guardando…</span>}
          {!error && !guardando && guardado && <span className="confirma font-semibold text-ok">Guardado ✓</span>}
        </div>
      </div>
    </Seccion>
  );
}

/** Un número con - y +: en el celular escribir "12" en un input es peor. */
function Numero({
  etiqueta, valor, min, max, paso = 1, onChange,
}: {
  etiqueta: string; valor: number; min: number; max: number; paso?: number;
  onChange: (n: number) => void;
}) {
  const mover = (d: number) => onChange(Math.min(max, Math.max(min, valor + d * paso)));
  return (
    <div>
      <span className="block text-[0.82rem] text-frio">{etiqueta}</span>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={() => mover(-1)}
          disabled={valor <= min}
          aria-label={`Bajar ${etiqueta}`}
          className="grid size-9 place-items-center rounded-lg text-[1.1rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena disabled:opacity-40"
        >
          −
        </button>
        <span className="w-10 text-center text-[1.05rem] font-bold tabular-nums text-tinta">{valor}</span>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={valor >= max}
          aria-label={`Subir ${etiqueta}`}
          className="grid size-9 place-items-center rounded-lg text-[1.1rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
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

/**
 * UN INTERRUPTOR QUE SE VE (2026-08-20).
 *
 * Los checkbox nativos de esta pantalla se veían "transparentes" sobre el
 * fondo claro (reporte de Jonathan): `accent-color` solo pinta el relleno
 * cuando están MARCADOS, así que un checkbox apagado quedaba como un cuadrito
 * casi invisible y no se leía como un control.
 *
 * Este es un switch dibujado: se ve encendido o apagado de un vistazo, sin
 * depender de cómo el sistema operativo pinte los controles nativos.
 */
function Interruptor({
  titulo, ayuda, activo, onCambiar,
}: {
  titulo: string;
  ayuda: string;
  activo: boolean;
  onCambiar: (valor: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-tarjeta bg-arena/50 p-4 transition hover:bg-arena/70">
      <span className="min-w-0">
        <span className="block font-bold text-tinta">{titulo}</span>
        <span className="mt-0.5 block text-[0.84rem] leading-snug text-frio">{ayuda}</span>
      </span>
      {/* El input real queda accesible (teclado, lectores) pero invisible: lo
          que se ve es el riel de abajo. */}
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={activo}
          onChange={(e) => onCambiar(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden
          className={`h-6 w-11 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brasa/40 ${
            activo ? "bg-brasa" : "bg-arena-2 ring-1 ring-linea"
          }`}
        />
        <span
          aria-hidden
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-carta shadow-sm transition-all ${
            activo ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </label>
  );
}

/** Un ambiente del local con sus mesas. Espejo de `Tenant.salas`. */
type SalaLocal = { sala: string; mesas: string[] };

/**
 * LAS MESAS DEL LOCAL (2026-08-21).
 *
 * El backend ya guardaba `salas`, pero no había dónde cargarlas: el selector
 * de mesa al tomar un pedido nunca aparecía.
 *
 * DISEÑO: un restaurante chico tiene una sala y ocho mesas, y las carga una
 * vez. Por eso no hay pantalla aparte ni plano del salón — se escriben los
 * números y listo. Las salas ("Terraza", "Segundo piso") existen porque un
 * local con dos ambientes numera desde 1 en cada uno.
 *
 * Las mesas son TEXTO, no números: "T1", "Barra 2" y "12" conviven sin que
 * nadie tenga que explicar por qué.
 */
function EditorSalas({
  salas, onCambiar,
}: { salas: SalaLocal[]; onCambiar: (s: SalaLocal[]) => void }) {
  const [nuevaMesa, setNuevaMesa] = useState<Record<number, string>>({});
  // El nombre del ambiente se edita en local y se guarda al salir del campo:
  // guardar en cada tecla mandaría un PATCH por letra.
  const [nombres, setNombres] = useState<Record<number, string>>({});

  function agregarSala() {
    // La primera sala se llama "Salón" y no "Sala 1": la mayoría tiene una
    // sola y nunca va a haber una segunda que justifique el número.
    const nombre = salas.length === 0 ? "Salón" : `Sala ${salas.length + 1}`;
    onCambiar([...salas, { sala: nombre, mesas: [] }]);
  }

  /** Guarda el nombre editado. Si quedó vacío, se mantiene el anterior: un
   *  ambiente sin nombre no se puede elegir al tomar el pedido. */
  function confirmarNombre(i: number) {
    const escrito = (nombres[i] ?? "").trim();
    setNombres((n) => { const c = { ...n }; delete c[i]; return c; });
    if (!escrito || escrito === salas[i].sala) return;
    onCambiar(salas.map((s, j) => (j === i ? { ...s, sala: escrito } : s)));
  }

  function quitarSala(i: number) {
    onCambiar(salas.filter((_, j) => j !== i));
  }

  function agregarMesa(i: number) {
    const valor = (nuevaMesa[i] ?? "").trim();
    if (!valor) return;
    // Una mesa repetida en la misma sala haría que dos pedidos distintos
    // parezcan del mismo lugar.
    if (salas[i].mesas.includes(valor)) {
      setNuevaMesa((n) => ({ ...n, [i]: "" }));
      return;
    }
    onCambiar(salas.map((s, j) => (j === i ? { ...s, mesas: [...s.mesas, valor] } : s)));
    setNuevaMesa((n) => ({ ...n, [i]: "" }));
  }

  function quitarMesa(i: number, mesa: string) {
    onCambiar(salas.map((s, j) => (j === i ? { ...s, mesas: s.mesas.filter((m) => m !== mesa) } : s)));
  }

  return (
    <div className="rounded-tarjeta bg-arena/50 p-4">
      <p className="font-bold text-tinta">Mis mesas</p>
      <p className="mt-0.5 text-[0.84rem] leading-snug text-frio">
        Para poder anotar en qué mesa come cada pedido. Si atendés solo en
        mostrador, dejalo vacío.
      </p>

      <div className="mt-3 space-y-3">
        {salas.map((s, i) => (
          <div key={i} className="surge rounded-tarjeta bg-carta p-3 ring-1 ring-linea">
            <div className="flex items-center gap-2">
              <input
                value={nombres[i] ?? s.sala}
                onChange={(e) => setNombres((n) => ({ ...n, [i]: e.target.value }))}
                onBlur={() => confirmarNombre(i)}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                placeholder="Nombre del ambiente"
                className="min-w-0 flex-1 rounded-chip border border-linea bg-arena/30 px-2.5 py-1 text-[0.88rem] font-semibold text-tinta outline-none focus:border-brasa"
              />
              <button
                type="button"
                onClick={() => quitarSala(i)}
                className="shrink-0 rounded-chip px-2 py-1 text-[0.78rem] text-frio transition hover:bg-alerta-suave hover:text-alerta"
              >
                Quitar
              </button>
            </div>

            {/* Las mesas como chips: se ven todas de un vistazo y se quitan
                con un toque, que es todo lo que se hace con ellas. */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {s.mesas.map((m) => (
                <span
                  key={m}
                  className="fila-entra inline-flex items-center gap-1 rounded-chip bg-brasa-suave px-2 py-1 text-[0.8rem] font-semibold text-brasa-texto"
                >
                  {m}
                  <button
                    type="button"
                    onClick={() => quitarMesa(i, m)}
                    aria-label={`Quitar la mesa ${m}`}
                    className="text-brasa-texto/60 transition hover:text-alerta"
                  >
                    ×
                  </button>
                </span>
              ))}
              {s.mesas.length === 0 && (
                <span className="text-[0.8rem] text-frio/70">Sin mesas todavía</span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <input
                value={nuevaMesa[i] ?? ""}
                onChange={(e) => setNuevaMesa((n) => ({ ...n, [i]: e.target.value }))}
                // Enter agrega y deja el foco: se cargan ocho mesas seguidas
                // sin soltar el teclado.
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarMesa(i); } }}
                placeholder="N.° o nombre"
                maxLength={20}
                className="w-32 rounded-chip border border-linea bg-arena/30 px-2.5 py-1 text-[0.85rem] text-tinta outline-none focus:border-brasa"
              />
              <button
                type="button"
                onClick={() => agregarMesa(i)}
                disabled={!(nuevaMesa[i] ?? "").trim()}
                className="rounded-chip bg-arena px-2.5 py-1 text-[0.8rem] font-semibold text-tinta-2 transition hover:bg-arena-2 disabled:opacity-40"
              >
                Agregar
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={agregarSala}
          className="w-full rounded-tarjeta border border-dashed border-linea py-2 text-[0.85rem] font-semibold text-frio transition hover:border-brasa hover:text-brasa-texto"
        >
          {salas.length === 0 ? "+ Cargar mis mesas" : "+ Otro ambiente"}
        </button>
      </div>
    </div>
  );
}
