"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { movimientosNegocioAdmin, cambiarPlanAdmin, type MovimientosNegocioAdmin } from "@/lib/api";
import { entrarComoSoporte } from "@/lib/auth";
import { soles } from "@/lib/precio";
import { SkeletonLista } from "@/components/Skeletons";

/**
 * LOS MOVIMIENTOS DE UN NEGOCIO (2026-08-24, super admin).
 *
 * Todo lo que el dueño de la plataforma quiere saber de UN restaurante sin
 * molestar a nadie: cuánto vendió, por dónde le entra la plata, sus últimos
 * pedidos con estado y pago, y su relación con nosotros (plan y recargas).
 * Todo LECTURA — operar el negocio sigue siendo del negocio.
 */

// El nombre que se lee, no la clave interna: la lista ya lo traduce y ver
// "resto_gratis" acá delata el detrás de escena sin aportar nada.
const PLAN_LABEL: Record<string, string> = {
  free: "Free", flujos: "Flujos", light: "Emprende", pro: "Pro", business: "Business",
  pedidos: "Arranque", arranque: "Arranque", crecer: "Crecer", full: "Full",
  resto_gratis: "Gratis",
};

/**
 * LAS DOS ESCALERAS, espejo de `adminPanel.ts`. Captación cobra por clientes
 * atendidos; restaurante por pedidos. El backend rechaza el cruce igual — esto
 * es para no OFRECER un plan que va a fallar.
 */
const PLANES_CAPTACION = ["free", "flujos", "light", "pro", "business"];
const PLANES_RESTAURANTE = ["resto_gratis", "arranque", "crecer", "full"];

/**
 * CAMBIAR EL PLAN A MANO (2026-09-09, Jonathan: "no me sale la opción para
 * cambiar el plan... agrégalo al panel de admin").
 *
 * La ficha es de lectura a propósito —operar el negocio es del negocio— pero
 * el PLAN es la relación comercial con la plataforma, no una operación suya.
 * Hasta hoy había que armar un curl con la ADMIN_API_KEY.
 *
 * No toca la suscripción de Culqi: es el override manual (una prueba, un trato
 * hablado). Si el negocio tiene cobro automático, el corte siguiente manda —y
 * por eso se avisa en pantalla en vez de dejarlo como sorpresa.
 */
