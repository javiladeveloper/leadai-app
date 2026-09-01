"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion, esModoGlobal } from "@/lib/auth";
import { useCapacidades } from "@/lib/modo-negocio";
import { InicioRestaurante } from "@/components/panel/InicioRestaurante";
import { InicioCaptacion } from "@/components/panel/InicioCaptacion";
import { SkeletonMetricas } from "@/components/Skeletons";

/**
 * QUÉ INICIO LE TOCA A ESTE NEGOCIO (2026-08-31).
 *
 * ESTE ARCHIVO NO DIBUJA NADA: elige. Es un dispatcher, el mismo patrón que
 * `core/leads.ts` usa para rutear un mensaje al módulo de su rubro.
 *
 * ANTES ERA UNA SOLA PANTALLA CON `!modoPedidos` REPETIDO EN CADA BLOQUE, y eso
 * escondía que son dos pantallas enteras y distintas: no comparten ni las
 * métricas, ni las llamadas al backend, ni los accesos rápidos. Un restaurante
 * veía "leads calientes sin atender" y accesos a secciones que ni están en su
 * menú.
 *
 * ES UN STRATEGY Y NO UN TERNARIO porque lo que varía es la pantalla ENTERA. La
 * regla para saber cuál toca: si dos ramas comparten el layout y cambian un
 * texto, es un `if`; si cambian todo, son dos componentes.
 *
 * SE PREGUNTA POR CAPACIDAD, NO POR RUBRO. `tieneCarta` y no "¿es
 * gastronomía?": el día que aparezca otro rubro que venda por carta, entra acá
 * solo. Es lo que el diseño pide — "agregar el rubro nº5 es una fila, no una
 * cacería de ifs".
 *
 * Y ESTA PANTALLA LA VEN LOS TRES PRODUCTOS: una clínica de Sania y un gimnasio
 * de FitCore caen en `InicioCaptacion`, porque `leadai-app` es el único panel
 * web que existe. Ver `docs/ARQUITECTURA-ECOSISTEMA.md` en el backend.
 */
export default function InicioPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const negocio = useCapacidades();

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // En modo global el Inicio es el dashboard /global (métricas y bandeja de
    // TODOS los negocios); este Inicio es el de UNA empresa.
    if (esModoGlobal()) {
      router.replace("/global");
      return;
    }
    setListo(true);
  }, [router]);

  if (!listo) return null;

  // TODAVÍA NO SE SABE QUÉ NEGOCIO ES. Se espera antes de pintar en vez de
  // asumir uno: dibujar el inicio equivocado y cambiarlo un segundo después es
  // peor que un skeleton. Mismo criterio que el sidebar.
  /**
   * EL CONTENEDOR ES DEL DISPATCHER, no de cada pantalla.
   *
   * Al separar las dos pantallas quedó acá un bug: `InicioCaptacion` se llevó el
   * `max-w-5xl` en la extracción y `InicioRestaurante` —que ya existía como
   * componente— nunca lo tuvo, porque lo heredaba de la página. Resultado: el
   * inicio de restaurante se dibujaba a lo ancho de la ventana y el header
   * oscuro se salía por la derecha.
   *
   * Poniéndolo acá, las dos pantallas quedan iguales sin que ninguna tenga que
   * acordarse — y una tercera lo hereda gratis.
   */
  return (
    <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8">
      {!negocio ? (
        <SkeletonMetricas />
      ) : negocio.capacidades.tieneCarta ? (
        <InicioRestaurante />
      ) : (
        <InicioCaptacion />
      )}
    </div>
  );
}
