"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, leerSesion } from "@/lib/auth";
import { crearEmpresa } from "@/lib/api";
import { IconoRayo } from "@/components/Iconos";

// Onboarding: primer ingreso de un cliente sin empresa. Le pedimos SOLO el
// nombre de su negocio; el resto del perfil lo completa después en Configuración.
export default function BienvenidaPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState<"idle" | "creando" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // Si ya tiene empresa, no corresponde el onboarding: al panel.
    const sesion = leerSesion();
    if (sesion && sesion.empresas.length > 0) {
      router.replace("/inicio");
      return;
    }
    setListo(true);
  }, [router]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    setEstado("creando");
    setError("");
    const r = await crearEmpresa(limpio);
    if (r.ok) {
      router.replace("/inicio");
    } else {
      setEstado("error");
      setError(r.error ?? "No se pudo crear tu negocio. Intentá de nuevo.");
    }
  }

  if (!listo) return null;

  const primerNombre = leerSesion()?.usuario.nombre?.split(" ")[0] ?? "";

  return (
    <div className="grid min-h-dvh place-items-center bg-arena px-5">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brasa text-carta">
            <IconoRayo className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold text-tinta">
            Lead<span className="text-brasa">AI</span>
          </span>
        </div>

        <h1 className="mt-8 text-[1.8rem] font-bold leading-tight text-tinta">
          ¡Bienvenido{primerNombre ? `, ${primerNombre}` : ""}! 👋
        </h1>
        <p className="mt-2 text-[1.02rem] text-tinta-2">
          Para empezar, contanos cómo se llama tu negocio.
        </p>

        <form onSubmit={crear} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-tinta">
              Nombre de tu negocio
            </span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
              placeholder="Ej: Estudio Contable Vega"
              className="w-full rounded-tarjeta border border-linea bg-carta px-4 py-3 text-[1rem] text-tinta outline-none transition focus:border-brasa"
            />
          </label>

          {estado === "error" && (
            <p className="rounded-xl bg-brasa-suave px-4 py-2.5 text-sm font-medium text-brasa-hondo">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={estado === "creando" || !nombre.trim()}
            className="w-full rounded-tarjeta bg-brasa px-6 py-3.5 text-[1rem] font-semibold text-carta transition hover:bg-brasa-hondo active:scale-[0.99] disabled:opacity-60"
          >
            {estado === "creando" ? "Creando tu negocio…" : "Crear mi negocio"}
          </button>

          <p className="text-center text-[0.82rem] text-frio">
            Después vas a poder ajustar todo desde Configuración.
          </p>
        </form>
      </div>
    </div>
  );
}
