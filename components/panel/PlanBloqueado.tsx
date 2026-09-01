"use client";

import Link from "next/link";

/**
 * LO QUE DESBLOQUEA UN PLAN, PARA CUALQUIER SECCIÓN (2026-09-01).
 *
 * Nació como la pantalla del candado de Marketing y se generalizó al agregar
 * Reportes: dos secciones con el mismo problema y el mismo diseño copiado son
 * dos que se van a ir separando con cada retoque.
 *
 * LA SECCIÓN SIGUE EN EL MENÚ Y SIGUE ABRIENDO. Esconder el ítem es peor de las
 * dos maneras: el dueño no se entera de que existe —y entonces nunca lo
 * compra—, y si alguna vez lo vio, la desaparición se lee como que se rompió
 * algo.
 *
 * CADA BENEFICIO DICE LO QUE HACE, NO CÓMO SE LLAMA. "Escríbele a todos de una"
 * y no "campañas masivas": quien nunca mandó una no sabe qué es lo segundo.
 */

export interface BeneficioPlan {
  titulo: string;
  detalle: string;
}

export function PlanBloqueado({
  plan,
  titulo,
  bajada,
  beneficios,
}: {
  /** El plan que lo incluye, como lo ve el dueño: "Full", "Crecer". */
  plan: string;
  titulo: string;
  bajada: string;
  beneficios: BeneficioPlan[];
}) {
  return (
    <div className="space-y-5">
      {/* EL HEADER OSCURO es el mismo del Inicio: ancla la pantalla en el panel
          en vez de que parezca un modal de sistema. */}
      <section className="entra rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)] lg:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
          Con el plan {plan}
        </p>
        <h1 className="mt-1 text-[1.9rem] font-bold leading-tight lg:text-[2.2rem]">{titulo}</h1>
        <p className="mt-2 max-w-md text-[0.95rem] text-arena/70">{bajada}</p>
      </section>

      {/* EN GRILLA. Una lista vertical de párrafos se lee como letra chica;
          tarjetas se recorren de un vistazo. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {beneficios.map((b) => (
          <div
            key={b.titulo}
            className="entra rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea"
          >
            <p className="text-[0.95rem] font-bold leading-snug text-tinta">{b.titulo}</p>
            <p className="mt-1 text-[0.86rem] leading-snug text-tinta-2">{b.detalle}</p>
          </div>
        ))}
      </div>

      {/* EL CIERRE. El botón usa el color de acción del panel: un negro suelto
          no existe en ninguna otra pantalla. */}
      <div className="entra flex flex-wrap items-center justify-between gap-4 rounded-tarjeta bg-brasa-suave p-5">
        <div>
          <p className="text-[1.02rem] font-bold text-tinta">Actívalo cuando quieras</p>
          <p className="mt-0.5 text-[0.86rem] text-tinta-2">
            Se suma a todo lo que ya tienes. Sin permanencia.
          </p>
        </div>
        <Link
          href="/mi-plan"
          className="rounded-full bg-brasa px-6 py-3 text-[0.95rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99]"
        >
          Ver el plan {plan}
        </Link>
      </div>
    </div>
  );
}
