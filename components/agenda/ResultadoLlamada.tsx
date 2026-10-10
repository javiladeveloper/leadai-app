"use client";

// CÓMO LE FUE A LA LLAMADA (2026-10-01, pedido de Jonathan: "una vez llamo
// necesito una sección para colocar notas… si estuvo interesado, nos
// reagendó"). Un toque para el resultado y la nota en sus palabras. Lo
// mismo que la app (ResultadoLlamadaUi.kt): mismas cuatro opciones.

import { useId, useState } from "react";
import { anotarResultadoCita, type CitaAgenda, type ResultadoCita } from "@/lib/api";

// `clase`: la etiqueta suave del detalle. `marca`: el circulito sólido que
// distingue en el calendario la reunión que ya tiene nota (mismos colores
// que la app: verde interesado, naranja volver a llamar, ámbar no contestó).
// Con los TOKENS del sistema (2026-10-09): eran emerald/orange/amber/slate de
// Tailwind, cuatro colores que no existen en la marca. Cada uno va con su
// tinta (`sobre-brasa`, `sobre-orbita`) o con blanco donde el fondo es hondo.
export const RESULTADOS: { valor: ResultadoCita; etiqueta: string; clase: string; marca: string }[] = [
  { valor: "interesado", etiqueta: "Interesado", clase: "bg-brasa-suave text-brasa-texto", marca: "bg-brasa text-sobre-brasa" },
  { valor: "otra_fecha", etiqueta: "Quiere otra fecha", clase: "bg-calor-suave text-calor-hondo", marca: "bg-orbita text-sobre-orbita" },
  { valor: "no_contesto", etiqueta: "No contestó", clase: "bg-tibio-suave text-tinta", marca: "bg-tibio text-carta" },
  { valor: "no_interesado", etiqueta: "No le interesa", clase: "bg-arena-2 text-frio", marca: "bg-frio text-carta" },
];

/** Solo nota, sin resultado marcado. */
const MARCA_SOLO_NOTA = "bg-tinta text-carta";

/** "Interesado · con nota", para el aria-label y el title del calendario. */
export function textoMarca(c: CitaAgenda): string | null {
  if (!tieneResultado(c)) return null;
  const r = RESULTADOS.find((x) => x.valor === c.resultado);
  const conNota = Boolean(c.notaResultado?.trim());
  if (!r) return "Con nota";
  return conNota ? `${r.etiqueta} · con nota` : r.etiqueta;
}

/**
 * La marca de una reunión con nota o resultado: un circulito con ✎ del color
 * del resultado. Va al inicio del bloque en Mes, Semana, Día y Lista.
 */
