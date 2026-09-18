"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  metricasPosts, refrescarMetricasPosts, detallePost,
  type MetricasPosts, type PostConResultados, type DetallePost, type RedPost,
} from "@/lib/api";
import { puedeAbrirConversacion } from "@/lib/auth";

/**
 * QUÉ POST TRAE GENTE (2026-09-18, pedido de Jonathan: "medir los posts
 * orgánicos... debemos poder entrar a los detalles").
 *
 * Instagram y Facebook muestran likes y comentarios; lo que no muestran es
 * cuál de esos posts terminó en una conversación y cuál en una venta. Eso lo
 * sabemos nosotros —los comentarios entran por el webhook y quedan ligados al
 * lead— y es lo que ordena esta lista: primero lo que vendió, después lo que
 * abrió chats, y al final lo que solo hizo ruido. Un post con 300 likes y cero
 * leads va debajo de uno con 12 likes y dos ventas.
 *
 * SE LEEN LOS POSTS DE LA RED, no solo los publicados desde LeadAI: el
 * marketero publica casi todo desde la app de Instagram, y medir solo lo que
 * salió de acá dejaría afuera la mayoría.
 *
 * EL ALCANCE PUEDE FALTAR: depende de un permiso que Meta está revisando.
 * Cuando falta se dice que falta; nunca se pinta un cero, porque "0 personas"
 * se lee como "no llegó a nadie" y lleva a borrar un post que funciona.
 */

type Filtro = "todas" | RedPost;

const RED: Record<RedPost, string> = { instagram: "Instagram", messenger: "Facebook" };
const TIPO: Record<string, string> = {
  imagen: "foto", video: "video", reel: "reel", carrusel: "carrusel", texto: "texto", enlace: "enlace",
};

