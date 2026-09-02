"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  misPlacas, cambiarDestinoPlaca, bajaPlaca, negociosParaPlaca,
  resumenFidelidad, canjearCodigoFidelidad, registroAcceso,
  type PlacaMia, type NegocioGooglePlaca, type ResumenFidelidad, type EventoAcceso,
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

  // Pestañas del mundo placa (2026-09-02): las placas físicas + el programa
  // de fidelidad + el registro de la puerta, todo en un solo lugar.
  const [pestana, setPestana] = useState<"placas" | "fidelidad" | "acceso">("placas");
  const [fidelidad, setFidelidad] = useState<ResumenFidelidad | null | "cargando">("cargando");
  const [acceso, setAcceso] = useState<EventoAcceso[] | null | "cargando">("cargando");
  const [codigoCanje, setCodigoCanje] = useState("");
  const [msgCanje, setMsgCanje] = useState("");

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

  // Las pestañas cargan perezoso: solo al abrirlas (y se recargan al cambiar
  // de negocio enfocado, porque dependen de g.tenantLista).
  useEffect(() => {
    if (!listo || !g.listaLista) return;
    if (pestana === "fidelidad") {
      setFidelidad("cargando");
      resumenFidelidad(g.tenantLista).then(setFidelidad);
    } else if (pestana === "acceso") {
      setAcceso("cargando");
      registroAcceso(g.tenantLista).then(setAcceso);
    }
  }, [pestana, listo, g.listaLista, g.tenantLista]);

  async function canjear() {
    const codigo = codigoCanje.trim().toUpperCase();
    if (!codigo) return;
    const r = await canjearCodigoFidelidad(codigo, g.tenantLista);
    setMsgCanje(r.ok ? `✅ Código ${codigo} canjeado — entrega el premio 🎉` : `✕ ${r.error}`);
    if (r.ok) {
      setCodigoCanje("");
      setFidelidad("cargando");
      resumenFidelidad(g.tenantLista).then(setFidelidad);
    }
  }

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
        <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Placas</h1>
        <p className="mt-1 text-[0.92rem] text-frio">
          Reseñas, sellos de fidelidad y control de acceso — todo con un toque a tu placa.
        </p>
      </header>

      {g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {/* Pestañas del mundo placa */}
      <div className="flex gap-2">
        {([["placas", "🏷️ Mis placas"], ["fidelidad", "🎟️ Fidelidad"], ["acceso", "🚪 Acceso"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            className={`rounded-chip px-4 py-2 text-[0.86rem] font-semibold transition ${
              pestana === id ? "bg-brasa text-sobre-brasa" : "bg-carta text-tinta-2 ring-1 ring-linea hover:text-tinta"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── FIDELIDAD ── */}
      {pestana === "fidelidad" && (
        fidelidad === "cargando" ? <SkeletonLista filas={2} /> :
        !fidelidad ? (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Este negocio no tiene fidelidad activa</p>
            <p className="mt-1 text-[0.88rem] text-frio">Cuando tengas tu placa de sellos, la activamos y aquí verás a tus clientes frecuentes.</p>
          </div>
        ) : (
          <>
            {/* Canje en caja: lo primero que usa el cajero */}
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <h2 className="text-[1.02rem] font-bold text-tinta">Canjear un premio</h2>
              <p className="mt-0.5 text-[0.84rem] text-frio">El cliente te muestra su código — escríbelo y entrega el premio.</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={codigoCanje}
                  onChange={(e) => setCodigoCanje(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") canjear(); }}
                  placeholder="Ej: XK7Q2N"
                  maxLength={6}
                  className="flex-1 rounded-tarjeta bg-fondo px-3 py-2 font-mono text-[1.05rem] tracking-widest text-tinta ring-1 ring-linea focus:ring-brasa/40"
                />
                <button onClick={canjear} disabled={!codigoCanje.trim()} className="rounded-chip bg-brasa px-5 py-2 text-[0.86rem] font-semibold text-sobre-brasa disabled:opacity-50">
                  Canjear
                </button>
              </div>
              {msgCanje && <p className="mt-2 text-[0.86rem] font-semibold text-tinta-2">{msgCanje}</p>}
              {fidelidad.canjesPendientes.length > 0 && (
                <p className="mt-2 text-[0.8rem] text-frio">
                  Pendientes: {fidelidad.canjesPendientes.map((c) => c.codigo).join(" · ")}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
                <p className="text-[0.74rem] font-bold uppercase tracking-wide text-frio">{fidelidad.config.modo === "paquete" ? "En su paquete" : "Juntando sellos"}</p>
                <p className="text-[1.6rem] font-bold text-tinta">{fidelidad.totalClientes}</p>
              </div>
              <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
                <p className="text-[0.74rem] font-bold uppercase tracking-wide text-frio">Cerca del {fidelidad.config.modo === "paquete" ? "final" : "premio"} 🔥</p>
                <p className="text-[1.6rem] font-bold text-tinta">{fidelidad.cercaDelPremio}</p>
              </div>
              <div className="rounded-tarjeta bg-carta p-4 ring-1 ring-linea">
                <p className="text-[0.74rem] font-bold uppercase tracking-wide text-frio">Meta</p>
                <p className="text-[1.6rem] font-bold text-tinta">{fidelidad.config.meta}<span className="text-[0.9rem] text-frio"> {fidelidad.config.modo === "paquete" ? "sesiones" : "visitas"}</span></p>
              </div>
            </div>

            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <h2 className="text-[1.02rem] font-bold text-tinta">Tus clientes frecuentes</h2>
              {fidelidad.clientes.length === 0 ? (
                <p className="mt-2 text-[0.88rem] text-frio">Aún nadie suma {fidelidad.config.modo === "paquete" ? "sesiones" : "sellos"} — apunta la placa a la vista y cuéntaselo a tus clientes.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-[0.86rem]">
                    <thead>
                      <tr className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                        <th className="pb-2">Cliente</th><th className="pb-2">Avance</th><th className="pb-2">Ciclos</th><th className="pb-2">Última visita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fidelidad.clientes.map((c) => (
                        <tr key={c.telefono} className="border-t border-linea">
                          <td className="py-2 font-semibold text-tinta">{c.nombre ?? `…${c.telefono.slice(-6)}`}</td>
                          <td className="py-2 text-tinta-2">{c.sellos} / {fidelidad.config.meta}{c.sellos >= fidelidad.config.meta - 2 ? " 🔥" : ""}</td>
                          <td className="py-2 text-tinta-2">{c.ciclos}</td>
                          <td className="py-2 text-frio">{c.ultimoSelloEn ? new Date(c.ultimoSelloEn).toLocaleDateString("es-PE") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* ── ACCESO ── */}
      {pestana === "acceso" && (
        acceso === "cargando" ? <SkeletonLista filas={2} /> :
        !acceso ? (
          <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
            <p className="text-[1.02rem] font-bold text-tinta">Este negocio no tiene control de acceso activo</p>
            <p className="mt-1 text-[0.88rem] text-frio">Con tu placa de acceso en la puerta, aquí verás quién entró y las marcaciones de tu personal.</p>
          </div>
        ) : (
          <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
            <h2 className="text-[1.02rem] font-bold text-tinta">Registro de hoy</h2>
            {acceso.length === 0 ? (
              <p className="mt-2 text-[0.88rem] text-frio">Todavía no hay toques hoy.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-[0.86rem]">
                  <thead>
                    <tr className="text-[0.72rem] font-bold uppercase tracking-wide text-frio">
                      <th className="pb-2">Hora</th><th className="pb-2">Quién</th><th className="pb-2">Tipo</th><th className="pb-2">Evento</th><th className="pb-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceso.map((e, i) => (
                      <tr key={i} className="border-t border-linea">
                        <td className="py-2 text-tinta-2">{new Date(e.creadoEn).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="py-2 font-semibold text-tinta">{e.nombre ?? `…${e.telefono.slice(-6)}`}</td>
                        <td className="py-2 text-tinta-2">{e.tipoPersona === "socio" ? "Socio" : e.tipoPersona === "personal" ? "Personal" : "—"}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[0.72rem] font-bold ${
                            e.evento === "rechazado" ? "bg-alerta/10 text-alerta" : e.evento === "salida" ? "bg-arena text-tinta-2" : "bg-ok/12 text-ok"
                          }`}>{e.evento}</span>
                        </td>
                        <td className="py-2 text-frio">{e.detalle ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {pestana === "placas" && (<>
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

            {/* Radar de reseñas: lo que la placa le está sumando a su ficha */}
            {p.estado === "activa" && p.resenas && (
              <div className="mt-4 rounded-tarjeta bg-arena/40 px-4 py-3">
                {p.resenas.ganadas > 0 ? (
                  <p className="text-[0.9rem] text-tinta">
                    <span className="font-bold">⭐ {p.resenas.base.total} → {p.resenas.ultimo.total} reseñas</span>{" "}
                    en Google
                    <span className="ml-1.5 rounded-full bg-ok/12 px-2 py-0.5 text-[0.76rem] font-bold text-ok">
                      +{p.resenas.ganadas} desde tu placa
                    </span>
                  </p>
                ) : (
                  <p className="text-[0.9rem] text-tinta">
                    <span className="font-bold">⭐ {p.resenas.ultimo.total} reseñas</span> en Google
                    {typeof p.resenas.ultimo.rating === "number" && (
                      <span className="ml-1.5 text-[0.84rem] text-tinta-2">· {p.resenas.ultimo.rating.toFixed(1)}</span>
                    )}
                    <span className="ml-1.5 text-[0.8rem] text-frio">— seguimos tu progreso semana a semana</span>
                  </p>
                )}
              </div>
            )}

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
      </>)}
    </div>
  );
}
