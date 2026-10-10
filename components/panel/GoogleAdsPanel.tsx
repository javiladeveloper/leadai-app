"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApiError, conectarGoogleAds, desconectarGoogleAds, estadoGoogleAds, metricasGoogleAds, urlConexionGoogleAds,
  type CuentaGoogleAds, type EstadoGoogleAds, type MetricasGoogleAds,
} from "@/lib/api";
import { soles } from "@/lib/dinero";

/**
 * GOOGLE ADS EN MARKETING (2026-10-05, pedido de Jonathan: "¿podemos ver las
 * métricas de Google Ads desde LeadAI?").
 *
 * Solo LECTURA: el dueño conecta su cuenta y ve, junto a sus leads, cuánto
 * gastó, qué buscó la gente y — lo que Google Ads no sabe — cuántos de esos
 * clics terminaron en un contacto o una demo en LeadAI (la landing marca los
 * que llegaron por un anuncio de Google).
 */

const RANGOS = [7, 14, 30, 90] as const;

function dinero(v: number, moneda: string): string {
  // En soles, el formato único de la web (lib/dinero.ts, 2026-10-09).
  if (moneda === "PEN") return soles(v);
  const simbolo = moneda === "PEN" ? "S/" : moneda === "USD" ? "US$" : moneda ? `${moneda} ` : "";
  return `${simbolo}${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const entero = (v: number) => v.toLocaleString("es-PE", { maximumFractionDigits: 0 });

export function GoogleAdsPanel({ tenant }: { tenant?: string }) {
  const [estado, setEstado] = useState<EstadoGoogleAds | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    const e = await estadoGoogleAds(tenant);
    setEstado(e);
    setCargando(false);
    return e;
  }, [tenant]);

  useEffect(() => { setCargando(true); void recargar(); }, [recargar]);

  if (cargando) return <p role="status" className="p-2 text-frio">Cargando Google Ads…</p>;
  if (!estado) return <p className="rounded-tarjeta bg-carta p-6 text-tinta-2 ring-1 ring-linea">No pudimos consultar Google Ads. Recarga la página.</p>;
  if (!estado.conectado) return <ConectarGoogleAds tenant={tenant} estado={estado} onCambio={recargar} />;
  return <MetricasGoogle tenant={tenant} estado={estado} onDesconectar={recargar} />;
}

function ConectarGoogleAds({ tenant, estado, onCambio }: { tenant?: string; estado: EstadoGoogleAds; onCambio: () => Promise<EstadoGoogleAds | null> }) {
  const [esperando, setEsperando] = useState(false);
  const [cuenta, setCuenta] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sondeo = useRef<number | null>(null);
  const opciones: CuentaGoogleAds[] | null = estado.opciones;

  useEffect(() => {
    if (opciones?.length && !cuenta) setCuenta(opciones[0].id);
  }, [opciones, cuenta]);
  useEffect(() => () => { if (sondeo.current !== null) window.clearInterval(sondeo.current); }, []);

  async function conectar() {
    setError(null);
    const url = await urlConexionGoogleAds(tenant);
    if (!url) { setError("No pudimos abrir Google. Vuelve a intentarlo."); return; }
    const popup = window.open(url, "google-ads", "width=560,height=720");
    if (!popup) { window.location.href = url; return; }
    setEsperando(true);
    // Google vuelve al servidor, no al panel: se pregunta cada 2 s si ya hay
    // cuentas para elegir. A los 5 minutos se deja de esperar.
    const inicio = Date.now();
    if (sondeo.current !== null) window.clearInterval(sondeo.current);
    sondeo.current = window.setInterval(async () => {
      if (Date.now() - inicio > 5 * 60_000) { window.clearInterval(sondeo.current!); setEsperando(false); return; }
      const e = await onCambio();
      if (e?.opciones?.length || e?.conectado) { window.clearInterval(sondeo.current!); setEsperando(false); }
    }, 2000);
  }

  async function guardar() {
    if (!cuenta || guardando) return;
    setGuardando(true);
    setError(null);
    const r = await conectarGoogleAds(cuenta, tenant);
    setGuardando(false);
    if (r.ok) await onCambio();
    else setError(r.error);
  }

  if (opciones && opciones.length > 0) {
    return (
      <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
        <h3 className="text-[1.15rem] font-bold text-tinta">Elige tu cuenta de Google Ads</h3>
        <p className="mt-1.5 text-[0.9rem] text-frio">Estas son las cuentas a las que tiene acceso {estado.correo ?? "tu cuenta de Google"}.</p>
        <div className="mt-4 space-y-1.5">
          {opciones.map((c) => (
            <label
              key={c.id}
              className={`flex cursor-pointer items-center gap-3 rounded-chip px-3 py-2.5 ring-1 transition ${
                cuenta === c.id ? "bg-brasa-suave/40 ring-brasa/40" : "bg-arena/40 ring-linea hover:bg-arena/70"
              }`}
            >
              <input type="radio" name="cuenta-google" checked={cuenta === c.id} onChange={() => setCuenta(c.id)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.88rem] font-semibold text-tinta">{c.nombre}</span>
                <span className="text-[0.74rem] text-frio">{c.id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}{c.moneda ? ` · ${c.moneda}` : ""}</span>
              </span>
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-[0.84rem] font-semibold text-calor-hondo">{error}</p>}
        <button
          onClick={guardar}
          disabled={!cuenta || guardando}
          className="mt-5 inline-flex rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
        >
          {guardando ? "Conectando…" : "Ver esta cuenta"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
      <h3 className="text-[1.15rem] font-bold text-tinta">Tus anuncios de Google, junto a tus clientes</h3>
      <p className="mt-1.5 max-w-[60ch] text-[0.9rem] text-frio">
        Conecta tu cuenta de Google Ads y vas a ver aquí cuánto gastas, qué busca la gente que llega a ti
        y cuántos de esos clics terminan en un cliente de verdad.
      </p>
      <ul className="mt-4 space-y-2.5">
        {[
          ["💸", "Cuánto gastas y cuánto cuesta cada clic", "Por campaña, sin entrar a Google Ads."],
          ["🔎", "Qué escribió la gente en Google", "Las búsquedas reales que trajeron visitas."],
          ["🤝", "Cuántos contactos y demos te trajo Google", "Y cuánto te costó cada uno."],
        ].map(([icono, titulo, bajada]) => (
          <li key={titulo} className="flex gap-2.5">
            <span aria-hidden className="text-[1rem] leading-tight">{icono}</span>
            <span className="text-[0.86rem] text-tinta-2">
              <strong className="font-semibold text-tinta">{titulo}</strong>
              <span className="block text-frio">{bajada}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        onClick={conectar}
        disabled={esperando || !estado.disponible}
        className="mt-5 inline-flex rounded-chip bg-brasa px-4 py-2.5 text-[0.88rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-60"
      >
        {esperando ? "Esperando a Google…" : "Conectar Google Ads"}
      </button>
      {esperando && (
        <p className="mt-2 text-[0.8rem] text-frio">Termina la autorización en la ventana de Google. Cuando vuelvas, aquí eliges la cuenta.</p>
      )}
      {error && <p className="mt-2 text-[0.84rem] font-semibold text-calor-hondo">{error}</p>}
      <p className="mt-3 text-[0.8rem] text-frio">Solo leemos tus métricas: LeadAI no crea ni cambia tus campañas.</p>
    </div>
  );
}

function MetricasGoogle({ tenant, estado, onDesconectar }: { tenant?: string; estado: EstadoGoogleAds; onDesconectar: () => Promise<unknown> }) {
  const [dias, setDias] = useState<number>(30);
  const [m, setM] = useState<MetricasGoogleAds | null>(null);
  const [error, setError] = useState<{ texto: string; reconectar: boolean } | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    metricasGoogleAds(dias, tenant)
      .then((r) => { if (vivo) setM(r); })
      .catch((e) => {
        if (!vivo) return;
        const reconectar = e instanceof ApiError && e.status === 409;
        setError({ texto: e instanceof Error ? e.message : "No pudimos leer Google Ads.", reconectar });
      })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [dias, tenant]);

  async function desconectar() {
    if (!window.confirm("¿Desconectar Google Ads de LeadAI? Tus campañas en Google siguen igual.")) return;
    await desconectarGoogleAds(tenant);
    await onDesconectar();
  }

  const moneda = m?.cuenta.moneda ?? estado.cuenta?.moneda ?? "";
  const maxCosto = Math.max(1, ...(m?.dias ?? []).map((d) => d.costo));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[1.15rem] font-bold text-tinta">Google Ads · {estado.cuenta?.nombre}</h3>
          <p className="text-[0.8rem] text-frio">
            Cuenta {estado.cuenta?.idLegible}{m ? ` · actualizado ${new Date(m.actualizadoEn).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Periodo">
          {RANGOS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              aria-pressed={dias === d}
              className={`rounded-chip px-3 py-1.5 text-[0.8rem] font-bold ring-1 transition ${dias === d ? "bg-superficie-honda text-carta ring-superficie-honda" : "bg-carta text-tinta-2 ring-linea hover:bg-arena"}`}
            >
              {d} días
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-tarjeta bg-carta p-6 ring-1 ring-linea">
          <p className="font-semibold text-tinta">{error.texto}</p>
          {error.reconectar && (
            <button onClick={desconectar} className="mt-3 rounded-chip bg-brasa px-4 py-2 text-[0.86rem] font-bold text-sobre-brasa">Reconectar Google Ads</button>
          )}
        </div>
      ) : cargando || !m ? (
        <p role="status" className="text-frio">Leyendo tus anuncios de Google…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra titulo="Gastaste" valor={dinero(m.total.costo, moneda)} nota={`${entero(m.total.impresiones)} veces visto`} />
            <Cifra titulo="Clics" valor={entero(m.total.clics)} nota={`${dinero(m.total.cpc, moneda)} por clic · ${m.total.ctr}% lo tocó`} />
            <Cifra
              titulo="Contactos desde Google"
              valor={entero(m.contactos.total)}
              nota={m.contactos.costoPorContacto != null ? `${dinero(m.contactos.costoPorContacto, moneda)} cada uno` : "Aún ninguno en LeadAI"}
              destacado
            />
            <Cifra titulo="Demos agendadas" valor={entero(m.contactos.demos)} nota={`${m.total.conversiones} conversiones en Google`} />
          </div>

          {m.dias.length > 1 && (
            <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
              <p className="text-[0.86rem] font-bold text-tinta">Gasto por día</p>
              <div className="mt-3 flex h-28 items-end gap-[3px]" aria-label="Gasto por día">
                {m.dias.map((d) => (
                  <div
                    key={d.fecha}
                    title={`${d.fecha}: ${dinero(d.costo, moneda)} · ${d.clics} clics`}
                    className="min-w-[4px] flex-1 rounded-t bg-brasa/70 hover:bg-brasa"
                    style={{ height: `${Math.max(2, (d.costo / maxCosto) * 100)}%` }}
                  />
                ))}
              </div>
            </div>
          )}

          <AvisoCuota campanias={m.campanias} />

          <Tabla
            titulo="Campañas"
            vacio="Sin campañas con actividad en este periodo."
            cabeza={["Campaña", "Estado", "Gasto", "Clics", "Costo/clic", "Apareciste", "Conv."]}
            filas={m.campanias.map((c) => [
              c.nombre, c.estado, dinero(c.costo, moneda), entero(c.clics), dinero(c.cpc, moneda),
              c.cuota?.aparecio != null ? `${c.cuota.aparecio}%` : "—", String(c.conversiones),
            ])}
            nota="«Apareciste»: de cada 100 búsquedas que calzaban con tus palabras, en cuántas salió tu anuncio. Google lo calcula cuando junta suficientes datos."
          />

          {(m.grupos?.length ?? 0) > 0 && (
            <Tabla
              titulo="Por especialidad"
              vacio=""
              cabeza={["Grupo", "Visto", "Clics", "Lo tocó", "Gasto", "Conv."]}
              filas={m.grupos!.map((g) => [
                g.nombre, entero(g.impresiones), entero(g.clics), `${g.ctr}%`, dinero(g.costo, moneda), String(g.conversiones),
              ])}
              apagadas={m.grupos!.map((g) => g.impresiones === 0)}
              nota={m.grupos!.some((g) => g.impresiones === 0) ? "Las filas en gris no salieron en ninguna búsqueda: sus palabras casi no se buscan o compiten con otras." : undefined}
            />
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Barras
              titulo="Dónde te vieron"
              vacio="Google todavía no reporta ciudades."
              filas={(m.ciudades ?? []).map((c) => ({ etiqueta: c.ciudad, valor: c.impresiones, detalle: `${entero(c.impresiones)} vistas · ${entero(c.clics)} clics` }))}
            />
            <Barras
              titulo="Desde qué aparato"
              vacio="Google todavía no reporta aparatos."
              filas={(m.dispositivos ?? []).map((d) => ({
                etiqueta: d.dispositivo.charAt(0).toUpperCase() + d.dispositivo.slice(1),
                valor: d.impresiones,
                detalle: `${entero(d.impresiones)} vistas · ${entero(d.clics)} clics · ${dinero(d.costo, moneda)}`,
              }))}
            />
            <Horas horas={m.horas ?? []} />
            <Conversiones tipos={m.conversionesPorTipo ?? []} />
          </div>

          {(m.palabras?.length ?? 0) > 0 && (
            <Tabla
              titulo="Tus palabras clave"
              vacio=""
              cabeza={["Palabra", "Visto", "Clics", "Gasto", "Calidad"]}
              filas={m.palabras!.map((p) => [
                <span key="p">
                  {p.texto}
                  <span className="block text-[0.72rem] font-normal text-frio">{p.grupo} · {p.concordancia}</span>
                </span>,
                entero(p.impresiones), entero(p.clics), dinero(p.costo, moneda),
                p.calidad != null ? `${p.calidad}/10` : "—",
              ])}
              nota="Calidad: la nota de 1 a 10 que Google le pone a cada palabra (más alta = pagas menos por clic). Aparece cuando la palabra junta suficientes búsquedas."
            />
          )}

          <Tabla
            titulo="Qué buscó la gente"
            vacio="Google todavía no reporta búsquedas para este periodo."
            cabeza={["Búsqueda", "Visto", "Clics", "Gasto", "Conv."]}
            filas={m.busquedas.map((b) => [b.termino, entero(b.impresiones), entero(b.clics), dinero(b.costo, moneda), String(b.conversiones)])}
            nota="Lo que la gente escribió de verdad. Si ves búsquedas que no son de clientes (empleo, cursos, gratis), conviene excluirlas."
          />
          <p className="text-[0.76rem] text-frio">
            Los contactos desde Google son los que llegaron a LeadAI desde tu web después de entrar por un anuncio. Google Ads
            actualiza con algunas horas de demora.
          </p>
        </>
      )}

      <button onClick={desconectar} className="text-[0.8rem] font-semibold text-frio underline-offset-2 hover:underline">
        Desconectar Google Ads
      </button>
    </div>
  );
}

function Cifra({ titulo, valor, nota, destacado }: { titulo: string; valor: string; nota: string; destacado?: boolean }) {
  return (
    <div className={`rounded-tarjeta p-4 ring-1 ${destacado ? "bg-brasa-suave/40 ring-brasa/30" : "bg-carta ring-linea"}`}>
      <p className="text-[0.76rem] font-semibold text-frio">{titulo}</p>
      <p className="mt-1 text-[1.45rem] font-bold tabular-nums text-tinta">{valor}</p>
      <p className="mt-0.5 text-[0.74rem] text-frio">{nota}</p>
    </div>
  );
}

function Tabla({ titulo, cabeza, filas, vacio, nota, apagadas }: {
  titulo: string; cabeza: string[]; filas: ReactNode[][]; vacio: string; nota?: string;
  /** Filas sin actividad: se muestran pero en gris, para que salte lo que sí rinde. */
  apagadas?: boolean[];
}) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.86rem] font-bold text-tinta">{titulo}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-[0.84rem] text-frio">{vacio}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[0.84rem]">
            <thead>
              <tr className="text-[0.74rem] text-frio">
                {cabeza.map((c, i) => <th key={c} className={`pb-2 font-semibold ${i > 0 ? "text-right" : ""}`}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} className={`border-t border-linea ${apagadas?.[i] ? "opacity-50" : ""}`}>
                  {f.map((celda, j) => (
                    <td key={j} className={`py-2 tabular-nums ${j === 0 ? "pr-3 font-semibold text-tinta" : "text-right text-tinta-2"}`}>{celda}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nota && filas.length > 0 && <p className="mt-3 text-[0.74rem] text-frio">{nota}</p>}
    </div>
  );
}

/**
 * Lo único accionable que Google calcula solo: si te estás perdiendo búsquedas
 * por PLATA (subir el presupuesto) o por RANKING (mejorar anuncio/puja). Se
 * muestra solo cuando pasa del 20 %: un aviso permanente se deja de leer.
 */
function AvisoCuota({ campanias }: { campanias: MetricasGoogleAds["campanias"] }) {
  const avisos = campanias.flatMap((c) => {
    const q = c.cuota;
    if (!q) return [];
    const out: string[] = [];
    if ((q.perdidaPresupuesto ?? 0) >= 20) {
      out.push(`«${c.nombre}» no salió en ${q.perdidaPresupuesto}% de las búsquedas porque se acabó el presupuesto del día. Subirlo trae más clics al mismo costo.`);
    }
    if ((q.perdidaRanking ?? 0) >= 20) {
      out.push(`«${c.nombre}» no salió en ${q.perdidaRanking}% de las búsquedas porque otros anuncios quedaron mejor posicionados. Mejorar los textos o el tope por clic ayuda.`);
    }
    return out;
  });
  if (avisos.length === 0) return null;
  return (
    <div className="rounded-tarjeta bg-calor-suave/50 p-4 ring-1 ring-calor/30">
      {avisos.map((a) => <p key={a} className="text-[0.86rem] font-semibold text-tinta">{a}</p>)}
    </div>
  );
}

function Barras({ titulo, filas, vacio }: { titulo: string; vacio: string; filas: Array<{ etiqueta: string; valor: number; detalle: string }> }) {
  const max = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.86rem] font-bold text-tinta">{titulo}</p>
      {filas.length === 0 ? (
        <p className="mt-2 text-[0.84rem] text-frio">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filas.map((f) => (
            <li key={f.etiqueta}>
              <div className="flex items-baseline justify-between gap-3 text-[0.82rem]">
                <span className="truncate font-semibold text-tinta">{f.etiqueta}</span>
                <span className="shrink-0 tabular-nums text-frio">{f.detalle}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-arena">
                <div className="h-full rounded-full bg-brasa/70" style={{ width: `${Math.max(3, (f.valor / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Las 24 horas siempre, aunque Google solo mande las que tuvieron vistas: así se ve el hueco. */
function Horas({ horas }: { horas: NonNullable<MetricasGoogleAds["horas"]> }) {
  const porHora = new Map(horas.map((h) => [h.hora, h]));
  const max = Math.max(1, ...horas.map((h) => h.impresiones));
  const pico = horas.length ? horas.reduce((a, b) => (b.impresiones > a.impresiones ? b : a)) : null;
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.86rem] font-bold text-tinta">A qué hora te buscan</p>
      {horas.length === 0 ? (
        <p className="mt-2 text-[0.84rem] text-frio">Google todavía no reporta horas.</p>
      ) : (
        <>
          <div className="mt-3 flex h-20 items-end gap-[2px]" aria-label="Vistas por hora del día">
            {Array.from({ length: 24 }, (_, h) => {
              const d = porHora.get(h);
              return (
                <div
                  key={h}
                  title={`${h}:00 · ${d?.impresiones ?? 0} vistas · ${d?.clics ?? 0} clics`}
                  className={`flex-1 rounded-t ${d ? "bg-brasa/70 hover:bg-brasa" : "bg-arena"}`}
                  style={{ height: `${d ? Math.max(6, (d.impresiones / max) * 100) : 4}%` }}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[0.7rem] tabular-nums text-frio">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
          {pico && <p className="mt-2 text-[0.78rem] text-frio">Más vistas a las {pico.hora}:00 ({entero(pico.impresiones)}).</p>}
        </>
      )}
    </div>
  );
}

function Conversiones({ tipos }: { tipos: NonNullable<MetricasGoogleAds["conversionesPorTipo"]> }) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <p className="text-[0.86rem] font-bold text-tinta">Qué hicieron después del clic</p>
      {tipos.length === 0 ? (
        <p className="mt-2 text-[0.84rem] text-frio">
          Todavía nadie escribió por WhatsApp, llamó ni agendó desde un anuncio en este periodo. Cuando pase, aparece aquí separado por acción.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {tipos.map((t) => (
            <li key={t.nombre} className="flex items-baseline justify-between gap-3 border-t border-linea pt-2 text-[0.84rem] first:border-t-0 first:pt-0">
              <span className="font-semibold text-tinta">{t.nombre}</span>
              <span className="tabular-nums text-tinta-2">{t.conversiones}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
