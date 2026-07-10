"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion } from "@/lib/auth";
import { hayGoogle, renderBotonGoogle } from "@/lib/google";
import { entrarConGoogle, entrarDemo } from "@/lib/sesion";
import { ApiError } from "@/lib/api";
import { IconoRayo, IconoGoogle } from "@/components/Iconos";

// Pantalla de entrada. Si ya hay sesión, va directo al panel. Si no, ofrece
// entrar con Google (cuando está configurado) o el modo demo para la reunión.
export default function Login() {
  const router = useRouter();
  const botonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Tras entrar: si el usuario aún no tiene un negocio, lo mandamos al
  // onboarding (/bienvenida); si ya tiene, al panel.
  function destinoTrasEntrar(): string {
    const sesion = leerSesion();
    return sesion && sesion.empresas.length > 0 ? "/inicio" : "/bienvenida";
  }

  useEffect(() => {
    if (haySesion()) {
      router.replace(destinoTrasEntrar());
      return;
    }
    if (hayGoogle() && botonRef.current) {
      renderBotonGoogle(botonRef.current, async (idToken) => {
        setCargando(true);
        setError(null);
        try {
          await entrarConGoogle(idToken);
          router.replace(destinoTrasEntrar());
        } catch (e) {
          setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesión");
          setCargando(false);
        }
      });
    }
  }, [router]);

  function entrarComoDemo() {
    entrarDemo();
    router.replace(destinoTrasEntrar());
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-7 pb-10 pt-[max(4rem,env(safe-area-inset-top))]">
      {/* Marca */}
      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brasa text-carta shadow-[0_8px_24px_rgba(226,92,67,0.35)]">
          <IconoRayo className="h-8 w-8" />
        </div>
        <h1 className="text-[2.6rem] leading-[1.05] font-bold text-tinta">
          Lead<span className="text-brasa">AI</span>
        </h1>
        <p className="mt-3 max-w-[19rem] text-[1.15rem] text-tinta-2">
          Tus leads, en un solo lugar. La IA atiende y te avisa{" "}
          <span className="font-bold text-brasa-hondo">justo cuándo entrar a cerrar</span>.
        </p>
      </div>

      {/* Acceso */}
      <div className="flex flex-col gap-3">
        {error && (
          <p className="rounded-tarjeta bg-brasa-suave px-4 py-3 text-[0.95rem] text-brasa-hondo">
            {error}
          </p>
        )}

        {hayGoogle() ? (
          <div ref={botonRef} className="flex justify-center" aria-busy={cargando} />
        ) : (
          <button
            onClick={entrarComoDemo}
            className="flex items-center justify-center gap-3 rounded-chip bg-carta px-6 py-3.5 text-[1.05rem] font-bold text-tinta shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition active:scale-[0.98]"
          >
            <IconoGoogle className="h-6 w-6" />
            Continuar con Google
          </button>
        )}

        {!hayGoogle() && (
          <p className="text-center text-[0.85rem] text-frio">
            Modo demostración · se conecta con Google al configurar la cuenta
          </p>
        )}

        <p className="mt-2 text-center text-[0.8rem] text-frio">
          Al continuar aceptás los términos de LeadAI.
        </p>
      </div>
    </main>
  );
}
