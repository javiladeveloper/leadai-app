"use client";

import { useState } from "react";
import { actualizarTarea, crearTarea, type TareaDto, type TipoTarea } from "@/lib/api";
import { invalidar } from "@/lib/cache-datos";
import { horaLima, diaLima, hoyLima } from "@/lib/agenda";
import {
  ATAJOS_CUANDO, TIPOS_TAREA, cuandoTarea, diaDeAtajo, tareaAtrasada, tipoTareaDe, tituloTarea, venceEnDe, type Atajo,
} from "@/lib/crm";

type Cuando = Atajo | "fecha";

interface Borrador {
  tipo: TipoTarea;
  detalle: string;
  cuando: Cuando;
  fecha: string;
  hora: string;
}

function borradorNuevo(): Borrador {
  return { tipo: "llamar", detalle: "", cuando: "manana", fecha: "", hora: "" };
}

function borradorDe(t: TareaDto): Borrador {
  return {
    tipo: t.tipo,
    detalle: t.titulo ?? "",
    cuando: "fecha",
    fecha: diaLima(t.venceEn),
    hora: t.conHora ? horaLima(t.venceEn) : "",
  };
}

/**
 * "PRÓXIMO PASO" EN LA FICHA (CRM fase 1, 2026-10-13).
 *
 * Qué toca con este cliente y cuándo: "Llamar a Ana · mañana". Sin esto, lo
 * que la vendedora prometía ("te llamo el lunes") quedaba en su cabeza o en
 * la nota, que nadie vuelve a leer. El servidor avisa con un push cuando
 * toca, y el paso aparece en "Hoy" de Inicio.
 *
 * Crear: qué (Llamar · Escribir · Mandar info · Reagendar · Otro) + cuándo
 * (Hoy · Mañana · En 2 días · Lunes · otra fecha) y una hora opcional. Al
 * marcarlo hecho, pregunta por el siguiente: un cliente sin próximo paso es
 * uno que se enfría.
 *
 * `tarea` es `proximaTarea` del detalle del lead (sin llamada extra). Lo que
 * se cambia acá se ve al instante; `onCambio` vuelve a pedir el lead.
 */
