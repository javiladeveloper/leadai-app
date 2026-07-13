"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { aceptarInvitacion } from "@/lib/api";
import { IconoRayo } from "@/components/Iconos";

// Pantalla que abre el trabajador desde el enlace de invitación. Si no tiene
// sesión, lo mandamos a login guardando el token para retomar. Si tiene sesión,
// acepta la invitación y entra al negocio.
export default function InvitacionPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<"cargando" | "ok" | "error" | "sin-sesion">("cargando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setEstado("error"); setMensaje("Enlace de invitación inválido."); return; }

    if (!haySesion()) {
      // Guardamos el token para aceptar después del login.
      sessionStorage.setItem("invitacion_token", token);
      setEstado("sin-sesion");
      return;
    }

    aceptarInvitacion(token).then((r) => {
      if (r.ok) {
        setEstado("ok");
        setTimeout(() => router.replace("/inicio"), 1500);
      } else {
        setEstado("error");
        setMensaje(r.error ?? "No se pudo aceptar la invitación.");
      }
    });
  }, [router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-arena px-5">
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brasa text-carta">
          <IconoRayo className="h-8 w-8" />
        </span>

        {estado === "cargando" && <p className="mt-6 text-tinta-2">Procesando tu invitación…</p>}

        {estado === "ok" && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-tinta">¡Bienvenido al equipo! 🎉</h1>
            <p className="mt-2 text-tinta-2">Ya podés atender los leads del negocio. Entrando…</p>
          </>
        )}

        {estado === "sin-sesion" && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-tinta">Te invitaron a un equipo</h1>
            <p className="mt-2 text-tinta-2">Iniciá sesión para unirte al negocio.</p>
            <button
              onClick={() => router.replace("/")}
              className="mt-6 w-full rounded-tarjeta bg-brasa px-6 py-3 font-semibold text-carta transition hover:bg-brasa-hondo"
            >
              Iniciar sesión
            </button>
          </>
        )}

        {estado === "error" && (
          <>
            <h1 className="mt-6 text-2xl font-bold text-tinta">No pudimos sumarte</h1>
            <p className="mt-2 text-brasa-hondo">{mensaje}</p>
          </>
        )}
      </div>
    </div>
  );
}
