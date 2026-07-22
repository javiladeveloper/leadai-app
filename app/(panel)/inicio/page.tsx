"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { haySesion, leerSesion, esModoGlobal } from "@/lib/auth";
import {
  obtenerResumen, obtenerUso, leadsRecientes, obtenerReporteNegocio,
  type Resumen, type Uso, type Lead, type ReporteNegocio,
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
  caliente: "bg-calor",
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
  const [rep, setRep] = useState<ReporteNegocio | null>(null);

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    // En modo global, el Inicio es el dashboard /global (métricas y bandeja
    // de todos los negocios); este Inicio es el de UNA empresa.
    if (esModoGlobal()) {
      router.replace("/global");
      return;
    }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      // El resumen es lo esencial; uso y recientes son secundarios (best-effort).
      const [r, u, l, rn] = await Promise.all([
        obtenerResumen(),
        obtenerUso().catch(() => null),
        leadsRecientes(3).catch(() => []),
        obtenerReporteNegocio().catch(() => null), // best-effort (gated por plan)
      ]);
      setResumen(r);
      setUso(u);
      setRecientes(l);
      setRep(rn);
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
              className="flex items-center gap-4 rounded-tarjeta bg-calor px-5 py-4 text-carta shadow-[0_8px_24px_rgba(240,112,79,0.3)] transition active:scale-[0.99]"
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
              <p className="mt-2 text-[2.3rem] font-bold leading-none text-calor">{resumen.calientesSinAtender}</p>
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
                <div className="space-y-2">
                  {recientes.map((l) => {
                    const inicial = (l.nombre ?? l.contactoExterno).trim().charAt(0).toUpperCase();
                    return (
                      <Link key={l.id} href={`/conversacion/${l.id}`} className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-arena/50">
                        {/* Avatar con inicial, teñido por el nivel (diseño Stitch) */}
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.85rem] font-bold text-carta ${NIVEL_PUNTO[l.nivelInteres] ?? "bg-frio"}`}>
                          {inicial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.88rem] font-semibold leading-tight text-tinta">
                            {l.nombre ?? l.contactoExterno}
                          </p>
                          <p className="text-[0.72rem] text-frio">{haceTexto(l.actualizadoEn)}</p>
                        </div>
                        <span className="shrink-0 text-lg leading-none text-frio">›</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Línea de ventas + ayuda (fila final del diseño Stitch) */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Mini gráfico de ventas (datos reales de reportes); si no hay
                ventas aún, invita a configurar los flujos (como el mock). */}
            {rep && rep.evolucion.some((e) => e.ventas > 0) ? (
              <div className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                <p className="mb-3 text-[0.85rem] font-bold text-tinta">Tus ventas, últimos 6 meses</p>
                <div className="flex h-24 items-end gap-2">
                  {rep.evolucion.map((e) => {
                    const max = Math.max(1, ...rep.evolucion.map((x) => x.ventas));
                    const alto = Math.max(6, Math.round((e.ventas / max) * 100));
                    return (
                      <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
                        <div className="w-full rounded-t-md bg-brasa/80 transition-all" style={{ height: `${alto}%` }} title={`${e.ventas} ventas`} />
                        <span className="text-[0.62rem] text-frio">{e.mes.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Link
                href="/flujos"
                className="grid place-items-center rounded-tarjeta border-2 border-dashed border-linea bg-carta/50 p-6 text-center transition hover:border-brasa/40"
              >
                <div>
                  <p className="text-[0.9rem] font-bold text-tinta-2">📈 Línea de tiempo de ventas</p>
                  <p className="mt-1 text-[0.8rem] text-frio">
                    Cuando cierres tus primeras ventas, acá vas a ver cómo evolucionan mes a mes.
                  </p>
                </div>
              </Link>
            )}

            {/* Tarjeta de ayuda (slate navy, como el mock) */}
            <div className="flex flex-col justify-between rounded-tarjeta bg-superficie-honda p-5 text-arena shadow-[var(--sombra-tarjeta)]">
              <div>
                <p className="text-[1rem] font-bold leading-snug">¿Todavía no conectaste tus redes?</p>
                <p className="mt-1 text-[0.84rem] text-arena/70">
                  Probá tu bot y dejá todo listo — cuando conectes, arrancás al toque.
                </p>
              </div>
              <Link
                href="/probar-bot"
                className="mt-4 inline-flex w-fit items-center rounded-chip bg-brasa px-4 py-2 text-sm font-bold text-carta transition hover:bg-brasa-hondo"
              >
                Probar mi bot
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
