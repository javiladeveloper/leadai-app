"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { metricasAds, type MetricasAds, type AnuncioMetricas, cambiarEstadoAnuncio, cambiarEstadoCampania } from "@/lib/api";
import { ErrorMarketing, importeMarketing, periodoCoincide, type MetadatosMarketing, useLecturaMarketing } from "./marketing-lectura";

/**
 * TUS ANUNCIOS DE META, SIN ENTRAR A META (2026-09-17, pedido de Jonathan:
 * "trae todo lo importante para ver y no tenga tanta necesidad de ir a Meta").
 *
 * Meta muestra `reach`, `frequency`, `CPM` y `CTR` sin explicar ninguno, y
 * quien no vive en el Ads Manager no sabe cuál mirar ni qué número es bueno.
 * Acá cada dato viene con su significado en palabras y su veredicto.
 *
 * LA IMAGEN Y EL TEXTO VAN PRIMERO, antes que los números. "estatico_2" es un
 * nombre que no le recuerda nada al dueño dos semanas después; viendo la pieza
 * sabe de cuál habla sin abrir nada.
 *
 * EL ORDEN CAMBIA RESPECTO DEL ADS MANAGER: Meta ordena por gasto, acá manda a
 * cuánta gente llegó. El gasto va al lado, no al frente.
 *
 * Incluye lo creado en el Ads Manager, que es como lo hace la mayoría.
 */
export function MetricasAnuncios({ tenant, dias = 30 }: { tenant?: string; dias?: number } = {}) {
  return <MetricasContenido key={`${tenant ?? "activa"}:${dias}`} tenant={tenant} dias={dias} />;
}

