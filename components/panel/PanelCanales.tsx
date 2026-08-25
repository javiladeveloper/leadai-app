"use client";

import { useEffect, useState } from "react";
import {
  listarCanales, obtenerUrlOAuth, actualizarCanal, eliminarCanal,
  type Canal, type TipoCanal,
} from "@/lib/api";
import { leerSesion, leerEmpresaActiva } from "@/lib/auth";
import { listarSucursales, type Sucursal } from "@/lib/cocina";
import { IconoWhatsApp, IconoInstagram, IconoMessenger, IconoTikTok } from "@/components/Iconos";
import ConectarWhatsApp from "@/components/ConectarWhatsApp";

// Metadatos de cada red: ícono, nombre, color de marca y cómo se conecta.
const REDES: {
  tipo: TipoCanal;
  nombre: string;
  Icono: (p: { className?: string }) => React.ReactNode;
  color: string;
  descripcion: string;
  // WhatsApp usa su propio flujo (Embedded Signup); el resto va por OAuth.
  metodo: "whatsapp" | "oauth";
}[] = [
  { tipo: "whatsapp", nombre: "WhatsApp", Icono: IconoWhatsApp, color: "#25D366", descripcion: "Tu número de WhatsApp Business", metodo: "whatsapp" },
  { tipo: "instagram", nombre: "Instagram", Icono: IconoInstagram, color: "#C13584", descripcion: "Mensajes directos de tu cuenta de Instagram", metodo: "oauth" },
  { tipo: "messenger", nombre: "Messenger", Icono: IconoMessenger, color: "#0084FF", descripcion: "Mensajes de tu página de Facebook", metodo: "oauth" },
  { tipo: "tiktok", nombre: "TikTok", Icono: IconoTikTok, color: "#010101", descripcion: "Mensajes de tu cuenta de TikTok", metodo: "oauth" },
];

