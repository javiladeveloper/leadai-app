"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { entrarConEnlace } from "@/lib/sesion";
import { ApiError } from "@/lib/api";
import { vaciarCache } from "@/lib/cache-datos";
import { precalentarCapacidades } from "@/lib/modo-negocio";
import { destinoSeguro } from "@/lib/enlaces";
import { LogoLeadAI } from "@/components/LogoLeadAI";

/**
 * ENTRAR A LA WEB DESDE LA APP (2026-10-09, tanda "web").
 *
 * En la app hay botones que llevan a la web (Reportes, Marketing, la ficha
 * completa…). Antes abrían el navegador en la pantalla de login, y la persona
 * tenía que volver a escribir su correo en el teléfono. Ahora la app pide al
 * backend un enlace de UN SOLO USO que dura dos minutos y abre:
 *
 *   /entrar?enlace=<token>&destino=/conversaciones?lead=…
 *
 * Acá se canjea (`POST /auth/enlace-web/canjear`), se guarda la sesión con el
 * mismo código que el login con contraseña, y se va al destino — SOLO si es
 * una ruta del panel (`destinoSeguro`, lib/enlaces.ts); si no, a /inicio.
 *
 * Sin `?enlace=`: con sesión, directo al destino; sin sesión, al login, que
 * vuelve al destino al terminar (`volver_a`, ver app/page.tsx).
 */
export default function Entrar() {
  return (
    <Suspense fallback={<Pantalla><Esperando /></Pantalla>}>
      <EntrarInner />
    </Suspense>
  );
}

// Un token se canjea UNA vez. En desarrollo React monta el efecto dos veces:
// la segunda pasada se cuelga del MISMO canje en vez de pedir otro (que daría
// "ya se usó" justo después de haber entrado).
const canjes = new Map<string, Promise<unknown>>();

function EntrarInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("enlace");
  const destino = destinoSeguro(params.get("destino"));
  const [estado, setEstado] = useState<"entrando" | "vencido" | "fallo">("entrando");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!token) {
      if (haySesion()) {
        router.replace(destino);
      } else {
        try { sessionStorage.setItem("volver_a", destino); } catch { /* sin storage: el login decide */ }
        router.replace("/");
      }
      return;
    }
    let vivo = true;
    let canje = canjes.get(token);
    if (!canje) {
      // Lo que quedó de OTRA cuenta en este navegador (datos en memoria) no
      // puede verse en esta. Se limpia recién cuando el canje salió bien: un
      // enlace vencido no tiene por qué sacar a quien ya estaba adentro.
      canje = entrarConEnlace(token).then((sesion) => { vaciarCache(); return sesion; });
      canjes.set(token, canje);
    }
    canje
      .then(() => {
        if (!vivo) return;
        precalentarCapacidades();
        router.replace(destino);
      })
      .catch((e) => {
        if (!vivo) return;
        // 400/401/404: el enlace no sirve (vencido, usado o mal copiado).
        // Otro error (sin red, servidor caído): se puede reintentar.
        // Demasiados intentos (429) también se puede reintentar.
        setEstado(e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 429 ? "vencido" : "fallo");
      });
    return () => { vivo = false; };
  }, [token, destino, router, intento]);

  return (
    <Pantalla>
      {estado === "entrando" && <Esperando />}
      {estado === "vencido" && (
        <div className="space-y-4" role="alert">
          <h1 className="text-[1.3rem] font-bold text-tinta">El enlace venció o ya se usó</h1>
          <p className="text-[1rem] text-tinta-2">
            Vuelve a abrirlo desde la app: cada enlace sirve una sola vez y dura dos minutos.
          </p>
          {/* Si ya había una sesión en este navegador, se puede seguir con
              ella; si no, al login, que vuelve al destino al terminar. */}
          <Link
            href={haySesion() ? destino : "/"}
            onClick={() => { if (!haySesion()) { try { sessionStorage.setItem("volver_a", destino); } catch { /* sin storage */ } } }}
            className="inline-flex w-full items-center justify-center rounded-tarjeta bg-brasa px-6 py-3 text-[1rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
          >
            {haySesion() ? "Ir a mi panel" : "Entrar con mi cuenta"}
          </Link>
        </div>
      )}
      {estado === "fallo" && (
        <div className="space-y-4" role="alert">
          <h1 className="text-[1.3rem] font-bold text-tinta">No pudimos conectar</h1>
          <p className="text-[1rem] text-tinta-2">Revisa tu conexión e inténtalo otra vez.</p>
          <button
            type="button"
            onClick={() => { if (token) canjes.delete(token); setEstado("entrando"); setIntento((n) => n + 1); }}
            className="w-full rounded-tarjeta bg-brasa px-6 py-3 text-[1rem] font-bold text-sobre-brasa transition hover:bg-brasa-hondo"
          >
            Reintentar
          </button>
          <Link href="/" className="block text-[0.9rem] font-semibold text-brasa-texto underline-offset-2 hover:underline">
            Entrar con mi cuenta
          </Link>
        </div>
      )}
    </Pantalla>
  );
}

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[376px] flex-col items-center justify-center gap-8 px-7 text-center">
      <LogoLeadAI className="h-14 w-14" />
      <div className="w-full">{children}</div>
    </main>
  );
}

function Esperando() {
  return (
    <div className="flex items-center justify-center gap-3" role="status">
      <span className="text-[1.05rem] font-bold text-tinta">Entrando a tu panel</span>
      <span className="flex items-end gap-1 pb-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="punto-espera h-1.5 w-1.5 rounded-full bg-tinta-2" style={{ ["--i" as string]: i }} />
        ))}
      </span>
    </div>
  );
}