export function ProximoPaso({
  leadId, tenant, nombre, tarea, onCambio,
}: {
  leadId: string;
  tenant?: string;
  nombre: string | null;
  tarea: TareaDto | null;
  onCambio?: () => void;
}) {
  // Lo que se acaba de guardar, hasta que el padre traiga el lead de nuevo
  // (un `tarea` distinto descarta esto y manda el servidor).
  const [local, setLocal] = useState<{ base: TareaDto | null; valor: TareaDto | null } | null>(null);
  const actual = local && local.base === tarea ? local.valor : tarea;

  const [form, setForm] = useState<{ editando: TareaDto | null; b: Borrador } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(false);

  function terminar(valor: TareaDto | null, texto: string | null) {
    setLocal({ base: tarea, valor });
    setAviso(texto);
    invalidar("hoy@");
    onCambio?.();
  }

  async function guardar() {
    if (!form) return;
    const { b, editando } = form;
    const dia = b.cuando === "fecha" ? b.fecha : diaDeAtajo(b.cuando);
    if (!dia) { setError("Elige el día."); return; }
    const { venceEn, conHora } = venceEnDe(dia, b.hora || null);
    setGuardando(true);
    setError(null);
    try {
      const titulo = b.detalle.trim().slice(0, 200) || null;
      const t = editando
        ? await actualizarTarea(editando.id, { venceEn, conHora, titulo }, tenant)
        : await crearTarea(leadId, { tipo: b.tipo, titulo, venceEn, conHora }, tenant);
      setForm(null);
      terminar(t, null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el próximo paso.");
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar(t: TareaDto, estado: "hecha" | "cancelada") {
    setGuardando(true);
    setError(null);
    try {
      await actualizarTarea(t.id, { estado }, tenant);
      setConfirmarQuitar(false);
      if (estado === "hecha") {
        terminar(null, "Hecho ✓ ¿Cuál es el siguiente paso?");
        setForm({ editando: null, b: borradorNuevo() });
      } else {
        terminar(null, null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const cambiar = (c: Partial<Borrador>) => setForm((f) => (f ? { ...f, b: { ...f.b, ...c } } : f));

  return (
    <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">Próximo paso</p>

      {aviso && <p role="status" className="mb-2 rounded-lg bg-brasa-suave px-2.5 py-1.5 text-[0.8rem] font-semibold text-brasa-texto">{aviso}</p>}

      {form ? (
        <FormPaso
          b={form.b}
          editando={!!form.editando}
          guardando={guardando}
          onCambio={cambiar}
          onGuardar={() => void guardar()}
          onCancelar={() => { setForm(null); setError(null); setAviso(null); }}
        />
      ) : actual ? (
        <div>
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-arena text-[0.95rem]" aria-hidden>
              {tipoTareaDe(actual.tipo).icono}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9rem] font-semibold text-tinta">{tituloTarea(actual, nombre)}</p>
              <p className={`text-[0.78rem] ${tareaAtrasada(actual) ? "font-semibold text-alerta" : "text-frio"}`}>
                {cuandoTarea(actual)}
                {actual.asignadoNombre && <span className="font-normal text-frio"> · le toca a {actual.asignadoNombre}</span>}
              </p>
            </div>
          </div>
          {confirmarQuitar ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[0.8rem]">
              <span className="text-tinta-2">¿Quitar este paso?</span>
              <button type="button" onClick={() => void cerrar(actual, "cancelada")} disabled={guardando} className="min-h-0 rounded-chip bg-alerta px-3 py-1 font-bold text-carta disabled:opacity-60">
                Sí, quitar
              </button>
              <button type="button" onClick={() => setConfirmarQuitar(false)} className="min-h-0 rounded-chip px-3 py-1 font-semibold text-tinta-2 ring-1 ring-linea">
                No
              </button>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void cerrar(actual, "hecha")}
                disabled={guardando}
                className="min-h-0 rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
              >
                ✓ Hecho
              </button>
              <button
                type="button"
                onClick={() => { setAviso(null); setForm({ editando: actual, b: borradorDe(actual) }); }}
                className="min-h-0 rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
              >
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => setConfirmarQuitar(true)}
                className="min-h-0 rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold text-frio transition hover:text-alerta"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <p className="text-[0.82rem] text-frio">Anota qué toca con este cliente y cuándo: te lo recordamos.</p>
          <button
            type="button"
            onClick={() => { setAviso(null); setForm({ editando: null, b: borradorNuevo() }); }}
            className="mt-2 w-full rounded-chip bg-arena py-2 text-[0.82rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:bg-arena-2"
          >
            + Próximo paso
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-2 text-[0.8rem] font-semibold text-alerta">{error}</p>}
    </div>
  );
}

const CHIP = "min-h-0 rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold transition";
const chip = (activo: boolean) => `${CHIP} ${activo ? "bg-brasa text-sobre-brasa" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-arena-2"}`;

function FormPaso({
  b, editando, guardando, onCambio, onGuardar, onCancelar,
}: {
  b: Borrador;
  editando: boolean;
  guardando: boolean;
  onCambio: (c: Partial<Borrador>) => void;
  onGuardar: () => void;
  onCancelar: () => void;
}) {
  const falta = b.cuando === "fecha" && !b.fecha;
  return (
    <div className="space-y-2.5">
      {/* Qué: al editar no se cambia (el servidor no lo permite); se muestra fijo. */}
      <div>
        <span className="mb-1 block text-[0.75rem] text-frio">¿Qué toca?</span>
        <div className="flex flex-wrap gap-1.5">
          {editando ? (
            <span className={chip(true)}>{tipoTareaDe(b.tipo).etiqueta}</span>
          ) : (
            TIPOS_TAREA.map((t) => (
              <button key={t.id} type="button" onClick={() => onCambio({ tipo: t.id })} aria-pressed={b.tipo === t.id} className={chip(b.tipo === t.id)}>
                {t.etiqueta}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[0.75rem] text-frio">¿Cuándo?</span>
        <div className="flex flex-wrap gap-1.5">
          {ATAJOS_CUANDO.map((a) => (
            <button key={a.id} type="button" onClick={() => onCambio({ cuando: a.id })} aria-pressed={b.cuando === a.id} className={chip(b.cuando === a.id)}>
              {a.etiqueta}
            </button>
          ))}
          <button type="button" onClick={() => onCambio({ cuando: "fecha" })} aria-pressed={b.cuando === "fecha"} className={chip(b.cuando === "fecha")}>
            Otra fecha
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {b.cuando === "fecha" && (
            <input
              type="date"
              value={b.fecha}
              min={hoyLima()}
              onChange={(e) => onCambio({ fecha: e.target.value })}
              aria-label="Día"
              className="rounded-lg border border-linea bg-arena/30 px-2.5 py-1.5 text-[0.85rem] text-tinta outline-none focus:border-brasa"
            />
          )}
          <label className="flex items-center gap-1.5 text-[0.78rem] text-frio">
            Hora
            <input
              type="time"
              value={b.hora}
              onChange={(e) => onCambio({ hora: e.target.value })}
              className="rounded-lg border border-linea bg-arena/30 px-2.5 py-1.5 text-[0.85rem] text-tinta outline-none focus:border-brasa"
            />
            <span>(opcional)</span>
          </label>
        </div>
      </div>

      <input
        value={b.detalle}
        onChange={(e) => onCambio({ detalle: e.target.value.slice(0, 200) })}
        placeholder="Detalle (opcional). Ej: mandarle el video de odontología"
        className="w-full rounded-lg border border-linea bg-arena/30 px-3 py-2 text-[0.85rem] text-tinta outline-none focus:border-brasa"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGuardar}
          disabled={guardando || falta}
          className="min-h-0 rounded-chip bg-brasa px-4 py-1.5 text-[0.82rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Guardar paso"}
        </button>
        <button type="button" onClick={onCancelar} className="min-h-0 rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena">
          {editando ? "Cancelar" : "Ahora no"}
        </button>
      </div>
    </div>
  );
}
