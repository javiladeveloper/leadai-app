"use client";

import { useEffect, useState } from "react";
import { obtenerMiPlan } from "@/lib/api";
import { Seccion } from "@/components/panel/Seccion";
import { TarjetaSwitch } from "@/components/panel/PlanConsumo";

/**
 * EL INTERRUPTOR PRINCIPAL, DONDE EL DUEÑO LO BUSCA (2026-08-31).
 *
 * Vivía en "Plan y consumo" —junto al saldo y los paquetes de mensajes— y ahí
 * no lo encuentra nadie: quien quiere prender o apagar su bot entra a la
 * pestaña **Bot**, no a la de facturación.
 *
 * Se vuelve urgente porque desde hoy **el bot nace apagado** (planteado por
 * Jonathan: "no solo necesitamos la conexión sino también configurarlo"). Con
 * la conexión de WhatsApp dentro del alta, el número puede quedar conectado
 * con la carta a medio cargar; si el bot arrancara encendido, el primer
 * cliente recibiría respuestas de un negocio que todavía no existe.
 *
 * Pero un bot que nace apagado y cuyo interruptor está escondido en otra
 * pestaña es un bot que no se enciende nunca. Este componente cierra eso.
 *
 * Sigue estando también en Plan y consumo: quien ya lo conocía ahí lo
 * encuentra igual.
 */
export function InterruptorBot() {
  const [cargando, setCargando] = useState(true);
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    obtenerMiPlan()
      .then((p) => {
        if (!vivo) return;
        if (p) setActivo(p.botActivo);
        else setError(true);
        setCargando(false);
      })
      .catch(() => {
        if (!vivo) return;
        setError(true);
        setCargando(false);
      });
    return () => { vivo = false; };
  }, []);

  return (
    <Seccion
      titulo="¿Tu bot está atendiendo?"
      bajada="Préndelo cuando termines de configurarlo. Nace apagado para que nadie reciba respuestas a medias."
      tono="hondo"
    >
      <TarjetaSwitch
        cargando={cargando}
        valorInicial={activo}
        error={error}
        campo="botActivo"
        aria="¿Tu bot está atendiendo?"
        textoOn="Activo — el bot responde a tus clientes"
        textoOff="Apagado — los mensajes te llegan, pero contestas tú"
        subtextoOn="Apágalo un momento si quieres atender tú mismo, sin que el bot conteste."
        subtextoOff="Los mensajes se siguen guardando y los ves en Conversaciones; el bot no contesta hasta que lo actives."
      />
    </Seccion>
  );
}
