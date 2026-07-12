"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { PlaybookEditor } from "@/components/panel/PlaybookEditor";
import { PanelCanales } from "@/components/panel/PanelCanales";
import { PlanConsumo } from "@/components/panel/PlanConsumo";

// Pantalla de Configuración del panel, organizada en pestañas para no apilar
// todo en una página larga: Tu negocio (playbook IA), Canales (WhatsApp) y
// Plan y consumo (saldo, comprar respuestas, límites).
type Tab = "negocio" | "canales" | "plan";

const TABS: { id: Tab; label: string }[] = [
  { id: "negocio", label: "Tu negocio" },
  { id: "canales", label: "Canales" },
  { id: "plan", label: "Plan y consumo" },
];

export default function ConfiguracionPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [tab, setTab] = useState<Tab>("negocio");

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Ajustes</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Configuración</h1>
      </header>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-linea">
        {TABS.map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-4 py-2.5 text-[0.92rem] font-semibold transition-colors ${
                activa ? "text-brasa" : "text-frio hover:text-tinta-2"
              }`}
              aria-current={activa ? "page" : undefined}
            >
              {t.label}
              {activa && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brasa" />
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido de la pestaña activa */}
      <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
        {tab === "negocio" && (
          <>
            <h2 className="text-[1.05rem] font-bold text-tinta">Tu negocio</h2>
            <p className="mb-4 text-[0.82rem] text-frio">
              El playbook que usa la IA para responder por vos: tono, catálogo, preguntas clave y objeciones.
            </p>
            <PlaybookEditor />
          </>
        )}

        {tab === "canales" && (
          <>
            <h2 className="text-[1.05rem] font-bold text-tinta">Tus redes</h2>
            <p className="mb-4 text-[0.82rem] text-frio">
              Conectá tus redes para que LeadAI atienda por vos en cada una.
            </p>
            <PanelCanales />
          </>
        )}

        {tab === "plan" && (
          <>
            <h2 className="text-[1.05rem] font-bold text-tinta">Tu plan y consumo</h2>
            <p className="mb-4 text-[0.82rem] text-frio">
              Cuánto te queda, cómo comprar más respuestas y cómo poner límites a tu gasto.
            </p>
            <PlanConsumo />
          </>
        )}
      </section>
    </div>
  );
}