function MetricasContenido({ tenant, dias }: { tenant?: string; dias: number }) {
  const cargar = useCallback(() => metricasAds(tenant, dias), [tenant, dias]);
  const { datos: m, cargando, error, reintentar } = useLecturaMarketing<(MetricasAds & MetadatosMarketing) | null>(`${tenant}:${dias}`, cargar);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [campania, setCampania] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [orden, setOrden] = useState("gasto");
  const [limite, setLimite] = useState(20);
  /**
   * QUE ANUNCIOS MIRAR (2026-09-17, pedido de Jonathan: "necesitamos mas
   * filtros").
   *
   * Con una campana nueva por semana la lista crece rapido, y lo que el dueno
   * quiere saber casi siempre es una de dos cosas: que esta corriendo AHORA, o
   * cual de los que ya terminaron funciono. Mezclarlos obliga a leer estado por
   * estado.
   */
  const [filtro, setFiltro] = useState<'corriendo' | 'todos'>('corriendo');

  // Se rehace al prender o apagar: el estado que muestra la fila tiene que ser
  // el de Meta, no el que creemos haber dejado.
  if (error) return <ErrorMarketing mensaje={error} reintentar={reintentar} />;

  if (cargando) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  if (!m) {
    return (
      <Marco>
        <p className="mt-1 text-[0.85rem] text-frio">
          Conecta tu cuenta publicitaria y vas a ver acá cuánto gastaste, a
          cuánta gente llegaste y qué anuncio funciona — sin entrar al
          administrador de Meta.
        </p>
      </Marco>
    );
  }

  if (!periodoCoincide(m, dias)) return <ErrorMarketing mensaje="No se pudo confirmar el periodo de estas métricas. Vuelve a consultarlas para evitar comparar fechas distintas." reintentar={reintentar} />;
  const importe = (centavos: number) => importeMarketing(centavos, m.moneda);

  /**
   * EL CACHÉ VIEJO NO TIENE LOS CAMPOS NUEVOS.
   *
   * Las métricas se guardan 26 horas en Redis. Hasta el próximo refresco, lo
   * cacheado antes de este cambio no trae `personas` ni la imagen, y pintarlos
   * daría "0 personas" — que se lee como "no llegó a nadie" cuando llegó a
   * cientos. Un cero inventado lleva a apagar un anuncio que funciona.
   */
  const todos = m.anuncios ?? [];
  // "Corriendo" es ACTIVE de verdad: un anuncio encendido dentro de una
  // campana pausada NO se esta mostrando, por mas que su propio estado diga
  // ACTIVE. Ver `estado()` abajo.
  const consulta = busqueda.trim().toLocaleLowerCase("es");
  const anuncios = todos.filter((a) =>
    (filtro !== "corriendo" || a.estado === "ACTIVE") &&
    (!campania || a.campania === campania) && (!estadoFiltro || a.estado === estadoFiltro) &&
    (!consulta || [a.nombre, a.titulo, a.campania].some((s) => s?.toLocaleLowerCase("es").includes(consulta)))
  ).sort((a, b) => orden === "nombre" ? a.nombre.localeCompare(b.nombre, "es") : orden === "costo"
    ? (costoResultado(a) ?? Infinity) - (costoResultado(b) ?? Infinity)
    : b.gastoCentavos - a.gastoCentavos);
  const sinDetalle = todos.length > 0 && todos.every((a) => a.personas === undefined);

  if (todos.length === 0) {
    return (
      <Marco>
        <p className="mt-1 text-[0.85rem] text-frio">
          Tu cuenta está conectada, pero ninguno de tus anuncios tuvo actividad
          en los últimos {dias} días.
        </p>
      </Marco>
    );
  }

  const activos = todos.filter((a) => a.estado === "ACTIVE").length;

  return (
    <Marco derecha={`últimos ${dias} días`}>
      {sinDetalle ? (
        <p className="mt-1 text-[0.88rem] text-tinta-2">
          Gastaste <b className="text-tinta">{importe(m.cuenta.gastoCentavos)}</b>.
          El alcance por anuncio no está disponible en esta lectura.
        </p>
      ) : (
        <p className="mt-1 text-[0.88rem] text-tinta-2">
          Gastaste <b className="text-tinta">{importe(m.cuenta.gastoCentavos)}</b>.
          El alcance se muestra por anuncio; una persona puede aparecer en varios.
          {activos > 0
            ? ` ${activos} ${activos === 1 ? "anuncio está corriendo" : "anuncios están corriendo"} ahora.`
            : " Ninguno está corriendo ahora."}
        </p>
      )}

      {/* DOS VISTAS, NO UN DESPLEGABLE DE SEIS ESTADOS. Lo que el dueño quiere
          saber es una de dos cosas: qué se está mostrando ahora, o cómo le fue
          a todo. Los estados intermedios de Meta (PAUSED, CAMPAIGN_PAUSED,
          ARCHIVED) ya se ven en el chip de cada fila. */}
      <div className="mt-3 flex gap-1.5">
        {([
          ['corriendo', `Corriendo (${activos})`],
          ['todos', `Todos (${todos.length})`],
        ] as const).map(([clave, etiqueta]) => (
          <button
            key={clave}
            type="button"
            onClick={() => { setFiltro(clave); setLimite(20); }}
            aria-pressed={filtro === clave}
            className={`rounded-chip px-3 py-1 text-[0.78rem] font-semibold transition ${
              filtro === clave
                ? "bg-brasa text-sobre-brasa"
                : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-tinta-2">Buscar por nombre o campaña
          <input type="search" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setLimite(20); }} className="mt-1 w-full rounded-lg bg-arena px-3 py-2 text-base ring-1 ring-linea focus-visible:outline-brasa" />
        </label>
        <label className="text-sm text-tinta-2">Campaña
          <select value={campania} onChange={(e) => { setCampania(e.target.value); setLimite(20); }} className="mt-1 w-full rounded-lg bg-arena px-3 py-2 text-base ring-1 ring-linea">
            <option value="">Todas las campañas</option>
            {Array.from(new Set(todos.map((a) => a.campania))).filter(Boolean).map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-sm text-tinta-2">Estado
          <select value={estadoFiltro} onChange={(e) => { setEstadoFiltro(e.target.value); setFiltro("todos"); setLimite(20); }} className="mt-1 w-full rounded-lg bg-arena px-3 py-2 text-base ring-1 ring-linea">
            <option value="">Todos los estados</option>
            {Array.from(new Set(todos.map((a) => a.estado))).filter((e): e is string => Boolean(e)).map((e) => <option key={e} value={e}>{estado(e).texto}</option>)}
          </select>
        </label>
        <label className="text-sm text-tinta-2">Ordenar por
          <select value={orden} onChange={(e) => { setOrden(e.target.value); setLimite(20); }} className="mt-1 w-full rounded-lg bg-arena px-3 py-2 text-base ring-1 ring-linea">
            <option value="gasto">Mayor gasto</option><option value="costo">Menor costo por conversación Meta</option><option value="nombre">Nombre</option>
          </select>
        </label>
      </div>
      {orden === "costo" && <p className="mt-2 text-sm text-frio">Gasto dividido entre conversaciones atribuidas por Meta; los no disponibles van al final. Compara anuncios con el mismo objetivo. No representa citas ni ventas.</p>}

      <div className="mt-3 space-y-2">
        {anuncios.length === 0 && (
          <p className="rounded-lg bg-arena/40 px-3 py-4 text-center text-[0.84rem] text-frio">
            No hay anuncios que coincidan con estos filtros.
          </p>
        )}
        {anuncios.slice(0, limite).map((a) => (
          <Fila
            key={a.adId}
            a={a}
            abierta={abierto === a.adId}
            alTocar={() => setAbierto(abierto === a.adId ? null : a.adId)}
            alCambiar={reintentar}
            tenant={tenant}
            moneda={m.moneda}
          />
        ))}
      </div>

      {anuncios.length > 20 && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-frio">
        <p role="status">Mostrando {Math.min(limite, anuncios.length)} de {anuncios.length} anuncios.</p>
        {limite < anuncios.length && <button type="button" onClick={() => setLimite((n) => n + 20)} className="rounded-chip bg-arena px-3 py-2 font-semibold text-tinta-2 focus-visible:outline-brasa">Ver más anuncios</button>}
      </div>}

      <p className="mt-3 border-t border-linea pt-3 text-[0.78rem] text-frio">
        {m.actualizadoEn ? `Última actualización: ${new Date(m.actualizadoEn).toLocaleString("es-PE")}. ` : "Actualización no disponible. "}
        Incluye anuncios creados aquí y en Facebook.
      </p>
    </Marco>
  );
}

function Marco({ children, derecha }: { children: React.ReactNode; derecha?: string }) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[1.05rem] font-bold text-tinta">Tus anuncios de Facebook e Instagram</h3>
        {derecha && <span className="text-[0.8rem] text-frio">{derecha}</span>}
      </div>
      {children}
    </div>
  );
}

function costoResultado(a: AnuncioMetricas): number | null {
  const conversaciones = (a as AnuncioMetricas & { conversaciones?: number }).conversaciones;
  return typeof conversaciones === "number" && Number.isFinite(conversaciones) && conversaciones > 0 && Number.isFinite(a.gastoCentavos)
    ? Math.round(a.gastoCentavos / conversaciones) : null;
}

function Fila({ a, abierta, alTocar, alCambiar, tenant, moneda }: { a: AnuncioMetricas; abierta: boolean; alTocar: () => void; alCambiar: () => void; tenant?: string; moneda?: string | null }) {
  const id = useId();
  const importe = (centavos: number) => importeMarketing(centavos, moneda);
  const v = veredicto(a);
  const est = estado(a.estado);
  const dias = diasRestantes(a.fin);

  return (
    <div className="rounded-lg bg-arena/40 ring-1 ring-linea">
      <button id={`${id}-boton`} aria-expanded={abierta} aria-controls={`${id}-detalle`} type="button" onClick={alTocar} className="flex w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-brasa">
        {/* LA MINIATURA IDENTIFICA EL ANUNCIO de un vistazo, que es lo que el
            nombre no hace. Sin imagen queda el espacio: alinea las filas. */}
        {a.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imagen} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-linea" />
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-lg bg-arena-2 ring-1 ring-linea" />
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[0.88rem] font-semibold text-tinta">
            {a.titulo?.trim() || a.nombre}
          </span>
          <span className="mt-0.5 block text-[0.78rem] text-frio">
            {a.personas !== undefined ? `${a.personas.toLocaleString("es-PE")} personas · ` : ""}
            {a.clics} {a.clics === 1 ? "clic" : "clics"} · {importe(a.gastoCentavos)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${est.clase}`}>{est.texto}</span>
          <span className={`rounded-chip px-2 py-0.5 text-[0.72rem] font-bold ${v.clase}`}>{v.texto}</span>
        </div>
        <span className="shrink-0 text-frio">{abierta ? "−" : "+"}</span>
      </button>

      {/* EL DETALLE, solo si lo pide. Mostrar ocho datos de entrada a quien no
          sabe qué es un CPM es la razón por la que nadie abre el Ads Manager
          dos veces. */}
      {abierta && (
        <div id={`${id}-detalle`} role="region" aria-labelledby={`${id}-boton`} className="space-y-3 border-t border-linea px-3 py-3">
          {/* PRENDER O APAGAR (2026-09-18). Va PRIMERO porque es lo unico
              accionable del detalle: el resto son numeros para mirar. Antes el
              panel decia "conviene pausarlo" y pausarlo era abrir Meta. */}
          <ControlEncendido key={`${tenant}:${a.adId}`} a={a} alCambiar={alCambiar} tenant={tenant} />
          <p className="text-sm text-frio">Costo por conversación atribuida por Meta: {costoResultado(a) === null ? "No disponible" : importe(costoResultado(a)!)}</p>

          {a.texto && (
            <div>
              <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">Lo que dice tu anuncio</p>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-carta px-3 py-2 text-[0.84rem] text-tinta-2 ring-1 ring-linea">
                {a.texto}
              </p>
            </div>
          )}

          {/* A QUIEN SE LE MUESTRA (2026-09-17). Es lo que el marketero decide
              y el dueño no ve. Va ARRIBA de los números: un anuncio puede
              rendir mal porque apunta a la ciudad equivocada, y eso no se
              deduce de ningún dato de rendimiento. */}
          {a.publico && (
            <div>
              <p className="text-[0.75rem] font-bold uppercase tracking-wide text-frio">A quién se le muestra</p>
              <div className="mt-1 rounded-lg bg-carta px-3 py-2 ring-1 ring-linea">
                <p className="text-[0.84rem] text-tinta">
                  <b>{a.publico.lugares}</b> · {a.publico.edades} · {a.publico.genero}
                </p>
                {/* LA SEGMENTACIÓN DETALLADA (2026-09-18, Jonathan: "también
                    debes mostrar la segmentación"). Intereses, cargos y
                    carreras son lo que más decide a quién le llega, y no se
                    veía nada de eso. */}
                {(a.publico.segmentacion ?? []).map((s) => (
                  <p key={s.tipo} className="mt-1 text-[0.8rem] text-tinta-2">
                    <span className="font-semibold text-tinta">{s.tipo}:</span> {s.valores.join(", ")}
                  </p>
                ))}
                {(a.publico.publicos ?? []).length > 0 && (
                  <p className="mt-1 text-[0.8rem] text-tinta-2">
                    <span className="font-semibold text-tinta">Públicos:</span> {a.publico.publicos!.join(", ")}
                  </p>
                )}
                {(a.publico.excluidos ?? []).length > 0 && (
                  <p className="mt-1 text-[0.8rem] text-tinta-2">
                    <span className="font-semibold text-tinta">No se le muestra a:</span> {a.publico.excluidos!.join(", ")}
                  </p>
                )}
                <p className="mt-1 text-[0.78rem] text-frio">
                  Meta lo optimiza para <b className="text-tinta-2">{a.publico.objetivo}</b>
                  {a.publico.conjunto && ` · conjunto "${a.publico.conjunto}"`}
                </p>
                {/* ADVANTAGE+ (2026-09-18): el panel decía "18 a 65 años" porque
                    leía el control de Meta y no la sugerencia que el marketero
                    ve en el Ads Manager. Con Advantage+ la edad, el género y
                    los intereses son sugerencias; lo único fijo es el mínimo. */}
                {a.publico.publicoAutomatico && (
                  <p className="mt-1 text-[0.78rem] text-frio">
                    Público Advantage+: la edad, el género y los intereses son sugerencias, Meta puede salirse de ellas
                    {a.publico.edadMinima !== undefined && ` (nunca a menores de ${a.publico.edadMinima})`}.
                  </p>
                )}
              </div>
            </div>
          )}

          <dl className="space-y-2.5">
            <Dato
              titulo="Cuándo corre"
              valor={dias !== null ? (dias > 0 ? `${dias} ${dias === 1 ? "día" : "días"} más` : "terminado") : "sin fecha de fin"}
              ayuda={[
                a.inicio ? `Empezó el ${fecha(a.inicio)}` : "",
                a.fin ? `termina el ${fecha(a.fin)}` : "corre hasta que lo apagues",
              ].filter(Boolean).join(", ") + "."}
            />

            {(a.presupuestoTotalCentavos ?? a.presupuestoDiarioCentavos) !== undefined && (
              <Dato
                titulo="Presupuesto"
                valor={importe((a.presupuestoTotalCentavos ?? a.presupuestoDiarioCentavos)!)}
                ayuda={
                  a.presupuestoTotalCentavos !== undefined
                    ? `En total para toda la campaña. Llevas gastado ${importe(a.gastoCentavos)}.`
                    : `Por día. Llevas gastado ${importe(a.gastoCentavos)} en el periodo.`
                }
              />
            )}

            {a.personas !== undefined && (
              <Dato
                titulo="Personas alcanzadas"
                valor={a.personas.toLocaleString("es-PE")}
                ayuda={`Se mostró ${a.impresiones.toLocaleString("es-PE")} veces: cada persona lo vio ${(a.frecuencia ?? 0).toFixed(1)} ${(a.frecuencia ?? 0) < 1.5 ? "vez" : "veces"} en promedio.`}
              />
            )}

            {a.ctr !== undefined && (
              <Dato
                titulo="Clics respecto a impresiones (CTR)"
                valor={`${a.ctr.toFixed(1)}%`}
                ayuda={`${a.clics} clics sobre ${a.impresiones.toLocaleString("es-PE")} impresiones. No representa personas únicas ni ventas.`}
              />
            )}

            {(a.interacciones ?? 0) > 0 && (
              <Dato
                titulo="Reacciones y comentarios"
                valor={String(a.interacciones)}
                ayuda="Interacciones registradas por Meta; no acreditan ventas."
              />
            )}

            <Dato
              titulo="Lo que costó"
              valor={importe(a.gastoCentavos)}
              ayuda={
                (a.cpmCentavos !== undefined
                  ? `${importe(a.cpmCentavos)} por cada mil veces que se mostró`
                  : `${a.impresiones.toLocaleString("es-PE")} veces mostrado`)
                + (a.clics > 0 ? ` · ${importe(Math.round(a.gastoCentavos / a.clics))} por clic` : "")
                + "."
              }
            />

            {(a.frecuencia ?? 0) >= 3 && (
              <p className="rounded-lg bg-tibio-suave px-3 py-2 text-[0.8rem] text-tibio">
                <b>Ojo:</b> la misma gente ya lo vio {(a.frecuencia ?? 0).toFixed(1)} veces.
                Una posible hipótesis es la repetición del contenido. Revisa resultados y evolución antes de modificarlo.
              </p>
            )}

            <p className="text-[0.76rem] text-frio">
              Campaña: {a.campania || "—"} · Anuncio: {a.nombre}
            </p>
          </dl>
        </div>
      )}
    </div>
  );
}

function Dato({ titulo, valor, ayuda }: { titulo: string; valor: string; ayuda: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-[0.82rem] font-semibold text-tinta">{titulo}</dt>
        <dd className="shrink-0 text-[0.9rem] font-bold tabular-nums text-tinta">{valor}</dd>
      </div>
      <p className="mt-0.5 text-[0.78rem] text-frio">{ayuda}</p>
    </div>
  );
}

/** ISO de Meta → "15 de sep". */
function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/**
 * Cuántos días le quedan. `null` si no tiene fecha de fin — que no es lo mismo
 * que cero: significa que corre indefinidamente hasta que alguien lo apague.
 */
function diasRestantes(fin?: string): number | null {
  if (!fin) return null;
  const d = new Date(fin).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.ceil((d - Date.now()) / 86_400_000));
}

/**
 * El estado de Meta, en castellano.
 *
 * `CAMPAIGN_PAUSED` y `ADSET_PAUSED` importan tanto como `PAUSED`: el anuncio
 * está encendido pero no se muestra porque lo pausaron más arriba, y eso desde
 * la fila del anuncio no se ve. Sin traducirlo, el dueño cree que está
 * corriendo.
 */
function estado(e?: string): { texto: string; clase: string } {
  switch (e) {
    case "ACTIVE": return { texto: "corriendo", clase: "bg-ok/12 text-ok" };
    case "PAUSED": return { texto: "pausado", clase: "bg-arena text-frio" };
    case "CAMPAIGN_PAUSED": return { texto: "campaña pausada", clase: "bg-arena text-frio" };
    case "ADSET_PAUSED": return { texto: "conjunto pausado", clase: "bg-arena text-frio" };
    case "PENDING_REVIEW": return { texto: "en revisión", clase: "bg-tibio-suave text-tibio" };
    case "DISAPPROVED": return { texto: "rechazado", clase: "bg-calor-suave text-calor-hondo" };
    case "ARCHIVED":
    case "DELETED": return { texto: "archivado", clase: "bg-arena text-frio" };
    default: return { texto: "—", clase: "bg-arena text-frio" };
  }
}

/**
 * El veredicto del anuncio, en una palabra.
 *
 * Mira el CTR —qué porcentaje de los que lo vieron lo tocaron— porque es la
 * única métrica que dice si el anuncio ENGANCHA, independiente del
 * presupuesto: uno de S/2 y uno de S/200 se comparan igual.
 *
 * El 1% es el promedio de Facebook para campañas de tráfico y mensajes. Por
 * debajo de 0.8% el problema casi siempre es la imagen o el texto, no el
 * público.
 */
function veredicto(a: AnuncioMetricas): { texto: string; clase: string } {
  if (a.impresiones === 0) return { texto: "sin mostrar", clase: "bg-arena text-frio" };
  // Con caché anterior al 17-sep no hay `ctr`: sin él no se puede juzgar, y un
  // "flojo" inventado haría apagar un anuncio que quizás funciona.
  if (a.ctr === undefined) return { texto: "CTR no medido", clase: "bg-arena text-tinta-2" };
  return { texto: `CTR ${a.ctr.toFixed(1)}%`, clase: "bg-arena text-tinta-2" };
}

/**
 * PRENDER O APAGAR UN ANUNCIO (2026-09-18, pedido de Jonathan: "podemos también
 * encender una campaña, apagarla desde LeadAI").
 *
 * El panel venía diciendo "este anuncio viene cayendo, conviene pausarlo" y
 * para pausarlo había que abrir Meta: el consejo acá, la acción en otra
 * herramienta.
 *
 * PIDE CONFIRMACIÓN AL PRENDER, no al pausar. Prender empieza a gastar plata de
 * verdad; pausar solo deja de gastarla, y pedir confirmación para dejar de
 * gastar convierte la salida de emergencia en un trámite.
 */
function ControlEncendido({ a, alCambiar, tenant }: { a: AnuncioMetricas; alCambiar: () => void; tenant?: string }) {
  const vivo = useRef(true);
  const ocupado = useRef(false);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoCampania, setConfirmandoCampania] = useState(false);
  // `campaniaCaida`: el anuncio está encendido pero SU CAMPAÑA está pausada, así
  // que no se muestra. Lo detecta el estado CAMPAIGN_PAUSED de Meta, o la
  // respuesta al encender el anuncio. Arreglarlo es prender la campaña entera,
  // no el anuncio — por eso lleva su propio botón.
  const [campaniaCaida, setCampaniaCaida] = useState(a.estado === "CAMPAIGN_PAUSED");
  const corriendo = a.estado === "ACTIVE";

  async function cambiar(estado: "ACTIVE" | "PAUSED") {
    if (ocupado.current) return;
    ocupado.current = true;
    setTrabajando(true);
    setAviso(null);
    setConfirmando(false);
    try {
      const r = await cambiarEstadoAnuncio(a.adId, estado, tenant);
      if (!vivo.current) return;
      if (!r.ok) throw new Error("No se pudo cambiar el estado del anuncio.");
      // El anuncio puede quedar ACTIVE y seguir sin mostrarse, porque lo
      // apagado es la campaña. En vez de solo avisarlo, se ofrece el botón para
      // arreglarlo en el acto (ver `reactivarCampania`).
      if (estado === "ACTIVE" && r.campaniaPausada) {
        setCampaniaCaida(true);
        setAviso("Quedó encendido, pero su campaña está pausada: todavía no se muestra.");
      }
      alCambiar();
    } catch (e) {
      if (vivo.current) setAviso(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      ocupado.current = false;
      if (vivo.current) setTrabajando(false);
    }
  }

  // Prende la CAMPAÑA entera (no el anuncio). Es lo que destraba el caso
  // "encendido pero no se muestra": sin esto, había que entrar al Ads Manager.
  async function reactivarCampania() {
    if (ocupado.current) return;
    if (!a.campaniaId) { setAviso("No pudimos identificar la campaña. Prueba desde el administrador de Meta."); return; }
    ocupado.current = true;
    setTrabajando(true);
    setAviso(null);
    try {
      const r = await cambiarEstadoCampania(a.campaniaId, "ACTIVE", tenant);
      if (!vivo.current) return;
      if (!r.ok) throw new Error("No se pudo reactivar la campaña.");
      setCampaniaCaida(false);
      setConfirmandoCampania(false);
      setAviso("Campaña reactivada. La entrega depende del estado de sus anuncios en Meta.");
      alCambiar();
    } catch (e) {
      if (vivo.current) setAviso(e instanceof Error ? e.message : "No se pudo reactivar la campaña");
    } finally {
      ocupado.current = false;
      if (vivo.current) setTrabajando(false);
    }
  }

  return (
    <div className="rounded-lg bg-carta px-3 py-2.5 ring-1 ring-linea">
      {/* LA CAMPAÑA PAUSADA MANDA (2026-09-18): si la campaña está caída, el
          anuncio no se muestra aunque esté ACTIVE. Se ofrece prender la campaña
          entera aquí mismo, en vez de mandar al dueño al Ads Manager. */}
      {campaniaCaida && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-tibio-suave px-3 py-2">
          <span className="text-[0.8rem] text-tibio">
            Su campaña está pausada: aunque el anuncio esté encendido, no se muestra.
          </span>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => setConfirmandoCampania(true)}
            className="rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
          >
            {trabajando ? "Reactivando…" : "Reactivar campaña"}
          </button>
        </div>
      )}
      {confirmandoCampania && <div className="mb-3 text-sm text-tinta-2">
        <p>Reactivar «{a.campania}» puede empezar a gastar el presupuesto de toda la campaña y activar la entrega de otros anuncios.</p>
        <button type="button" disabled={trabajando} onClick={() => void reactivarCampania()} className="mt-2 rounded-chip bg-brasa px-3 py-2 font-bold text-sobre-brasa">Sí, reactivar y empezar a gastar</button>
        <button type="button" disabled={trabajando} onClick={() => setConfirmandoCampania(false)} className="ml-3 p-2">Cancelar reactivación</button>
      </div>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.84rem] text-tinta-2">
          {corriendo ? "Se está mostrando y gastando" : "Está pausado, no gasta"}
        </span>

        {corriendo ? (
          <button
            type="button"
            disabled={trabajando}
            onClick={() => void cambiar("PAUSED")}
            className="rounded-chip bg-arena px-3 py-1.5 text-[0.8rem] font-bold text-tinta-2 ring-1 ring-linea transition hover:text-tinta disabled:opacity-50"
          >
            {trabajando ? "Pausando…" : "Pausar"}
          </button>
        ) : confirmando ? (
          <span className="flex items-center gap-2">
            <button
              type="button"
              disabled={trabajando}
              onClick={() => void cambiar("ACTIVE")}
              className="rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition hover:opacity-90 disabled:opacity-50"
            >
              {trabajando ? "Encendiendo…" : "Sí, empezar a gastar"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[0.8rem] font-semibold text-frio hover:text-tinta"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="rounded-chip bg-brasa px-3 py-1.5 text-[0.8rem] font-bold text-sobre-brasa transition hover:opacity-90"
          >
            Encender
          </button>
        )}
      </div>

      {aviso && <p role="status" className="mt-2 text-[0.78rem] text-tibio">{aviso}</p>}
    </div>
  );
}
