"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resumenPedidos, obtenerUso, obtenerEquipo, type ResumenPedidos, type Uso } from "@/lib/api";
import { obtenerNegocio, obtenerMenuDia, type NegocioCarta, type MenuDelDia } from "@/lib/carta";
import { leerEmpresaActiva } from "@/lib/auth";
import { soles } from "@/lib/precio";
import { usarNumeroAnimado } from "@/lib/usar-numero-animado";

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
  const [menu, setMenu] = useState<MenuDelDia | null>(null);
  const [estaSolo, setEstaSolo] = useState(false);
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
    // Una sola vez (no cambian solos cada 30s): el estado del menú del día y
    // si el dueño sigue trabajando SOLO — para el empujón de invitar equipo.
    void obtenerMenuDia().then((m) => { if (vivo) setMenu(m); });
    void obtenerEquipo().then((e) => {
      if (vivo) setEstaSolo(e.miembros.length <= 1 && e.invitaciones.length === 0);
    });
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

  // ANTES del return: un hook detrás de un `return` condicional cambia el
  // orden entre renders y React lo rechaza —"Rendered more hooks than during
  // the previous render"—. Pasó al agregar esto (2026-08-19).
  const vendidoHoy = usarNumeroAnimado(pedidos?.hoyCentavos ?? 0);

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
      {/* Las secciones ENTRAN escalonadas (2026-08-22): esta pantalla es la
          primera que el dueño ve cada día y aparecía toda de golpe. `entra`
          reparte el delay por posición. */}
      <section className="entra rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)] lg:p-6">
        <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">Hoy</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          {/* LO VENDIDO SUBE, no salta (2026-08-19). Es el primer número que
              el dueño mira al abrir, y la pantalla se refresca sola: verlo
              contar es enterarse de que entró una venta. */}
          <p className="text-[2.6rem] font-bold leading-none tabular-nums">
            {soles(vendidoHoy)}
          </p>
          <p className="text-[0.9rem] text-arena/70">
            {pedidos?.hoyPedidos === 1
              ? "1 pedido entregado"
              : `${pedidos?.hoyPedidos ?? 0} pedidos entregados`}
          </p>
        </div>

        {/* EL EFECTIVO EN LA CALLE (2026-08-31): pedidos vivos que pagan al
            entregar. Es lo que el motorizado o el salón le tienen que cuadrar
            al final del turno — verlo acá evita sumar tickets a mano. */}
        {(pedidos?.efectivoPorCobrarCentavos ?? 0) > 0 && (
          <p className="mt-2 text-[0.88rem] text-arena/80">
            💵 <b className="tabular-nums">{soles(pedidos!.efectivoPorCobrarCentavos!)}</b> por
            cobrar en efectivo ({pedidos!.efectivoPorCobrarPedidos}{" "}
            {pedidos!.efectivoPorCobrarPedidos === 1 ? "pedido" : "pedidos"} en curso)
          </p>
        )}

        {/* El cupo del plan, solo si el plan lo tiene. Es el mismo dato que en
            Configuración, pero aquí le sirve para saber cómo viene el mes. */}
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

      {/* EL MENÚ DE HOY (2026-08-31): el ritual diario, visible desde el
          arranque. Solo aparece si el negocio USA el menú del día — al que
          nunca publicó uno no se le mete una tarea que no es suya. */}
      {menu && (
        menu.esDeHoy ? (
          <section className="entra flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-carta px-5 py-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <div className="min-w-0">
              <p className="text-[0.95rem] font-bold text-tinta">
                🍲 Menú de hoy · {soles(menu.precioCentavos)}
                {menu.disponible ? " · vendiéndose ✅" : " · se acabó 💤"}
              </p>
              <p className="mt-0.5 truncate text-[0.8rem] text-frio">
                {menu.segundos.filter((o) => o.disponible).map((o) => o.nombre).join(", ") ||
                  "Sin segundos disponibles"}
              </p>
            </div>
            <Link
              href="/carta"
              className="shrink-0 rounded-chip px-3.5 py-1.5 text-[0.82rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
            >
              Ver el menú
            </Link>
          </section>
        ) : (
          <Link
            href="/carta"
            className="entra flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-calor-suave px-5 py-4 ring-1 ring-calor/30 transition hover:ring-calor/60"
          >
            <div>
              <p className="text-[0.95rem] font-bold text-calor-hondo">
                🍲 Todavía no publicas el menú de hoy
              </p>
              <p className="mt-0.5 text-[0.8rem] text-calor-hondo/80">
                El de {menu.dia ?? "ayer"} está apagado — publícalo y empieza a vender.
              </p>
            </div>
            <span className="shrink-0 rounded-chip bg-brasa px-3.5 py-1.5 text-[0.82rem] font-bold text-sobre-brasa">
              Publicarlo
            </span>
          </Link>
        )
      )}

      {/* LA COCINA AHORA: lo único que exige que el dueño haga algo ya. */}
      <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[1.02rem] font-bold text-tinta">En este momento</h2>
          {enCurso > 0 && (
            <Link
              // A COCINA, no a Conversaciones (2026-08-31): los pedidos en
              // curso se trabajan en la Cocina — el link viejo dejaba al
              // dueño en el chat, buscando dónde estaba lo que acababa de ver.
              href="/cocina"
              className="rounded-chip bg-orbita px-3.5 py-1.5 text-[0.82rem] font-bold text-sobre-orbita transition hover:bg-orbita-hondo"
            >
              Ver la cocina
            </Link>
          )}
        </div>

        {enCurso === 0 ? (
          <p className="mt-3 text-[0.9rem] text-frio">
            No hay pedidos en curso. Cuando entre uno, aparece aquí.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ETAPAS.map((e) => (
              <Contador
                key={e.clave}
                valor={pedidos?.[e.clave] ?? 0}
                emoji={e.emoji}
                nombre={e.nombre}
              />
            ))}
          </div>
        )}
      </section>

      {/* EL LINK: es el producto de todo esto. Sin compartirlo no entra nada. */}
      {enlace && (
        <section className="entra rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
          <h2 className="text-[1.02rem] font-bold text-tinta">Tu carta</h2>
          <p className="mt-0.5 text-[0.84rem] text-frio">
            Comparte este link por WhatsApp, Instagram o donde vendas.
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
                Configúralo aquí
              </Link>
            </p>
          )}
        </section>
      )}

      {/* EL EQUIPO (2026-08-31, pregunta de Jonathan sobre roles): si el dueño
          sigue trabajando solo, un empujón — mozo, caja y cocina ya se pueden
          invitar y cada uno ve SOLO lo suyo. Desaparece apenas invita a
          alguien: no es una tarea pendiente eterna. */}
      {estaSolo && (
        <Link
          href="/equipo"
          className="entra flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-carta px-5 py-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
        >
          <div>
            <p className="text-[0.95rem] font-bold text-tinta">👥 Invita a tu equipo</p>
            <p className="mt-0.5 text-[0.8rem] text-frio">
              Mozo, caja y cocina: cada uno entra con su propia cuenta y ve solo lo que le toca — nunca tu plata.
            </p>
          </div>
          <span className="shrink-0 text-xl leading-none text-frio">›</span>
        </Link>
      )}
    </div>
  );
}

