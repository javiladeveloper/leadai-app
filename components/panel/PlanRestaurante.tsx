"use client";

import { useEffect, useState } from "react";
import {
  obtenerSuscripcion,
  contratarPlan,
  cancelarPlan,
  cambiarPlanProgramado,
  cancelarCambioPlan,
  historialPagos,
  type RespuestaSuscripcion,
  type PlanDisponible,
  type Periodicidad,
  type PagoSuscripcion,
} from "@/lib/api";
import { leerSesion } from "@/lib/auth";
import { soles } from "@/lib/precio";
import { Seccion } from "@/components/panel/Seccion";
import { useCheckoutCulqi, CONTENEDOR_CULQI } from "@/components/panel/useCheckoutCulqi";

/**
 * CONTRATAR Y PAGAR EL PLAN (2026-08-18).
 *
 * Hasta ahora los planes de restaurante eran una vitrina: existían en la
 * landing y en el catálogo, pero el dueño no tenía dónde poner la tarjeta.
 *
 * El cobro mensual (o anual) lo hace Culqi con la tarjeta guardada; acá solo
 * se tokeniza y se manda el plan elegido. El PRECIO no se manda: lo calcula el
 * backend desde el catálogo — quien pide el cobro no decide cuánto paga.
 */

const NOMBRE: Record<string, string> = {
  arranque: "Arranque",
  crecer: "Crecer",
  full: "Full",
  resto_gratis: "Gratis",
  pedidos: "Arranque",
  // Escalera de captación/ventas (contratables desde 2026-08-24, Culqi live).
  light: "Emprende",
  pro: "Pro",
  business: "Business",
  free: "Free",
  flujos: "Flujos",
};

/** Qué incluye cada plan, en la unidad que el dueño reconoce. */
const GANCHO: Record<string, string> = {
  arranque: "Para el local que ya vende",
  crecer: "El más elegido",
  full: "Sin techo de pedidos",
  light: "Cuando Free te quedó chico",
  pro: "El más elegido",
  business: "Para alto volumen y equipos",
};

/**
 * La unidad de cada escalera: los planes de restaurante se venden por PEDIDOS
 * y los de captación por CLIENTES atendidos por la IA. `clientesMes` lo manda
 * el backend nuevo (2026-08-24); api.ts todavía no lo tipa y por eso el campo
 * se lee con este tipo local.
 */
