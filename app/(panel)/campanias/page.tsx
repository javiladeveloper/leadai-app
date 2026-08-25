"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { haySesion } from "@/lib/auth";
import {
  listarPlantillasHSM, crearPlantillaHSM, eliminarPlantillaHSM, cupoCampanias,
  estadoPagoCampanias, listarCampanias, crearCampaniaHSM, pausarCampania, subirMediaPost,
  type PlantillaHSM, type CampaniaHSM, type CupoCampanias,
  type EstadoPagoCampanias,
} from "@/lib/api";
import { SkeletonLista } from "@/components/Skeletons";
import { BarraNegociosGlobal, useSeccionGlobal } from "@/components/panel/GlobalNegocios";

type Estado = "cargando" | "ok" | "error";

const ESTADO_CAMPANIA: Record<string, { texto: string; clase: string }> = {
  enviando: { texto: "Enviando", clase: "bg-ok/12 text-ok" },
  pausada: { texto: "Pausada", clase: "bg-tibio-suave text-tibio" },
  completada: { texto: "Completada", clase: "bg-arena text-frio" },
};

const ESTADO_PLANTILLA: Record<string, { texto: string; clase: string }> = {
  APPROVED: { texto: "Aprobada", clase: "bg-ok/12 text-ok" },
  PENDING: { texto: "En revisión de Meta", clase: "bg-tibio-suave text-tibio" },
  REJECTED: { texto: "Rechazada", clase: "bg-calor-suave text-calor-hondo" },
};

// Campañas HSM: envíos masivos de plantillas de WhatsApp a la base de contactos.
// Los envíos NO consumen la cuota de clientes; el peaje por mensaje lo cobra
// Meta directo a la tarjeta del negocio (registrada en SU cuenta de Meta).
/**
 * `embebido`: esta pantalla se monta DENTRO de /marketing, que ya puso el
 * título y la barra de negocios. Sin esto, se verían dos veces.
 */