export function PanelCanales() {
  const [canales, setCanales] = useState<Canal[]>([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState<TipoCanal>("whatsapp");
  const [conectando, setConectando] = useState(false);
  /**
   * LOS LOCALES DEL NEGOCIO (2026-08-25). Solo hacen falta si hay más de uno:
   * con un solo local no hay nada que elegir y el selector sería ruido.
   */
  const [locales, setLocales] = useState<Sucursal[]>([]);

  async function cargar() {
    setCargando(true);
    const [cs, ls] = await Promise.all([listarCanales(), listarSucursales()]);
    setCanales(cs);
    setLocales(ls);
    setCargando(false);
  }

  /** A qué local atiende este número. `''` = a toda la cadena. */
  async function asignarLocal(c: Canal, sucursalId: string) {
    await actualizarCanal(c.id, { sucursalId: sucursalId || null });
    await cargar();
  }
  useEffect(() => { cargar(); }, []);

  // Cuántas cuentas hay conectadas de cada red.
  const cuenta = (tipo: TipoCanal) => canales.filter((c) => c.tipo === tipo).length;

  const red = REDES.find((r) => r.tipo === seleccion)!;
  const conexiones = canales.filter((c) => c.tipo === seleccion);

  async function conectarOAuth(tipo: TipoCanal) {
    setConectando(true);
    const url = await obtenerUrlOAuth(tipo);
    setConectando(false);
    if (url) {
      // Abre la autorización de la red en una pestaña nueva.
      window.open(url, "_blank", "noopener");
    }
  }

  async function alternar(c: Canal) {
    await actualizarCanal(c.id, { activo: !c.activo });
    cargar();
  }

  // Desconecta (elimina) la conexión con la red. Los leads y conversaciones
  // quedan intactos: solo se quita el enlace, y se puede volver a conectar.
  async function desconectar(c: Canal) {
    const seguro = window.confirm(
      `¿Desconectar ${c.nombre || c.cuentaExterna}?\n\n` +
        "La cuenta deja de estar conectada a LeadAI (el bot ya no atenderá por acá). " +
        "Tus conversaciones y leads NO se borran, y podés volver a conectarla cuando quieras.",
    );
    if (!seguro) return;
    await eliminarCanal(c.id);
    cargar();
  }

  return (
    // Redes ARRIBA en grilla y el detalle a todo el ancho debajo (2026-08-18).
    // Antes eran una columna angosta de 260px y un panel medio vacío al lado:
    // con solo cuatro redes, la columna desperdiciaba media pantalla y el
    // detalle no llenaba la otra mitad.
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {REDES.map((r) => {
          const n = cuenta(r.tipo);
          const activa = seleccion === r.tipo;
          return (
            <button
              key={r.tipo}
              onClick={() => setSeleccion(r.tipo)}
              // Sobre el verde hondo: la elegida en blanco (salta), el resto
              // en un velo claro. `bg-arena/60` acá daba un gris sucio — el
              // arena semitransparente sobre oscuro pierde su color.
              className={`flex w-full items-center gap-3 rounded-tarjeta px-3.5 py-3 text-left transition ${
                activa
                  ? "bg-carta ring-2 ring-brasa"
                  : "bg-arena/10 ring-1 ring-arena/15 hover:bg-arena/20"
              }`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ backgroundColor: `${r.color}1a`, color: r.color }}
              >
                <r.Icono className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[0.92rem] font-semibold ${activa ? "text-tinta" : "text-arena"}`}>
                  {r.nombre}
                </span>
                {/* MIENTRAS CARGA NO SE AFIRMA NADA (2026-08-19). Antes decía
                    "Sin conectar" desde el primer render —porque la lista
                    todavía estaba vacía— así que alguien con WhatsApp conectado
                    leía que no lo estaba, y un segundo después cambiaba. Un
                    guion no miente. */}
                <span className={`block text-[0.75rem] ${activa ? "text-frio" : "text-arena/60"}`}>
                  {cargando ? "—" : n > 0 ? `${n} conectada${n > 1 ? "s" : ""}` : "Sin conectar"}
                </span>
              </span>
              {n > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-ok" />}
            </button>
          );
        })}
      </div>

      {/* El detalle en BLANCO sobre la sección oscura: acá hay listas de
          cuentas, links y formularios pensados para fondo claro. El contraste
          marca la estructura —elegís arriba, operás abajo— sin obligar a
          reescribir cada control. */}
      <div className="rounded-tarjeta bg-carta p-5">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 place-items-center rounded-full"
            style={{ backgroundColor: `${red.color}1a`, color: red.color }}
          >
            <red.Icono className="h-6 w-6" />
          </span>
          <div>
            <h3 className="text-[1.05rem] font-bold text-tinta">{red.nombre}</h3>
            <p className="text-[0.82rem] text-frio">{red.descripcion}</p>
          </div>
        </div>

        <div className="mt-5">
          {/* WhatsApp: su propio componente de conexión + cuentas conectadas */}
          {red.tipo === "whatsapp" ? (
            <div className="space-y-4">
              {/* Mientras carga, un placeholder del alto de la lista: antes se
                  saltaba directo al formulario de conectar —invitando a
                  conectar un número que ya estaba— y después la lista aparecía
                  empujando el botón hacia abajo. */}
              {cargando && <div className="h-16 animate-pulse rounded-lg bg-arena/40" />}
              {!cargando && conexiones.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Números conectados</p>
                  {conexiones.map((c) => (
                    <div key={c.id} className="space-y-3 rounded-lg bg-arena/40 px-3.5 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[0.9rem] font-semibold text-tinta">{c.nombre || c.cuentaExterna}</p>
                          <p className="truncate text-[0.75rem] text-frio">
                            conectado el {new Date(c.creadoEn).toLocaleDateString("es-PE")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => alternar(c)}
                            className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
                              c.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
                            }`}
                          >
                            {c.activo ? "Activo" : "Apagado"}
                          </button>
                          <button
                            onClick={() => desconectar(c)}
                            title="Desconectar este número de LeadAI"
                            className="rounded-chip px-2 py-1 text-[0.72rem] font-semibold text-frio transition hover:bg-alerta/10 hover:text-alerta"
                          >
                            Desconectar
                          </button>
                        </div>
                      </div>
                      {/* A QUÉ LOCAL ATIENDE ESTE NÚMERO (2026-08-25).
                          Solo con más de un local: con uno solo no hay nada
                          que elegir y el selector sería ruido.

                          "Todos los locales" es una opción válida, no un
                          error: un negocio puede tener un único WhatsApp para
                          toda la cadena. */}
                      {locales.length > 1 && (
                        <label className="flex flex-wrap items-center gap-2 text-[0.8rem] text-tinta-2">
                          <span>Atiende a:</span>
                          <select
                            value={c.sucursalId ?? ""}
                            onChange={(e) => asignarLocal(c, e.target.value)}
                            className="rounded-chip bg-carta px-2.5 py-1 text-[0.8rem] text-tinta ring-1 ring-linea focus:ring-2 focus:ring-brasa"
                          >
                            <option value="">Todos los locales</option>
                            {locales.map((l) => (
                              <option key={l.id} value={l.id}>{l.nombre}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <CompartirCanal canal={c} onGuardado={cargar} />
                    </div>
                  ))}
                </div>
              )}
              {/* UN SEGUNDO NUMERO PARA OTRO RUBRO VA EN OTRA EMPRESA
                  (2026-08-24).
                  
                  Dos numeros en la MISMA empresa se conectan bien y reciben
                  bien, pero al responder se elige un canal cualquiera
                  (`core/envio.ts`): un cliente del estudio juridico puede
                  recibir la respuesta desde el numero de la inmobiliaria, sin
                  ningun error visible. Ademas comparten playbook, asi que la
                  IA contestaria igual en los dos rubros.

                  El aviso va ACA, pegado al boton, y no en la documentacion:
                  es el segundo exacto en que alguien se equivoca. Solo aparece
                  con un numero ya conectado — antes de eso no hay decision que
                  tomar. */}
              {!cargando && conexiones.length > 0 && (
                <div className="space-y-1.5 rounded-lg bg-tibio-suave/50 px-3.5 py-2.5 text-[0.82rem] text-tinta-2 ring-1 ring-tibio/30">
                  <p>
                    <b className="text-tinta">¿Es de otro negocio?</b> Conviene crearle su propia
                    empresa: así la IA responde distinto en cada una y los clientes no se mezclan.
                    Puedes cambiar de empresa desde el selector de arriba.
                  </p>
                  {/* SUCURSALES NO SE MANDAN SOLAS A OTRA EMPRESA (2026-08-25).
                      Con el mismo negocio en varios locales, "creá otra
                      empresa" es el consejo CARO: carga la carta de nuevo,
                      paga otro plan y pierde las ventas juntas. Todavía no hay
                      soporte real de sucursales, así que se les pide que
                      escriban en vez de empujarlos a un camino que les sale
                      peor y encima nos hace ver mal. */}
                  <p>
                    <b className="text-tinta">¿Es otro local del mismo negocio?</b> Escríbenos antes
                    de conectarlo — lo configuramos contigo para que no cargues la carta dos veces.
                  </p>
                </div>
              )}
              {/* Tampoco antes de saber: `otroNumero` cambia el texto del
                  botón ("conectar otro" vs "conectar"), y con la lista vacía
                  decía lo que no era. */}
              {!cargando && (
                <ConectarWhatsApp onConectado={cargar} otroNumero={conexiones.length > 0} />
              )}
            </div>
          ) : (
            <>
              {/* Conexiones existentes de esta red */}
              {cargando ? (
                <p className="text-[0.85rem] text-frio">Cargando…</p>
              ) : conexiones.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">Cuentas conectadas</p>
                  {conexiones.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-arena/40 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[0.9rem] font-semibold text-tinta">{c.nombre || c.cuentaExterna}</p>
                        <p className="truncate text-[0.75rem] text-frio">
                          {c.cuentaExterna} · conectada el {new Date(c.creadoEn).toLocaleDateString("es-PE")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => alternar(c)}
                          className={`rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ${
                            c.activo ? "bg-ok/12 text-ok" : "bg-arena text-frio"
                          }`}
                        >
                          {c.activo ? "Activo" : "Apagado"}
                        </button>
                        <button
                          onClick={() => desconectar(c)}
                          title={`Desconectar esta cuenta de ${red.nombre}`}
                          className="rounded-chip px-2 py-1 text-[0.72rem] font-semibold text-frio transition hover:bg-alerta/10 hover:text-alerta"
                        >
                          Desconectar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.85rem] text-frio">Todavía no conectaste ninguna cuenta de {red.nombre}.</p>
              )}

              {/* Botón para conectar una cuenta nueva */}
              <button
                onClick={() => conectarOAuth(red.tipo)}
                disabled={conectando}
                className="mt-4 inline-flex items-center gap-2 rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
              >
                {conectando ? "Abriendo…" : `Conectar ${red.nombre}`}
              </button>
              <p className="mt-2 text-[0.75rem] text-frio">
                Se abre una ventana para que autorices con {red.nombre}.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Compartir un número con otros negocios del mismo dueño (caso vendedora
// multiempresa): el ruteo lo decide el backend (continuidad → IA → pregunta).
function CompartirCanal({ canal, onGuardado }: { canal: Canal; onGuardado: () => void }) {
  const empresaActiva = leerEmpresaActiva();
  const otras = (leerSesion()?.empresas ?? []).filter((e) => e.tenantId !== empresaActiva);
  const [abierto, setAbierto] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>(canal.compartirCon ?? []);
  const [guardando, setGuardando] = useState(false);
  if (otras.length === 0) return null;

  const compartidoCon = (canal.compartirCon ?? []).length;

  async function guardar() {
    setGuardando(true);
    await actualizarCanal(canal.id, { compartirCon: marcadas });
    setGuardando(false);
    setAbierto(false);
    onGuardado();
  }

  return (
    <div className="border-t border-linea/60 pt-2.5">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="text-[0.78rem] font-semibold text-frio underline underline-offset-2 hover:text-tinta"
      >
        {compartidoCon > 0
          ? `Este número atiende ${compartidoCon + 1} negocios · editar`
          : "¿Este número también atiende otros de tus negocios? Compartilo →"}
      </button>
      {abierto && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[0.75rem] text-frio">
            Los mensajes que lleguen a este número se atenderán según el negocio del que pregunte
            el cliente (LeadAI lo detecta sola, y si no queda claro, le ofrece la lista).
          </p>
          {otras.map((e) => (
            <label key={e.tenantId} className="flex items-center gap-2 text-[0.85rem] text-tinta">
              <input
                type="checkbox"
                checked={marcadas.includes(e.tenantId)}
                onChange={(ev) =>
                  setMarcadas(
                    ev.target.checked
                      ? [...marcadas, e.tenantId]
                      : marcadas.filter((t) => t !== e.tenantId),
                  )
                }
              />
              {e.nombre}
            </label>
          ))}
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-full bg-brasa px-4 py-1.5 text-[0.8rem] font-semibold text-sobre-brasa transition hover:brightness-95 disabled:opacity-60"
          >
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </div>
  );
}
