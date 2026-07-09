"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import { obtenerComisiones, type Comision } from "@/lib/api";

const soles = (n: number) => `S/${n.toLocaleString("es-PE")}`;

const estadoColor: Record<string, string> = {
  pagada: "bg-ok/15 text-ok",
  pendiente: "bg-brasa/15 text-brasa",
  por_cobrar: "bg-tibio-suave text-tinta-2",
};

const estadoLabel: Record<string, string> = {
  pagada: "Pagada",
  pendiente: "Pendiente",
  por_cobrar: "Por cobrar",
};

export default function ReportesPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [resumen, setResumen] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!haySesion()) {
      router.replace("/");
      return;
    }
    setListo(true);
  }, [router]);

  useEffect(() => {
    if (!listo) return;

    const cargarComisiones = async () => {
      try {
        setCargando(true);
        setError(null);
        const { items, resumen: res } = await obtenerComisiones();
        setComisiones(items);
        setResumen(res);
      } catch (err) {
        setError("No pudimos cargar los reportes. Recargá.");
        console.error(err);
      } finally {
        setCargando(false);
      }
    };

    cargarComisiones();
  }, [listo]);

  if (!listo) return null;

  const totalGanada = resumen.pagada ?? 0;
  const totalPorCobrar = (resumen.por_cobrar ?? 0) + (resumen.pendiente ?? 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tus comisiones</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Reportes</h1>
      </header>

      {cargando ? (
        <div className="flex justify-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-arena border-t-brasa"></div>
        </div>
      ) : error ? (
        <div className="rounded-tarjeta bg-brasa/10 px-4 py-3 text-center text-[0.9rem] font-semibold text-brasa">
          {error}
        </div>
      ) : comisiones.length === 0 ? (
        <div className="rounded-tarjeta bg-carta p-8 text-center shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <p className="text-[1.1rem] font-semibold text-tinta">Aún no tenés ventas registradas</p>
          <p className="mt-2 text-[0.95rem] text-tinta-2">
            Cuando cierres tu primer lead, vas a ver tus comisiones acá.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Resumen de comisiones */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-tarjeta bg-superficie-honda p-6 text-carta shadow-[var(--sombra-tarjeta)]">
              <p className="text-[0.85rem] text-carta/70">Comisiones ganadas</p>
              <p className="mt-1 text-[2.8rem] font-bold leading-none">{soles(totalGanada)}</p>
            </div>
            <div className="rounded-tarjeta bg-brasa p-6 text-carta shadow-[var(--sombra-tarjeta)]">
              <p className="text-[0.85rem] text-carta/70">Por cobrar</p>
              <p className="mt-1 text-[2.8rem] font-bold leading-none">{soles(totalPorCobrar)}</p>
            </div>
          </div>

          {/* Tabla de comisiones */}
          <div className="rounded-tarjeta bg-carta shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-linea">
                    <th className="px-6 py-4 text-left text-[0.85rem] font-bold text-tinta-2">Lead</th>
                    <th className="px-6 py-4 text-right text-[0.85rem] font-bold text-tinta-2">Monto</th>
                    <th className="px-6 py-4 text-center text-[0.85rem] font-bold text-tinta-2">Estado</th>
                    <th className="px-6 py-4 text-right text-[0.85rem] font-bold text-tinta-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {comisiones.map((c) => (
                    <tr key={c.id} className="border-b border-arena last:border-b-0">
                      <td className="px-6 py-4 text-[0.95rem] font-semibold text-tinta">{c.leadId}</td>
                      <td className="px-6 py-4 text-right text-[0.95rem] font-bold text-tinta">{soles(c.monto)}</td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block rounded-chip px-3 py-1.5 text-[0.78rem] font-bold ${
                            estadoColor[c.estado] || "bg-arena text-tinta-2"
                          }`}
                        >
                          {estadoLabel[c.estado] || c.estado}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-[0.9rem] text-tinta-2">
                        {new Date(c.creadoEn).toLocaleDateString("es-PE")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
