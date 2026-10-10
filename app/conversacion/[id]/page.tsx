"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkeletonChat } from "@/components/Skeletons";

/**
 * LA FICHA VIEJA DEL LEAD AHORA REDIRIGE (2026-10-09).
 *
 * Esta pantalla vivía fuera del panel (sin menú ni cabecera) y le faltaba la
 * mitad de lo que sí tenía la ficha de Conversaciones: etapa, asignación,
 * etiquetas, bot ON/OFF, de dónde vino, "Marcar que pagó". Ahora hay UNA sola
 * ficha, la de `/conversaciones?lead=<id>`, con todo lo de acá incluido
 * (llamar/WhatsApp, editar el nombre, frases rápidas, lo que ofreces).
 *
 * La ruta NO se borra: los avisos de WhatsApp del backend mandan links a
 * `/conversacion/{id}`, y un link guardado no puede terminar en 404. El
 * redirect principal está en `next.config.ts`; este cubre la navegación
 * dentro de la app. El `?negocio=` (si vino) se conserva.
 */
export default function ConversacionVieja({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    qs.set("lead", id);
    router.replace(`/conversaciones?${qs.toString()}`);
  }, [id, router]);
  return (
    <div className="min-h-dvh bg-arena" aria-busy="true" aria-label="Abriendo la conversación">
      <SkeletonChat />
    </div>
  );
}