export function RendimientoPosts({ tenant }: { tenant?: string } = {}) {
  // `undefined` = cargando; `null` = la API no respondió.
  const [m, setM] = useState<MetricasPosts | null | undefined>(undefined);
  const [refrescando, setRefrescando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [abierto, setAbierto] = useState<string | null>(null);

  // Al cambiar de negocio el padre remonta el componente (`key`), así que el
  // estado arranca limpio solo: no hay que resetear nada acá.
  useEffect(() => {
    let vivo = true;
    void metricasPosts(tenant).then((r) => { if (vivo) setM(r); });
    return () => { vivo = false; };
  }, [tenant]);

  async function refrescar() {
    setRefrescando(true);
    const r = await refrescarMetricasPosts(tenant);
    if (r) setM(r);
    setRefrescando(false);
  }

  if (m === undefined) return <div className="h-40 animate-pulse rounded-tarjeta bg-arena-2/70" />;

  if (m === null) {
    return (
      <Marco>
        <p className="mt-1 text-[0.88rem] text-frio">No pudimos leer tus publicaciones. Intenta de nuevo en un momento.</p>
      </Marco>
    );
  }

  const sinCanales = m.posts.length === 0 && m.faltantes.every((f) => f.motivo === "sin_canal");
  if (sinCanales) {
    return (
      <Marco>
        <p className="mt-1 text-[0.88rem] text-tinta-2">
          Conecta tu Instagram o tu página de Facebook en <b className="text-tinta">Configuración → Canales</b> y
          acá vas a ver qué publicación trae gente: cuál abrió conversaciones y cuál terminó en venta, no solo cuál juntó likes.
        </p>
      </Marco>
    );
  }

  if (m.posts.length === 0) {
    // Hay canal pero no se pudo leer: casi siempre es el permiso que Meta revisa.
    return (
      <Marco derecha={actualizado(m.actualizadoEn)} alRefrescar={refrescar} refrescando={refrescando}>
        {m.faltantes.map((f) => (
          <p key={f.canal} className="mt-1 text-[0.88rem] text-tinta-2">
            <b className="text-tinta">{RED[f.canal]}:</b>{" "}
            {f.motivo === "sin_permiso"
              ? "Meta todavía está revisando el permiso para leer tus publicaciones. Cuando lo apruebe, esto se llena solo."
              : f.detalle ?? "No se pudo leer."}
          </p>
        ))}
      </Marco>
    );
  }

  const redes = new Set(m.posts.map((p) => p.canal));
  const posts = filtro === "todas" ? m.posts : m.posts.filter((p) => p.canal === filtro);
  const totalLeads = m.posts.reduce((a, p) => a + p.leads, 0);
  const totalVentas = m.posts.reduce((a, p) => a + p.ventas, 0);
  const conLeads = m.posts.filter((p) => p.leads > 0).length;
  const faltanRedes = m.faltantes.filter((f) => f.motivo !== "sin_canal");

  return (
    <Marco derecha={actualizado(m.actualizadoEn)} alRefrescar={refrescar} refrescando={refrescando}>
      {totalLeads === 0 ? (
        <p className="mt-1 text-[0.88rem] text-tinta-2">
          De tus últimos <b className="text-tinta">{m.posts.length} posts</b>, todavía ninguno abrió una conversación.
          Cuando alguien comente preguntando, acá vas a ver de qué post vino y en qué terminó.
        </p>
      ) : (
        <p className="mt-1 text-[0.88rem] text-tinta-2">
          De tus últimos <b className="text-tinta">{m.posts.length} posts</b>, {conLeads} {conLeads === 1 ? "abrió" : "abrieron"} conversaciones:{" "}
          <b className="text-tinta">{totalLeads} {totalLeads === 1 ? "persona escribió" : "personas escribieron"}</b>
          {totalVentas > 0 && <> y <b className="text-ok">{totalVentas} {totalVentas === 1 ? "compró" : "compraron"}</b></>}.
        </p>
      )}

      {/* Lo que falta, dicho. Un permiso en revisión no es un error nuestro ni
          un cero: es una espera con fecha. */}
      {(!m.alcanceDisponible || faltanRedes.length > 0) && (
        <div className="mt-2.5 space-y-1 rounded-lg bg-arena/50 px-3 py-2 text-[0.8rem] text-tinta-2 ring-1 ring-linea">
          {!m.alcanceDisponible && (
            <p>El <b className="text-tinta">alcance</b> (cuánta gente vio cada post) aparece cuando Meta apruebe el permiso que está revisando.</p>
          )}
          {faltanRedes.map((f) => (
            <p key={f.canal}><b className="text-tinta">{RED[f.canal]}:</b> {f.motivo === "sin_permiso" ? "Meta todavía revisa el permiso para leer estas publicaciones." : f.detalle}</p>
          ))}
        </div>
      )}

      {redes.size > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(["todas", "instagram", "messenger"] as Filtro[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`rounded-chip px-2.5 py-1 text-[0.78rem] font-semibold transition ${
                filtro === f ? "bg-tinta text-carta" : "bg-arena text-tinta-2 ring-1 ring-linea hover:bg-carta"
              }`}
            >
              {f === "todas" ? "Todas" : RED[f]}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {posts.map((p, i) => {
          const clave = `${p.canal}:${p.postExterno}`;
          return (
            <Fila
              key={clave}
              p={p}
              destacado={i === 0 && filtro === "todas" && p.leads > 0}
              abierta={abierto === clave}
              alTocar={() => setAbierto(abierto === clave ? null : clave)}
              tenant={tenant}
            />
          );
        })}
      </div>
    </Marco>
  );
}

function Marco({ children, derecha, alRefrescar, refrescando }: {
  children: React.ReactNode; derecha?: string; alRefrescar?: () => void; refrescando?: boolean;
}) {
  return (
    <div className="rounded-tarjeta bg-carta p-5 ring-1 ring-linea">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[1.05rem] font-bold text-tinta">Qué post trae gente</h3>
          <p className="text-[0.8rem] text-frio">Tus últimas publicaciones en Instagram y Facebook, ordenadas por lo que consiguieron: ventas, conversaciones y recién después likes.</p>
        </div>
        <div className="flex items-center gap-2 text-[0.8rem] text-frio">
          {derecha && <span>{derecha}</span>}
          {alRefrescar && (
            <button
              type="button"
              onClick={alRefrescar}
              disabled={refrescando}
              className="rounded-chip bg-arena px-2.5 py-1 font-semibold text-tinta-2 ring-1 ring-linea transition hover:bg-carta disabled:opacity-50"
            >
              {refrescando ? "Leyendo…" : "Actualizar"}
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Una fila por post: la pieza, sus números, y a la derecha lo que consiguió. */
function Fila({ p, destacado, abierta, alTocar, tenant }: {
  p: PostConResultados; destacado: boolean; abierta: boolean; alTocar: () => void; tenant?: string;
}) {
  return (
    <div className={`rounded-lg ring-1 ${destacado ? "bg-brasa-suave/40 ring-brasa/40" : "bg-arena/40 ring-linea"}`}>
      <button type="button" onClick={alTocar} className="flex w-full items-start gap-3 px-3 py-2.5 text-left">
        <Miniatura p={p} tam="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[0.72rem] text-frio">
            <span className="rounded-full bg-arena px-2 py-0.5 font-semibold text-tinta-2">{RED[p.canal]}</span>
            <span>{TIPO[p.tipo] ?? p.tipo}</span>
            <span>· {fecha(p.publicadoEn)}</span>
            {p.publicacionId && <span className="rounded-full bg-carta px-2 py-0.5 font-semibold text-tinta-2 ring-1 ring-linea">desde LeadAI</span>}
            {destacado && (
              <span className="rounded-full bg-brasa px-2 py-0.5 font-bold text-sobre-brasa">
                {p.ventas > 0 ? "El que más vende" : "El que más gente trae"}
              </span>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-[0.88rem] text-tinta">{p.texto || <span className="text-frio">Sin texto</span>}</p>
          <p className="mt-1 text-[0.76rem] text-frio">
            {n(p.reacciones)} {p.reacciones === 1 ? "reacción" : "reacciones"} · {n(p.comentarios)} comentarios
            {p.compartidos !== undefined && <> · {n(p.compartidos)} compartidos</>}
            {p.alcance !== undefined && <> · <b className="text-tinta-2">{n(p.alcance)} lo vieron</b></>}
          </p>
        </div>
        <Resultado p={p} />
      </button>
      {abierta && <Detalle p={p} tenant={tenant} />}
    </div>
  );
}

/** La columna de la derecha: lo único que Instagram no te dice. */
function Resultado({ p }: { p: PostConResultados }) {
  if (p.leads === 0) {
    return (
      <div className="shrink-0 text-right text-[0.74rem] text-frio">
        <p>Sin conversaciones</p>
        {p.conIntencionCompra > 0 && <p>{p.conIntencionCompra} {p.conIntencionCompra === 1 ? "pregunta" : "preguntas"} de compra</p>}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span className="rounded-full bg-brasa-suave px-2 py-0.5 text-[0.76rem] font-bold text-brasa-texto">
        {p.leads} {p.leads === 1 ? "conversación" : "conversaciones"}
      </span>
      {p.ventas > 0 && (
        <span className="rounded-full bg-ok/12 px-2 py-0.5 text-[0.76rem] font-bold text-ok">
          {p.ventas} {p.ventas === 1 ? "venta" : "ventas"}
        </span>
      )}
    </div>
  );
}

function Miniatura({ p, tam }: { p: PostConResultados; tam: string }) {
  if (!p.imagen) return <div className={`${tam} shrink-0 rounded-lg bg-arena ring-1 ring-linea`} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={p.imagen} alt="" className={`${tam} shrink-0 rounded-lg object-cover ring-1 ring-linea`} />;
}

// ── El detalle: la pieza completa, la curva, los comentarios y las personas ──

const INTENCION: Record<string, { texto: string; clase: string }> = {
  compra: { texto: "Quiere comprar", clase: "bg-brasa-suave text-brasa-texto" },
  halago: { texto: "Halago", clase: "bg-arena text-tinta-2" },
  spam: { texto: "Spam", clase: "bg-arena text-frio" },
  otro: { texto: "Otro", clase: "bg-arena text-tinta-2" },
};

const NIVEL: Record<string, { texto: string; clase: string }> = {
  caliente: { texto: "Caliente", clase: "bg-calor-suave text-calor" },
  tibio: { texto: "Tibio", clase: "bg-tibio-suave text-tibio" },
  frio: { texto: "Frío", clase: "bg-arena text-frio" },
};

const ESTADO: Record<string, string> = {
  nuevo: "nuevo", nutriendo: "en seguimiento", escalado: "escalado a una persona", ganado: "compró", perdido: "perdido",
};

function Detalle({ p, tenant }: { p: PostConResultados; tenant?: string }) {
  const [d, setD] = useState<DetallePost | null | undefined>(undefined);
  const puedeAbrir = puedeAbrirConversacion();

  useEffect(() => {
    let vivo = true;
    void detallePost(p.canal, p.postExterno, tenant).then((r) => { if (vivo) setD(r); });
    return () => { vivo = false; };
  }, [p.canal, p.postExterno, tenant]);

  if (d === undefined) return <div className="mx-3 mb-3 h-24 animate-pulse rounded-lg bg-arena-2/70" />;
  if (d === null) return <p className="px-3 pb-3 text-[0.82rem] text-frio">No pudimos cargar el detalle.</p>;

  const post = d.post;
  return (
    <div className="border-t border-linea px-3 pb-3 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Miniatura p={post} tam="h-40 w-full sm:h-44 sm:w-44" />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-[0.86rem] text-tinta">{post.texto || <span className="text-frio">Sin texto</span>}</p>
          {post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-[0.8rem] font-semibold text-brasa-texto hover:underline">
              Ver en {RED[post.canal]} ↗
            </a>
          )}
        </div>
      </div>

      {/* LOS NÚMEROS, CADA UNO CON LO QUE SIGNIFICA. Meta los muestra sin
          explicar; quien no vive en Instagram no sabe cuál mirar. */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Dato valor={n(post.reacciones)} etiqueta="reacciones" nota="si gustó" />
        <Dato
          valor={n(post.comentarios)}
          etiqueta="comentarios"
          nota={post.comentariosLeidos < post.comentarios ? `${post.comentariosLeidos} los leyó LeadAI` : "todos los leyó LeadAI"}
        />
        {post.compartidos !== undefined && <Dato valor={n(post.compartidos)} etiqueta="compartidos" nota="si lo pasaron" />}
        <Dato
          valor={post.alcance !== undefined ? n(post.alcance) : "—"}
          etiqueta="lo vieron"
          nota={post.alcance !== undefined ? "personas distintas" : "Meta revisa el permiso"}
          apagado={post.alcance === undefined}
        />
        {post.guardados !== undefined && <Dato valor={n(post.guardados)} etiqueta="guardados" nota="lo quieren volver a ver" />}
        <Dato
          valor={n(post.leads)}
          etiqueta={post.leads === 1 ? "conversación" : "conversaciones"}
          nota={post.leadsCalientes > 0 ? `${post.leadsCalientes} ${post.leadsCalientes === 1 ? "llegó" : "llegaron"} a caliente` : "personas que escribieron"}
          resaltado
        />
        <Dato valor={n(post.ventas)} etiqueta={post.ventas === 1 ? "venta" : "ventas"} nota="cerradas desde este post" resaltado={post.ventas > 0} />
      </div>

      <Curva dias={d.dias} />

      {d.comentarios.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[0.82rem] font-bold text-tinta">Comentarios que entraron</h4>
          <ul className="mt-1.5 space-y-1.5">
            {d.comentarios.slice(0, 20).map((c) => {
              const inten = c.intencion ? INTENCION[c.intencion] : undefined;
              return (
                <li key={c.id} className="rounded-lg bg-carta px-2.5 py-2 text-[0.82rem] ring-1 ring-linea">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b className="text-tinta">{c.autorNombre || "Alguien"}</b>
                    <span className="text-[0.7rem] text-frio">{fecha(c.creadoEn)}</span>
                    {inten && <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${inten.clase}`}>{inten.texto}</span>}
                    {c.respondido && <span className="text-[0.7rem] text-frio">· respondido en público</span>}
                    {c.dmAbierto && <span className="text-[0.7rem] text-frio">· se le escribió por privado</span>}
                  </div>
                  <p className="mt-0.5 text-tinta-2">{c.texto}</p>
                  {c.leadId && puedeAbrir && (
                    <Link href={`/conversacion/${c.leadId}`} className="mt-1 inline-block text-[0.76rem] font-semibold text-brasa-texto hover:underline">
                      Ver la conversación →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
          {d.comentarios.length > 20 && <p className="mt-1 text-[0.74rem] text-frio">Se muestran los 20 más recientes.</p>}
        </div>
      )}

      {d.leads.length > 0 && (
        <div className="mt-3">
          <h4 className="text-[0.82rem] font-bold text-tinta">Quiénes escribieron desde acá</h4>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {d.leads.map((l) => {
              const niv = NIVEL[l.nivelInteres] ?? NIVEL.frio;
              const cuerpo = (
                <>
                  <b className="text-tinta">{l.nombre || "Sin nombre"}</b>
                  <span className={`rounded-full px-1.5 py-0.5 text-[0.66rem] font-bold ${niv.clase}`}>{niv.texto}</span>
                  <span className="text-frio">{ESTADO[l.estado] ?? l.estado}</span>
                </>
              );
              const clase = "flex items-center gap-1.5 rounded-full bg-carta px-2.5 py-1 text-[0.78rem] ring-1 ring-linea";
              return (
                <li key={l.id}>
                  {puedeAbrir
                    ? <Link href={`/conversacion/${l.id}`} className={`${clase} transition hover:bg-arena`}>{cuerpo}</Link>
                    : <span className={clase}>{cuerpo}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta, nota, resaltado, apagado }: {
  valor: string; etiqueta: string; nota?: string; resaltado?: boolean; apagado?: boolean;
}) {
  return (
    <div className={`rounded-lg px-2.5 py-2 ring-1 ${resaltado ? "bg-brasa-suave/60 ring-brasa/30" : "bg-carta ring-linea"}`}>
      <p className={`text-[1.05rem] font-bold tabular-nums ${apagado ? "text-frio" : "text-tinta"}`}>{valor}</p>
      <p className="text-[0.72rem] font-semibold text-tinta-2">{etiqueta}</p>
      {nota && <p className="text-[0.68rem] text-frio">{nota}</p>}
    </div>
  );
}

/**
 * CÓMO SE MOVIÓ DÍA A DÍA. Meta da los números acumulados; la foto diaria
 * permite ver si el post sigue trayendo comentarios o ya murió, que es lo que
 * decide si vale la pena pautarlo.
 */
function Curva({ dias }: { dias: DetallePost["dias"] }) {
  if (dias.length < 2) {
    return (
      <p className="mt-3 text-[0.76rem] text-frio">
        La curva día a día empieza a dibujarse desde mañana: hoy es la primera foto de este post.
      </p>
    );
  }
  const ultimos = dias.slice(-15);
  const deltas = ultimos.slice(1).map((d, i) => ({
    dia: d.dia,
    comentarios: Math.max(0, d.comentarios - ultimos[i].comentarios),
    reacciones: Math.max(0, d.reacciones - ultimos[i].reacciones),
  }));
  const max = Math.max(1, ...deltas.map((x) => x.reacciones + x.comentarios));
  const total = deltas.reduce((a, x) => a + x.reacciones + x.comentarios, 0);

  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[0.82rem] font-bold text-tinta">Cómo se movió estos días</h4>
        <span className="text-[0.72rem] text-frio">
          {total === 0 ? "ya no suma reacciones ni comentarios" : `${n(total)} nuevas en ${deltas.length} días`}
        </span>
      </div>
      <div className="mt-1.5 flex h-16 items-end gap-1">
        {deltas.map((x) => {
          const alto = Math.round(((x.reacciones + x.comentarios) / max) * 100);
          return (
            <div
              key={x.dia}
              className="flex flex-1 flex-col justify-end"
              title={`${fecha(x.dia)}: ${x.reacciones} reacciones, ${x.comentarios} comentarios`}
            >
              <div className="w-full rounded-t bg-brasa/70" style={{ height: `${Math.max(alto, 3)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-0.5 flex justify-between text-[0.66rem] text-frio">
        <span>{fecha(deltas[0].dia)}</span>
        <span>{fecha(deltas[deltas.length - 1].dia)}</span>
      </div>
    </div>
  );
}

// ── Formato ──────────────────────────────────────────────────────────────────

function n(v: number): string {
  return v.toLocaleString("es-PE");
}

/** ISO → "15 de sep". */
function fecha(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-PE", { day: "numeric", month: "short" });
}

/** "actualizado hace 12 min" — para que se sepa que no es en vivo. */
function actualizado(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "actualizado ahora";
  if (min < 60) return `actualizado hace ${min} min`;
  const h = Math.round(min / 60);
  return `actualizado hace ${h} h`;
}
