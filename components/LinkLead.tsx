"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { guardarEmpresaActiva, puedeAbrirConversacion } from "@/lib/auth";
import { urlLead } from "@/lib/enlaces";

/**
 * ABRIR LA FICHA DE UN LEAD, DESDE CUALQUIER PANTALLA (2026-10-09).
 *
 * Había trece links escritos a mano a `/conversacion/${id}` y cada uno se
 * olvidaba de algo distinto:
 *  - Comentarios, "De dónde te escriben" y el rendimiento de los posts NO
 *    fijaban el negocio: con varios negocios, la ficha preguntaba por el lead
 *    en el negocio equivocado y decía "No encontramos esta conversación".
 *  - Algunos sí respetaban que el puesto de MARKETING no abre conversaciones
 *    (el backend le da 403) y otros lo mandaban a una pantalla de error.
 *
 * Ahora es uno solo: respeta el permiso, fija el negocio cuando se conoce y
 * lleva a la ficha única (`/conversaciones?lead=`).
 */
export function useAbrirLead(): (id: string, tenant?: string | null) => boolean {
  const router = useRouter();
  return useCallback((id: string, tenant?: string | null) => {
    if (!puedeAbrirConversacion()) return false;
    if (tenant) guardarEmpresaActiva(tenant);
    router.push(urlLead(id, { tenant }));
    return true;
  }, [router]);
}

export function LinkLead({
  id,
  tenant,
  className,
  claseSinPermiso,
  children,
  titulo,
}: {
  id: string;
  /** El negocio del lead, si se conoce. Sin él se usa la empresa activa. */
  tenant?: string | null;
  className?: string;
  /** Cómo se ve cuando este puesto no puede abrir conversaciones (por defecto, igual pero sin link). */
  claseSinPermiso?: string;
  children: React.ReactNode;
  titulo?: string;
}) {
  // Sin permiso NO se envuelve en link: una tarjeta que navega a un 403 se lee
  // como que el producto está roto, no como un permiso que no se tiene.
  if (!puedeAbrirConversacion()) {
    return <span className={claseSinPermiso ?? className}>{children}</span>;
  }
  return (
    <Link
      href={urlLead(id, { tenant })}
      title={titulo}
      // Se fija ANTES de navegar: la ficha lee la empresa activa al montar.
      onClick={() => { if (tenant) guardarEmpresaActiva(tenant); }}
      className={className}
    >
      {children}
    </Link>
  );
}
