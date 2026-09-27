"use client";

// "MI CALENDARIO" (2026-09-26): el Google Calendar de la PERSONA, donde el bot
// agenda las reuniones de todos sus negocios. Vive como pestaña de
// Configuración (sin chips de negocio, como "Mi perfil") y también en la
// Configuración reducida de la operadora de un negocio exportado.
//
// LA CONEXIÓN SE CONFIRMA DESDE ACÁ. Google no conecta directo: devuelve a
// `?tab=calendario&pendiente=<id>` y el panel lo confirma con la sesión puesta
// (así nadie puede colgar su Google en la cuenta de otro con un enlace).

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError, obtenerCalendario, urlConectarCalendario, confirmarCalendario, guardarVentanaCalendario,
  desconectarCalendario, type EstadoCalendario, type VentanaAgenda,
} from "@/lib/api";
import { avisoConfirmacionCalendario } from "@/lib/agenda";
import { Seccion } from "@/components/panel/Seccion";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const inputCls =
  "rounded-tarjeta border border-linea bg-carta px-3 py-2 text-[0.95rem] text-tinta outline-none focus:border-brasa";
const botonPrimario =
  "rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60";
const botonSecundario =
  "rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-linea disabled:opacity-60";

type Aviso = { tipo: "ok" | "error"; texto: string };

function avisoDeRetorno(resultado: string | null): Aviso | null {
  if (resultado === "cancelado") return { tipo: "error", texto: "No se conectó: cancelaste en Google." };
  if (resultado === "error") return { tipo: "error", texto: "No se pudo conectar con Google. Inténtalo de nuevo." };
  return null;
}

