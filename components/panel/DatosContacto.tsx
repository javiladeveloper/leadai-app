"use client";

import { useRef, useState } from "react";
import { actualizarLead, type DatosContactoLead, type Lead } from "@/lib/api";
import { validarDatoContacto, type CampoContacto } from "@/lib/crm-filtros";

const CAMPOS: { id: CampoContacto; etiqueta: string; ejemplo: string; tipo: "text" | "email" | "number" }[] = [
  { id: "empresa", etiqueta: "Clínica o empresa", ejemplo: "Ej: Clínica Sonrisas", tipo: "text" },
  { id: "profesionales", etiqueta: "N.º de profesionales", ejemplo: "Ej: 3", tipo: "number" },
  { id: "ciudad", etiqueta: "Ciudad", ejemplo: "Ej: Tacna", tipo: "text" },
  { id: "correo", etiqueta: "Correo", ejemplo: "Ej: nombre@clinica.com", tipo: "email" },
];

/**
 * DATOS DE CONTACTO EN LA FICHA (CRM fase 2, 2026-10-13).
 *
 * Para vender a una clínica hay que saber cuál es, cuántos profesionales
 * tiene y a qué correo mandarle la propuesta (la invitación de la reunión
 * usa ese correo). Se editan en línea: tocar el dato, escribir y Enter (Esc
 * cancela). Vacío lo borra. El servidor valida igual y, si algo no le sirve,
 * su motivo se muestra acá.
 */
export function DatosContacto({
  lead, tenant, onCambio,
}: {
  lead: Pick<Lead, "id" | "correo" | "empresa" | "ciudad" | "profesionales">;
  tenant?: string;
  onCambio: (cambios: DatosContactoLead) => void;
}) {
  const [editando, setEditando] = useState<CampoContacto | null>(null);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Esc cierra SIN guardar: el blur que sigue al cerrar no tiene que guardar.
  const cancelado = useRef(false);

  function abrir(campo: CampoContacto) {
    cancelado.current = false;
    const v = lead[campo];
    setTexto(v === null || v === undefined ? "" : String(v));
    setError(null);
    setEditando(campo);
  }

  async function guardar() {
    if (!editando || guardando) return;
    const r = validarDatoContacto(editando, texto);
    if (!r.ok) { setError(r.error); return; }
    const actual = lead[editando] ?? null;
    if (r.valor === actual) { setEditando(null); return; }
    setGuardando(true);
    setError(null);
    const cambio = { [editando]: r.valor } as DatosContactoLead;
    const res = await actualizarLead(lead.id, cambio, tenant);
    setGuardando(false);
    if (!res.ok) { setError(res.error ?? "No se pudo guardar."); return; }
    onCambio(cambio);
    setEditando(null);
  }

  return (
    <div className="rounded-tarjeta bg-carta p-3.5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
      <p className="mb-1.5 text-[0.75rem] font-bold uppercase tracking-wide text-frio">Datos de contacto</p>
      <dl className="divide-y divide-linea/70">
        {CAMPOS.map((c) => {
          const valor = lead[c.id];
          const hay = valor !== null && valor !== undefined && String(valor).trim() !== "";
          return (
            <div key={c.id} className="flex items-center justify-between gap-2 py-1.5">
              <dt className="shrink-0 text-[0.76rem] text-frio">{c.etiqueta}</dt>
              <dd className="min-w-0 flex-1 text-right">
                {editando === c.id ? (
                  <input
                    autoFocus
                    type={c.tipo}
                    inputMode={c.tipo === "number" ? "numeric" : undefined}
                    min={c.tipo === "number" ? 1 : undefined}
                    max={c.tipo === "number" ? 999 : undefined}
                    value={texto}
                    disabled={guardando}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); void guardar(); }
                      if (e.key === "Escape") { cancelado.current = true; setEditando(null); setError(null); }
                    }}
                    onBlur={() => { if (!cancelado.current) void guardar(); }}
                    placeholder={c.ejemplo}
                    aria-label={c.etiqueta}
                    className="w-full rounded-lg bg-arena px-2 py-1 text-right text-[0.84rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => abrir(c.id)}
                    title={`Editar ${c.etiqueta.toLowerCase()}`}
                    className={`min-h-0 max-w-full truncate rounded px-1 text-[0.84rem] transition hover:bg-arena ${hay ? "font-semibold text-tinta" : "text-brasa-texto"}`}
                  >
                    {hay ? String(valor) : "+ Agregar"}
                  </button>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {error && <p role="alert" className="mt-1.5 text-[0.78rem] font-semibold text-alerta">{error}</p>}
    </div>
  );
}
