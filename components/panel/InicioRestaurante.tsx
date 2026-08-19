"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resumenPedidos, obtenerUso, type ResumenPedidos, type Uso } from "@/lib/api";
import { obtenerNegocio, type NegocioCarta } from "@/lib/carta";
import { leerEmpresaActiva } from "@/lib/auth";
import { soles } from "@/lib/precio";

/**
 * EL INICIO DE UN RESTAURANTE (2026-08-19).
 *
 * El inicio de captación le mostraba "leads calientes sin atender", "leads
 * activos" y accesos a secciones que ni siquiera están en su menú. Un
 * restaurante no tiene leads: tiene pedidos en cocina y plata vendida hoy
 * (pedido de Jonathan: "veo bastantes cosas que no vienen al caso").
 *
 * Lo que sí necesita ver al abrir el panel, en este orden:
 *  1. Cuánto vendió hoy — es la pregunta con la que abre.
 *  2. Qué hay en cocina AHORA — lo único que exige acción inmediata.
 *  3. Su link, para compartirlo.
 */

/** Los estados de un pedido en curso, en el orden en que avanzan. */
const ETAPAS = [
  { clave: "enCola" as const, nombre: "Por preparar", emoji: "🧾" },
  { clave: "preparando" as const, nombre: "En cocina", emoji: "🍳" },
  { clave: "listos" as const, nombre: "Listos", emoji: "🛎️" },
  { clave: "enCamino" as const, nombre: "En camino", emoji: "🛵" },
];

export function InicioRestaurante() {
  const [pedidos, setPedidos] = useState<ResumenPedidos | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [negocio, setNegocio] = useState<NegocioCarta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    function traer() {
      void Promise.all([resumenPedidos(), obtenerUso(), obtenerNegocio()]).then(
        ([p, u, n]) => {
          if (!vivo) return;
          setPedidos(p);
          setUso(u);
          setNegocio(n);
          setCargando(false);
        },
      );
    }
    traer();
    // La cocina cambia sola: si el dueño deja el panel abierto en el mostrador,
    // los contadores tienen que moverse sin que recargue.
    const id = setInterval(traer, 30_000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  const tenant = typeof window !== "undefined" ? leerEmpresaActiva() : null;
  const enlace = tenant && typeof window !== "undefined"
    ? `${window.location.origin}/c/${tenant}`
    : null;

  async function copiar() {
    if (!enlace) return;
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (cargando) {
    return (
      <div className="space-y-5">
        <div className="h-32 animate-pulse rounded-tarjeta bg-arena-2/70" />
        <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />
      </div>
    );
  }

  const enCurso = pedidos
    ? pedidos.enCola + pedidos.preparando + pedidos.listos + pedidos.enCamino
    : 0;
  const cupo = uso?.pedidos ?? null;

  return (
    <div className="space-y-5">
      {/* LO VENDIDO HOY: es la pregunta con la que el dueño abre el panel. */}
      <section className="rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)] lg:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">Hoy</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <p className="text-[2.6rem] font-bold leading-none tabular-nums">
            {soles(pedidos?.hoyCentavos ?? 0)}
          </p>
          <p className="text-[0.9rem] text-arena/70">
            {pedidos?.hoyPedidos === 1
              ? "1 pedido entregado"
              : `${pedidos?.hoyPedidos ?? 0} pedidos entregados`}
          </p>
        </div>

        {/* El cupo del plan, solo si el plan lo tiene. Es el mismo dato que en
            Configuración, pero acá le sirve para saber cómo viene el mes. */}
        {cupo && cupo.limite > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-[0.8rem] text-arena/70">
              <span>Pedidos del mes</span>
              <span className="tabular-nums">
                {cupo.usados.toLocaleString("es-PE")} de {cupo.limite.toLocaleString("es-PE")}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-arena/15">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  cupo.usados > cupo.limite || cupo.usados / cupo.limite >= 0.8
                    ? "bg-orbita"
                    : "bg-brasa"
                }`}
                style={{ width: `${Math.min(100, Math.round((cupo.usados / cupo.limite) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* LA COCINA AHORA: lo único que exige que el dueño haga algo ya. */}
      <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.02rem] font-bold text-tinta">En este momento</h2>
          {enCurso > 0 && (
            <Link
              href="/conversaciones"
              className="rounded-chip bg-orbita px-3.5 py-1.5 text-[0.82rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo"
            >
              Ver pedidos
            </Link>
          )}
        </div>

        {enCurso === 0 ? (
          <p className="mt-3 text-[0.9rem] text-frio">
            No hay pedidos en curso. Cuando entre uno, aparece acá.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ETAPAS.map((e) => {
              const n = pedidos?.[e.clave] ?? 0;
              return (
                <div
                  key={e.clave}
                  className={`rounded-tarjeta px-3 py-3 text-center ${
                    n > 0 ? "bg-arena ring-1 ring-linea" : "bg-arena/40"
                  }`}
                >
                  <p className="text-[1.1rem]" aria-hidden>{e.emoji}</p>
                  <p
                    className={`mt-0.5 text-[1.6rem] font-bold leading-none tabular-nums ${
                      n > 0 ? "text-tinta" : "text-frio/50"
                    }`}
                  >
                    {n}
                  </p>
                  <p className="mt-0.5 text-[0.75rem] text-frio">{e.nombre}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* EL LINK: es el producto de todo esto. Sin compartirlo no entra nada. */}
      {enlace && (
        <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
          <h2 className="text-[1.02rem] font-bold text-tinta">Tu carta</h2>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Compartí este link por WhatsApp, Instagram o donde vendas.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-arena px-3 py-2 text-[0.82rem] text-tinta-2">
              {enlace}
            </code>
            <button
              type="button"
              onClick={copiar}
              className="rounded-chip bg-brasa px-4 py-2 text-[0.82rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
            >
              {copiado ? "Copiado ✓" : "Copiar"}
            </button>
            <Link
              href="/carta"
              className="rounded-chip px-4 py-2 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Editar
            </Link>
          </div>

          {/* Sin WhatsApp el link no lleva a ningún lado: el cliente arma el
              pedido y no tiene a dónde mandarlo. */}
          {negocio && !negocio.whatsappCarta && (
            <p className="mt-3 rounded-tarjeta bg-calor-suave px-4 py-3 text-[0.82rem] text-calor-hondo">
              Todavía no configuraste a qué WhatsApp llegan los pedidos.{" "}
              <Link href="/carta" className="font-semibold underline underline-offset-2">
                Configuralo acá
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export default InicioRestaurante;
