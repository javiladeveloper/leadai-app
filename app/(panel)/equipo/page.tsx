"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, rolEnEmpresaActiva, leerEmpresaActiva, empresasVisibles } from "@/lib/auth";
import { useCapacidades } from "@/lib/modo-negocio";
import {
  obtenerEquipo, invitarMiembro, cancelarInvitacion, quitarMiembro, miPlanCacheado, exportarNegocio, cambiarRecibeLeads,
  type MiembroEquipo, type InvitacionPendiente,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BloqueoPlan } from "@/components/panel/BloqueoPlan";
import { SeccionPorNegocio } from "@/components/panel/GlobalNegocios";
import { QuienAtiende } from "@/components/panel/QuienAtiende";
import { ErrorConReintento } from "@/components/ErrorConReintento";
import { AccionesContacto } from "@/components/AccionesContacto";
import { urlAgenda } from "@/lib/enlaces";

// Roles que entran al reparto de leads (espejo de ROLES_QUE_VENDEN en leadia/src/core/reparto-vendedores.ts).
const VENDEN: string[] = ["owner", "admin", "agente", "ventas"];

const ROL_LABEL: Record<string, string> = {
  owner: "Dueño", admin: "Administrador", agente: "Vendedor", mozo: "Mozo",
  ventas: "Ventas", marketing: "Marketing", cocina: "Cocina",
  operador: "Vendedora (negocio exportado)",
};

/**
 * QUE VE CADA PUESTO, en una linea.
 *
 * Va debajo del selector porque elegir un rol es decidir a que datos accede
 * una persona, y sin esto la unica forma de saberlo es probarlo con ella
 * adentro. En una clinica eso importa el doble: las conversaciones son
 * consultas de pacientes.
 */
const ROL_AYUDA: Record<string, string> = {
  ventas: "Atiende los mensajes, trabaja los leads, agenda citas y ve sus comisiones. No ve la configuración del bot ni cuánto factura el negocio.",
  marketing: "Publica contenido, maneja la publicidad y contesta comentarios. Ve la lista de leads para medir si su trabajo trajo gente, pero NO entra a las conversaciones.",
  admin: "Todo menos la facturación de la cuenta: configura el bot, invita gente y ve todos los reportes.",
  agente: "El rol antiguo: ve todo el panel, incluidos los reportes de facturación del negocio.",
  mozo: "Toma pedidos en el local y los cobra. No ve reportes ni conversaciones.",
};

function EquipoPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendiente[]>([]);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "agente" | "ventas" | "marketing" | "mozo">("ventas");
  // El rol Mozo solo aplica donde hay cocina: en un negocio de captación
  // existe pero no significa nada. Mientras las capacidades no llegan
  // (`null`) se oculta — mostrar de menos es preferible a ofrecer un rol que
  // el negocio no puede usar.
  const negocio = useCapacidades();
  const hayCocina = negocio?.capacidades?.tieneCocina === true;
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [linkCopiado, setLinkCopiado] = useState("");
  const [tieneEquipo, setTieneEquipo] = useState<boolean | null>(null);

  // Solo el dueño o un administrador puede exportar el negocio: es crear una
  // copia a nombre de otra persona, la misma decisión que invitar gente.
  const puedeExportar = rolEnEmpresaActiva() === "owner" || rolEnEmpresaActiva() === "admin";
  const nombreNegocioActivo = (() => {
    const activa = leerEmpresaActiva();
    return empresasVisibles().find((e) => e.tenantId === activa)?.nombre ?? "tu negocio";
  })();
  const [emailExportar, setEmailExportar] = useState("");
  const [nombreVendedoraExportar, setNombreVendedoraExportar] = useState("");
  const [exportando, setExportando] = useState(false);
  const [errorExportar, setErrorExportar] = useState("");
  const [avisoExportar, setAvisoExportar] = useState("");
  const [linkExportado, setLinkExportado] = useState("");
  // "Quitar" pide confirmación (2026-10-09): era un toque y la persona
  // perdía el acceso al instante, sin un "¿seguro?".
  const [quitando, setQuitando] = useState<string | null>(null);

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
    // Por la caché compartida del plan (Marketing y Reportes preguntan lo mismo).
    miPlanCacheado().then((p) => setTieneEquipo(p?.features?.equipo ?? false)).catch(() => setTieneEquipo(false));
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      const r = await obtenerEquipo();
      setMiembros(r.miembros);
      setInvitaciones(r.invitaciones);
      setEstado("ok");
    } catch { setEstado("error"); }
  }, []);

  useEffect(() => { if (listo) cargar(); }, [listo, cargar]);

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setInvitando(true);
    setError("");
    setAviso("");
    const destino = email.trim();
    const r = await invitarMiembro(destino, rol);
    setInvitando(false);
    if (r.ok) {
      setEmail("");
      setAviso(
        r.correoEnviado
          ? `Le enviamos un correo a ${destino} con el enlace para unirse.`
          : `Invitación creada. Copiale el enlace de abajo a ${destino} para que se una.`,
      );
      setTimeout(() => setAviso(""), 6000);
      cargar();
    } else {
      setError(r.error ?? "No se pudo invitar.");
    }
  }

  function linkDe(token: string): string {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/invitacion?token=${token}`;
  }

  async function exportar(e: React.FormEvent) {
    e.preventDefault();
    setExportando(true);
    setErrorExportar("");
    setAvisoExportar("");
    setLinkExportado("");
    const destino = emailExportar.trim();
    const nombre = nombreVendedoraExportar.trim();
    const r = await exportarNegocio(destino, nombre);
    setExportando(false);
    if (r.ok) {
      setEmailExportar("");
      setNombreVendedoraExportar("");
      setAvisoExportar(
        `Listo. Le enviamos la invitación a ${destino}. Cuando la acepte, verá «${nombreNegocioActivo} – ${nombre}» en su cuenta.`,
      );
      if (!r.correoEnviado && r.token) setLinkExportado(linkDe(r.token));
    } else {
      setErrorExportar(r.error ?? "No se pudo exportar.");
    }
  }

  async function copiarLink(token: string) {
    try {
      await navigator.clipboard.writeText(linkDe(token));
      setLinkCopiado(token);
      setTimeout(() => setLinkCopiado(""), 2000);
    } catch { /* ignore */ }
  }

  if (!listo) return null;

  // Feature de plan: invitar equipo es de Pro+. Si el plan no lo tiene, candado.
  if (tieneEquipo === false) {
    return (
      <div className="px-5 py-10 lg:px-8">
        <BloqueoPlan
          titulo="Suma trabajadores a tu equipo"
          descripcion="Invitar trabajadores está disponible desde el plan Pro. Mejora tu plan para que te ayuden a atender."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu negocio</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Equipo</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Suma trabajadores para que te ayuden a atender. Les llega un correo con el enlace para unirse.
        </p>
      </header>

      {/* Invitar */}
      <form onSubmit={invitar} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
        <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Invitar a alguien</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo del trabajador"
            className="flex-1 rounded-tarjeta border border-linea bg-arena/30 px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
          />
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as "admin" | "agente" | "ventas" | "marketing" | "mozo")}
            className="rounded-tarjeta border border-linea bg-arena/30 px-3 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
          >
            {/* LOS PUESTOS REALES (2026-09-17, pedido de Jonathan: "agregar al
                marketero un rol de marketing, otro de ventas").
                "Ventas" y "Marketing" primero porque son los que se reparten
                todos los dias; "Vendedor (todo)" queda por compatibilidad --
                es el rol viejo, que ve tambien los reportes de plata. */}
            <option value="ventas">Ventas</option>
            <option value="marketing">Marketing</option>
            <option value="admin">Administrador</option>
            <option value="agente">Vendedor (acceso total)</option>
            {/* MOZO solo donde hay cocina (2026-08-21): en un negocio de
                captación el rol existe pero no significa nada, y una opción
                que no aplica solo genera preguntas. */}
            {hayCocina && <option value="mozo">Mozo</option>}
          </select>
          <button
            type="submit"
            disabled={invitando || !email.trim()}
            className="rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
          >
            {invitando ? "Invitando…" : "Invitar"}
          </button>
        </div>
        {ROL_AYUDA[rol] && (
          <p className="mt-2 text-[0.82rem] text-frio">{ROL_AYUDA[rol]}</p>
        )}
        {error && <p className="mt-2 text-[0.82rem] text-brasa-hondo">{error}</p>}
        {aviso && <p className="mt-2 text-[0.82rem] font-semibold text-ok">{aviso}</p>}
      </form>

      {/* Exportar a vendedora: solo dueño o admin (2026-09-25). Es otra cosa
          que invitar: crea una COPIA del negocio a nombre de otra persona, con
          su propia cuenta y su propia suscripción. */}
      {puedeExportar && (
        <form onSubmit={exportar} className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Exportar a vendedora</p>
          <p className="mb-3 text-[0.82rem] text-frio">
            La vendedora opera una copia de este negocio desde su propia cuenta. El bot es el tuyo y lo
            sigues manejando tú; los chats de ese negocio son de tu empresa.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={emailExportar}
              onChange={(e) => setEmailExportar(e.target.value)}
              placeholder="Correo de la vendedora"
              className="flex-1 rounded-tarjeta border border-linea bg-arena/30 px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
            />
            <input
              value={nombreVendedoraExportar}
              onChange={(e) => setNombreVendedoraExportar(e.target.value)}
              placeholder="Nombre de la vendedora"
              className="flex-1 rounded-tarjeta border border-linea bg-arena/30 px-3.5 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
            />
            <button
              type="submit"
              disabled={exportando || !emailExportar.trim() || !nombreVendedoraExportar.trim()}
              className="rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-60"
            >
              {exportando ? "Exportando…" : "Exportar negocio"}
            </button>
          </div>
          {errorExportar && <p className="mt-2 text-[0.82rem] text-brasa-hondo">{errorExportar}</p>}
          {avisoExportar && <p className="mt-2 text-[0.82rem] font-semibold text-ok">{avisoExportar}</p>}
          {linkExportado && (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={linkExportado}
                className="min-w-0 flex-1 truncate rounded-lg bg-arena/50 px-2.5 py-1.5 text-[0.78rem] text-tinta-2"
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(linkExportado);
                    setLinkCopiado(linkExportado);
                    setTimeout(() => setLinkCopiado(""), 2000);
                  } catch { /* ignore */ }
                }}
                className="shrink-0 rounded-chip bg-brasa-suave px-2.5 py-1.5 text-[0.75rem] font-bold text-brasa-hondo"
              >
                {linkCopiado === linkExportado ? "¡Copiado!" : "Copiar enlace"}
              </button>
            </div>
          )}
        </form>
      )}

      {/* En el calendario de quién agenda el bot de este negocio (2026-09-26):
          misma regla que exportar, solo dueño o admin. */}
      {puedeExportar && <QuienAtiende />}

      {estado === "cargando" && <SkeletonLista filas={3} />}
      {estado === "error" && <ErrorConReintento mensaje="No pudimos cargar el equipo." reintentar={cargar} />}

      {estado === "ok" && (
        <>
          {/* Miembros */}
          <div>
            <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-frio">En el equipo</p>
            {/* El reparto por carga (2026-10-05): cada lead que pasa a una persona va a
                quien tiene menos. Quien solo supervisa —el dueño, casi siempre— se apaga. */}
            <p className="mb-3 text-[0.82rem] text-tinta-2">
              Cada lead que necesita una persona va a quien tiene menos leads activos.
              Apaga <strong>Recibe leads</strong> a quien solo supervisa.
            </p>
            <div className="space-y-2">
              {miembros.map((m) => (
                <div key={m.usuarioId} className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brasa-suave text-sm font-bold text-brasa-hondo">
                    {(m.nombre ?? m.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">{m.nombre ?? m.email}</p>
                    <p className="truncate text-[0.78rem] text-frio">{m.email}</p>
                    {/* LO QUE TIENE A SU CARGO, A UN TOQUE (2026-10-09): sus
                        conversaciones asignadas y las reuniones que atiende. */}
                    {VENDEN.includes(m.rol) && (
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.76rem] font-semibold">
                        <Link href={`/conversaciones?asignado=${encodeURIComponent(m.usuarioId)}`} className="text-brasa-texto hover:underline">
                          Sus conversaciones
                        </Link>
                        <Link href={urlAgenda({ atiende: m.usuarioId, quien: m.nombre ?? m.email })} className="text-brasa-texto hover:underline">
                          Su agenda
                        </Link>
                      </p>
                    )}
                  </div>
                  <AccionesContacto email={m.email} compacto />
                  <span className="shrink-0 rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-tinta-2">
                    {ROL_LABEL[m.rol] ?? m.rol}
                  </span>
                  {VENDEN.includes(m.rol) && (
                    <button
                      role="switch"
                      aria-checked={m.recibeLeads !== false}
                      onClick={async () => {
                        const nuevo = m.recibeLeads === false;
                        setMiembros((ms) => ms.map((x) => (x.usuarioId === m.usuarioId ? { ...x, recibeLeads: nuevo } : x)));
                        const r = await cambiarRecibeLeads(m.usuarioId, nuevo);
                        if (!r.ok) cargar();
                      }}
                      title={m.recibeLeads === false ? "No recibe leads del reparto" : "Recibe leads del reparto"}
                      className={`shrink-0 rounded-chip px-2.5 py-1 text-[0.72rem] font-bold ring-1 transition-colors ${
                        m.recibeLeads === false ? "bg-carta text-frio ring-linea" : "bg-brasa-suave text-brasa-hondo ring-transparent"
                      }`}
                    >
                      {m.recibeLeads === false ? "No recibe leads" : "Recibe leads"}
                    </button>
                  )}
                  {m.rol !== "owner" && (quitando === m.usuarioId ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        onClick={async () => { setQuitando(null); await quitarMiembro(m.usuarioId); cargar(); }}
                        className="rounded-chip bg-calor px-2.5 py-1 text-[0.75rem] font-bold text-carta"
                      >
                        Sí, quitar
                      </button>
                      <button
                        onClick={() => setQuitando(null)}
                        className="rounded-chip bg-arena-2 px-2.5 py-1 text-[0.75rem] font-bold text-tinta-2"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setQuitando(m.usuarioId)}
                      title="Pierde el acceso a este negocio"
                      className="shrink-0 text-[0.78rem] font-semibold text-frio hover:text-brasa-hondo"
                    >
                      Quitar
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Invitaciones pendientes */}
          {invitaciones.length > 0 && (
            <div>
              <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-frio">Invitaciones pendientes</p>
              <div className="space-y-2">
                {invitaciones.map((inv) => (
                  <div key={inv.id} className="rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-tinta">{inv.email}</p>
                        <p className="text-[0.75rem] text-frio">{ROL_LABEL[inv.rol]} · esperando que acepte</p>
                      </div>
                      <button
                        onClick={async () => { await cancelarInvitacion(inv.id); cargar(); }}
                        className="shrink-0 text-[0.78rem] font-semibold text-frio hover:text-brasa-hondo"
                      >
                        Cancelar
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        readOnly
                        value={linkDe(inv.token)}
                        className="min-w-0 flex-1 truncate rounded-lg bg-arena/50 px-2.5 py-1.5 text-[0.78rem] text-tinta-2"
                      />
                      <button
                        onClick={() => copiarLink(inv.token)}
                        className="shrink-0 rounded-chip bg-brasa-suave px-2.5 py-1.5 text-[0.75rem] font-bold text-brasa-hondo"
                      >
                        {linkCopiado === inv.token ? "¡Copiado!" : "Copiar enlace"}
                      </button>
                    </div>
                    <p className="mt-1 text-[0.72rem] text-frio">Ya le enviamos el correo. Si no le llega, pasale este enlace por WhatsApp: al abrirlo e iniciar sesión, se une.</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Pantalla por-negocio en el panel unificado: chips arriba para elegir el
// negocio (fija la empresa activa y remonta el contenido — ver
// SeccionPorNegocio).
export default function EquipoPanelPorNegocio() {
  return (
    <SeccionPorNegocio>
      <EquipoPanel />
    </SeccionPorNegocio>
  );
}
