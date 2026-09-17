"use client";

import { useEffect, useState } from "react";
import { leerSesion, leerEmpresaActiva } from "@/lib/auth";

/**
 * SOPORTE MIENTRAS ESTÁS APRENDIENDO (2026-09-17, pedido de Jonathan: "una
 * persona entró por la web y creó su clínica, no sé si es uno de los que nos
 * escribió... debería quedar en algún lado el soporte para que nos escriba").
 *
 * EL PROBLEMA ES REAL Y SE VE EN LOS DATOS: de las cinco altas de esta semana,
 * NINGUNA prendió el bot y cuatro tienen cero leads. Se registraron y se
 * trabaron en algún punto, y hoy el panel no tiene un solo lugar donde pedir
 * ayuda —ni un correo, ni un número.
 *
 * VA A UN HUMANO, NO A UN BOT (decisión de Jonathan). Con cinco altas, un
 * agente automático taparía justo lo que hay que ver: si cinco personas se
 * atascan en el mismo paso, eso es información de producto, y un bot que
 * conteste "andá a Ajustes" la haría desaparecer. Cuando las mismas preguntas
 * se repitan cincuenta veces, ahí tendrá sentido automatizar.
 *
 * 30 DÍAS, atados a la prueba gratis. Después el botón se va: quien ya lleva
 * un mes usando el panel sabe moverse, y un botón permanente termina siendo
 * parte del decorado.
 */

/** A quién le llegan las consultas. El WhatsApp de Jonathan. */
const SOPORTE = "51940202780";

/** Cuántos días desde el alta se ofrece el acompañamiento. */
const DIAS_ACOMPANAMIENTO = 30;

/** Para que no reaparezca en cada pantalla si ya lo cerró hoy. */
const CLAVE_CERRADO = "leadai.soporte.cerrado";

export function BotonSoporte() {
  const [visible, setVisible] = useState(false);
  const [negocio, setNegocio] = useState("");
  const [dias, setDias] = useState(0);

  useEffect(() => {
    // En el servidor no hay sesión ni localStorage: todo esto corre al montar.
    const sesion = leerSesion();
    if (!sesion) return;

    const activa = leerEmpresaActiva();
    const empresa =
      sesion.empresas?.find((e) => e.tenantId === activa) ?? sesion.empresas?.[0];
    if (!empresa?.creadoEn) return; // sesión vieja sin el campo: no se muestra

    const desde = new Date(empresa.creadoEn).getTime();
    if (Number.isNaN(desde)) return;
    const pasados = Math.floor((Date.now() - desde) / 86_400_000);
    if (pasados >= DIAS_ACOMPANAMIENTO) return;

    try {
      if (localStorage.getItem(CLAVE_CERRADO) === hoy()) return;
    } catch {
      // Modo incógnito o storage bloqueado: se muestra igual. Perder el
      // "cerrado" es mejor que no ofrecer ayuda a quien la necesita.
    }

    setNegocio(empresa.nombre ?? "");
    setDias(DIAS_ACOMPANAMIENTO - pasados);
    setVisible(true);
  }, []);

  if (!visible) return null;

  // El mensaje va PRECARGADO con el negocio: sin esto la conversación arranca
  // con "hola, ¿quién sos?" y se pierde el primer intercambio averiguando algo
  // que ya sabemos.
  const texto = encodeURIComponent(
    `Hola, soy de ${negocio || "un negocio en LeadAI"} y necesito ayuda con el panel.`,
  );
  const enlace = `https://wa.me/${SOPORTE}?text=${texto}`;

  function cerrar() {
    setVisible(false);
    // Por HOY, no para siempre: quien lo cierra hoy puede necesitarlo mañana,
    // y justamente esos primeros días son cuando aparecen las dudas.
    try { localStorage.setItem(CLAVE_CERRADO, hoy()); } catch { /* sin storage */ }
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex items-end gap-2 lg:bottom-6">
      <a
        href={enlace}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-full bg-brasa px-4 py-3 text-[0.86rem] font-bold text-sobre-brasa shadow-lg transition hover:opacity-90"
      >
        <span aria-hidden className="text-[1.1rem]">💬</span>
        <span className="hidden sm:inline">¿Dudas? Escribinos</span>
        <span className="sm:hidden">Ayuda</span>
      </a>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Ocultar el botón de ayuda por hoy"
        title={`Te acompañamos ${dias} ${dias === 1 ? "día" : "días"} más`}
        className="rounded-full bg-carta px-2 py-2 text-[0.8rem] font-bold text-frio shadow ring-1 ring-linea transition hover:text-tinta"
      >
        ✕
      </button>
    </div>
  );
}

/** La fecha de hoy, para que el "cerrado" dure un día y no para siempre. */
function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