export default function CampaniasPanel({ embebido = false }: { embebido?: boolean } = {}) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [campanias, setCampanias] = useState<CampaniaHSM[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaHSM[]>([]);
  const [errorPlantillas, setErrorPlantillas] = useState("");
  const [cupo, setCupo] = useState<CupoCampanias | null>(null);
  const [pago, setPago] = useState<EstadoPagoCampanias | null>(null);
  const [pestania, setPestania] = useState<"campanias" | "plantillas">("campanias");
  const [aviso, setAviso] = useState("");

  // Crear campaña
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [plantillaSel, setPlantillaSel] = useState("");
  const [contactosTexto, setContactosTexto] = useState("");
  const [programada, setProgramada] = useState("");
  const [encabezadoUrl, setEncabezadoUrl] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [enviandoForm, setEnviandoForm] = useState(false);
  const [msg, setMsg] = useState("");

  // Crear plantilla
  const [creandoPlantilla, setCreandoPlantilla] = useState(false);
  const [pNombre, setPNombre] = useState("");
  const [pCategoria, setPCategoria] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [pCuerpo, setPCuerpo] = useState("");
  const [pImagenUrl, setPImagenUrl] = useState("");
  const [pSubiendo, setPSubiendo] = useState(false);
  const [pMsg, setPMsg] = useState("");
  const [borrando, setBorrando] = useState<string | null>(null);

  const g = useSeccionGlobal();

  useEffect(() => {
    if (!haySesion()) { router.replace("/"); return; }
    setListo(true);
  }, [router]);

  const cargar = useCallback(async () => {
    setEstado("cargando");
    const [c, p, q, ep] = await Promise.all([
      listarCampanias(g.tenantLista),
      listarPlantillasHSM(g.tenantLista),
      cupoCampanias(g.tenantLista),
      estadoPagoCampanias(g.tenantLista),
    ]);
    setCampanias(c);
    setPlantillas(p.plantillas);
    setErrorPlantillas(p.ok ? "" : (p.error ?? ""));
    setCupo(q);
    setPago(ep);
    setEstado("ok");
  }, [g.tenantLista]);

  useEffect(() => { if (listo && g.listaLista) cargar(); }, [listo, g.listaLista, cargar]);

  // Teléfonos pegados: uno por línea, "999888777" o "999888777, Nombre".
  function parsearContactos(): { telefono: string; nombre?: string }[] {
    return contactosTexto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [telefono, ...resto] = l.split(",");
        const nombreC = resto.join(",").trim();
        return { telefono: telefono.trim(), ...(nombreC ? { nombre: nombreC } : {}) };
      })
      .filter((c) => c.telefono.replace(/\D/g, "").length >= 6);
  }

  async function subirEncabezado(e: React.ChangeEvent<HTMLInputElement>, destino: "campania" | "plantilla") {
    const file = e.target.files?.[0];
    if (!file) return;
    const setSub = destino === "campania" ? setSubiendo : setPSubiendo;
    const setUrl = destino === "campania" ? setEncabezadoUrl : setPImagenUrl;
    setSub(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await subirMediaPost(String(reader.result), g.tenantLista);
      setSub(false);
      if (r.ok && r.url) setUrl(r.url);
      else (destino === "campania" ? setMsg : setPMsg)(r.error ?? "No se pudo subir la imagen.");
    };
    reader.readAsDataURL(file);
  }

  async function crearCampaniaSubmit() {
    if (enviandoForm) return;
    setMsg("");
    const contactos = parsearContactos();
    if (contactos.length === 0) { setMsg("Pega al menos un teléfono (uno por línea)."); return; }
    const plantilla = plantillas.find((p) => p.nombre === plantillaSel);
    if (!plantilla) { setMsg("Elige una plantilla aprobada."); return; }
    setEnviandoForm(true);
    const r = await crearCampaniaHSM({
      nombre: nombre.trim(),
      plantillaNombre: plantilla.nombre,
      cuerpoVista: plantilla.cuerpo,
      // El encabezado multimedia de la plantilla se manda como parámetro al
      // enviar (regla de Meta): si la plantilla lo tiene, la campaña necesita la URL.
      ...(plantilla.encabezadoTipo && encabezadoUrl
        ? { encabezado: { tipo: plantilla.encabezadoTipo as "IMAGE" | "VIDEO" | "DOCUMENT", url: encabezadoUrl } }
        : {}),
      ...(programada ? { programadaPara: new Date(programada).toISOString() } : {}),
      contactos,
    }, g.tenantLista);
    setEnviandoForm(false);
    if (!r.ok) { setMsg(r.error ?? "No se pudo crear la campaña."); return; }
    setCreando(false); setNombre(""); setPlantillaSel(""); setContactosTexto(""); setProgramada(""); setEncabezadoUrl("");
    setAviso(`✅ Campaña creada: ${contactos.length} destinatarios. Los envíos salen de a pocos (30 por minuto) para cuidar tu número.`);
    cargar();
  }

  async function crearPlantillaSubmit() {
    if (pSubiendo || !pNombre.trim() || pCuerpo.trim().length < 10) return;
    setPMsg("");
    const r = await crearPlantillaHSM({
      nombre: pNombre.trim(),
      categoria: pCategoria,
      cuerpo: pCuerpo.trim(),
      ...(pImagenUrl ? { encabezado: { tipo: "IMAGE" as const, url: pImagenUrl } } : {}),
    }, g.tenantLista);
    if (!r.ok) { setPMsg(r.error ?? "No se pudo crear la plantilla."); return; }
    setCreandoPlantilla(false); setPNombre(""); setPCuerpo(""); setPImagenUrl("");
    setAviso(`✅ Plantilla enviada a Meta. ${r.aviso ?? "La revisión toma minutos u horas; el estado aparece en la lista."}`);
    cargar();
  }

  async function borrarPlantilla(nombreP: string) {
    if (borrando) return;
    setBorrando(nombreP);
    const r = await eliminarPlantillaHSM(nombreP, g.tenantLista);
    setBorrando(null);
    if (!r.ok) setAviso(`⚠️ ${r.error ?? "No se pudo borrar la plantilla."}`);
    else setAviso(`✅ Plantilla "${nombreP}" eliminada.`);
    cargar();
  }

  if (!listo) return null;

  const aprobadas = plantillas.filter((p) => p.estado === "APPROVED");
  const plantillaElegida = plantillas.find((p) => p.nombre === plantillaSel);
  const contactosValidos = parsearContactos().length;

  return (
    <div className={embebido ? "space-y-6" : "mx-auto max-w-3xl space-y-6 px-5 py-6 lg:px-8"}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        {!embebido && (
          <div>
            <p className="eyebrow">Tu embudo</p>
            <h1 className="mt-1 text-[1.8rem] font-bold text-tinta">Campañas</h1>
            <p className="mt-1 text-[0.92rem] text-frio">
              Envíos masivos por WhatsApp a tu base de contactos, con plantillas aprobadas por Meta.
            </p>
          </div>
        )}
        {/* El botón de acción SE QUEDA aunque esté embebido: es lo que la
            persona vino a hacer. `ml-auto` lo mantiene a la derecha cuando el
            título ya no está para empujarlo. */}
        {!creando && pestania === "campanias" && (
          <button
            onClick={() => setCreando(true)}
            className={`rounded-chip bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo ${embebido ? "ml-auto" : ""}`}
          >
            + Nueva campaña
          </button>
        )}
      </header>

      {!embebido && g.modoGlobal && (
        <BarraNegociosGlobal negocios={g.negocios} enfocado={g.enfocado} onElegir={g.setEnfocado} />
      )}

      {/* Cupo del plan + costo Meta */}
      <div className="flex flex-wrap gap-3">
        {cupo && (
          <div className="rounded-tarjeta bg-carta px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-linea">
            {/* EL TOPE ES EL DEL PLAN (2026-08-24). Meta le cobra directo a la
                tarjeta del negocio, así que aquí solo se cuenta cuántos envíos
                le quedan del mes. */}
            {cupo.incluido
              ? <>📨 <b className="text-tinta">{cupo.restante.toLocaleString()}</b> envíos disponibles este mes (de {cupo.tope.toLocaleString()} del plan). No consumen tu cuota de clientes.</>
              : <>📨 Tu plan no incluye campañas — se activan desde el plan Emprende.</>}
          </div>
        )}
        {/* LA TARJETA EN META. Solo si SABEMOS que no la tiene:
            `tieneMetodoPago === null` significa "no se pudo determinar" (Meta
            no respondió, o la WABA no está conectada), y ahí callarse es mejor
            que pedirle una tarjeta a quien quizás ya la registró. */}
        {pago?.tieneMetodoPago === false && (
          <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.84rem] text-tinta-2 ring-1 ring-tibio/30">
            💳 Meta cobra cada mensaje de campaña a la tarjeta de TU cuenta de Meta, y aún no tienes una registrada.{" "}
            <a href={pago.urlPagos} target="_blank" rel="noreferrer" className="font-semibold text-brasa-texto underline">
              Regístrala aquí
            </a>{" "}
            para que los envíos salgan.
          </div>
        )}
      </div>

      {aviso && (
        <div className="flex items-start justify-between gap-3 rounded-tarjeta bg-ok/8 px-4 py-3 text-[0.86rem] text-tinta-2 ring-1 ring-ok/25">
          <span>{aviso}</span>
          <button onClick={() => setAviso("")} className="shrink-0 text-frio hover:text-tinta">✕</button>
        </div>
      )}

      {/* Pestañas */}
      <div className="flex gap-1.5">
        {/* "Envíos", no "Campañas" (2026-08-24): esta pantalla ahora vive
            dentro de Marketing, bajo una pestaña que YA se llama Campañas.
            Repetir la palabra un nivel más abajo hacía que dos controles
            distintos parecieran el mismo. Y "Envíos" describe mejor lo que
            hay aquí: la lista de lo que se mandó. */}
        {([["campanias", "Envíos"], ["plantillas", "Plantillas"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => { setPestania(id); setCreando(false); setCreandoPlantilla(false); }}
            className={`rounded-chip px-4 py-2 text-sm font-semibold transition ${
              pestania === id ? "bg-tinta text-carta" : "bg-arena text-tinta-2 hover:bg-linea"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Nueva campaña ── */}
      {pestania === "campanias" && creando && (
        <div className="space-y-4 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
          <h2 className="text-[1.05rem] font-bold text-tinta">Nueva campaña</h2>

          <div>
            <label className="text-[0.85rem] font-bold text-tinta">Nombre (interno, para reconocerla)</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Promo agosto — clientes antiguos"
              className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
          </div>

          <div>
            <label className="text-[0.85rem] font-bold text-tinta">Plantilla (aprobada por Meta)</label>
            {aprobadas.length === 0 ? (
              <p className="mt-1 rounded-tarjeta bg-arena/50 px-3 py-2.5 text-[0.85rem] text-frio">
                Aún no tienes plantillas aprobadas. Créala en la pestaña "Plantillas" — Meta la revisa en minutos u horas.
              </p>
            ) : (
              <select
                value={plantillaSel}
                onChange={(e) => setPlantillaSel(e.target.value)}
                className="mt-1 block w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
              >
                <option value="">Elegir plantilla…</option>
                {aprobadas.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
              </select>
            )}
            {plantillaElegida && (
              <p className="mt-2 whitespace-pre-wrap rounded-tarjeta bg-arena/50 px-3 py-2.5 text-[0.84rem] text-tinta-2">
                {plantillaElegida.cuerpo}
              </p>
            )}
          </div>

          {plantillaElegida?.encabezadoTipo === "IMAGE" && (
            <div>
              <label className="text-[0.85rem] font-bold text-tinta">Imagen del encabezado</label>
              <p className="text-[0.76rem] text-frio">Esta plantilla lleva imagen: Meta pide adjuntarla en cada campaña.</p>
              {encabezadoUrl ? (
                <div className="mt-1 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={encabezadoUrl} alt="Encabezado" className="h-20 rounded-tarjeta object-cover ring-1 ring-linea" />
                  <button onClick={() => setEncabezadoUrl("")} className="text-[0.8rem] font-semibold text-calor-hondo">Quitar</button>
                </div>
              ) : (
                <label className="mt-1 flex cursor-pointer items-center justify-center rounded-tarjeta border-2 border-dashed border-linea bg-arena/40 px-3 py-4 text-[0.86rem] text-frio transition hover:border-brasa/40">
                  {subiendo ? "Subiendo…" : "📷 Subir imagen"}
                  <input type="file" accept="image/*" onChange={(e) => subirEncabezado(e, "campania")} className="hidden" disabled={subiendo} />
                </label>
              )}
            </div>
          )}

          <div>
            <label className="text-[0.85rem] font-bold text-tinta">Destinatarios</label>
            <p className="text-[0.76rem] text-frio">Pega los teléfonos, uno por línea. Opcional: coma y el nombre (se usa para personalizar el {"{{1}}"} de la plantilla).</p>
            <textarea
              value={contactosTexto}
              onChange={(e) => setContactosTexto(e.target.value)}
              rows={6}
              placeholder={"986110558, María\n999888777, Carlos\n51987654321"}
              className="mt-1 w-full resize-y rounded-tarjeta bg-arena/60 px-3 py-2.5 font-mono text-[0.84rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
            {contactosValidos > 0 && (
              <p className="mt-1 text-[0.78rem] text-frio">{contactosValidos} destinatario{contactosValidos === 1 ? "" : "s"} detectado{contactosValidos === 1 ? "" : "s"}.</p>
            )}
          </div>

          <div>
            <label className="text-[0.85rem] font-bold text-tinta">Programar (opcional)</label>
            <input
              type="datetime-local"
              value={programada}
              onChange={(e) => setProgramada(e.target.value)}
              className="mt-1 block rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
            />
            <p className="mt-1 text-[0.74rem] text-frio">Vacío = empieza a enviar de inmediato.</p>
          </div>

          {msg && <p className="text-[0.84rem] font-semibold text-calor-hondo">{msg}</p>}

          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setCreando(false)} className="rounded-chip bg-arena px-4 py-2 text-sm font-semibold text-tinta-2 transition hover:bg-linea">
              Cancelar
            </button>
            <button
              onClick={crearCampaniaSubmit}
              disabled={enviandoForm || !nombre.trim() || !plantillaSel || contactosValidos === 0 || (plantillaElegida?.encabezadoTipo === "IMAGE" && !encabezadoUrl)}
              className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
            >
              {enviandoForm ? "Creando…" : "Lanzar campaña"}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de campañas ── */}
      {pestania === "campanias" && !creando && (
        <div>
          {estado === "cargando" && <SkeletonLista filas={3} />}
          {estado === "ok" && campanias.length === 0 && (
            <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
              <p className="text-[1.02rem] font-bold text-tinta">Todavía no lanzaste campañas</p>
              <p className="mt-1 text-[0.88rem] text-frio">Crea una plantilla, espera la aprobación de Meta y lanza tu primer envío masivo.</p>
            </div>
          )}
          {estado === "ok" && campanias.length > 0 && (
            <div className="space-y-2.5">
              {campanias.map((c) => {
                const et = ESTADO_CAMPANIA[c.estado] ?? ESTADO_CAMPANIA.enviando;
                const progreso = c.totalDestinatarios > 0 ? Math.round(((c.enviados + c.fallidos) / c.totalDestinatarios) * 100) : 0;
                return (
                  <article key={c.id} className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-tinta">📨 {c.nombre}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>{et.texto}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[0.84rem] text-tinta-2">{c.cuerpoVista || c.plantillaNombre}</p>
                    {/* Barra de progreso del envío */}
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-arena">
                      <div className="h-full rounded-full bg-brasa transition-all" style={{ width: `${progreso}%` }} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[0.76rem] text-frio">
                        {c.enviados} enviados · {c.fallidos} fallidos · <b className="text-ok">{c.respondieron} respondieron</b> · {c.totalDestinatarios} en total
                        {c.programadaPara && c.estado === "enviando" && c.enviados === 0 && (
                          <> · programada {new Date(c.programadaPara).toLocaleString("es-PE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</>
                        )}
                      </p>
                      {(c.estado === "enviando" || c.estado === "pausada") && (
                        <button
                          onClick={async () => { await pausarCampania(c.id, c.estado === "pausada", g.tenantLista); cargar(); }}
                          className="rounded-chip bg-arena px-3 py-1.5 text-[0.76rem] font-semibold text-tinta-2 transition hover:bg-linea"
                        >
                          {c.estado === "pausada" ? "▶ Reanudar" : "⏸ Pausar"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Plantillas ── */}
      {pestania === "plantillas" && (
        <div className="space-y-4">
          {!creandoPlantilla && (
            <button
              onClick={() => setCreandoPlantilla(true)}
              className="rounded-chip bg-brasa px-5 py-2.5 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo"
            >
              + Nueva plantilla
            </button>
          )}

          {creandoPlantilla && (
            <div className="space-y-4 rounded-tarjeta bg-carta p-5 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
              <h2 className="text-[1.05rem] font-bold text-tinta">Nueva plantilla</h2>
              <p className="text-[0.82rem] text-frio">
                Meta revisa cada plantilla antes de permitir su envío (minutos u horas). Usa {"{{1}}"} donde quieras el nombre del contacto.
              </p>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Nombre</label>
                <input
                  value={pNombre}
                  onChange={(e) => setPNombre(e.target.value)}
                  placeholder="Ej: promo agosto"
                  className="mt-1 w-full rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
                <p className="mt-1 text-[0.74rem] text-frio">Se normaliza a minúsculas con guiones bajos (regla de Meta).</p>
              </div>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Tipo</label>
                <div className="mt-1 flex gap-2">
                  {([["MARKETING", "Marketing (promos, ofertas)"], ["UTILITY", "Utilidad (recordatorios, avisos)"]] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setPCategoria(id)}
                      className={`rounded-chip px-3.5 py-2 text-[0.82rem] font-semibold transition ${
                        pCategoria === id ? "bg-tinta text-carta" : "bg-arena text-tinta-2 hover:bg-linea"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Mensaje</label>
                <textarea
                  value={pCuerpo}
                  onChange={(e) => setPCuerpo(e.target.value)}
                  rows={4}
                  placeholder={"Hola {{1}} 👋 Este mes tenemos 2x1 en… Responde a este mensaje y te contamos."}
                  className="mt-1 w-full resize-none rounded-tarjeta bg-arena/60 px-3 py-2.5 text-[0.9rem] text-tinta outline-none ring-1 ring-linea focus:ring-brasa/40"
                />
              </div>
              <div>
                <label className="text-[0.85rem] font-bold text-tinta">Imagen de encabezado (opcional)</label>
                {pImagenUrl ? (
                  <div className="mt-1 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pImagenUrl} alt="Encabezado" className="h-20 rounded-tarjeta object-cover ring-1 ring-linea" />
                    <button onClick={() => setPImagenUrl("")} className="text-[0.8rem] font-semibold text-calor-hondo">Quitar</button>
                  </div>
                ) : (
                  <label className="mt-1 flex cursor-pointer items-center justify-center rounded-tarjeta border-2 border-dashed border-linea bg-arena/40 px-3 py-4 text-[0.86rem] text-frio transition hover:border-brasa/40">
                    {pSubiendo ? "Subiendo…" : "📷 Subir imagen (promos con flyer, antes/después)"}
                    <input type="file" accept="image/*" onChange={(e) => subirEncabezado(e, "plantilla")} className="hidden" disabled={pSubiendo} />
                  </label>
                )}
              </div>
              {pMsg && <p className="text-[0.84rem] font-semibold text-calor-hondo">{pMsg}</p>}
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setCreandoPlantilla(false)} className="rounded-chip bg-arena px-4 py-2 text-sm font-semibold text-tinta-2 transition hover:bg-linea">
                  Cancelar
                </button>
                <button
                  onClick={crearPlantillaSubmit}
                  disabled={pSubiendo || !pNombre.trim() || pCuerpo.trim().length < 10}
                  className="rounded-chip bg-brasa px-5 py-2 text-sm font-semibold text-sobre-brasa transition hover:bg-brasa-hondo disabled:opacity-50"
                >
                  Enviar a revisión de Meta
                </button>
              </div>
            </div>
          )}

          {estado === "cargando" && <SkeletonLista filas={3} />}
          {estado === "ok" && errorPlantillas && (
            <div className="rounded-tarjeta bg-tibio-suave/50 px-4 py-3 text-[0.86rem] text-tinta-2 ring-1 ring-tibio/30">
              {errorPlantillas}
            </div>
          )}
          {estado === "ok" && !errorPlantillas && plantillas.length === 0 && !creandoPlantilla && (
            <div className="rounded-tarjeta bg-carta p-6 text-center ring-1 ring-linea">
              <p className="text-[1.02rem] font-bold text-tinta">Sin plantillas todavía</p>
              <p className="mt-1 text-[0.88rem] text-frio">Las campañas usan plantillas aprobadas por Meta. Crea la primera.</p>
            </div>
          )}
          {estado === "ok" && plantillas.length > 0 && (
            <div className="space-y-2.5">
              {plantillas.map((p) => {
                const et = ESTADO_PLANTILLA[p.estado] ?? { texto: p.estado, clase: "bg-arena text-frio" };
                return (
                  <article key={`${p.nombre}-${p.idioma}`} className="rounded-tarjeta bg-carta p-4 shadow-[var(--sombra-tarjeta)] ring-1 ring-linea">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-tinta">
                        {p.encabezadoTipo === "IMAGE" ? "🖼️ " : ""}{p.nombre}
                        <span className="ml-2 text-[0.72rem] font-normal text-frio">{p.categoria === "MARKETING" ? "Marketing" : "Utilidad"}</span>
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${et.clase}`}>{et.texto}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[0.84rem] text-tinta-2">{p.cuerpo}</p>
                    <div className="mt-2 flex justify-end">
                      <button
                        onClick={() => borrarPlantilla(p.nombre)}
                        disabled={borrando !== null}
                        className="rounded-chip bg-arena px-3 py-1.5 text-[0.76rem] font-semibold text-calor-hondo transition hover:bg-calor-suave disabled:opacity-50"
                      >
                        {borrando === p.nombre ? "Borrando…" : "Eliminar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
