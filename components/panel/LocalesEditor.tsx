"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listarSucursales, crearSucursal, cerrarSucursal, ventasPorLocal,
  type Sucursal, type VentasPorLocal,
} from "@/lib/cocina";
import { soles } from "@/lib/precio";

/**
 * LOS LOCALES DEL NEGOCIO (2026-08-25).
 *
 * Una cadena es UN negocio con varios locales: misma carta, misma marca, mismo
 * dueño. Antes de esto la única salida era abrir varias empresas, y salía caro
 * y peor — la carta cargada de nuevo en cada una, sin ventas juntas, el mismo
 * cliente contado dos veces. El porqué y los precios están en
 * `compartido/sucursales.md`.
 *
 * LAS VENTAS JUNTAS ESTÁN ARRIBA, no escondidas en Reportes. Es lo que
 * ola.click cobra aparte y la razón por la que alguien abre un segundo local:
 * querer ver el conjunto. Ponerlas primero es la respuesta a "¿cómo venimos
 * hoy?", que es la pregunta de la tarde.
 */
export function LocalesEditor() {
  const [locales, setLocales] = useState<Sucursal[]>([]);
  const [ventas, setVentas] = useState<VentasPorLocal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const [l, v] = await Promise.all([listarSucursales(), ventasPorLocal()]);
    setLocales(l);
    setVentas(v);
    setCargando(false);
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  async function agregar() {
    if (!nombre.trim()) { setError("Ponle un nombre al local."); return; }
    setError("");
    setCreando(true);
    const r = await crearSucursal({ nombre: nombre.trim(), direccion: direccion.trim() || null });
    setCreando(false);
    if (!r.ok) { setError(r.error ?? "No se pudo crear"); return; }
    setNombre("");
    setDireccion("");
    await cargar();
  }

  async function cerrar(s: Sucursal) {
    // Se dice qué pasa de verdad: el local deja de recibir, pero lo que vendió
    // sigue contando. Sin esa aclaración, "cerrar" suena a borrar el historial.
    if (!confirm(`¿Cerrar ${s.nombre}? Deja de recibir pedidos, pero sus ventas siguen en los reportes.`)) return;
    const r = await cerrarSucursal(s.id);
    if (!r.ok) { setError(r.error ?? "No se pudo cerrar"); return; }
    await cargar();
  }

  if (cargando) return <p className="text-sm text-tinta-2">Cargando tus locales…</p>;

  const ventasDe = (id: string) => ventas?.porSucursal.find((v) => v.sucursalId === id);
  const variosLocales = locales.length > 1;

  return (
    <div className="space-y-4">
      {/* LAS VENTAS JUNTAS, solo si hay más de un local: con uno solo sería
          repetir el número que ya está en Inicio. */}
      {variosLocales && ventas && (
        <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[0.9rem] font-semibold text-tinta">Hoy, entre todos tus locales</p>
            <p className="text-[1.15rem] font-bold tabular-nums text-tinta">
              {soles(ventas.totalCentavos)}
            </p>
          </div>
          <div className="mt-2 space-y-1">
            {ventas.porSucursal.map((v) => (
              <div key={v.sucursalId || v.nombre} className="flex items-baseline justify-between gap-2 text-[0.86rem]">
                <span className="text-tinta-2">{v.nombre}</span>
                <span className="tabular-nums text-tinta-2">
                  {soles(v.totalCentavos)}
                  <span className="ml-1.5 text-[0.78rem] text-frio">
                    {v.pedidos} {v.pedidos === 1 ? "pedido" : "pedidos"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {locales.map((s) => {
          const v = ventasDe(s.id);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-tarjeta bg-carta px-4 py-3 ring-1 ring-linea">
              <div className="min-w-[8rem] flex-1">
                <p className="flex items-center gap-2 text-[0.92rem] font-semibold text-tinta">
                  {s.nombre}
                  {s.principal && (
                    <span className="rounded-full bg-arena px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-wide text-frio">
                      Principal
                    </span>
                  )}
                </p>
                {s.direccion && <p className="text-[0.8rem] text-frio">{s.direccion}</p>}
              </div>
              {variosLocales && v && (
                <span className="text-[0.84rem] tabular-nums text-tinta-2">{soles(v.totalCentavos)} hoy</span>
              )}
              {/* La principal no se cierra: es la que recibe lo que no dice de
                  qué local es. El botón ni aparece, en vez de fallar al tocarlo. */}
              {!s.principal && (
                <button
                  type="button"
                  onClick={() => cerrar(s)}
                  className="rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold text-frio transition hover:bg-alerta/10 hover:text-alerta"
                >
                  Cerrar
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-tarjeta bg-arena/40 p-3.5 ring-1 ring-linea">
        <p className="text-[0.86rem] font-semibold text-tinta">Agregar otro local</p>
        <p className="mt-0.5 text-[0.8rem] text-frio">
          Comparte tu carta y tus clientes. Cada local tiene su cocina, su horario y puede
          tener su propio WhatsApp.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Miraflores"
            aria-label="Nombre del local"
            className="min-w-[8rem] flex-1 rounded-full bg-carta px-3.5 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-2 focus:ring-brasa"
          />
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Av. Larco 123 (opcional)"
            aria-label="Dirección del local"
            className="min-w-[10rem] flex-[2] rounded-full bg-carta px-3.5 py-2 text-[0.88rem] text-tinta outline-none ring-1 ring-linea placeholder:text-frio focus:ring-2 focus:ring-brasa"
          />
          <button
            type="button"
            onClick={agregar}
            disabled={creando || !nombre.trim()}
            className="rounded-full bg-brasa px-4 py-2 text-[0.86rem] font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
          >
            {creando ? "Agregando…" : "Agregar"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-alerta">{error}</p>}
    </div>
  );
}
