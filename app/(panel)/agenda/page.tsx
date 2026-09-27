"use client";

// AGENDA (2026-09-26): las reuniones que el bot agendó para ESTA persona en
// todos sus negocios, los próximos 30 días. Es de la persona, no de un
// negocio: sin chips de negocio arriba; si tiene reuniones en varios, un
// filtro local.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { listarAgenda, type CitaAgenda } from "@/lib/api";
import { agruparPorDia, inicioDelDiaLima } from "@/lib/agenda";
import { guardarEmpresaActiva } from "@/lib/auth";
import { SkeletonLista } from "@/components/Skeletons";

const ZONA = "America/Lima";

export default function AgendaPanel() {
  const router = useRouter();
  const [citas, setCitas] = useState<CitaAgenda[] | null>(null);
  const [error, setError] = useState(false);
  const [negocio, setNegocio] = useState("todos");

  useEffect(() => {
    // Desde las 00:00 de HOY en Lima (no del navegador): la agenda se lee en Lima.
    const desde = inicioDelDiaLima();
    const hasta = new Date(desde.getTime() + 30 * 86_400_000);
    listarAgenda(desde, hasta)
      .then(setCitas)
      .catch(() => setError(true));
  }, []);

  const negocios = Array.from(new Map((citas ?? []).map((c) => [c.tenantId, c.negocio])).entries());
  const visibles = (citas ?? []).filter((c) => negocio === "todos" || c.tenantId === negocio);
  const dias = agruparPorDia(visibles);

  function abrirConversacion(c: CitaAgenda) {
    guardarEmpresaActiva(c.tenantId);
    router.push(`/conversacion/${c.leadId}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Ventas</p>
          <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Agenda</h1>
          <p className="mt-1 text-[0.92rem] text-frio">Las reuniones que el bot agendó para ti, los próximos 30 días.</p>
        </div>
        {negocios.length > 1 && (
          <select
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
            className="rounded-tarjeta border border-linea bg-carta px-3 py-2.5 text-[0.9rem] text-tinta outline-none focus:border-brasa"
          >
            <option value="todos">Todos los negocios</option>
            {negocios.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
        )}
      </header>

      {error && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar tu agenda. Recarga.</p>
        </div>
      )}

      {!error && !citas && <SkeletonLista filas={3} />}

      {citas && dias.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
          <p className="font-semibold text-tinta">No hay reuniones en los próximos 30 días.</p>
          <p className="mt-1 text-[0.86rem] text-frio">
            Cuando el bot agende una, aparece aquí. Para que agende en tu Google Calendar, conéctalo en{" "}
            <Link href="/configuracion?tab=calendario" className="font-semibold text-brasa-hondo underline">
              Configuración → Mi calendario
            </Link>
            .
          </p>
        </div>
      )}

      {dias.map((d) => (
        <section key={d.dia} className="space-y-2">
          <h2 className="text-[0.85rem] font-bold uppercase tracking-wide text-frio">
            {new Date(`${d.dia}T12:00:00-05:00`).toLocaleDateString("es-PE", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {d.citas.map((c) => {
            const cancelada = c.estado === "cancelada";
            return (
              <article key={c.id} className={`rounded-tarjeta bg-carta p-4 ring-1 ring-linea ${cancelada ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`font-semibold text-tinta ${cancelada ? "line-through" : ""}`}>
                    {new Date(c.inicio).toLocaleTimeString("es-PE", { timeZone: ZONA, hour: "numeric", minute: "2-digit" })} · {c.cliente || "Cliente"}
                  </p>
                  <span className="text-[0.75rem] text-frio">
                    {c.negocio}
                    {c.atiende ? ` · atiende ${c.atiende}` : ""}
                    {cancelada ? " · cancelada" : ""}
                  </span>
                </div>
                {c.resumen && <p className="mt-1 text-[0.88rem] text-tinta-2">{c.resumen}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.meetLink && !cancelada && (
                    <a
                      href={c.meetLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
                    >
                      Entrar a Meet
                    </a>
                  )}
                  {c.telefono && (
                    <a
                      href={`https://wa.me/${c.telefono.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-linea"
                    >
                      +{c.telefono.replace(/^\+/, "")}
                    </a>
                  )}
                  {c.correo && (
                    <a
                      href={`mailto:${c.correo}`}
                      className="rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-linea"
                    >
                      {c.correo}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirConversacion(c)}
                    className="rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-linea"
                  >
                    Ver conversación
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