type ConClientes = { clientesMes?: number };
function unidadDelPlan(plan: PlanDisponible & ConClientes): string {
  const clientes = plan.clientesMes ?? 0;
  if (clientes > 0) return `${clientes.toLocaleString("es-PE")} clientes atendidos al mes`;
  return plan.pedidosMes === 0
    ? "Pedidos ilimitados"
    : `${plan.pedidosMes.toLocaleString("es-PE")} pedidos al mes`;
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PlanRestaurante() {
  const [datos, setDatos] = useState<RespuestaSuscripcion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>("mensual");
  const [elegido, setElegido] = useState<string | null>(null);
  // Segundo paso del checkout: ya confirmó qué compra y toca la tarjeta.
  const [pagando, setPagando] = useState(false);
  const [pagos, setPagos] = useState<PagoSuscripcion[]>([]);
  const [verPagos, setVerPagos] = useState(false);
  const [dandoBaja, setDandoBaja] = useState(false);
  const [avisoBaja, setAvisoBaja] = useState(false);
  // Cambio de plan programado (2026-08-23): en curso / error del pedido.
  const [programando, setProgramando] = useState(false);
  const [errorCambio, setErrorCambio] = useState<string | null>(null);

  function recargar() {
    return obtenerSuscripcion().then((d) => {
      setDatos(d);
      setCargando(false);
      // Se respeta lo que el negocio ya tiene contratado al abrir la pantalla.
      if (d?.suscripcion) setPeriodicidad(d.suscripcion.periodicidad);
    });
  }

  useEffect(() => {
    void recargar();
  }, []);

  const checkout = useCheckoutCulqi({
    titulo: "LeadAI",
    alTenerToken: async (tokenId) => {
      const sesion = leerSesion();
      const r = await contratarPlan({
        plan: elegido!,
        tokenId,
        email: sesion?.usuario.email ?? "",
        nombre: sesion?.usuario.nombre ?? "Cliente",
        periodicidad,
      });
      if (r.ok) await recargar();
      return r;
    },
  });

  // Si el dueño cierra el formulario de Culqi sin pagar, o la tarjeta se
  // rechaza, el contenedor tiene que desaparecer: dejarlo montado con un
  // "cancelado" abajo se lee como que el pago sigue en curso.
  //
  // VA ACÁ ARRIBA, antes de los `return` de carga/error: un hook detrás de un
  // return condicional se saltea en esos renders y React aborta la página
  // entera con "Rendered more hooks than during the previous render".
  useEffect(() => {
    if (checkout.estado === "cancelado" || checkout.estado === "error") {
      setElegido(null);
      setPagando(false);
    }
  }, [checkout.estado]);

  if (cargando) {
    return (
      <div className="space-y-5">
        <div className="h-44 animate-pulse rounded-tarjeta bg-arena-2/70" />
        <div className="h-64 animate-pulse rounded-tarjeta bg-arena-2/70" />
      </div>
    );
  }

  if (!datos) {
    return (
      <Seccion titulo="Tu plan" bajada="No pudimos cargar tu plan.">
        <p className="text-sm text-brasa-texto">Recarga la página para intentar de nuevo.</p>
      </Seccion>
    );
  }

  const s = datos.suscripcion;
  const activa = s && s.estado !== "cancelada";
  // EL PLAN VIGENTE, venga de donde venga (2026-08-20). `suscripcion` solo
  // existe cuando alguien pagó por Culqi; los planes que se venden hablando
  // viven en `Tenant.plan` y llegan como `planActual`. Sin esto, SHIRO —que
  // tiene plan `arranque` asignado a mano— veía los tres planes sin ninguno
  // marcado y no sabía cuál tenía contratado.
  const planVigente = datos.planActual ?? (activa ? s?.plan : null) ?? null;
  const tienePlan = Boolean(planVigente);
  const planDelVigente = datos.disponibles.find((p) => p.id === planVigente) ?? null;
  // El pago anual es opcional en la respuesta: un backend viejo no lo trae.
  // Se guarda el objeto y no un booleano para que TypeScript lo estreche.
  const anualDelPrimero = datos.disponibles[0]?.anual;

  /** El plan que el dueño eligió, para el resumen de compra. */
  const planElegido = datos.disponibles.find((p) => p.id === elegido) ?? null;
  const montoElegido = planElegido
    ? periodicidad === "anual" && planElegido.anual
      ? planElegido.anual.precioCentavos
      : planElegido.precioCentavos
    : 0;

  // PASO 1 — elegir. Solo marca el plan y muestra el resumen; NO abre el
  // formulario de tarjeta todavía.
  //
  // CON SUSCRIPCIÓN ACTIVA no hay checkout (2026-08-23, decisión de
  // Jonathan): el cambio se PROGRAMA para el cierre del ciclo — no se cobra
  // nada hoy y la siguiente factura ya sale con el plan nuevo. La tarjeta
  // guardada sigue valiendo, así que no se vuelve a pedir.
  async function contratar(plan: PlanDisponible) {
    if (s && activa) {
      setErrorCambio(null);
      setProgramando(true);
      const r = await cambiarPlanProgramado({ plan: plan.id, periodicidad });
      setProgramando(false);
      if (!r.ok) { setErrorCambio(r.error ?? "No se pudo programar el cambio"); return; }
      await recargar();
      return;
    }
    checkout.cerrar();
    setPagando(false);
    setElegido(plan.id);
  }

  async function deshacerCambio() {
    setProgramando(true);
    await cancelarCambioPlan();
    setProgramando(false);
    await recargar();
  }

  // PASO 2 — confirmar. Recién acá se monta la tarjeta.
  function confirmarCompra() {
    if (!planElegido) return;
    setPagando(true);
    // `requestAnimationFrame`: el div del formulario se revela con el cambio
    // de estado de arriba, y Culqi necesita encontrarlo YA en el DOM.
    requestAnimationFrame(() =>
      checkout.abrir({
        montoCentavos: montoElegido,
        descripcion: `Plan ${NOMBRE[planElegido.id] ?? planElegido.id} ${periodicidad === "anual" ? "anual" : "mensual"}`,
      }),
    );
  }

  async function darDeBaja() {
    setDandoBaja(true);
    const r = await cancelarPlan();
    setDandoBaja(false);
    setAvisoBaja(false);
    if (r.ok) await recargar();
  }

  async function abrirPagos() {
    setVerPagos(true);
    setPagos(await historialPagos());
  }

  return (
    <div className="space-y-5">
      {/* El plan ACTUAL primero: es lo que el dueño vino a ver. */}
      {activa && s && <PlanActual s={s} />}

      {/* EL CAMBIO PROGRAMADO (2026-08-23). Se dice CUÁNDO pasa y que la
          siguiente factura ya sale con el plan nuevo — sin esto el dueño
          toca "Crecer", no ve ningún cobro y cree que no funcionó. */}
      {activa && s?.planSiguiente && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-tarjeta bg-brasa/10 px-4 py-3 ring-1 ring-brasa/30">
          <p className="text-[0.88rem] text-tinta">
            🔁 Tu plan pasa a <b>{NOMBRE[s.planSiguiente] ?? s.planSiguiente}</b>
            {s.periodicidadSiguiente === "anual" ? " (anual)" : ""} el{" "}
            <b>{fecha(s.vigenteHasta)}</b> — tu siguiente factura ya sale con el plan nuevo.
          </p>
          <button
            onClick={deshacerCambio}
            disabled={programando}
            className="shrink-0 rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold text-frio ring-1 ring-linea transition hover:bg-arena disabled:opacity-40"
          >
            Cancelar el cambio
          </button>
        </div>
      )}
      {errorCambio && (
        <p className="rounded-tarjeta bg-alerta-suave px-4 py-2.5 text-[0.85rem] font-semibold text-alerta">
          {errorCambio}
        </p>
      )}

      {/* PLAN SIN SUSCRIPCIÓN (2026-08-20): el que se vendió hablando y se
          asignó a mano. No tiene precio cobrado, ni fecha de renovación, ni
          tarjeta — o sea que `PlanActual` no aplica—, pero el dueño igual
          tiene que ver que SÍ tiene un plan activo. Antes entraba y la
          pantalla se veía como si no tuviera ninguno. */}
      {!activa && tienePlan && planDelVigente && (
        <Seccion titulo="Tu plan" bajada="Lo que tienes contratado hoy." tono="hondo">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
                Plan activo
              </p>
              <p className="text-[1.6rem] font-bold leading-tight text-arena">
                {NOMBRE[planVigente!] ?? planVigente}
              </p>
              <p className="text-[0.82rem] text-arena/70">{unidadDelPlan(planDelVigente)}</p>
            </div>
            <p className="text-[1.1rem] font-bold tabular-nums text-arena">
              {soles(planDelVigente.precioCentavos)}
              <span className="ml-1 text-[0.8rem] font-semibold text-arena/60">/mes</span>
            </p>
          </div>
          {/* Sin tarjeta detrás no hay renovación automática: decirlo evita
              que el dueño espere un cobro que no va a pasar, o que busque un
              "cancelar" que no existe. */}
          <p className="mt-3 text-[0.8rem] text-arena/60">
            Lo activamos desde nuestro lado. Si quieres cambiarlo, elige otro plan abajo.
          </p>
        </Seccion>
      )}

      <Seccion
        titulo={tienePlan ? "Cambiar de plan" : "Elige tu plan"}
        bajada={
          s && activa
            ? "Puedes subir o bajar cuando quieras: el cambio se aplica al cierre de tu ciclo, antes de la siguiente factura."
            : tienePlan
              ? "Elige el plan y se activa con tu primer pago."
              : ((datos.disponibles[0] as PlanDisponible & ConClientes)?.clientesMes ?? 0) > 0
                ? "Pagas por los clientes que tu IA atiende en el mes."
                : "Pagas por los pedidos del mes. Si te pasas, sigues vendiendo igual."
        }
        tono={tienePlan ? "claro" : "hondo"}
      >
        <div className="space-y-4">
          {/* Durante un deploy el backend viejo todavía no manda `anual`: sin
              esta guarda la pantalla entera se cae con un TypeError y el dueño
              no puede ni ver su plan. */}
          {anualDelPrimero && (
            <SelectorPeriodo
              valor={periodicidad}
              onCambio={setPeriodicidad}
              mesesGratis={anualDelPrimero.mesesGratis}
              sobreOscuro={!tienePlan}
            />
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {datos.disponibles.map((p) => (
              <TarjetaPlan
                key={p.id}
                plan={p}
                periodicidad={periodicidad}
                esElActual={
                  planVigente === p.id &&
                  // Con suscripción la periodicidad importa: mensual y anual
                  // son dos compras distintas del mismo plan. Sin ella no hay
                  // periodicidad guardada, así que alcanza con el plan.
                  (s && activa ? s.periodicidad === periodicidad : true)
                }
                deshabilitado={programando || checkout.estado === "abriendo" || checkout.estado === "procesando"}
                onElegir={() => contratar(p)}
                sobreOscuro={!tienePlan}
              />
            ))}
          </div>

          {/* EL PAGO, EN DOS PASOS (2026-08-20). Antes el formulario de Culqi
              aparecía de una al tocar "Elegir": campos de tarjeta a la cara,
              sin decir qué plan se estaba comprando ni cuánto se iba a cobrar.

              Ahora primero se confirma QUÉ se compra —plan, periodicidad y
              total, como el "Resumen de pago" de cualquier checkout— y recién
              al confirmar se despliega la tarjeta. Es un toque más, y compra
              la certeza de saber qué se está pagando. */}
          {elegido && planElegido && checkout.estado !== "ok" && (
            <div className="surge overflow-hidden rounded-tarjeta bg-carta ring-1 ring-linea">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-linea px-5 py-4">
                <div className="min-w-0">
                  <p className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                    Tu compra
                  </p>
                  <p className="text-[1.05rem] font-bold leading-tight text-tinta">
                    Plan {NOMBRE[elegido] ?? elegido}
                  </p>
                  <p className="text-[0.82rem] text-frio">
                    {periodicidad === "anual" ? "Pago anual" : "Pago mensual"}
                    {" · "}
                    {unidadDelPlan(planElegido).toLowerCase()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[1.4rem] font-bold leading-none tabular-nums text-tinta">
                    {soles(montoElegido)}
                  </p>
                  <p className="text-[0.75rem] text-frio">
                    {periodicidad === "anual" ? "al año" : "al mes"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 px-5 py-4">
                {/* El formulario de Culqi solo cuando confirma. `hidden` y no
                    desmontar: Culqi ya lo montó adentro y quitarlo del DOM lo
                    dejaría huérfano. */}
                <div className={pagando ? "" : "hidden"}>
                  <div id={CONTENEDOR_CULQI} className="min-h-[24rem] rounded-tarjeta" />
                </div>

                {!pagando && (
                  <button
                    type="button"
                    onClick={confirmarCompra}
                    className="w-full rounded-full bg-brasa px-5 py-3 text-sm font-bold text-sobre-brasa shadow-[0_2px_10px_rgba(0,0,0,0.10)] transition hover:bg-brasa-hondo active:scale-[0.99]"
                  >
                    Continuar al pago
                  </button>
                )}

                {checkout.estado !== "procesando" && (
                  <button
                    type="button"
                    onClick={() => { checkout.cerrar(); setElegido(null); setPagando(false); }}
                    className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-arena"
                  >
                    Cancelar
                  </button>
                )}

                <p className="flex items-center justify-center gap-1.5 text-[0.72rem] text-frio">
                  <span aria-hidden>🔒</span>
                  Pago seguro con Culqi. Cambias o cancelas cuando quieras.
                </p>
              </div>
            </div>
          )}

          {!datos.llavePublica && (
            <p className="rounded-tarjeta bg-calor-suave px-4 py-3 text-[0.85rem] text-calor-hondo">
              Los pagos todavía no están habilitados en tu cuenta. Escríbenos y lo activamos.
            </p>
          )}

          {checkout.estado === "error" && (
            <div className="rounded-tarjeta bg-calor-suave px-4 py-3">
              <p className="text-sm font-semibold text-calor-hondo">No se pudo completar el pago</p>
              <p className="mt-0.5 text-[0.82rem] text-tinta-2">{checkout.error}</p>
            </div>
          )}
          {checkout.estado === "cancelado" && (
            <p className={`text-sm ${!activa ? "text-arena/70" : "text-frio"}`}>
              Pago cancelado. Puedes intentarlo de nuevo cuando quieras.
            </p>
          )}
        </div>
      </Seccion>

      {activa && s && (
        <Seccion
          titulo="Facturación"
          bajada="Tus cobros y cómo dar de baja."
          accion={
            <button
              type="button"
              onClick={abrirPagos}
              className="shrink-0 rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-linea"
            >
              Ver cobros
            </button>
          }
        >
          <div className="space-y-4">
            {verPagos && <ListaPagos pagos={pagos} />}

            {/* La baja NO es un botón directo: es plata y es difícil de
                deshacer, así que se confirma. */}
            {avisoBaja ? (
              <div className="rounded-tarjeta bg-calor-suave px-4 py-3">
                <p className="text-[0.9rem] font-semibold text-tinta">
                  ¿Damos de baja tu plan {NOMBRE[s.plan] ?? s.plan}?
                </p>
                <p className="mt-0.5 text-[0.82rem] text-tinta-2">
                  Sigues con todo hasta el {fecha(s.vigenteHasta)} — ya lo pagaste. Después
                  pasas al plan gratis.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={darDeBaja}
                    disabled={dandoBaja}
                    className="rounded-chip bg-alerta px-4 py-2 text-[0.85rem] font-bold text-carta transition hover:bg-alerta-hondo disabled:opacity-60"
                  >
                    {dandoBaja ? "Dando de baja…" : "Sí, dar de baja"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvisoBaja(false)}
                    className="rounded-chip px-4 py-2 text-[0.85rem] font-semibold text-tinta-2 ring-1 ring-linea hover:bg-arena"
                  >
                    Mejor no
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAvisoBaja(true)}
                className="text-[0.82rem] font-semibold text-frio underline underline-offset-2 hover:text-tinta"
              >
                Dar de baja mi plan
              </button>
            )}
          </div>
        </Seccion>
      )}

      {/* Mientras el backend cobra, el widget de Culqi ya se cerró: sin esto
          la pantalla queda muda justo cuando más importa. */}
      {checkout.estado === "procesando" && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-tinta/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-carta px-8 py-7 shadow-[0_8px_24px_rgba(51,40,31,0.2)]">
            <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-linea border-t-brasa" />
            <p className="text-sm font-semibold text-tinta">Activando tu plan…</p>
            <p className="text-[0.78rem] text-frio">No cierres esta ventana</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** El plan que el negocio tiene hoy, con el estado del cobro. */
function PlanActual({ s }: { s: NonNullable<RespuestaSuscripcion["suscripcion"]> }) {
  const enGracia = s.estado === "en_gracia";
  return (
    <Seccion
      titulo="Tu plan"
      bajada={enGracia ? undefined : "Lo que tienes contratado y hasta cuándo."}
      tono="hondo"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-bold uppercase tracking-wide text-orbita">
              Plan {s.periodicidad}
            </p>
            <p className="text-[1.6rem] font-bold leading-tight text-arena">
              {NOMBRE[s.plan] ?? s.plan}
            </p>
          </div>
          <p className="text-[1.1rem] font-bold tabular-nums text-arena">
            {soles(s.precioCentavos)}
            <span className="ml-1 text-[0.8rem] font-semibold text-arena/60">
              /{s.periodicidad === "anual" ? "año" : "mes"}
            </span>
          </p>
        </div>

        {/* Un cobro fallido NO corta el servicio: se avisa y se le pide que
            revise la tarjeta. Por eso el tono es naranja y no rojo. */}
        {enGracia && (
          <div className="rounded-tarjeta bg-orbita/15 px-4 py-3 ring-1 ring-orbita/30">
            <p className="text-[0.9rem] font-bold text-orbita">No pudimos cobrarte</p>
            <p className="mt-0.5 text-[0.82rem] text-arena/85">
              Tu tarjeta{s.tarjetaUltimos4 ? ` terminada en ${s.tarjetaUltimos4}` : ""} necesita
              una revisada. Mientras tanto sigues trabajando normal — carga otra tarjeta abajo
              cuando puedas.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.82rem] text-arena/75">
          <span>
            {enGracia ? "Vencía el" : "Se renueva el"}{" "}
            <b className="font-bold text-arena">{fecha(s.vigenteHasta)}</b>
          </span>
          {s.tarjetaUltimos4 && (
            <span>
              {s.tarjetaMarca ?? "Tarjeta"} ····{" "}
              <b className="font-bold text-arena">{s.tarjetaUltimos4}</b>
            </span>
          )}
        </div>
      </div>
    </Seccion>
  );
}

/** Mensual o anual. */
function SelectorPeriodo({
  valor,
  onCambio,
  mesesGratis,
  sobreOscuro,
}: {
  valor: Periodicidad;
  onCambio: (v: Periodicidad) => void;
  mesesGratis: number;
  sobreOscuro: boolean;
}) {
  const fondo = sobreOscuro ? "bg-arena/10 ring-arena/15" : "bg-arena ring-linea";
  const inactivo = sobreOscuro ? "text-arena/70 hover:text-arena" : "text-tinta-2 hover:text-tinta";
  return (
    <div className={`inline-flex rounded-chip p-1 ring-1 ${fondo}`}>
      {(["mensual", "anual"] as Periodicidad[]).map((p) => {
        const activo = valor === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onCambio(p)}
            aria-pressed={activo}
            className={`flex items-center gap-2 rounded-chip px-4 py-1.5 text-[0.85rem] font-semibold transition ${
              activo ? "bg-carta text-tinta shadow-sm" : inactivo
            }`}
          >
            {p === "mensual" ? "Mes a mes" : "Anual"}
            {p === "anual" && (
              <span className="rounded-chip bg-brasa px-2 py-0.5 text-[0.65rem] font-bold uppercase text-sobre-brasa">
                −{mesesGratis} meses
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Una opción de plan. */
function TarjetaPlan({
  plan,
  periodicidad,
  esElActual,
  deshabilitado,
  onElegir,
  sobreOscuro,
}: {
  plan: PlanDisponible;
  periodicidad: Periodicidad;
  esElActual: boolean;
  deshabilitado: boolean;
  onElegir: () => void;
  sobreOscuro: boolean;
}) {
  // `plan.anual` puede faltar si el backend es viejo (durante un deploy): ahí
  // se muestra el mensual, que siempre viene.
  const anual = periodicidad === "anual" ? plan.anual : undefined;
  // El número grande es siempre POR MES, en los dos modos: es la única forma
  // de compararlos de un vistazo. La letra chica dice el total.
  const porMes = anual ? anual.equivalenteMensualCentavos : plan.precioCentavos;

  const caja = sobreOscuro
    ? "bg-arena/10 ring-1 ring-arena/15"
    : "bg-arena/50 ring-1 ring-linea";
  const titulo = sobreOscuro ? "text-arena" : "text-tinta";
  const secundario = sobreOscuro ? "text-arena/60" : "text-frio";

  return (
    <div className={`flex flex-col rounded-tarjeta p-4 ${esElActual ? "ring-2 ring-brasa" : caja}`}>
      <p className={`text-[0.95rem] font-bold ${titulo}`}>{NOMBRE[plan.id] ?? plan.id}</p>
      <p className={`text-[0.78rem] ${secundario}`}>{GANCHO[plan.id] ?? ""}</p>

      <p className={`mt-3 text-[1.5rem] font-bold leading-none tabular-nums ${titulo}`}>
        {soles(porMes)}
        <span className={`ml-1 text-[0.75rem] font-semibold ${secundario}`}>/mes</span>
      </p>
      <p className={`mt-1 text-[0.75rem] ${secundario}`}>
        {anual
          ? `${soles(anual.precioCentavos)} al año · ahorras ${soles(anual.ahorroCentavos)}`
          : unidadDelPlan(plan)}
      </p>
      {anual && (
        <p className={`text-[0.75rem] ${secundario}`}>{unidadDelPlan(plan)}</p>
      )}

      <button
        type="button"
        onClick={onElegir}
        disabled={deshabilitado || esElActual}
        className={`mt-4 rounded-chip px-4 py-2 text-[0.85rem] font-bold transition disabled:opacity-60 ${
          esElActual
            ? "bg-brasa/15 text-brasa-texto"
            : "bg-orbita text-sobre-orbita hover:bg-orbita-hondo"
        }`}
      >
        {esElActual ? "Tu plan actual" : "Elegir"}
      </button>
    </div>
  );
}

/** El historial de cobros. */
function ListaPagos({ pagos }: { pagos: PagoSuscripcion[] }) {
  if (pagos.length === 0) {
    return <p className="text-[0.85rem] text-frio">Todavía no hay cobros registrados.</p>;
  }
  return (
    <div className="space-y-1.5">
      {pagos.map((p, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-1.5 text-[0.85rem] last:border-0"
        >
          <span className="text-tinta-2">{fecha(p.creadoEn)}</span>
          <span className="flex items-center gap-2">
            <b className="tabular-nums text-tinta">{soles(p.montoCentavos)}</b>
            {p.estado === "pagado" ? (
              <span className="rounded-chip bg-ok/10 px-2 py-0.5 text-[0.72rem] font-bold text-ok">
                Pagado
              </span>
            ) : (
              <span
                className="rounded-chip bg-calor-suave px-2 py-0.5 text-[0.72rem] font-bold text-calor-hondo"
                title={p.motivoFalla ?? undefined}
              >
                No pasó
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export default PlanRestaurante;
