// ¿QUÉ CLASE DE NEGOCIO ES ESTE? (2026-08-17)
//
// Un restaurante y un negocio de captación usan LeadAI para cosas distintas, y
// el menú lo tiene que reflejar: al de comida no le sirven Anuncios, Flujos ni
// Oportunidades — su trabajo es la carta, los pedidos y el chat.
//
// La señal es `modoPedidos` del tenant, la MISMA que ya usa la app móvil para
// decidir qué muestra en Ajustes. No se inventa una noción nueva de "plan": si
// alguna vez hay planes de verdad, este es el lugar donde se resuelven.

"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { leerEmpresaActiva } from "./auth";

interface ConfigPedidos {
  modoPedidos: boolean;
}

/** Cache por tenant: el sidebar se remonta en cada navegación y no puede
 *  pedir esto de nuevo cada vez (parpadeo del menú entero). */
const cache = new Map<string, boolean>();

/**
 * `true` si el negocio activo toma pedidos (restaurante).
 *
 * Devuelve `null` mientras no se sabe — quien lo use tiene que tratar ese
 * caso, porque asumir `false` haría parpadear el menú largo antes de acortarse.
 */
export function useModoPedidos(): boolean | null {
  const tenant = typeof window !== "undefined" ? leerEmpresaActiva() : null;
  const [modo, setModo] = useState<boolean | null>(
    tenant && cache.has(tenant) ? cache.get(tenant)! : null,
  );

  useEffect(() => {
    if (!tenant) { setModo(null); return; }
    if (cache.has(tenant)) { setModo(cache.get(tenant)!); return; }

    let vivo = true;
    api<{ config: ConfigPedidos | null }>("/pedidos-config")
      .then((r) => {
        const esPedidos = r.config?.modoPedidos ?? false;
        cache.set(tenant, esPedidos);
        if (vivo) setModo(esPedidos);
      })
      // Si falla, NO se acorta el menú: dejar a alguien sin sus secciones por
      // un error de red es peor que mostrarle una de más.
      .catch(() => { if (vivo) setModo(false); });

    return () => { vivo = false; };
  }, [tenant]);

  return modo;
}

/** Se llama al cambiar de negocio o al cambiar el modo en Configuración. */
export function olvidarModoPedidos(tenant?: string): void {
  if (tenant) cache.delete(tenant);
  else cache.clear();
}
