"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminResumenPlacas, adminAltaLotePlacas, adminResetPinPlaca, adminLiberarPlaca,
  type PlacaAdmin,
} from "@/lib/api";

/**
 * OPERACIÓN DE PLACAS NFC (super admin, 2026-08-29).
 *
 * 1. ALTA DE LOTE: al recibir una caja de fábrica se pega el CSV de UIDs (o
 *    los UIDs escaneados, uno por línea), se elige lote y marca, y el sistema
 *    devuelve el PIN de cada placa — UNA sola vez — listo para imprimir las
 *    tarjetitas del empaque en el MISMO ORDEN de la caja.
 * 2. INVENTARIO: vendidas vs activadas por marca, y por placa: reset de PIN
 *    (comprador lo perdió) y liberar (cambio de dueño).
 */
export default function AdminPlacas() {
  const [resumen, setResumen] = useState<Awaited<ReturnType<typeof adminResumenPlacas>>>(null);
  const [cargando, setCargando] = useState(true);

  // Alta de lote
  const [uidsCrudos, setUidsCrudos] = useState("");
  const [lote, setLote] = useState("");
  const [marca, setMarca] = useState("leadai");
  const [registrando, setRegistrando] = useState(false);
  const [resultado, setResultado] = useState<{ registradas: { uid: string; pin: string }[]; invalidas: string[]; yaExistian: string[] } | null>(null);

  const [msg, setMsg] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setResumen(await adminResumenPlacas());
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function registrarLote() {
    // Acepta UIDs separados por líneas, comas o punto y coma (CSV de fábrica).
    const uids = uidsCrudos.split(/[\n,;]+/).map((u) => u.trim()).filter(Boolean);
    if (uids.length === 0 || registrando) return;
    setRegistrando(true);
    setMsg("");
    const r = await adminAltaLotePlacas({ uids, lote: lote.trim() || undefined, marca });
    setRegistrando(false);
    if (!r) { setMsg("No se pudo registrar el lote."); return; }
    setResultado(r);
    setUidsCrudos("");
    cargar();
  }

  async function resetPin(uid: string) {
    const r = await adminResetPinPlaca(uid);
    setMsg(r.ok ? `PIN nuevo de ${uid.slice(-6)}: ${r.pin} (apúntalo, no se repite)` : r.error ?? "No se pudo");
  }

  async function liberar(uid: string) {
    if (!window.confirm(`¿Liberar la placa ${uid}? Pierde dueño y destino, y se genera un PIN nuevo para el próximo comprador.`)) return;
    const r = await adminLiberarPlaca(uid);
    setMsg(r.ok ? `Placa ${uid.slice(-6)} liberada. PIN nuevo: ${r.pin} (apúntalo, no se repite)` : r.error ?? "No se pudo");
    cargar();
  }

  const ESTADO: Record<string, string> = { libre: "🟡 Libre", activa: "🟢 Activa", bloqueada: "⚫ De baja" };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
      <header>
        <h1 className="text-[1.6rem] font-bold text-tinta">Placas NFC</h1>
        <p className="text-[0.9rem] text-frio">
          Alta de lotes (UID → PIN), inventario y operación.
        </p>
      </header>

      {msg && (
        <p className="rounded-tarjeta bg-tibio-suave/60 px-4 py-2.5 text-[0.9rem] font-semibold text-tinta">{msg}</p>
      )}

      {/* ── Alta de lote ── */}
      <section className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
        <h2 className="text-[1.05rem] font-bold text-tinta">Registrar lote</h2>
        <p className="mt-1 text-[0.84rem] text-frio">
          Pega el CSV de UIDs de la fábrica (o los UIDs escaneados), uno por línea o separados por comas.
          Los PINs salen UNA sola vez — imprime las tarjetas antes de cerrar esta pantalla.
        </p>
        <textarea
          value={uidsCrudos}
          onChange={(e) => setUidsCrudos(e.target.value)}
          rows={5}
          placeholder={"04A2B3C4D5E680\n04B7C0D1E2F398\n…"}
          className="mt-3 w-full resize-y rounded-tarjeta bg-arena/60 px-3 py-2.5 font-mono text-[0.85rem] text-tinta ring-1 ring-linea focus:ring-brasa/40"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            placeholder="Lote (ej. 2026-09-china-1)"
            className="rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.88rem] text-tinta ring-1 ring-linea focus:ring-brasa/40"
          />
          <select
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="rounded-tarjeta bg-arena/60 px-3 py-2 text-[0.88rem] text-tinta ring-1 ring-linea"
          >
            <option value="leadai">Diseño LeadAI (restaurantes)</option>
            <option value="sania">Diseño Sania (clínicas)</option>
            <option value="fitcore">Diseño FitCore (gimnasios)</option>
          </select>
          <button
            onClick={registrarLote}
            disabled={registrando || !uidsCrudos.trim()}
            className="rounded-chip bg-brasa px-5 py-2 text-[0.9rem] font-semibold text-sobre-brasa disabled:opacity-50"
          >
            {registrando ? "Registrando…" : "Registrar y generar PINs"}
          </button>
        </div>

        {resultado && (
          <div className="mt-4 space-y-3">
            {resultado.registradas.length > 0 && (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[0.9rem] font-bold text-tinta">
                    {resultado.registradas.length} placas registradas — sus PINs (una sola vez):
                  </p>
                  <button
                    onClick={() => window.print()}
                    className="rounded-chip bg-arena px-4 py-1.5 text-[0.82rem] font-semibold text-tinta-2 hover:bg-linea"
                  >
                    🖨 Imprimir tarjetas
                  </button>
                </div>
                {/* Tarjetitas: en pantalla, grilla; al imprimir, tarjetas
                    recortables en el orden del CSV (= el orden de la caja). */}
                <div className="mt-2 grid grid-cols-2 gap-2 print:grid-cols-3 sm:grid-cols-3 lg:grid-cols-4">
                  {resultado.registradas.map((p, i) => (
                    <div key={p.uid} className="rounded-tarjeta border border-dashed border-linea p-3 text-center">
                      <p className="text-[0.66rem] text-frio">#{i + 1} · …{p.uid.slice(-6)}</p>
                      <p className="text-[0.72rem] font-semibold text-tinta-2">PIN de activación</p>
                      <p className="font-mono text-[1.25rem] font-bold tracking-[0.2em] text-tinta">{p.pin}</p>
                      <p className="text-[0.62rem] text-frio">Actívala tocando la placa con tu celular</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {resultado.yaExistian.length > 0 && (
              <p className="text-[0.82rem] text-tinta-2">Ya existían (sin cambios): {resultado.yaExistian.join(", ")}</p>
            )}
            {resultado.invalidas.length > 0 && (
              <p className="text-[0.82rem] text-alerta-hondo">UIDs inválidos: {resultado.invalidas.join(", ")}</p>
            )}
          </div>
        )}
      </section>

      {/* ── Inventario ── */}
      <section className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-[1.05rem] font-bold text-tinta">Inventario</h2>
          {resumen && (
            <p className="text-[0.84rem] text-frio">
              {resumen.total} placas · <b className="text-tinta">{resumen.activas} activas</b> · {resumen.libres} libres · {resumen.bloqueadas} de baja
            </p>
          )}
        </div>
        {cargando && <p className="mt-3 text-[0.85rem] text-frio">Cargando…</p>}
        {!cargando && resumen && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[0.84rem]">
              <thead>
                <tr className="border-b border-linea text-[0.72rem] uppercase tracking-wide text-frio">
                  <th className="py-2 pr-3">UID</th>
                  <th className="py-2 pr-3">Marca</th>
                  <th className="py-2 pr-3">Lote</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Negocio</th>
                  <th className="py-2 pr-3">Toques</th>
                  <th className="py-2 pr-3">Activada</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {resumen.placas.map((p: PlacaAdmin) => (
                  <tr key={p.uid} className="border-b border-linea/60">
                    <td className="py-2 pr-3 font-mono text-[0.78rem]">{p.uid}</td>
                    <td className="py-2 pr-3">{p.marca ?? "—"}</td>
                    <td className="py-2 pr-3">{p.lote ?? "—"}</td>
                    <td className="py-2 pr-3">{ESTADO[p.estado] ?? p.estado}</td>
                    <td className="py-2 pr-3">{p.tenant?.nombre ?? "—"}</td>
                    <td className="py-2 pr-3">{p.escaneos}</td>
                    <td className="py-2 pr-3">
                      {p.activadaEn ? new Date(p.activadaEn).toLocaleDateString("es-PE") : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {p.estado === "libre" && (
                        <button onClick={() => resetPin(p.uid)} className="font-semibold text-brasa-texto hover:underline">
                          Reset PIN
                        </button>
                      )}
                      {p.estado !== "libre" && (
                        <button onClick={() => liberar(p.uid)} className="font-semibold text-frio hover:text-alerta">
                          Liberar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
