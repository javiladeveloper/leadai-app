"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Mi perfil" ahora vive dentro de Configuración (pestaña "Mi perfil" — es de
// la persona, no de un negocio). Esta ruta queda solo por compatibilidad con
// enlaces viejos.
export default function MiPerfilPanel() {
  const router = useRouter();
  useEffect(() => { router.replace("/configuracion?tab=perfil"); }, [router]);
  return null;
}