function CambiarPlan({
  id, planActual, objetivo, alCambiar,
}: {
  id: string; planActual: string; objetivo?: string; alCambiar: (plan: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin `objetivo` (API vieja) se cae a la escalera donde ya está su plan
  // actual: mostrar la lista equivocada es peor que no mostrar nada.
  const escalera =
    objetivo === "vender_pedidos" || PLANES_RESTAURANTE.includes(planActual)
      ? PLANES_RESTAURANTE
      : PLANES_CAPTACION;

  async function elegir(plan: string) {
    if (plan === planActual) { setAbierto(false); return; }
    setGuardando(true);
    setError(null);
    const r = await cambiarPlanAdmin(id, plan);
    if (r.ok) {
      alCambiar(r.plan);
      setAbierto(false);
    } else {
      setError(r.error);
    }
    setGuardando(false);
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-chip px-2 py-0.5 text-[0.78rem] font-bold text-tinta-2 underline underline-offset-2 transition hover:text-tinta"
      >
        cambiar
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 align-middle">
      {escalera.map((p) => (
        <button
          key={p}
          disabled={guardando}
          onClick={() => elegir(p)}
          className={`rounded-chip px-2.5 py-1 text-[0.78rem] font-bold transition disabled:opacity-50 ${
            p === planActual
              ? "bg-tinta text-carta"
              : "bg-carta text-tinta ring-1 ring-linea hover:ring-tinta-2"
          }`}
        >
          {PLAN_LABEL[p] ?? p}
        </button>
      ))}
      <button
        onClick={() => { setAbierto(false); setError(null); }}
        disabled={guardando}
        className="px-1.5 text-[0.78rem] font-bold text-frio disabled:opacity-50"
      >
        ✕
      </button>
      {guardando && (
        <span className="flex items-end gap-1 pb-[3px]" aria-label="Guardando">
          {[0, 1, 2].map((i) => (
            <span key={i} className="punto-espera h-1.5 w-1.5 rounded-full bg-tinta-2" style={{ ["--i" as string]: i }} />
          ))}
        </span>
      )}
      {error && <span className="text-[0.78rem] font-semibold text-brasa-hondo">{error}</span>}
    </span>
  );
}

/**
 * EL AVISO DE QUE ESTO NO ES LA SUSCRIPCIÓN.
 *
 * Solo se muestra si el negocio tiene cobro automático: ahí el cambio a mano
 * dura hasta el próximo corte y después Culqi vuelve a mandar. Sin este aviso
 * el admin cree que quedó y una semana después el plan "se revirtió solo".
 */
function AvisoSuscripcion() {
  return (
    <p className="mt-1 text-[0.78rem] text-frio">
      ⚠️ Tiene cobro automático: un cambio a mano vale hasta el próximo corte.
    </p>
  );
}

const ESTADO_EMOJI: Record<string, string> = {
  esperando_pago: "🕐", pagado: "🟢", preparando: "👨‍🍳", listo: "📦",
  en_camino: "🛵", entregado: "✅", cancelado: "✕",
};

const METODO_LABEL: Record<string, string> = {
  yape: "Yape", plin: "Plin", efectivo: "Efectivo", tarjeta: "Tarjeta",
  transferencia: "Transferencia", otro: "Otro",
};

function fecha(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function TarjetaTramo({ titulo, t }: { titulo: string; t: { pedidos: number; solesCentavos: number } }) {
  return (
    <div className="rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
      <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">{titulo}</p>
      <p className="mt-0.5 text-[1.3rem] font-bold tabular-nums text-tinta">{soles(t.solesCentavos)}</p>
      <p className="text-[0.78rem] text-frio">{t.pedidos} {t.pedidos === 1 ? "pedido" : "pedidos"}</p>
    </div>
  );
}

export default function MovimientosNegocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [datos, setDatos] = useState<MovimientosNegocioAdmin | null>(null);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");

  useEffect(() => {
    movimientosNegocioAdmin(id)
      .then((r) => { setDatos(r); setEstado(r ? "ok" : "error"); })
      .catch(() => setEstado("error"));
  }, [id]);

  if (estado === "cargando") {
    return <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8"><SkeletonLista filas={5} /></div>;
  }
  if (estado === "error" || !datos) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-6 lg:px-8">
        <p className="rounded-tarjeta bg-carta p-5 text-center font-semibold text-tinta ring-1 ring-linea">
          No encontramos ese negocio. <Link href="/admin/negocios" className="text-brasa-texto underline">Volver</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <Link href="/admin/negocios" className="text-[0.85rem] font-semibold text-frio hover:text-tinta">
          ← Negocios
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[1.8rem] font-bold text-tinta">{datos.nombre}</h1>
          {/* ENTRAR ES DISTINTO DE MIRAR: esta ficha es lectura, y para
              arreglarle algo por teléfono hace falta ver su panel como lo ve
              él. El backend ya lo permite (entra como `admin`, y queda en el
              log); esto es la puerta. */}
          <button
            type="button"
            onClick={() => {
              entrarComoSoporte(datos.tenantId, datos.nombre);
              // Recarga entera: el panel lee la empresa activa al montar, y
              // un push dejaría las pantallas con los datos del negocio viejo.
              window.location.href = "/inicio";
            }}
            className="rounded-chip bg-tinta px-3.5 py-2 text-[0.82rem] font-bold text-carta transition hover:opacity-90"
          >
            Entrar como soporte
          </button>
        </div>
        <p className="mt-0.5 text-[0.88rem] text-frio">
          Plan <b className="text-tinta-2">{PLAN_LABEL[datos.plan] ?? datos.plan}</b>{" "}
          <CambiarPlan
            id={id}
            planActual={datos.plan}
            objetivo={datos.objetivo}
            // Se actualiza en memoria en vez de recargar: volver a pedir los
            // movimientos completos por un campo es tirar abajo la pantalla
            // que el admin estaba mirando.
            alCambiar={(plan) => setDatos((d) => (d ? { ...d, plan } : d))}
          />
          {datos.suscripcion && (
            <>
              {" · "}suscripción {datos.suscripcion.estado} hasta el{" "}
              {new Date(datos.suscripcion.vigenteHasta).toLocaleDateString("es-PE")}
              {datos.suscripcion.planSiguiente && <> · cambia a <b>{datos.suscripcion.planSiguiente}</b> al corte</>}
            </>
          )}
          {(datos.recargas.mensajesUltimos90 > 0 || datos.recargas.adsCentavosUltimos90 > 0) && (
            <>
              {" · "}recargó {datos.recargas.mensajesUltimos90 > 0 && <>{datos.recargas.mensajesUltimos90} mensajes</>}
              {datos.recargas.mensajesUltimos90 > 0 && datos.recargas.adsCentavosUltimos90 > 0 && " y "}
              {datos.recargas.adsCentavosUltimos90 > 0 && <>{soles(datos.recargas.adsCentavosUltimos90)} de ads</>}
              {" "}(90 días)
            </>
          )}
        </p>
        {datos.suscripcion?.estado === "activa" && <AvisoSuscripcion />}
      </header>

      {/* La puesta en marcha: qué le falta a este negocio para vender.
          Solo aparece si falta algo — al que ya arrancó completo no hay que
          decirle nada. */}
      {(!datos.senales.whatsapp || datos.senales.platos === 0 || !datos.senales.cartaWeb ||
        !datos.senales.pagos || datos.senales.mesas === 0 || !datos.senales.redes) && (
        <div className="rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
          <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">Puesta en marcha</p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.85rem]">
            <span className={datos.senales.whatsapp ? "text-tinta-2" : "font-semibold text-brasa-texto"}>
              {datos.senales.whatsapp ? "✓ WhatsApp conectado" : "✗ Sin WhatsApp"}
            </span>
            <span className={datos.senales.platos > 0 ? "text-tinta-2" : "font-semibold text-brasa-texto"}>
              {datos.senales.platos > 0 ? `✓ Carta con ${datos.senales.platos} platos` : "✗ Sin carta"}
            </span>
            <span className={datos.senales.cartaWeb ? "text-tinta-2" : "font-semibold text-brasa-texto"}>
              {datos.senales.cartaWeb ? "✓ Carta web con link" : "✗ Sin link de carta web"}
            </span>
            <span className={datos.senales.pagos ? "text-tinta-2" : "font-semibold text-brasa-texto"}>
              {datos.senales.pagos ? "✓ Cobros configurados" : "✗ Sin forma de cobro"}
            </span>
            <span className={datos.senales.mesas > 0 ? "text-tinta-2" : "text-frio"}>
              {datos.senales.mesas > 0 ? `✓ ${datos.senales.mesas} mesas con QR` : "— Sin mesas (solo delivery/recojo)"}
            </span>
            <span className={datos.senales.redes ? "text-tinta-2" : "text-frio"}>
              {datos.senales.redes ? "✓ Redes en la carta" : "— Sin redes sociales"}
            </span>
          </div>
        </div>
      )}

      {/* Las ventas primero: es la pregunta que trajo al super admin acá. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaTramo titulo="Hoy" t={datos.resumen.hoy} />
        <TarjetaTramo titulo="Últimos 7 días" t={datos.resumen.dias7} />
        <TarjetaTramo titulo="Últimos 30 días" t={datos.resumen.dias30} />
      </div>

      {/* Por dónde entra la plata COBRADA (30 días). */}
      {datos.porMetodo.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {datos.porMetodo.map((m) => (
            <span key={m.metodo} className="rounded-chip bg-carta px-3 py-1.5 text-[0.82rem] ring-1 ring-linea">
              {METODO_LABEL[m.metodo] ?? m.metodo}:{" "}
              <b className="tabular-nums text-tinta">{soles(m.solesCentavos)}</b>
              <span className="ml-1 text-frio">({m.pedidos})</span>
            </span>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-tarjeta bg-carta ring-1 ring-linea">
        <table className="w-full min-w-[680px] text-left text-[0.88rem]">
          <thead>
            <tr className="border-b border-linea text-[0.72rem] uppercase tracking-wide text-frio">
              <th className="px-4 py-3 font-bold">Cuándo</th>
              <th className="px-4 py-3 font-bold">Pedido</th>
              <th className="px-4 py-3 font-bold">Cómo</th>
              <th className="px-4 py-3 font-bold">Estado</th>
              <th className="px-4 py-3 font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.pedidos.map((p) => (
              <tr key={p.id} className="border-b border-linea/60 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-frio">{fecha(p.creadoEn)}</td>
                <td className="max-w-[280px] px-4 py-3">
                  <p className="truncate text-tinta" title={p.items}>{p.items || "—"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                  {p.modalidad === "local" ? (p.mesa ? `🍽️ Mesa ${p.mesa}` : "🍽️ Mostrador")
                    : p.modalidad === "delivery" ? "🛵 Delivery" : "🥡 Recojo"}
                  {p.pagoMetodo && <span className="ml-1 text-[0.75rem] text-frio">· {METODO_LABEL[p.pagoMetodo] ?? p.pagoMetodo}</span>}
                  {p.pago === "efectivo_pendiente" && <span className="ml-1 text-[0.75rem] text-frio">· 💵 por cobrar</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-tinta-2">
                  {ESTADO_EMOJI[p.estado] ?? ""} {p.estado.replace("_", " ")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-tinta">
                  {soles(p.totalCentavos)}
                </td>
              </tr>
            ))}
            {datos.pedidos.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-frio">Sin pedidos todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
