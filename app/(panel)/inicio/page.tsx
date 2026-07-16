"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, leerSesion } from "@/lib/auth";
import {
  obtenerResumen, obtenerUso, leadsRecientes,
  type Resumen, type Uso, type Lead,
} from "@/lib/api";
import { IconoRayo, IconoConversaciones, IconoBandeja, IconoSeguimiento, IconoReportes } from "@/components/Iconos";
import { SkeletonMetricas } from "@/components/Skeletons";

type Estado = "cargando" | "ok" | "error";

// Accesos rápidos — tarjetas compactas con ícono arriba (diseño Stitch).
const ACCESOS = [
  { href: "/conversaciones", titulo: "Conversaciones", Icono: IconoConversaciones },
  { href: "/seguimiento", titulo: "Pipeline", Icono: IconoSeguimiento },
  { href: "/leads", titulo: "Leads", Icono: IconoBandeja },
  { href: "/reportes", titulo: "Reportes", Icono: IconoReportes },
];

const NIVEL_PUNTO: Record<string, string> = {
  caliente: "bg-brasa",
  tibio: "bg-tibio",
  frio: "bg-frio",
};

// Tiempo relativo corto para "Actividad reciente".
function haceTexto(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// Inicio del panel — rediseño "Warm Human CRM" (Stitch): saludo + alerta de
// calientes + métricas + accesos rápidos + progreso del mes + actividad reciente.
export default function InicioPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [uso, setUso] = useState<Uso | null>(null);
  const [recientes, setRecientes] = useState<Lead[]>([]);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      // El resumen es lo esencial; uso y recientes son secundarios (best-effort).
      const [r, u, l] = await Promise.all([
        obtenerResumen(),
        obtenerUso().catch(() => null),
        leadsRecientes(3).catch(() => []),
      ]);
      setResumen(r);
      setUso(u);
      setRecientes(l);
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, []);

  useEffect(() => {
    if (!listo) return;
    cargar();
  }, [listo, cargar]);

  if (!listo) return null;

  const sesion = leerSesion();
  const nombre = sesion?.usuario.nombre?.split(" ")[0] ?? "";

  const vacio =
    estado === "ok" &&
    !!resumen &&
    resumen.leadsActivos === 0 &&
    resumen.ventasCerradas === 0 &&
    resumen.calientesSinAtender === 0;

  const clientes = uso?.clientes ?? null;
  const pctClientes = clientes && clientes.limite > 0 ? Math.min(100, Math.round((clientes.usados / clientes.limite) * 100)) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <h1 className="text-[1.8rem] font-bold text-tinta">
          Hola{nombre ? `, ${nombre}` : ""} 👋
        </h1>
        <p className="mt-0.5 text-[0.95rem] text-frio">Así va tu negocio hoy.</p>
      </header>

      {estado === "cargando" && <SkeletonMetricas />}

      {estado === "error" && (
        <div className="rounded-tarjeta bg-carta p-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="font-semibold text-tinta">No pudimos cargar tus datos. Recargá.</p>
        </div>
      )}

      {estado === "ok" && vacio && (
        <div className="rounded-tarjeta bg-carta p-6 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.05rem] font-bold text-tinta">
            Aún no tenés leads. Conectá WhatsApp para empezar a recibirlos
          </p>
          <Link
            href="/configuracion"
            className="mt-4 inline-flex items-center justify-center rounded-tarjeta bg-brasa px-5 py-2.5 font-semibold text-carta transition active:scale-[0.99]"
          >
            Conectar WhatsApp
          </Link>
        </div>
      )}

      {estado === "ok" && resumen && !vacio && (
        <>
          {/* Alerta: calientes sin atender (ícono en círculo + chevron, estilo Stitch) */}
          {resumen.calientesSinAtender > 0 && (
            <Link
              href="/leads"
              className="flex items-center gap-4 rounded-tarjeta bg-brasa px-5 py-4 text-carta shadow-[0_8px_24px_rgba(226,92,67,0.3)] transition active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-carta/20">
                <IconoRayo className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1.12rem] font-bold leading-tight">
                  {resumen.calientesSinAtender}{" "}
                  {resumen.calientesSinAtender === 1 ? "lead caliente" : "leads calientes"} sin atender
                </p>
                <p className="text-[0.86rem] text-carta/85">Tocá para verlos — están listos para cerrar</p>
              </div>
              <span className="shrink-0 text-2xl leading-none text-carta/80">›</span>
            </Link>
          )}

          {/* Métricas: etiqueta arriba, número grande abajo (estilo Stitch) */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <p className="text-[0.72rem] font-bold uppercase tracking-wider text-frio">Leads activos</p>
              <p className="mt-2 text-[2.3rem] font-bold leading-none text-tinta">{resumen.leadsActivos}</p>
            </div>
            <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <p className="text-[0.72rem] font-bold uppercase tracking-wider text-frio">Calientes 🔥</p>
              <p className="mt-2 text-[2.3rem] font-bold leading-none text-brasa">{resumen.calientesSinAtender}</p>
            </div>
            <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <p className="text-[0.72rem] font-bold uppercase tracking-wider text-frio">Ventas cerradas ✓</p>
              <p className="mt-2 text-[2.3rem] font-bold leading-none text-ok">{resumen.ventasCerradas}</p>
            </div>
          </div>

          {/* Accesos rápidos: tarjetas compactas con ícono arriba (estilo Stitch) */}
          <div>
            <h2 className="mb-3 text-[1.05rem] font-bold text-tinta">Accesos rápidos</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {ACCESOS.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex flex-col items-center gap-2.5 rounded-tarjeta bg-carta px-3 py-5 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea transition hover:ring-brasa/40"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-arena text-tinta">
                    <a.Icono className="h-5 w-5" />
                  </span>
                  <span className="text-[0.85rem] font-bold text-tinta">{a.titulo}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Progreso del mes + actividad reciente (estilo Stitch) */}
          <div className="grid gap-4 sm:grid-cols-2">
            {clientes && clientes.limite > 0 && (
              <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[0.85rem] font-bold text-tinta">Clientes atendidos este mes</p>
                  <p className="text-[0.85rem] font-bold tabular-nums text-brasa">
                    {clientes.usados.toLocaleString("es-PE")} <span className="font-normal text-frio">de {clientes.limite.toLocaleString("es-PE")}</span>
                  </p>
                </div>
                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-arena">
                  <div className="h-full rounded-full bg-brasa transition-all" style={{ width: `${pctClientes}%` }} />
                </div>
                <p className="mt-2 text-[0.78rem] text-frio">
                  Te quedan {clientes.restante.toLocaleString("es-PE")} clientes en tu plan.
                </p>
              </div>
            )}

            {recientes.length > 0 && (
              <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold text-tinta">Actividad reciente</p>
                <div className="space-y-2.5">
                  {recientes.map((l) => (
                    <Link key={l.id} href={`/conversacion/${l.id}`} className="flex items-center gap-2.5 rounded-xl px-1 py-0.5 transition hover:bg-arena/50">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${NIVEL_PUNTO[l.nivelInteres] ?? "bg-frio"}`} />
                      <span className="min-w-0 flex-1 truncate text-[0.88rem] font-semibold text-tinta">
                        {l.nombre ?? l.contactoExterno}
                      </span>
                      <span className="shrink-0 text-[0.74rem] text-frio">{haceTexto(l.actualizadoEn)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
