"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { PlaybookEditor } from "@/components/panel/PlaybookEditor";
import ConectarWhatsApp from "@/components/ConectarWhatsApp";
import { PlanConsumo } from "@/components/panel/PlanConsumo";

// Pantalla de Configuración del panel de escritorio: el Playbook real que usa
// la IA (conectado a /perfil) y la conexión de canales (WhatsApp).
export default function ConfiguracionPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);

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

      <div className="grid gap-6">
        <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
          <h2 className="text-[1.05rem] font-bold text-tinta">Tu negocio</h2>
          <p className="mb-4 text-[0.82rem] text-frio">
            El playbook que usa la IA para responder por vos: tono, catálogo, preguntas clave y objeciones.
          </p>
          <PlaybookEditor />
        </section>

        <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
          <h2 className="text-[1.05rem] font-bold text-tinta">Tus canales</h2>
          <p className="mb-4 text-[0.82rem] text-frio">
            Conectá WhatsApp para que LeadAI atienda por vos.
          </p>
          <ConectarWhatsApp />
        </section>

        <section className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea lg:p-6">
          <h2 className="text-[1.05rem] font-bold text-tinta">Tu plan y consumo</h2>
          <p className="mb-4 text-[0.82rem] text-frio">
            Cuánto te queda, cómo comprar más respuestas y cómo poner límites a tu gasto.
          </p>
          <PlanConsumo />
        </section>
      </div>
    </div>
  );
}
