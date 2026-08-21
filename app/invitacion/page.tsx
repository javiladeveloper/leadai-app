"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion } from "@/lib/auth";
import { aceptarInvitacion, mirarInvitacion, type InvitacionAbierta } from "@/lib/api";
import { LogoLeadAI } from "@/components/LogoLeadAI";

/**
 * LA PANTALLA QUE ABRE QUIEN FUE INVITADO (2026-08-21, reescrita).
 *
 * Antes decía "Te invitaron a un equipo" sin poder decir a CUÁL, porque no
 * había forma de leer la invitación sin estar logueado. Quien llegaba sin
 * cuenta —el caso normal de un mozo— veía una pantalla que le pedía iniciar
 * sesión "porque sí", y si se registraba con otro correo la invitación lo
 * rechazaba después, sin explicación.
 *
 * Ahora lo primero es MIRAR la invitación (endpoint público) y decirlo con
 * nombre y apellido: qué negocio, qué rol, y a qué correo va dirigida. Recién
 * después se le pide la cuenta.
 */

/** Qué va a poder hacer, dicho en una línea. */
const QUE_HACE: Record<string, string> = {
  mozo: "Vas a poder tomar pedidos y ver la cocina.",
  agente: "Vas a poder atender las conversaciones del negocio.",
  admin: "Vas a poder administrar el negocio.",
  owner: "Vas a entrar como dueño del negocio.",
};

const NOMBRE_ROL: Record<string, string> = {
  mozo: "Mozo", agente: "Vendedor", admin: "Administrador", owner: "Dueño",
};

export default function InvitacionPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [datos, setDatos] = useState<InvitacionAbierta | null>(null);
  const [estado, setEstado] = useState<"mirando" | "lista" | "aceptando" | "ok" | "error">("mirando");
  const [mensaje, setMensaje] = useState("");

  /** A dónde mandarlo después de entrar: un mozo no puede ver /inicio. */
  const destinoDe = useCallback((rol?: string) => (rol === "mozo" ? "/cocina" : "/inicio"), []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    if (!t) {
      setEstado("error");
      setMensaje("Este enlace no es válido. Pedile al negocio que te lo mande de nuevo.");
      return;
    }
    setToken(t);
    // El token queda guardado SIEMPRE, no solo cuando falta sesión: si la
    // persona se va a registrar, al volver se retoma sin que tenga que buscar
    // el correo otra vez.
    sessionStorage.setItem("invitacion_token", t);

    void mirarInvitacion(t).then((r) => {
      if (!r.ok) {
        setEstado("error");
        setMensaje(r.error);
        return;
      }
      setDatos(r.datos);
      setEstado("lista");
    });
  }, []);

  const aceptar = useCallback(async () => {
    if (!token) return;
    setEstado("aceptando");
    const r = await aceptarInvitacion(token);
    if (!r.ok) {
      setEstado("error");
      setMensaje(r.error ?? "No se pudo aceptar la invitación.");
      return;
    }
    sessionStorage.removeItem("invitacion_token");
    setEstado("ok");
    setTimeout(() => router.replace(destinoDe(datos?.rol)), 1200);
  }, [token, router, datos, destinoDe]);

  const sesion = haySesion() ? leerSesion() : null;
  // La invitación solo la acepta el correo al que fue dirigida. Si la persona
  // está logueada con OTRO, decírselo ahora evita que toque un botón que va a
  // fallar y quede sin entender por qué.
  const otroCorreo =
    Boolean(sesion && datos && sesion.usuario.email.toLowerCase() !== datos.email.toLowerCase());

  return (
    <div className="grid min-h-dvh place-items-center bg-arena px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <LogoLeadAI className="mx-auto h-14 w-14 rounded-2xl" />

        {estado === "mirando" && (
          <div className="mt-8 space-y-3">
            <div className="mx-auto h-6 w-40 animate-pulse rounded-chip bg-arena-2" />
            <div className="mx-auto h-4 w-52 animate-pulse rounded-chip bg-arena-2/70" />
          </div>
        )}

        {(estado === "lista" || estado === "aceptando") && datos && (
          <div className="surge">
            <p className="eyebrow mt-6">{NOMBRE_ROL[datos.rol] ?? datos.rol}</p>
            <h1 className="mt-1 text-[1.6rem] font-bold leading-tight text-tinta">
              {datos.negocio} te suma al equipo
            </h1>
            <p className="mt-2 text-[0.95rem] leading-snug text-tinta-2">
              {QUE_HACE[datos.rol] ?? "Vas a tener acceso al negocio."}
            </p>

            {/* EL CORREO, bien visible. Es el dato que decide si esto va a
                funcionar: la invitación no la acepta ningún otro. */}
            <p className="mt-4 rounded-tarjeta bg-carta px-3 py-2 text-[0.88rem] text-tinta ring-1 ring-linea">
              Para <b className="break-all">{datos.email}</b>
            </p>

            {otroCorreo ? (
              <div className="mt-4">
                <p className="text-[0.88rem] leading-snug text-calor-hondo">
                  Estás con otra cuenta ({sesion?.usuario.email}). Salí y entrá
                  con <b className="break-all">{datos.email}</b> para aceptar.
                </p>
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="mt-3 w-full rounded-tarjeta bg-arena-2 px-6 py-3 font-semibold text-tinta transition hover:bg-linea"
                >
                  Cambiar de cuenta
                </button>
              </div>
            ) : haySesion() ? (
              <button
                type="button"
                onClick={aceptar}
                disabled={estado === "aceptando"}
                className="mt-5 w-full rounded-tarjeta bg-brasa px-6 py-3 font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99] disabled:opacity-50"
              >
                {estado === "aceptando" ? "Entrando…" : "Unirme"}
              </button>
            ) : (
              <>
                {/* SIN CUENTA: el camino normal de un mozo.
                    El panel NO tiene registro por correo —las cuentas nacen
                    con Google o desde la app—, así que se lo manda a entrar y
                    listo: si el correo no existe, Google la crea sola. El
                    token ya quedó en sessionStorage, y `destinoTrasEntrar` de
                    la pantalla de login lo trae de vuelta acá. */}
                <button
                  type="button"
                  onClick={() => router.replace("/")}
                  className="mt-5 w-full rounded-tarjeta bg-brasa px-6 py-3 font-semibold text-sobre-brasa transition hover:bg-brasa-hondo active:scale-[0.99]"
                >
                  Entrar y unirme
                </button>
                <p className="mt-2.5 text-[0.8rem] leading-snug text-frio">
                  Usá <b className="break-all">{datos.email}</b>: la invitación
                  no la acepta otro correo.
                </p>
              </>
            )}
          </div>
        )}

        {estado === "ok" && (
          <div className="surge">
            <h1 className="mt-6 text-2xl font-bold text-tinta">¡Listo! 🎉</h1>
            <p className="mt-2 text-tinta-2">
              {datos?.rol === "mozo"
                ? "Ya podés tomar pedidos. Entrando…"
                : "Ya estás en el equipo. Entrando…"}
            </p>
          </div>
        )}

        {estado === "error" && (
          <div className="surge">
            <h1 className="mt-6 text-2xl font-bold text-tinta">No pudimos sumarte</h1>
            <p className="mt-2 text-[0.95rem] leading-snug text-tinta-2">{mensaje}</p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-5 w-full rounded-tarjeta bg-arena-2 px-6 py-3 font-semibold text-tinta transition hover:bg-linea"
            >
              Ir al inicio
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
