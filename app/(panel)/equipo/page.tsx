"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  obtenerEquipo, invitarMiembro, cancelarInvitacion, quitarMiembro,
  type MiembroEquipo, type InvitacionPendiente,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";

const ROL_LABEL: Record<string, string> = {
  owner: "Dueño", admin: "Administrador", agente: "Vendedor",
};

export default function EquipoPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [invitaciones, setInvitaciones] = useState<InvitacionPendiente[]>([]);
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<"admin" | "agente">("agente");
  const [invitando, setInvitando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [linkCopiado, setLinkCopiado] = useState("");

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
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

  async function copiarLink(token: string) {
    try {
      await navigator.clipboard.writeText(linkDe(token));
      setLinkCopiado(token);
      setTimeout(() => setLinkCopiado(""), 2000);
    } catch { /* ignore */ }
  }

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu negocio</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Equipo</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Sumá trabajadores para que te ayuden a atender. Les llega un correo con el enlace para unirse.
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
            onChange={(e) => setRol(e.target.value as "admin" | "agente")}
            className="rounded-tarjeta border border-linea bg-arena/30 px-3 py-2.5 text-[0.95rem] text-tinta outline-none focus:border-brasa"
          >
            <option value="agente">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
          <button
            type="submit"
            disabled={invitando || !email.trim()}
            className="rounded-tarjeta bg-brasa px-5 py-2.5 text-[0.92rem] font-semibold text-carta transition hover:bg-brasa-hondo disabled:opacity-60"
          >
            {invitando ? "Invitando…" : "Invitar"}
          </button>
        </div>
        {error && <p className="mt-2 text-[0.82rem] text-brasa-hondo">{error}</p>}
        {aviso && <p className="mt-2 text-[0.82rem] font-semibold text-ok">{aviso}</p>}
      </form>

      {estado === "cargando" && <SkeletonLista filas={3} />}
      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar el equipo. Recargá.</p>
        </div>
      )}

      {estado === "ok" && (
        <>
          {/* Miembros */}
          <div>
            <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-wide text-frio">En el equipo</p>
            <div className="space-y-2">
              {miembros.map((m) => (
                <div key={m.usuarioId} className="flex items-center gap-3 rounded-tarjeta bg-carta p-3.5 ring-1 ring-linea">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brasa-suave text-sm font-bold text-brasa-hondo">
                    {(m.nombre ?? m.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-tinta">{m.nombre ?? m.email}</p>
                    <p className="truncate text-[0.78rem] text-frio">{m.email}</p>
                  </div>
                  <span className="shrink-0 rounded-chip bg-arena px-2.5 py-1 text-[0.72rem] font-bold text-tinta-2">
                    {ROL_LABEL[m.rol] ?? m.rol}
                  </span>
                  {m.rol !== "owner" && (
                    <button
                      onClick={async () => { await quitarMiembro(m.usuarioId); cargar(); }}
                      className="shrink-0 text-[0.78rem] font-semibold text-frio hover:text-brasa-hondo"
                    >
                      Quitar
                    </button>
                  )}
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