/**
 * UN CONTADOR QUE AVISA CUANDO SUBE (2026-08-19).
 *
 * Esta pantalla se refresca sola cada 30 segundos y suele quedar abierta en la
 * compu del mostrador. Sin movimiento, un pedido nuevo solo cambia un dígito:
 * el dueño está atendiendo a alguien, mira de reojo y no se entera.
 *
 * Cuando SUBE, la tarjeta pulsa. Cuando BAJA no pasa nada —despachar un pedido
 * es una buena noticia que el dueño ya conoce porque la provocó él—.
 */
function Contador({ valor, emoji, nombre }: { valor: number; emoji: string; nombre: string }) {
  const [pulsa, setPulsa] = useState(false);
  const previo = useRef(valor);

  useEffect(() => {
    if (valor > previo.current) {
      setPulsa(true);
      const t = setTimeout(() => setPulsa(false), 900);
      previo.current = valor;
      return () => clearTimeout(t);
    }
    previo.current = valor;
  }, [valor]);

  return (
    <div
      className={`rounded-tarjeta px-3 py-3 text-center transition-[background-color,box-shadow] duration-300 ${
        valor > 0 ? "bg-arena ring-1 ring-linea" : "bg-arena/40"
      } ${pulsa ? "late ring-2 ring-brasa" : ""}`}
    >
      <p className="text-[1.1rem]" aria-hidden>{emoji}</p>
      <p
        className={`mt-0.5 text-[1.6rem] font-bold leading-none tabular-nums ${
          valor > 0 ? "text-tinta" : "text-frio/50"
        }`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[0.75rem] text-frio">{nombre}</p>
    </div>
  );
}

export default InicioRestaurante;
