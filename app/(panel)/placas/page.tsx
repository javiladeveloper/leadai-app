"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  misPlacas, cambiarDestinoPlaca, bajaPlaca, negociosParaPlaca,
  type PlacaMia, type NegocioGooglePlaca,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";

type Estado = "cargando" | "ok" | "error";

// PLACAS NFC DE RESEÑAS — panel del dueño (2026-08-26): sus placas con los
// escaneos por mes, cambiar el destino (mudanza / ficha nueva de Google) y
// dar de baja. La activación vive en /activar-placa (llega tocando la placa).
export default function PlacasPanel() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [placas, setPlacas] = useState<PlacaMia[]>([]);
  const g = useSeccionGlobal();

  // Cambiar destino: qué placa está en edición y la búsqueda del negocio nuevo.
  const [editando, setEditando] = useState<string | null>(null);
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<NegocioGooglePlaca[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    try {
      setPlacas(await misPlacas(g.tenantLista));
      setEstado("ok");
    } catch {
      setEstado("error");
    }
  }, [g.tenantLista]);

  useEffect(() => {
    if (!listo || !g.listaLista) return;
    cargar();
  }, [listo, g.listaLista, cargar]);

  async function buscar() {
    if (!consulta.trim() || buscando) return;
    setBuscando(true);
    setResultados(await negociosParaPlaca({ q: consulta.trim() }, g.tenantLista));
    setBuscando(false);
  }

  async function cambiar(uid: string, n: NegocioGooglePlaca) {
    if (!window.confirm(`¿Mandar las reseñas de esta placa a "${n.nombre}"?`)) return;
    const r = await cambiarDestinoPlaca(uid, n.placeId, g.tenantLista);
    setMsg(r.ok ? "✓ Destino actualizado" : "No se pudo cambiar el destino.");
    setEditando(null); setConsulta(""); setResultados([]);
    if (r.ok) cargar();
  }

  async function baja(uid: string) {
    if (!window.confirm("¿Dar de baja esta placa? Dejará de redirigir a tus reseñas (puedes pedir reactivarla por soporte).")) return;
    const r = await bajaPlaca(uid, g.tenantLista);
    if (r.ok) cargar();
  }

  // Últimos 6 meses en orden, para la barra mensual.
  const meses: string[] = [];
  {
    const d = new Date();
    d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      meses.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
    }
  }
  const NOMBRE_MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

  if (!listo) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8">
      <header>
        <p className="eyebrow">Tu negocio</p>
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Placas de reseñas</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Cada toque a tu placa lleva al cliente directo a dejarte una reseña en Google.
        </p>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {msg && <p className="text-[0.86rem] font-semibold text-tinta-2">{msg}</p>}

      {estado === "cargando" && <SkeletonLista filas={2} />}

      {estado === "ok" && placas.length === 0 && (
        <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
          <p className="text-[1.02rem] font-bold text-tinta">Todavía no tienes placas</p>
          <p className="mt-1 text-[0.88rem] text-frio">
            ¿Ya compraste una? Tócala con tu celular y sigue los pasos para activarla.
          </p>
        </div>
      )}

      {estado === "ok" && placas.map((p) => {
        const max = Math.max(1, ...meses.map((m) => p.porMes[m] ?? 0));
        const esteMes = p.porMes[meses[5]] ?? 0;
        return (
          <div key={p.uid} className="rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.78rem] font-bold uppercase tracking-wide text-frio">
                  Placa {p.uid.slice(-6)}
                </p>
                <p className="mt-0.5 text-[1.5rem] font-bold text-tinta">
                  {p.escaneos}
                  <span className="ml-1.5 text-[0.85rem] font-semibold text-frio">toques en total</span>
                </p>
                <p className="text-[0.84rem] text-tinta-2">{esteMes} este mes</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
                p.estado === "activa" ? "bg-ok/12 text-ok" : "bg-arena text-frio"
              }`}>
                {p.estado === "activa" ? "Activa" : p.estado === "bloqueada" ? "De baja" : "Sin activar"}
              </span>
            </div>

            {/* Escaneos por mes (últimos 6) */}
            <div className="mt-4 flex items-end gap-2">
              {meses.map((m) => {
                const v = p.porMes[m] ?? 0;
                return (
                  <div key={m} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[0.68rem] font-semibold text-frio">{v}</span>
                    <div
                      className="w-full rounded-t bg-brasa/70"
                      style={{ height: `${Math.max(3, (v / max) * 48)}px` }}
                    />
                    <span className="text-[0.66rem] text-frio">
                      {NOMBRE_MES[Number(m.slice(5)) - 1]}
                    </span>
                  </div>
                );
              })}
            </div>

            {p.estado === "activa" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.84rem]">
                {p.reviewUrl && (
                  <a href={p.reviewUrl} target="_blank" rel="noreferrer" className="font-semibold text-brasa-texto">
                    Ver formulario de reseñas ↗
                  </a>
                )}
                <button
                  onClick={() => { setEditando(editando === p.uid ? null : p.uid); setResultados([]); setConsulta(""); }}
                  className="font-semibold text-tinta-2 hover:text-tinta"
                >
                  Cambiar destino
                </button>
                <button onClick={() => baja(p.uid)} className="font-semibold text-frio hover:text-alerta">
                  Dar de baja
                </button>
              </div>
            )}

            {/* Cambiar destino: buscar la ficha nueva de Google */}
            {editando === p.uid && (
              <div className="mt-3 space-y-2 rounded-tarjeta bg-arena/40 p-3">
                <p className="text-[0.82rem] text-tinta-2">
                  Busca la ficha de Google a la que deben ir las reseñas (mudanza, ficha nueva):
                </p>
                <div className="flex gap-2">
                  <input
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                    placeholder="Nombre del negocio y ciudad"
                    className="flex-1 rounded-tarjeta bg-carta px-3 py-2 text-[0.88rem] text-tinta ring-1 ring-linea focus:ring-brasa/40"
                  />
                  <button
                    onClick={buscar}
                    disabled={buscando || !consulta.trim()}
                    className="rounded-chip bg-brasa px-4 py-2 text-[0.84rem] font-semibold text-sobre-brasa disabled:opacity-50"
                  >
                    {buscando ? "…" : "Buscar"}
                  </button>
                </div>
                {resultados.map((n) => (
                  <button
                    key={n.placeId}
                    onClick={() => cambiar(p.uid, n)}
                    className="w-full rounded-tarjeta bg-carta px-3 py-2.5 text-left ring-1 ring-linea transition hover:ring-brasa/50"
                  >
                    <p className="text-[0.88rem] font-bold text-tinta">{n.nombre}</p>
                    {n.direccion && <p className="text-[0.76rem] text-frio">{n.direccion}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
        💡 ¿Quieres más placas para tu mostrador o tus mesas? Escríbenos y te las llevamos.
      </div>
    </div>
  );
}