export function MarcaNota({ cita: c, className = "" }: { cita: CitaAgenda; className?: string }) {
  const texto = textoMarca(c);
  if (!texto) return null;
  const r = RESULTADOS.find((x) => x.valor === c.resultado);
  return (
    <span
      title={texto}
      aria-hidden
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded-full align-[-0.15em] text-[0.62rem] font-bold leading-none ${r?.marca ?? MARCA_SOLO_NOTA} ${className}`}
    >
      ✎
    </span>
  );
}

const LARGO_NOTA = 2000;

/** ¿Ya empezó la reunión? Antes, la sección es "Notas"; después, "¿Cómo te fue?". */
export function yaEmpezo(c: CitaAgenda, ahoraMs: number): boolean {
  return Date.parse(c.inicio) <= ahoraMs;
}

export function tieneResultado(c: CitaAgenda): boolean {
  return Boolean(c.resultado) || Boolean(c.notaResultado?.trim());
}

export function ResultadoLlamada({
  cita: c,
  abiertoAlInicio = false,
  onGuardada,
}: {
  cita: CitaAgenda;
  /** En el detalle de UNA reunión pasada sin anotar, el formulario ya abierto. */
  abiertoAlInicio?: boolean;
  onGuardada: (c: CitaAgenda) => void;
}) {
  // El reloj se lee una vez al montar: alcanza para saber si la reunión ya pasó.
  const [ahoraMs] = useState(() => Date.now());
  // El formulario abierto solo en el detalle de una reunión que ya pasó y no tiene nada.
  const [editando, setEditando] = useState(() => abiertoAlInicio && yaEmpezo(c, ahoraMs) && !tieneResultado(c));
  const [resultado, setResultado] = useState<ResultadoCita | null>(c.resultado ?? null);
  const [nota, setNota] = useState(c.notaResultado ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idNota = useId();

  // Las notas se escriben cuando sea: antes (para preparar la llamada),
  // durante o después. Pedido de Jonathan con Lara a las 16:00.
  if (c.estado === "cancelada") return null;
  const empezo = yaEmpezo(c, ahoraMs) || Boolean(c.resultado);

  const elegido = RESULTADOS.find((r) => r.valor === c.resultado);
  const cambio = resultado !== (c.resultado ?? null) || nota.trim() !== (c.notaResultado ?? "").trim();

  function abrir() {
    setResultado(c.resultado ?? null);
    setNota(c.notaResultado ?? "");
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const guardada = await anotarResultadoCita(c.id, { resultado, nota: nota.trim() || null });
      onGuardada(guardada);
      setEditando(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    if (!tieneResultado(c)) {
      return (
        <button
          type="button"
          onClick={abrir}
          className="mt-3 inline-flex min-h-10! items-center rounded-chip px-1 text-[0.85rem] font-semibold text-brasa-texto underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brasa"
        >
          {empezo ? "Anotar cómo te fue" : "Agregar notas"}
        </button>
      );
    }
    return (
      <div className="mt-3 rounded-tarjeta bg-arena p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-frio">{empezo ? "Cómo te fue" : "Notas"}</p>
          <button
            type="button"
            onClick={abrir}
            className="min-h-0! text-[0.8rem] font-semibold text-brasa-texto underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brasa"
          >
            Editar
          </button>
        </div>
        {elegido && (
          <span className={`mt-1 inline-flex rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold ${elegido.clase}`}>
            {elegido.etiqueta}
          </span>
        )}
        {c.notaResultado?.trim() && (
          <p className="mt-1.5 whitespace-pre-wrap break-words text-[0.88rem] text-tinta">{c.notaResultado}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-tarjeta bg-arena p-3">
      <p className="text-[0.72rem] font-semibold uppercase tracking-wide text-frio">{empezo ? "¿Cómo te fue?" : "Notas"}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Resultado de la llamada">
        {RESULTADOS.map((r) => {
          const activo = resultado === r.valor;
          return (
            <button
              key={r.valor}
              type="button"
              aria-pressed={activo}
              // Tocar el elegido lo quita: se puede dejar solo la nota.
              onClick={() => setResultado(activo ? null : r.valor)}
              className={`inline-flex min-h-10! items-center rounded-chip px-3 py-1.5 text-[0.8rem] font-semibold ring-1 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa ${
                activo ? "bg-brasa text-sobre-brasa ring-brasa" : "bg-carta text-tinta-2 ring-linea hover:bg-linea"
              }`}
            >
              {r.etiqueta}
            </button>
          );
        })}
      </div>
      <label htmlFor={idNota} className="mt-3 block text-[0.8rem] font-semibold text-tinta-2">
        Notas de la llamada
      </label>
      <textarea
        id={idNota}
        value={nota}
        onChange={(e) => setNota(e.target.value.slice(0, LARGO_NOTA))}
        rows={3}
        placeholder="Ej.: le interesa el plan de 3 doctores, llamarlo el sábado a la 1 pm"
        className="mt-1 w-full resize-y rounded-tarjeta border border-linea bg-carta px-3 py-2 text-[0.9rem] text-tinta outline-none focus:border-brasa"
      />
      {error && (
        <p className="mt-1 text-[0.8rem] font-semibold text-alerta" role="alert">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setEditando(false)}
          className="inline-flex min-h-10! items-center rounded-chip px-3 text-[0.85rem] font-semibold text-tinta-2 hover:bg-linea focus-visible:outline-2 focus-visible:outline-brasa"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={guardar}
          disabled={!cambio || guardando}
          className="inline-flex min-h-10! items-center rounded-chip bg-brasa px-4 text-[0.85rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brasa"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
