"use client";

/**
 * ENTRADA DESDE LA APP MÓVIL (2026-08-17).
 *
 * La app abre `/carta/<tenantId>` cuando el dueño toca "Carta y precios" en
 * Ajustes. El tenantId viaja en la URL porque el navegador no comparte sesión
 * con la app: sin él, alguien con tres negocios abriría el que quedó activo la
 * última vez que entró al panel y editaría la carta equivocada.
 *
 * Acá se adopta ese negocio como empresa activa y se redirige a /carta, que es
 * el editor de verdad.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { haySesion, leerSesion, guardarEmpresaActiva } from "@/lib/auth";
import { misEmpresas } from "@/lib/api";

export default function CartaDeNegocio() {
  const router = useRouter();
  const params = useParams<{ tenantId: string }>();
  const [ajeno, setAjeno] = useState(false);

  useEffect(() => {
    const tenantId = params.tenantId;
    if (!haySesion()) {
      // Sin sesión: al login, dejando anotado el destino para volver acá
      // después de entrar (lo consume `destinoTrasEntrar` en app/page.tsx).
      sessionStorage.setItem("volver_a", `/carta/${tenantId}`);
      router.replace("/");
      return;
    }

    // El negocio tiene que ser SUYO. Sin este chequeo, cambiar el id en la
    // barra de direcciones intentaría abrir la carta de otro — el backend lo
    // rechazaría, pero el dueño vería una pantalla rota en vez de un aviso.
    //
    // La lista de la SESIÓN es la del momento del login (2026-08-18): un
    // negocio creado después no está ahí, y el dueño veía "ese negocio no es
    // tuyo" para su propio negocio. Por eso se pregunta al backend, y la
    // sesión solo sirve de atajo cuando ya lo tiene.
    const sesion = leerSesion();
    if (sesion?.empresas.some((e) => e.tenantId === tenantId)) {
      guardarEmpresaActiva(tenantId);
      router.replace("/carta");
      return;
    }

    let vivo = true;
    void misEmpresas().then((empresas) => {
      if (!vivo) return;
      if (empresas.some((e) => e.tenantId === tenantId)) {
        guardarEmpresaActiva(tenantId);
        router.replace("/carta");
      } else {
        setAjeno(true);
      }
    });
    return () => { vivo = false; };
  }, [params.tenantId, router]);

  if (ajeno) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-[1.05rem] font-bold text-tinta">Ese negocio no es tuyo</p>
        <p className="mt-1 text-[0.9rem] text-frio">
          Entra con la cuenta que lo administra, o elige otro desde el panel.
        </p>
        <button
          onClick={() => router.replace("/inicio")}
          className="mt-5 rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-sobre-brasa hover:bg-brasa-hondo"
        >
          Ir al panel
        </button>
      </div>
    );
  }

  return null;
}