export function MiCalendario() {
  const router = useRouter();
  const params = useSearchParams();
  const [estado, setEstado] = useState<EstadoCalendario | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [ventana, setVentana] = useState<VentanaAgenda | null>(null);
  // Si Google volvió con `?calendario=cancelado|error`, el aviso nace de la
  // URL (y no de un setState dentro del efecto).
  const [aviso, setAviso] = useState<Aviso | null>(() => avisoDeRetorno(params.get("calendario")));
  const [ocupado, setOcupado] = useState(false);
  // El pendiente que ya se mandó a confirmar: el modo estricto de React corre
  // los efectos dos veces, y el pendiente es de UN solo uso (el segundo
  // intento daría "venció" encima del "Listo").
  const confirmado = useRef<string | null>(null);
  // Cada carga lleva número: si una vieja llega tarde (la de antes de
  // confirmar), no pisa a la nueva.
  const cargaActual = useRef(0);

  // Los setState van en los callbacks de la promesa (nunca síncronos): así
  // se puede llamar desde el efecto sin renders en cascada.
  function cargar(): Promise<void> {
    const n = ++cargaActual.current;
    return obtenerCalendario().then(
      (e) => {
        if (n !== cargaActual.current) return;
        setEstado(e);
        setVentana(e.ventana);
        setErrorCarga(false);
      },
      () => {
        if (n === cargaActual.current) setErrorCarga(true);
      },
    );
  }

  useEffect(() => {
    const pendiente = params.get("pendiente");
    const resultado = params.get("calendario");

    if (pendiente) {
      if (confirmado.current === pendiente) return;
      confirmado.current = pendiente;
      void (async () => {
        try {
          const r = await confirmarCalendario(pendiente);
          setAviso({ tipo: "ok", texto: `Listo: tu Google Calendar (${r.correo}) quedó conectado.` });
        } catch (e) {
          const status = e instanceof ApiError ? e.status : 0;
          setAviso({ tipo: "error", texto: avisoConfirmacionCalendario(status, (e as Error).message) });
        }
        // Se limpia la URL para que recargar la página no reintente.
        router.replace("/configuracion?tab=calendario");
        await cargar();
      })();
      return;
    }

    // `?calendario=cancelado|error`: el aviso ya salió del estado inicial;
    // acá solo se limpia la URL (el cambio vuelve a correr esto y ahí carga).
    if (resultado) {
      router.replace("/configuracion?tab=calendario");
      return;
    }
    void cargar();
  }, [params, router]);

  async function conectar() {
    setOcupado(true);
    setAviso(null);
    try {
      window.location.href = await urlConectarCalendario();
    } catch (e) {
      setAviso({
        tipo: "error",
        texto: e instanceof ApiError && e.status === 503
          ? "La conexión con Google todavía no está habilitada."
          : (e as Error).message,
      });
      setOcupado(false);
    }
  }

  async function guardar() {
    if (!ventana) return;
    setOcupado(true);
    setAviso(null);
    try {
      await guardarVentanaCalendario(ventana);
      setAviso({ tipo: "ok", texto: "Horario guardado." });
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
    }
    setOcupado(false);
  }

  async function desconectar() {
    if (!confirm("¿Desconectar tu Google Calendar? El bot dejará de agendar en él.")) return;
    setOcupado(true);
    setAviso(null);
    try {
      await desconectarCalendario();
      setAviso({ tipo: "ok", texto: "Tu Google Calendar quedó desconectado." });
    } catch (e) {
      setAviso({ tipo: "error", texto: (e as Error).message });
    }
    await cargar();
    setOcupado(false);
  }

  const avisoUi = aviso && (
    <p
      role="status"
      className={`rounded-tarjeta bg-carta px-4 py-3 text-[0.88rem] font-semibold ring-1 ring-linea ${
        aviso.tipo === "ok" ? "text-ok" : "text-brasa-hondo"
      }`}
    >
      {aviso.texto}
    </p>
  );

  if (errorCarga && !estado) {
    return (
      <div className="space-y-5">
        {avisoUi}
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar tu calendario.</p>
          <button type="button" onClick={() => void cargar()} className={`mt-3 ${botonSecundario}`}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Skeleton con la forma real, como el resto de Configuración.
  if (!estado || !ventana) {
    return (
      <div className="space-y-5">
        {avisoUi}
        <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />
      </div>
    );
  }

  const horarioValido = ventana.dias.length > 0 && ventana.desde < ventana.hasta;

  return (
    <div className="space-y-5">
      {avisoUi}

      <Seccion
        titulo="Google Calendar"
        bajada="El bot agenda las reuniones en tu calendario y mira lo que ya tienes, en todos tus negocios, para no cruzar horarios."
        acento
      >
        {estado.conectado ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="min-w-0 text-[0.92rem] text-tinta">
              {estado.estado === "caida" ? (
                <>
                  <span className="font-semibold text-brasa-hondo">Se cortó el permiso de </span>
                  <b>{estado.correo}</b>. El bot no puede agendar hasta que lo reconectes.
                </>
              ) : (
                <>
                  <span className="font-semibold text-ok">Conectado:</span> <b>{estado.correo}</b>
                </>
              )}
            </span>
            {estado.estado === "caida" && (
              <button type="button" className={botonPrimario} onClick={conectar} disabled={ocupado}>
                Reconectar
              </button>
            )}
            <button type="button" className={botonSecundario} onClick={desconectar} disabled={ocupado}>
              Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button type="button" className={botonPrimario} onClick={conectar} disabled={ocupado || !estado.disponible}>
              {ocupado ? "Abriendo Google…" : "Conectar Google Calendar"}
            </button>
            {!estado.disponible && (
              <p className="text-[0.82rem] text-frio">La conexión con Google todavía no está habilitada.</p>
            )}
          </div>
        )}
      </Seccion>

      {estado.conectado && (
        <Seccion
          titulo="Cuándo puede agendar el bot"
          bajada="Los días y el horario en que el bot ofrece reuniones. Fuera de esto, no agenda."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d, i) => {
                const activo = ventana.dias.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={activo}
                    onClick={() =>
                      setVentana({
                        ...ventana,
                        dias: activo ? ventana.dias.filter((x) => x !== i) : [...ventana.dias, i].sort((a, b) => a - b),
                      })
                    }
                    className={`rounded-chip px-3 py-1.5 text-[0.82rem] font-semibold transition ${
                      activo ? "bg-brasa text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[0.9rem] text-tinta">
              <label className="flex items-center gap-2">
                Desde
                <input type="time" value={ventana.desde} onChange={(e) => setVentana({ ...ventana, desde: e.target.value })} className={inputCls} />
              </label>
              <label className="flex items-center gap-2">
                hasta
                <input type="time" value={ventana.hasta} onChange={(e) => setVentana({ ...ventana, hasta: e.target.value })} className={inputCls} />
              </label>
            </div>
            {!horarioValido && (
              <p className="text-[0.82rem] text-brasa-hondo">
                {ventana.dias.length === 0 ? "Elige al menos un día." : "La hora de inicio debe ser antes que la de fin."}
              </p>
            )}
            <button type="button" className={botonPrimario} onClick={guardar} disabled={ocupado || !horarioValido}>
              {ocupado ? "Guardando…" : "Guardar horario"}
            </button>
          </div>
        </Seccion>
      )}
    </div>
  );
}
